/**
 * Git Service - 前端 Git 操作服务
 *
 * 封装所有 Tauri Git 命令调用，提供类型安全的 API
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';

// ============================================================
// 类型定义
// ============================================================

export interface GitFileStatus {
  /** 文件路径（相对于仓库根目录） */
  path: string;
  /** 状态码: M (modified), A (added), D (deleted), ? (untracked), R (renamed) */
  status: 'M' | 'A' | 'D' | '?' | 'R' | string;
  /** 是否已暂存 */
  staged: boolean;
}

export interface GitCommitInfo {
  /** 完整 commit hash */
  hash: string;
  /** 短 hash (7 字符) */
  shortHash: string;
  /** 提交消息 */
  message: string;
  /** 作者名 */
  author: string;
  /** 时间戳 (ISO 格式) */
  timestamp: string;
  /** 相对时间 (如 "2 hours ago") */
  relativeTime: string;
  /** 修改的文件数 */
  filesChanged: number;
  /** 添加的行数 */
  insertions: number;
  /** 删除的行数 */
  deletions: number;
}

export interface GitCommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export type ResetMode = 'soft' | 'mixed' | 'hard';

export interface GitResetOptions {
  commitHash: string;
  mode: ResetMode;
  createBackup?: boolean;
}

// ============================================================
// Git 服务
// ============================================================

export const gitService = {
  /**
   * 检查目录是否是 Git 仓库
   */
  async isGitRepo(projectPath: string): Promise<boolean> {
    try {
      await invoke('git_status', { projectPath });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 获取文件状态列表
   */
  async getStatus(projectPath: string): Promise<GitFileStatus[]> {
    try {
      return await invoke<GitFileStatus[]>('git_status', { projectPath });
    } catch (error) {
      logger.error('gitService', '[GitService] getStatus failed:', error);
      return [];
    }
  },

  /**
   * 获取提交历史
   */
  async getLog(projectPath: string, count: number = 20): Promise<GitCommitInfo[]> {
    try {
      return await invoke<GitCommitInfo[]>('git_log', { projectPath, count });
    } catch (error) {
      logger.error('gitService', '[GitService] getLog failed:', error);
      return [];
    }
  },

  /**
   * 获取 diff 内容
   */
  async getDiff(
    projectPath: string,
    filePath?: string,
    staged: boolean = false
  ): Promise<string> {
    try {
      return await invoke<string>('git_diff', { projectPath, filePath, staged });
    } catch (error) {
      logger.error('gitService', '[GitService] getDiff failed:', error);
      return '';
    }
  },

  /**
   * 重置到指定提交
   */
  async reset(projectPath: string, options: GitResetOptions): Promise<GitCommandResult> {
    try {
      return await invoke<GitCommandResult>('git_reset', {
        projectPath,
        commitHash: options.commitHash,
        mode: options.mode,
        createBackup: options.createBackup ?? (options.mode === 'hard'),
      });
    } catch (error) {
      logger.error('gitService', '[GitService] reset failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * 撤销指定提交（创建新的 revert 提交）
   */
  async revert(projectPath: string, commitHash: string): Promise<GitCommandResult> {
    try {
      return await invoke<GitCommandResult>('git_revert_commit', {
        projectPath,
        commitHash,
      });
    } catch (error) {
      logger.error('gitService', '[GitService] revert failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * 恢复文件到指定状态
   */
  async restore(
    projectPath: string,
    filePath: string,
    source?: string,
    staged: boolean = false
  ): Promise<GitCommandResult> {
    try {
      return await invoke<GitCommandResult>('git_restore', {
        projectPath,
        filePath,
        source,
        staged,
      });
    } catch (error) {
      logger.error('gitService', '[GitService] restore failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * 创建备份分支
   */
  async createBackupBranch(projectPath: string): Promise<string | null> {
    try {
      return await invoke<string>('git_create_backup_branch', { projectPath });
    } catch (error) {
      logger.error('gitService', '[GitService] createBackupBranch failed:', error);
      return null;
    }
  },

  /**
   * 暂存文件
   */
  async add(projectPath: string, files: string[]): Promise<GitCommandResult> {
    try {
      return await invoke<GitCommandResult>('git_add', { projectPath, files });
    } catch (error) {
      logger.error('gitService', '[GitService] add failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * 创建提交
   */
  async commit(projectPath: string, message: string): Promise<GitCommandResult> {
    try {
      return await invoke<GitCommandResult>('git_commit', { projectPath, message });
    } catch (error) {
      logger.error('gitService', '[GitService] commit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export default gitService;
