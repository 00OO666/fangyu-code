/**
 * Gemini Engine Handler
 *
 * 处理 Gemini 引擎的事件监听和消息处理逻辑
 * 从 usePromptExecution.ts 提取（行 896-1250）
 */

import { logger } from "@/lib/logger";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import { globalTaskActions } from "@/hooks/useGlobalTaskState";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { UsePromptExecutionConfig } from "../types";

export interface GeminiEngineContext {
  config: UsePromptExecutionConfig;
  tabIdRef: React.MutableRefObject<string>;
  geminiSessionIdRef: React.MutableRefObject<string | null>;
  handleSendPrompt: (prompt: string, model: any, maxThinkingTokens?: number) => Promise<void>;
  isUserInitiated: boolean;
  geminiPendingInfo: any;
}

/**
 * 转换 Gemini 消息到 Claude 格式
 */
function convertGeminiToClaudeMessage(data: any): ClaudeStreamMessage | null {
  try {
    if (data.type === "system" && data.subtype === "init") {
      return {
        type: "system",
        subtype: "init",
        session_id: data.session_id,
        model: data.model,
        timestamp: data.timestamp,
        engine: "gemini" as const,
      };
    }

    if (data.type === "assistant" || data.type === "user") {
      let message = data.message;

      // 处理 tool_result 消息
      if (data.type === "user" && message?.content) {
        const content = Array.isArray(message.content) ? message.content : [message.content];
        const processedContent = content.map((item: any) => {
          if (item.type === "tool_result") {
            let resultContent = item.content;

            // 提取 Gemini functionResponse 格式
            if (Array.isArray(item.content)) {
              const firstResult = item.content[0];
              if (firstResult?.functionResponse?.response?.output !== undefined) {
                resultContent = firstResult.functionResponse.response.output;
              }
            }

            return {
              ...item,
              content: resultContent,
            };
          }
          return item;
        });

        message = {
          ...message,
          content: processedContent,
        };
      }

      return {
        type: data.type,
        message,
        timestamp: data.timestamp,
        engine: "gemini" as const,
      };
    }

    if (data.type === "result") {
      return {
        type: "result",
        subtype: data.subtype || "success",
        usage: data.usage,
        timestamp: data.timestamp,
        engine: "gemini" as const,
        model: data.model,
        geminiMetadata: data.geminiMetadata,
      };
    }

    if (data.type === "system" && data.subtype === "error") {
      return {
        type: "system",
        subtype: "error",
        error: data.error,
        timestamp: data.timestamp,
        engine: "gemini" as const,
      };
    }

    // Fallback
    return {
      type: "system",
      subtype: "raw",
      message: { content: [{ type: "text", text: JSON.stringify(data) }] },
      engine: "gemini" as const,
    };
  } catch (err) {
    logger.error("gemini", "[Gemini Engine] Failed to convert message:", err);
    return null;
  }
}

/**
 * 设置 Gemini 引擎的事件监听器
 */
export async function setupGeminiEventListeners(
  context: GeminiEngineContext
): Promise<UnlistenFn[]> {
  const {
    config,
    tabIdRef,
    geminiSessionIdRef,
    handleSendPrompt,
    isUserInitiated,
    geminiPendingInfo,
  } = context;

  const {
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

  // Track processed messages
  const processedGeminiMessages = new Set<string>();
  let pendingGeminiPromptRecordingPromise: Promise<void> | null = null;
  const geminiRequestTabId = tabIdRef.current;

  // Helper: Generate message ID
  const getGeminiMessageId = (payload: string): string => {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `gemini-${hash}`;
  };

  // Helper: Process Gemini output
  const processGeminiOutput = (payload: string) => {
    if (!isMountedRef.current) return;

    // 检查 tabId 是否变化
    if (tabIdRef.current !== geminiRequestTabId) {
      logger.debug("gemini", "[Gemini Engine] ⚠️ tabId 已变化，忽略旧请求的消息");
      return;
    }

    // Deduplicate messages
    const messageId = getGeminiMessageId(payload);
    if (processedGeminiMessages.has(messageId)) {
      return;
    }
    processedGeminiMessages.add(messageId);

    try {
      const data = JSON.parse(payload);

      // Skip user messages without tool results
      const hasToolResult = data.message?.content?.some((c: any) => c.type === "tool_result");
      if (data.type === "user" && !hasToolResult) {
        return;
      }

      // Skip stderr messages
      if (data.type === "system" && data.geminiMetadata?.eventType === "stderr") {
        return;
      }

      // Handle delta messages
      const isDelta = data.geminiMetadata?.delta || data.delta;
      const msgType = data.type;

      if (isDelta && msgType === "assistant") {
        // Merge with last assistant message
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];

          if (lastMsg && lastMsg.type === "assistant") {
            const lastContent = lastMsg.message?.content;
            const newContent = data.message?.content;

            if (Array.isArray(lastContent) && Array.isArray(newContent)) {
              const updatedContent = [...lastContent];
              let merged = false;

              for (const newItem of newContent) {
                if (newItem.type === "text") {
                  const lastTextIdx = updatedContent.findIndex((c: any) => c.type === "text");
                  if (lastTextIdx >= 0 && newItem.text) {
                    updatedContent[lastTextIdx] = {
                      ...updatedContent[lastTextIdx],
                      text: (updatedContent[lastTextIdx].text || "") + newItem.text,
                    };
                    merged = true;
                  }
                } else if (newItem.type === "tool_use") {
                  const lastContentIdx = updatedContent.length - 1;
                  const lastContentItem = updatedContent[lastContentIdx];

                  if (
                    lastContentItem &&
                    lastContentItem.type === "tool_use" &&
                    (lastContentItem.id === newItem.id || (!lastContentItem.id && !newItem.id))
                  ) {
                    const mergedInput = {
                      ...(lastContentItem.input || {}),
                      ...(newItem.input || {}),
                    };

                    updatedContent[lastContentIdx] = {
                      ...lastContentItem,
                      ...newItem,
                      input: mergedInput,
                    };
                  } else {
                    updatedContent.push(newItem);
                  }
                  merged = true;
                } else {
                  updatedContent.push(newItem);
                  merged = true;
                }
              }

              if (merged) {
                const updatedMsg = {
                  ...lastMsg,
                  message: {
                    ...lastMsg.message,
                    content: updatedContent,
                  },
                };

                return [...prev.slice(0, lastIdx), updatedMsg];
              }
            }
          }

          // Cannot merge, add as new message
          const message = convertGeminiToClaudeMessage(data);
          return message ? [...prev, message] : prev;
        });
        setRawJsonlOutput((prev) => [...prev, payload]);
        return;
      }

      // Non-delta message
      const message = convertGeminiToClaudeMessage(data);

      if (message) {
        setMessages((prev) => [...prev, message]);
        setRawJsonlOutput((prev) => [...prev, payload]);
      }
    } catch (err) {
      logger.error("gemini", "[Gemini Engine] Failed to process output:", err, payload);
    }
  };

  // Helper: Process Gemini completion
  const processGeminiComplete = async () => {
    setIsLoading(false);
    hasActiveSessionRef.current = false;
    isListeningRef.current = false;

    globalTaskActions.updateTaskStatus(tabIdRef.current, "completed");

    // Clean up listeners
    unlisteners.forEach((u) => u && typeof u === "function" && u());
    unlisteners.length = 0;

    // Wait for pending prompt recording
    if (pendingGeminiPromptRecordingPromise) {
      await pendingGeminiPromptRecordingPromise;
      pendingGeminiPromptRecordingPromise = null;
    }

    // Record prompt completion
    if (window.__geminiPendingPrompt) {
      const pendingPrompt = window.__geminiPendingPrompt;
      try {
        await api.recordGeminiPromptCompleted(
          pendingPrompt.sessionId,
          pendingPrompt.projectPath,
          pendingPrompt.promptIndex,
          pendingPrompt.promptText
        );
      } catch (err) {
        logger.warn("gemini", "[Gemini Engine] Failed to record completion:", err);
      }
      delete window.__geminiPendingPrompt;
    }

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
  const unlistenOutput = await listen("gemini-output", (event: any) => {
    const payload = event.payload as string;
    processGeminiOutput(payload);
  });
  unlisteners.push(unlistenOutput);

  const unlistenComplete = await listen("gemini-complete", () => {
    processGeminiComplete();
  });
  unlisteners.push(unlistenComplete);

  const unlistenError = await listen("gemini-error", (event: any) => {
    const payload = event.payload as string;
    logger.error("gemini", "[Gemini Engine] Error:", payload);
    setIsLoading(false);
    hasActiveSessionRef.current = false;
    config.setError(payload);
  });
  unlisteners.push(unlistenError);

  // Session ID listener
  const unlistenSessionId = await listen("gemini-cli-session-id", (event: any) => {
    const sessionId = event.payload as string;
    geminiSessionIdRef.current = sessionId;

    const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
    setExtractedSessionInfo({ sessionId, projectId, engine: "gemini" });
    setIsFirstPrompt(false);

    // Record prompt if needed
    if (isUserInitiated && geminiPendingInfo && geminiPendingInfo.promptIndex === undefined) {
      pendingGeminiPromptRecordingPromise = api
        .recordGeminiPromptSent(sessionId, projectPath, geminiPendingInfo.promptText)
        .then((idx) => {
          geminiPendingInfo.promptIndex = idx;
          geminiPendingInfo.sessionId = sessionId;
          window.__geminiPendingPrompt = {
            sessionId,
            projectPath,
            promptIndex: idx,
            promptText: geminiPendingInfo.promptText,
          };
        })
        .catch((err) => {
          logger.warn("gemini", "[Gemini Engine] Failed to record prompt:", err);
        });
    }
  });
  unlisteners.push(unlistenSessionId);

  return unlisteners;
}
