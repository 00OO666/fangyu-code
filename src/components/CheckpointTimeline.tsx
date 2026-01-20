/**
 * CheckpointTimeline - 检查点时间线组件
 *
 * 功能:
 * - 显示会话的检查点历史
 * - 支持回滚到指定检查点
 * - 支持删除检查点
 * - 可视化时间线展示
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Undo2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCode,
  Wrench,
  Hand,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, Checkpoint, CheckpointType } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CheckpointTimelineProps {
  sessionId: string;
  projectPath: string;
  onRestore?: (checkpoint: Checkpoint) => void;
  className?: string;
}

export function CheckpointTimeline({
  sessionId,
  projectPath,
  onRestore,
  className,
}: CheckpointTimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Checkpoint | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Checkpoint | null>(null);

  // 加载检查点列表
  const loadCheckpoints = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.listCheckpoints(sessionId);
      setCheckpoints(data || []);
    } catch (err) {
      logger.error('CheckpointTimeline', 'Failed to load checkpoints:', err);
      setError(err instanceof Error ? err.message : 'Failed to load checkpoints');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadCheckpoints();
  }, [loadCheckpoints]);

  // 恢复检查点
  const handleRestore = async (checkpoint: Checkpoint) => {
    try {
      setRestoringId(checkpoint.id);
      const restoredFiles = await api.restoreCheckpoint(
        sessionId,
        checkpoint.id,
        projectPath
      );
      logger.debug('CheckpointTimeline', 'Restored files:', restoredFiles);
      onRestore?.(checkpoint);
      setConfirmRestore(null);
    } catch (err) {
      logger.error('CheckpointTimeline', 'Failed to restore checkpoint:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore checkpoint');
    } finally {
      setRestoringId(null);
    }
  };

  // 删除检查点
  const handleDelete = async (checkpoint: Checkpoint) => {
    try {
      setDeletingId(checkpoint.id);
      await api.deleteCheckpoint(sessionId, checkpoint.id);
      setCheckpoints((prev) => prev.filter((c) => c.id !== checkpoint.id));
      setConfirmDelete(null);
    } catch (err) {
      logger.error('CheckpointTimeline', 'Failed to delete checkpoint:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete checkpoint');
    } finally {
      setDeletingId(null);
    }
  };

  // 获取检查点类型图标
  const getTypeIcon = (type: CheckpointType) => {
    switch (type) {
      case 'auto':
        return <Zap className="h-3.5 w-3.5 text-yellow-500" />;
      case 'manual':
        return <Hand className="h-3.5 w-3.5 text-blue-500" />;
      case 'tool_call':
        return <Wrench className="h-3.5 w-3.5 text-purple-500" />;
      default:
        return <History className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  // 获取检查点类型标签
  const getTypeLabel = (type: CheckpointType) => {
    switch (type) {
      case 'auto':
        return '自动';
      case 'manual':
        return '手动';
      case 'tool_call':
        return '工具调用';
      default:
        return type;
    }
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!sessionId) return null;

  return (
    <div className={cn('', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 px-2"
          >
            <span className="flex items-center gap-1.5">
              <History className="h-4 w-4" />
              <span className="text-xs">检查点</span>
              {checkpoints.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({checkpoints.length})
                </span>
              )}
            </span>
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto px-1">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 py-4 text-destructive text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : checkpoints.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                暂无检查点
              </div>
            ) : (
              <AnimatePresence>
                {checkpoints.map((checkpoint, index) => (
                  <motion.div
                    key={checkpoint.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                  >
                    {/* 时间线连接线 */}
                    {index < checkpoints.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                    )}

                    <div className="flex items-start gap-2 py-1.5 group">
                      {/* 时间线节点 */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border">
                        {getTypeIcon(checkpoint.checkpoint_type)}
                      </div>

                      {/* 检查点信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">
                            {checkpoint.name || `检查点 #${index + 1}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground px-1 py-0.5 bg-muted rounded">
                            {getTypeLabel(checkpoint.checkpoint_type)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(checkpoint.created_at)}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <FileCode className="h-3 w-3" />
                            {checkpoint.files.length} 文件
                          </span>
                        </div>

                        {checkpoint.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {checkpoint.description}
                          </p>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setConfirmRestore(checkpoint)}
                          disabled={restoringId === checkpoint.id}
                        >
                          {restoringId === checkpoint.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Undo2 className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(checkpoint)}
                          disabled={deletingId === checkpoint.id}
                        >
                          {deletingId === checkpoint.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 恢复确认对话框 */}
      <AlertDialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复检查点</AlertDialogTitle>
            <AlertDialogDescription>
              将恢复到检查点 "{confirmRestore?.name || `#${checkpoints.indexOf(confirmRestore!) + 1}`}"。
              这将覆盖当前的文件内容。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              className="bg-primary"
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除检查点</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除检查点 "{confirmDelete?.name || `#${checkpoints.indexOf(confirmDelete!) + 1}`}" 吗？
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CheckpointTimeline;
