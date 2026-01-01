/**
 * TodayUsagePopover - 今日消耗统计弹出面板
 *
 * 功能：
 * - 点击按钮显示今日 0-23 点的 Token 消耗和费用
 * - 简洁的柱状图可视化
 * - 显示总计和平均值
 * - 支持深色模式
 */

import React, { useMemo } from "react";
import { Calendar, TrendingUp, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getHourlyDataForDate } from "@/hooks/useHourlyUsageTracker";

interface TodayUsagePopoverProps {
  /** 是否有消息（控制按钮显示） */
  hasMessages?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface HourlyData {
  hour: number;
  cost: number;
  tokens: number;
  count: number;
}

/**
 * 格式化费用
 */
const formatCost = (cost: number): string => {
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(4)}`;
};

/**
 * 格式化 Token 数量
 */
const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
};

/**
 * 获取今日日期字符串 (YYYY-MM-DD)
 */
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const TodayUsagePopover: React.FC<TodayUsagePopoverProps> = ({
  hasMessages = true,
  className,
}) => {
  // 获取今日的小时级数据
  const todayData = useMemo(() => {
    const today = getTodayDateString();
    const data = getHourlyDataForDate(today); // 返回 { "0": {...}, "1": {...}, ... }

    // 生成完整的 24 小时数据数组
    const fullData: HourlyData[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = hour.toString();
      const hourData = data[hourKey];
      fullData.push(
        hourData
          ? { hour, cost: hourData.cost, tokens: hourData.tokens, count: hourData.count }
          : { hour, cost: 0, tokens: 0, count: 0 }
      );
    }
    return fullData;
  }, []);

  // 计算统计数据
  const stats = useMemo(() => {
    const totalCost = todayData.reduce((sum, d) => sum + d.cost, 0);
    const totalTokens = todayData.reduce((sum, d) => sum + d.tokens, 0);
    const totalCount = todayData.reduce((sum, d) => sum + d.count, 0);
    const activeHours = todayData.filter(d => d.cost > 0).length;
    const avgCostPerHour = activeHours > 0 ? totalCost / activeHours : 0;
    const maxCost = Math.max(...todayData.map(d => d.cost));

    return { totalCost, totalTokens, totalCount, activeHours, avgCostPerHour, maxCost };
  }, [todayData]);

  // 当前小时
  const currentHour = new Date().getHours();

  if (!hasMessages) return null;

  // 触发按钮
  const triggerButton = (
    <Button
      variant="outline"
      size="default"
      className={cn(
        "gap-2 h-8 transition-all",
        "border-border/50 bg-background/50 hover:bg-accent/50",
        className
      )}
      title="今日消耗统计"
    >
      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
      <span className="text-xs">今日</span>
      {stats.totalCost > 0 && (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {formatCost(stats.totalCost)}
        </span>
      )}
    </Button>
  );

  // 弹出内容
  const popoverContent = (
    <div className="space-y-4">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-sm">今日消耗统计</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {getTodayDateString()}
            </span>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Zap className="h-3 w-3" />
                <span className="text-xs text-muted-foreground">费用</span>
              </div>
              <div className="font-semibold text-sm mt-1">
                {formatCost(stats.totalCost)}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs text-muted-foreground">Token</span>
              </div>
              <div className="font-semibold text-sm mt-1">
                {formatTokens(stats.totalTokens)}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
                <Clock className="h-3 w-3" />
                <span className="text-xs text-muted-foreground">活跃</span>
              </div>
              <div className="font-semibold text-sm mt-1">
                {stats.activeHours}h
              </div>
            </div>
          </div>

          {/* 24小时柱状图 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>24小时分布</span>
              {stats.avgCostPerHour > 0 && (
                <span>平均: {formatCost(stats.avgCostPerHour)}/h</span>
              )}
            </div>
            <div className="flex items-end gap-0.5 h-16 bg-muted/30 rounded p-1">
              {todayData.map((hourData) => {
                const heightPercent = stats.maxCost > 0
                  ? (hourData.cost / stats.maxCost) * 100
                  : 0;
                const isCurrentHour = hourData.hour === currentHour;
                const hasData = hourData.cost > 0;

                return (
                  <div
                    key={hourData.hour}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* 柱子 */}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        hasData
                          ? isCurrentHour
                            ? "bg-emerald-500"
                            : "bg-emerald-400/70 dark:bg-emerald-500/70"
                          : isCurrentHour
                            ? "bg-muted-foreground/30"
                            : "bg-muted-foreground/10",
                        "min-h-[2px]"
                      )}
                      style={{
                        height: hasData ? `${Math.max(heightPercent, 8)}%` : '2px'
                      }}
                    />

                    {/* Tooltip */}
                    {hasData && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-lg pointer-events-none">
                        <div className="font-medium">{hourData.hour}:00</div>
                        <div className="text-emerald-600 dark:text-emerald-400">
                          {formatCost(hourData.cost)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatTokens(hourData.tokens)} tokens
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 时间刻度 */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>

      {/* 底部提示 */}
      {stats.totalCount === 0 && (
        <div className="text-center text-xs text-muted-foreground py-2">
          今日暂无使用记录
        </div>
      )}
    </div>
  );

  return (
    <Popover
      trigger={triggerButton}
      content={popoverContent}
      side="top"
      align="end"
      className="w-[min(20rem,calc(100vw-2rem))] p-0"
      usePortal={true}
      viewportPadding={16}
    />
  );
};

export default TodayUsagePopover;
