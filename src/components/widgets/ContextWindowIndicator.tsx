/**
 * 上下文窗口使用指示器组件
 *
 * 显示当前会话的上下文窗口使用百分比
 * 参考 Claude Code v2.0.64 的 current_usage 功能
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Layers from 'lucide-react/dist/esm/icons/layers'
import Info from 'lucide-react/dist/esm/icons/info'
import Archive from 'lucide-react/dist/esm/icons/archive';
import { Badge } from '@/components/ui/badge';
import { Popover } from '@/components/ui/popover';
import { useContextWindowUsage } from '@/hooks/useContextWindowUsage';
import { USAGE_LEVEL_COLORS } from '@/types/contextWindow';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from '@/types/claude';

// Claude 的 Auto-compact buffer 预留量 (45k tokens)
const AUTO_COMPACT_BUFFER = 45000;

export interface ContextWindowIndicatorProps {
  /** 会话消息列表 */
  messages: ClaudeStreamMessage[];
  /** 当前使用的模型 */
  model?: string;
  /** 引擎类型（claude/codex/gemini） */
  engine?: string;
  /** 是否显示（需要有消息时才显示） */
  show?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 格式化 token 数量为 k 格式
 */
const formatK = (tokens: number): string => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
};

/**
 * 上下文窗口使用指示器
 *
 * 显示一个带有进度条和百分比的 Badge，悬停时显示详细信息
 * 支持多引擎（Claude/Codex）
 */
export const ContextWindowIndicator: React.FC<ContextWindowIndicatorProps> = ({
  messages,
  model,
  engine,
  show = true,
  className,
}) => {
  const { t } = useTranslation();
  const [showPopover, setShowPopover] = React.useState(false);

  const usage = useContextWindowUsage(messages, model, engine);
  const colors = USAGE_LEVEL_COLORS[usage.level];

  // 如果没有数据或不显示，返回 null
  if (!show || !usage.hasData) {
    return null;
  }

  // 计算 Auto-compact 相关数据（仅 Claude 引擎）
  const isClaudeEngine = engine === 'claude';
  const autoCompactThreshold = usage.contextWindowSize - AUTO_COMPACT_BUFFER;
  const autoCompactThresholdPercentage = (autoCompactThreshold / usage.contextWindowSize) * 100;
  const tokensUntilCompact = Math.max(0, autoCompactThreshold - usage.currentTokens);
  const isNearCompact = isClaudeEngine && usage.currentTokens >= autoCompactThreshold * 0.9; // 90% of threshold
  const willTriggerCompact = isClaudeEngine && usage.currentTokens >= autoCompactThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      className={className}
    >
      <Popover
        open={showPopover}
        onOpenChange={setShowPopover}
        trigger={
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 h-8 cursor-default hover:bg-accent transition-colors border-border/50',
              colors.border,
              willTriggerCompact && 'border-amber-400 dark:border-amber-600'
            )}
          >
            <Layers className={cn('h-3 w-3', colors.text)} />
            {/* 迷你进度条 - 带 auto-compact 阈值线 */}
            <div className="progress-glass w-12 h-1.5 relative">
              <div
                className="progress-glass-fill"
                style={{ width: `${Math.min(usage.percentage, 100)}%` }}
              />
              {/* Auto-compact 阈值线（仅 Claude） */}
              {isClaudeEngine && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-amber-500 dark:bg-amber-400"
                  style={{ left: `${autoCompactThresholdPercentage}%` }}
                />
              )}
            </div>
            <span className={cn('font-mono text-xs', colors.text)}>
              {usage.formattedPercentage}
            </span>
            {/* 显示剩余空间（绝对值） */}
            {isClaudeEngine && (
              <>
                <span className="text-xs text-muted-foreground">|</span>
                <span className={cn('font-mono text-xs', colors.text)}>
                  {formatK(tokensUntilCompact)}
                </span>
              </>
            )}
            {/* 显示压缩图标提示即将压缩 */}
            {willTriggerCompact ? (
              <Archive className="h-3 w-3 text-amber-500 animate-pulse ml-0.5" />
            ) : (
              <Info className="h-3 w-3 text-muted-foreground ml-0.5" />
            )}
          </Badge>
        }
        content={
          <div className="space-y-3">
            {/* 标题 */}
            <div className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t('contextWindow.title', '上下文窗口使用情况')}
            </div>

            {/* 进度条 - 带 auto-compact 阈值线 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('contextWindow.usage', '使用率')}
                </span>
                <span className={cn('font-mono font-medium', colors.text)}>
                  {usage.formattedPercentage}
                </span>
              </div>
              {/* 自定义进度条以支持阈值线 */}
              <div className="progress-glass relative h-2 w-full">
                <div
                  className="progress-glass-fill"
                  style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                />
                {/* Auto-compact 阈值线（仅 Claude） */}
                {isClaudeEngine && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500 dark:bg-amber-400 z-10"
                    style={{ left: `${autoCompactThresholdPercentage}%` }}
                    title={`Auto-compact 阈值: ${formatK(autoCompactThreshold)}`}
                  />
                )}
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {usage.formattedTokens}
              </div>
            </div>

            {/* Auto-compact Buffer 信息（仅 Claude 引擎） */}
            {isClaudeEngine && (
              <div className={cn(
                "p-2 rounded-md border text-xs",
                willTriggerCompact
                  ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                  : isNearCompact
                    ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                    : "bg-muted/50 border-border"
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Archive className={cn(
                    "h-3.5 w-3.5",
                    willTriggerCompact
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium",
                    willTriggerCompact
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-foreground"
                  )}>
                    Auto-compact Buffer
                  </span>
                </div>
                <div className="space-y-1 pl-5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">预留空间:</span>
                    <span className="font-mono">{formatK(AUTO_COMPACT_BUFFER)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">压缩阈值:</span>
                    <span className="font-mono">{formatK(autoCompactThreshold)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">距离压缩:</span>
                    <span className={cn(
                      "font-mono",
                      willTriggerCompact
                        ? "text-amber-600 dark:text-amber-400 font-medium"
                        : isNearCompact
                          ? "text-yellow-600 dark:text-yellow-400"
                          : ""
                    )}>
                      {willTriggerCompact ? '即将触发' : formatK(tokensUntilCompact)}
                    </span>
                  </div>
                </div>
                {willTriggerCompact && (
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                    上下文已达压缩阈值，将自动优化
                  </div>
                )}
              </div>
            )}

            {/* Token 详情 */}
            <div className="space-y-1 text-xs border-t pt-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {t('contextWindow.inputTokens', '输入 Tokens')}:
                </span>
                <span className="font-mono">
                  {usage.breakdown.inputTokens.toLocaleString()}
                </span>
              </div>
              {usage.breakdown.cacheCreationTokens > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {t('contextWindow.cacheCreation', '缓存创建')}:
                  </span>
                  <span className="font-mono">
                    {usage.breakdown.cacheCreationTokens.toLocaleString()}
                  </span>
                </div>
              )}
              {usage.breakdown.cacheReadTokens > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {t('contextWindow.cacheRead', '缓存读取')}:
                  </span>
                  <span className="font-mono">
                    {usage.breakdown.cacheReadTokens.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                <span className="text-muted-foreground">
                  {t('contextWindow.outputTokens', '输出 Tokens')}:
                </span>
                <span className="font-mono text-muted-foreground">
                  {usage.breakdown.outputTokens.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 提示信息 */}
            {usage.level === 'critical' && !isClaudeEngine && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {t('contextWindow.criticalWarning', '上下文窗口接近上限，建议开始新会话')}
              </div>
            )}
            {usage.level === 'high' && !isClaudeEngine && (
              <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                {t('contextWindow.highWarning', '上下文使用率较高')}
              </div>
            )}
          </div>
        }
        side="top"
        align="center"
        className="w-[min(18rem,calc(100vw-2rem))]"
        usePortal={true}
        viewportPadding={16}
      />
    </motion.div>
  );
};

export default ContextWindowIndicator;
