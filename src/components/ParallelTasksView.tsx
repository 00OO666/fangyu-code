/**
 * ParallelTasksView - 并行任务可视化视图
 *
 * 功能:
 * - 任务依赖图可视化
 * - 代理状态实时展示
 * - 任务流程动画
 * - 资源锁定状态
 *
 * 来源: Claude Code Task Tool Visualization
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Users from 'lucide-react/dist/esm/icons/users'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import Play from 'lucide-react/dist/esm/icons/play'
import Pause from 'lucide-react/dist/esm/icons/pause'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Lock from 'lucide-react/dist/esm/icons/lock'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import X from 'lucide-react/dist/esm/icons/x';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

interface AgentType {
  General?: null;
  Coder?: null;
  Reviewer?: null;
  Tester?: null;
  Documenter?: null;
  Researcher?: null;
  Debugger?: null;
  Custom?: string;
}

type AgentStatus = 'idle' | 'working' | 'waiting' | 'paused' | 'completed' | 'failed';

interface ParallelTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  agent_type: AgentType;
  dependencies: string[];
  priority: number;
  status: AgentStatus;
  assigned_agent?: string;
  result?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface ParallelAgent {
  id: string;
  name: string;
  agent_type: AgentType;
  status: AgentStatus;
  current_task?: string;
  completed_tasks: string[];
  capabilities: string[];
}

interface ParallelTaskGroup {
  id: string;
  name: string;
  description?: string;
  session_id: string;
  tasks: Record<string, ParallelTask>;
  agents: Record<string, ParallelAgent>;
  locked_resources: Record<string, string>;
  status: string;
  created_at: string;
  completed_at?: string;
}

interface GroupStats {
  total_tasks: number;
  pending_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_agents: number;
  active_agents: number;
}

interface ParallelTasksViewProps {
  groupId: string;
  onClose?: () => void;
  className?: string;
}

// ============================================================
// 组件
// ============================================================

export function ParallelTasksView({ groupId, onClose, className }: ParallelTasksViewProps) {
  const [group, setGroup] = useState<ParallelTaskGroup | null>(null);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // 加载任务组数据
  const loadGroup = useCallback(async () => {
    try {
      const [groupData, statsData] = await Promise.all([
        api.getParallelGroup(groupId),
        api.getGroupStats(groupId),
      ]);
      setGroup(groupData);
      setStats(statsData);
    } catch (error) {
      logger.error('ParallelTasksView', '加载任务组失败:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadGroup();
    const interval = setInterval(loadGroup, 2000);
    return () => clearInterval(interval);
  }, [loadGroup]);

  // 启动任务组
  const handleStart = async () => {
    try {
      await api.startParallelGroup(groupId);
      loadGroup();
    } catch (error) {
      logger.error('ParallelTasksView', '启动任务组失败:', error);
    }
  };

  // 获取代理类型显示名称
  const getAgentTypeName = (type: AgentType): string => {
    if (type.General !== undefined) return '通用';
    if (type.Coder !== undefined) return '编码';
    if (type.Reviewer !== undefined) return '审查';
    if (type.Tester !== undefined) return '测试';
    if (type.Documenter !== undefined) return '文档';
    if (type.Researcher !== undefined) return '研究';
    if (type.Debugger !== undefined) return '调试';
    if (type.Custom) return type.Custom;
    return '未知';
  };

  // 获取状态颜色
  const getStatusColor = (status: AgentStatus): string => {
    switch (status) {
      case 'idle': return 'text-gray-500';
      case 'working': return 'text-blue-500';
      case 'waiting': return 'text-yellow-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'paused': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'idle': return Clock;
      case 'working': return Loader2;
      case 'waiting': return Pause;
      case 'completed': return CheckCircle2;
      case 'failed': return AlertCircle;
      case 'paused': return Pause;
      default: return Clock;
    }
  };

  // 任务列表（按依赖排序）
  const sortedTasks = useMemo(() => {
    if (!group) return [];
    return Object.values(group.tasks).sort((a, b) => {
      // 先按依赖数量排序
      if (a.dependencies.length !== b.dependencies.length) {
        return a.dependencies.length - b.dependencies.length;
      }
      // 再按优先级排序
      return b.priority - a.priority;
    });
  }, [group]);

  // 代理列表
  const agents = useMemo(() => {
    if (!group) return [];
    return Object.values(group.agents);
  }, [group]);

  // 计算进度百分比
  const progressPercent = useMemo(() => {
    if (!stats || stats.total_tasks === 0) return 0;
    return Math.round((stats.completed_tasks / stats.total_tasks) * 100);
  }, [stats]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-muted-foreground', className)}>
        <p>任务组不存在或已删除</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{group.name}</h2>
            {group.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
          <Badge variant={group.status === 'completed' ? 'default' : 'outline'}>
            {group.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {group.status === 'pending' && (
            <Button onClick={handleStart} size="sm" className="gap-2">
              <Play className="h-4 w-4" />
              开始
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={loadGroup}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 统计信息和进度 */}
      {stats && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                任务: {stats.completed_tasks}/{stats.total_tasks}
              </span>
              <span className="text-muted-foreground">
                代理: {stats.active_agents}/{stats.total_agents} 活跃
              </span>
            </div>
            <span className="text-sm font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 任务流程图 */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            任务流程
          </h3>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task, index) => (
                <TaskNode
                  key={task.id}
                  task={task}
                  index={index}
                  isSelected={selectedTask === task.id}
                  onClick={() => setSelectedTask(task.id === selectedTask ? null : task.id)}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getAgentTypeName={getAgentTypeName}
                  allTasks={group.tasks}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* 代理面板 */}
        <div className="w-64 border-l p-4 overflow-y-auto bg-muted/20">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            代理 ({agents.length})
          </h3>

          <div className="space-y-2">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getAgentTypeName={getAgentTypeName}
              />
            ))}
          </div>

          {/* 资源锁定状态 */}
          {Object.keys(group.locked_resources).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" />
                锁定资源
              </h4>
              <div className="space-y-1">
                {Object.entries(group.locked_resources).map(([resource, agentId]) => (
                  <div
                    key={resource}
                    className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded flex items-center justify-between"
                  >
                    <span className="truncate">{resource}</span>
                    <span className="text-[10px] opacity-70">{agentId.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 任务详情面板 */}
      <AnimatePresence>
        {selectedTask && group.tasks[selectedTask] && (
          <TaskDetailPanel
            task={group.tasks[selectedTask]}
            onClose={() => setSelectedTask(null)}
            getAgentTypeName={getAgentTypeName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

interface TaskNodeProps {
  task: ParallelTask;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  getStatusColor: (status: AgentStatus) => string;
  getStatusIcon: (status: AgentStatus) => any;
  getAgentTypeName: (type: AgentType) => string;
  allTasks: Record<string, ParallelTask>;
}

function TaskNode({
  task,
  index,
  isSelected,
  onClick,
  getStatusColor,
  getStatusIcon,
  getAgentTypeName,
  allTasks,
}: TaskNodeProps) {
  const StatusIcon = getStatusIcon(task.status);
  const hasDeps = task.dependencies.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* 依赖连接线 */}
      {hasDeps && (
        <div className="flex items-center gap-1 mb-1 ml-4">
          <div className="text-[10px] text-muted-foreground">依赖:</div>
          {task.dependencies.map((depId) => (
            <Badge key={depId} variant="outline" className="text-[10px] h-4">
              {allTasks[depId]?.name || depId.slice(0, 8)}
            </Badge>
          ))}
        </div>
      )}

      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
          isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50',
          task.status === 'completed' && 'opacity-70'
        )}
      >
        {/* 状态指示器 */}
        <div className={cn('flex-shrink-0', getStatusColor(task.status))}>
          <StatusIcon
            className={cn('h-5 w-5', task.status === 'working' && 'animate-spin')}
          />
        </div>

        {/* 任务信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{task.name}</h4>
            <Badge variant="secondary" className="text-[10px]">
              {getAgentTypeName(task.agent_type)}
            </Badge>
            {task.priority > 0 && (
              <Badge variant="outline" className="text-[10px]">
                P{task.priority}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{task.description}</p>
        </div>

        {/* 分配的代理 */}
        {task.assigned_agent && (
          <Badge variant="outline" className="text-xs">
            {task.assigned_agent.slice(0, 8)}
          </Badge>
        )}

        <ChevronRight className={cn('h-4 w-4 transition-transform', isSelected && 'rotate-90')} />
      </div>
    </motion.div>
  );
}

interface AgentCardProps {
  agent: ParallelAgent;
  getStatusColor: (status: AgentStatus) => string;
  getStatusIcon: (status: AgentStatus) => any;
  getAgentTypeName: (type: AgentType) => string;
}

function AgentCard({ agent, getStatusColor, getStatusIcon, getAgentTypeName }: AgentCardProps) {
  const StatusIcon = getStatusIcon(agent.status);

  return (
    <div className="p-2 rounded-lg border bg-background">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('flex-shrink-0', getStatusColor(agent.status))}>
          <StatusIcon
            className={cn('h-4 w-4', agent.status === 'working' && 'animate-spin')}
          />
        </div>
        <span className="text-sm font-medium truncate">{agent.name}</span>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Badge variant="secondary" className="text-[10px] h-4">
          {getAgentTypeName(agent.agent_type)}
        </Badge>
        <span>• {agent.completed_tasks.length} 完成</span>
      </div>

      {agent.current_task && (
        <div className="mt-1 text-[10px] text-blue-500 truncate">
          正在处理: {agent.current_task.slice(0, 16)}...
        </div>
      )}
    </div>
  );
}

interface TaskDetailPanelProps {
  task: ParallelTask;
  onClose: () => void;
  getAgentTypeName: (type: AgentType) => string;
}

function TaskDetailPanel({ task, onClose, getAgentTypeName }: TaskDetailPanelProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-t bg-muted/30 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">{task.name}</h4>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">描述: </span>
            <span>{task.description}</span>
          </div>

          <div>
            <span className="text-muted-foreground">提示词: </span>
            <p className="mt-1 p-2 bg-background rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
              {task.prompt}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">类型: </span>
              <span>{getAgentTypeName(task.agent_type)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">优先级: </span>
              <span>{task.priority}</span>
            </div>
            {task.started_at && (
              <div>
                <span className="text-muted-foreground">开始: </span>
                <span>{new Date(task.started_at).toLocaleTimeString('zh-CN')}</span>
              </div>
            )}
            {task.completed_at && (
              <div>
                <span className="text-muted-foreground">完成: </span>
                <span>{new Date(task.completed_at).toLocaleTimeString('zh-CN')}</span>
              </div>
            )}
          </div>

          {task.error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs">
              <span className="font-medium">错误: </span>
              {task.error}
            </div>
          )}

          {task.result && (
            <div>
              <span className="text-muted-foreground">结果: </span>
              <pre className="mt-1 p-2 bg-background rounded text-[10px] font-mono overflow-x-auto">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
