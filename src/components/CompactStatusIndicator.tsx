/**
 * 压缩状态指示器 - 微妙的 UI 提示
 *
 * 设计原则（Invisible UX）：
 * 1. 平时完全不显示，只在压缩时显示微妙的指示器
 * 2. 不打断用户操作，用户可以继续输入
 * 3. 压缩完成后自动淡出，无需用户操作
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { CompactStatus } from '@/hooks/useBackgroundCompact';

interface CompactStatusIndicatorProps {
  /** 当前压缩状态 */
  status: CompactStatus;
  /** 压缩进度（0-100） */
  progress: number;
  /** 增量消息数量 */
  deltaMessagesCount: number;
  /** 是否正在压缩 */
  isCompacting: boolean;
  /** 类名 */
  className?: string;
}

export const CompactStatusIndicator: React.FC<CompactStatusIndicatorProps> = ({
  status,
  progress,
  deltaMessagesCount,
  isCompacting,
  className,
}) => {
  // 只在压缩时或切换时显示
  const shouldShow = isCompacting || status === 'switching';

  // 状态配置
  const getStatusConfig = () => {
    switch (status) {
      case 'preparing':
        return {
          icon: Loader2,
          text: '准备压缩',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
        };
      case 'compacting':
        return {
          icon: Loader2,
          text: '后台压缩中',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
        };
      case 'merging':
        return {
          icon: Loader2,
          text: '合并消息',
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
        };
      case 'switching':
        return {
          icon: Check,
          text: '切换完成',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: '压缩失败',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
        };
      default:
        return {
          icon: Loader2,
          text: '空闲',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          borderColor: 'border-muted/30',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn('flex items-center', className)}
        >
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 h-7',
              config.borderColor,
              config.bgColor,
              config.color
            )}
          >
            <Icon
              className={cn(
                'h-3 w-3',
                (status === 'preparing' || status === 'compacting' || status === 'merging') &&
                  'animate-spin'
              )}
            />
            <span className="font-mono text-xs">{config.text}</span>

            {/* 显示进度 */}
            {isCompacting && progress > 0 && progress < 100 && (
              <span className="text-xs opacity-60">({progress}%)</span>
            )}

            {/* 显示增量消息数量 */}
            {deltaMessagesCount > 0 && status !== 'switching' && (
              <span className="text-xs opacity-60">+{deltaMessagesCount}</span>
            )}
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompactStatusIndicator;
