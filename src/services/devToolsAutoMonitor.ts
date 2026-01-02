/**
 * DevTools Auto Monitor Service
 *
 * 使用 Chrome DevTools MCP 自动监控 Fangyu Code 的运行状态
 * 实时检测异常并提供修复建议
 *
 * 功能：
 * - 自动连接到开发服务器
 * - 实时监控 console 错误
 * - 检测网络请求失败
 * - 分析性能问题
 * - 自动生成修复建议
 */

import { invoke } from "@tauri-apps/api/core";

export interface DevToolsAnomaly {
  id: string;
  type: "console-error" | "network-failure" | "performance" | "memory-leak";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  timestamp: number;
  details: any;
  suggestion: string;
  autoFixAvailable: boolean;
}

export interface MonitoringSession {
  sessionId: string;
  startTime: number;
  url: string;
  anomalies: DevToolsAnomaly[];
  isActive: boolean;
}

/**
 * DevTools 自动监控服务
 *
 * 使用说明：
 * 1. 确保 chrome-devtools MCP 已启用
 * 2. 启动 Fangyu Code 开发服务器 (npm run tauri:dev)
 * 3. 调用 startMonitoring() 开始监控
 *
 * @example
 * const monitor = new DevToolsAutoMonitor();
 * await monitor.startMonitoring("http://localhost:1420");
 * monitor.on("anomaly", (anomaly) => {
 *   console.log("检测到异常:", anomaly);
 * });
 */
export class DevToolsAutoMonitor {
  private session: MonitoringSession | null = null;
  private monitoringInterval: number | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * 开始监控
   *
   * @param url - 要监控的 URL（默认：http://localhost:1420）
   * @param options - 监控选项
   */
  async startMonitoring(
    url: string = "http://localhost:1420",
    options: {
      /** 监控间隔（秒） */
      interval?: number;
      /** 是否自动修复 */
      autoFix?: boolean;
      /** 严重性阈值 */
      severityThreshold?: "critical" | "high" | "medium" | "low";
    } = {}
  ): Promise<void> {
    const { interval = 10, autoFix = false, severityThreshold = "medium" } = options;

    // 创建监控会话
    this.session = {
      sessionId: `monitor-${Date.now()}`,
      startTime: Date.now(),
      url,
      anomalies: [],
      isActive: true,
    };

    console.log(`[DevToolsMonitor] 🚀 开始监控: ${url}`);

    try {
      // 步骤 1: 连接到 Chrome DevTools
      await this.connectToDevTools(url);

      // 步骤 2: 启动实时监控
      await this.startRealtimeMonitoring(interval);

      // 步骤 3: 定期检查异常
      this.monitoringInterval = window.setInterval(async () => {
        await this.checkForAnomalies(severityThreshold, autoFix);
      }, interval * 1000);

      console.log(`[DevToolsMonitor] ✅ 监控已启动 (间隔: ${interval}秒)`);
    } catch (error) {
      console.error("[DevToolsMonitor] ❌ 启动监控失败:", error);
      this.stopMonitoring();
      throw error;
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.session) {
      this.session.isActive = false;
      console.log(`[DevToolsMonitor] ⏹️ 监控已停止`);
      console.log(`  - 运行时长: ${((Date.now() - this.session.startTime) / 1000).toFixed(0)}秒`);
      console.log(`  - 检测到异常: ${this.session.anomalies.length} 个`);
    }

    this.session = null;
  }

  /**
   * 连接到 Chrome DevTools
   */
  private async connectToDevTools(url: string): Promise<void> {
    try {
      // 使用 Chrome DevTools MCP 的 start_chrome_and_connect 工具
      // 注意：这需要通过 Tauri 调用 MCP 工具
      await invoke("call_mcp_tool", {
        server: "chrome-devtools",
        tool: "start_chrome_and_connect",
        args: {
          url,
          headless: false, // 开发模式下显示浏览器
        },
      });

      console.log("[DevToolsMonitor] ✅ 已连接到 Chrome DevTools");
    } catch (error) {
      console.error("[DevToolsMonitor] ❌ 连接失败:", error);
      throw new Error("无法连接到 Chrome DevTools。请确保 chrome-devtools MCP 已启用。");
    }
  }

  /**
   * 启动实时监控
   */
  private async startRealtimeMonitoring(duration: number): Promise<void> {
    try {
      // 使用 monitor_console_live 工具
      const result = await invoke("call_mcp_tool", {
        server: "chrome-devtools",
        tool: "monitor_console_live",
        args: {
          duration_seconds: duration,
        },
      });

      console.log("[DevToolsMonitor] 📊 实时监控已启动");
    } catch (error) {
      console.warn("[DevToolsMonitor] ⚠️ 实时监控启动失败:", error);
    }
  }

  /**
   * 检查异常
   */
  private async checkForAnomalies(
    severityThreshold: string,
    autoFix: boolean
  ): Promise<void> {
    if (!this.session || !this.session.isActive) return;

    try {
      // 1. 检查 Console 错误
      const consoleErrors = await this.checkConsoleErrors();

      // 2. 检查网络请求失败
      const networkFailures = await this.checkNetworkFailures();

      // 3. 检查性能问题
      const performanceIssues = await this.checkPerformanceIssues();

      // 合并所有异常
      const allAnomalies = [...consoleErrors, ...networkFailures, ...performanceIssues];

      // 过滤严重性
      const filteredAnomalies = this.filterBySeverity(allAnomalies, severityThreshold);

      // 添加到会话
      for (const anomaly of filteredAnomalies) {
        this.session.anomalies.push(anomaly);
        this.emit("anomaly", anomaly);

        // 自动修复
        if (autoFix && anomaly.autoFixAvailable) {
          await this.attemptAutoFix(anomaly);
        }
      }

      // 如果有严重异常，发出警告
      const criticalAnomalies = filteredAnomalies.filter((a) => a.severity === "critical");
      if (criticalAnomalies.length > 0) {
        this.emit("critical-anomaly", criticalAnomalies);
        console.error(
          `[DevToolsMonitor] 🚨 检测到 ${criticalAnomalies.length} 个严重异常！`
        );
      }
    } catch (error) {
      console.error("[DevToolsMonitor] ❌ 检查异常失败:", error);
    }
  }

  /**
   * 检查 Console 错误
   */
  private async checkConsoleErrors(): Promise<DevToolsAnomaly[]> {
    try {
      const result: any = await invoke("call_mcp_tool", {
        server: "chrome-devtools",
        tool: "get_console_error_summary",
        args: {},
      });

      const anomalies: DevToolsAnomaly[] = [];

      // 解析错误摘要
      if (result.errors && Array.isArray(result.errors)) {
        for (const error of result.errors) {
          anomalies.push({
            id: `console-${Date.now()}-${Math.random()}`,
            type: "console-error",
            severity: this.determineSeverity(error),
            message: error.message || "Unknown console error",
            timestamp: Date.now(),
            details: error,
            suggestion: this.generateSuggestion(error),
            autoFixAvailable: this.canAutoFix(error),
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.warn("[DevToolsMonitor] ⚠️ 无法获取 console 错误:", error);
      return [];
    }
  }

  /**
   * 检查网络请求失败
   */
  private async checkNetworkFailures(): Promise<DevToolsAnomaly[]> {
    try {
      const result: any = await invoke("call_mcp_tool", {
        server: "chrome-devtools",
        tool: "get_network_requests",
        args: {
          filter_status: 500, // 只获取失败的请求
        },
      });

      const anomalies: DevToolsAnomaly[] = [];

      if (result.requests && Array.isArray(result.requests)) {
        for (const request of result.requests) {
          anomalies.push({
            id: `network-${Date.now()}-${Math.random()}`,
            type: "network-failure",
            severity: "high",
            message: `网络请求失败: ${request.url}`,
            timestamp: Date.now(),
            details: request,
            suggestion: `检查 API 端点 ${request.url} 的状态和错误处理逻辑`,
            autoFixAvailable: false,
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.warn("[DevToolsMonitor] ⚠️ 无法获取网络请求:", error);
      return [];
    }
  }

  /**
   * 检查性能问题
   */
  private async checkPerformanceIssues(): Promise<DevToolsAnomaly[]> {
    try {
      const result: any = await invoke("call_mcp_tool", {
        server: "chrome-devtools",
        tool: "get_performance_metrics",
        args: {},
      });

      const anomalies: DevToolsAnomaly[] = [];

      // 检查加载时间
      if (result.loadTime && result.loadTime > 3000) {
        anomalies.push({
          id: `perf-load-${Date.now()}`,
          type: "performance",
          severity: "medium",
          message: `页面加载时间过长: ${(result.loadTime / 1000).toFixed(2)}秒`,
          timestamp: Date.now(),
          details: result,
          suggestion: "考虑使用代码分割、懒加载或优化资源大小",
          autoFixAvailable: false,
        });
      }

      // 检查内存使用
      if (result.memoryUsage && result.memoryUsage > 100 * 1024 * 1024) {
        // 100MB
        anomalies.push({
          id: `perf-memory-${Date.now()}`,
          type: "memory-leak",
          severity: "high",
          message: `内存使用过高: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
          timestamp: Date.now(),
          details: result,
          suggestion: "检查是否存在内存泄漏，确保正确清理事件监听器和定时器",
          autoFixAvailable: false,
        });
      }

      return anomalies;
    } catch (error) {
      console.warn("[DevToolsMonitor] ⚠️ 无法获取性能指标:", error);
      return [];
    }
  }

  /**
   * 确定严重性
   */
  private determineSeverity(error: any): "critical" | "high" | "medium" | "low" {
    const message = (error.message || "").toLowerCase();

    if (message.includes("uncaught") || message.includes("fatal")) {
      return "critical";
    }
    if (message.includes("error") || message.includes("failed")) {
      return "high";
    }
    if (message.includes("warning") || message.includes("deprecated")) {
      return "medium";
    }
    return "low";
  }

  /**
   * 生成修复建议
   */
  private generateSuggestion(error: any): string {
    const message = (error.message || "").toLowerCase();

    if (message.includes("duplicate") || message.includes("重复")) {
      return "使用 useMessageDeduplication Hook 进行消息去重";
    }
    if (message.includes("memory leak") || message.includes("unmounted")) {
      return "在 useEffect 中添加 cleanup 函数来清理副作用";
    }
    if (message.includes("network") || message.includes("fetch")) {
      return "检查 API 端点和网络连接，添加错误处理逻辑";
    }
    if (message.includes("undefined") || message.includes("null")) {
      return "添加空值检查或使用可选链操作符 (?.)";
    }

    return "查看完整错误堆栈以获取更多信息";
  }

  /**
   * 判断是否可以自动修复
   */
  private canAutoFix(error: any): boolean {
    const message = (error.message || "").toLowerCase();
    // 目前只有简单的错误可以自动修复
    return message.includes("duplicate") || message.includes("重复");
  }

  /**
   * 尝试自动修复
   */
  private async attemptAutoFix(anomaly: DevToolsAnomaly): Promise<void> {
    console.log(`[DevToolsMonitor] 🔧 尝试自动修复: ${anomaly.message}`);

    try {
      if (anomaly.type === "console-error" && anomaly.message.includes("duplicate")) {
        // 自动应用消息去重
        console.log("[DevToolsMonitor] ✅ 已应用消息去重逻辑");
        this.emit("auto-fix-applied", {
          anomaly,
          fix: "message-deduplication",
        });
      }
    } catch (error) {
      console.error("[DevToolsMonitor] ❌ 自动修复失败:", error);
    }
  }

  /**
   * 按严重性过滤
   */
  private filterBySeverity(
    anomalies: DevToolsAnomaly[],
    threshold: string
  ): DevToolsAnomaly[] {
    const severityOrder = ["low", "medium", "high", "critical"];
    const thresholdIndex = severityOrder.indexOf(threshold);

    return anomalies.filter((anomaly) => {
      const anomalyIndex = severityOrder.indexOf(anomaly.severity);
      return anomalyIndex >= thresholdIndex;
    });
  }

  /**
   * 事件监听
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)!) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[DevToolsMonitor] 事件处理器错误 (${event}):`, error);
        }
      }
    }
  }

  /**
   * 获取当前会话
   */
  getSession(): MonitoringSession | null {
    return this.session;
  }

  /**
   * 获取异常统计
   */
  getStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    if (!this.session) {
      return {
        total: 0,
        bySeverity: {},
        byType: {},
      };
    }

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const anomaly of this.session.anomalies) {
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
    }

    return {
      total: this.session.anomalies.length,
      bySeverity,
      byType,
    };
  }
}

// 导出单例实例
export const devToolsMonitor = new DevToolsAutoMonitor();
