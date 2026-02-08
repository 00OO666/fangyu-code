/**
 * Git 模块 - Git 操作和统计 API
 *
 * 提供 Git 仓库操作、diff 统计、文件变更查询等功能。
 */
import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import type { GitFileChange, ResetSafetyInfo } from "../types";

/**
 * Check and initialize Git repository
 * @param projectPath - The project path
 * @returns Promise resolving to true if git is initialized
 */
export async function checkAndInitGit(projectPath: string): Promise<boolean> {
  try {
    return await invoke<boolean>("check_and_init_git", { projectPath });
  } catch (error) {
    logger.error("index", "Failed to check/init Git:", error);
    return false;
  }
}

/**
 * Check if a git reset operation is safe
 * This prevents accidentally reverting to a much older version when
 * multiple engines or user manual commits are involved
 * @param projectPath - The project path
 * @param targetCommit - The target commit to reset to
 * @param currentEngine - Current engine identifier
 * @returns Promise resolving to reset safety information
 */
export async function checkResetSafety(
  projectPath: string,
  targetCommit: string,
  currentEngine: string
): Promise<ResetSafetyInfo> {
  try {
    return await invoke<ResetSafetyInfo>("check_reset_safety", {
      projectPath,
      targetCommit,
      currentEngine,
    });
  } catch (error) {
    logger.error("index", "Failed to check reset safety:", error);
    // Return a safe default that allows proceeding
    return {
      commitsToLose: 0,
      hasOtherEngineCommits: false,
      hasUserCommits: false,
      commitsSummary: [],
      safeToProceed: true,
      warning: null,
    };
  }
}

/**
 * Get Git diff statistics between commits
 * @param projectPath - The project path
 * @param fromCommit - Starting commit
 * @param toCommit - Optional ending commit
 * @returns Promise resolving to diff statistics
 */
export async function getGitDiffStats(
  projectPath: string,
  fromCommit: string,
  toCommit?: string
): Promise<{ linesAdded: number; linesRemoved: number; filesChanged: number }> {
  try {
    return await invoke("get_git_diff_stats", { projectPath, fromCommit, toCommit });
  } catch (error) {
    logger.error("index", "Failed to get git diff stats:", error);
    throw error;
  }
}

/**
 * Get code changes for current session
 * @param projectPath - The project path
 * @param sessionStartCommit - The commit at session start
 * @returns Promise resolving to code change statistics
 */
export async function getSessionCodeChanges(
  projectPath: string,
  sessionStartCommit: string
): Promise<{ linesAdded: number; linesRemoved: number; filesChanged: number }> {
  try {
    return await invoke("get_session_code_changes", { projectPath, sessionStartCommit });
  } catch (error) {
    logger.error("index", "Failed to get session code changes:", error);
    throw error;
  }
}

/**
 * Get list of changed files between two commits
 * Used for code rollback preview
 * @param projectPath - The project path
 * @param fromCommit - Starting commit
 * @param toCommit - Optional ending commit
 * @returns Promise resolving to list of changed files
 */
export async function getGitChangedFiles(
  projectPath: string,
  fromCommit: string,
  toCommit?: string
): Promise<GitFileChange[]> {
  try {
    return await invoke("get_git_changed_files", { projectPath, fromCommit, toCommit });
  } catch (error) {
    logger.error("index", "Failed to get git changed files:", error);
    throw error;
  }
}

/**
 * Get unified diff content for a specific file
 * Used for Monaco Editor diff preview
 * @param projectPath - The project path
 * @param fromCommit - Starting commit
 * @param toCommit - Optional ending commit
 * @param filePath - Path to the file
 * @returns Promise resolving to diff content
 */
export async function getGitFileDiff(
  projectPath: string,
  fromCommit: string,
  toCommit: string | undefined,
  filePath: string
): Promise<string> {
  try {
    return await invoke("get_git_file_diff", { projectPath, fromCommit, toCommit, filePath });
  } catch (error) {
    logger.error("index", "Failed to get git file diff:", error);
    throw error;
  }
}

/**
 * Get file content at a specific commit
 * Used for side-by-side comparison in Monaco Editor
 * @param projectPath - The project path
 * @param commit - The commit hash
 * @param filePath - Path to the file
 * @returns Promise resolving to file content
 */
export async function getGitFileAtCommit(
  projectPath: string,
  commit: string,
  filePath: string
): Promise<string> {
  try {
    return await invoke("get_git_file_at_commit", { projectPath, commit, filePath });
  } catch (error) {
    logger.error("index", "Failed to get git file at commit:", error);
    throw error;
  }
}
