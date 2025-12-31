/**
 * CheckpointDiff - 检查点对比组件
 *
 * 功能:
 * - 显示两个检查点之间的差异
 * - 文件级别的变更列表
 * - 支持展开查看详细 diff
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileDiff,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  FileEdit,
  File,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Checkpoint, CheckpointFile } from '@/lib/api';

interface FileDiffInfo {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  oldHash?: string;
  newHash?: string;
}

interface CheckpointDiffProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromCheckpoint: Checkpoint | null;
  toCheckpoint: Checkpoint | null;
  className?: string;
}

export function CheckpointDiff({
  open,
  onOpenChange,
  fromCheckpoint,
  toCheckpoint,
  className,
}: CheckpointDiffProps) {
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<FileDiffInfo[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // 计算差异
  useEffect(() => {
    if (!open || !fromCheckpoint || !toCheckpoint) {
      setDiffs([]);
      return;
    }

    setLoading(true);

    // 创建文件映射
    const fromFiles = new Map<string, CheckpointFile>();
    const toFiles = new Map<string, CheckpointFile>();

    fromCheckpoint.files.forEach((f) => fromFiles.set(f.path, f));
    toCheckpoint.files.forEach((f) => toFiles.set(f.path, f));

    const allPaths = new Set([...fromFiles.keys(), ...toFiles.keys()]);
    const diffResults: FileDiffInfo[] = [];

    allPaths.forEach((path) => {
      const fromFile = fromFiles.get(path);
      const toFile = toFiles.get(path);

      if (!fromFile && toFile) {
        // 新增文件
        diffResults.push({
          path,
          status: 'added',
          newHash: toFile.content_hash,
        });
      } else if (fromFile && !toFile) {
        // 删除文件
        diffResults.push({
          path,
          status: 'deleted',
          oldHash: fromFile.content_hash,
        });
      } else if (fromFile && toFile && fromFile.content_hash !== toFile.content_hash) {
        // 修改文件
        diffResults.push({
          path,
          status: 'modified',
          oldHash: fromFile.content_hash,
          newHash: toFile.content_hash,
        });
      }
    });

    // 按状态和路径排序
    diffResults.sort((a, b) => {
      const statusOrder = { added: 0, modified: 1, deleted: 2, unchanged: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.path.localeCompare(b.path);
    });

    setDiffs(diffResults);
    setLoading(false);
  }, [open, fromCheckpoint, toCheckpoint]);

  // 获取状态图标
  const getStatusIcon = (status: FileDiffInfo['status']) => {
    switch (status) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'deleted':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified':
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: FileDiffInfo['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-600 bg-green-500/10';
      case 'deleted':
        return 'text-red-600 bg-red-500/10';
      case 'modified':
        return 'text-yellow-600 bg-yellow-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  // 获取状态标签
  const getStatusLabel = (status: FileDiffInfo['status']) => {
    switch (status) {
      case 'added':
        return '新增';
      case 'deleted':
        return '删除';
      case 'modified':
        return '修改';
      default:
        return '未变';
    }
  };

  // 切换展开状态
  const toggleExpanded = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // 统计数据
  const stats = {
    added: diffs.filter((d) => d.status === 'added').length,
    modified: diffs.filter((d) => d.status === 'modified').length,
    deleted: diffs.filter((d) => d.status === 'deleted').length,
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!fromCheckpoint || !toCheckpoint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-2xl max-h-[80vh]', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDiff className="h-5 w-5" />
            检查点对比
          </DialogTitle>
        </DialogHeader>

        {/* 对比信息 */}
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 rounded-lg text-sm">
          <div className="flex-1">
            <div className="text-muted-foreground text-xs">从</div>
            <div className="font-medium truncate">
              {fromCheckpoint.name || `检查点 ${fromCheckpoint.id.slice(0, 8)}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime(fromCheckpoint.created_at)}
            </div>
          </div>

          <div className="text-muted-foreground">→</div>

          <div className="flex-1">
            <div className="text-muted-foreground text-xs">到</div>
            <div className="font-medium truncate">
              {toCheckpoint.name || `检查点 ${toCheckpoint.id.slice(0, 8)}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime(toCheckpoint.created_at)}
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">变更统计:</span>
          {stats.added > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <Plus className="h-3.5 w-3.5" />
              {stats.added} 新增
            </span>
          )}
          {stats.modified > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <FileEdit className="h-3.5 w-3.5" />
              {stats.modified} 修改
            </span>
          )}
          {stats.deleted > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-3.5 w-3.5" />
              {stats.deleted} 删除
            </span>
          )}
          {diffs.length === 0 && !loading && (
            <span className="text-muted-foreground">无变更</span>
          )}
        </div>

        {/* 差异列表 */}
        <div className="overflow-y-auto max-h-72 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>计算差异中...</span>
            </div>
          ) : diffs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileDiff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <span>两个检查点之间没有文件差异</span>
            </div>
          ) : (
            <AnimatePresence>
              {diffs.map((diff, index) => (
                <motion.div
                  key={diff.path}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="rounded-lg border"
                >
                  <button
                    onClick={() => toggleExpanded(diff.path)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors text-left"
                  >
                    {expandedFiles.has(diff.path) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    {getStatusIcon(diff.status)}

                    <span className="flex-1 text-sm font-mono truncate">{diff.path}</span>

                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-xs',
                        getStatusColor(diff.status)
                      )}
                    >
                      {getStatusLabel(diff.status)}
                    </span>
                  </button>

                  {/* 展开的详细信息 */}
                  <AnimatePresence>
                    {expandedFiles.has(diff.path) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-8 pb-3 text-xs text-muted-foreground space-y-1">
                          {diff.oldHash && (
                            <div>
                              <span className="text-red-500">- 旧版本:</span>{' '}
                              <span className="font-mono">{diff.oldHash.slice(0, 12)}...</span>
                            </div>
                          )}
                          {diff.newHash && (
                            <div>
                              <span className="text-green-500">+ 新版本:</span>{' '}
                              <span className="font-mono">{diff.newHash.slice(0, 12)}...</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CheckpointDiff;
