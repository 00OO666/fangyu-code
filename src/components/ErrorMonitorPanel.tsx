/**
 * Error Monitor Panel v2.0
 *
 * 重新设计的错误监控面板，应用新的设计系统
 * 
 * 特性：
 * - Glassmorphism 设计风格
 * - 一键复制所有错误详情
 * - 重复率分析和警告
 * - 更好的视觉层次
 */

import React, { useState, useCallback } from "react";
import {
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Bug,
  AlertCircle,
  Info,
  Trash2,
  Copy,
  Check,
  TrendingUp,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type ConsoleError } from "@/hooks/useConsoleMonitor";

interface ErrorMonitorPanelProps {
  /** 错误列表 */
  errors: ConsoleError[];
  /** 清空所有错误回调 */
  onClearAll: () => void;
  /** 清除单个错误回调 */
  onClearError: (errorId: string) => void;
  /** 重复率信息（可选） */
  duplicateInfo?: {
    rate: number;
    count: number;
    total: number;
  };
}

/**
 * 错误类型图标
 */
const ErrorIcon: React.FC<{ type: ConsoleError["type"]; className?: string }> = ({
  type,
  className,
}) => {
  const icons = {
    error: <AlertCircle className={cn("h-4 w-4", className)} />,
    warn: <AlertTriangle className={cn("h-4 w-4", className)} />,
    info: <Info className={cn("h-4 w-4", className)} />,
  };
  return icons[type];
};

/**
 * 错误类别配置
 */
const CATEGORY_CONFIG: Record<
  ConsoleError["category"],
  { label: string; color: string; bgColor: string }
> = {
  "duplicate-message": {
    label: "消息重复",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20 border-purple-500/30",
  },
  "state-update": {
    label: "状态更新",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20 border-blue-500/30",
  },
  network: {
    label: "网络错误",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20 border-orange-500/30",
  },
  render: {
    label: "渲染错误",
    color: "text-red-400",
    bgColor: "bg-red-500/20 border-red-500/30",
  },
  memory: {
    label: "内存泄漏",
    color: "text-pink-400",
    bgColor: "bg-pink-500/20 border-pink-500/30",
  },
  performance: {
    label: "性能问题",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20 border-yellow-500/30",
  },
  unknown: {
    label: "未知错误",
    color: "text-gray-400",
    bgColor: "bg-gray-500/20 border-gray-500/30",
  },
};

/**
 * 错误类别徽章
 */
const CategoryBadge: React.FC<{ category: ConsoleError["category"] }> = ({
  category,
}) => {
  const config = CATEGORY_CONFIG[category];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        config.bgColor,
        config.color
      )}
    >
      {config.label}
    </span>
  );
};

/**
 * 错误项组件
 */
const ErrorItem: React.FC<{
  error: ConsoleError;
  onClear: () => void;
}> = ({ error, onClear }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeColors = {
    error: "border-l-red-500 bg-red-500/5",
    warn: "border-l-yellow-500 bg-yellow-500/5",
    info: "border-l-blue-500 bg-blue-500/5",
  };

  const iconColors = {
    error: "text-red-400",
    warn: "text-yellow-400",
    info: "text-blue-400",
  };

  return (
    <div
      className={cn(
        "border-l-2 rounded-r-lg p-3 space-y-2 transition-all duration-200",
        "bg-[var(--glass-bg)] backdrop-blur-sm border border-white/5",
        typeColors[error.type]
      )}
    >
      {/* 头部 */}
      <div className="flex items-start gap-2">
        <ErrorIcon type={error.type} className={iconColors[error.type]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <CategoryBadge category={error.category} />
            {error.count > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-white/10 text-white/70">
                ×{error.count}
              </span>
            )}
            <span className="text-xs text-white/40">
              {new Date(error.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-white/80 line-clamp-2 font-mono">
            {error.message}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0 hover:bg-white/10"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-white/60" />
            ) : (
              <ChevronDown className="h-3 w-3 text-white/60" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="space-y-2 pl-6 text-sm animate-in slide-in-from-top-2 duration-200">
          {/* 修复建议 */}
          {error.suggestion && (
            <div className="bg-[var(--ds-primary)]/10 border border-[var(--ds-primary)]/20 rounded-lg p-2">
              <p className="text-[var(--ds-primary)] font-medium mb-1 text-xs">
                💡 修复建议
              </p>
              <p className="text-white/70 text-xs">{error.suggestion}</p>
            </div>
          )}

          {/* 文件位置 */}
          {error.file && (
            <div className="text-xs text-white/50 font-mono">
              📁 {error.file}
              {error.line && `:${error.line}`}
            </div>
          )}

          {/* 堆栈跟踪 */}
          {error.stack && (
            <details className="text-xs group">
              <summary className="cursor-pointer text-white/50 hover:text-white/70 transition-colors">
                查看堆栈跟踪
              </summary>
              <pre className="mt-2 p-2 bg-black/30 rounded-lg overflow-x-auto text-xs text-white/60 font-mono max-h-32">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 重复率指示器
 */
const DuplicateRateIndicator: React.FC<{
  rate: number;
  count: number;
  total: number;
}> = ({ rate, count, total }) => {
  const isHigh = rate > 0.1; // 超过 10% 视为高
  const isCritical = rate > 0.3; // 超过 30% 视为严重

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
        isCritical
          ? "bg-red-500/20 border border-red-500/30"
          : isHigh
            ? "bg-yellow-500/20 border border-yellow-500/30"
            : "bg-green-500/20 border border-green-500/30"
      )}
    >
      <TrendingUp
        className={cn(
          "h-3.5 w-3.5",
          isCritical
            ? "text-red-400"
            : isHigh
              ? "text-yellow-400"
              : "text-green-400"
        )}
      />
      <div>
        <span
          className={cn(
            "font-medium",
            isCritical
              ? "text-red-400"
              : isHigh
                ? "text-yellow-400"
                : "text-green-400"
          )}
        >
          重复率: {(rate * 100).toFixed(1)}%
        </span>
        <span className="text-white/50 ml-2">
          ({count}/{total})
        </span>
      </div>
      {isCritical && (
        <span className="text-red-400 animate-pulse">⚠️ Token 消耗倍增风险</span>
      )}
    </div>
  );
};

/**
 * 错误监控面板组件
 */
export const ErrorMonitorPanel: React.FC<ErrorMonitorPanelProps> = ({
  errors,
  onClearAll,
  onClearError,
  duplicateInfo,
}) => {
  const [filter, setFilter] = useState<"all" | "error" | "warn">("all");
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  // 计算统计数据
  const errorCount = errors.filter((e) => e.type === "error").length;
  const warnCount = errors.filter((e) => e.type === "warn").length;
  const totalCount = errors.reduce((sum, e) => sum + e.count, 0);

  // 按类别分组
  const errorsByCategory = errors.reduce((acc, error) => {
    if (!acc[error.category]) {
      acc[error.category] = [];
    }
    acc[error.category].push(error);
    return acc;
  }, {} as Record<ConsoleError["category"], ConsoleError[]>);

  const filteredErrors = errors.filter((error) => {
    if (filter === "all") return true;
    return error.type === filter;
  });

  /**
   * 一键复制所有错误详情
   */
  const copyAllErrors = useCallback(async () => {
    const errorDetails = errors
      .map((error, index) => {
        const lines = [
          `━━━ 错误 #${index + 1} ━━━`,
          `类型: ${error.type.toUpperCase()}`,
          `分类: ${CATEGORY_CONFIG[error.category].label}`,
          `时间: ${new Date(error.timestamp).toLocaleString()}`,
          `出现次数: ${error.count}`,
          `消息: ${error.message}`,
        ];

        if (error.suggestion) {
          lines.push(`修复建议: ${error.suggestion}`);
        }
        if (error.file) {
          lines.push(`文件: ${error.file}${error.line ? `:${error.line}` : ""}`);
        }
        if (error.stack) {
          lines.push(`堆栈跟踪:\n${error.stack}`);
        }

        return lines.join("\n");
      })
      .join("\n\n");

    const summary = [
      "═══════════════════════════════════════",
      "        Fangyu Code 错误监控报告",
      "═══════════════════════════════════════",
      `生成时间: ${new Date().toLocaleString()}`,
      `错误总数: ${errorCount}`,
      `警告总数: ${warnCount}`,
      `累计出现: ${totalCount} 次`,
      "",
      duplicateInfo
        ? `重复率: ${(duplicateInfo.rate * 100).toFixed(1)}% (${duplicateInfo.count}/${duplicateInfo.total})`
        : "",
      "",
      "═══════════════════════════════════════",
      "",
      errorDetails,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, [errors, errorCount, warnCount, totalCount, duplicateInfo]);

  // 空状态
  if (errors.length === 0) {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
          "border border-white/10 rounded-xl shadow-2xl",
          "p-3 flex items-center gap-2"
        )}
      >
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <Bug className="h-4 w-4 text-white/60" />
        <span className="text-sm text-white/60">暂无错误 ✨</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300 ease-out",
        "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
        "border border-white/10 rounded-xl shadow-2xl",
        isMinimized ? "w-auto" : "w-[420px] max-h-[560px]"
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bug className="h-4 w-4 text-[var(--ds-primary)]" />
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <h3 className="font-semibold text-sm text-white/90">错误监控</h3>
          <Badge
            variant="outline"
            className="text-xs bg-red-500/20 text-red-400 border-red-500/30"
          >
            {totalCount}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* 一键复制按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={copyAllErrors}
            className={cn(
              "h-7 px-2 text-xs transition-all",
              copied
                ? "bg-green-500/20 text-green-400"
                : "hover:bg-white/10 text-white/60"
            )}
            title="复制所有错误详情"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                复制全部
              </>
            )}
          </Button>
          {/* 清空按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-xs hover:bg-red-500/20 hover:text-red-400 text-white/60"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            清空
          </Button>
          {/* 最小化按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 p-0 hover:bg-white/10 text-white/60"
          >
            {isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 重复率警告 */}
          {duplicateInfo && duplicateInfo.rate > 0.05 && (
            <div className="p-3 border-b border-white/10">
              <DuplicateRateIndicator
                rate={duplicateInfo.rate}
                count={duplicateInfo.count}
                total={duplicateInfo.total}
              />
            </div>
          )}

          {/* 过滤器和统计 */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              {(["all", "error", "warn"] as const).map((type) => {
                const count =
                  type === "all"
                    ? errors.length
                    : type === "error"
                      ? errorCount
                      : warnCount;
                const label =
                  type === "all" ? "全部" : type === "error" ? "错误" : "警告";

                return (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter(type)}
                    className={cn(
                      "h-7 text-xs transition-all",
                      filter === type
                        ? "bg-[var(--ds-primary)]/20 text-[var(--ds-primary)] border border-[var(--ds-primary)]/30"
                        : "hover:bg-white/10 text-white/60"
                    )}
                  >
                    {label} ({count})
                  </Button>
                );
              })}
            </div>

            {/* 按类别统计 */}
            {Object.keys(errorsByCategory).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(errorsByCategory).map(([category]) => (
                  <CategoryBadge
                    key={category}
                    category={category as ConsoleError["category"]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 错误列表 */}
          <ScrollArea className="max-h-[320px]">
            <div className="p-3 space-y-2">
              {filteredErrors.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  {filter === "all"
                    ? "暂无错误 ✨"
                    : `暂无${filter === "error" ? "错误" : "警告"}`}
                </div>
              ) : (
                filteredErrors.map((error) => (
                  <ErrorItem
                    key={error.id}
                    error={error}
                    onClear={() => onClearError(error.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {/* 底部提示 */}
          <div className="p-2 border-t border-white/10 bg-white/5">
            <p className="text-xs text-white/40 text-center">
              实时监控 console 错误和警告 · 点击「复制全部」导出详情
            </p>
          </div>
        </>
      )}
    </div>
  );
};
