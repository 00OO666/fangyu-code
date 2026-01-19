/**
 * Git 回滚功能测试
 * 
 * 测试 gitService 的所有功能：
 * - getStatus: 获取文件状态
 * - getLog: 获取提交历史
 * - getDiff: 获取差异
 * - reset: 重置到指定提交
 * - revert: 撤销提交
 * - restore: 恢复文件
 * - add/commit: 暂存和提交
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// 导入被测试的模块
import { gitService, type GitFileStatus, type GitCommitInfo } from '@/lib/gitService';

describe('gitService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('getStatus', () => {
    it('应该返回文件状态列表', async () => {
      const mockStatuses: GitFileStatus[] = [
        { path: 'src/test.ts', status: 'M', staged: false },
        { path: 'src/new.ts', status: 'A', staged: true },
        { path: 'src/deleted.ts', status: 'D', staged: false },
        { path: 'untracked.txt', status: '?', staged: false },
      ];
      mockInvoke.mockResolvedValue(mockStatuses);

      const result = await gitService.getStatus('/test/project');

      expect(mockInvoke).toHaveBeenCalledWith('git_status', { projectPath: '/test/project' });
      expect(result).toEqual(mockStatuses);
      expect(result.length).toBe(4);
    });

    it('应该在错误时返回空数组', async () => {
      mockInvoke.mockRejectedValue(new Error('Not a git repository'));

      const result = await gitService.getStatus('/not/a/repo');

      expect(result).toEqual([]);
    });

    it('应该正确区分已暂存和未暂存文件', async () => {
      const mockStatuses: GitFileStatus[] = [
        { path: 'staged.ts', status: 'M', staged: true },
        { path: 'unstaged.ts', status: 'M', staged: false },
      ];
      mockInvoke.mockResolvedValue(mockStatuses);

      const result = await gitService.getStatus('/test/project');

      const stagedFiles = result.filter(f => f.staged);
      const unstagedFiles = result.filter(f => !f.staged);
      
      expect(stagedFiles.length).toBe(1);
      expect(unstagedFiles.length).toBe(1);
    });
  });

  describe('getLog', () => {
    it('应该返回提交历史', async () => {
      const mockCommits: GitCommitInfo[] = [
        {
          hash: 'abc123def456',
          shortHash: 'abc123d',
          message: 'feat: add new feature',
          author: 'Test User',
          timestamp: '2024-01-15T10:00:00Z',
          relativeTime: '2 hours ago',
          filesChanged: 3,
          insertions: 50,
          deletions: 10,
        },
        {
          hash: 'def456ghi789',
          shortHash: 'def456g',
          message: 'fix: bug fix',
          author: 'Test User',
          timestamp: '2024-01-14T10:00:00Z',
          relativeTime: '1 day ago',
          filesChanged: 1,
          insertions: 5,
          deletions: 2,
        },
      ];
      mockInvoke.mockResolvedValue(mockCommits);

      const result = await gitService.getLog('/test/project', 10);

      expect(mockInvoke).toHaveBeenCalledWith('git_log', { projectPath: '/test/project', count: 10 });
      expect(result).toEqual(mockCommits);
      expect(result.length).toBe(2);
    });

    it('应该在错误时返回空数组', async () => {
      mockInvoke.mockRejectedValue(new Error('Git error'));

      const result = await gitService.getLog('/test/project');

      expect(result).toEqual([]);
    });
  });

  describe('reset', () => {
    it('应该执行 soft reset', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'Reset successful' });

      const result = await gitService.reset('/test/project', {
        commitHash: 'abc123',
        mode: 'soft',
      });

      expect(mockInvoke).toHaveBeenCalledWith('git_reset', {
        projectPath: '/test/project',
        commitHash: 'abc123',
        mode: 'soft',
        createBackup: false,
      });
      expect(result.success).toBe(true);
    });

    it('应该执行 hard reset 并自动创建备份', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'Reset successful' });

      const result = await gitService.reset('/test/project', {
        commitHash: 'abc123',
        mode: 'hard',
        createBackup: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('git_reset', {
        projectPath: '/test/project',
        commitHash: 'abc123',
        mode: 'hard',
        createBackup: true,
      });
      expect(result.success).toBe(true);
    });

    it('应该在失败时返回错误信息', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid commit hash'));

      const result = await gitService.reset('/test/project', {
        commitHash: 'invalid',
        mode: 'mixed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid commit hash');
    });
  });

  describe('revert', () => {
    it('应该创建 revert 提交', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'Revert successful' });

      const result = await gitService.revert('/test/project', 'abc123');

      expect(mockInvoke).toHaveBeenCalledWith('git_revert_commit', {
        projectPath: '/test/project',
        commitHash: 'abc123',
      });
      expect(result.success).toBe(true);
    });

    it('应该在冲突时返回错误', async () => {
      mockInvoke.mockRejectedValue(new Error('Merge conflict'));

      const result = await gitService.revert('/test/project', 'abc123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Merge conflict');
    });
  });

  describe('restore', () => {
    it('应该恢复单个文件', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'File restored' });

      const result = await gitService.restore('/test/project', 'src/test.ts');

      expect(mockInvoke).toHaveBeenCalledWith('git_restore', {
        projectPath: '/test/project',
        filePath: 'src/test.ts',
        source: undefined,
        staged: false,
      });
      expect(result.success).toBe(true);
    });

    it('应该恢复到指定提交', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'File restored' });

      const result = await gitService.restore('/test/project', 'src/test.ts', 'abc123');

      expect(mockInvoke).toHaveBeenCalledWith('git_restore', {
        projectPath: '/test/project',
        filePath: 'src/test.ts',
        source: 'abc123',
        staged: false,
      });
      expect(result.success).toBe(true);
    });

    it('应该取消暂存文件', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'File unstaged' });

      const result = await gitService.restore('/test/project', 'src/test.ts', undefined, true);

      expect(mockInvoke).toHaveBeenCalledWith('git_restore', {
        projectPath: '/test/project',
        filePath: 'src/test.ts',
        source: undefined,
        staged: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('add', () => {
    it('应该暂存文件', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'Files added' });

      const result = await gitService.add('/test/project', ['src/test.ts', 'src/new.ts']);

      expect(mockInvoke).toHaveBeenCalledWith('git_add', {
        projectPath: '/test/project',
        files: ['src/test.ts', 'src/new.ts'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('commit', () => {
    it('应该创建提交', async () => {
      mockInvoke.mockResolvedValue({ success: true, output: 'Commit created' });

      const result = await gitService.commit('/test/project', 'feat: new feature');

      expect(mockInvoke).toHaveBeenCalledWith('git_commit', {
        projectPath: '/test/project',
        message: 'feat: new feature',
      });
      expect(result.success).toBe(true);
    });

    it('应该在没有更改时返回错误', async () => {
      mockInvoke.mockRejectedValue(new Error('Nothing to commit'));

      const result = await gitService.commit('/test/project', 'empty commit');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nothing to commit');
    });
  });

  describe('createBackupBranch', () => {
    it('应该创建备份分支', async () => {
      mockInvoke.mockResolvedValue('backup-20240115-100000');

      const result = await gitService.createBackupBranch('/test/project');

      expect(mockInvoke).toHaveBeenCalledWith('git_create_backup_branch', {
        projectPath: '/test/project',
      });
      expect(result).toBe('backup-20240115-100000');
    });

    it('应该在失败时返回 null', async () => {
      mockInvoke.mockRejectedValue(new Error('Branch creation failed'));

      const result = await gitService.createBackupBranch('/test/project');

      expect(result).toBeNull();
    });
  });

  describe('isGitRepo', () => {
    it('应该检测 Git 仓库', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await gitService.isGitRepo('/test/project');

      expect(result).toBe(true);
    });

    it('应该检测非 Git 目录', async () => {
      mockInvoke.mockRejectedValue(new Error('Not a git repository'));

      const result = await gitService.isGitRepo('/not/a/repo');

      expect(result).toBe(false);
    });
  });
});
