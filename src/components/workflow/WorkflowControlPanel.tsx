/**
 * WorkflowControlPanel - 工作流主控制面板
 *
 * 集成所有多代理系统功能的主入口
 *
 * 功能：
 * 1. 任务输入和规划
 * 2. 工作流 DAG 可视化
 * 3. 代理状态监控
 * 4. 执行控制
 * 5. 日志和调试
 */

import React, { useState, useCallback, useMemo } from 'react';
import Play from 'lucide-react/dist/esm/icons/play'
import Pause from 'lucide-react/dist/esm/icons/pause'
import Square from 'lucide-react/dist/esm/icons/square'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2'
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import Users from 'lucide-react/dist/esm/icons/users'
import Workflow from 'lucide-react/dist/esm/icons/workflow'
import Zap from 'lucide-react/dist/esm/icons/zap'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader--2'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Brain from 'lucide-react/dist/esm/icons/brain'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { DAGVisualizer } from './DAGVisualizer';
import type {
  WorkflowDAG,
  Agent,
  WorkflowLog,
  WorkflowConfig
} from '@/core/types/workflow';

// ============================================
// 类型定义
// ============================================

interface WorkflowControlPanelProps {
  /** 初始配置 */
  config?: Partial<WorkflowConfig>;
  /** 项目路径 */
  projectPath?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
}

type ExecutionStatus = 'idle' | 'planning' | 'running' | 'paused' | 'completed' | 'failed';

// ============================================
// 工作流执行状态
// ============================================

interface WorkflowState {
  status: ExecutionStatus;
  workflow: WorkflowDAG | null;
  agents: Agent[];
  logs: WorkflowLog[];
  startTime?: number;
  endTime?: number;
  error?: string;
}

const initialState: WorkflowState = {
  status: 'idle',
  workflow: null,
  agents: [],
  logs: []
};

// ============================================
// 子组件
// ============================================

/**
 * 任务输入面板
 */
const TaskInputPanel: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  thinkingLevel: string;
  onThinkingLevelChange: (level: string) => void;
}> = ({ value, onChange, onSubmit, isLoading, thinkingLevel, onThinkingLevelChange }) => {
  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          任务规划
        </CardTitle>
        <CardDescription>
          描述您要完成的任务，AI 将自动分解为可并行执行的工作流
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="例如：创建一个全栈博客系统，包含用户认证、文章CRUD、评论系统和响应式 UI..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] resize-none"
          disabled={isLoading}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">思考深度：</span>
            <Select value={thinkingLevel} onValueChange={onThinkingLevelChange}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="think">标准</SelectItem>
                <SelectItem value="think_hard">深度</SelectItem>
                <SelectItem value="think_harder">更深</SelectItem>
                <SelectItem value="ultrathink">极致</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={onSubmit}
            disabled={!value.trim() || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                规划中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成工作流
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * 代理状态卡片
 */
const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const statusColors = {
    idle: 'bg-green-500',
    busy: 'bg-blue-500 animate-pulse',
    error: 'bg-red-500',
    offline: 'bg-gray-400',
    cloning: 'bg-purple-500 animate-pulse'
  };

  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all',
      agent.status === 'busy' && 'bg-blue-50 dark:bg-blue-900/20 border-blue-200',
      agent.status === 'idle' && 'bg-muted/50',
      agent.status === 'error' && 'bg-red-50 dark:bg-red-900/20 border-red-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', statusColors[agent.status])} />
          <span className="font-medium text-sm">{agent.name}</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {agent.type}
        </Badge>
      </div>

      {agent.currentTask && (
        <div className="text-xs text-muted-foreground mb-2 truncate">
          <Zap className="w-3 h-3 inline mr-1" />
          {agent.currentTask.description}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>完成: {agent.performance.tasksCompleted}</span>
        <span>成功率: {(agent.performance.successRate * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

/**
 * 日志面板
 */
const LogPanel: React.FC<{ logs: WorkflowLog[] }> = ({ logs }) => {
  const levelColors = {
    info: 'text-blue-500',
    warn: 'text-yellow-500',
    error: 'text-red-500',
    debug: 'text-gray-500'
  };

  const levelIcons = {
    info: <CheckCircle className="w-3 h-3" />,
    warn: <AlertTriangle className="w-3 h-3" />,
    error: <XCircle className="w-3 h-3" />,
    debug: <Terminal className="w-3 h-3" />
  };

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-1 p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            暂无日志
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 p-1.5 rounded hover:bg-muted/50',
                levelColors[log.level]
              )}
            >
              <span className="flex-shrink-0 mt-0.5">
                {levelIcons[log.level]}
              </span>
              <span className="text-muted-foreground flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-foreground flex-1">{log.message}</span>
              {log.taskId && (
                <Badge variant="outline" className="text-[9px]">
                  {log.taskId.slice(0, 8)}
                </Badge>
              )}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};

/**
 * 统计面板
 */
const StatsPanel: React.FC<{ workflow: WorkflowDAG | null; agents: Agent[] }> = ({
  workflow,
  agents
}) => {
  const stats = useMemo(() => {
    if (!workflow) return null;

    const tasks = workflow.tasks;
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'queued').length,
      parallelGroups: workflow.parallelGroups.length,
      criticalPathLength: workflow.metadata.criticalPath.length,
      estimatedTime: workflow.metadata.estimatedTotalTime
    };
  }, [workflow]);

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-8">
        等待工作流生成...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">总任务数</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-xs text-muted-foreground">已完成</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-xs text-muted-foreground">进行中</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{agents.length}</div>
          <div className="text-xs text-muted-foreground">活跃代理</div>
        </CardContent>
      </Card>
      <Card className="col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">并行度</span>
            <span className="font-mono font-bold">{stats.parallelGroups}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">关键路径</span>
            <span className="font-mono font-bold">{stats.criticalPathLength} 步</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">预计时间</span>
            <span className="font-mono font-bold">{stats.estimatedTime} 分钟</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// 主组件
// ============================================

export const WorkflowControlPanel: React.FC<WorkflowControlPanelProps> = ({
  config: _config,
  projectPath: _projectPath,
  onClose,
  className
}) => {
  // 状态
  const [state, setState] = useState<WorkflowState>(initialState);
  const [taskInput, setTaskInput] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('ultrathink');
  const [activeTab, setActiveTab] = useState<string>('workflow');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // 计算进度
  const progress = useMemo(() => {
    if (!state.workflow) return 0;
    const total = state.workflow.tasks.length;
    const completed = state.workflow.tasks.filter(t => t.status === 'completed').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [state.workflow]);

  // 生成工作流
  const handleGenerateWorkflow = useCallback(async () => {
    if (!taskInput.trim()) return;

    setState(prev => ({ ...prev, status: 'planning' }));
    addLog('info', '开始分析任务并生成工作流...');

    try {
      // 这里将调用 TaskPlanner
      // const planner = new TaskPlanner(config);
      // const result = await planner.generateWorkflowDAG(taskInput);

      // 模拟工作流生成
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockWorkflow: WorkflowDAG = {
        metadata: {
          id: 'workflow-' + Date.now(),
          name: taskInput.slice(0, 50),
          description: taskInput,
          version: '1.0.0',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'TaskPlanner',
          tags: ['react', 'typescript'],
          estimatedTotalTime: 30,
          parallelismLevel: 3,
          criticalPath: ['task-1', 'task-3', 'task-5'],
          complexity: 'moderate'
        },
        tasks: [
          {
            id: 'task-1',
            description: '初始化项目结构',
            type: 'sequential',
            priority: 'high',
            dependencies: [],
            dependents: ['task-2', 'task-3'],
            estimatedComplexity: 2,
            requiredSkills: ['project-setup'],
            requiredTools: ['npm', 'git'],
            status: 'pending',
            progress: 0,
            metrics: { retryCount: 0 },
            metadata: { suggestedAgentType: 'devops' }
          },
          {
            id: 'task-2',
            description: '创建前端组件架构',
            type: 'parallel',
            priority: 'high',
            dependencies: ['task-1'],
            dependents: ['task-4'],
            estimatedComplexity: 4,
            requiredSkills: ['react', 'typescript', 'ui-ux'],
            requiredTools: ['npm', 'vite'],
            status: 'pending',
            progress: 0,
            metrics: { retryCount: 0 },
            metadata: { suggestedAgentType: 'frontend' }
          },
          {
            id: 'task-3',
            description: '设计后端 API 接口',
            type: 'parallel',
            priority: 'high',
            dependencies: ['task-1'],
            dependents: ['task-4'],
            estimatedComplexity: 3,
            requiredSkills: ['api-design', 'database'],
            requiredTools: ['node', 'postgresql'],
            status: 'pending',
            progress: 0,
            metrics: { retryCount: 0 },
            metadata: { suggestedAgentType: 'backend' }
          },
          {
            id: 'task-4',
            description: '集成前后端',
            type: 'sequential',
            priority: 'medium',
            dependencies: ['task-2', 'task-3'],
            dependents: ['task-5'],
            estimatedComplexity: 3,
            requiredSkills: ['full-stack', 'integration'],
            requiredTools: ['npm'],
            status: 'pending',
            progress: 0,
            metrics: { retryCount: 0 },
            metadata: { suggestedAgentType: 'fullstack' }
          },
          {
            id: 'task-5',
            description: '编写测试用例',
            type: 'sequential',
            priority: 'medium',
            dependencies: ['task-4'],
            dependents: [],
            estimatedComplexity: 3,
            requiredSkills: ['testing', 'e2e'],
            requiredTools: ['jest', 'playwright'],
            status: 'pending',
            progress: 0,
            metrics: { retryCount: 0 },
            metadata: { suggestedAgentType: 'testing' }
          }
        ],
        edges: [
          { id: 'e1-2', from: 'task-1', to: 'task-2', type: 'dependency' },
          { id: 'e1-3', from: 'task-1', to: 'task-3', type: 'dependency' },
          { id: 'e2-4', from: 'task-2', to: 'task-4', type: 'dependency' },
          { id: 'e3-4', from: 'task-3', to: 'task-4', type: 'dependency' },
          { id: 'e4-5', from: 'task-4', to: 'task-5', type: 'dependency' }
        ],
        parallelGroups: [['task-2', 'task-3']],
        entryPoints: ['task-1'],
        exitPoints: ['task-5']
      };

      setState(prev => ({
        ...prev,
        status: 'idle',
        workflow: mockWorkflow
      }));

      addLog('info', `工作流生成完成: ${mockWorkflow.tasks.length} 个任务, ${mockWorkflow.parallelGroups.length} 个并行组`);

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: error.message
      }));
      addLog('error', `工作流生成失败: ${error.message}`);
    }
  }, [taskInput, thinkingLevel]);

  // 开始执行
  const handleStartExecution = useCallback(async () => {
    if (!state.workflow) return;

    setState(prev => ({
      ...prev,
      status: 'running',
      startTime: Date.now()
    }));

    addLog('info', '开始执行工作流...');

    // 模拟创建代理
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Frontend-Agent',
        type: 'frontend',
        status: 'idle',
        capabilities: {
          languages: ['typescript', 'javascript'],
          frameworks: ['react', 'tailwind'],
          tools: ['npm', 'vite'],
          specializations: ['ui-ux']
        },
        performance: {
          tasksCompleted: 0,
          tasksFailed: 0,
          avgCompletionTime: 0,
          avgTokenUsage: 0,
          successRate: 1,
          lastActiveAt: Date.now()
        },
        taskQueue: [],
        isClone: false,
        createdAt: Date.now(),
        metadata: {}
      },
      {
        id: 'agent-2',
        name: 'Backend-Agent',
        type: 'backend',
        status: 'idle',
        capabilities: {
          languages: ['typescript', 'python'],
          frameworks: ['express', 'fastapi'],
          tools: ['docker', 'postgresql'],
          specializations: ['api-design']
        },
        performance: {
          tasksCompleted: 0,
          tasksFailed: 0,
          avgCompletionTime: 0,
          avgTokenUsage: 0,
          successRate: 1,
          lastActiveAt: Date.now()
        },
        taskQueue: [],
        isClone: false,
        createdAt: Date.now(),
        metadata: {}
      }
    ];

    setState(prev => ({ ...prev, agents: mockAgents }));
    addLog('info', `创建了 ${mockAgents.length} 个代理`);

    // 模拟执行
    // 这里将调用 AgentSwarmManager
  }, [state.workflow]);

  // 暂停/继续
  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    addLog('info', isPaused ? '工作流继续执行' : '工作流已暂停');
  }, [isPaused]);

  // 停止执行
  const handleStop = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      endTime: Date.now()
    }));
    addLog('info', '工作流已停止');
  }, []);

  // 添加日志
  const addLog = useCallback((level: WorkflowLog['level'], message: string, taskId?: string) => {
    const log: WorkflowLog = {
      timestamp: Date.now(),
      level,
      message,
      taskId
    };
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, log].slice(-500) // 保留最新 500 条
    }));
  }, []);

  return (
    <div className={cn(
      'flex flex-col h-full bg-background',
      isFullscreen && 'fixed inset-0 z-50',
      className
    )}>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Workflow className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">多代理工作流</h2>
          <Badge variant={
            state.status === 'running' ? 'default' :
            state.status === 'completed' ? 'secondary' :
            state.status === 'failed' ? 'destructive' :
            'outline'
          }>
            {state.status === 'idle' && '就绪'}
            {state.status === 'planning' && '规划中'}
            {state.status === 'running' && '执行中'}
            {state.status === 'paused' && '已暂停'}
            {state.status === 'completed' && '已完成'}
            {state.status === 'failed' && '失败'}
          </Badge>
          {state.status === 'running' && (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="w-24 h-2" />
              <span className="text-sm font-mono">{progress}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state.workflow && state.status === 'idle' && (
            <Button onClick={handleStartExecution} className="gap-2">
              <Play className="w-4 h-4" />
              开始执行
            </Button>
          )}
          {state.status === 'running' && (
            <>
              <Button variant="outline" onClick={handleTogglePause} className="gap-2">
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? '继续' : '暂停'}
              </Button>
              <Button variant="destructive" onClick={handleStop} className="gap-2">
                <Square className="w-4 h-4" />
                停止
              </Button>
            </>
          )}

          <Separator orientation="vertical" className="h-6" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? '退出全屏' : '全屏'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 */}
        <div className="w-[25%] min-w-[250px] max-w-[400px] flex-shrink-0">
          <div className="flex flex-col h-full border-r">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b px-2">
                <TabsTrigger value="workflow" className="gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  工作流
                </TabsTrigger>
                <TabsTrigger value="agents" className="gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  代理
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  统计
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="workflow" className="p-4 space-y-4 mt-0">
                  <TaskInputPanel
                    value={taskInput}
                    onChange={setTaskInput}
                    onSubmit={handleGenerateWorkflow}
                    isLoading={state.status === 'planning'}
                    thinkingLevel={thinkingLevel}
                    onThinkingLevelChange={setThinkingLevel}
                  />

                  {state.workflow && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">工作流信息</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">任务数</span>
                          <span className="font-mono">{state.workflow.tasks.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">并行组</span>
                          <span className="font-mono">{state.workflow.parallelGroups.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">复杂度</span>
                          <Badge variant="outline">{state.workflow.metadata.complexity}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="agents" className="p-4 space-y-3 mt-0">
                  {state.agents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      执行工作流后将自动创建代理
                    </div>
                  ) : (
                    state.agents.map(agent => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="stats" className="p-4 mt-0">
                  <StatsPanel workflow={state.workflow} agents={state.agents} />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* 日志面板 */}
            <div className="border-t">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Terminal className="w-4 h-4" />
                  日志
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {state.logs.length}
                </Badge>
              </div>
              <LogPanel logs={state.logs} />
            </div>
          </div>
        </div>

        {/* 右侧 - DAG 可视化 */}
        <div className="flex-1">
          {state.workflow ? (
            <DAGVisualizer
              workflow={state.workflow}
              agents={state.agents}
              liveUpdate={state.status === 'running'}
              isPaused={isPaused}
              onTogglePause={handleTogglePause}
              onFullscreen={() => setIsFullscreen(true)}
              onTaskClick={(task) => {
                addLog('info', `选中任务: ${task.description}`);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Workflow className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">尚未生成工作流</h3>
              <p className="text-sm text-center max-w-md">
                在左侧输入您的任务描述，AI 将自动分解为可并行执行的工作流图
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowControlPanel;
