/**
 * useMessageDeduplication Hook
 *
 * 一劳永逸地解决消息重复问题
 *
 * 特性：
 * - 基于消息 ID 的去重
 * - 保留最新版本（最完整的数据）
 * - 性能优化（O(n) 时间复杂度）
 * - 自动检测和报告重复
 *
 * 参考：
 * - https://www.js-craft.io/blog/react-useeffect-multiple-api-calls-fetch-race-conditions
 * - https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide
 */

import { useMemo } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

interface DeduplicationResult {
  /** 去重后的消息数组 */
  messages: ClaudeStreamMessage[];
  /** 原始消息数量 */
  originalCount: number;
  /** 去重后消息数量 */
  deduplicatedCount: number;
  /** 移除的重复消息数量 */
  duplicateCount: number;
  /** 重复率（百分比） */
  duplicateRate: number;
}

/**
 * 提取消息的唯一标识符
 */
function getMessageId(message: ClaudeStreamMessage): string | null {
  return (
    (message as any)?.message?.id ||
    (message as any).id ||
    (message as any).uuid ||
    null
  );
}

/**
 * 消息去重 Hook
 *
 * @param messages - 原始消息数组
 * @param options - 配置选项
 * @returns 去重结果
 *
 * @example
 * const { messages: deduplicatedMessages, duplicateCount } = useMessageDeduplication(messages);
 */
export function useMessageDeduplication(
  messages: ClaudeStreamMessage[],
  options: {
    /** 是否启用调试日志 */
    debug?: boolean;
    /** 重复率阈值（超过此值时发出警告） */
    warningThreshold?: number;
  } = {}
): DeduplicationResult {
  const { debug = false, warningThreshold = 0.1 } = options;

  return useMemo(() => {
    const startTime = performance.now();

    // 使用 Map 进行去重，保留最后一个版本（最新、最完整）
    const messageMap = new Map<string, ClaudeStreamMessage>();
    const messagesWithoutId: ClaudeStreamMessage[] = [];

    for (const msg of messages) {
      const id = getMessageId(msg);

      if (id) {
        // 有 ID 的消息：使用 Map 去重，并合并 content
        const existingMsg = messageMap.get(id);

        if (existingMsg && existingMsg.message?.content && msg.message?.content) {
          // 🔧 FIX: 合并 content 数组，保留 thinking 块
          const existingContent = Array.isArray(existingMsg.message.content) ? existingMsg.message.content : [];
          const newContent = Array.isArray(msg.message.content) ? msg.message.content : [];

          // 检查是否有 thinking 块需要保留
          const existingThinking = existingContent.filter((item: any) => item.type === 'thinking');
          const newThinking = newContent.filter((item: any) => item.type === 'thinking');

          // 如果旧消息有 thinking 但新消息没有，需要合并
          if (existingThinking.length > 0 && newThinking.length === 0) {
            messageMap.set(id, {
              ...msg,
              message: {
                ...msg.message,
                content: [...existingThinking, ...newContent]
              }
            });
          } else {
            // 否则使用新消息（新消息更完整）
            messageMap.set(id, msg);
          }
        } else {
          // 没有 content 或第一次遇到，直接设置
          messageMap.set(id, msg);
        }
      } else {
        // 没有 ID 的消息：直接保留（可能是临时消息）
        messagesWithoutId.push(msg);
      }
    }

    // 合并结果：保持原始顺序
    const deduplicatedMessages: ClaudeStreamMessage[] = [];
    const seenIds = new Set<string>();

    for (const msg of messages) {
      const id = getMessageId(msg);

      if (id) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          // 使用 Map 中的最新版本
          deduplicatedMessages.push(messageMap.get(id)!);
        }
      } else {
        // 没有 ID 的消息直接添加
        deduplicatedMessages.push(msg);
      }
    }

    const originalCount = messages.length;
    const deduplicatedCount = deduplicatedMessages.length;
    const duplicateCount = originalCount - deduplicatedCount;
    const duplicateRate = originalCount > 0 ? duplicateCount / originalCount : 0;

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 调试日志
    if (debug && duplicateCount > 0) {
      console.log(`[MessageDeduplication] 去重完成:`);
      console.log(`  - 原始消息: ${originalCount} 条`);
      console.log(`  - 去重后: ${deduplicatedCount} 条`);
      console.log(`  - 移除重复: ${duplicateCount} 条 (${(duplicateRate * 100).toFixed(1)}%)`);
      console.log(`  - 耗时: ${duration.toFixed(2)}ms`);
    }

    // 警告：重复率过高
    if (duplicateRate > warningThreshold) {
      console.warn(
        `[MessageDeduplication] ⚠️ 重复率过高: ${(duplicateRate * 100).toFixed(1)}% (${duplicateCount}/${originalCount})`
      );
      console.warn(`  建议检查消息添加逻辑，可能存在重复提交问题`);
    }

    return {
      messages: deduplicatedMessages,
      originalCount,
      deduplicatedCount,
      duplicateCount,
      duplicateRate,
    };
  }, [messages, debug, warningThreshold]);
}

/**
 * 创建幂等性 Key（用于防止重复提交）
 *
 * @param prefix - 前缀（如 "prompt", "message"）
 * @param data - 数据对象
 * @returns 幂等性 Key
 *
 * @example
 * const idempotencyKey = createIdempotencyKey("prompt", { text: "Hello", timestamp: Date.now() });
 */
export function createIdempotencyKey(prefix: string, data: any): string {
  const dataStr = JSON.stringify(data);
  // 简单哈希函数（生产环境建议使用 crypto.subtle.digest）
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}
