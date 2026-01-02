/**
 * useTurboMode - Turbo 自主模式 Hook
 *
 * 功能:
 * - 自动执行安全命令（无需每次确认）
 * - 命令白名单/黑名单管理
 * - 智能错误恢复和重试
 * - 危险命令二次确认
 *
 * 来源: Claude Code Auto Accept + Cursor Composer Agent Mode
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// 类型定义
// ============================================================

export type TurboModeLevel = "off" | "safe" | "moderate" | "full";

export interface TurboModeConfig {
  /** 当前模式级别 */
  level: TurboModeLevel;
  /** 白名单命令（总是自动执行） */
  whitelist: string[];
  /** 黑名单命令（总是需要确认） */
  blacklist: string[];
  /** 自动重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 是否启用智能错误恢复 */
  smartRecovery: boolean;
  /** 会话超时（毫秒），超时后自动关闭 Turbo 模式 */
  sessionTimeout: number;
  /** 允许的最大连续自动执行次数 */
  maxConsecutiveAuto: number;
}

export interface CommandAnalysis {
  command: string;
  risk: "safe" | "moderate" | "dangerous" | "critical";
  category: string;
  reason: string;
  requiresConfirmation: boolean;
  suggestedAction?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  retryCount: number;
  recovered?: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: TurboModeConfig = {
  level: "off",
  whitelist: [
    // 读取操作
    "ls",
    "dir",
    "cat",
    "head",
    "tail",
    "less",
    "more",
    "pwd",
    "echo",
    "which",
    "whereis",
    "type",
    "file",
    "stat",
    "wc",
    "diff",
    "grep",
    "find",
    // Git 读取
    "git status",
    "git log",
    "git diff",
    "git branch",
    "git remote",
    "git show",
    "git blame",
    "git stash list",
    // 包管理器查询
    "npm list",
    "npm outdated",
    "npm view",
    "npm info",
    "yarn list",
    "yarn info",
    "yarn why",
    "pnpm list",
    "pnpm why",
    "pip list",
    "pip show",
    "pip freeze",
    // 构建/测试（只读）
    "npm run lint",
    "npm run typecheck",
    "npm run test",
    "yarn lint",
    "yarn typecheck",
    "yarn test",
    // 系统信息
    "node --version",
    "npm --version",
    "python --version",
    "uname",
    "hostname",
    "date",
    "uptime",
  ],
  blacklist: [
    // 危险的 Git 操作
    "git push --force",
    "git push -f",
    "git reset --hard",
    "git clean -fd",
    "git checkout .",
    "git stash drop",
    // 危险的文件操作
    "rm -rf",
    "rm -r",
    "rmdir",
    "del /s",
    "rd /s",
    "mv /",
    "cp -r /",
    "chmod 777",
    "chown -R",
    // 危险的系统操作
    "sudo",
    "su",
    "shutdown",
    "reboot",
    "init",
    "format",
    "fdisk",
    "mkfs",
    "dd if=",
    // 网络危险操作
    "curl | sh",
    "curl | bash",
    "wget -O - | sh",
    // 数据库危险操作
    "DROP DATABASE",
    "DROP TABLE",
    "TRUNCATE",
    "DELETE FROM",
    // 包管理器全局安装
    "npm install -g",
    "yarn global add",
    "pip install --user",
  ],
  maxRetries: 3,
  retryDelay: 1000,
  smartRecovery: true,
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  maxConsecutiveAuto: 20,
};

// ============================================================
// 命令风险分析
// ============================================================

const RISK_PATTERNS: Array<{
  pattern: RegExp | string;
  risk: CommandAnalysis["risk"];
  category: string;
  reason: string;
}> = [
  // Critical - 绝对危险
  {
    pattern: /rm\s+-rf\s+\//,
    risk: "critical",
    category: "文件系统",
    reason: "可能删除系统根目录",
  },
  { pattern: /dd\s+if=.*of=\/dev/, risk: "critical", category: "磁盘", reason: "可能覆盖磁盘数据" },
  { pattern: /mkfs/, risk: "critical", category: "磁盘", reason: "格式化文件系统" },
  { pattern: /:(){ :|:& };:/, risk: "critical", category: "系统", reason: "Fork 炸弹" },

  // Dangerous - 高危
  {
    pattern: /git\s+push\s+(-f|--force)/,
    risk: "dangerous",
    category: "Git",
    reason: "强制推送会覆盖远程历史",
  },
  {
    pattern: /git\s+reset\s+--hard/,
    risk: "dangerous",
    category: "Git",
    reason: "会丢失未提交的更改",
  },
  { pattern: /rm\s+-rf?/, risk: "dangerous", category: "文件系统", reason: "递归删除文件" },
  {
    pattern: /DROP\s+(DATABASE|TABLE)/i,
    risk: "dangerous",
    category: "数据库",
    reason: "删除数据库对象",
  },
  { pattern: /TRUNCATE/i, risk: "dangerous", category: "数据库", reason: "清空表数据" },
  { pattern: /sudo/, risk: "dangerous", category: "系统", reason: "需要管理员权限" },

  // Moderate - 中等风险
  { pattern: /npm\s+install/, risk: "moderate", category: "包管理", reason: "安装依赖包" },
  { pattern: /yarn\s+add/, risk: "moderate", category: "包管理", reason: "安装依赖包" },
  { pattern: /git\s+push/, risk: "moderate", category: "Git", reason: "推送代码到远程" },
  { pattern: /git\s+commit/, risk: "moderate", category: "Git", reason: "提交更改" },
  { pattern: /git\s+merge/, risk: "moderate", category: "Git", reason: "合并分支" },
  { pattern: /git\s+rebase/, risk: "moderate", category: "Git", reason: "变基操作" },
  { pattern: /npm\s+run\s+build/, risk: "moderate", category: "构建", reason: "执行构建脚本" },
  { pattern: /curl|wget/, risk: "moderate", category: "网络", reason: "网络请求" },

  // Safe - 安全操作
  { pattern: /^ls/, risk: "safe", category: "读取", reason: "列出文件" },
  { pattern: /^cat\s/, risk: "safe", category: "读取", reason: "查看文件内容" },
  { pattern: /^pwd/, risk: "safe", category: "读取", reason: "显示当前目录" },
  { pattern: /^echo/, risk: "safe", category: "输出", reason: "打印输出" },
  { pattern: /^git\s+status/, risk: "safe", category: "Git", reason: "查看状态" },
  { pattern: /^git\s+log/, risk: "safe", category: "Git", reason: "查看历史" },
  { pattern: /^git\s+diff/, risk: "safe", category: "Git", reason: "查看差异" },
];

// ============================================================
// Hook
// ============================================================

interface UseTurboModeOptions {
  /** 初始配置 */
  initialConfig?: Partial<TurboModeConfig>;
  /** 执行命令的回调 */
  onExecute?: (command: string) => Promise<ExecutionResult>;
  /** 请求确认的回调 */
  onConfirmationNeeded?: (analysis: CommandAnalysis) => Promise<boolean>;
  /** 模式变化回调 */
  onModeChange?: (level: TurboModeLevel) => void;
}

export function useTurboMode(options: UseTurboModeOptions = {}) {
  const { initialConfig, onExecute, onConfirmationNeeded, onModeChange } = options;

  // 配置状态
  const [config, setConfig] = useState<TurboModeConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 运行时状态
  const [isActive, setIsActive] = useState(false);
  const [consecutiveAutoCount, setConsecutiveAutoCount] = useState(0);
  const [executionHistory, setExecutionHistory] = useState<CommandAnalysis[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<TurboModeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // 设置模式级别
  const setLevel = useCallback(
    (level: TurboModeLevel) => {
      updateConfig({ level });
      setIsActive(level !== "off");

      if (level !== "off") {
        sessionStartRef.current = Date.now();
        // 设置会话超时
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
        }
        sessionTimeoutRef.current = setTimeout(() => {
          setLevel("off");
        }, config.sessionTimeout);
      } else {
        sessionStartRef.current = null;
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
      }

      onModeChange?.(level);
    },
    [config.sessionTimeout, onModeChange, updateConfig],
  );

  // 清理
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 分析命令风险
   */
  const analyzeCommand = useCallback(
    (command: string): CommandAnalysis => {
      const trimmedCommand = command.trim().toLowerCase();

      // 检查黑名单（精确匹配或前缀匹配）
      const isBlacklisted = config.blacklist.some(
        (pattern) =>
          trimmedCommand === pattern.toLowerCase() ||
          trimmedCommand.startsWith(pattern.toLowerCase()),
      );

      if (isBlacklisted) {
        return {
          command,
          risk: "critical",
          category: "黑名单",
          reason: "命令在黑名单中",
          requiresConfirmation: true,
        };
      }

      // 检查白名单
      const isWhitelisted = config.whitelist.some(
        (pattern) =>
          trimmedCommand === pattern.toLowerCase() ||
          trimmedCommand.startsWith(pattern.toLowerCase()),
      );

      if (isWhitelisted) {
        return {
          command,
          risk: "safe",
          category: "白名单",
          reason: "命令在白名单中",
          requiresConfirmation: false,
        };
      }

      // 使用风险模式匹配
      for (const { pattern, risk, category, reason } of RISK_PATTERNS) {
        const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
        if (regex.test(command)) {
          return {
            command,
            risk,
            category,
            reason,
            requiresConfirmation: risk !== "safe",
          };
        }
      }

      // 默认为中等风险
      return {
        command,
        risk: "moderate",
        category: "未知",
        reason: "无法识别的命令",
        requiresConfirmation: config.level !== "full",
      };
    },
    [config.blacklist, config.whitelist, config.level],
  );

  /**
   * 判断是否应该自动执行
   */
  const shouldAutoExecute = useCallback(
    (analysis: CommandAnalysis): boolean => {
      if (config.level === "off") return false;
      if (analysis.risk === "critical") return false;
      if (consecutiveAutoCount >= config.maxConsecutiveAuto) return false;

      switch (config.level) {
        case "safe":
          return analysis.risk === "safe";
        case "moderate":
          return analysis.risk === "safe" || analysis.risk === "moderate";
        case "full":
          // 在 full 模式下，执行非 critical 的命令（safe, moderate, dangerous）
          return true;
        default:
          return false;
      }
    },
    [config.level, config.maxConsecutiveAuto, consecutiveAutoCount],
  );

  /**
   * 执行命令（带重试和错误恢复）
   */
  const executeWithRetry = useCallback(
    async (command: string): Promise<ExecutionResult> => {
      if (!onExecute) {
        return { success: false, error: "未配置执行回调", retryCount: 0 };
      }

      let retryCount = 0;
      let lastError: string | undefined;

      while (retryCount <= config.maxRetries) {
        try {
          const result = await onExecute(command);

          if (result.success) {
            return { ...result, retryCount };
          }

          // 智能错误恢复
          if (config.smartRecovery && result.error) {
            const recoveryCommand = suggestRecovery(command, result.error);
            if (recoveryCommand && recoveryCommand !== command) {
              const recoveryResult = await onExecute(recoveryCommand);
              if (recoveryResult.success) {
                return { ...recoveryResult, retryCount, recovered: true };
              }
            }
          }

          lastError = result.error;
          retryCount++;

          if (retryCount <= config.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, config.retryDelay * retryCount));
          }
        } catch (error) {
          lastError = String(error);
          retryCount++;

          if (retryCount <= config.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, config.retryDelay * retryCount));
          }
        }
      }

      return { success: false, error: lastError, retryCount };
    },
    [onExecute, config.maxRetries, config.retryDelay, config.smartRecovery],
  );

  /**
   * 建议错误恢复命令
   */
  const suggestRecovery = (command: string, error: string): string | null => {
    const errorLower = error.toLowerCase();

    // npm 相关错误恢复
    if (command.includes("npm") && errorLower.includes("enoent")) {
      return "npm install";
    }

    if (command.includes("npm") && errorLower.includes("permission denied")) {
      return command.replace("npm", "npx");
    }

    // Git 相关错误恢复
    if (command.includes("git push") && errorLower.includes("rejected")) {
      return "git pull --rebase";
    }

    if (command.includes("git") && errorLower.includes("not a git repository")) {
      return "git init";
    }

    // 文件不存在
    if (errorLower.includes("no such file") || errorLower.includes("not found")) {
      const match = command.match(/(mkdir|touch)\s+(.+)/);
      if (match) {
        return `mkdir -p ${match[2]}`;
      }
    }

    return null;
  };

  /**
   * 处理命令请求
   */
  const handleCommand = useCallback(
    async (command: string): Promise<{ autoExecuted: boolean; result?: ExecutionResult }> => {
      const analysis = analyzeCommand(command);
      setExecutionHistory((prev) => [...prev.slice(-99), analysis]);

      // 检查是否应该自动执行
      if (shouldAutoExecute(analysis)) {
        setConsecutiveAutoCount((prev) => prev + 1);
        const result = await executeWithRetry(command);
        return { autoExecuted: true, result };
      }

      // 需要确认
      setConsecutiveAutoCount(0);

      if (onConfirmationNeeded) {
        const confirmed = await onConfirmationNeeded(analysis);
        if (confirmed) {
          const result = await executeWithRetry(command);
          return { autoExecuted: false, result };
        }
      }

      return { autoExecuted: false };
    },
    [analyzeCommand, shouldAutoExecute, executeWithRetry, onConfirmationNeeded],
  );

  /**
   * 添加到白名单
   */
  const addToWhitelist = useCallback((command: string) => {
    setConfig((prev) => ({
      ...prev,
      whitelist: [...new Set([...prev.whitelist, command])],
    }));
  }, []);

  /**
   * 添加到黑名单
   */
  const addToBlacklist = useCallback((command: string) => {
    setConfig((prev) => ({
      ...prev,
      blacklist: [...new Set([...prev.blacklist, command])],
    }));
  }, []);

  /**
   * 从白名单移除
   */
  const removeFromWhitelist = useCallback((command: string) => {
    setConfig((prev) => ({
      ...prev,
      whitelist: prev.whitelist.filter((c) => c !== command),
    }));
  }, []);

  /**
   * 从黑名单移除
   */
  const removeFromBlacklist = useCallback((command: string) => {
    setConfig((prev) => ({
      ...prev,
      blacklist: prev.blacklist.filter((c) => c !== command),
    }));
  }, []);

  /**
   * 重置连续自动执行计数
   */
  const resetConsecutiveCount = useCallback(() => {
    setConsecutiveAutoCount(0);
  }, []);

  /**
   * 获取会话剩余时间
   */
  const getSessionRemainingTime = useCallback((): number | null => {
    if (!sessionStartRef.current || config.level === "off") return null;
    const elapsed = Date.now() - sessionStartRef.current;
    return Math.max(0, config.sessionTimeout - elapsed);
  }, [config.level, config.sessionTimeout]);

  /**
   * 获取模式描述
   */
  const getModeDescription = useCallback((level: TurboModeLevel): string => {
    switch (level) {
      case "off":
        return "已关闭 - 所有命令需要确认";
      case "safe":
        return "安全模式 - 只自动执行只读命令";
      case "moderate":
        return "中等模式 - 自动执行大部分安全操作";
      case "full":
        return "完全模式 - 自动执行非危险命令";
      default:
        return "";
    }
  }, []);

  return {
    // 状态
    config,
    isActive,
    consecutiveAutoCount,
    executionHistory,

    // 配置方法
    updateConfig,
    setLevel,

    // 命令处理
    analyzeCommand,
    shouldAutoExecute,
    handleCommand,
    executeWithRetry,

    // 名单管理
    addToWhitelist,
    addToBlacklist,
    removeFromWhitelist,
    removeFromBlacklist,

    // 工具方法
    resetConsecutiveCount,
    getSessionRemainingTime,
    getModeDescription,
  };
}

export default useTurboMode;
