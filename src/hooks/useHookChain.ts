/**
 * useHookChain - Hook 链式执行管理器
 *
 * 功能:
 * - 管理 hooks 的链式执行
 * - 支持同步和异步 hooks
 * - 错误处理和重试
 * - 执行日志记录
 * - 支持中断执行链
 *
 * 来源: Claude Code Hooks System
 */

import { useCallback, useRef, useState } from "react";
import type { HookCommand, HookEvent, HookMatcher } from "@/types/hooks";

// ============================================================
// 类型定义
// ============================================================

export interface HookExecutionContext {
  /** 事件类型 */
  event: HookEvent;
  /** 工具名称（如果适用） */
  toolName?: string;
  /** 工具输入参数 */
  toolInput?: Record<string, unknown>;
  /** 工具输出结果 */
  toolResult?: unknown;
  /** 会话ID */
  sessionId?: string;
  /** 项目路径 */
  projectPath?: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

export interface HookExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 命令 */
  command: string;
  /** 输出内容 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 是否应该阻止后续执行 */
  blocked?: boolean;
  /** 阻止原因 */
  blockReason?: string;
}

export interface HookChainResult {
  /** 是否全部成功 */
  success: boolean;
  /** 各个 hook 的执行结果 */
  results: HookExecutionResult[];
  /** 总执行时间 */
  totalDuration: number;
  /** 是否被中断 */
  interrupted: boolean;
  /** 中断原因 */
  interruptReason?: string;
}

export interface HookLogEntry {
  timestamp: number;
  event: HookEvent;
  matcher?: string;
  command: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_TIMEOUT = 60000; // 60秒
const MAX_LOG_ENTRIES = 100;

// ============================================================
// Hook
// ============================================================

interface UseHookChainOptions {
  /** 执行命令的回调 */
  executeCommand?: (
    command: string,
    context: HookExecutionContext
  ) => Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }>;
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number;
  /** 是否启用日志 */
  enableLogging?: boolean;
}

export function useHookChain(options: UseHookChainOptions = {}) {
  const { executeCommand, defaultTimeout = DEFAULT_TIMEOUT, enableLogging = true } = options;

  // 执行日志
  const [executionLog, setExecutionLog] = useState<HookLogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 匹配 hook
   */
  const matchHook = useCallback((matchers: HookMatcher[], toolName?: string): HookMatcher[] => {
    return matchers.filter((matcher) => {
      if (!matcher.matcher || matcher.matcher === "*") {
        return true;
      }

      if (!toolName) {
        return false;
      }

      try {
        const regex = new RegExp(`^${matcher.matcher}$`);
        return regex.test(toolName);
      } catch {
        // 简单字符串匹配
        return matcher.matcher === toolName || matcher.matcher.split("|").includes(toolName);
      }
    });
  }, []);

  /**
   * 执行单个命令
   */
  const executeHookCommand = useCallback(
    async (command: HookCommand, context: HookExecutionContext): Promise<HookExecutionResult> => {
      const startTime = Date.now();
      const timeout = (command.timeout || defaultTimeout / 1000) * 1000;

      try {
        // 检查是否已中断
        if (abortControllerRef.current?.signal.aborted) {
          return {
            success: false,
            command: command.command,
            error: "执行已中断",
            duration: Date.now() - startTime,
          };
        }

        // 准备命令（替换变量）
        let processedCommand = command.command;
        if (context.toolInput) {
          // 替换 jq 风格的变量
          processedCommand = processedCommand.replace(
            /\$\(\s*jq\s+-r\s+'?\.([^')\s]+)'?\s*\)/g,
            (_, path) => {
              const value = getNestedValue(context.toolInput, path);
              return String(value ?? "");
            }
          );
        }

        // 执行命令
        if (!executeCommand) {
          // 模拟执行
          return {
            success: true,
            command: processedCommand,
            output: `[模拟执行] ${processedCommand}`,
            duration: Date.now() - startTime,
          };
        }

        // 设置超时
        const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
          setTimeout(() => {
            resolve({ success: false, error: `命令执行超时 (${timeout}ms)` });
          }, timeout);
        });

        const result = await Promise.race([
          executeCommand(processedCommand, context),
          timeoutPromise,
        ]);

        const duration = Date.now() - startTime;

        // 解析阻止响应
        let blocked = false;
        let blockReason: string | undefined;

        if (result.success && "output" in result && result.output) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.decision === "block") {
              blocked = true;
              blockReason = parsed.reason;
            }
          } catch {
            // 输出不是 JSON，忽略
          }
        }

        return {
          success: result.success,
          command: processedCommand,
          output: "output" in result ? result.output : undefined,
          error: "error" in result ? result.error : undefined,
          duration,
          blocked,
          blockReason,
        };
      } catch (error) {
        return {
          success: false,
          command: command.command,
          error: String(error),
          duration: Date.now() - startTime,
        };
      }
    },
    [executeCommand, defaultTimeout]
  );

  /**
   * 执行 hook 链
   */
  const executeChain = useCallback(
    async (matchers: HookMatcher[], context: HookExecutionContext): Promise<HookChainResult> => {
      setIsExecuting(true);
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();
      const results: HookExecutionResult[] = [];
      let interrupted = false;
      let interruptReason: string | undefined;

      // 找到匹配的 matchers
      const matchedMatchers = matchHook(matchers, context.toolName);

      for (const matcher of matchedMatchers) {
        for (const hook of matcher.hooks) {
          // 检查是否已中断
          if (abortControllerRef.current.signal.aborted) {
            interrupted = true;
            interruptReason = "用户中断";
            break;
          }

          const result = await executeHookCommand(hook, context);
          results.push(result);

          // 记录日志
          if (enableLogging) {
            const logEntry: HookLogEntry = {
              timestamp: Date.now(),
              event: context.event,
              matcher: matcher.matcher,
              command: result.command,
              success: result.success,
              duration: result.duration,
              output: result.output,
              error: result.error,
            };

            setExecutionLog((prev) => [...prev.slice(-MAX_LOG_ENTRIES), logEntry]);
          }

          // 检查是否应该阻止后续执行
          if (result.blocked) {
            interrupted = true;
            interruptReason = result.blockReason || "Hook 请求阻止";
            break;
          }

          // 如果执行失败且返回码为 2，阻止执行
          if (!result.success && result.error?.includes("exit 2")) {
            interrupted = true;
            interruptReason = result.error;
            break;
          }
        }

        if (interrupted) break;
      }

      setIsExecuting(false);

      return {
        success: results.every((r) => r.success) && !interrupted,
        results,
        totalDuration: Date.now() - startTime,
        interrupted,
        interruptReason,
      };
    },
    [matchHook, executeHookCommand, enableLogging]
  );

  /**
   * 中断当前执行
   */
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /**
   * 清除日志
   */
  const clearLog = useCallback(() => {
    setExecutionLog([]);
  }, []);

  /**
   * 获取统计信息
   */
  const getStats = useCallback(() => {
    const total = executionLog.length;
    const successful = executionLog.filter((e) => e.success).length;
    const failed = total - successful;
    const avgDuration =
      total > 0 ? executionLog.reduce((sum, e) => sum + e.duration, 0) / total : 0;

    const eventCounts: Record<string, number> = {};
    executionLog.forEach((e) => {
      eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
    });

    return {
      total,
      successful,
      failed,
      avgDuration,
      eventCounts,
    };
  }, [executionLog]);

  return {
    // 状态
    isExecuting,
    executionLog,

    // 执行方法
    matchHook,
    executeHookCommand,
    executeChain,
    abort,

    // 日志管理
    clearLog,
    getStats,
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export default useHookChain;
