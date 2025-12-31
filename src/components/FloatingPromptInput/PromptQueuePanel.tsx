/**
 * PromptQueuePanel - 提示词队列可视化面板
 *
 * 功能：
 * - 显示待发送队列
 * - 支持撤回到输入框
 * - 支持插队发送
 * - 支持打包发送
 * - 支持拖拽排序（TODO）
 *
 * @author Fangyu Code
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListOrdered,
  X,
  Undo2,
  Zap,
  Package,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PromptQueueItem, PromptSendMode } from '@/hooks/usePromptQueue';

// ============================================================================
// Type Definitions
// ============================================================================

interface PromptQueuePanelProps {
  /** 队列项列表 */
  items: PromptQueueItem[];
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 当前处理项 ID */
  currentItemId: string | null;
  /** 自动打包开关 */
  autoMerge: boolean;
  /** 撤回到输入框 */
  onRevokeToInput: (itemId: string) => void;
  /** 插队发送 */
  onSendImmediate: (itemId: string) => void;
  /** 删除项 */
  onDelete: (itemId: string) => void;
  /** 移动项位置 */
  onReorder: (itemId: string, newIndex: number) => void;
  /** 更新项模式 */
  onUpdateMode: (itemId: string, mode: PromptSendMode) => void;
  /** 打包发送全部 */
  onSendMerged: () => void;
  /** 清空队列 */
  onClearQueue: () => void;
  /** 设置自动打包 */
  onSetAutoMerge: (enabled: boolean) => void;
  /** 关闭面板 */
  onClose: () => void;
  /** 是否正在执行任务（AI 正在工作） */
  isLoading?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * 队列项状态图标
 */
const StatusIcon: React.FC<{ status: PromptQueueItem['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    case 'sending':
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case 'sent':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    case 'revoked':
      return <Undo2 className="w-3.5 h-3.5 text-gray-400" />;
    default:
      return null;
  }
};

/**
 * 模式标签
 */
const ModeTag: React.FC<{
  mode: PromptSendMode;
  onModeChange?: (mode: PromptSendMode) => void;
  disabled?: boolean;
}> = ({ mode, onModeChange, disabled }) => {
  const modeConfig = {
    sequential: {
      label: '排队',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: ListOrdered,
    },
    interrupt: {
      label: '插队',
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      icon: Zap,
    },
    merge: {
      label: '打包',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      icon: Package,
    },
  };

  const config = modeConfig[mode];
  const Icon = config.icon;

  const handleClick = () => {
    if (disabled || !onModeChange) return;
    // 循环切换模式
    const modes: PromptSendMode[] = ['sequential', 'merge', 'interrupt'];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    onModeChange(nextMode);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
        'transition-all duration-150',
        config.color,
        !disabled && 'hover:opacity-80 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </button>
  );
};

/**
 * 单个队列项
 */
const QueueItem: React.FC<{
  item: PromptQueueItem;
  index: number;
  totalItems: number;
  isLoading?: boolean;
  onRevokeToInput: () => void;
  onSendImmediate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateMode: (mode: PromptSendMode) => void;
}> = ({
  item,
  index,
  totalItems,
  isLoading,
  onRevokeToInput,
  onSendImmediate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateMode,
}) => {
  const isPending = item.status === 'pending';
  const canOperate = isPending;

  // 截取预览文本
  const previewText = item.prompt.length > 60
    ? item.prompt.substring(0, 60) + '...'
    : item.prompt;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group flex items-start gap-2 p-2 rounded-lg border',
        'bg-background/50 hover:bg-background/80',
        'transition-colors duration-150',
        item.status === 'sending' && 'border-blue-500/50 bg-blue-500/5',
        item.status === 'failed' && 'border-red-500/50 bg-red-500/5'
      )}
    >
      {/* 序号和状态 */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span className="text-xs text-muted-foreground font-mono w-5 text-center">
          {index + 1}
        </span>
        <StatusIcon status={item.status} />
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        {/* 模式标签 + Token 估算 */}
        <div className="flex items-center gap-2 mb-1">
          <ModeTag
            mode={item.mode}
            onModeChange={canOperate ? onUpdateMode : undefined}
            disabled={!canOperate}
          />
          {item.estimatedTokens && (
            <span className="text-xs text-muted-foreground">
              ~{item.estimatedTokens} tokens
            </span>
          )}
        </div>

        {/* 提示词预览 */}
        <p className="text-sm text-foreground/80 break-words leading-relaxed">
          {previewText}
        </p>

        {/* 错误信息 */}
        {item.errorMessage && (
          <p className="text-xs text-red-400 mt-1">
            {item.errorMessage}
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className={cn(
        'flex flex-col gap-1 opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150'
      )}>
        {/* 上移/下移 */}
        <div className="flex gap-0.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onMoveUp}
                  disabled={!canOperate || index === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">上移</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onMoveDown}
                  disabled={!canOperate || index === totalItems - 1}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">下移</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 撤回 */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                onClick={onRevokeToInput}
                disabled={!canOperate}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">撤回到输入框</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 插队发送 */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                onClick={onSendImmediate}
                disabled={!canOperate || !isLoading}
              >
                <Zap className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isLoading ? '插队发送（作为指导）' : '当前无任务，直接发送'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 删除 */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                onClick={onDelete}
                disabled={!canOperate}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">删除</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const PromptQueuePanel: React.FC<PromptQueuePanelProps> = ({
  items,
  isProcessing,
  currentItemId,
  autoMerge,
  onRevokeToInput,
  onSendImmediate,
  onDelete,
  onReorder,
  onUpdateMode,
  onSendMerged,
  onClearQueue,
  onSetAutoMerge,
  onClose,
  isLoading = false,
}) => {
  const pendingItems = items.filter(i => i.status === 'pending');
  const mergeItems = items.filter(i => i.status === 'pending' && i.mode === 'merge');

  const handleMoveUp = useCallback((itemId: string, currentIndex: number) => {
    if (currentIndex > 0) {
      onReorder(itemId, currentIndex - 1);
    }
  }, [onReorder]);

  const handleMoveDown = useCallback((itemId: string, currentIndex: number) => {
    const pendingIndices = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.status === 'pending');

    const currentPendingIndex = pendingIndices.findIndex(({ item }) => item.id === itemId);
    if (currentPendingIndex < pendingIndices.length - 1) {
      onReorder(itemId, currentIndex + 1);
    }
  }, [items, onReorder]);

  if (pendingItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute bottom-full left-0 right-0 mb-2 p-4 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <ListOrdered className="w-4 h-4" />
            待发送队列
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          队列为空，发送新提示词时会自动加入队列
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg max-h-[400px] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ListOrdered className="w-4 h-4" />
          待发送队列
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
            {pendingItems.length}
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {/* 打包发送按钮 */}
          {mergeItems.length > 1 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
                    onClick={onSendMerged}
                    disabled={isLoading}
                  >
                    <Package className="w-3.5 h-3.5" />
                    打包发送 ({mergeItems.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  将 {mergeItems.length} 条「打包」模式的指令合并发送
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* 清空队列 */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                  onClick={onClearQueue}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>清空队列</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* 关闭按钮 */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Queue Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {pendingItems.map((item, index) => (
            <QueueItem
              key={item.id}
              item={item}
              index={index}
              totalItems={pendingItems.length}
              isLoading={isLoading}
              onRevokeToInput={() => onRevokeToInput(item.id)}
              onSendImmediate={() => onSendImmediate(item.id)}
              onDelete={() => onDelete(item.id)}
              onMoveUp={() => handleMoveUp(item.id, index)}
              onMoveDown={() => handleMoveDown(item.id, index)}
              onUpdateMode={(mode) => onUpdateMode(item.id, mode)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer - 提示信息 */}
      <div className="p-2 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {isLoading ? (
            <>
              <Zap className="w-3 h-3 inline mr-1 text-amber-500" />
              AI 正在工作，可点击「插队」发送指导/纠正
            </>
          ) : (
            <>
              <Send className="w-3 h-3 inline mr-1" />
              点击模式标签可切换：排队 → 打包 → 插队
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
};

export default PromptQueuePanel;
