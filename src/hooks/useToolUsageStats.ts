/**
 * useToolUsageStats - 工具使用统计 Hook
 *
 * 功能：
 * - 记录每个工具的使用次数
 * - 记录最后使用时间
 * - 提供基于使用频率和时间的排序
 * - 数据持久化到 localStorage
 */

import { logger } from "@/lib/logger";
import { useCallback, useEffect, useState } from "react";

export interface ToolUsageStats {
  /** 工具 ID */
  id: string;
  /** 使用次数 */
  count: number;
  /** 最后使用时间（Unix 时间戳） */
  lastUsed: number;
  /** 第一次使用时间 */
  firstUsed: number;
}

interface ToolUsageStatsMap {
  [toolId: string]: ToolUsageStats;
}

const STORAGE_KEY = "fangyu-code-tool-usage-stats";

/**
 * 从 localStorage 读取使用统计
 */
function loadStats(): ToolUsageStatsMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    logger.error("useToolUsageStats", "[useToolUsageStats] Failed to load stats:", error);
    return {};
  }
}

/**
 * 保存使用统计到 localStorage
 */
function saveStats(stats: ToolUsageStatsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    logger.error("useToolUsageStats", "[useToolUsageStats] Failed to save stats:", error);
  }
}

/**
 * 计算工具的综合得分（用于排序）
 * 算法：使用频率 * 0.7 + 时间衰减 * 0.3
 */
function calculateScore(stats: ToolUsageStats): number {
  const now = Date.now();
  const hoursSinceLastUse = (now - stats.lastUsed) / (1000 * 60 * 60);

  // 时间衰减：最近使用的得分更高
  // 1 小时内 = 1.0，24 小时内 = 0.5，7 天内 = 0.2，超过 7 天 = 0.1
  let timeScore = 0.1;
  if (hoursSinceLastUse < 1) {
    timeScore = 1.0;
  } else if (hoursSinceLastUse < 24) {
    timeScore = 0.5;
  } else if (hoursSinceLastUse < 168) {
    // 7 天
    timeScore = 0.2;
  }

  // 使用频率归一化（假设 100 次为满分）
  const frequencyScore = Math.min(stats.count / 100, 1.0);

  // 综合得分（加权平均）
  return frequencyScore * 0.7 + timeScore * 0.3;
}

export function useToolUsageStats() {
  const [stats, setStats] = useState<ToolUsageStatsMap>(loadStats());

  // 同步到 localStorage
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  /**
   * 记录工具使用
   */
  const recordUsage = useCallback((toolId: string) => {
    setStats((prev) => {
      const now = Date.now();
      const existing = prev[toolId];

      return {
        ...prev,
        [toolId]: {
          id: toolId,
          count: (existing?.count || 0) + 1,
          lastUsed: now,
          firstUsed: existing?.firstUsed || now,
        },
      };
    });
  }, []);

  /**
   * 获取工具的使用统计
   */
  const getStats = useCallback(
    (toolId: string): ToolUsageStats | null => {
      return stats[toolId] || null;
    },
    [stats]
  );

  /**
   * 获取所有统计数据
   */
  const getAllStats = useCallback((): ToolUsageStats[] => {
    return Object.values(stats);
  }, [stats]);

  /**
   * 根据使用频率和时间排序工具列表
   * @param items 要排序的工具列表
   * @returns 排序后的工具列表
   */
  const sortByUsage = useCallback(
    <T extends { id: string }>(items: T[]): T[] => {
      return [...items].sort((a, b) => {
        const statsA = stats[a.id];
        const statsB = stats[b.id];

        // 没有统计的排在后面
        if (!statsA && !statsB) return 0;
        if (!statsA) return 1;
        if (!statsB) return -1;

        // 根据综合得分排序
        const scoreA = calculateScore(statsA);
        const scoreB = calculateScore(statsB);

        return scoreB - scoreA; // 降序
      });
    },
    [stats]
  );

  /**
   * 清空所有统计
   */
  const clearStats = useCallback(() => {
    setStats({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * 删除单个工具的统计
   */
  const removeStats = useCallback((toolId: string) => {
    setStats((prev) => {
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
  }, []);

  return {
    stats,
    recordUsage,
    getStats,
    getAllStats,
    sortByUsage,
    clearStats,
    removeStats,
  };
}
