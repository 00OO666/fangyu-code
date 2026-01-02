/**
 * useSmartSessionContinue Hook
 *
 * 智能会话续接 - 当上下文达到阈值时，自动创建新会话并注入压缩摘要
 *
 * @author Claude Opus 4.5
 * @version 1.0.0
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateSessionSummary } from "@/lib/sessionSummarizer";
import type {
  SessionContinueConfig,
  SessionContinueStatus,
  SessionSummary,
  UseSmartSessionContinueReturn,
} from "@/types/session-continue";

/**
 * Hook 配置默认值
 */
const DEFAULT_CONFIG: Required<
  Omit<SessionContinueConfig, "sessionId" | "projectPath" | "contextUsage">
> = {
  threshold: 0.75,
  autoSwitch: true,
  recentMessagesCount: 10,
  keepOldSession: true,
  summaryVerbosity: "detailed",
};

/**
 * 从数据库读取会话历史
 */
async function loadSessionHistory(sessionId: string): Promise<any[]> {
  try {
    const history = await invoke<string>("load_session_history", { sessionId });
    const messages = history
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return messages;
  } catch (error) {
    console.error("[useSmartSessionContinue] Failed to load session history:", error);
    return [];
  }
}

/**
 * 创建新会话并注入摘要作为 system prompt
 */
async function createContinuedSession(
  projectPath: string,
  summary: SessionSummary,
  parentSessionId: string,
): Promise<string> {
  try {
    // 调用 Tauri 命令创建新会话
    const newSessionId = await invoke<string>("create_continued_session", {
      projectPath,
      systemPrompt: summary.summaryText,
      parentSessionId,
      metadata: {
        continuedFrom: parentSessionId,
        continuedAt: Date.now(),
      },
    });

    console.log("[useSmartSessionContinue] New session created:", newSessionId);
    return newSessionId;
  } catch (error) {
    console.error("[useSmartSessionContinue] Failed to create continued session:", error);
    throw error;
  }
}

/**
 * 智能会话续接 Hook
 */
export function useSmartSessionContinue(
  config: SessionContinueConfig,
): UseSmartSessionContinueReturn {
  const {
    sessionId,
    projectPath,
    threshold = DEFAULT_CONFIG.threshold,
    autoSwitch = DEFAULT_CONFIG.autoSwitch,
    recentMessagesCount = DEFAULT_CONFIG.recentMessagesCount,
    keepOldSession: _keepOldSession = DEFAULT_CONFIG.keepOldSession, // TODO: 用于保留旧会话
    summaryVerbosity = DEFAULT_CONFIG.summaryVerbosity,
    contextUsage = 0,
  } = config;
  void _keepOldSession; // 暂时抑制未使用变量警告

  // 状态
  const [status, setStatus] = useState<SessionContinueStatus>("idle");
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const hasTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 派生状态
  const shouldContinue = status === "ready" && !!newSessionId;
  const isProcessing = status === "generating" || status === "creating" || status === "switching";

  /**
   * 生成会话摘要
   */
  const generateSummary = useCallback(async () => {
    if (!sessionId || !projectPath) {
      console.warn("[useSmartSessionContinue] Missing sessionId or projectPath");
      return;
    }

    if (status === "generating" || status === "creating") {
      console.warn("[useSmartSessionContinue] Already processing");
      return;
    }

    console.log("[useSmartSessionContinue] 🚀 Starting summary generation");
    setStatus("generating");
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. 加载会话历史
      console.log("[useSmartSessionContinue] 📚 Loading session history...");
      const messages = await loadSessionHistory(sessionId);

      if (abortController.signal.aborted) {
        console.log("[useSmartSessionContinue] Aborted during history loading");
        return;
      }

      if (messages.length === 0) {
        throw new Error("No messages found in session history");
      }

      console.log("[useSmartSessionContinue] Loaded", messages.length, "messages");

      // 2. 生成摘要
      console.log("[useSmartSessionContinue] 🔍 Generating summary...");
      const sessionSummary = await generateSessionSummary(messages, {
        sessionId,
        projectPath,
        recentMessagesCount,
        verbosity: summaryVerbosity,
      });

      if (abortController.signal.aborted) {
        console.log("[useSmartSessionContinue] Aborted during summary generation");
        return;
      }

      console.log("[useSmartSessionContinue] ✅ Summary generated successfully");
      setSummary(sessionSummary);

      // 3. 创建新会话
      if (autoSwitch) {
        setStatus("creating");
        console.log("[useSmartSessionContinue] 🏗️ Creating new session...");

        const newId = await createContinuedSession(projectPath, sessionSummary, sessionId);

        if (abortController.signal.aborted) {
          console.log("[useSmartSessionContinue] Aborted during session creation");
          return;
        }

        setNewSessionId(newId);
        setStatus("ready");
        console.log("[useSmartSessionContinue] 🎉 Ready to switch to new session:", newId);
      } else {
        setStatus("ready");
        console.log("[useSmartSessionContinue] 📝 Summary ready, waiting for user confirmation");
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[useSmartSessionContinue] ❌ Error:", errorMsg);
        setError(errorMsg);
        setStatus("error");

        // 5秒后重置状态
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus("idle");
            setError(null);
            hasTriggeredRef.current = false;
          }
        }, 5000);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [sessionId, projectPath, recentMessagesCount, summaryVerbosity, autoSwitch, status]);

  /**
   * 执行续接（手动触发）
   */
  const continueTo = useCallback(async () => {
    if (!summary || !projectPath) {
      console.warn("[useSmartSessionContinue] Cannot continue: missing summary or projectPath");
      return;
    }

    if (newSessionId) {
      // 已经创建了新会话，直接切换
      setStatus("switching");
      console.log("[useSmartSessionContinue] 🔄 Switching to existing session:", newSessionId);
      setTimeout(() => {
        setStatus("completed");
      }, 200);
      return;
    }

    // 需要先创建新会话
    setStatus("creating");
    setError(null);

    try {
      console.log("[useSmartSessionContinue] 🏗️ Creating new session...");
      const newId = await createContinuedSession(projectPath, summary, sessionId || "unknown");
      setNewSessionId(newId);

      setStatus("switching");
      console.log("[useSmartSessionContinue] 🔄 Switching to new session:", newId);

      setTimeout(() => {
        setStatus("completed");
      }, 200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useSmartSessionContinue] ❌ Error creating session:", errorMsg);
      setError(errorMsg);
      setStatus("error");
    }
  }, [summary, projectPath, sessionId, newSessionId]);

  /**
   * 取消续接
   */
  const cancel = useCallback(() => {
    console.log("[useSmartSessionContinue] 🚫 Cancelling session continue");

    // 取消进行中的操作
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 重置状态
    setStatus("idle");
    setSummary(null);
    setNewSessionId(null);
    setError(null);
    hasTriggeredRef.current = false;
  }, []);

  /**
   * 自动触发逻辑
   */
  useEffect(() => {
    if (!autoSwitch || !sessionId || !projectPath) return;
    if (hasTriggeredRef.current) return;
    if (status !== "idle") return;

    // 达到阈值时触发
    if (contextUsage >= threshold) {
      console.log(
        `[useSmartSessionContinue] 📊 Context usage ${(contextUsage * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}% threshold`,
      );
      console.log("[useSmartSessionContinue] 🔄 Auto-triggering session continue");
      hasTriggeredRef.current = true;
      generateSummary();
    }
  }, [autoSwitch, sessionId, projectPath, contextUsage, threshold, status, generateSummary]);

  /**
   * 清理
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // 取消进行中的操作
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    status,
    shouldContinue,
    summary,
    newSessionId,
    continueTo,
    cancel,
    generateSummary,
    isProcessing,
    error,
  };
}

export default useSmartSessionContinue;
