/**
 * AgentDashboard - Agent 仪表板组件
 * 
 * 显示 Agent 池状态、任务队列、后台任务
 * 
 * Requirements: 1.7, 6.6
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Play, Pause, Square, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Users, ListTodo, Activity } from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

interface AgentInfo {
  id: string;
  role: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  completedTasks: number;
  createdAt: number;
}

interface TaskInfo {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent?: string;
  createdAt: number;
  completedAt?: number;
}

interface BackgroundTaskInfo {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  startedAt: number;
  estimatedCompletion?: number;
}

interface AgentDashboardProps {
  agents?: AgentInfo[];
  tasks?: TaskInfo[];
  backgroundTasks?: BackgroundTaskInfo[];
  onRefresh?: () => void;
  onCancelTask?: (taskId: string) => void;
  onPauseBackground?: (taskId: string) => void;
  onResumeBackground?: (taskId: string) => void;
}

// =============================================================================
// 辅助组件
// =============================================================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    idle: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
    busy: { variant: 'default', icon: <Activity className="w-3 h-3" /> },
    running: { variant: 'default', icon: <Play className="w-3 h-3" /> },
    pending: { variant: 'outline', icon: <Clock className="w-3 h-3" /> },
    completed: { variant: 'secondary', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
    error: { variant: 'destructive', icon: <AlertCircle className="w-3 h-3" /> },
    paused: { variant: 'outline', icon: <Pause className="w-3 h-3" /> },
  };

  const config = variants[status] ?? { variant: 'outline' as const, icon: null };

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {status}
    </Badge>
  );
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};


// =============================================================================
// 主组件
// =============================================================================

export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  agents = [],
  tasks = [],
  backgroundTasks = [],
  onRefresh,
  onCancelTask,
  onPauseBackground,
  onResumeBackground,
}) => {
  const [activeTab, setActiveTab] = useState('agents');

  // 统计数据
  const stats = {
    totalAgents: agents.length,
    busyAgents: agents.filter(a => a.status === 'busy').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    runningTasks: tasks.filter(t => t.status === 'running').length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    runningBackground: backgroundTasks.filter(t => t.status === 'running').length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* 头部统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold">{stats.busyAgents}/{stats.totalAgents}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{stats.pendingTasks}</p>
              </div>
              <ListTodo className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold">{stats.runningTasks}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Background</p>
                <p className="text-2xl font-bold">{stats.runningBackground}</p>
              </div>
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 刷新按钮 */}
      {onRefresh && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="agents">
            <Users className="w-4 h-4 mr-2" />
            Agents ({stats.totalAgents})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="w-4 h-4 mr-2" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="background">
            <Bot className="w-4 h-4 mr-2" />
            Background ({backgroundTasks.length})
          </TabsTrigger>
        </TabsList>

        {/* Agents 列表 */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Agent Pool</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {agents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No agents active</p>
                ) : (
                  <div className="space-y-2">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="w-5 h-5" />
                          <div>
                            <p className="font-medium">{agent.role}</p>
                            <p className="text-sm text-muted-foreground">
                              {agent.currentTask ?? 'Idle'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {agent.completedTasks} completed
                          </span>
                          <StatusBadge status={agent.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks 列表 */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Task Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tasks in queue</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{task.description}</p>
                            <Badge variant="outline">P{task.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {task.assignedAgent ? `Assigned to ${task.assignedAgent}` : 'Unassigned'}
                            {' • '}
                            {formatTime(task.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={task.status} />
                          {task.status === 'pending' && onCancelTask && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCancelTask(task.id)}
                            >
                              <Square className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Background Tasks 列表 */}
        <TabsContent value="background">
          <Card>
            <CardHeader>
              <CardTitle>Background Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {backgroundTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No background tasks</p>
                ) : (
                  <div className="space-y-4">
                    {backgroundTasks.map(task => (
                      <div key={task.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{task.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Started {formatTime(task.startedAt)}
                              {task.estimatedCompletion && (
                                <> • ETA {formatDuration(task.estimatedCompletion - Date.now())}</>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={task.status} />
                            {task.status === 'running' && onPauseBackground && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPauseBackground(task.id)}
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            )}
                            {task.status === 'paused' && onResumeBackground && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResumeBackground(task.id)}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">
                          {task.progress}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentDashboard;
