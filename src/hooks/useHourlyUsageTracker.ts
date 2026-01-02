/**
 * ✨ 真实每小时使用数据追踪 Hook
 *
 * 功能：
 * - 监听 sessionStats 变化，实时记录每小时的 token 消耗
 * - 数据存储在 localStorage，按日期+小时分组
 * - 自动清理 30 天以前的记录
 * - 提供查询接口获取指定日期的 24 小时数据
 *
 * 数据结构：
 * {
 *   "2025-12-30": {
 *     "0": { cost: 0.001, tokens: 100, count: 1 },
 *     "1": { cost: 0.002, tokens: 150, count: 2 },
 *     ...
 *   }
 * }
 */

import { useEffect, useRef } from "react";
import type { SessionCostStats } from "@/hooks/useSessionCostCalculation";

const STORAGE_KEY = "hourly_usage_tracking";

export interface HourlyUsageData {
  cost: number;
  tokens: number;
  count: number; // 操作次数
}

export interface DailyHourlyData {
  [hour: string]: HourlyUsageData; // "0" - "23"
}

export interface HourlyUsageStorage {
  [date: string]: DailyHourlyData; // "YYYY-MM-DD"
}

/**
 * 获取当前日期和小时
 */
function getCurrentDateHour(): { date: string; hour: number } {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const hour = now.getHours(); // 0-23
  return { date, hour };
}

/**
 * 从 localStorage 读取数据
 */
function loadHourlyData(): HourlyUsageStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("[useHourlyUsageTracker] Failed to load data:", error);
    return {};
  }
}

/**
 * 保存数据到 localStorage
 */
function saveHourlyData(data: HourlyUsageStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("[useHourlyUsageTracker] Failed to save data:", error);
  }
}

/**
 * 清理 30 天以前的记录
 */
function cleanupOldRecords(data: HourlyUsageStorage): HourlyUsageStorage {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const cleaned: HourlyUsageStorage = {};

  Object.entries(data).forEach(([date, hourlyData]) => {
    const dateTimestamp = new Date(date).getTime();
    if (dateTimestamp >= thirtyDaysAgo) {
      cleaned[date] = hourlyData;
    }
  });

  return cleaned;
}

/**
 * 记录当前小时的使用增量
 */
function recordUsageDelta(costDelta: number, tokensDelta: number): void {
  if (costDelta <= 0 && tokensDelta <= 0) return;

  const { date, hour } = getCurrentDateHour();
  const hourKey = hour.toString();

  // 读取现有数据
  let storage = loadHourlyData();

  // 初始化日期
  if (!storage[date]) {
    storage[date] = {};
  }

  // 初始化小时
  if (!storage[date][hourKey]) {
    storage[date][hourKey] = {
      cost: 0,
      tokens: 0,
      count: 0,
    };
  }

  // 累加增量
  storage[date][hourKey].cost += costDelta;
  storage[date][hourKey].tokens += tokensDelta;
  storage[date][hourKey].count += 1;

  // 清理旧记录
  storage = cleanupOldRecords(storage);

  // 保存
  saveHourlyData(storage);

  console.log("[useHourlyUsageTracker] 📊 记录增量:", {
    date,
    hour,
    costDelta,
    tokensDelta,
    totalCost: storage[date][hourKey].cost,
    totalTokens: storage[date][hourKey].tokens,
  });
}

/**
 * Hook: 监听 sessionStats 变化并自动记录
 *
 * 🔧 修复：跳过首次加载时的错误增量
 * - 问题：每次页面加载时，prevCostRef 初始化为 0，导致把整个会话费用当作"增量"
 * - 修复：使用 isInitialized 标记，首次触发时只更新 ref，不记录增量
 */
export function useHourlyUsageTracker(sessionStats: SessionCostStats | null) {
  const prevCostRef = useRef<number>(0);
  const prevTokensRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!sessionStats) return;

    const currentCost = sessionStats.totalCost || 0;
    const currentTokens = sessionStats.totalTokens || 0;

    // 🔧 FIX: 首次触发时，只初始化 ref，不记录增量
    if (!isInitializedRef.current) {
      prevCostRef.current = currentCost;
      prevTokensRef.current = currentTokens;
      isInitializedRef.current = true;
      console.log("[useHourlyUsageTracker] 📊 初始化:", {
        cost: currentCost,
        tokens: currentTokens,
      });
      return;
    }

    // 计算增量
    const costDelta = currentCost - prevCostRef.current;
    const tokensDelta = currentTokens - prevTokensRef.current;

    // 记录增量（只记录正增长，且增量合理）
    // 🔧 FIX: 添加合理性检查，避免异常大的增量
    const isReasonableDelta = costDelta < 10 && tokensDelta < 1000000; // 单次增量 < $10 且 < 100万 tokens

    if ((costDelta > 0 || tokensDelta > 0) && isReasonableDelta) {
      recordUsageDelta(costDelta, tokensDelta);
    } else if (!isReasonableDelta && (costDelta > 0 || tokensDelta > 0)) {
      console.warn("[useHourlyUsageTracker] ⚠️ 异常大的增量，跳过记录:", {
        costDelta,
        tokensDelta,
      });
    }

    // 更新上一次的值
    prevCostRef.current = currentCost;
    prevTokensRef.current = currentTokens;
  }, [sessionStats]);
}

/**
 * 获取指定日期的 24 小时数据
 */
export function getHourlyDataForDate(date: string): DailyHourlyData {
  const storage = loadHourlyData();
  return storage[date] || {};
}

/**
 * 获取指定日期范围的所有数据
 */
export function getHourlyDataForRange(startDate: string, endDate: string): HourlyUsageStorage {
  const storage = loadHourlyData();
  const result: HourlyUsageStorage = {};

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  Object.entries(storage).forEach(([date, hourlyData]) => {
    const dateTimestamp = new Date(date).getTime();
    if (dateTimestamp >= start && dateTimestamp <= end) {
      result[date] = hourlyData;
    }
  });

  return result;
}

/**
 * 手动清理所有数据（调试用）
 */
export function clearAllHourlyData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("[useHourlyUsageTracker] ✅ 所有数据已清除");
  } catch (error) {
    console.error("[useHourlyUsageTracker] Failed to clear data:", error);
  }
}

// 🔧 DEBUG: 注册全局函数
if (typeof window !== "undefined") {
  (window as any).__clearHourlyData = clearAllHourlyData;
  (window as any).__getHourlyData = loadHourlyData;
}

export default useHourlyUsageTracker;
