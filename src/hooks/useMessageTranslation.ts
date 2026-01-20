import { logger } from '@/lib/logger';
import { useCallback, useState, useRef } from "react";
import { extractMessageContent as extractContentUtil } from "@/lib/contentExtraction";
import {
  progressiveTranslationManager,
  TranslationPriority,
  type TranslationState,
} from "@/lib/progressiveTranslation";
import { type TranslationResult, translationMiddleware } from "@/lib/translationMiddleware";
import { normalizeUsageData } from "@/lib/utils";
import type { ClaudeStreamMessage } from "@/types/claude";

/**
 * 🔧 FIX v2.7.8: 智能合并两条消息的内容
 * 
 * 合并策略：
 * - 保留两者的文本内容（如果新消息有文本，追加而非替换）
 * - 合并工具调用（去重）
 * - 保留 thinking 块
 * 
 * 这样可以防止 Claude 说的话被后续的工具调用消息覆盖
 */
function mergeMessageContent(
  existing: ClaudeStreamMessage,
  incoming: ClaudeStreamMessage
): ClaudeStreamMessage {
  const existingContent = Array.isArray(existing.message?.content)
    ? existing.message.content
    : [];
  const incomingContent = Array.isArray(incoming.message?.content)
    ? incoming.message.content
    : [];

  // 提取各类型内容
  const existingText = existingContent.filter((item: any) => item.type === 'text');
  const existingTools = existingContent.filter((item: any) =>
    item.type === 'tool_use' || item.type === 'tool_result');
  const existingThinking = existingContent.filter((item: any) => item.type === 'thinking');

  const incomingText = incomingContent.filter((item: any) => item.type === 'text');
  const incomingTools = incomingContent.filter((item: any) =>
    item.type === 'tool_use' || item.type === 'tool_result');
  const incomingThinking = incomingContent.filter((item: any) => item.type === 'thinking');

  // 🔧 FIX: 智能合并文本内容
  // 如果旧消息有文本，新消息也有文本，检查是否需要合并
  let mergedText: any[] = [];

  // 检查旧文本是否有实际内容
  const existingHasRealText = existingText.some((item: any) => {
    const text = item.text || '';
    return text.trim().length > 0 && !/^<\/?[a-z_]+>$/i.test(text.trim());
  });

  // 检查新文本是否有实际内容
  const incomingHasRealText = incomingText.some((item: any) => {
    const text = item.text || '';
    return text.trim().length > 0 && !/^<\/?[a-z_]+>$/i.test(text.trim());
  });

  if (existingHasRealText && incomingHasRealText) {
    // 两者都有文本，保留两者（新文本可能是更新后的内容）
    // 但如果内容相同，只保留一个
    const existingTextStr = existingText.map((t: any) => t.text || '').join('');
    const incomingTextStr = incomingText.map((t: any) => t.text || '').join('');

    if (existingTextStr === incomingTextStr) {
      mergedText = incomingText; // 内容相同，使用新的
    } else if (incomingTextStr.includes(existingTextStr)) {
      mergedText = incomingText; // 新内容包含旧内容，使用新的（流式更新）
    } else {
      mergedText = incomingText; // 默认使用新的文本
    }
  } else if (existingHasRealText) {
    mergedText = existingText; // 只有旧消息有文本，保留
  } else if (incomingHasRealText) {
    mergedText = incomingText; // 只有新消息有文本，使用新的
  } else {
    mergedText = incomingText.length > 0 ? incomingText : existingText;
  }

  // 🔧 FIX: 合并 thinking 块（保留旧的，如果新的没有）
  const mergedThinking = incomingThinking.length > 0 ? incomingThinking : existingThinking;

  // 🔧 FIX: 合并工具调用（去重，按 id）
  const toolIds = new Set(existingTools.map((t: any) => t.id).filter(Boolean));
  const mergedTools = [
    ...existingTools,
    ...incomingTools.filter((t: any) => !t.id || !toolIds.has(t.id))
  ];

  // 按顺序组合：thinking -> text -> tools
  const mergedContent = [...mergedThinking, ...mergedText, ...mergedTools];

  // 🔍 DEBUG: 记录合并过程
  if (import.meta.env.DEV) {
    console.log('[useMessageTranslation] 🔀 Merging messages:', {
      existingId: (existing as any)?.message?.id || existing.uuid,
      existingHasText: existingHasRealText,
      incomingHasText: incomingHasRealText,
      existingToolCount: existingTools.length,
      incomingToolCount: incomingTools.length,
      mergedTextCount: mergedText.length,
      mergedToolCount: mergedTools.length
    });
  }

  return {
    ...incoming,
    message: {
      ...incoming.message,
      content: mergedContent
    }
  };
}

/**
 * useMessageTranslation Hook
 *
 * 管理消息翻译系统，包括：
 * - 实时消息翻译处理
 * - 渐进式历史消息翻译
 * - 8种内容提取策略
 * - 翻译状态管理
 *
 * 从 ClaudeCodeSession.tsx 提取（Phase 3）
 */

interface UseMessageTranslationConfig {
  isMountedRef: React.MutableRefObject<boolean>;
  lastTranslationResult?: TranslationResult;
  onMessagesUpdate: (updater: (prev: ClaudeStreamMessage[]) => ClaudeStreamMessage[]) => void;
}

interface UseMessageTranslationReturn {
  translationEnabled: boolean;
  translationStates: TranslationState;
  processMessageWithTranslation: (
    message: ClaudeStreamMessage,
    payload: string,
    currentTranslationResult?: TranslationResult,
  ) => Promise<void>;
  initializeProgressiveTranslation: (messages: ClaudeStreamMessage[]) => Promise<void>;
  applyTranslationToMessage: (
    message: ClaudeStreamMessage,
    result: TranslationResult,
  ) => ClaudeStreamMessage;
  /** 🔧 FIX: 初始化已处理的消息 ID（用于历史消息去重） */
  initializeProcessedIds: (messages: ClaudeStreamMessage[]) => void;
}

export function useMessageTranslation(
  config: UseMessageTranslationConfig,
): UseMessageTranslationReturn {
  const { isMountedRef, lastTranslationResult, onMessagesUpdate } = config;

  // Translation states
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translationStates, setTranslationStates] = useState<TranslationState>({});

  // 🔧 FIX: 跟踪已处理的消息 ID，防止重复添加
  // 使用全局 WeakMap 存储，避免组件重新挂载时丢失
  const processedMessageIds = useRef(new Set<string>());

  // 🔧 FIX: 提供方法让外部初始化已处理的消息 ID（用于历史消息）
  const initializeProcessedIds = useCallback((messages: ClaudeStreamMessage[]) => {
    for (const msg of messages) {
      const id = (msg as any)?.message?.id ||
        (msg as any).id ||
        (msg as any).uuid;
      if (id) {
        processedMessageIds.current.add(id);
      }
    }
    logger.debug('useMessageTranslation', `[useMessageTranslation] Initialized ${processedMessageIds.current.size} processed message IDs`);
  }, []);

  /**
   * 处理翻译完成回调
   */
  const handleTranslationComplete = useCallback(
    (
      messageId: string,
      _originalMessage: ClaudeStreamMessage,
      result: TranslationResult,
      messageIndex: number,
    ) => {
      // Update translation state
      setTranslationStates((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          status: "translated",
          translatedContent: result.translatedText,
        },
      }));

      // Update the actual message in the messages array
      onMessagesUpdate((prevMessages) => {
        return prevMessages.map((msg, index) => {
          if (index === messageIndex) {
            // Apply the translation
            return applyTranslationToMessage(msg, result);
          }
          return msg;
        });
      });
    },
    [onMessagesUpdate],
  );

  /**
   * 应用翻译结果到消息对象
   */
  const applyTranslationToMessage = useCallback(
    (message: ClaudeStreamMessage, result: TranslationResult): ClaudeStreamMessage => {
      const processedMessage = { ...message };

      // Apply translation based on the message structure
      if (typeof message.content === "string") {
        processedMessage.content = result.translatedText;
      } else if (Array.isArray(message.content)) {
        processedMessage.content = message.content.map((item: any) => {
          if (item && (item.type === "text" || typeof item === "string")) {
            return typeof item === "string"
              ? { type: "text", text: result.translatedText }
              : { ...item, text: result.translatedText };
          }
          return item;
        });
      } else if (message.message?.content) {
        if (typeof message.message.content === "string") {
          processedMessage.message = {
            ...message.message,
            content: [{ type: "text", text: result.translatedText }],
          };
        } else if (Array.isArray(message.message.content)) {
          processedMessage.message = {
            ...message.message,
            content: message.message.content.map((item: any) => {
              if (item && (item.type === "text" || typeof item === "string")) {
                return typeof item === "string"
                  ? { type: "text", text: result.translatedText }
                  : { ...item, text: result.translatedText };
              }
              return item;
            }),
          };
        }
      } else if ((message as any).result) {
        (processedMessage as any).result = result.translatedText;
      } else if ((message as any).summary) {
        (processedMessage as any).summary = result.translatedText;
      }

      return processedMessage;
    },
    [],
  );

  /**
   * 处理单个消息的翻译（支持8种内容提取策略）
   */
  const processMessageWithTranslation = useCallback(
    async (
      message: ClaudeStreamMessage,
      payload: string,
      _currentTranslationResult?: TranslationResult,
    ) => {
      try {
        // Don't process if component unmounted
        if (!isMountedRef.current) return;

        // Add received timestamp for non-user messages (only if not already set)
        if (message.type !== "user") {
          const now = new Date().toISOString();
          // Only set receivedAt if it doesn't exist (preserve original timestamp for history)
          if (!message.receivedAt) {
            message.receivedAt = now;
          }
          // NEVER override timestamp - it should always be the original event time
          // Only set it if it's completely missing
          if (!message.timestamp) {
            message.timestamp = now;
          }
        }

        // 🌐 Translation: Process Claude response
        let processedMessage = { ...message };

        try {
          const isEnabled = await translationMiddleware.isEnabled();

          // 🔧 EXPANDED MESSAGE TYPE SUPPORT: Cover all possible Claude Code response types
          const isClaudeResponse =
            message.type === "assistant" ||
            message.type === "result" ||
            (message.type === "system" && message.subtype !== "init") ||
            // Handle any message with actual content regardless of type
            !!(
              message.content ||
              message.message?.content ||
              (message as any).text ||
              (message as any).result ||
              (message as any).summary ||
              (message as any).error
            );

          if (isEnabled && isClaudeResponse) {
            // 🌟 COMPREHENSIVE CONTENT EXTRACTION STRATEGY
            // This ensures we capture ALL possible text content from Claude Code SDK responses
            let textContent = "";
            const contentSources: string[] = [];

            // Method 1: Direct content string
            if (typeof message.content === "string" && message.content.trim()) {
              textContent = message.content;
              contentSources.push("direct_content");
            }
            // Method 2: Array content (Claude API format)
            else if (Array.isArray(message.content)) {
              const arrayContent = message.content
                .filter((item: any) => item && (item.type === "text" || typeof item === "string"))
                .map((item: any) => {
                  if (typeof item === "string") return item;
                  if (item.type === "text") return item.text || "";
                  return item.content || item.text || "";
                })
                .join("\n");
              if (arrayContent.trim()) {
                textContent = arrayContent;
                contentSources.push("array_content");
              }
            }
            // Method 3: Object with text property
            else if (message.content?.text && typeof message.content.text === "string") {
              textContent = message.content.text;
              contentSources.push("content_text");
            }
            // Method 4: Nested in message.content (Claude Code SDK primary format)
            else if (message.message?.content) {
              const messageContent: any = message.message.content;
              if (typeof messageContent === "string" && messageContent.trim()) {
                textContent = messageContent;
                contentSources.push("message_content_string");
              } else if (Array.isArray(messageContent)) {
                const nestedContent = messageContent
                  .filter((item: any) => item && (item.type === "text" || typeof item === "string"))
                  .map((item: any) => {
                    if (typeof item === "string") return item;
                    if (item.type === "text") return item.text || "";
                    return item.content || item.text || "";
                  })
                  .join("\n");
                if (nestedContent.trim()) {
                  textContent = nestedContent;
                  contentSources.push("message_content_array");
                }
              }
            }

            // Method 5: Direct text property
            if (
              !textContent &&
              (message as any).text &&
              typeof (message as any).text === "string"
            ) {
              textContent = (message as any).text;
              contentSources.push("direct_text");
            }

            // Method 6: Result field (for result-type messages)
            if (
              !textContent &&
              (message as any).result &&
              typeof (message as any).result === "string"
            ) {
              textContent = (message as any).result;
              contentSources.push("result_field");
            }

            // Method 7: Error field (for error messages)
            if (
              !textContent &&
              (message as any).error &&
              typeof (message as any).error === "string"
            ) {
              textContent = (message as any).error;
              contentSources.push("error_field");
            }

            // Method 8: Summary field (for summary messages)
            if (
              !textContent &&
              (message as any).summary &&
              typeof (message as any).summary === "string"
            ) {
              textContent = (message as any).summary;
              contentSources.push("summary_field");
            }

            if (textContent.trim()) {
              // Attempt translation - the middleware will handle language detection and decide whether to translate
              const responseTranslation =
                await translationMiddleware.translateClaudeResponse(textContent);

              if (responseTranslation.wasTranslated) {
                // 🔧 COMPREHENSIVE MESSAGE UPDATE STRATEGY
                // Update the message content based on where we found the original content
                // Update based on the content source that was found
                const primarySource = contentSources[0];

                switch (primarySource) {
                  case "direct_content":
                    processedMessage.content = responseTranslation.translatedText;
                    break;

                  case "array_content":
                    if (Array.isArray(message.content)) {
                      processedMessage.content = message.content.map((item: any) => {
                        if (item && (item.type === "text" || typeof item === "string")) {
                          return typeof item === "string"
                            ? { type: "text", text: responseTranslation.translatedText }
                            : { ...item, text: responseTranslation.translatedText };
                        }
                        return item;
                      });
                    }
                    break;

                  case "content_text":
                    processedMessage.content = {
                      ...message.content,
                      text: responseTranslation.translatedText,
                    };
                    break;

                  case "message_content_string":
                    if (message.message) {
                      processedMessage.message = {
                        ...message.message,
                        content: [{ type: "text", text: responseTranslation.translatedText }],
                      };
                    }
                    break;

                  case "message_content_array":
                    if (message.message?.content && Array.isArray(message.message.content)) {
                      processedMessage.message = {
                        ...message.message,
                        content: message.message.content.map((item: any) => {
                          if (item && (item.type === "text" || typeof item === "string")) {
                            return typeof item === "string"
                              ? { type: "text", text: responseTranslation.translatedText }
                              : { ...item, text: responseTranslation.translatedText };
                          }
                          return item;
                        }),
                      };
                    }
                    break;

                  case "direct_text":
                    (processedMessage as any).text = responseTranslation.translatedText;
                    break;

                  case "result_field":
                    (processedMessage as any).result = responseTranslation.translatedText;
                    break;

                  case "error_field":
                    (processedMessage as any).error = responseTranslation.translatedText;
                    break;

                  case "summary_field":
                    (processedMessage as any).summary = responseTranslation.translatedText;
                    break;

                  default:
                    // Fallback: Create new content structure
                    processedMessage.content = [
                      {
                        type: "text",
                        text: responseTranslation.translatedText,
                      },
                    ];
                }

                // Add translation metadata
                processedMessage.translationMeta = {
                  wasTranslated: responseTranslation.wasTranslated,
                  detectedLanguage: responseTranslation.detectedLanguage,
                  originalText: responseTranslation.originalText,
                };
              }
            }
          }
        } catch (translationError) {
          logger.error('useMessageTranslation', "[useMessageTranslation] Response translation failed:", translationError);
          // Continue with original message if translation fails
        }

        // 🔧 SAFE MESSAGE PROCESSING: Normalize usage data to handle cache token field mapping
        try {
          // Use the standardized usage normalization function to handle field name mapping
          if (processedMessage.message?.usage) {
            processedMessage.message.usage = normalizeUsageData(processedMessage.message.usage);
          }
          if (processedMessage.usage) {
            processedMessage.usage = normalizeUsageData(processedMessage.usage);
          }

          // 🆕 FIX: Retype slash command related messages from 'user' to 'system'
          // Claude CLI returns slash command output in various formats that should be system messages
          if (processedMessage.type === "user") {
            const content = processedMessage.message?.content;
            let textContent = "";

            // Extract text content
            if (typeof content === "string") {
              textContent = content;
            } else if (Array.isArray(content)) {
              textContent = content
                .filter((item: any) => item?.type === "text")
                .map((item: any) => item?.text || "")
                .join("\n");
            }

            // Check for various slash command output patterns
            const isCommandOutput = textContent.includes("<local-command-stdout>");
            const isCommandMeta =
              textContent.includes("<command-name>") || textContent.includes("<command-message>");
            const isCommandError = textContent.includes("Unknown slash command:");

            if (isCommandOutput || isCommandMeta || isCommandError) {
              processedMessage = {
                ...processedMessage,
                type: "system" as const,
                subtype: isCommandOutput
                  ? "command-output"
                  : isCommandError
                    ? "command-error"
                    : "command-meta",
              } as ClaudeStreamMessage;
            }
          }

          // 🔧 FIX: 获取消息 ID 用于去重
          const messageId = (processedMessage as any)?.message?.id ||
            (processedMessage as any).id ||
            (processedMessage as any).uuid;

          if (messageId) {
            // 有 ID 的消息：检查是否已处理
            if (processedMessageIds.current.has(messageId)) {
              // 🔧 FIX v2.7.8: 智能合并消息内容，而非简单替换
              // 这样可以保留 Claude 说的话，同时添加工具调用
              onMessagesUpdate((prev) => {
                return prev.map((msg) => {
                  const existingId = (msg as any)?.message?.id ||
                    (msg as any).id ||
                    (msg as any).uuid;
                  if (existingId === messageId) {
                    // 智能合并两条消息的内容
                    return mergeMessageContent(msg, processedMessage);
                  }
                  return msg;
                });
              });
            } else {
              // 新消息，添加到 Set 并追加
              processedMessageIds.current.add(messageId);
              onMessagesUpdate((prev) => [...prev, processedMessage]);
            }
          } else {
            // 没有 ID 的消息直接追加（可能是临时消息）
            onMessagesUpdate((prev) => [...prev, processedMessage]);
          }
        } catch (usageError) {
          console.warn(
            "[useMessageTranslation] Error normalizing usage data, adding message without usage:",
            usageError,
          );
          // Remove problematic usage data and add message anyway
          const safeMessage = { ...processedMessage };
          delete safeMessage.usage;
          if (safeMessage.message) {
            delete safeMessage.message.usage;
          }

          // 🔧 FIX: 同样使用去重逻辑
          const messageId = (safeMessage as any)?.message?.id ||
            (safeMessage as any).id ||
            (safeMessage as any).uuid;

          if (messageId && !processedMessageIds.current.has(messageId)) {
            processedMessageIds.current.add(messageId);
            onMessagesUpdate((prev) => [...prev, safeMessage]);
          } else if (!messageId) {
            onMessagesUpdate((prev) => [...prev, safeMessage]);
          }
        }
      } catch (err) {
        logger.error('useMessageTranslation', "[useMessageTranslation] Failed to parse message:", err, payload);
      }
    },
    [isMountedRef, lastTranslationResult, onMessagesUpdate],
  );

  /**
   * 初始化渐进式翻译（后台翻译历史消息）
   */
  const initializeProgressiveTranslation = useCallback(
    async (messages: ClaudeStreamMessage[]): Promise<void> => {
      try {
        // Check if translation is enabled
        const isEnabled = await progressiveTranslationManager.isTranslationEnabled();
        setTranslationEnabled(isEnabled);

        if (!isEnabled) {
          return;
        }
        // Initialize translation states
        const initialStates: TranslationState = {};

        // Get the most recent messages (last 10) for priority translation
        const recentMessages = messages.slice(-10);

        messages.forEach((message, index) => {
          const messageId = `${message.timestamp || Date.now()}_${index}`;

          // Extract text content for translation
          const textContent = extractContentUtil(message).text;

          if (textContent.trim()) {
            initialStates[messageId] = {
              status: "original",
              originalContent: textContent,
              translatedContent: undefined,
            };

            // Determine priority
            const isRecent = recentMessages.includes(message);
            const priority = isRecent ? TranslationPriority.HIGH : TranslationPriority.NORMAL;

            // Add to translation queue
            progressiveTranslationManager.addTask(messageId, textContent, priority, (result) => {
              if (result && result.wasTranslated) {
                handleTranslationComplete(messageId, message, result, index);
              }
            });
          }
        });

        setTranslationStates(initialStates);
      } catch (error) {
        console.error(
          "[useMessageTranslation] Failed to initialize progressive translation:",
          error,
        );
      }
    },
    [handleTranslationComplete],
  );

  return {
    translationEnabled,
    translationStates,
    processMessageWithTranslation,
    initializeProgressiveTranslation,
    applyTranslationToMessage,
    initializeProcessedIds, // 🔧 FIX: 暴露方法让外部初始化已处理的消息 ID
  };
}
