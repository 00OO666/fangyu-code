/**
 * Usage 模块 - 使用统计相关 API
 *
 * 包含：
 * - Claude 使用统计
 * - Codex 使用统计
 * - Gemini 使用统计
 * - 会话统计
 * - Cache Tokens 统计
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectUsage, SessionCacheTokens, UsageStats } from "../types";

// ============================================================================
// Claude 使用统计
// ============================================================================

/**
 * 获取总体使用统计
 */
export async function getUsageStats(): Promise<UsageStats> {
  try {
    return await invoke<UsageStats>("get_usage_stats");
  } catch (error) {
    logger.error("index", "Failed to get usage stats:", error);
    throw error;
  }
}

/**
 * 获取指定日期范围的使用统计
 */
export async function getUsageByDateRange(startDate: string, endDate: string): Promise<UsageStats> {
  try {
    return await invoke<UsageStats>("get_usage_by_date_range", { startDate, endDate });
  } catch (error) {
    logger.error("index", "Failed to get usage by date range:", error);
    throw error;
  }
}

/**
 * 获取按会话分组的使用统计
 */
export async function getSessionStats(
  since?: string,
  until?: string,
  order?: "asc" | "desc"
): Promise<ProjectUsage[]> {
  try {
    return await invoke<ProjectUsage[]>("get_session_stats", {
      since,
      until,
      order,
    });
  } catch (error) {
    logger.error("index", "Failed to get session stats:", error);
    throw error;
  }
}

/**
 * 获取指定会话的缓存 Token 统计
 */
export async function getSessionCacheTokens(sessionId: string): Promise<SessionCacheTokens> {
  try {
    return await invoke<SessionCacheTokens>("get_session_cache_tokens", { sessionId });
  } catch (error) {
    logger.error("index", "Failed to get session cache tokens:", error);
    throw error;
  }
}

// ============================================================================
// Codex 使用统计
// ============================================================================

/**
 * 获取 Codex 使用统计
 */
export async function getCodexUsageStats(
  startDate?: string,
  endDate?: string
): Promise<import("@/types/usage").CodexUsageStats> {
  try {
    return await invoke<import("@/types/usage").CodexUsageStats>("get_codex_usage_stats", {
      startDate,
      endDate,
    });
  } catch (error) {
    logger.error("index", "Failed to get Codex usage stats:", error);
    throw error;
  }
}

// ============================================================================
// Gemini 使用统计
// ============================================================================

/**
 * 获取 Gemini 使用统计
 */
export async function getGeminiUsageStats(
  startDate?: string,
  endDate?: string
): Promise<import("@/types/usage").GeminiUsageStats> {
  try {
    return await invoke<import("@/types/usage").GeminiUsageStats>("get_gemini_usage_stats", {
      startDate,
      endDate,
    });
  } catch (error) {
    logger.error("index", "Failed to get Gemini usage stats:", error);
    throw error;
  }
}
