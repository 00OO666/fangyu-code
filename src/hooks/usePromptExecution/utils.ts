/**
 * usePromptExecution 工具函数
 *
 * 🔧 v2.2.6: 从 usePromptExecution.ts 提取，降低代码复杂度
 */

import type { ClaudeGlobalEventPayload } from "./types";

/**
 * 标准化 Claude 全局事件 payload
 */
export const normalizeClaudeGlobalPayload = <T>(payload: ClaudeGlobalEventPayload<T>) => {
  if (payload && typeof payload === "object" && "payload" in payload) {
    const typedPayload = payload as { tab_id?: string | null; payload: T };
    return { tabId: typedPayload.tab_id ?? null, payload: typedPayload.payload };
  }
  return { tabId: null, payload: payload as T };
};

/**
 * 检测是否为 thinking blocks 错误
 */
export const isThinkingBlocksError = (error: any): boolean => {
  if (!error) return false;

  const errorStr = typeof error === "string" ? error : JSON.stringify(error);

  // 检测常见的 thinking blocks 相关错误
  const thinkingErrorPatterns = [
    "thinking",
    "extended_thinking",
    "budget_tokens",
    "thinking_budget",
    "max_tokens",
    "token budget",
  ];

  return thinkingErrorPatterns.some((pattern) => errorStr.toLowerCase().includes(pattern));
};

/**
 * 生成唯一 ID
 */
export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 安全解析 JSON
 */
export const safeJsonParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * 延迟执行
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 检测是否为空消息
 */
export const isEmptyMessage = (content: any): boolean => {
  if (!content) return true;
  if (typeof content === "string") return content.trim() === "";
  if (Array.isArray(content)) return content.length === 0;
  return false;
};
