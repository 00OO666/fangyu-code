import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { normalizeRawUsage } from './tokenExtractor';

/**
 * Combines multiple class values into a single string using clsx and tailwind-merge.
 * This utility function helps manage dynamic class names and prevents Tailwind CSS conflicts.
 *
 * @param inputs - Array of class values that can be strings, objects, arrays, etc.
 * @returns A merged string of class names with Tailwind conflicts resolved
 *
 * @example
 * cn("px-2 py-1", condition && "bg-blue-500", { "text-white": isActive })
 * // Returns: "px-2 py-1 bg-blue-500 text-white" (when condition and isActive are true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Usage data interface that supports both API formats
 *
 * @deprecated Use StandardizedTokenUsage from tokenExtractor.ts instead
 */
export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  // Standard format (frontend expectation)
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  // API format (Claude API actual response)
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Standardizes usage data from Claude API to consistent frontend format.
 *
 * ⚠️ This function now delegates to tokenExtractor.ts for unified token normalization.
 * All token standardization logic is centralized in tokenExtractor.ts
 *
 * @param usage - Raw usage data from Claude API or frontend
 * @returns Standardized usage data with consistent field names
 *
 * @example
 * const apiUsage = {
 *   input_tokens: 100,
 *   output_tokens: 50,
 *   cache_creation_input_tokens: 20,
 *   cache_read_input_tokens: 10
 * };
 * const standardized = normalizeUsageData(apiUsage);
 * // Result: { input_tokens: 100, output_tokens: 50, cache_creation_tokens: 20, cache_read_tokens: 10 }
 */
export function normalizeUsageData(usage: any): UsageData {
  // Delegate to the unified token normalization system
  const standardized = normalizeRawUsage(usage);

  // Return in the legacy UsageData format for backward compatibility
  return {
    input_tokens: standardized.input_tokens,
    output_tokens: standardized.output_tokens,
    cache_creation_tokens: standardized.cache_creation_tokens,
    cache_read_tokens: standardized.cache_read_tokens,
    // Also include API format fields for full compatibility
    cache_creation_input_tokens: standardized.cache_creation_tokens,
    cache_read_input_tokens: standardized.cache_read_tokens,
  };
}

/**
 * Calculates total tokens from normalized usage data
 * @param usage - Normalized usage data
 * @returns Total token count including cache tokens
 */
export function calculateTotalTokens(usage: UsageData): number {
  return usage.input_tokens + usage.output_tokens +
         (usage.cache_creation_tokens || 0) + (usage.cache_read_tokens || 0);
}

/**
 * Session validation interface - minimal fields needed for validation
 */
export interface ValidatableSession {
  id: string;
  first_message?: string;
  engine?: 'claude' | 'codex' | 'gemini';
}

/**
 * 验证会话是否为有效会话（用于显示）
 *
 * 有效会话的条件：
 * - 必须有非空的 id
 * - 必须满足以下条件之一：
 *   1. 有非空的 first_message（Claude/Gemini 会话）
 *   2. 是 Codex 会话（Codex 使用默认标题，可能没有 first_message）
 *
 * @param session - 要验证的会话对象
 * @returns 是否为有效会话
 *
 * @example
 * isValidSession({ id: '123', first_message: 'Hello' }) // true
 * isValidSession({ id: '123', first_message: '' }) // false
 * isValidSession({ id: '123', engine: 'codex' }) // true (Codex 始终有效)
 */
export function isValidSession(session: ValidatableSession): boolean {
  return Boolean(
    session.id &&
    session.id.trim() !== '' &&
    (
      (session.first_message && session.first_message.trim() !== '') ||
      session.engine === 'codex' // Codex 会话始终显示
    )
  );
}

/**
 * 过滤出所有有效的会话
 *
 * @param sessions - 会话数组
 * @returns 有效会话数组
 *
 * @example
 * const sessions = [
 *   { id: '1', first_message: 'Hello' },
 *   { id: '2', first_message: '' },
 *   { id: '3', engine: 'codex' }
 * ];
 * filterValidSessions(sessions) // [{ id: '1', ... }, { id: '3', ... }]
 */
export function filterValidSessions<T extends ValidatableSession>(sessions: T[]): T[] {
  return sessions.filter(isValidSession);
}

/**
 * GeminiSessionInfo 验证接口（用于 ProjectList 计数）
 */
export interface ValidatableGeminiSession {
  sessionId: string;
  firstMessage?: string;
}

/**
 * 验证 Gemini 会话是否有效（有 firstMessage）
 * 用于 ProjectList 中对 GeminiSessionInfo 的过滤
 */
export function isValidGeminiSession(session: ValidatableGeminiSession): boolean {
  return Boolean(
    session.sessionId &&
    session.sessionId.trim() !== '' &&
    session.firstMessage &&
    session.firstMessage.trim() !== ''
  );
}

/**
 * 过滤有效的 Gemini 会话
 */
export function filterValidGeminiSessions<T extends ValidatableGeminiSession>(sessions: T[]): T[] {
  return sessions.filter(isValidGeminiSession);
} 