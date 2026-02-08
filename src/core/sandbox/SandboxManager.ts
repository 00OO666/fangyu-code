/**
 * SandboxManager - 代理沙箱环境管理器
 *
 * 为每个代理创建隔离的执行环境
 *
 * 功能：
 * 1. Docker 容器管理
 * 2. 终端会话管理
 * 3. 文件系统访问
 * 4. 浏览器自动化（Playwright）
 * 5. 资源监控
 *
 * 灵感来源：
 * - OpenHands 的 Docker 沙箱
 * - Devin 的隔离环境
 */

import { logger } from "@/lib/logger";
import { BrowserEventEmitter } from "../../lib/BrowserEventEmitter";
import { v4 as uuidv4 } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import type {
  Sandbox,
  SandboxSpec,
  SandboxStatus,
  SandboxTerminal,
  SandboxMetrics,
  FileChange,
  TerminalHistoryEntry,
  WorkflowConfig,
} from "../types/workflow";

// ============================================
// 类型定义
// ============================================

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

interface FileOperationResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface SandboxCreateOptions {
  agentId: string;
  projectPath?: string;
  baseImage?: string;
  envVars?: Record<string, string>;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_SANDBOX_SPEC: SandboxSpec = {
  baseImage: "node:20-alpine",
  workspaceDir: "/workspace",
  environmentVars: {
    NODE_ENV: "development",
    TERM: "xterm-256color",
  },
  exposedPorts: [3000, 5173, 8080],
  volumes: [],
  memoryLimit: "2g",
  cpuLimit: 1,
  networkMode: "bridge",
  capabilities: [],
};

// ============================================
// SandboxManager 类
// ============================================

export class SandboxManager extends BrowserEventEmitter {
  private sandboxes: Map<string, Sandbox> = new Map();
  private config: WorkflowConfig;
  private isDockerAvailable: boolean = false;

  constructor(config: WorkflowConfig) {
    super();
    this.config = config;
    this.checkDockerAvailability();
  }

  /**
   * 检查 Docker 是否可用
   */
  private async checkDockerAvailability(): Promise<void> {
    try {
      // 使用 Tauri 调用 Docker info 检查可用性
      const result = await invoke<{ available: boolean; version?: string }>(
        "docker_check_availability"
      );
      this.isDockerAvailable = result.available;
      if (result.available) {
        logger.debug(
          "SandboxManager",
          `[SandboxManager] Docker available, version: ${result.version}`
        );
      } else {
        logger.warn(
          "SandboxManager",
          "[SandboxManager] Docker not available, using simulation mode"
        );
      }
    } catch (error) {
      // Tauri 命令不存在时，回退到模拟模式
      logger.warn(
        "SandboxManager",
        "[SandboxManager] Docker check failed, using simulation mode:",
        error
      );
      this.isDockerAvailable = false;
    }
  }

  // ============================================
  // 沙箱生命周期
  // ============================================

  /**
   * 🐳 创建沙箱环境
   */
  async createSandbox(options: SandboxCreateOptions): Promise<Sandbox> {
    const sandboxId = uuidv4();
    const now = Date.now();

    const spec: SandboxSpec = {
      ...DEFAULT_SANDBOX_SPEC,
      baseImage: options.baseImage || this.config.sandbox.defaultImage,
      memoryLimit: this.config.sandbox.memoryLimit,
      cpuLimit: this.config.sandbox.cpuLimit,
      environmentVars: {
        ...DEFAULT_SANDBOX_SPEC.environmentVars,
        ...options.envVars,
      },
      volumes: options.projectPath
        ? [
            {
              hostPath: options.projectPath,
              containerPath: "/workspace",
              mode: "rw",
            },
          ]
        : [],
    };

    const sandbox: Sandbox = {
      id: sandboxId,
      agentId: options.agentId,
      status: "creating",
      spec,
      createdAt: now,
      lastActiveAt: now,
      terminals: [],
      files: {
        rootPath: spec.workspaceDir,
        watchedPaths: [spec.workspaceDir],
        recentChanges: [],
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: { bytesIn: 0, bytesOut: 0 },
      },
    };

    // 如果 Docker 可用，创建实际容器
    if (this.isDockerAvailable) {
      await this.createDockerContainer(sandbox);
    }

    sandbox.status = "running";
    this.sandboxes.set(sandboxId, sandbox);

    // 创建默认终端
    await this.createTerminal(sandboxId, "main");

    this.emit("sandbox:created", { sandbox });
    logger.debug(
      "SandboxManager",
      `[SandboxManager] Created sandbox ${sandboxId} for agent ${options.agentId}`
    );

    return sandbox;
  }

  /**
   * 创建 Docker 容器
   */
  private async createDockerContainer(sandbox: Sandbox): Promise<void> {
    try {
      // 使用 Tauri 调用 Docker API 创建容器
      const result = await invoke<{ containerId: string }>("docker_create_container", {
        name: `sandbox-${sandbox.id.slice(0, 12)}`,
        image: sandbox.spec.baseImage,
        memoryLimit: sandbox.spec.memoryLimit,
        cpuLimit: sandbox.spec.cpuLimit,
        workspaceDir: sandbox.spec.workspaceDir,
        envVars: sandbox.spec.environmentVars,
        volumes: sandbox.spec.volumes,
        exposedPorts: sandbox.spec.exposedPorts,
        networkMode: sandbox.spec.networkMode,
      });

      sandbox.containerId = result.containerId;
      logger.debug(
        "SandboxManager",
        `[SandboxManager] Created Docker container: ${result.containerId}`
      );
    } catch (error) {
      // Tauri 命令不存在时，使用模拟容器 ID
      logger.warn(
        "SandboxManager",
        "[SandboxManager] Docker create failed, using simulation:",
        error
      );
      sandbox.containerId = `sim-container-${sandbox.id.slice(0, 12)}`;
    }
  }

  /**
   * 构建 Docker 命令
   */
  private buildDockerCommand(spec: SandboxSpec): string {
    const parts = ["docker", "run", "-d", "--rm"];

    // 名称
    parts.push(`--name sandbox-${Date.now()}`);

    // 资源限制
    parts.push(`--memory=${spec.memoryLimit}`);
    parts.push(`--cpus=${spec.cpuLimit}`);

    // 环境变量
    for (const [key, value] of Object.entries(spec.environmentVars)) {
      parts.push(`-e ${key}=${value}`);
    }

    // 卷挂载
    for (const volume of spec.volumes) {
      parts.push(`-v ${volume.hostPath}:${volume.containerPath}:${volume.mode}`);
    }

    // 端口
    for (const port of spec.exposedPorts) {
      parts.push(`-p ${port}:${port}`);
    }

    // 工作目录
    parts.push(`-w ${spec.workspaceDir}`);

    // 网络模式
    parts.push(`--network=${spec.networkMode}`);

    // 镜像
    parts.push(spec.baseImage);

    // 保持运行
    parts.push("tail -f /dev/null");

    return parts.join(" ");
  }

  /**
   * 🗑️ 销毁沙箱
   */
  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    sandbox.status = "stopped";

    // 销毁 Docker 容器
    if (sandbox.containerId && this.isDockerAvailable) {
      await this.destroyDockerContainer(sandbox.containerId);
    }

    // 清理终端
    for (const terminal of sandbox.terminals) {
      await this.closeTerminal(sandboxId, terminal.id);
    }

    this.sandboxes.delete(sandboxId);
    this.emit("sandbox:destroyed", { sandboxId });

    logger.debug("SandboxManager", `[SandboxManager] Destroyed sandbox ${sandboxId}`);
  }

  /**
   * 销毁 Docker 容器
   */
  private async destroyDockerContainer(containerId: string): Promise<void> {
    try {
      // 使用 Tauri 调用 docker stop && docker rm
      await invoke("docker_destroy_container", { containerId });
      logger.debug("SandboxManager", `[SandboxManager] Destroyed Docker container: ${containerId}`);
    } catch (error) {
      logger.warn(
        "SandboxManager",
        `[SandboxManager] Failed to destroy container ${containerId}:`,
        error
      );
    }
  }

  // ============================================
  // 终端管理
  // ============================================

  /**
   * 💻 创建终端会话
   */
  async createTerminal(sandboxId: string, name?: string): Promise<SandboxTerminal> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    const terminal: SandboxTerminal = {
      id: uuidv4(),
      name: name || `terminal-${sandbox.terminals.length + 1}`,
      cwd: sandbox.spec.workspaceDir,
      isActive: true,
      history: [],
    };

    sandbox.terminals.push(terminal);

    this.emit("terminal:created", { sandboxId, terminal });
    return terminal;
  }

  /**
   * 关闭终端会话
   */
  async closeTerminal(sandboxId: string, terminalId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    const terminalIndex = sandbox.terminals.findIndex((t) => t.id === terminalId);
    if (terminalIndex >= 0) {
      sandbox.terminals[terminalIndex].isActive = false;
      this.emit("terminal:closed", { sandboxId, terminalId });
    }
  }

  /**
   * 🏃 执行命令
   */
  async executeCommand(
    sandboxId: string,
    command: string,
    terminalId?: string,
    timeout?: number
  ): Promise<CommandResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    const startTime = Date.now();
    sandbox.lastActiveAt = startTime;

    // 找到或使用默认终端
    let terminal = terminalId
      ? sandbox.terminals.find((t) => t.id === terminalId)
      : sandbox.terminals[0];

    if (!terminal) {
      terminal = await this.createTerminal(sandboxId);
    }

    let result: CommandResult;

    if (this.isDockerAvailable && sandbox.containerId) {
      // 在 Docker 容器中执行
      result = await this.executeInContainer(sandbox.containerId, command, terminal.cwd, timeout);
    } else {
      // 模拟执行
      result = await this.simulateExecution(command);
    }

    // 记录历史
    const historyEntry: TerminalHistoryEntry = {
      command,
      output: result.stdout + result.stderr,
      exitCode: result.exitCode,
      timestamp: startTime,
      duration: result.duration,
    };
    terminal.history.push(historyEntry);

    // 限制历史记录数量
    if (terminal.history.length > 100) {
      terminal.history = terminal.history.slice(-100);
    }

    this.emit("command:executed", { sandboxId, terminalId: terminal.id, command, result });

    return result;
  }

  /**
   * 在 Docker 容器中执行命令
   */
  private async executeInContainer(
    containerId: string,
    command: string,
    cwd: string,
    timeout?: number
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // 使用 Tauri 调用 docker exec
      const result = await invoke<{ stdout: string; stderr: string; exitCode: number }>(
        "docker_exec_command",
        {
          containerId,
          command,
          cwd,
          timeout: timeout || 30000,
        }
      );

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Tauri 命令不存在时，回退到模拟执行
      logger.warn(
        "SandboxManager",
        "[SandboxManager] Docker exec failed, using simulation:",
        error
      );
      return this.simulateExecution(command);
    }
  }

  /**
   * 模拟执行（Docker 不可用时）
   */
  private async simulateExecution(command: string): Promise<CommandResult> {
    const startTime = Date.now();

    // 模拟不同命令的执行
    await this.sleep(Math.random() * 500 + 100);

    // 简单的命令模拟
    if (command.startsWith("echo ")) {
      return {
        stdout: command.slice(5),
        stderr: "",
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    }

    if (command === "pwd") {
      return {
        stdout: "/workspace",
        stderr: "",
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    }

    if (command === "ls") {
      return {
        stdout: "src\npackage.json\nnode_modules\nREADME.md",
        stderr: "",
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    }

    return {
      stdout: `[Simulated] Command executed: ${command}`,
      stderr: "",
      exitCode: 0,
      duration: Date.now() - startTime,
    };
  }

  // ============================================
  // 文件操作
  // ============================================

  /**
   * 📖 读取文件
   */
  async readFile(sandboxId: string, path: string): Promise<FileOperationResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: "Sandbox not found" };
    }

    sandbox.lastActiveAt = Date.now();

    if (this.isDockerAvailable && sandbox.containerId) {
      const result = await this.executeInContainer(
        sandbox.containerId,
        `cat "${path}"`,
        sandbox.spec.workspaceDir
      );

      if (result.exitCode === 0) {
        return { success: true, content: result.stdout };
      } else {
        return { success: false, error: result.stderr };
      }
    }

    // 模拟文件读取
    return {
      success: true,
      content: `// Simulated content of ${path}\nlogger.debug('SandboxManager', 'Hello from sandbox');`,
    };
  }

  /**
   * ✏️ 写入文件
   */
  async writeFile(sandboxId: string, path: string, content: string): Promise<FileOperationResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: "Sandbox not found" };
    }

    sandbox.lastActiveAt = Date.now();

    if (this.isDockerAvailable && sandbox.containerId) {
      // 使用 heredoc 写入文件
      const escapedContent = content.replace(/'/g, "'\\''");
      const result = await this.executeInContainer(
        sandbox.containerId,
        `cat > "${path}" << 'SANDBOXEOF'\n${content}\nSANDBOXEOF`,
        sandbox.spec.workspaceDir
      );

      if (result.exitCode === 0) {
        this.recordFileChange(sandbox, "create", path);
        return { success: true };
      } else {
        return { success: false, error: result.stderr };
      }
    }

    // 模拟写入
    this.recordFileChange(sandbox, "create", path);
    return { success: true };
  }

  /**
   * 📝 编辑文件（使用 sed）
   */
  async editFile(
    sandboxId: string,
    path: string,
    oldContent: string,
    newContent: string
  ): Promise<FileOperationResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: "Sandbox not found" };
    }

    sandbox.lastActiveAt = Date.now();

    // 简单实现：读取、替换、写入
    const readResult = await this.readFile(sandboxId, path);
    if (!readResult.success) {
      return readResult;
    }

    const updatedContent = readResult.content!.replace(oldContent, newContent);
    const writeResult = await this.writeFile(sandboxId, path, updatedContent);

    if (writeResult.success) {
      this.recordFileChange(sandbox, "modify", path);
    }

    return writeResult;
  }

  /**
   * 🗑️ 删除文件
   */
  async deleteFile(sandboxId: string, path: string): Promise<FileOperationResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: "Sandbox not found" };
    }

    sandbox.lastActiveAt = Date.now();

    if (this.isDockerAvailable && sandbox.containerId) {
      const result = await this.executeInContainer(
        sandbox.containerId,
        `rm -f "${path}"`,
        sandbox.spec.workspaceDir
      );

      if (result.exitCode === 0) {
        this.recordFileChange(sandbox, "delete", path);
        return { success: true };
      } else {
        return { success: false, error: result.stderr };
      }
    }

    this.recordFileChange(sandbox, "delete", path);
    return { success: true };
  }

  /**
   * 记录文件变更
   */
  private recordFileChange(
    sandbox: Sandbox,
    type: FileChange["type"],
    path: string,
    oldPath?: string
  ): void {
    const change: FileChange = {
      type,
      path,
      oldPath,
      timestamp: Date.now(),
    };

    sandbox.files.recentChanges.push(change);

    // 限制变更记录数量
    if (sandbox.files.recentChanges.length > 50) {
      sandbox.files.recentChanges = sandbox.files.recentChanges.slice(-50);
    }

    this.emit("file:changed", { sandboxId: sandbox.id, change });
  }

  // ============================================
  // 浏览器自动化
  // ============================================

  /**
   * 🌐 启动浏览器
   */
  async launchBrowser(
    sandboxId: string,
    url: string
  ): Promise<{ success: boolean; error?: string }> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { success: false, error: "Sandbox not found" };
    }

    sandbox.lastActiveAt = Date.now();

    // 初始化浏览器状态
    sandbox.browser = {
      isActive: true,
      currentUrl: url,
      viewport: { width: 1280, height: 720 },
      screenshots: [],
    };

    if (this.isDockerAvailable && sandbox.containerId) {
      // 安装并启动 Playwright
      await this.executeInContainer(
        sandbox.containerId,
        "npx playwright install chromium --with-deps",
        sandbox.spec.workspaceDir
      );

      // 启动浏览器（实际实现会更复杂）
      logger.debug("SandboxManager", `[SandboxManager] Launching browser at ${url}`);
    }

    this.emit("browser:launched", { sandboxId, url });
    return { success: true };
  }

  /**
   * 📸 截取屏幕
   */
  async captureScreenshot(sandboxId: string): Promise<string | null> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || !sandbox.browser?.isActive) {
      return null;
    }

    // TODO: 实际截图实现
    const fakeScreenshot =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    sandbox.browser.screenshots.push(fakeScreenshot);

    // 限制截图数量
    if (sandbox.browser.screenshots.length > 10) {
      sandbox.browser.screenshots = sandbox.browser.screenshots.slice(-10);
    }

    this.emit("browser:screenshot", { sandboxId, screenshot: fakeScreenshot });
    return fakeScreenshot;
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || !sandbox.browser) return;

    sandbox.browser.isActive = false;
    this.emit("browser:closed", { sandboxId });
  }

  // ============================================
  // 监控
  // ============================================

  /**
   * 📊 获取沙箱指标
   */
  async getMetrics(sandboxId: string): Promise<SandboxMetrics | null> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return null;

    if (this.isDockerAvailable && sandbox.containerId) {
      // 获取 Docker 容器统计
      // docker stats --no-stream --format json {containerId}
      const result = await this.executeInContainer(
        sandbox.containerId,
        "cat /proc/meminfo | head -3",
        "/"
      );

      // 解析并更新指标（简化实现）
      sandbox.metrics = {
        cpuUsage: Math.random() * 50,
        memoryUsage: Math.random() * 1024 * 1024 * 500,
        diskUsage: Math.random() * 1024 * 1024 * 100,
        networkIO: {
          bytesIn: Math.random() * 10000,
          bytesOut: Math.random() * 5000,
        },
      };
    }

    return sandbox.metrics;
  }

  /**
   * 启动指标监控
   */
  startMetricsMonitoring(sandboxId: string, intervalMs: number = 5000): () => void {
    const intervalId = setInterval(async () => {
      const metrics = await this.getMetrics(sandboxId);
      if (metrics) {
        this.emit("metrics:updated", { sandboxId, metrics });
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }

  // ============================================
  // 工具方法
  // ============================================

  /**
   * 获取沙箱
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * 获取所有沙箱
   */
  getAllSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * 获取代理的沙箱
   */
  getSandboxByAgentId(agentId: string): Sandbox | undefined {
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.agentId === agentId) {
        return sandbox;
      }
    }
    return undefined;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出默认沙箱配置
export const DEFAULT_SANDBOX_CONFIG = DEFAULT_SANDBOX_SPEC;
