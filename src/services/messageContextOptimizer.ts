import { logger } from '@/lib/logger';
import { isFeatureEnabled } from "@/config/featureFlags";
import type { ClaudeStreamMessage } from "@/types/claude";
import { getFirstTextContent, getMessageRole } from "@/lib/messageTypeGuards";

export interface MessageWindow {
  /** Start index of the window */
  start: number;
  /** End index of the window (exclusive) */
  end: number;
}

export interface OptimizedMessageContext {
  /** Messages to include in API context */
  messages: ClaudeStreamMessage[];
  /** Total messages available */
  totalMessages: number;
  /** Number of messages excluded */
  excludedCount: number;
  /** Estimated tokens saved */
  estimatedTokensSaved: number;
}

const DEFAULT_WINDOW_SIZE = 50; // Include last 50 messages by default

/**
 * Get optimized message context for API calls
 * Implements lazy history loading to reduce token usage
 *
 * @param messages - Full message history
 * @param windowSize - Maximum number of messages to include
 * @returns Optimized message context
 */
export const getOptimizedMessageContext = (
  messages: ClaudeStreamMessage[],
  windowSize: number = DEFAULT_WINDOW_SIZE,
): OptimizedMessageContext => {
  // Feature flag check
  if (!isFeatureEnabled("LAZY_HISTORY_LOADING")) {
    return {
      messages,
      totalMessages: messages.length,
      excludedCount: 0,
      estimatedTokensSaved: 0,
    };
  }

  const totalMessages = messages.length;

  // If we have fewer messages than window size, return all
  if (totalMessages <= windowSize) {
    return {
      messages,
      totalMessages,
      excludedCount: 0,
      estimatedTokensSaved: 0,
    };
  }

  // Take the last N messages (most recent)
  const optimizedMessages = messages.slice(-windowSize);
  const excludedCount = totalMessages - windowSize;

  // Estimate tokens saved (conservative: 500 tokens per message)
  const avgTokensPerMessage = 500;
  const estimatedTokensSaved = excludedCount * avgTokensPerMessage;

  logger.debug('MessageContextOptimizer', `Optimized context: ${totalMessages} → ${optimizedMessages.length} messages`);
  logger.debug('MessageContextOptimizer', `Excluded ${excludedCount} old messages, saved ~${estimatedTokensSaved} tokens`);

  return {
    messages: optimizedMessages,
    totalMessages,
    excludedCount,
    estimatedTokensSaved,
  };
};

/**
 * Calculate optimal window size based on message characteristics
 * Adjusts window size dynamically based on message length and type
 *
 * @param messages - Message history
 * @param targetTokenBudget - Target token budget for context
 * @returns Optimal window size
 */
export const calculateOptimalWindowSize = (
  messages: ClaudeStreamMessage[],
  targetTokenBudget: number = 10000,
): number => {
  if (messages.length === 0) return DEFAULT_WINDOW_SIZE;

  // Estimate average tokens per message
  const recentMessages = messages.slice(-20);
  const avgContentLength =
    recentMessages.reduce((sum, msg) => {
      // 使用类型守卫获取文本内容
      const content = getFirstTextContent(msg);
      return sum + content.length;
    }, 0) / recentMessages.length;

  // Rough estimate: 1 token ≈ 4 characters
  const avgTokensPerMessage = Math.ceil(avgContentLength / 4);

  // Calculate how many messages fit in budget
  const optimalSize = Math.floor(targetTokenBudget / avgTokensPerMessage);

  // Clamp between reasonable bounds
  return Math.max(10, Math.min(optimalSize, 100));
};

/**
 * Check if a message should always be included (system messages, errors, etc.)
 */
export const isEssentialMessage = (message: ClaudeStreamMessage): boolean => {
  // 使用类型守卫获取角色和内容
  const role = getMessageRole(message);
  const content = getFirstTextContent(message);

  // Always include system messages
  if (role === "system") return true;

  // Always include error messages
  if (content.includes("[ERROR]") || content.includes("Error:")) return true;

  // Always include plan mode messages
  if (content.includes("[Plan Mode]") || content.includes("ExitPlanMode")) return true;

  return false;
};

/**
 * Get message window for rendering (different from API context)
 * Used for UI virtualization
 */
export const getMessageWindow = (
  totalMessages: number,
  currentWindow: MessageWindow,
  direction: "up" | "down",
  loadSize: number = 25,
): MessageWindow => {
  if (direction === "up") {
    // Load more older messages
    const newStart = Math.max(0, currentWindow.start - loadSize);
    return {
      start: newStart,
      end: currentWindow.end,
    };
  }

  // Load more newer messages
  const newEnd = Math.min(totalMessages, currentWindow.end + loadSize);
  return {
    start: currentWindow.start,
    end: newEnd,
  };
};

/**
 * Initialize message window for a session
 * Starts with recent messages and expands as needed
 */
export const initializeMessageWindow = (totalMessages: number): MessageWindow => {
  const initialSize = Math.min(DEFAULT_WINDOW_SIZE, totalMessages);
  return {
    start: Math.max(0, totalMessages - initialSize),
    end: totalMessages,
  };
};

/**
 * Get statistics about message context optimization
 */
export const getOptimizationStats = (
  originalCount: number,
  optimizedCount: number,
): {
  reductionPercent: number;
  estimatedTokensSaved: number;
  messagesExcluded: number;
} => {
  const messagesExcluded = originalCount - optimizedCount;
  const reductionPercent = originalCount > 0 ? (messagesExcluded / originalCount) * 100 : 0;
  const avgTokensPerMessage = 500;
  const estimatedTokensSaved = messagesExcluded * avgTokensPerMessage;

  return {
    reductionPercent,
    estimatedTokensSaved,
    messagesExcluded,
  };
};
