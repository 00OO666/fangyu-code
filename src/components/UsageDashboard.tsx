import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage } from "@/lib/api";
import type { CodexUsageStats, GeminiUsageStats, EngineType, ModelUsage } from "@/types/usage";
import { ENGINE_COLORS, ENGINE_LABELS } from "@/types/usage";
import { ClaudeIcon } from "@/components/icons/ClaudeIcon";
import { CodexIcon } from "@/components/icons/CodexIcon";
import { GeminiIcon } from "@/components/icons/GeminiIcon";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getHourlyDataForDate } from "@/hooks/useHourlyUsageTracker";
import {
  Calendar,
  Filter,
  Loader2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Layers,
  TrendingUp,
  Zap
} from "lucide-react";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

// Cache for storing fetched data
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache - increased for better performance

/**
 * Optimized UsageDashboard component with caching and progressive loading
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [activeTab, setActiveTab] = useState("overview");
  const [hasLoadedTabs, setHasLoadedTabs] = useState<Set<string>>(new Set(["overview"]));
  // 时间粒度选择：'day' 或 'hour'
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'hour'>('day');
  // 选中的日期（用于查看小时级别数据）
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 小时级别数据（从 sessionStats 计算）
  const [hourlyData, setHourlyData] = useState<{ hour: number; cost: number; tokens: number; count: number }[]>([]);

  // Multi-engine state
  const [selectedEngine, setSelectedEngine] = useState<EngineType | "all">("all");
  const [codexStats, setCodexStats] = useState<CodexUsageStats | null>(null);
  const [geminiStats, setGeminiStats] = useState<GeminiUsageStats | null>(null);

  // Pagination states
  const [projectsPage, setProjectsPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Memoized formatters to prevent recreation on each render
  const formatCurrency = useMemo(() => (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  const formatNumber = useMemo(() => (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  }, []);

  const formatTokens = useMemo(() => (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  }, [formatNumber]);

  const getModelDisplayName = useCallback((model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  }, []);

  // Function to get cached data or null
  const getCachedData = useCallback((key: string) => {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  // Function to set cached data
  const setCachedData = useCallback((key: string, data: any) => {
    dataCache.set(key, { data, timestamp: Date.now() });
  }, []);

  const loadUsageStats = useCallback(async () => {
    const cacheKey = `usage-${selectedDateRange}`;

    // Check cache first
    const cachedStats = getCachedData(`${cacheKey}-stats`);
    const cachedSessions = getCachedData(`${cacheKey}-sessions`);
    const cachedCodex = getCachedData(`${cacheKey}-codex`);
    const cachedGemini = getCachedData(`${cacheKey}-gemini`);

    if (cachedStats && cachedSessions && cachedCodex !== undefined && cachedGemini !== undefined) {
      setStats(cachedStats);
      setSessionStats(cachedSessions);
      setCodexStats(cachedCodex);
      setGeminiStats(cachedGemini);
      setLoading(false);
      return;
    }

    try {
      // Always show loading when fetching
      setLoading(true);
      setError(null);

      // Get today's date range
      const today = new Date();
      // 🚀 修复时区问题：使用本地日期格式而不是 ISO 字符串
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      let statsData: UsageStats;
      let sessionData: ProjectUsage[] = [];
      let startDateStr: string | undefined;
      let endDateStr: string | undefined;

      if (selectedDateRange === "today") {
        // Today only - 使用本地日期字符串避免时区问题
        const todayDateStr = formatLocalDate(today);
        startDateStr = todayDateStr;
        endDateStr = todayDateStr;
        const [statsResult, sessionResult] = await Promise.all([
          api.getUsageByDateRange(todayDateStr, todayDateStr),
          api.getSessionStats()
        ]);
        statsData = statsResult;
        sessionData = sessionResult;
      } else if (selectedDateRange === "all") {
        // Fetch all data in parallel
        const [statsResult, sessionResult] = await Promise.all([
          api.getUsageStats(),
          api.getSessionStats()
        ]);
        statsData = statsResult;
        sessionData = sessionResult;
      } else {
        const endDate = new Date();
        const startDate = new Date();
        const days = selectedDateRange === "7d" ? 7 : 30;
        startDate.setDate(startDate.getDate() - days);

        startDateStr = formatLocalDate(startDate);
        endDateStr = formatLocalDate(endDate);

        // 🚀 修复时区问题：统一使用本地日期格式
        const formatDateForSessionApi = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}${month}${day}`;
        };

        // Fetch all data in parallel for better performance
        const [statsResult, sessionResult] = await Promise.all([
          api.getUsageByDateRange(startDateStr, endDateStr),
          api.getSessionStats(
            formatDateForSessionApi(startDate),
            formatDateForSessionApi(endDate),
            'desc'
          )
        ]);

        statsData = statsResult;
        sessionData = sessionResult;
      }

      // Update Claude state
      setStats(statsData);
      setSessionStats(sessionData);

      // Cache Claude data
      setCachedData(`${cacheKey}-stats`, statsData);
      setCachedData(`${cacheKey}-sessions`, sessionData);

      // Fetch Codex and Gemini stats in parallel (non-blocking)
      Promise.allSettled([
        api.getCodexUsageStats(startDateStr, endDateStr),
        api.getGeminiUsageStats(startDateStr, endDateStr),
      ]).then(([codexResult, geminiResult]) => {
        const codexData = codexResult.status === 'fulfilled' ? codexResult.value : null;
        const geminiData = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

        setCodexStats(codexData);
        setGeminiStats(geminiData);

        // Cache multi-engine data
        setCachedData(`${cacheKey}-codex`, codexData);
        setCachedData(`${cacheKey}-gemini`, geminiData);
      });
    } catch (err: any) {
      console.error("Failed to load usage stats:", err);
      setError("Failed to load usage statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange, getCachedData, setCachedData]);  // ⚡ 移除 stats, sessionStats 依赖，避免无限循环

  // Load data on mount and when date range changes
  useEffect(() => {
    // Reset pagination when date range changes
    setProjectsPage(1);
    setSessionsPage(1);
    loadUsageStats();
  }, [loadUsageStats])

  // Preload adjacent tabs when idle
  useEffect(() => {
    if (!stats || loading) return;
    
    const tabOrder = ["overview", "models", "projects", "sessions", "timeline"];
    const currentIndex = tabOrder.indexOf(activeTab);
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const schedulePreload = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 2000 });
      } else {
        setTimeout(callback, 100);
      }
    };
    
    // Preload adjacent tabs
    schedulePreload(() => {
      if (currentIndex > 0) {
        setHasLoadedTabs(prev => new Set([...prev, tabOrder[currentIndex - 1]]));
      }
      if (currentIndex < tabOrder.length - 1) {
        setHasLoadedTabs(prev => new Set([...prev, tabOrder[currentIndex + 1]]));
      }
    });
  }, [activeTab, stats, loading])

  // Aggregate multi-engine statistics
  const aggregatedStats = useMemo(() => {
    const claudeCost = stats?.total_cost || 0;
    const codexCost = codexStats?.total_cost || 0;
    const geminiCost = geminiStats?.total_cost || 0;

    const claudeTokens = stats?.total_tokens || 0;
    const codexTokens = codexStats?.total_tokens || 0;
    const geminiTokens = geminiStats?.total_tokens || 0;

    const claudeSessions = stats?.total_sessions || 0;
    const codexSessions = codexStats?.total_sessions || 0;
    const geminiSessions = geminiStats?.total_sessions || 0;

    // Token breakdown
    const totalInputTokens = (stats?.total_input_tokens || 0) +
                             (codexStats?.total_input_tokens || 0) +
                             (geminiStats?.total_input_tokens || 0);
    const totalOutputTokens = (stats?.total_output_tokens || 0) +
                              (codexStats?.total_output_tokens || 0) +
                              (geminiStats?.total_output_tokens || 0);
    const totalCacheCreation = (stats?.total_cache_creation_tokens || 0) +
                               (codexStats?.total_cache_creation_tokens || 0) +
                               (geminiStats?.total_cache_creation_tokens || 0);
    const totalCacheRead = (stats?.total_cache_read_tokens || 0) +
                           (codexStats?.total_cache_read_tokens || 0) +
                           (geminiStats?.total_cache_read_tokens || 0);

    return {
      totalCost: claudeCost + codexCost + geminiCost,
      totalTokens: claudeTokens + codexTokens + geminiTokens,
      totalSessions: claudeSessions + codexSessions + geminiSessions,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreation,
      totalCacheRead,
      byEngine: [
        { engine: 'claude' as EngineType, cost: claudeCost, tokens: claudeTokens, sessions: claudeSessions },
        { engine: 'codex' as EngineType, cost: codexCost, tokens: codexTokens, sessions: codexSessions },
        { engine: 'gemini' as EngineType, cost: geminiCost, tokens: geminiTokens, sessions: geminiSessions },
      ],
    };
  }, [stats, codexStats, geminiStats]);

  // Get current stats based on selected engine
  const currentStats = useMemo(() => {
    if (selectedEngine === 'all') {
      return {
        total_cost: aggregatedStats.totalCost,
        total_tokens: aggregatedStats.totalTokens,
        total_sessions: aggregatedStats.totalSessions,
        total_input_tokens: aggregatedStats.totalInputTokens,
        total_output_tokens: aggregatedStats.totalOutputTokens,
        total_cache_creation_tokens: aggregatedStats.totalCacheCreation,
        total_cache_read_tokens: aggregatedStats.totalCacheRead,
        by_model: [
          ...(stats?.by_model || []).map(m => ({ ...m, engine: 'claude' as EngineType })),
          ...(codexStats?.by_model || []).map(m => ({ ...m, engine: 'codex' as EngineType })),
          ...(geminiStats?.by_model || []).map(m => ({ ...m, engine: 'gemini' as EngineType })),
        ].sort((a, b) => b.total_cost - a.total_cost),
        by_project: [
          ...(stats?.by_project || []).map(p => ({ ...p, engine: 'claude' as EngineType })),
          ...(codexStats?.by_project || []).map(p => ({ ...p, engine: 'codex' as EngineType })),
          ...(geminiStats?.by_project || []).map(p => ({ ...p, engine: 'gemini' as EngineType })),
        ].sort((a, b) => b.total_cost - a.total_cost),
        by_date: stats?.by_date || [],
      };
    }
    if (selectedEngine === 'claude') return stats;
    if (selectedEngine === 'codex') return codexStats;
    if (selectedEngine === 'gemini') return geminiStats;
    return stats;
  }, [selectedEngine, stats, codexStats, geminiStats, aggregatedStats]);

  // Memoize expensive computations - more compact
  const summaryCards = useMemo(() => {
    if (!currentStats) return null;

    const totalCost = currentStats.total_cost || 0;
    const totalSessions = currentStats.total_sessions || 0;
    const totalTokens = currentStats.total_tokens || 0;

    return (
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-2.5 shimmer-hover">
          <div>
            <p className="text-[10px] text-muted-foreground">{t('usageDashboard.totalCost')}</p>
            <p className="text-lg font-bold mt-0.5">
              {formatCurrency(totalCost)}
            </p>
          </div>
        </Card>

        <Card className="p-2.5 shimmer-hover">
          <div>
            <p className="text-[10px] text-muted-foreground">{t('usageDashboard.totalSessions')}</p>
            <p className="text-lg font-bold mt-0.5">
              {formatNumber(totalSessions)}
            </p>
          </div>
        </Card>

        <Card className="p-2.5 shimmer-hover">
          <div>
            <p className="text-[10px] text-muted-foreground">{t('usageDashboard.totalTokens')}</p>
            <p className="text-lg font-bold mt-0.5">
              {formatTokens(totalTokens)}
            </p>
          </div>
        </Card>

        <Card className="p-2.5 shimmer-hover">
          <div>
            <p className="text-[10px] text-muted-foreground">{t('usageDashboard.averageCostPerSession')}</p>
            <p className="text-lg font-bold mt-0.5">
              {formatCurrency(
                totalSessions > 0
                  ? totalCost / totalSessions
                  : 0
              )}
            </p>
          </div>
        </Card>
      </div>
    );
  }, [currentStats, formatCurrency, formatNumber, formatTokens, t]);

  // Memoize the most used models section
  const mostUsedModels = useMemo(() => {
    if (!currentStats?.by_model) return null;

    return currentStats.by_model.slice(0, 3).map((model: ModelUsage & { engine?: EngineType }) => {
      const engineColor = model.engine ? ENGINE_COLORS[model.engine] : ENGINE_COLORS.claude;
      const EngineIcon = model.engine === 'codex' ? CodexIcon :
                         model.engine === 'gemini' ? GeminiIcon : ClaudeIcon;
      return (
        <div key={`${model.engine || 'claude'}-${model.model}`} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {selectedEngine === 'all' && (
              <EngineIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: engineColor }} />
            )}
            <Badge
              variant="outline"
              className="text-caption"
              style={{ borderColor: selectedEngine === 'all' ? engineColor : undefined }}
            >
              {getModelDisplayName(model.model)}
            </Badge>
            <span className="text-caption text-muted-foreground">
              {model.session_count} sessions
            </span>
          </div>
          <span className="text-body-small font-medium">
            {formatCurrency(model.total_cost)}
          </span>
        </div>
      );
    });
  }, [currentStats, formatCurrency, getModelDisplayName, selectedEngine]);

  // Memoize top projects section
  const topProjects = useMemo(() => {
    if (!currentStats?.by_project) return null;

    return currentStats.by_project.slice(0, 3).map((project: ProjectUsage & { engine?: EngineType }) => {
      const engineColor = project.engine ? ENGINE_COLORS[project.engine] : ENGINE_COLORS.claude;
      const EngineIcon = project.engine === 'codex' ? CodexIcon :
                         project.engine === 'gemini' ? GeminiIcon : ClaudeIcon;
      return (
        <div key={`${project.engine || 'claude'}-${project.project_path}`} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedEngine === 'all' && (
              <EngineIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: engineColor }} />
            )}
            <div className="flex flex-col">
              <span className="text-body-small font-medium truncate max-w-[180px]" title={project.project_path}>
                {project.project_path}
              </span>
              <span className="text-caption text-muted-foreground">
                {project.session_count} sessions
              </span>
            </div>
          </div>
          <span className="text-body-small font-medium">
            {formatCurrency(project.total_cost)}
          </span>
        </div>
      );
    });
  }, [currentStats, formatCurrency, selectedEngine]);

  // Memoize timeline chart data
  const timelineChartData = useMemo(() => {
    const byDate = currentStats?.by_date;
    if (!byDate || byDate.length === 0) return null;

    // 按日期排序（升序，从旧到新）
    const sortedData = [...byDate].sort((a, b) => {
      const dateA = new Date(a.date.replace(/-/g, '/'));
      const dateB = new Date(b.date.replace(/-/g, '/'));
      return dateA.getTime() - dateB.getTime();
    });

    const maxCost = Math.max(...sortedData.map((d: any) => d.total_cost), 0);
    const halfMaxCost = maxCost / 2;

    return {
      maxCost,
      halfMaxCost,
      sortedData,
      bars: sortedData.map((day: any) => ({
        ...day,
        heightPercent: maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0,
        date: new Date(day.date.replace(/-/g, '/')),
        dateStr: day.date,
      }))
    };
  }, [currentStats?.by_date]);

  // 🆕 生成小时级别数据（使用真实记录数据）
  const hourlyChartData = useMemo(() => {
    if (!selectedDate) return null;

    const selectedDateStr = selectedDate;

    // 🎯 从真实记录中读取该日期的 24 小时数据
    const realHourlyData = getHourlyDataForDate(selectedDateStr);

    // 初始化24小时的数据（确保所有小时都有数据）
    const hourlyMap: { [hour: number]: { cost: number; tokens: number; count: number } } = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = realHourlyData[h.toString()] || { cost: 0, tokens: 0, count: 0 };
    }

    // 🆕 如果没有任何真实数据，从 by_date 获取总体数据作为 fallback
    // 这样可以在还没有记录时显示一些提示
    const dayData = currentStats?.by_date?.find((d: any) => d.date === selectedDateStr);
    const hasRealData = Object.values(realHourlyData).some(
      (data) => data.cost > 0 || data.tokens > 0
    );

    // 转换为数组
    const hourlyArray = Object.entries(hourlyMap).map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data
    }));

    const maxCost = Math.max(...hourlyArray.map(h => h.cost), 0.01);
    const halfMaxCost = maxCost / 2;

    return {
      maxCost,
      halfMaxCost,
      selectedDate: selectedDateStr,
      hasRealData, // 🆕 标记是否有真实数据
      totalDayCost: dayData?.total_cost || 0, // 🆕 总费用（用于显示提示）
      bars: hourlyArray.map(h => ({
        ...h,
        heightPercent: maxCost > 0 ? (h.cost / maxCost) * 100 : 0,
      }))
    };
  }, [selectedDate, currentStats?.by_date]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto flex flex-col h-full">
        {/* Compact Header */}
        <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="h-8 gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                关闭
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{t('usageDashboard.title')}</h1>
              </div>
            </div>

            {/* Compact controls in one row */}
            <div className="flex items-center gap-3">
              {/* Date Range Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1">
                  {(["today", "7d", "30d", "all"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={selectedDateRange === range ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDateRange(range)}
                      disabled={loading}
                      className="h-7 text-xs px-2"
                    >
                      {range === "today" ? t('usageDashboard.today') : range === "all" ? t('usageDashboard.all') : range === "7d" ? t('usageDashboard.last7Days') : t('usageDashboard.last30Days')}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Engine Selector */}
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1">
                  <Button
                    variant={selectedEngine === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedEngine("all")}
                    disabled={loading}
                    className="h-7 text-xs px-2"
                  >
                    全部
                  </Button>
                  <Button
                    variant={selectedEngine === "claude" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedEngine("claude")}
                    disabled={loading}
                    className="h-7 text-xs px-2 gap-1"
                    style={{ borderColor: selectedEngine === "claude" ? ENGINE_COLORS.claude : undefined }}
                  >
                    <ClaudeIcon className="h-3 w-3" />
                    Claude
                  </Button>
                  <Button
                    variant={selectedEngine === "codex" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedEngine("codex")}
                    disabled={loading}
                    className="h-7 text-xs px-2 gap-1"
                    style={{ borderColor: selectedEngine === "codex" ? ENGINE_COLORS.codex : undefined }}
                  >
                    <CodexIcon className="h-3 w-3" />
                    Codex
                  </Button>
                  <Button
                    variant={selectedEngine === "gemini" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedEngine("gemini")}
                    disabled={loading}
                    className="h-7 text-xs px-2 gap-1"
                    style={{ borderColor: selectedEngine === "gemini" ? ENGINE_COLORS.gemini : undefined }}
                  >
                    <GeminiIcon className="h-3 w-3" />
                    Gemini
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/50 text-xs text-destructive flex items-center gap-2">
              {error}
              <Button onClick={() => loadUsageStats()} size="sm" className="h-6 text-xs">
                重试
              </Button>
            </div>
          ) : currentStats ? (
            <div className="space-y-4">
              {/* Engine Stats Cards (only show in "all" mode) - more compact */}
              {selectedEngine === "all" && (
                <div className="grid grid-cols-3 gap-2">
                  {aggregatedStats.byEngine.map((engine) => {
                    const EngineIcon = engine.engine === 'claude' ? ClaudeIcon :
                                       engine.engine === 'codex' ? CodexIcon : GeminiIcon;
                    const engineColor = ENGINE_COLORS[engine.engine];
                    return (
                      <Card
                        key={engine.engine}
                        className="p-2.5 cursor-pointer hover:shadow-md transition-shadow"
                        style={{ borderLeft: `3px solid ${engineColor}` }}
                        onClick={() => setSelectedEngine(engine.engine)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <EngineIcon className="h-4 w-4" style={{ color: engineColor }} />
                          <span className="text-sm font-medium">{ENGINE_LABELS[engine.engine]}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs">
                          <div>
                            <p className="text-muted-foreground text-[10px]">成本</p>
                            <p className="font-semibold">{formatCurrency(engine.cost)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">会话</p>
                            <p className="font-semibold">{formatNumber(engine.sessions)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Token</p>
                            <p className="font-semibold">{formatTokens(engine.tokens)}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Summary Cards */}
              {summaryCards}

              {/* Tabs for different views - more compact */}
              <Tabs value={activeTab} onValueChange={(value) => {
                setActiveTab(value);
                setHasLoadedTabs(prev => new Set([...prev, value]));
              }} className="w-full">
                <TabsList className="grid grid-cols-5 w-full mb-3 h-auto p-0.5">
                  <TabsTrigger value="overview" className="py-1.5 px-2 text-xs">{t('common.overview')}</TabsTrigger>
                  <TabsTrigger value="models" className="py-1.5 px-2 text-xs">{t('usage.byModel')}</TabsTrigger>
                  <TabsTrigger value="projects" className="py-1.5 px-2 text-xs">{t('usage.byProject')}</TabsTrigger>
                  <TabsTrigger value="sessions" className="py-1.5 px-2 text-xs">{t('common.sessions')}</TabsTrigger>
                  <TabsTrigger value="timeline" className="py-1.5 px-2 text-xs">{t('common.timeline')}</TabsTrigger>
                </TabsList>

                {/* Overview Tab - compact */}
                <TabsContent value="overview" className="space-y-3 mt-3">
                  <Card className="p-3">
                    <h3 className="text-xs font-medium mb-2">{t('usageDashboard.tokenStats')}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('usageDashboard.inputTokens')}</p>
                        <p className="text-sm font-semibold">{formatTokens(currentStats?.total_input_tokens || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('usageDashboard.outputTokens')}</p>
                        <p className="text-sm font-semibold">{formatTokens(currentStats?.total_output_tokens || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('usageDashboard.cacheWrite')}</p>
                        <p className="text-sm font-semibold">{formatTokens(currentStats?.total_cache_creation_tokens || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('usageDashboard.cacheRead')}</p>
                        <p className="text-sm font-semibold">{formatTokens(currentStats?.total_cache_read_tokens || 0)}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Quick Stats - compact */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="p-3">
                      <h3 className="text-xs font-medium mb-2">{t('usageDashboard.mostUsedModels')}</h3>
                      <div className="space-y-2">
                        {mostUsedModels}
                      </div>
                    </Card>

                    <Card className="p-3">
                      <h3 className="text-xs font-medium mb-2">{t('usageDashboard.topProjects')}</h3>
                      <div className="space-y-2">
                        {topProjects}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* Models Tab - Lazy render and cache - compact */}
                <TabsContent value="models" className="space-y-3 mt-3">
                  {hasLoadedTabs.has("models") && currentStats && (
                    <div style={{ display: activeTab === "models" ? "block" : "none" }}>
                      <Card className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-medium">{t('usageDashboard.modelStats')}</h3>
                          <span className="text-[10px] text-muted-foreground">
                            {currentStats.by_model?.length || 0} 个模型
                          </span>
                        </div>
                        <div className="space-y-2">
                          {(currentStats.by_model || []).map((model: ModelUsage & { engine?: EngineType }) => {
                            const engineColor = model.engine ? ENGINE_COLORS[model.engine] : ENGINE_COLORS.claude;
                            const EngineIcon = model.engine === 'codex' ? CodexIcon :
                                               model.engine === 'gemini' ? GeminiIcon : ClaudeIcon;
                            return (
                              <div key={`${model.engine || 'claude'}-${model.model}`} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    {selectedEngine === 'all' && (
                                      <EngineIcon
                                        className="h-4 w-4 flex-shrink-0"
                                        style={{ color: engineColor }}
                                      />
                                    )}
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                      style={{ borderColor: selectedEngine === 'all' ? engineColor : undefined }}
                                    >
                                      {getModelDisplayName(model.model)}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      {model.session_count} sessions
                                    </span>
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {formatCurrency(model.total_cost)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Input: </span>
                                    <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Output: </span>
                                    <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Cache W: </span>
                                    <span className="font-medium">{formatTokens(model.cache_creation_tokens || 0)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Cache R: </span>
                                    <span className="font-medium">{formatTokens(model.cache_read_tokens || 0)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Projects Tab - Lazy render and cache - compact */}
                <TabsContent value="projects" className="space-y-3 mt-3">
                  {hasLoadedTabs.has("projects") && currentStats && (
                    <div style={{ display: activeTab === "projects" ? "block" : "none" }}>
                      <Card className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-medium">{t('usageDashboard.projectStats')}</h3>
                        <span className="text-[10px] text-muted-foreground">
                          {currentStats.by_project?.length || 0} {t('usageDashboard.totalProjects')}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const projects = currentStats.by_project || [];
                          const startIndex = (projectsPage - 1) * ITEMS_PER_PAGE;
                          const endIndex = startIndex + ITEMS_PER_PAGE;
                          const paginatedProjects = projects.slice(startIndex, endIndex);
                          const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);

                          return (
                            <>
                              {paginatedProjects.map((project: ProjectUsage & { engine?: EngineType }) => {
                                const engineColor = project.engine ? ENGINE_COLORS[project.engine] : ENGINE_COLORS.claude;
                                const EngineIcon = project.engine === 'codex' ? CodexIcon :
                                                   project.engine === 'gemini' ? GeminiIcon : ClaudeIcon;
                                return (
                                  <div key={`${project.engine || 'claude'}-${project.project_path}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                    <div className="flex items-center gap-2 truncate">
                                      {selectedEngine === 'all' && (
                                        <EngineIcon
                                          className="h-4 w-4 flex-shrink-0"
                                          style={{ color: engineColor }}
                                        />
                                      )}
                                      <div className="flex flex-col truncate">
                                        <span className="text-sm font-medium truncate" title={project.project_path}>
                                          {project.project_path}
                                        </span>
                                        <div className="flex items-center space-x-3 mt-1">
                                          <span className="text-caption text-muted-foreground">
                                            {project.session_count} sessions
                                          </span>
                                          <span className="text-caption text-muted-foreground">
                                            {formatTokens(project.total_tokens)} tokens
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold">{formatCurrency(project.total_cost)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatCurrency(project.total_cost / project.session_count)}/session
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Pagination Controls */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                  <span className="text-xs text-muted-foreground">
                                    Showing {startIndex + 1}-{Math.min(endIndex, projects.length)} of {projects.length}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setProjectsPage(prev => Math.max(1, prev - 1))}
                                      disabled={projectsPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm">
                                      Page {projectsPage} of {totalPages}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setProjectsPage(prev => Math.min(totalPages, prev + 1))}
                                      disabled={projectsPage === totalPages}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                          })()}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Sessions Tab - Lazy render and cache - compact */}
                <TabsContent value="sessions" className="space-y-3 mt-3">
                  {hasLoadedTabs.has("sessions") && (
                    <div style={{ display: activeTab === "sessions" ? "block" : "none" }}>
                      <Card className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-medium">{t('usageDashboard.sessionStats')}</h3>
                        {sessionStats && sessionStats.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {sessionStats.length} {t('usageDashboard.totalSessionsCount')}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {sessionStats && sessionStats.length > 0 ? (() => {
                          const startIndex = (sessionsPage - 1) * ITEMS_PER_PAGE;
                          const endIndex = startIndex + ITEMS_PER_PAGE;
                          const paginatedSessions = sessionStats.slice(startIndex, endIndex);
                          const totalPages = Math.ceil(sessionStats.length / ITEMS_PER_PAGE);
                          
                          return (
                            <>
                              {paginatedSessions.map((session, index) => (
                                <div key={`${session.project_path}-${session.project_name}-${startIndex + index}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                  <div className="flex flex-col">
                                    <div className="flex items-center space-x-2">
                                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={session.project_path}>
                                        {session.project_path.split('/').slice(-2).join('/')}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium mt-1">
                                      {session.project_name}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold">{formatCurrency(session.total_cost)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {session.last_used ? new Date(session.last_used).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Pagination Controls */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                  <span className="text-xs text-muted-foreground">
                                    Showing {startIndex + 1}-{Math.min(endIndex, sessionStats.length)} of {sessionStats.length}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSessionsPage(prev => Math.max(1, prev - 1))}
                                      disabled={sessionsPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm">
                                      Page {sessionsPage} of {totalPages}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSessionsPage(prev => Math.min(totalPages, prev + 1))}
                                      disabled={sessionsPage === totalPages}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })() : (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            {t('usageDashboard.noSessionData')}
                          </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Timeline Tab - 现代化设计 */}
                <TabsContent value="timeline" className="space-y-3 mt-3">
                  {hasLoadedTabs.has("timeline") && currentStats && (
                    <div style={{ display: activeTab === "timeline" ? "block" : "none" }}>
                      <Card className="p-4 overflow-hidden relative">
                      {/* 背景装饰 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none" />

                      {/* Header with Time Granularity Selector - 现代化设计 */}
                      <div className="flex items-center justify-between mb-4 relative">
                        <motion.h3
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-sm font-semibold flex items-center gap-2"
                        >
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                            <Calendar className="h-4 w-4 text-blue-500" />
                          </div>
                          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            {timeGranularity === 'day' ? t('usageDashboard.dailyUsage') : '小时用量统计'}
                          </span>
                        </motion.h3>
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2"
                        >
                          {/* 返回日视图按钮 */}
                          <AnimatePresence mode="wait">
                            {timeGranularity === 'hour' && selectedDate && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setTimeGranularity('day');
                                    setSelectedDate(null);
                                  }}
                                  className="h-7 text-xs px-3 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
                                >
                                  <ArrowLeft className="h-3 w-3 mr-1.5" />
                                  返回日视图
                                </Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {/* 时间粒度选择器 - 增强设计 */}
                          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                            <Button
                              variant={timeGranularity === 'day' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                setTimeGranularity('day');
                                setSelectedDate(null);
                              }}
                              className={cn(
                                "h-6 text-xs px-3 rounded-md transition-all",
                                timeGranularity === 'day'
                                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25"
                                  : "hover:bg-background/50"
                              )}
                            >
                              日
                            </Button>
                            <Button
                              variant={timeGranularity === 'hour' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                if (timeGranularity !== 'hour' && timelineChartData && timelineChartData.bars.length > 0) {
                                  const latestDate = timelineChartData.bars[timelineChartData.bars.length - 1].dateStr;
                                  setSelectedDate(latestDate);
                                  setTimeGranularity('hour');
                                }
                              }}
                              disabled={!timelineChartData || timelineChartData.bars.length === 0}
                              className={cn(
                                "h-6 text-xs px-3 rounded-md transition-all",
                                timeGranularity === 'hour'
                                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25"
                                  : "hover:bg-background/50"
                              )}
                            >
                              时
                            </Button>
                          </div>
                        </motion.div>
                      </div>

                      {/* 日视图 - 现代化设计 */}
                      {timeGranularity === 'day' && timelineChartData ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="relative pl-8 pr-3 pb-12"
                        >
                          {/* Y-axis 标签 - 增强设计 */}
                          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] font-medium text-muted-foreground/80">
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(timelineChartData.maxCost)}
                            </motion.span>
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(timelineChartData.halfMaxCost)}
                            </motion.span>
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(0)}
                            </motion.span>
                          </div>

                          {/* 图表容器 - 增强背景 + 顶部留白容纳标签 */}
                          <div className="flex items-end gap-2 h-48 pt-6 border-l-2 border-b-2 border-gradient-to-r from-blue-500/20 to-purple-500/20 pl-3 rounded-bl-lg relative">
                            {/* 背景渐变网格 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent pointer-events-none" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))] pointer-events-none" />

                            {timelineChartData.bars.map((day, index) => {
                              const formattedDate = day.date.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              });

                              // 渐变色：根据高度百分比动态调整
                              const gradientIntensity = Math.min(day.heightPercent / 100, 1);
                              const gradientFrom = `rgba(59, 130, 246, ${0.6 + gradientIntensity * 0.4})`; // blue-500
                              const gradientTo = `rgba(147, 51, 234, ${0.5 + gradientIntensity * 0.5})`; // purple-600

                              return (
                                <motion.div
                                  key={day.dateStr}
                                  initial={{ opacity: 0, scaleY: 0 }}
                                  animate={{ opacity: 1, scaleY: 1 }}
                                  transition={{
                                    duration: 0.5,
                                    delay: index * 0.03,
                                    ease: [0.4, 0, 0.2, 1]
                                  }}
                                  className="flex-1 h-full flex flex-col items-center justify-end group relative"
                                  onClick={() => {
                                    setSelectedDate(day.dateStr);
                                    setTimeGranularity('hour');
                                  }}
                                >
                                  {/* 高级 Tooltip - 玻璃态卡片 */}
                                  <AnimatePresence>
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                      whileHover={{ opacity: 1, scale: 1, y: 0 }}
                                      className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20"
                                    >
                                      <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-4 whitespace-nowrap">
                                        {/* 日期标题 */}
                                        <div className="flex items-center gap-2 border-b border-border/30 pb-2 mb-2">
                                          <Calendar className="h-4 w-4 text-blue-500" />
                                          <p className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                            {formattedDate}
                                          </p>
                                        </div>
                                        {/* 费用 */}
                                        <div className="flex items-center justify-between gap-4 mb-1.5">
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3 text-green-500" />
                                            {t('usageDashboard.cost')}
                                          </span>
                                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            {formatCurrency(day.total_cost)}
                                          </span>
                                        </div>
                                        {/* Token */}
                                        <div className="flex items-center justify-between gap-4 mb-1.5">
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Zap className="h-3 w-3 text-yellow-500" />
                                            Tokens
                                          </span>
                                          <span className="text-sm font-medium">
                                            {formatTokens(day.total_tokens)}
                                          </span>
                                        </div>
                                        {/* 模型数量 */}
                                        <div className="flex items-center justify-between gap-4">
                                          <span className="text-xs text-muted-foreground">模型</span>
                                          <span className="text-sm font-medium">
                                            {day.models_used.length}
                                          </span>
                                        </div>
                                        {/* 提示 */}
                                        <div className="mt-2 pt-2 border-t border-border/30">
                                          <p className="text-xs text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                                            <ArrowLeft className="h-3 w-3 rotate-180" />
                                            点击查看小时统计
                                          </p>
                                        </div>
                                      </div>
                                      {/* Tooltip 箭头 */}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-2">
                                        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-background/95"></div>
                                      </div>
                                    </motion.div>
                                  </AnimatePresence>

                                  {/* 💰 费用标签 - 始终可见 */}
                                  {day.heightPercent > 5 && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.2 + index * 0.03 }}
                                      className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 z-10"
                                    >
                                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap">
                                        {formatCurrency(day.total_cost)}
                                      </div>
                                      {/* 小箭头 */}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-0.5">
                                        <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-purple-600"></div>
                                      </div>
                                    </motion.div>
                                  )}

                                  {/* 柱状图 - 渐变色 + 发光效果 */}
                                  <motion.div
                                    whileHover={{
                                      scale: 1.05,
                                      boxShadow: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(147, 51, 234, 0.3)"
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full rounded-t-lg cursor-pointer relative overflow-hidden group"
                                    style={{
                                      height: day.heightPercent > 0 ? `${(day.heightPercent / 100) * 192}px` : '0px',
                                      minHeight: day.heightPercent > 0 ? '6px' : '0',
                                      background: `linear-gradient(180deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
                                      boxShadow: day.heightPercent > 0
                                        ? '0 4px 14px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(147, 51, 234, 0.2)'
                                        : 'none'
                                    }}
                                  >
                                    {/* 顶部高光 */}
                                    <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />
                                    {/* Hover 涟漪效果 */}
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0.6 }}
                                      whileHover={{ scale: 2, opacity: 0 }}
                                      transition={{ duration: 0.6 }}
                                      className="absolute inset-0 bg-white/20 rounded-t-lg"
                                    />

                                    {/* 柱内 Token 标签（中大型柱子显示） */}
                                    {day.heightPercent > 20 && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.9 }}
                                        transition={{ delay: 0.3 + index * 0.03 }}
                                        className="absolute inset-x-0 bottom-2 text-center text-white text-[9px] font-semibold drop-shadow-lg"
                                      >
                                        {formatTokens(day.total_tokens)}
                                      </motion.div>
                                    )}
                                  </motion.div>

                                  {/* X-axis 标签 - 增强样式 */}
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 + index * 0.02 }}
                                    className="absolute left-1/2 top-full mt-3 -translate-x-1/2 text-[10px] font-medium text-muted-foreground/70 whitespace-nowrap pointer-events-none"
                                  >
                                    {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </motion.div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* X-axis 底部标签 - 增强设计 */}
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-12 text-center"
                          >
                            <p className="text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {t('usageDashboard.dailyUsageTrend')}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              点击任意柱子查看小时统计
                            </p>
                          </motion.div>
                        </motion.div>
                      ) : timeGranularity === 'hour' && hourlyChartData ? (
                        /* 小时视图 - 现代化设计 */
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="relative pl-8 pr-3"
                        >
                          {/* 显示选中的日期 - 增强设计 */}
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-4 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20"
                          >
                            <p className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {selectedDate && new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long'
                              })} 的小时用量分布
                            </p>
                          </motion.div>

                          {/* Y-axis 标签 - 增强设计 */}
                          <div className="absolute left-0 top-16 bottom-16 flex flex-col justify-between text-[10px] font-medium text-muted-foreground/80">
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(hourlyChartData.maxCost)}
                            </motion.span>
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(hourlyChartData.halfMaxCost)}
                            </motion.span>
                            <motion.span
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                              className="bg-background/80 backdrop-blur-sm px-1 rounded"
                            >
                              {formatCurrency(0)}
                            </motion.span>
                          </div>

                          {/* 图表容器 - 可滚动的24小时视图 + 顶部留白 */}
                          <div className="overflow-x-auto pb-14 scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent">
                            <div className="flex items-end gap-1.5 h-48 pt-5 border-l-2 border-b-2 border-blue-500/20 pl-3 rounded-bl-lg min-w-[800px] relative">
                              {/* 背景渐变 */}
                              <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent pointer-events-none" />
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.08),rgba(255,255,255,0))] pointer-events-none" />

                              {hourlyChartData.bars.map((hourData, index) => {
                                // 根据时段调整颜色
                                const isPeakHour = hourData.hour >= 9 && hourData.hour <= 22;
                                const gradientIntensity = Math.min(hourData.heightPercent / 100, 1);

                                // 高峰时段 (9-22点) 使用蓝紫渐变，其他时段使用蓝绿渐变
                                const gradientFrom = isPeakHour
                                  ? `rgba(59, 130, 246, ${0.6 + gradientIntensity * 0.4})` // blue-500
                                  : `rgba(14, 165, 233, ${0.5 + gradientIntensity * 0.3})`; // sky-500
                                const gradientTo = isPeakHour
                                  ? `rgba(147, 51, 234, ${0.5 + gradientIntensity * 0.5})` // purple-600
                                  : `rgba(59, 130, 246, ${0.4 + gradientIntensity * 0.4})`; // blue-500

                                return (
                                  <motion.div
                                    key={hourData.hour}
                                    initial={{ opacity: 0, scaleY: 0 }}
                                    animate={{ opacity: 1, scaleY: 1 }}
                                    transition={{
                                      duration: 0.4,
                                      delay: index * 0.02,
                                      ease: [0.4, 0, 0.2, 1]
                                    }}
                                    className="flex-1 h-full flex flex-col items-center justify-end group relative min-w-[28px]"
                                  >
                                    {/* 高级 Tooltip - 仅在有费用时显示 */}
                                    {hourData.cost > 0 && (
                                      <AnimatePresence>
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                          whileHover={{ opacity: 1, scale: 1, y: 0 }}
                                          className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20"
                                        >
                                          <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3 whitespace-nowrap">
                                            {/* 时间标题 */}
                                            <div className="flex items-center gap-2 border-b border-border/30 pb-1.5 mb-1.5">
                                              <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                              <p className="text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                                {hourData.hour}:00 - {hourData.hour}:59
                                              </p>
                                            </div>
                                            {/* 费用 */}
                                            <div className="flex items-center justify-between gap-3 mb-1">
                                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <TrendingUp className="h-2.5 w-2.5 text-green-500" />
                                                费用
                                              </span>
                                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                                {formatCurrency(hourData.cost)}
                                              </span>
                                            </div>
                                            {/* Token */}
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Zap className="h-2.5 w-2.5 text-yellow-500" />
                                                Tokens
                                              </span>
                                              <span className="text-xs font-medium">
                                                {formatTokens(hourData.tokens)}
                                              </span>
                                            </div>
                                          </div>
                                          {/* Tooltip 箭头 */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1.5">
                                            <div className="w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-background/95"></div>
                                          </div>
                                        </motion.div>
                                      </AnimatePresence>
                                    )}

                                    {/* 💰 费用标签 - 始终可见（仅对有费用的柱子） */}
                                    {hourData.cost > 0 && hourData.heightPercent > 8 && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -3 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 + index * 0.02 }}
                                        className="absolute bottom-full mb-0.5 left-1/2 transform -translate-x-1/2 z-10"
                                      >
                                        <div className={cn(
                                          "text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap",
                                          isPeakHour
                                            ? "bg-gradient-to-r from-blue-600 to-purple-600"
                                            : "bg-gradient-to-r from-sky-600 to-blue-600"
                                        )}>
                                          {formatCurrency(hourData.cost)}
                                        </div>
                                      </motion.div>
                                    )}

                                    {/* 柱状图 - 渐变色 + 发光效果 */}
                                    <motion.div
                                      whileHover={hourData.cost > 0 ? {
                                        scale: 1.08,
                                        boxShadow: isPeakHour
                                          ? "0 0 16px rgba(59, 130, 246, 0.6), 0 0 32px rgba(147, 51, 234, 0.4)"
                                          : "0 0 16px rgba(14, 165, 233, 0.6), 0 0 32px rgba(59, 130, 246, 0.4)"
                                      } : {}}
                                      transition={{ duration: 0.2 }}
                                      className={cn(
                                        "w-full rounded-t-lg relative overflow-hidden",
                                        hourData.cost > 0 ? "cursor-pointer" : ""
                                      )}
                                      style={{
                                        height: hourData.heightPercent > 0 ? `${(hourData.heightPercent / 100) * 192}px` : '3px',
                                        minHeight: hourData.heightPercent > 0 ? '6px' : '3px',
                                        background: hourData.cost > 0
                                          ? `linear-gradient(180deg, ${gradientFrom} 0%, ${gradientTo} 100%)`
                                          : 'rgba(100, 116, 139, 0.15)',
                                        boxShadow: hourData.cost > 0 && hourData.heightPercent > 0
                                          ? isPeakHour
                                            ? '0 3px 12px rgba(59, 130, 246, 0.2), 0 2px 6px rgba(147, 51, 234, 0.15)'
                                            : '0 3px 12px rgba(14, 165, 233, 0.2), 0 2px 6px rgba(59, 130, 246, 0.15)'
                                          : 'none'
                                      }}
                                    >
                                      {/* 顶部高光 - 仅在有费用时显示 */}
                                      {hourData.cost > 0 && (
                                        <>
                                          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />
                                          {/* Hover 涟漪效果 */}
                                          <motion.div
                                            initial={{ scale: 0, opacity: 0.5 }}
                                            whileHover={{ scale: 1.8, opacity: 0 }}
                                            transition={{ duration: 0.5 }}
                                            className="absolute inset-0 bg-white/20 rounded-t-lg"
                                          />
                                        </>
                                      )}
                                    </motion.div>

                                    {/* X-axis 标签 - 增强样式 */}
                                    <motion.span
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 0.3 + index * 0.01 }}
                                      className={cn(
                                        "absolute text-[9px] font-medium whitespace-nowrap pointer-events-none",
                                        hourData.cost > 0 ? "text-foreground/60" : "text-muted-foreground/40"
                                      )}
                                      style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '10px' }}
                                    >
                                      {hourData.hour}
                                    </motion.span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>

                          {/* X-axis 底部标签 - 增强设计 */}
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-6 text-center"
                          >
                            <p className="text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              小时分布 (0-23)
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              高峰时段 (9-22点) 显示为蓝紫渐变
                            </p>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          {t('usageDashboard.noUsageData')}
                        </div>
                        )}
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};