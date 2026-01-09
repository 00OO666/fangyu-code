/**
 * Error Monitor Panel
 *
 * 可视化错误监控面板，显示实时错误和修复建议
 */

import React, { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp, Bug, AlertCircle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConsoleMonitor, type ConsoleError } from "@/hooks/useConsoleMonitor";

interface ErrorMonitorPanelProps {
  /** 错误列表 */
  errors: ConsoleError[];
  /** 清空所有错误回调 */
  onClearAll: () => void;
  /** 清除单个错误回调 */
  onClearError: (errorId: string) => void;
}

/**
 * 错误类型图标
 */
const ErrorIcon: React.FC<{ type: ConsoleError["type"] }> = ({ type }) => {
  switch (type) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

/**
 * 错误类别徽章
 */
const CategoryBadge: React.FC<{ category: ConsoleError["category"] }> = ({ category }) => {
  const colors: Record<ConsoleError["category"], string> = {
    "duplicate-message": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "state-update": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    network: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    render: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    memory: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    performance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    unknown: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const labels: Record<ConsoleError["category"], string> = {
    "duplicate-message": "消息重复",
    "state-update": "状态更新",
    network: "网络错误",
    render: "渲染错误",
    memory: "内存泄漏",
    performance: "性能问题",
    unknown: "未知错误",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", colors[category])}>
      {labels[category]}
    </Badge>
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

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      {/* 头部 */}
      <div className="flex items-start gap-2">
        <ErrorIcon type={error.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CategoryBadge category={error.category} />
            {error.count > 1 && (
              <Badge variant="secondary" className="text-xs">
                ×{error.count}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(error.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm font-medium line-clamp-2">{error.message}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="space-y-2 pl-6 text-sm">
          {/* 修复建议 */}
          {error.suggestion && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-2">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                💡 修复建议
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-xs">
                {error.suggestion}
              </p>
            </div>
          )}

          {/* 文件位置 */}
          {error.file && (
            <div className="text-xs text-muted-foreground">
              📁 {error.file}
              {error.line && `:${error.line}`}
            </div>
          )}

          {/* 堆栈跟踪 */}
          {error.stack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                查看堆栈跟踪
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-xs">
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
 * 错误监控面板组件
 */
export const ErrorMonitorPanel: React.FC<ErrorMonitorPanelProps> = ({
  errors,
  onClearAll,
  onClearError,
}) => {
  const [filter, setFilter] = useState<"all" | "error" | "warn">("all");

  // 计算统计数据
  const errorCount = errors.filter(e => e.type === 'error').length;
  const warnCount = errors.filter(e => e.type === 'warn').length;
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

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 bg-background flex flex-col transition-all duration-300 ease-in-out border shadow-lg rounded-lg z-50",
        errors.length > 0 ? "w-96 max-h-[500px]" : "w-auto"
      )}
    >
      {errors.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Bug className="h-4 w-4" />
          暂无错误 ✨
        </div>
      ) : (
        <>
          {/* 头部 */}
          <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <h3 className="font-semibold text-sm">错误监控</h3>
              {totalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-7 px-2 text-xs"
                disabled={errors.length === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                清空
              </Button>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="p-3 border-b flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className="h-7 text-xs"
              >
                全部 ({errors.length})
              </Button>
              <Button
                variant={filter === "error" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("error")}
                className="h-7 text-xs"
              >
                错误 ({errorCount})
              </Button>
              <Button
                variant={filter === "warn" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("warn")}
                className="h-7 text-xs"
              >
                警告 ({warnCount})
              </Button>
            </div>

            {/* 按类别统计 */}
            {Object.keys(errorsByCategory).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(errorsByCategory).map(([category, _categoryErrors]) => (
                  <CategoryBadge
                    key={category}
                    category={category as ConsoleError["category"]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 错误列表 */}
          <ScrollArea className="flex-1 max-h-[300px]">
            <div className="p-3 space-y-2">
              {filteredErrors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
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
          <div className="p-2 border-t bg-muted/30 flex-shrink-0">
            <p className="text-xs text-muted-foreground text-center">
              实时监控 console 错误和警告
            </p>
          </div>
        </>
      )}
    </div>
  );
};
