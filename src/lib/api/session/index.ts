/**
 * Session 模块 - 会话管理相关 API
 *
 * 包含：
 * - 项目列表管理
 * - 会话 CRUD 操作
 * - 会话历史加载
 * - Codex/Gemini 会话管理
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import type { ConversionResult, Project } from "../types";

// ============================================================================
// 项目管理
// ============================================================================

/**
 * 获取所有项目列表
 */
export async function listProjects(): Promise<Project[]> {
  try {
    return await invoke<Project[]>("list_projects");
  } catch (error) {
    logger.error("index", "Failed to list projects:", error);
    throw error;
  }
}

/**
 * 删除项目（软删除，移到隐藏目录）
 */
export async function deleteProject(projectId: string): Promise<string> {
  try {
    return await invoke<string>("delete_project", { projectId });
  } catch (error) {
    logger.error("index", "Failed to delete project:", error);
    throw error;
  }
}

/**
 * 恢复隐藏的项目
 */
export async function restoreProject(projectId: string): Promise<string> {
  try {
    return await invoke<string>("restore_project", { projectId });
  } catch (error) {
    logger.error("index", "Failed to restore project:", error);
    throw error;
  }
}

/**
 * 获取隐藏项目列表
 */
export async function listHiddenProjects(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_hidden_projects");
  } catch (error) {
    logger.error("index", "Failed to list hidden projects:", error);
    throw error;
  }
}

/**
 * 永久删除项目
 */
export async function deleteProjectPermanently(projectId: string): Promise<string> {
  try {
    return await invoke<string>("delete_project_permanently", { projectId });
  } catch (error) {
    logger.error("index", "Failed to permanently delete project:", error);
    throw error;
  }
}

// ============================================================================
// 会话管理
// ============================================================================

/**
 * 删除单个会话
 */
export async function deleteSession(sessionId: string, projectId: string): Promise<string> {
  try {
    return await invoke<string>("delete_session", { sessionId, projectId });
  } catch (error) {
    logger.error("index", "Failed to delete session:", error);
    throw error;
  }
}

/**
 * 批量删除会话
 */
export async function deleteSessionsBatch(
  sessionIds: string[],
  projectId: string
): Promise<string> {
  try {
    return await invoke<string>("delete_sessions_batch", { sessionIds, projectId });
  } catch (error) {
    logger.error("index", "Failed to batch delete sessions:", error);
    throw error;
  }
}

/**
 * 按模式删除会话（例如删除所有包含 "/compact" 的会话）
 */
export interface DeleteByPatternResult {
  matched_count: number;
  deleted_count: number;
  failed_count: number;
  errors: string[];
}

export async function deleteSessionsByPattern(
  projectId: string,
  pattern: string
): Promise<DeleteByPatternResult> {
  try {
    return await invoke<DeleteByPatternResult>("delete_sessions_by_pattern", {
      projectId,
      pattern,
    });
  } catch (error) {
    logger.error("index", "Failed to delete sessions by pattern:", error);
    throw error;
  }
}

/**
 * 加载 Claude 会话历史
 */
export async function loadSessionHistory(
  sessionId: string,
  projectId: string,
  engine?: "claude" | "codex"
): Promise<any[]> {
  // For Codex sessions, read directly from .codex/sessions
  if (engine === "codex") {
    return loadCodexSessionHistory(sessionId);
  }
  // For Claude sessions, use existing backend
  return await invoke<any[]>("load_session_history", { sessionId, projectId });
}

/**
 * 加载 Codex 会话历史
 */
export async function loadCodexSessionHistory(sessionId: string): Promise<any[]> {
  try {
    return await invoke<any[]>("load_codex_session_history", { sessionId });
  } catch (error) {
    logger.error("index", "Failed to load Codex session history:", error);
    throw error;
  }
}

// ============================================================================
// 会话转换
// ============================================================================

/**
 * 转换会话到其他引擎
 */
export async function convertSession(
  sessionId: string,
  sourceEngine: "claude" | "codex",
  targetEngine: "claude" | "codex",
  projectPath: string
): Promise<ConversionResult> {
  return await invoke<ConversionResult>("convert_session", {
    sessionId,
    sourceEngine,
    targetEngine,
    projectPath,
  });
}
