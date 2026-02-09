/**
 * Console Error Monitor
 *
 * 实时监控 console 错误和异常，提供智能诊断和修复建议
 *
 * 特性：
 * - 拦截所有 console.error/warn/log
 * - 检测常见错误模式
 * - 提供修复建议
 * - 错误统计和分析
 * - 可视化错误面板
 *
 * 参考：
 * - https://kitemetric.com/blogs/effective-web-app-error-monitoring-a-guide
 * - https://www.honeycomb.io/blog/reporting-exceptions-honeycomb-frontend-observability
 */

import { useEffect, useState, useCallback, useRef } from "react";

export interface ConsoleError {
  id: string;
  type: "error" | "warn" | "info";
  message: string;
  stack?: string;
  timestamp: number;
  count: number;
  /** 错误分类 */
  category: ErrorCategory;
  /** 修复建议 */
  suggestion?: string;
  /** 相关文件 */
  file?: string;
  /** 行号 */
  line?: number;
}

export type ErrorCategory =
  | "duplicate-message" // 消息重复
  | "state-update" // 状态更新错误
  | "network" // 网络错误
  | "render" // 渲染错误
  | "memory" // 内存泄漏
  | "performance" // 性能问题
  | "unknown"; // 未知错误

interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  suggestion: string;
}

/**
 * 错误模式匹配规则
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /duplicate|重复/i,
    category: "duplicate-message",
    suggestion: "检测到消息重复问题。建议使用 useMessageDeduplication Hook 进行去重。",
  },
  {
    pattern: /cannot update.*unmounted component|memory leak/i,
    category: "memory",
    suggestion: "检测到内存泄漏。请确保在 useEffect 中正确清理副作用（返回 cleanup 函数）。",
  },
  {
    pattern: /network|fetch|axios|request failed/i,
    category: "network",
    suggestion: "网络请求失败。请检查 API 端点、网络连接和错误处理逻辑。",
  },
  {
    pattern: /render|rendering|component/i,
    category: "render",
    suggestion: "渲染错误。请检查组件的 props 和 state 是否正确。",
  },
  {
    pattern: /performance|slow|lag/i,
    category: "performance",
    suggestion: "性能问题。建议使用 React.memo、useMemo 或 useCallback 优化渲染。",
  },
  {
    pattern: /state|setState|useState/i,
    category: "state-update",
    suggestion: "状态更新错误。请确保状态更新是不可变的（immutable）。",
  },
];

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 14))} ...(truncated)`;
}

function safeJsonStringify(value: unknown, maxLen = 4000): string | undefined {
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (val instanceof Error) {
        return {
          name: val.name,
          message: val.message,
          stack: val.stack,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cause: (val as any).cause,
        };
      }
      if (val && typeof val === "object") {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    });

    if (typeof json !== "string") return undefined;
    return truncate(json, maxLen);
  } catch {
    return undefined;
  }
}

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (typeof arg === "bigint") return arg.toString();

  if (arg && typeof arg === "object") {
    return safeJsonStringify(arg, 4000) || String(arg);
  }

  return String(arg);
}

/**
 * 分析错误并提供建议
 */
function analyzeError(
  message: string,
  stack?: string
): {
  category: ErrorCategory;
  suggestion?: string;
  file?: string;
  line?: number;
} {
  // 匹配错误模式
  for (const { pattern, category, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(message) || (stack && pattern.test(stack))) {
      return { category, suggestion };
    }
  }

  // 提取文件和行号
  let file: string | undefined;
  let line: number | undefined;

  if (stack) {
    const match = stack.match(/at\s+(.+?):(\d+):\d+/);
    if (match) {
      file = match[1];
      line = parseInt(match[2], 10);
    }
  }

  return {
    category: "unknown",
    file,
    line,
  };
}

/**
 * Console 错误监控 Hook
 *
 * @param options - 配置选项
 * @returns 错误列表和控制方法
 *
 * @example
 * const { errors, clearErrors, errorCount } = useConsoleMonitor({ enabled: true });
 */
export function useConsoleMonitor(
  options: {
    /** 是否启用监控 */
    enabled?: boolean;
    /** 最大错误数量（超过后自动清理旧错误） */
    maxErrors?: number;
    /** 是否在控制台显示原始错误 */
    showOriginal?: boolean;
  } = {}
) {
  const { enabled = true, maxErrors = 100, showOriginal = true } = options;

  const [errors, setErrors] = useState<ConsoleError[]>([]);
  const errorMapRef = useRef<Map<string, ConsoleError>>(new Map());

  // 原始 console 方法的引用
  const originalConsoleRef = useRef({
    error: console.error,
    warn: console.warn,
    log: console.log,
  });

  /**
   * 添加错误
   */
  const addError = useCallback(
    (type: "error" | "warn" | "info", args: any[]) => {
      const message = args.map((arg) => formatConsoleArg(arg)).join(" ");

      // 🔧 FIX: 过滤掉 ResizeObserver 循环警告（这是浏览器的已知问题，不影响功能）
      if (message.includes("ResizeObserver loop")) {
        return;
      }

      // 🔧 FIX: Dev 热重载时 Tauri 可能丢失回调（噪声较大，通常无实际影响）
      if (message.includes("[TAURI] Couldn't find callback id")) {
        return;
      }

      const stack = new Error().stack;

      // 分析错误
      const { category, suggestion, file, line } = analyzeError(message, stack);

      // 生成错误 ID（基于消息内容）
      const errorId = `${type}-${message.substring(0, 100)}`;

      // 使用 queueMicrotask 延迟状态更新，避免在渲染期间更新状态
      queueMicrotask(() => {
        setErrors((prev) => {
          const existingError = errorMapRef.current.get(errorId);

          if (existingError) {
            // 更新现有错误的计数
            const updated = {
              ...existingError,
              count: existingError.count + 1,
              timestamp: Date.now(),
            };
            errorMapRef.current.set(errorId, updated);

            return prev.map((err) => (err.id === errorId ? updated : err));
          } else {
            // 添加新错误
            const newError: ConsoleError = {
              id: errorId,
              type,
              message,
              stack,
              timestamp: Date.now(),
              count: 1,
              category,
              suggestion,
              file,
              line,
            };

            errorMapRef.current.set(errorId, newError);

            const newErrors = [...prev, newError];

            // 限制错误数量
            if (newErrors.length > maxErrors) {
              const removed = newErrors.shift();
              if (removed) {
                errorMapRef.current.delete(removed.id);
              }
            }

            return newErrors;
          }
        });
      });
    },
    [maxErrors]
  );

  /**
   * 清除所有错误
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
    errorMapRef.current.clear();
  }, []);

  /**
   * 清除特定错误
   */
  const clearError = useCallback((errorId: string) => {
    setErrors((prev) => prev.filter((err) => err.id !== errorId));
    errorMapRef.current.delete(errorId);
  }, []);

  /**
   * 拦截 console 方法
   */
  useEffect(() => {
    if (!enabled) return;

    const original = originalConsoleRef.current;

    // 拦截 console.error
    console.error = (...args: any[]) => {
      addError("error", args);
      if (showOriginal) {
        original.error(...args);
      }
    };

    // 拦截 console.warn
    console.warn = (...args: any[]) => {
      addError("warn", args);
      if (showOriginal) {
        original.warn(...args);
      }
    };

    // 清理函数：恢复原始 console 方法
    return () => {
      console.error = original.error;
      console.warn = original.warn;
      console.log = original.log;
    };
  }, [enabled, showOriginal, addError]);

  /**
   * 监听全局错误事件
   */
  useEffect(() => {
    if (!enabled) return;

    const handleError = (event: ErrorEvent) => {
      addError("error", [event.message]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addError("error", ["Unhandled Promise Rejection:", event.reason]);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [enabled, addError]);

  // 统计信息
  const errorCount = errors.filter((e) => e.type === "error").length;
  const warnCount = errors.filter((e) => e.type === "warn").length;
  const totalCount = errors.reduce((sum, e) => sum + e.count, 0);

  // 按类别分组
  const errorsByCategory = errors.reduce(
    (acc, error) => {
      if (!acc[error.category]) {
        acc[error.category] = [];
      }
      acc[error.category].push(error);
      return acc;
    },
    {} as Record<ErrorCategory, ConsoleError[]>
  );

  return {
    errors,
    errorCount,
    warnCount,
    totalCount,
    errorsByCategory,
    clearErrors,
    clearError,
  };
}
