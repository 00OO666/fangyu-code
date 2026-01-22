/**
 * GitChangesPanel - Git 变更管理面板
 *
 * 功能:
 * - 显示修改的文件列表
 * - 自动提交控制
 * - /undo 回滚功能（支持 reset/revert/restore）
 * - Repo Map 仓库映射
 * - 提交历史浏览
 *
 * 来源: Cursor Git UI + Aider Repo Map
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { useGitAutoCommit, type CommitInfo, type GitFileStatus } from '@/hooks/useGitAutoCommit';
import { gitService, type ResetMode } from '@/lib/gitService';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import GitCommit from 'lucide-react/dist/esm/icons/git-commit'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import History from 'lucide-react/dist/esm/icons/history'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Clock from 'lucide-react/dist/esm/icons/clock'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Play from 'lucide-react/dist/esm/icons/play'
import Pause from 'lucide-react/dist/esm/icons/pause'
import Map from 'lucide-react/dist/esm/icons/map'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Undo2 from 'lucide-react/dist/esm/icons/undo-2'
import FilePlus from 'lucide-react/dist/esm/icons/file-plus'
import FileX from 'lucide-react/dist/esm/icons/file-x'
import FileQuestion from 'lucide-react/dist/esm/icons/file-question'
import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right';

// ============================================================
// 类型定义
// ============================================================

type RollbackMethod = 'reset-soft' | 'reset-mixed' | 'reset-hard' | 'revert';

interface RollbackDialogState {
  open: boolean;
  commit: CommitInfo | null;
  method: RollbackMethod;
  createBackup: boolean;
  isProcessing: boolean;
}

// ============================================================
// 组件
// ============================================================

interface GitChangesPanelProps {
  /** 项目路径 */
  projectPath: string;
  /** 是否紧凑模式 */
  compact?: boolean;
}

export function GitChangesPanel({ projectPath }: GitChangesPanelProps) {
  const gitAutoCommit = useGitAutoCommit({
    projectPath,
    onAfterCommit: (commit) => {
      logger.debug('GitChangesPanel', '提交成功:', commit);
    },
  });

  const {
    config,
    pendingCommit,
    isCommitting,
    updateConfig,
    triggerCommit,
    cancelPendingCommit,
    executePendingCommit,
    getRecentCommits,
  } = gitAutoCommit;

  // UI 状态
  const [fileStatuses, setFileStatuses] = useState<GitFileStatus[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRepoMap, setShowRepoMap] = useState(false);
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  
  // 回滚对话框状态
  const [rollbackDialog, setRollbackDialog] = useState<RollbackDialogState>({
    open: false,
    commit: null,
    method: 'revert',
    createBackup: true,
    isProcessing: false,
  });
  
  // 通知状态
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  
  // 文件恢复状态
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  // 显示通知
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  }, []);

  // 加载文件状态（使用 gitService 获取完整状态）
  const loadFileStatuses = useCallback(async () => {
    const statuses = await gitService.getStatus(projectPath);
    setFileStatuses(statuses);
  }, [projectPath]);

  // 加载提交历史
  const loadCommitHistory = useCallback(async () => {
    const commits = await getRecentCommits(20);
    setRecentCommits(commits);
  }, [getRecentCommits]);

  useEffect(() => {
    loadFileStatuses();
    loadCommitHistory();

    // 定期刷新
    const interval = setInterval(() => {
      loadFileStatuses();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadFileStatuses, loadCommitHistory]);

  // 打开回滚对话框
  const openRollbackDialog = useCallback((commit: CommitInfo) => {
    setRollbackDialog({
      open: true,
      commit,
      method: 'revert', // 默认使用安全的 revert
      createBackup: true,
      isProcessing: false,
    });
  }, []);

  // 执行回滚操作
  const executeRollback = useCallback(async () => {
    if (!rollbackDialog.commit) return;
    
    setRollbackDialog(prev => ({ ...prev, isProcessing: true }));
    
    try {
      let result;
      const { commit, method, createBackup } = rollbackDialog;
      
      if (method === 'revert') {
        // 使用 revert（安全，创建新提交）
        result = await gitService.revert(projectPath, commit.hash);
      } else {
        // 使用 reset
        const modeMap: Record<string, ResetMode> = {
          'reset-soft': 'soft',
          'reset-mixed': 'mixed',
          'reset-hard': 'hard',
        };
        result = await gitService.reset(projectPath, {
          commitHash: commit.hash,
          mode: modeMap[method],
          createBackup: createBackup && method === 'reset-hard',
        });
      }
      
      if (result.success) {
        showNotification('success', `回滚成功！${method === 'revert' ? '已创建新的撤销提交' : ''}`);
        // 刷新数据
        await loadFileStatuses();
        await loadCommitHistory();
        setRollbackDialog(prev => ({ ...prev, open: false }));
        setShowHistory(false);
      } else {
        showNotification('error', `回滚失败: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', `回滚失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRollbackDialog(prev => ({ ...prev, isProcessing: false }));
    }
  }, [rollbackDialog, projectPath, showNotification, loadFileStatuses, loadCommitHistory]);

  // 恢复单个文件
  const restoreFile = useCallback(async (filePath: string) => {
    setRestoringFile(filePath);
    try {
      const result = await gitService.restore(projectPath, filePath);
      if (result.success) {
        showNotification('success', `已恢复文件: ${filePath}`);
        await loadFileStatuses();
      } else {
        showNotification('error', `恢复失败: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', `恢复失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRestoringFile(null);
    }
  }, [projectPath, showNotification, loadFileStatuses]);

  // 切换文件展开状态
  const toggleFileExpand = (file: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(file)) {
        newSet.delete(file);
      } else {
        newSet.add(file);
      }
      return newSet;
    });
  };

  // 获取文件状态图标和颜色
  const getFileStatusDisplay = (status: string, staged: boolean) => {
    const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
      'M': { 
        icon: <FileText className="w-4 h-4" />, 
        color: 'text-blue-500', 
        label: 'Modified' 
      },
      'A': { 
        icon: <FilePlus className="w-4 h-4" />, 
        color: 'text-green-500', 
        label: 'Added' 
      },
      'D': { 
        icon: <FileX className="w-4 h-4" />, 
        color: 'text-red-500', 
        label: 'Deleted' 
      },
      '?': { 
        icon: <FileQuestion className="w-4 h-4" />, 
        color: 'text-gray-400', 
        label: 'Untracked' 
      },
      'R': { 
        icon: <ArrowLeftRight className="w-4 h-4" />, 
        color: 'text-purple-500', 
        label: 'Renamed' 
      },
    };
    
    const config = statusConfig[status] || statusConfig['M'];
    return {
      ...config,
      staged,
      bgColor: staged ? 'bg-green-500/10' : 'bg-transparent',
    };
  };

  // 获取文件类型图标
  const getFileTypeIcon = (file: string) => {
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (file.endsWith('.css') || file.endsWith('.scss')) {
      return <FileText className="w-4 h-4 text-pink-500" />;
    }
    if (file.endsWith('.rs')) {
      return <FileText className="w-4 h-4 text-orange-500" />;
    }
    if (file.endsWith('.json')) {
      return <FileText className="w-4 h-4 text-yellow-500" />;
    }
    return <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />;
  };

  // 格式化时间
  const formatTime = (timestamp: string | number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小时前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* 通知提示 */}
      {notification.show && (
        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}
      
      {/* 头部工具栏 */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 flex-1">
          <GitBranch className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium">Git 变更</span>

          {fileStatuses.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              {fileStatuses.length}
            </span>
          )}
        </div>

        {/* 自动提交开关 */}
        <button
          onClick={() => updateConfig({ enabled: !config.enabled })}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${config.enabled
            ? 'bg-green-500/10 text-green-500'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            }`}
          title={config.enabled ? '自动提交已启用' : '自动提交已禁用'}
        >
          {config.enabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          <span>自动</span>
        </button>

        {/* 设置 */}
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <Settings className="w-4 h-4" />
        </Button>

        {/* 历史 */}
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
          <History className="w-4 h-4" />
        </Button>

        {/* Repo Map */}
        <Button variant="ghost" size="sm" onClick={() => setShowRepoMap(true)}>
          <Map className="w-4 h-4" />
        </Button>
      </div>

      {/* 待处理的提交提示 */}
      {pendingCommit && (
        <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-500">
                待提交 ({pendingCommit.files.length} 个文件)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={executePendingCommit} disabled={isCommitting}>
                {isCommitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span className="ml-1">立即提交</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelPendingCommit}
                disabled={isCommitting}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {pendingCommit.suggestedMessage}
          </div>
        </div>
      )}

      {/* 修改的文件列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {fileStatuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
              <GitCommit className="w-8 h-8 mb-2 opacity-50" />
              <p>暂无修改</p>
            </div>
          ) : (
            fileStatuses.map((fileStatus) => {
              const statusDisplay = getFileStatusDisplay(fileStatus.status, fileStatus.staged);
              return (
                <ContextMenu key={fileStatus.path}>
                  <ContextMenuTrigger>
                    <div
                      className={`rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden ${statusDisplay.bgColor}`}
                    >
                      <button
                        onClick={() => toggleFileExpand(fileStatus.path)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {expandedFiles.has(fileStatus.path) ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                        )}
                        {getFileTypeIcon(fileStatus.path)}
                        <span className="flex-1 text-sm text-left truncate">{fileStatus.path}</span>
                        <span className={`text-xs font-mono ${statusDisplay.color}`} title={statusDisplay.label}>
                          {fileStatus.status}
                        </span>
                        {fileStatus.staged && (
                          <span className="text-xs text-green-500 ml-1" title="已暂存">●</span>
                        )}
                        {restoringFile === fileStatus.path && (
                          <Loader2 className="w-3 h-3 animate-spin text-[var(--text-tertiary)]" />
                        )}
                      </button>

                      {expandedFiles.has(fileStatus.path) && (
                        <div className="px-2 pb-2 border-t border-[var(--border-primary)]">
                          <div className="mt-2 p-2 rounded bg-[var(--bg-primary)] text-xs font-mono">
                            <div className="text-[var(--text-tertiary)]">
                              <div className="flex items-center gap-2 mb-1">
                                <Plus className="w-3 h-3 text-green-500" />
                                <span className="text-green-500">添加的行</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Minus className="w-3 h-3 text-red-500" />
                                <span className="text-red-500">删除的行</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem 
                      onClick={() => restoreFile(fileStatus.path)}
                      disabled={restoringFile === fileStatus.path || fileStatus.status === '?'}
                    >
                      <Undo2 className="w-4 h-4 mr-2" />
                      恢复此文件
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* 底部操作栏 */}
      <div className="flex items-center gap-2 p-3 border-t border-[var(--border-primary)]">
        <Button
          size="sm"
          onClick={triggerCommit}
          disabled={fileStatuses.length === 0 || isCommitting}
          className="flex-1"
        >
          {isCommitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <GitCommit className="w-4 h-4 mr-1" />
          )}
          手动提交
        </Button>
      </div>

      {/* 设置对话框 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              自动提交设置
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>配置 Git 自动提交的延迟时间、自动推送等选项</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 延迟时间 */}
            <div>
              <label className="text-sm font-medium">延迟时间</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="range"
                  min="10"
                  max="300"
                  value={config.delay / 1000}
                  onChange={(e) =>
                    updateConfig({ delay: Number(e.target.value) * 1000 })
                  }
                  className="flex-1"
                />
                <span className="text-sm text-[var(--text-secondary)] w-12">
                  {config.delay / 1000}s
                </span>
              </div>
            </div>

            {/* 自动推送 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">自动推送</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  提交后自动推送到远程
                </div>
              </div>
              <button
                onClick={() => updateConfig({ autoPush: !config.autoPush })}
                className={`w-10 h-6 rounded-full transition-colors ${config.autoPush ? 'bg-green-500' : 'bg-[var(--bg-tertiary)]'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${config.autoPush ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                />
              </button>
            </div>

            {/* 最小文件数 */}
            <div>
              <label className="text-sm font-medium">最小文件数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.minFiles}
                onChange={(e) => updateConfig({ minFiles: Number(e.target.value) })}
                className="w-full mt-2 px-3 py-2 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)]"
              />
            </div>

            {/* 提交消息前缀 */}
            <div>
              <label className="text-sm font-medium">提交消息前缀</label>
              <input
                type="text"
                value={config.messagePrefix}
                onChange={(e) => updateConfig({ messagePrefix: e.target.value })}
                className="w-full mt-2 px-3 py-2 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提交历史对话框 */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              提交历史
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>查看最近的 Git 提交记录，支持回滚操作</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <ScrollArea className="h-96 py-4">
            <div className="space-y-2">
              {recentCommits.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-tertiary)]">
                  暂无提交历史
                </div>
              ) : (
                recentCommits.map((commit) => (
                  <button
                    key={commit.hash}
                    onClick={() => setSelectedCommit(commit)}
                    className={`w-full p-3 rounded border transition-colors text-left ${
                      selectedCommit?.hash === commit.hash
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <code className="text-xs text-[var(--text-tertiary)]">
                        {commit.hash.slice(0, 7)}
                      </code>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatTime(commit.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm font-medium mb-1">{commit.message}</div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                      <span>{commit.author}</span>
                      <span>{commit.filesChanged.length} 个文件</span>
                      {commit.linesAdded > 0 && (
                        <span className="text-green-500">+{commit.linesAdded}</span>
                      )}
                      {commit.linesRemoved > 0 && (
                        <span className="text-red-500">-{commit.linesRemoved}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedCommit) {
                  openRollbackDialog(selectedCommit);
                }
              }}
              disabled={!selectedCommit}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              回滚到此提交
            </Button>
            <Button onClick={() => setShowHistory(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 回滚确认对话框 */}
      <Dialog open={rollbackDialog.open} onOpenChange={(open) => setRollbackDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              确认回滚
            </DialogTitle>
            <DialogDescription>
              选择回滚方式并确认操作
            </DialogDescription>
          </DialogHeader>

          {rollbackDialog.commit && (
            <div className="space-y-4 py-4">
              {/* 目标提交信息 */}
              <div className="p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-xs text-[var(--text-tertiary)]">
                    {rollbackDialog.commit.hash.slice(0, 7)}
                  </code>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {formatTime(rollbackDialog.commit.timestamp)}
                  </span>
                </div>
                <div className="text-sm font-medium">{rollbackDialog.commit.message}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                  by {rollbackDialog.commit.author}
                </div>
              </div>

              {/* 回滚方式选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">回滚方式</label>
                
                {/* Revert - 推荐 */}
                <button
                  onClick={() => setRollbackDialog(prev => ({ ...prev, method: 'revert' }))}
                  className={`w-full p-3 rounded border text-left transition-colors ${
                    rollbackDialog.method === 'revert'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-[var(--border-primary)] hover:border-green-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Revert（推荐）</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-500">安全</span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    创建新提交来撤销更改，保留完整历史记录。适合已推送到远程的提交。
                  </p>
                </button>

                {/* Reset Soft */}
                <button
                  onClick={() => setRollbackDialog(prev => ({ ...prev, method: 'reset-soft' }))}
                  className={`w-full p-3 rounded border text-left transition-colors ${
                    rollbackDialog.method === 'reset-soft'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[var(--border-primary)] hover:border-blue-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Undo2 className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Reset (Soft)</span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    回退到指定提交，保留更改在暂存区。适合重新组织提交。
                  </p>
                </button>

                {/* Reset Mixed */}
                <button
                  onClick={() => setRollbackDialog(prev => ({ ...prev, method: 'reset-mixed' }))}
                  className={`w-full p-3 rounded border text-left transition-colors ${
                    rollbackDialog.method === 'reset-mixed'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-[var(--border-primary)] hover:border-yellow-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Undo2 className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium">Reset (Mixed)</span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    回退到指定提交，保留更改在工作区（未暂存）。默认模式。
                  </p>
                </button>

                {/* Reset Hard - 危险 */}
                <button
                  onClick={() => setRollbackDialog(prev => ({ ...prev, method: 'reset-hard', createBackup: true }))}
                  className={`w-full p-3 rounded border text-left transition-colors ${
                    rollbackDialog.method === 'reset-hard'
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-[var(--border-primary)] hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-medium">Reset (Hard)</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-500">危险</span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    回退到指定提交，丢弃所有更改。⚠️ 未提交的更改将永久丢失！
                  </p>
                </button>
              </div>

              {/* Hard Reset 备份选项 */}
              {rollbackDialog.method === 'reset-hard' && (
                <div className="flex items-center justify-between p-3 rounded border border-yellow-500/50 bg-yellow-500/10">
                  <div>
                    <div className="font-medium text-sm">创建备份分支</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      在回滚前创建 backup-{'{timestamp}'} 分支
                    </div>
                  </div>
                  <button
                    onClick={() => setRollbackDialog(prev => ({ ...prev, createBackup: !prev.createBackup }))}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      rollbackDialog.createBackup ? 'bg-green-500' : 'bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        rollbackDialog.createBackup ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* 警告信息 */}
              {rollbackDialog.method === 'reset-hard' && (
                <div className="flex items-start gap-2 p-3 rounded border border-red-500/50 bg-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-400">
                    <strong>警告：</strong>Hard Reset 会永久删除未提交的更改。
                    {!rollbackDialog.createBackup && ' 建议开启备份分支选项。'}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackDialog(prev => ({ ...prev, open: false }))}
              disabled={rollbackDialog.isProcessing}
            >
              取消
            </Button>
            <Button
              onClick={executeRollback}
              disabled={rollbackDialog.isProcessing}
              className={rollbackDialog.method === 'reset-hard' ? 'bg-red-500 hover:bg-red-600' : ''}
            >
              {rollbackDialog.isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-1" />
              )}
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repo Map 对话框 */}
      <Dialog open={showRepoMap} onOpenChange={setShowRepoMap}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="w-5 h-5" />
              仓库映射
            </DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>显示项目的文件结构概览</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <div className="text-sm text-[var(--text-secondary)] space-y-2">
                <p>📂 项目结构概览</p>
                <p className="font-mono text-xs">
                  {projectPath}
                  <br />├─ src/
                  <br />│  ├─ components/
                  <br />│  ├─ hooks/
                  <br />│  └─ lib/
                  <br />├─ public/
                  <br />└─ package.json
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowRepoMap(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GitChangesPanel;
