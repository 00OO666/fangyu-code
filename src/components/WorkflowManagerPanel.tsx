/**
 * Workflow Manager Panel - 统一工作流管理面板
 *
 * 使用 useUnifiedWorkflow Hook 管理和可视化工作流执行
 *
 * 功能：
 * 1. 需求输入和工作流生成
 * 2. DAG 可视化
 * 3. 暂停/恢复/重试/取消控制
 * 4. 实时进度显示
 * 5. 执行日志面板
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RotateCcw, Square, CheckCircle, XCircle, Clock, Loader2, AlertCircle, ChevronRight, GitBranch, Users, Zap, Settings } from 'lucide-react';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import type { Task, WorkflowLog } from '@/core/types/workflow';

// ============================================
// 类型定义
// ============================================

interface WorkflowManagerPanelProps {
  /** API Key（可选，默认从 localStorage 读取） */
  apiKey?: string;
  /** API Base URL（可选） */
  apiBaseUrl?: string;
  /** 工作流模式 */
  mode?: 'simple' | 'advanced';
  /** 最大并发任务数 */
  maxConcurrentTasks?: number;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 状态徽章
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    idle: { variant: 'secondary', label: '空闲' },
    planning: { variant: 'default', label: '规划中' },
    executing: { variant: 'default', label: '执行中' },
    paused: { variant: 'outline', label: '已暂停' },
    completed: { variant: 'secondary', label: '已完成' },
    failed: { variant: 'destructive', label: '失败' },
    cancelled: { variant: 'outline', label: '已取消' },
  };

  const config = variants[status] || { variant: 'secondary' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

/**
 * 任务状态图标
 */
const TaskStatusIcon: React.FC<{ status: Task['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'cancelled':
      return <Square className="h-4 w-4 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

/**
 * 日志级别图标
 */
const LogLevelIcon: React.FC<{ level: WorkflowLog['level'] }> = ({ level }) => {
  switch (level) {
    case 'error':
      return <XCircle className="h-3 w-3 text-red-500" />;
    case 'warn':
      return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    case 'debug':
      return <Settings className="h-3 w-3 text-gray-400" />;
    default:
      return <ChevronRight className="h-3 w-3 text-blue-500" />;
  }
};

// ============================================
// 主组件
// ============================================

export const WorkflowManagerPanel: React.FC<WorkflowManagerPanelProps> = ({
  apiKey,
  apiBaseUrl,
  mode = 'advanced',
  maxConcurrentTasks = 5,
}) => {
  // 本地状态
  const [requirements, setRequirements] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');

  // 使用统一工作流 Hook
  const {
    state,
    workflow,
    progress,
    logs,
    error,
    agents,
    isLoading,
    generateWorkflow,
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    retryTask,
  } = useUnifiedWorkflow({
    apiKey,
    apiBaseUrl,
    mode,
    maxConcurrentTasks,
    autoInitialize: false,
  });

  // 处理生成工作流
  const handleGenerate = useCallback(async () => {
    if (!requirements.trim()) return;

    try {
      await generateWorkflow(requirements, { mode });
    } catch (err) {
      logger.error('WorkflowManagerPanel', '生成工作流失败:', err);
    }
  }, [requirements, mode, generateWorkflow]);

  // 处理开始执行
  const handleStart = useCallback(async () => {
    try {
      await startExecution();
    } catch (err) {
      logger.error('WorkflowManagerPanel', '开始执行失败:', err);
    }
  }, [startExecution]);

  // 处理暂停
  const handlePause = useCallback(() => {
    pauseExecution();
  }, [pauseExecution]);

  // 处理恢复
  const handleResume = useCallback(async () => {
    try {
      await resumeExecution();
    } catch (err) {
      logger.error('WorkflowManagerPanel', '恢复执行失败:', err);
    }
  }, [resumeExecution]);

  // 处理取消
  const handleCancel = useCallback(async () => {
    try {
      await cancelExecution();
    } catch (err) {
      logger.error('WorkflowManagerPanel', '取消执行失败:', err);
    }
  }, [cancelExecution]);

  // 处理重试任务
  const handleRetry = useCallback(async (taskId: string) => {
    try {
      await retryTask(taskId);
    } catch (err) {
      logger.error('WorkflowManagerPanel', '重试任务失败:', err);
    }
  }, [retryTask]);

  // 计算统计信息
  const stats = useMemo(() => ({
    totalTasks: workflow?.tasks.length || 0,
    parallelGroups: workflow?.parallelGroups.length || 0,
    criticalPathLength: workflow?.metadata.criticalPath.length || 0,
    activeAgents: agents.filter(a => a.status === 'busy').length,
    totalAgents: agents.length,
  }), [workflow, agents]);

  // 是否可以执行操作
  const canGenerate = requirements.trim().length > 0 && state === 'idle';
  const canStart = workflow && (state === 'idle' || state === 'completed' || state === 'failed' || state === 'cancelled');
  const canPause = state === 'executing';
  const canResume = state === 'paused';
  const canCancel = state === 'executing' || state === 'paused';

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              统一工作流引擎
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              智能任务分解 · 多代理并行执行 · 实时进度追踪
            </p>
          </div>
          <StatusBadge status={state} />
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 px-6 py-4 space-y-4 overflow-auto">
        {/* 需求输入 */}
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">需求描述</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="描述你的开发需求，系统将自动分解为可执行的任务..."
              className="w-full h-24 p-3 border rounded-md resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              disabled={isLoading || state === 'executing'}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isLoading}
              variant="outline"
            >
              {isLoading && state === 'planning' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-2" />
                  生成工作流
                </>
              )}
            </Button>

            <Button
              onClick={handleStart}
              disabled={!canStart || isLoading}
            >
              <Play className="h-4 w-4 mr-2" />
              开始执行
            </Button>

            {canPause && (
              <Button onClick={handlePause} variant="outline">
                <Pause className="h-4 w-4 mr-2" />
                暂停
              </Button>
            )}

            {canResume && (
              <Button onClick={handleResume} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                恢复
              </Button>
            )}

            {canCancel && (
              <Button onClick={handleCancel} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                取消
              </Button>
            )}
          </div>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-red-900 dark:text-red-100">执行失败</div>
                <div className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</div>
              </div>
            </div>
          </Card>
        )}

        {/* 进度条 */}
        {workflow && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">执行进度</span>
              <span className="text-sm text-muted-foreground">
                {progress.completedTasks}/{progress.totalTasks} 任务完成
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                完成: {progress.completedTasks}
              </span>
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 text-blue-500" />
                进行中: {progress.inProgressTasks}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                失败: {progress.failedTasks}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                等待: {progress.pendingTasks}
              </span>
            </div>
          </Card>
        )}

        {/* 统计信息 */}
        {workflow && (
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{stats.totalTasks}</div>
              <div className="text-xs text-muted-foreground">总任务数</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{stats.parallelGroups}</div>
              <div className="text-xs text-muted-foreground">并行组</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{stats.criticalPathLength}</div>
              <div className="text-xs text-muted-foreground">关键路径</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                <Users className="h-4 w-4" />
                {stats.activeAgents}/{stats.totalAgents}
              </div>
              <div className="text-xs text-muted-foreground">活跃代理</div>
            </Card>
          </div>
        )}

        {/* 详情标签页 */}
        {workflow && (
          <Card className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="tasks">任务列表</TabsTrigger>
                <TabsTrigger value="dag">DAG 视图</TabsTrigger>
                <TabsTrigger value="agents">代理状态</TabsTrigger>
                <TabsTrigger value="logs">执行日志</TabsTrigger>
              </TabsList>

              {/* 任务列表 */}
              <TabsContent value="tasks">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {workflow.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <TaskStatusIcon status={task.status} />
                          <div>
                            <div className="text-sm font-medium">{task.description}</div>
                            <div className="text-xs text-muted-foreground">
                              复杂度: {task.estimatedComplexity} · 依赖: {task.dependencies.length}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.assignedAgentId && (
                            <Badge variant="outline" className="text-xs">
                              {task.assignedAgentId}
                            </Badge>
                          )}
                          {task.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRetry(task.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* DAG 视图 */}
              <TabsContent value="dag">
                <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/20">
                  <div className="text-center text-muted-foreground">
                    <GitBranch className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-sm">DAG 可视化</div>
                    <div className="text-xs mt-1">
                      入口: {workflow.entryPoints.join(', ')} →
                      出口: {workflow.exitPoints.join(', ')}
                    </div>
                    <div className="text-xs mt-1">
                      关键路径: {workflow.metadata.criticalPath.join(' → ')}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 代理状态 */}
              <TabsContent value="agents">
                <ScrollArea className="h-64">
                  {agents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Users className="h-8 w-8 mx-auto mb-2" />
                      <div className="text-sm">暂无活跃代理</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${agent.status === 'busy' ? 'bg-green-500' :
                              agent.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                              }`} />
                            <div>
                              <div className="text-sm font-medium">{agent.name}</div>
                              <div className="text-xs text-muted-foreground">
                                类型: {agent.type}
                              </div>
                            </div>
                          </div>
                          <Badge variant={agent.status === 'busy' ? 'default' : 'secondary'}>
                            {agent.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* 执行日志 */}
              <TabsContent value="logs">
                <ScrollArea className="h-64">
                  <div className="space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        暂无日志
                      </div>
                    ) : (
                      logs.slice(-100).map((log, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-2 p-1 rounded ${log.level === 'error' ? 'bg-red-50 dark:bg-red-950/20' :
                            log.level === 'warn' ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                            }`}
                        >
                          <LogLevelIcon level={log.level} />
                          <span className="text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="flex-1">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkflowManagerPanel;
