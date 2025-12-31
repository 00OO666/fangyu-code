/**
 * 上下文窗口使用情况类型定义
 *
 * 参考 Claude Code v2.0.64 的 current_usage 功能
 * 用于计算和显示上下文窗口使用百分比
 */

/**
 * 上下文窗口使用情况
 */
export interface ContextWindowUsage {
  /** 当前上下文使用的 tokens（输入 + 缓存创建 + 缓存读取） */
  currentTokens: number;
  /** 上下文窗口总大小 */
  contextWindowSize: number;
  /** 使用百分比 (0-100) */
  percentage: number;
  /** 详细 token 分解 */
  breakdown: {
    /** 输入 tokens */
    inputTokens: number;
    /** 输出 tokens */
    outputTokens: number;
    /** 缓存创建 tokens */
    cacheCreationTokens: number;
    /** 缓存读取 tokens */
    cacheReadTokens: number;
  };
}

/**
 * 上下文使用级别
 * - low: 0-60% (绿色)
 * - medium: 60-80% (黄色)
 * - high: 80-90% (橙色)
 * - critical: 90-100% (红色)
 */
export type ContextUsageLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 根据百分比获取使用级别
 * @param percentage - 使用百分比 (0-100)
 * @returns 使用级别
 */
export function getUsageLevel(percentage: number): ContextUsageLevel {
  if (percentage >= 90) return 'critical';
  if (percentage >= 80) return 'high';
  if (percentage >= 60) return 'medium';
  return 'low';
}

/**
 * 使用级别对应的颜色配置
 */
export const USAGE_LEVEL_COLORS = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    progress: 'bg-green-500',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    progress: 'bg-yellow-500',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    progress: 'bg-orange-500',
  },
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    progress: 'bg-red-500',
  },
} as const;
