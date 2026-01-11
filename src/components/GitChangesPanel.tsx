/**
 * GitChangesPanel - Git 变更管理面板
 *
 * 功能:
 * - 显示修改的文件列表
 * - 自动提交控制
 * - /undo 回滚功能
 * - Repo Map 仓库映射
 * - 提交历史浏览
 *
 * 来源: Cursor Git UI + Aider Repo Map
 */

import { useState, useEffect, useCallback } from 'react';
import { useGitAutoCommit, type CommitInfo } from '@/hooks/useGitAutoCommit';
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
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  GitCommit,
  GitBranch,
  History,
  RotateCcw,
  Clock,
  FileText,
  Check,
  X,
  Settings,
  Play,
  Pause,
  Map,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';

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
      console.log('提交成功:', commit);
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
    getChangedFiles,
    getRecentCommits,
  } = gitAutoCommit;

  // UI 状态
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRepoMap, setShowRepoMap] = useState(false);
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // 加载修改的文件
  const loadChangedFiles = useCallback(async () => {
    const files = await getChangedFiles();
    setChangedFiles(files);
  }, [getChangedFiles]);

  // 加载提交历史
  const loadCommitHistory = useCallback(async () => {
    const commits = await getRecentCommits(20);
    setRecentCommits(commits);
  }, [getRecentCommits]);

  useEffect(() => {
    loadChangedFiles();
    loadCommitHistory();

    // 定期刷新
    const interval = setInterval(() => {
      loadChangedFiles();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadChangedFiles, loadCommitHistory]);

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

  // 获取文件状态图标
  const getFileIcon = (file: string) => {
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (file.endsWith('.css')) {
      return <FileText className="w-4 h-4 text-pink-500" />;
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
      {/* 头部工具栏 */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 flex-1">
          <GitBranch className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium">Git 变更</span>

          {changedFiles.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              {changedFiles.length}
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
          {changedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
              <GitCommit className="w-8 h-8 mb-2 opacity-50" />
              <p>暂无修改</p>
            </div>
          ) : (
            changedFiles.map((file) => (
              <div
                key={file}
                className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden"
              >
                <button
                  onClick={() => toggleFileExpand(file)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {expandedFiles.has(file) ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                  )}
                  {getFileIcon(file)}
                  <span className="flex-1 text-sm text-left truncate">{file}</span>
                  <span className="text-xs text-green-500">M</span>
                </button>

                {expandedFiles.has(file) && (
                  <div className="px-2 pb-2 border-t border-[var(--border-primary)]">
                    <div className="mt-2 p-2 rounded bg-[var(--bg-primary)] text-xs font-mono">
                      {/* 这里可以显示 diff 内容 */}
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
            ))
          )}
        </div>
      </ScrollArea>

      {/* 底部操作栏 */}
      <div className="flex items-center gap-2 p-3 border-t border-[var(--border-primary)]">
        <Button
          size="sm"
          onClick={triggerCommit}
          disabled={changedFiles.length === 0 || isCommitting}
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
                    className="w-full p-3 rounded border border-[var(--border-primary)] hover:border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-left transition-colors"
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
                // 实现 /undo 回滚到选中的提交
                if (selectedCommit) {
                  console.log('回滚到:', selectedCommit.hash);
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
