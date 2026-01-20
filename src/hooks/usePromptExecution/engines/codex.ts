/**
 * Codex Engine Handler
 *
 * 处理 Codex 引擎的事件监听和消息处理逻辑
 * 从 usePromptExecution.ts 提取（行 501-895）
 */

import { logger } from '@/lib/logger';
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import { CodexEventConverter } from "@/lib/codexConverter";
import { globalTaskActions } from "@/hooks/useGlobalTaskState";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { CodexRateLimits } from "@/types/codex";
import type { UsePromptExecutionConfig } from "../types";

export interface CodexEngineContext {
  config: UsePromptExecutionConfig;
  tabIdRef: React.MutableRefObject<string>;
  codexThreadIdRef: React.MutableRefObject<string | null>;
  updateCodexRateLimits: (limits: CodexRateLimits | null) => void;
  refreshCodexRateLimitsFromHistory: () => Promise<void>;
  handleSendPrompt: (prompt: string, model: any, maxThinkingTokens?: number) => Promise<void>;
  isUserInitiated: boolean;
  codexPendingInfo: any;
}

/**
 * 设置 Codex 引擎的事件监听器
 */
export async function setupCodexEventListeners(
  context: CodexEngineContext
): Promise<UnlistenFn[]> {
  const {
    config,
    tabIdRef,
    codexThreadIdRef,
    updateCodexRateLimits,
    refreshCodexRateLimitsFromHistory,
    handleSendPrompt,
    isUserInitiated,
    codexPendingInfo,
  } = context;

  const {
    effectiveSession,
    codexModel,
    projectPath,
    isMountedRef,
    setMessages,
    setRawJsonlOutput,
    setExtractedSessionInfo,
    setIsFirstPrompt,
    setIsLoading,
    hasActiveSessionRef,
    isListeningRef,
    queuedPromptsRef,
    setQueuedPrompts,
  } = config;

  const unlisteners: UnlistenFn[] = [];

  // 创建会话级别的转换器实例
  const sessionCodexConverter = new CodexEventConverter({
    defaultModel: effectiveSession?.model || codexModel || null,
  });

  // Track current Codex session ID for channel isolation
  let currentCodexSessionId: string | null = null;
  // Track processed message IDs to prevent duplicates
  const processedCodexMessages = new Set<string>();
  // Track pending prompt recording Promise
  let pendingPromptRecordingPromise: Promise<void> | null = null;
  // 记录当前请求的 tabId
  const codexRequestTabId = tabIdRef.current;

  // Helper: Generate message ID for deduplication
  const getCodexMessageId = (payload: string): string => {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `codex-${hash}`;
  };

  // Helper: Process Codex output
  const processCodexOutput = async (payload: string) => {
    if (!isMountedRef.current) return;

    // 检查 tabId 是否变化（HMR 导致）
    if (tabIdRef.current !== codexRequestTabId) {
      logger.debug('codex', "[Codex Engine] ⚠️ tabId 已变化，忽略旧请求的消息");
      return;
    }

    // Deduplicate messages
    const messageId = getCodexMessageId(payload);
    if (processedCodexMessages.has(messageId)) {
      return;
    }
    processedCodexMessages.add(messageId);

    // Parse JSONL to detect turn.completed event
    let isTurnCompleted = false;
    try {
      const event = JSON.parse(payload);
      if (event.type === "turn.completed") {
        isTurnCompleted = true;
      }
    } catch (e) {
      // Ignore parse errors
    }

    // 使用会话级别的转换器实例
    const message = sessionCodexConverter.convertEvent(payload);
    if (message) {
      setMessages((prev) => [...prev, message]);
      setRawJsonlOutput((prev) => [...prev, payload]);

      // Extract and save Codex thread_id
      if (
        message.type === "system" &&
        message.subtype === "init" &&
        (message as any).session_id
      ) {
        const codexThreadId = (message as any).session_id;
        codexThreadIdRef.current = codexThreadId;

        // Save session info for resuming
        const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
        setExtractedSessionInfo({ sessionId: codexThreadId, projectId, engine: "codex" });
        setIsFirstPrompt(false);

        // Record prompt if needed
        if (
          isUserInitiated &&
          codexPendingInfo &&
          codexPendingInfo.promptIndex === undefined
        ) {
          pendingPromptRecordingPromise = api
            .recordCodexPromptSent(
              codexThreadId,
              projectPath,
              codexPendingInfo.promptText,
            )
            .then((idx) => {
              codexPendingInfo.promptIndex = idx;
              codexPendingInfo.sessionId = codexThreadId;
              window.__codexPendingPrompt = {
                sessionId: codexThreadId,
                projectPath,
                promptIndex: idx,
                promptText: codexPendingInfo.promptText,
              };
            })
            .catch((err) => {
              logger.warn('codex', "[Codex Engine] Failed to record prompt:", err);
            });
        } else if (codexPendingInfo && codexPendingInfo.promptIndex !== undefined) {
          window.__codexPendingPrompt = {
            sessionId: codexThreadId,
            projectPath,
            promptIndex: codexPendingInfo.promptIndex,
            promptText: codexPendingInfo.promptText,
          };
        }
      }
    }

    // Update rate limits
    const converterRateLimits = sessionCodexConverter.getRateLimits();
    const messageRateLimits = (message as any)?.codexMetadata?.rateLimits;
    updateCodexRateLimits(messageRateLimits || converterRateLimits);

    // Auto-complete session when turn.completed
    if (isTurnCompleted) {
      setTimeout(() => {
        processCodexComplete();
      }, 100);
    }
  };

  // Helper: Process Codex completion
  const processCodexComplete = async () => {
    setIsLoading(false);
    hasActiveSessionRef.current = false;
    isListeningRef.current = false;

    // 更新全局任务状态
    globalTaskActions.updateTaskStatus(tabIdRef.current, "completed");

    // Clean up listeners
    unlisteners.forEach((u) => u && typeof u === "function" && u());
    unlisteners.length = 0;

    // Wait for pending prompt recording
    if (pendingPromptRecordingPromise) {
      await pendingPromptRecordingPromise;
      pendingPromptRecordingPromise = null;
    }

    // Record prompt completion
    if (window.__codexPendingPrompt) {
      const pendingPrompt = window.__codexPendingPrompt;
      try {
        await api.recordCodexPromptCompleted(
          pendingPrompt.sessionId,
          pendingPrompt.projectPath,
          pendingPrompt.promptIndex,
          pendingPrompt.promptText,
        );
      } catch (err) {
        logger.warn('codex', "[Codex Engine] Failed to record completion:", err);
      }
      delete window.__codexPendingPrompt;
    }

    await refreshCodexRateLimitsFromHistory();

    // Process queued prompts
    if (queuedPromptsRef.current.length > 0) {
      const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
      setQueuedPrompts(remainingPrompts);

      setTimeout(() => {
        handleSendPrompt(nextPrompt.prompt, nextPrompt.model);
      }, 100);
    }
  };

  // Setup event listeners
  const unlistenOutput = await listen("codex-output", (event: any) => {
    const payload = event.payload as string;
    processCodexOutput(payload);
  });
  unlisteners.push(unlistenOutput);

  const unlistenComplete = await listen("codex-complete", () => {
    processCodexComplete();
  });
  unlisteners.push(unlistenComplete);

  const unlistenError = await listen("codex-error", (event: any) => {
    const payload = event.payload as string;
    logger.error('codex', "[Codex Engine] Error:", payload);
    setIsLoading(false);
    hasActiveSessionRef.current = false;
    config.setError(payload);
  });
  unlisteners.push(unlistenError);

  return unlisteners;
}
