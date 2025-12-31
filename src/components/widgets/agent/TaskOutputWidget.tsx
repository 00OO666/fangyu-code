/**
 * TaskOutput Widget - 任务输出展示
 *
 * 用于展示后台任务（子代理）的执行结果
 * Claude Code 的 TaskOutput 工具用于获取后台运行任务的输出
 */

import React, { useState, useMemo } from "react";
import { ClipboardList, CheckCircle, Clock, AlertCircle, ChevronRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskOutputWidgetProps {
  /** 任务 ID */
  taskId?: string;
  /** 是否阻塞等待 */
  block?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 工具结果 */
  result?: {
    content?: any;
    is_error?: boolean;
  };
}

/**
 * 解析任务输出内容
 */
function parseTaskOutput(content: any): {
  status?: string;
  output?: string;
  taskId?: string;
  error?: string;
} {
  if (!content) return {};

  // 如果是字符串，尝试解析 JSON
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return parseTaskOutput(parsed);
    } catch {
      return { output: content };
    }
  }

  // 如果是对象，提取字段
  if (typeof content === 'object') {
    return {
      status: content.status,
      output: content.output || content.result || content.message,
      taskId: content.task_id || content.taskId,
      error: content.error,
    };
  }

  return { output: String(content) };
}

/**
 * 获取状态图标和颜色
 */
function getStatusDisplay(status?: string, isError?: boolean): {
  icon: React.ReactNode;
  color: string;
  label: string;
} {
  if (isError) {
    return {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: 'text-red-500',
      label: '失败',
    };
  }

  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
    case 'success':
      return {
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        color: 'text-green-500',
        label: '已完成',
      };
    case 'running':
    case 'in_progress':
      return {
        icon: <Clock className="h-3.5 w-3.5 animate-spin" />,
        color: 'text-blue-500',
        label: '运行中',
      };
    case 'pending':
    case 'waiting':
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        color: 'text-yellow-500',
        label: '等待中',
      };
    default:
      return {
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        color: 'text-green-500',
        label: '已完成',
      };
  }
}

/**
 * TaskOutput Widget
 *
 * 展示后台任务的执行结果
 */
export const TaskOutputWidget: React.FC<TaskOutputWidgetProps> = ({
  taskId,
  block,
  timeout,
  result,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const parsed = useMemo(() => parseTaskOutput(result?.content), [result?.content]);
  const statusDisplay = useMemo(
    () => getStatusDisplay(parsed.status, result?.is_error),
    [parsed.status, result?.is_error]
  );

  const displayTaskId = taskId || parsed.taskId;
  const hasOutput = parsed.output || parsed.error;

  return (
    <div className="space-y-2">
      {/* 头部 */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <ClipboardList className="h-4 w-4 text-purple-500" />
          <Bot className="h-2.5 w-2.5 text-purple-400 absolute -top-1 -right-1" />
        </div>
        <span className="text-sm font-medium">任务输出</span>
        {displayTaskId && (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
            {displayTaskId.length > 12 ? `${displayTaskId.slice(0, 12)}...` : displayTaskId}
          </code>
        )}
        <span className={cn("flex items-center gap-1 text-xs", statusDisplay.color)}>
          {statusDisplay.icon}
          {statusDisplay.label}
        </span>
      </div>

      {/* 参数信息 */}
      {(block !== undefined || timeout !== undefined) && (
        <div className="ml-6 flex items-center gap-3 text-xs text-muted-foreground">
          {block !== undefined && (
            <span>阻塞: {block ? '是' : '否'}</span>
          )}
          {timeout !== undefined && (
            <span>超时: {timeout}ms</span>
          )}
        </div>
      )}

      {/* 输出内容 */}
      {hasOutput && (
        <div className="ml-6 space-y-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
            <span>输出详情</span>
          </button>

          {isExpanded && (
            <div className={cn(
              "rounded-lg border p-3",
              result?.is_error || parsed.error
                ? "border-red-500/20 bg-red-500/5"
                : "border-purple-500/20 bg-purple-500/5"
            )}>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/90 max-h-[400px] overflow-auto">
                {parsed.error || parsed.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
