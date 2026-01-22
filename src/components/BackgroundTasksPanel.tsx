/**
 * BackgroundTasksPanel - 后台任务管理面板
 *
 * 功能:
 * - 显示所有后台任务列表
 * - 实时任务进度展示
 * - 任务暂停/恢复/取消控制
 * - 任务统计和过滤
 * - 任务详情查看
 *
 * 来源: Cursor Composer + Windsurf Background Tasks
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Play from 'lucide-react/dist/esm/icons/play'
import Pause from 'lucide-react/dist/esm/icons/pause'
import X from 'lucide-react/dist/esm/icons/x'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Clock from 'lucide-react/dist/esm/icons/clock'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import FileCode from 'lucide-react/dist/esm/icons/file-code'
import Zap from 'lucide-react/dist/esm/icons/zap'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import Filter from 'lucide-react/dist/esm/icons/filter';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

interface TaskProgress {
  current_step: number;
  total_steps: number;
  percentage: number;
  message: string;
  processed_items?: number;
  total_items?: number;
}

interface TaskResult {
  success: boolean;
  data?: any;
  output?: string;
  error?: string;
  duration_ms: number;
}

interface BackgroundTask {
  id: string;
  name: string;
  description?: string;
  task_type: any;
  priority: TaskPriority;
  status: TaskStatus;
  progress: TaskProgress;
  result?: TaskResult;
  session_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  tags: string[];
}

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface BackgroundTasksPanelProps {
  sessionId?: string;
  className?: string;
}

// ============================================================
// 组件
// ============================================================

export function BackgroundTasksPanel({ sessionId, className }: BackgroundTasksPanelProps) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const taskList = await api.listBackgroundTasks(sessionId, filter === 'all' ? undefined : false);
      const taskStats = await api.getTaskStats();

      setTasks(taskList);
      setStats(taskStats);
    } catch (error) {
      logger.error('BackgroundTasksPanel', '加载任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, filter]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 2000); // 每2秒刷新
    return () => clearInterval(interval);
  }, [loadTasks]);

  // 任务控制操作
  const handlePause = async (taskId: string) => {
    try {
      await api.pauseBackgroundTask(taskId);
      loadTasks();
    } catch (error) {
      logger.error('BackgroundTasksPanel', '暂停任务失败:', error);
    }
  };

  const handleResume = async (taskId: string) => {
    try {
      await api.resumeBackgroundTask(taskId);
      loadTasks();
    } catch (error) {
      logger.error('BackgroundTasksPanel', '恢复任务失败:', error);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await api.cancelBackgroundTask(taskId);
      loadTasks();
    } catch (error) {
      logger.error('BackgroundTasksPanel', '取消任务失败:', error);
    }
  };

  const handleRetry = async (taskId: string) => {
    try {
      await api.retryBackgroundTask(taskId);
      loadTasks();
    } catch (error) {
      logger.error('BackgroundTasksPanel', '重试任务失败:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await api.deleteBackgroundTask(taskId);
      loadTasks();
    } catch (error) {
      logger.error('BackgroundTasksPanel', '删除任务失败:', error);
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // 过滤任务
  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  // 获取任务类型图标
  const getTaskTypeIcon = (taskType: any) => {
    if (taskType.ShellCommand) return Terminal;
    if (taskType.AiGeneration) return Sparkles;
    if (taskType.FileOperation) return FileCode;
    if (taskType.CodeAnalysis) return BarChart3;
    return Zap;
  };

  // 获取状态颜色
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'running':
        return 'text-blue-500';
      case 'paused':
        return 'text-yellow-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'cancelled':
        return 'text-gray-400';
      default:
        return 'text-gray-500';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'running':
        return Loader2;
      case 'paused':
        return Pause;
      case 'completed':
        return CheckCircle2;
      case 'failed':
        return AlertCircle;
      case 'cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  // 获取优先级颜色
  const getPriorityBadge = (priority: TaskPriority) => {
    const colors = {
      low: 'bg-gray-500/10 text-gray-500',
      normal: 'bg-blue-500/10 text-blue-500',
      high: 'bg-orange-500/10 text-orange-500',
      critical: 'bg-red-500/10 text-red-500',
    };
    return colors[priority] || colors.normal;
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">后台任务</h2>
          </div>
          {stats && (
            <Badge variant="outline" className="text-xs">
              {stats.running} 运行中 / {stats.total} 总计
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 过滤器 */}
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-32 h-8">
              <Filter className="h-3 w-3 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="paused">已暂停</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTasks}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-6 gap-2 p-4 border-b bg-muted/30">
          <StatCard label="总计" value={stats.total} color="text-gray-600" />
          <StatCard label="运行中" value={stats.running} color="text-blue-500" />
          <StatCard label="等待中" value={stats.pending} color="text-gray-500" />
          <StatCard label="已完成" value={stats.completed} color="text-green-500" />
          <StatCard label="失败" value={stats.failed} color="text-red-500" />
          <StatCard label="已取消" value={stats.cancelled} color="text-gray-400" />
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Zap className="h-8 w-8 mb-2 opacity-50" />
            <p>暂无任务</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                expanded={expandedTasks.has(task.id)}
                onToggleExpand={() => toggleExpand(task.id)}
                onPause={() => handlePause(task.id)}
                onResume={() => handleResume(task.id)}
                onCancel={() => handleCancel(task.id)}
                onRetry={() => handleRetry(task.id)}
                onDelete={() => handleDelete(task.id)}
                getTaskTypeIcon={getTaskTypeIcon}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getPriorityBadge={getPriorityBadge}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-background border">
      <span className={cn('text-2xl font-bold', color)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface TaskCardProps {
  task: BackgroundTask;
  expanded: boolean;
  onToggleExpand: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
  getTaskTypeIcon: (taskType: any) => any;
  getStatusColor: (status: TaskStatus) => string;
  getStatusIcon: (status: TaskStatus) => any;
  getPriorityBadge: (priority: TaskPriority) => string;
}

function TaskCard({
  task,
  expanded,
  onToggleExpand,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDelete,
  getTaskTypeIcon,
  getStatusColor,
  getStatusIcon,
  getPriorityBadge,
}: TaskCardProps) {
  const TypeIcon = getTaskTypeIcon(task.task_type);
  const StatusIcon = getStatusIcon(task.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="border rounded-lg bg-card"
    >
      <Collapsible open={expanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center gap-3 p-3">
          {/* 展开按钮 */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          {/* 任务类型图标 */}
          <div className="flex-shrink-0">
            <TypeIcon className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* 任务信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{task.name}</h3>
              <Badge className={cn('text-xs', getPriorityBadge(task.priority))}>
                {task.priority}
              </Badge>
              {task.tags.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {task.tags[0]}
                </Badge>
              )}
            </div>

            {/* 进度条 */}
            {task.status === 'running' && (
              <div className="space-y-1">
                <Progress value={task.progress.percentage} className="h-1" />
                <p className="text-xs text-muted-foreground">
                  {task.progress.message} ({task.progress.percentage.toFixed(0)}%)
                </p>
              </div>
            )}

            {/* 状态消息 */}
            {task.status !== 'running' && (
              <p className="text-xs text-muted-foreground truncate">
                {task.progress.message}
              </p>
            )}
          </div>

          {/* 状态指示器 */}
          <div className={cn('flex items-center gap-1', getStatusColor(task.status))}>
            <StatusIcon
              className={cn('h-4 w-4', task.status === 'running' && 'animate-spin')}
            />
            <span className="text-xs capitalize">{task.status}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            {task.status === 'running' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPause();
                  }}
                  className="h-7 w-7 p-0"
                  title="暂停"
                >
                  <Pause className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="h-7 w-7 p-0"
                  title="取消"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}

            {task.status === 'paused' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume();
                  }}
                  className="h-7 w-7 p-0"
                  title="恢复"
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="h-7 w-7 p-0"
                  title="取消"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}

            {task.status === 'failed' && task.retry_count < task.max_retries && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                className="h-7 w-7 p-0"
                title="重试"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}

            {(task.status === 'completed' ||
              task.status === 'failed' ||
              task.status === 'cancelled') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-7 w-7 p-0"
                title="删除"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* 详细信息 */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-2 text-xs border-t mt-2 pt-2">
            {task.description && (
              <div>
                <span className="text-muted-foreground">描述: </span>
                <span>{task.description}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">创建时间: </span>
                <span>{new Date(task.created_at).toLocaleString('zh-CN')}</span>
              </div>
              {task.started_at && (
                <div>
                  <span className="text-muted-foreground">开始时间: </span>
                  <span>{new Date(task.started_at).toLocaleString('zh-CN')}</span>
                </div>
              )}
              {task.completed_at && (
                <div>
                  <span className="text-muted-foreground">完成时间: </span>
                  <span>{new Date(task.completed_at).toLocaleString('zh-CN')}</span>
                </div>
              )}
              {task.result && (
                <div>
                  <span className="text-muted-foreground">耗时: </span>
                  <span>{(task.result.duration_ms / 1000).toFixed(2)}秒</span>
                </div>
              )}
            </div>

            {task.progress.processed_items !== undefined && (
              <div>
                <span className="text-muted-foreground">进度: </span>
                <span>
                  {task.progress.processed_items} / {task.progress.total_items} 项
                </span>
              </div>
            )}

            {task.result?.error && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500">
                <span className="font-medium">错误: </span>
                <span>{task.result.error}</span>
              </div>
            )}

            {task.result?.output && (
              <div className="p-2 bg-muted rounded font-mono text-xs max-h-32 overflow-y-auto">
                {task.result.output}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}
