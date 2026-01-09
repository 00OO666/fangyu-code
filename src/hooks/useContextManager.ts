/**
 * 上下文管理 Hook
 *
 * 提供上下文截断、摘要和 Token 优化功能
 * 🔧 v2.2.6: 新增，解决 Token 消耗过快的问题
 */

import { useMemo, useCallback } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

// Token 估算常量（粗略估算，1 token ≈ 4 字符）
const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 100000; // 默认最大 token 数
const SUMMARY_THRESHOLD = 0.7; // 当达到 70% 时开始考虑摘要

export interface ContextStats {
  totalTokens: number;
  messageCount: number;
  oldestMessageAge: number; // 毫秒
  shouldTruncate: boolean;
  shouldSummarize: boolean;
  truncationIndex: number; // 建议从此索引开始保留
}

export interface ContextManagerOptions {
  maxTokens?: number;
  preserveSystemMessages?: boolean;
  preserveRecentCount?: number; // 始终保留最近 N 条消息
}

/**
 * 估算消息的 token 数
 */
const estimateMessageTokens = (message: ClaudeStreamMessage): number => {
  let chars = 0;

  // 计算消息内容
  const content = message.message?.content;
  if (typeof content === 'string') {
    chars += content.length;
  } else if (Array.isArray(content)) {
    content.forEach((item: any) => {
      if (typeof item === 'string') {
        chars += item.length;
      } else if (item?.text) {
        chars += item.text.length;
      } else if (item?.content) {
        chars += typeof item.content === 'string' ? item.content.length : JSON.stringify(item.content).length;
      }
    });
  }

  // 计算 thinking 内容
  if (message.thinking) {
    chars += message.thinking.length;
  }

  return Math.ceil(chars / CHARS_PER_TOKEN);
};

/**
 * 估算消息数组的总 token 数
 */
const estimateTotalTokens = (messages: ClaudeStreamMessage[]): number => {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
};

/**
 * 查找截断点
 */
const findTruncationIndex = (
  messages: ClaudeStreamMessage[],
  maxTokens: number,
  preserveRecentCount: number
): number => {
  const totalTokens = estimateTotalTokens(messages);
  if (totalTokens <= maxTokens) return 0;

  // 从后往前累计，找到可以保留的起始点
  let accumulatedTokens = 0;
  let truncationIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(messages[i]);
    if (accumulatedTokens + msgTokens > maxTokens) {
      truncationIndex = i + 1;
      break;
    }
    accumulatedTokens += msgTokens;
  }

  // 确保至少保留 preserveRecentCount 条消息
  const minIndex = Math.max(0, messages.length - preserveRecentCount);
  return Math.max(truncationIndex, minIndex);
};

/**
 * 生成消息摘要（简化版）
 */
const generateSummary = (messages: ClaudeStreamMessage[]): string => {
  const userMessages = messages.filter(m => m.message?.role === 'user');
  const _assistantMessages = messages.filter(m => m.message?.role === 'assistant');

  const topics: string[] = [];

  // 提取用户消息的关键词
  userMessages.forEach(msg => {
    const content = msg.message?.content;
    if (typeof content === 'string' && content.length > 0) {
      // 取前 100 个字符作为主题
      topics.push(content.slice(0, 100));
    }
  });

  return `[会话摘要] 讨论了 ${topics.length} 个主题，共 ${messages.length} 条消息。主要内容：${topics.slice(0, 3).join('；')}...`;
};

export interface UseContextManagerReturn {
  stats: ContextStats;
  truncatedMessages: ClaudeStreamMessage[];
  summary: string | null;
  truncateMessages: (messages: ClaudeStreamMessage[]) => ClaudeStreamMessage[];
  getContextForAPI: (messages: ClaudeStreamMessage[]) => ClaudeStreamMessage[];
}

/**
 * 上下文管理 Hook
 */
export function useContextManager(
  messages: ClaudeStreamMessage[],
  options: ContextManagerOptions = {}
): UseContextManagerReturn {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    preserveSystemMessages = true,
    preserveRecentCount = 10,
  } = options;

  // 计算统计信息
  const stats = useMemo((): ContextStats => {
    const totalTokens = estimateTotalTokens(messages);
    const threshold = maxTokens * SUMMARY_THRESHOLD;
    const truncationIndex = findTruncationIndex(messages, maxTokens, preserveRecentCount);

    // 计算最老消息的年龄
    let oldestMessageAge = 0;
    if (messages.length > 0) {
      const firstMsg = messages[0];
      const timestamp = firstMsg.timestamp || Date.now();
      oldestMessageAge = Date.now() - timestamp;
    }

    return {
      totalTokens,
      messageCount: messages.length,
      oldestMessageAge,
      shouldTruncate: totalTokens > maxTokens,
      shouldSummarize: totalTokens > threshold,
      truncationIndex,
    };
  }, [messages, maxTokens, preserveRecentCount]);

  // 截断后的消息
  const truncatedMessages = useMemo((): ClaudeStreamMessage[] => {
    if (!stats.shouldTruncate) return messages;

    const systemMessages = preserveSystemMessages
      ? messages.filter(m => m.message?.role === 'system')
      : [];

    const recentMessages = messages.slice(stats.truncationIndex);

    // 合并系统消息和最近消息（去重）
    const systemIds = new Set(systemMessages.map(m => m.id));
    const uniqueRecent = recentMessages.filter(m => !systemIds.has(m.id));

    return [...systemMessages, ...uniqueRecent];
  }, [messages, stats, preserveSystemMessages]);

  // 生成摘要
  const summary = useMemo((): string | null => {
    if (!stats.shouldSummarize || stats.truncationIndex === 0) return null;
    const truncatedPart = messages.slice(0, stats.truncationIndex);
    return generateSummary(truncatedPart);
  }, [messages, stats]);

  // 截断消息函数
  const truncateMessages = useCallback(
    (msgs: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
      const totalTokens = estimateTotalTokens(msgs);
      if (totalTokens <= maxTokens) return msgs;

      const truncationIndex = findTruncationIndex(msgs, maxTokens, preserveRecentCount);
      return msgs.slice(truncationIndex);
    },
    [maxTokens, preserveRecentCount]
  );

  // 获取用于 API 调用的上下文
  const getContextForAPI = useCallback(
    (msgs: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
      // 过滤掉不需要发送给 API 的消息类型
      const filteredMessages = msgs.filter(m => {
        // 保留用户和助手消息
        const role = m.message?.role;
        if (role === 'user' || role === 'assistant') return true;
        // 保留系统消息
        if (role === 'system' && preserveSystemMessages) return true;
        return false;
      });

      return truncateMessages(filteredMessages);
    },
    [truncateMessages, preserveSystemMessages]
  );

  return {
    stats,
    truncatedMessages,
    summary,
    truncateMessages,
    getContextForAPI,
  };
}

export default useContextManager;
