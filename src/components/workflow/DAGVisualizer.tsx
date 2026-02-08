/**
 * DAGVisualizer - 工作流 DAG 可视化组件
 *
 * 基于 React Flow 实现的交互式工作流图
 *
 * 功能：
 * 1. 自动布局（Dagre 算法）
 * 2. 实时状态更新
 * 3. 关键路径高亮
 * 4. 代理活动监控
 * 5. 交互式节点操作
 *
 * 灵感来源：
 * - Windsurf Codemaps
 * - n8n 工作流编辑器
 * - React Flow 官方示例
 */

import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  ConnectionMode,
} from "reactflow";
import dagre from "dagre";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Users,
  Zap,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Maximize2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowDAG, Task, TaskStatus, Agent } from "@/core/types/workflow";

import "reactflow/dist/style.css";

// ============================================
// 类型定义
// ============================================

interface DAGVisualizerProps {
  /** 工作流 DAG 数据 */
  workflow: WorkflowDAG;
  /** 代理列表 */
  agents?: Agent[];
  /** 是否实时更新 */
  liveUpdate?: boolean;
  /** 节点点击回调 */
  onTaskClick?: (task: Task) => void;
  /** 任务重试回调 */
  onTaskRetry?: (taskId: string) => void;
  /** 任务取消回调 */
  onTaskCancel?: (taskId: string) => void;
  /** 工作流暂停/恢复 */
  onTogglePause?: () => void;
  /** 是否暂停 */
  isPaused?: boolean;
  /** 全屏回调 */
  onFullscreen?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface TaskNodeData extends Task {
  isOnCriticalPath?: boolean;
  agent?: Agent;
}

// ============================================
// 节点样式配置
// ============================================

const STATUS_STYLES: Record<
  TaskStatus,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
  }
> = {
  pending: {
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-300 dark:border-slate-600",
    text: "text-slate-600 dark:text-slate-400",
    icon: <Clock className="w-4 h-4" />,
  },
  queued: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-300 dark:border-yellow-600",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: <Clock className="w-4 h-4" />,
  },
  in_progress: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-400 dark:border-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  completed: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-400 dark:border-green-500",
    text: "text-green-600 dark:text-green-400",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  failed: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-400 dark:border-red-500",
    text: "text-red-600 dark:text-red-400",
    icon: <XCircle className="w-4 h-4" />,
  },
  cancelled: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-400 dark:border-gray-600",
    text: "text-gray-500 dark:text-gray-400",
    icon: <XCircle className="w-4 h-4" />,
  },
};

const PRIORITY_COLORS = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-blue-200 text-blue-700",
  high: "bg-orange-200 text-orange-700",
  critical: "bg-red-200 text-red-700",
};

// ============================================
// 自定义节点组件
// ============================================

const TaskNodeComponent: React.FC<NodeProps<TaskNodeData>> = memo(({ data, selected }) => {
  const style = STATUS_STYLES[data.status];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "relative min-w-[280px] max-w-[350px] rounded-xl border-2 shadow-lg transition-all duration-200",
        style.bg,
        style.border,
        selected && "ring-2 ring-primary ring-offset-2",
        data.isOnCriticalPath && "ring-2 ring-amber-400 ring-offset-1",
        data.status === "in_progress" && "animate-pulse"
      )}
    >
      {/* 输入 Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />

      {/* 头部 */}
      <div className="flex items-start justify-between p-3 border-b border-inherit">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn("flex-shrink-0", style.text)}>{style.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate text-foreground">{data.description}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", PRIORITY_COLORS[data.priority])}
              >
                {data.priority}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {"★".repeat(data.estimatedComplexity)}
              </span>
              {data.isOnCriticalPath && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300"
                >
                  <Target className="w-2.5 h-2.5 mr-0.5" />
                  关键路径
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <RefreshCw className="w-4 h-4 mr-2" />
              重试任务
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <XCircle className="w-4 h-4 mr-2" />
              取消任务
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 进度条（仅执行中） */}
      {data.status === "in_progress" && (
        <div className="px-3 py-2 border-b border-inherit">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">进度</span>
            <span className="font-mono">{data.progress}%</span>
          </div>
          <Progress value={data.progress} className="h-1.5" />
        </div>
      )}

      {/* 代理信息 */}
      {data.agent && (
        <div className="px-3 py-2 border-b border-inherit bg-muted/30">
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{data.agent.name}</span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {data.agent.type}
            </Badge>
          </div>
        </div>
      )}

      {/* 详情展开 */}
      <div className="px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {data.requiredSkills.length} 技能 · {data.requiredTools.length} 工具 ·{" "}
          {data.dependencies.length} 依赖
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 text-xs">
                {data.requiredSkills.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">所需技能：</div>
                    <div className="flex flex-wrap gap-1">
                      {data.requiredSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.requiredTools.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">所需工具：</div>
                    <div className="flex flex-wrap gap-1">
                      {data.requiredTools.map((tool) => (
                        <Badge key={tool} variant="outline" className="text-[10px]">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.subtasks && data.subtasks.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">
                      子任务 ({data.subtasks.length})：
                    </div>
                    <ul className="space-y-1 pl-3">
                      {data.subtasks.slice(0, 3).map((sub, i) => (
                        <li key={i} className="text-muted-foreground truncate">
                          • {sub.description}
                        </li>
                      ))}
                      {data.subtasks.length > 3 && (
                        <li className="text-muted-foreground">
                          ... 还有 {data.subtasks.length - 3} 个
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 执行时间 */}
      {data.metrics.duration && (
        <div className="px-3 py-2 border-t border-inherit bg-muted/30 text-xs text-muted-foreground">
          执行时间: {(data.metrics.duration / 1000).toFixed(1)}s
        </div>
      )}

      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />
    </motion.div>
  );
});

TaskNodeComponent.displayName = "TaskNode";

// 节点类型映射
const nodeTypes = {
  taskNode: TaskNodeComponent,
};

// ============================================
// 布局计算
// ============================================

const getLayoutedElements = (
  workflow: WorkflowDAG,
  agents: Agent[] = [],
  direction: "TB" | "LR" = "TB"
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 100,
    nodesep: 50,
    marginx: 50,
    marginy: 50,
  });

  const criticalPathSet = new Set(workflow.metadata.criticalPath);

  // 创建节点
  const nodes: Node<TaskNodeData>[] = workflow.tasks.map((task) => {
    const agent = agents.find((a) => a.id === task.assignedAgentId);

    dagreGraph.setNode(task.id, { width: 300, height: 180 });

    return {
      id: task.id,
      type: "taskNode",
      position: { x: 0, y: 0 },
      data: {
        ...task,
        isOnCriticalPath: criticalPathSet.has(task.id),
        agent,
      },
    };
  });

  // 创建边
  const edges: Edge[] = workflow.edges.map((edge) => {
    dagreGraph.setEdge(edge.from, edge.to);

    const isOnCriticalPath = criticalPathSet.has(edge.from) && criticalPathSet.has(edge.to);

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      animated: workflow.tasks.find((t) => t.id === edge.to)?.status === "in_progress",
      style: {
        strokeWidth: isOnCriticalPath ? 3 : 2,
        stroke: isOnCriticalPath ? "#f59e0b" : "#6366f1",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isOnCriticalPath ? "#f59e0b" : "#6366f1",
      },
      label: edge.label,
      labelStyle: { fontSize: 10 },
    };
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 应用位置
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 90,
    };
  });

  return { nodes, edges };
};

// ============================================
// 主组件
// ============================================

export const DAGVisualizer: React.FC<DAGVisualizerProps> = ({
  workflow,
  agents = [],
  liveUpdate: _liveUpdate = true,
  onTaskClick,
  onTaskRetry: _onTaskRetry,
  onTaskCancel: _onTaskCancel,
  onTogglePause,
  isPaused = false,
  onFullscreen,
  className,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [_selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 计算统计数据
  const stats = useMemo(() => {
    const total = workflow.tasks.length;
    const completed = workflow.tasks.filter((t) => t.status === "completed").length;
    const inProgress = workflow.tasks.filter((t) => t.status === "in_progress").length;
    const failed = workflow.tasks.filter((t) => t.status === "failed").length;
    const pending = workflow.tasks.filter(
      (t) => t.status === "pending" || t.status === "queued"
    ).length;

    return {
      total,
      completed,
      inProgress,
      failed,
      pending,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [workflow.tasks]);

  // 初始化和更新布局
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(workflow, agents);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [workflow, agents, setNodes, setEdges]);

  // 节点点击处理
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<TaskNodeData>) => {
      const task = workflow.tasks.find((t) => t.id === node.id);
      if (task) {
        setSelectedTask(task);
        onTaskClick?.(task);
      }
    },
    [workflow.tasks, onTaskClick]
  );

  return (
    <div className={cn("relative w-full h-full bg-background", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as TaskNodeData).status;
            switch (status) {
              case "completed":
                return "#22c55e";
              case "in_progress":
                return "#3b82f6";
              case "failed":
                return "#ef4444";
              default:
                return "#94a3b8";
            }
          }}
          maskColor="rgba(0,0,0,0.1)"
        />

        {/* 顶部工具栏 */}
        <Panel position="top-left">
          <div className="bg-card/95 backdrop-blur-sm border rounded-xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{workflow.metadata.name}</h3>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onTogglePause}
                      >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isPaused ? "继续执行" : "暂停执行"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {onFullscreen && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={onFullscreen}
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>全屏</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* 进度条 */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">整体进度</span>
                <span className="font-mono font-medium">{stats.progress}%</span>
              </div>
              <Progress value={stats.progress} className="h-2" />
            </div>

            {/* 任务统计 */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{stats.completed}</div>
                <div className="text-[10px] text-muted-foreground">已完成</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <div className="text-lg font-bold text-blue-600">{stats.inProgress}</div>
                <div className="text-[10px] text-muted-foreground">进行中</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/10">
                <div className="text-lg font-bold text-slate-600">{stats.pending}</div>
                <div className="text-[10px] text-muted-foreground">等待中</div>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <div className="text-lg font-bold text-red-600">{stats.failed}</div>
                <div className="text-[10px] text-muted-foreground">失败</div>
              </div>
            </div>
          </div>
        </Panel>

        {/* 右侧面板 - 代理状态 */}
        <Panel position="top-right">
          <div className="bg-card/95 backdrop-blur-sm border rounded-xl shadow-lg p-4 max-w-[280px]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">活跃代理</h3>
              <Badge variant="secondary" className="ml-auto">
                {agents.filter((a) => a.status === "busy").length}/{agents.length}
              </Badge>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {agents.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">暂无活跃代理</div>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      agent.status === "busy" && "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
                      agent.status === "idle" && "bg-muted/50 border-transparent",
                      agent.status === "error" && "bg-red-50 dark:bg-red-900/20 border-red-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            agent.status === "busy" && "bg-blue-500 animate-pulse",
                            agent.status === "idle" && "bg-green-500",
                            agent.status === "error" && "bg-red-500"
                          )}
                        />
                        <span className="text-xs font-medium">{agent.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {agent.type}
                      </Badge>
                    </div>
                    {agent.currentTask && (
                      <div className="mt-1.5 text-[10px] text-muted-foreground truncate">
                        <Zap className="w-3 h-3 inline mr-1" />
                        {agent.currentTask.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>

        {/* 底部面板 - 关键路径 */}
        <Panel position="bottom-center">
          <div className="bg-card/95 backdrop-blur-sm border rounded-xl shadow-lg px-4 py-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium">关键路径</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {workflow.metadata.criticalPath.slice(0, 5).map((taskId, i) => {
                const task = workflow.tasks.find((t) => t.id === taskId);
                return (
                  <React.Fragment key={taskId}>
                    {i > 0 && <span className="text-muted-foreground">→</span>}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        task?.status === "completed" && "bg-green-100 border-green-300",
                        task?.status === "in_progress" &&
                          "bg-blue-100 border-blue-300 animate-pulse"
                      )}
                    >
                      {task?.description.slice(0, 15)}...
                    </Badge>
                  </React.Fragment>
                );
              })}
              {workflow.metadata.criticalPath.length > 5 && (
                <span className="text-muted-foreground">
                  +{workflow.metadata.criticalPath.length - 5} more
                </span>
              )}
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              预计 {workflow.metadata.estimatedTotalTime} 分钟
            </div>
          </div>
        </Panel>

        {/* 图例 */}
        <Panel position="bottom-left">
          <div className="bg-card/95 backdrop-blur-sm border rounded-xl shadow-lg p-3">
            <div className="text-[10px] font-medium mb-2 text-muted-foreground">图例</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>等待中</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span>执行中</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span>已完成</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>失败</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2 mt-1 pt-1 border-t">
                <div className="w-4 h-0.5 bg-amber-400" />
                <span>关键路径</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default DAGVisualizer;
