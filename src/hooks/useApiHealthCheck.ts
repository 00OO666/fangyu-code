/**
 * useApiHealthCheck Hook
 *
 * API 健康检查和自动恢复机制
 *
 * 功能：
 * 1. 监控 API 连接状态（connected/disconnected/reconnecting）
 * 2. 检测连续失败并触发自动重连
 * 3. 提供手动重连和诊断功能
 * 4. 记录详细的错误日志
 */

import { logger } from '@/lib/logger';
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// 连接状态
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "unknown";

// 诊断结果
export interface DiagnosticResult {
  timestamp: number;
  checks: {
    name: string;
    status: "ok" | "warning" | "error";
    message: string;
    details?: any;
  }[];
  overallStatus: "healthy" | "degraded" | "unhealthy";
  recommendations: string[];
}

// 错误日志条目
export interface ErrorLogEntry {
  timestamp: number;
  type: "api_error" | "network_error" | "timeout" | "parse_error" | "unknown";
  message: string;
  details?: any;
  sessionId?: string;
}

// Hook 配置
interface UseApiHealthCheckConfig {
  /** 启用自动重连（默认 true） */
  autoReconnect?: boolean;
  /** 最大重连次数（默认 3） */
  maxRetries?: number;
  /** 重连间隔基数 ms（默认 1000，指数退避） */
  retryBaseDelay?: number;
  /** 健康检查间隔 ms（默认 30000） */
  healthCheckInterval?: number;
  /** 当前会话 ID */
  sessionId?: string;
  /** 当前引擎 */
  engine?: "claude" | "codex" | "gemini";
}

// Hook 返回值
interface UseApiHealthCheckReturn {
  /** 当前连接状态 */
  status: ConnectionStatus;
  /** 最后成功请求时间 */
  lastSuccessTime: number | null;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 是否正在重连 */
  isReconnecting: boolean;
  /** 错误日志（最近 20 条） */
  errorLog: ErrorLogEntry[];
  /** 最新诊断结果 */
  diagnosticResult: DiagnosticResult | null;
  /** 手动触发重连 */
  triggerReconnect: () => Promise<boolean>;
  /** 运行完整诊断 */
  runDiagnostics: () => Promise<DiagnosticResult>;
  /** 清除错误日志 */
  clearErrorLog: () => void;
  /** 记录请求成功 */
  recordSuccess: () => void;
  /** 记录请求失败 */
  recordFailure: (error: any, type?: ErrorLogEntry["type"]) => void;
  /** 重置状态 */
  reset: () => void;
}

const MAX_ERROR_LOG_SIZE = 20;
const STORAGE_KEY = "api_health_check_state";

export function useApiHealthCheck(config: UseApiHealthCheckConfig = {}): UseApiHealthCheckReturn {
  const {
    autoReconnect = true,
    maxRetries = 3,
    retryBaseDelay = 1000,
    healthCheckInterval = 30000,
    sessionId,
    engine = "claude",
  } = config;

  // 状态
  const [status, setStatus] = useState<ConnectionStatus>("unknown");
  const [lastSuccessTime, setLastSuccessTime] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [errorLog, setErrorLog] = useState<ErrorLogEntry[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);

  // Refs
  const retryCountRef = useRef(0);
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const isMountedRef = useRef(true);

  // 添加错误日志
  const addErrorLog = useCallback(
    (entry: Omit<ErrorLogEntry, "timestamp">) => {
      const fullEntry: ErrorLogEntry = {
        ...entry,
        timestamp: Date.now(),
        sessionId,
      };

      setErrorLog((prev) => {
        const newLog = [fullEntry, ...prev].slice(0, MAX_ERROR_LOG_SIZE);
        // 保存到 localStorage
        try {
          localStorage.setItem(`${STORAGE_KEY}_log`, JSON.stringify(newLog));
        } catch (e) {
          logger.warn('useApiHealthCheck', "[ApiHealthCheck] Failed to save error log:", e);
        }
        return newLog;
      });

      logger.warn('useApiHealthCheck', "[ApiHealthCheck] Error logged:", fullEntry);
    },
    [sessionId],
  );

  // 记录成功
  const recordSuccess = useCallback(() => {
    const now = Date.now();
    setLastSuccessTime(now);
    setConsecutiveFailures(0);
    setStatus("connected");
    retryCountRef.current = 0;

    // 保存状态
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lastSuccessTime: now,
          status: "connected",
        }),
      );
    } catch (e) {
      // ignore
    }
  }, []);

  // 记录失败
  const recordFailure = useCallback(
    (error: any, type: ErrorLogEntry["type"] = "unknown") => {
      const errorMessage = error?.message || error?.toString() || "Unknown error";

      // 自动检测错误类型
      let detectedType = type;
      if (type === "unknown") {
        if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          detectedType = "network_error";
        } else if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
          detectedType = "timeout";
        } else if (errorMessage.includes("parse") || errorMessage.includes("JSON")) {
          detectedType = "parse_error";
        } else {
          detectedType = "api_error";
        }
      }

      addErrorLog({
        type: detectedType,
        message: errorMessage,
        details: error?.details || error?.stack,
      });

      setConsecutiveFailures((prev) => {
        const newCount = prev + 1;

        // 连续失败超过阈值，标记为断开
        if (newCount >= 2) {
          setStatus("disconnected");
        }

        // 自动重连逻辑
        if (autoReconnect && newCount >= 2 && retryCountRef.current < maxRetries) {
          triggerReconnect();
        }

        return newCount;
      });
    },
    [addErrorLog, autoReconnect, maxRetries],
  );

  // 触发重连
  const triggerReconnect = useCallback(async (): Promise<boolean> => {
    if (isReconnecting) return false;

    setIsReconnecting(true);
    setStatus("reconnecting");
    retryCountRef.current += 1;

    const delay = retryBaseDelay * 2 ** (retryCountRef.current - 1);
    console.log(
      `[ApiHealthCheck] Attempting reconnect (${retryCountRef.current}/${maxRetries}) in ${delay}ms...`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // 尝试健康检查
      const result = await runHealthCheck();

      if (result) {
        logger.debug('useApiHealthCheck', "[ApiHealthCheck] Reconnect successful!");
        recordSuccess();
        setIsReconnecting(false);

        // 通知 UI 重连成功
        await emit("api-reconnected", { engine, sessionId });
        return true;
      } else {
        throw new Error("Health check failed");
      }
    } catch (err) {
      logger.error('useApiHealthCheck', "[ApiHealthCheck] Reconnect failed:", err);

      if (retryCountRef.current < maxRetries) {
        // 继续重试
        setIsReconnecting(false);
        return triggerReconnect();
      } else {
        // 放弃重试
        logger.error('useApiHealthCheck', "[ApiHealthCheck] Max retries reached, giving up");
        setStatus("disconnected");
        setIsReconnecting(false);

        addErrorLog({
          type: "network_error",
          message: `Reconnection failed after ${maxRetries} attempts`,
          details: err,
        });

        return false;
      }
    }
  }, [isReconnecting, retryBaseDelay, maxRetries, engine, sessionId, recordSuccess, addErrorLog]);

  // 健康检查
  const runHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      // 简单的 API 调用测试
      await api.listProjects();
      return true;
    } catch (err) {
      logger.warn('useApiHealthCheck', "[ApiHealthCheck] Health check failed:", err);
      return false;
    }
  }, []);

  // 完整诊断
  const runDiagnostics = useCallback(async (): Promise<DiagnosticResult> => {
    const checks: DiagnosticResult["checks"] = [];
    const recommendations: string[] = [];
    let overallStatus: DiagnosticResult["overallStatus"] = "healthy";

    // 1. 检查基本功能（通过尝试调用 API）
    // 注：暂时跳过二进制检查，使用项目 API 作为连接测试

    // 2. 检查项目列表 API
    try {
      const projects = await api.listProjects();
      checks.push({
        name: "API 连接",
        status: "ok",
        message: `成功获取 ${projects.length} 个项目`,
      });
    } catch (err) {
      checks.push({
        name: "API 连接",
        status: "error",
        message: "API 调用失败: " + (err as Error).message,
      });
      overallStatus = "unhealthy";
      recommendations.push("检查网络连接或重启应用");
    }

    // 3. 检查 Provider 配置
    try {
      const providerConfig = await api.getCurrentProviderConfig() as any;
      if (providerConfig?.apiKey) {
        checks.push({
          name: "Provider 配置",
          status: "ok",
          message: `已配置 ${providerConfig.name || "Provider"}`,
        });
      } else {
        checks.push({
          name: "Provider 配置",
          status: "warning",
          message: "未配置 API Key",
        });
        if (overallStatus === "healthy") overallStatus = "degraded";
        recommendations.push("请在设置中配置 API Key");
      }
    } catch (err) {
      checks.push({
        name: "Provider 配置",
        status: "warning",
        message: "无法获取配置: " + (err as Error).message,
      });
      if (overallStatus === "healthy") overallStatus = "degraded";
    }

    // 4. 检查连续失败次数
    if (consecutiveFailures > 0) {
      checks.push({
        name: "请求状态",
        status: consecutiveFailures >= 3 ? "error" : "warning",
        message: `连续失败 ${consecutiveFailures} 次`,
      });
      if (consecutiveFailures >= 3) {
        overallStatus = "unhealthy";
        recommendations.push("尝试重新连接或检查网络");
      } else if (overallStatus === "healthy") {
        overallStatus = "degraded";
      }
    } else {
      checks.push({
        name: "请求状态",
        status: "ok",
        message: "运行正常",
      });
    }

    // 5. 检查最后成功时间
    if (lastSuccessTime) {
      const minutesSinceSuccess = Math.floor((Date.now() - lastSuccessTime) / 60000);
      if (minutesSinceSuccess > 5) {
        checks.push({
          name: "最后成功",
          status: "warning",
          message: `${minutesSinceSuccess} 分钟前`,
        });
        if (overallStatus === "healthy") overallStatus = "degraded";
      } else {
        checks.push({
          name: "最后成功",
          status: "ok",
          message: minutesSinceSuccess === 0 ? "刚刚" : `${minutesSinceSuccess} 分钟前`,
        });
      }
    }

    const result: DiagnosticResult = {
      timestamp: Date.now(),
      checks,
      overallStatus,
      recommendations,
    };

    setDiagnosticResult(result);
    return result;
  }, [consecutiveFailures, lastSuccessTime]);

  // 清除错误日志
  const clearErrorLog = useCallback(() => {
    setErrorLog([]);
    localStorage.removeItem(`${STORAGE_KEY}_log`);
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setStatus("unknown");
    setLastSuccessTime(null);
    setConsecutiveFailures(0);
    setIsReconnecting(false);
    retryCountRef.current = 0;
    clearErrorLog();
    setDiagnosticResult(null);
  }, [clearErrorLog]);

  // 监听全局错误事件
  useEffect(() => {
    isMountedRef.current = true;

    const setupListeners = async () => {
      // 监听 Claude 错误
      const claudeErrorUnlisten = await listen<string>("claude-error", (evt) => {
        if (!isMountedRef.current) return;
        recordFailure(evt.payload, "api_error");
      });
      unlistenRefs.current.push(claudeErrorUnlisten);

      // 监听 Codex 错误
      const codexErrorUnlisten = await listen<string>("codex-error", (evt) => {
        if (!isMountedRef.current) return;
        recordFailure(evt.payload, "api_error");
      });
      unlistenRefs.current.push(codexErrorUnlisten);

      // 监听 Gemini 错误
      const geminiErrorUnlisten = await listen<string>("gemini-error", (evt) => {
        if (!isMountedRef.current) return;
        recordFailure(evt.payload, "api_error");
      });
      unlistenRefs.current.push(geminiErrorUnlisten);

      // 监听成功消息（用于重置失败计数）
      const successUnlisten = await listen<any>("claude-output", () => {
        if (!isMountedRef.current) return;
        recordSuccess();
      });
      unlistenRefs.current.push(successUnlisten);
    };

    setupListeners();

    // 加载保存的状态
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const { lastSuccessTime: savedTime, status: savedStatus } = JSON.parse(savedState);
        if (savedTime) setLastSuccessTime(savedTime);
        if (savedStatus) setStatus(savedStatus);
      }

      const savedLog = localStorage.getItem(`${STORAGE_KEY}_log`);
      if (savedLog) {
        setErrorLog(JSON.parse(savedLog));
      }
    } catch (e) {
      // ignore
    }

    // 定期健康检查
    if (healthCheckInterval > 0) {
      healthCheckTimerRef.current = setInterval(async () => {
        if (!isMountedRef.current) return;

        const healthy = await runHealthCheck();
        if (!healthy && consecutiveFailures === 0) {
          // 静默失败，只更新状态
          setStatus((prev) => (prev === "connected" ? "disconnected" : prev));
        }
      }, healthCheckInterval);
    }

    return () => {
      isMountedRef.current = false;
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];
      if (healthCheckTimerRef.current) {
        clearInterval(healthCheckTimerRef.current);
      }
    };
  }, [recordFailure, recordSuccess, runHealthCheck, healthCheckInterval, consecutiveFailures]);

  return {
    status,
    lastSuccessTime,
    consecutiveFailures,
    isReconnecting,
    errorLog,
    diagnosticResult,
    triggerReconnect,
    runDiagnostics,
    clearErrorLog,
    recordSuccess,
    recordFailure,
    reset,
  };
}

export default useApiHealthCheck;
