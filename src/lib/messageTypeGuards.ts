/**
 * Type Guards and Helper Functions for ClaudeStreamMessage
 *
 * 用于替代代码中大量的 `as any` 类型断言，提供类型安全的消息访问方法
 */

import type { ClaudeStreamMessage } from "@/types/claude";

// ============================================================================
// Content Item Types
// ============================================================================

export interface TextContentItem {
  type: "text";
  text: string;
}

export interface ThinkingContentItem {
  type: "thinking";
  thinking: string;
}

export interface ToolUseContentItem {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContentItem {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown[];
}

export type MessageContentItem =
  | TextContentItem
  | ThinkingContentItem
  | ToolUseContentItem
  | ToolResultContentItem
  | { type: string; [key: string]: unknown }; // 其他类型

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否为文本内容项
 */
export function isTextContent(item: unknown): item is TextContentItem {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: string }).type === "text" &&
    typeof (item as { text?: unknown }).text === "string"
  );
}

/**
 * 检查是否为思考内容项
 */
export function isThinkingContent(item: unknown): item is ThinkingContentItem {
  return (
    typeof item === "object" && item !== null && (item as { type?: string }).type === "thinking"
  );
}

/**
 * 检查是否为工具使用内容项
 */
export function isToolUseContent(item: unknown): item is ToolUseContentItem {
  return (
    typeof item === "object" && item !== null && (item as { type?: string }).type === "tool_use"
  );
}

/**
 * 检查是否为工具结果内容项
 */
export function isToolResultContent(item: unknown): item is ToolResultContentItem {
  return (
    typeof item === "object" && item !== null && (item as { type?: string }).type === "tool_result"
  );
}

/**
 * 检查是否为用户消息
 */
export function isUserMessage(msg: ClaudeStreamMessage): boolean {
  return msg.type === "user" || msg.message?.role === "user" || msg.message?.role === "human";
}

/**
 * 检查是否为助手消息
 */
export function isAssistantMessage(msg: ClaudeStreamMessage): boolean {
  return msg.type === "assistant" || msg.message?.role === "assistant";
}

/**
 * 检查是否为系统消息
 */
export function isSystemMessage(msg: ClaudeStreamMessage): boolean {
  return msg.type === "system" || msg.message?.role === "system";
}

// ============================================================================
// Content Extractors
// ============================================================================

/**
 * 获取消息的角色
 */
export function getMessageRole(msg: ClaudeStreamMessage): string | undefined {
  return msg.message?.role || msg.type;
}

/**
 * 获取消息的文本内容
 * 安全地处理各种内容格式
 */
export function getMessageText(msg: ClaudeStreamMessage): string {
  const content = msg.message?.content;

  // 如果 content 是字符串
  if (typeof content === "string") {
    return content;
  }

  // 如果 content 是数组
  if (Array.isArray(content)) {
    return content
      .filter(isTextContent)
      .map((c) => c.text)
      .join("\n");
  }

  return "";
}

/**
 * 获取消息的第一个文本内容
 */
export function getFirstTextContent(msg: ClaudeStreamMessage): string {
  const content = msg.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textItem = content.find(isTextContent);
    return textItem?.text || "";
  }

  return "";
}

/**
 * 获取消息的思考内容
 */
export function getThinkingContent(msg: ClaudeStreamMessage): string {
  const content = msg.message?.content;

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter(isThinkingContent)
    .map((c) => c.thinking)
    .join("\n");
}

/**
 * 检查消息是否包含工具调用
 */
export function hasToolCalls(msg: ClaudeStreamMessage): boolean {
  const content = msg.message?.content;

  if (!Array.isArray(content)) {
    return false;
  }

  return content.some(isToolUseContent);
}

/**
 * 获取消息的工具调用
 */
export function getToolCalls(msg: ClaudeStreamMessage): ToolUseContentItem[] {
  const content = msg.message?.content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter(isToolUseContent);
}

/**
 * 估算消息的 token 数量
 * 粗略估计：1 token ≈ 4 个字符
 */
export function estimateMessageTokens(msg: ClaudeStreamMessage): number {
  const text = getMessageText(msg);
  return Math.ceil(text.length / 4);
}

/**
 * 获取消息的使用统计
 */
export function getMessageUsage(msg: ClaudeStreamMessage): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
} {
  const usage = msg.message?.usage || msg.usage;

  return {
    inputTokens: usage?.input_tokens || 0,
    outputTokens: usage?.output_tokens || 0,
    cacheCreationTokens: usage?.cache_creation_tokens || 0,
    cacheReadTokens: usage?.cache_read_tokens || 0,
  };
}
