/**
 * useWorkflowOrchestrator - 工作流编排 Hook
 *
 * 统一管理工作流的完整生命周期
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentSwarmManager } from "@/core/agents/AgentSwarmManager";
import { DEFAULT_PLANNER_CONFIG, TaskPlanner } from "@/core/planning/TaskPlanner";
import { SandboxManager } from "@/core/sandbox/SandboxManager";
import { DEFAULT_WORKFLOW_CONFIG } from "@/core/types/workflow";
import type {
  Agent,
  Task,
  WorkflowConfig,
  WorkflowDAG,
  WorkflowEvent,
  WorkflowLog,
} from "@/core/types/workflow";

// ============================================
// 类型定义
// ============================================

export interface WorkflowOrchestrator {
  // 状态
  workflow: WorkflowDAG | null;
  agents: Agent[];
  isPlanning: boolean;
  isRunning: boolean;
  isPaused: boolean;
  logs: WorkflowLog[];
  error: string | null;

  // 操作
  generateWorkflow: (prompt: string, ultrathink?: boolean) => Promise<WorkflowDAG | void>;
  startExecution: () => Promise<void>;
  pauseExecution: () => void;
  resumeExecution: () => Promise<void>;
  stopExecution: () => void;
  retryTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;

  // 监控
  getTaskStatus: (taskId: string) => Task | undefined;
  getAgentStatus: (agentId: string) => Agent | undefined;
}

export interface UseWorkflowOrchestratorOptions {
  config?: Partial<WorkflowConfig>;
  projectPath?: string;
  onWorkflowGenerated?: (workflow: WorkflowDAG) => void;
  onWorkflowCompleted?: (workflow: WorkflowDAG) => void;
  onWorkflowFailed?: (error: Error) => void;
  onEvent?: (event: WorkflowEvent) => void;
}

// ============================================
// Hook 实现
// ============================================

export function useWorkflowOrchestrator(
  options: UseWorkflowOrchestratorOptions = {},
): WorkflowOrchestrator {
  // 配置
  const config = useRef<WorkflowConfig>({
    ...DEFAULT_WORKFLOW_CONFIG,
    ...options.config,
  }).current;

  // 管理器实例
  const plannerRef = useRef<TaskPlanner>();
  const swarmManagerRef = useRef<AgentSwarmManager>();
  const sandboxManagerRef = useRef<SandboxManager>();

  // 状态
  const [workflow, setWorkflow] = useState<WorkflowDAG | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 初始化管理器
  useEffect(() => {
    // 初始化 Planner
    plannerRef.current = new TaskPlanner({
      ...DEFAULT_PLANNER_CONFIG,
      apiKey: localStorage.getItem("claude_api_key") || "",
      baseUrl: localStorage.getItem("claude_api_base_url") || undefined,
    });

    // 初始化 Sandbox Manager
    sandboxManagerRef.current = new SandboxManager(config);

    // 初始化 Swarm Manager
    swarmManagerRef.current = new AgentSwarmManager(config);
    swarmManagerRef.current.setSandboxManager(sandboxManagerRef.current);

    // 监听事件
    const handleEvent = (event: WorkflowEvent) => {
      // 添加日志
      addLog({
        timestamp: event.timestamp,
        level: "info",
        message: `[${event.type}] ${JSON.stringify(event.data)}`,
        taskId: event.taskId,
        agentId: event.agentId,
      });

      // 更新代理状态
      if (event.type.startsWith("agent:")) {
        updateAgentList();
      }

      // 触发回调
      options.onEvent?.(event);
    };

    swarmManagerRef.current.on("*", handleEvent);

    return () => {
      swarmManagerRef.current?.removeListener("*", handleEvent);
    };
  }, []);

  // 添加日志
  const addLog = useCallback((log: WorkflowLog) => {
    setLogs((prev) => [...prev, log].slice(-500));
  }, []);

  // 更新代理列表
  const updateAgentList = useCallback(() => {
    if (swarmManagerRef.current) {
      const currentAgents = swarmManagerRef.current.getAgents();
      setAgents(currentAgents);
    }
  }, []);

  // 生成工作流
  const generateWorkflow = useCallback(
    async (prompt: string, ultrathink: boolean = true) => {
      if (!plannerRef.current) {
        throw new Error("TaskPlanner not initialized");
      }

      setIsPlanning(true);
      setError(null);

      addLog({
        timestamp: Date.now(),
        level: "info",
        message: `开始分析任务: ${prompt.slice(0, 50)}...`,
      });

      try {
        const result = await plannerRef.current.generateWorkflowDAG(prompt, {
          projectPath: options.projectPath,
          techStack: ["react", "typescript", "tauri"],
        });

        setWorkflow(result.workflow);
        setIsPlanning(false);

        addLog({
          timestamp: Date.now(),
          level: "info",
          message: `工作流生成完成: ${result.workflow.tasks.length} 个任务, ${result.workflow.parallelGroups.length} 个并行组`,
        });

        if (result.thinkingProcess) {
          addLog({
            timestamp: Date.now(),
            level: "debug",
            message: `AI 思考过程: ${result.thinkingProcess.slice(0, 200)}...`,
          });
        }

        options.onWorkflowGenerated?.(result.workflow);

        return result.workflow;
      } catch (err: any) {
        setError(err.message);
        setIsPlanning(false);

        addLog({
          timestamp: Date.now(),
          level: "error",
          message: `工作流生成失败: ${err.message}`,
        });

        throw err;
      }
    },
    [options.projectPath, addLog],
  );

  // 开始执行
  const startExecution = useCallback(async () => {
    if (!workflow) {
      throw new Error("No workflow to execute");
    }

    if (!swarmManagerRef.current) {
      throw new Error("SwarmManager not initialized");
    }

    setIsRunning(true);
    setIsPaused(false);
    setError(null);

    addLog({
      timestamp: Date.now(),
      level: "info",
      message: "开始执行工作流...",
    });

    try {
      await swarmManagerRef.current.deployAndExecute(workflow);

      // 启动代理状态更新
      const updateInterval = setInterval(updateAgentList, 1000);

      // 等待完成
      swarmManagerRef.current.once("workflow:completed", (event) => {
        clearInterval(updateInterval);
        setIsRunning(false);

        addLog({
          timestamp: Date.now(),
          level: "info",
          message: "工作流执行完成！",
        });

        options.onWorkflowCompleted?.(event.workflow);
      });

      swarmManagerRef.current.once("workflow:failed", (event) => {
        clearInterval(updateInterval);
        setIsRunning(false);
        setError("Workflow execution failed");

        addLog({
          timestamp: Date.now(),
          level: "error",
          message: "工作流执行失败",
        });

        options.onWorkflowFailed?.(new Error("Workflow execution failed"));
      });
    } catch (err: any) {
      setError(err.message);
      setIsRunning(false);

      addLog({
        timestamp: Date.now(),
        level: "error",
        message: `执行失败: ${err.message}`,
      });

      throw err;
    }
  }, [workflow, addLog, updateAgentList]);

  // 暂停执行
  const pauseExecution = useCallback(() => {
    if (!swarmManagerRef.current) return;

    swarmManagerRef.current.pauseWorkflow();
    setIsPaused(true);

    addLog({
      timestamp: Date.now(),
      level: "info",
      message: "工作流已暂停",
    });
  }, [addLog]);

  // 恢复执行
  const resumeExecution = useCallback(async () => {
    if (!swarmManagerRef.current) return;

    await swarmManagerRef.current.resumeWorkflow();
    setIsPaused(false);

    addLog({
      timestamp: Date.now(),
      level: "info",
      message: "工作流已恢复",
    });
  }, [addLog]);

  // 停止执行
  const stopExecution = useCallback(() => {
    if (!swarmManagerRef.current) return;

    swarmManagerRef.current.pauseWorkflow();
    setIsRunning(false);
    setIsPaused(false);

    addLog({
      timestamp: Date.now(),
      level: "info",
      message: "工作流已停止",
    });
  }, [addLog]);

  // 重试任务
  const retryTask = useCallback(
    async (taskId: string) => {
      // TODO: 实现任务重试
      addLog({
        timestamp: Date.now(),
        level: "info",
        message: `重试任务: ${taskId}`,
      });
    },
    [addLog],
  );

  // 取消任务
  const cancelTask = useCallback(
    async (taskId: string) => {
      if (!swarmManagerRef.current) return;

      await swarmManagerRef.current.cancelTask(taskId);

      addLog({
        timestamp: Date.now(),
        level: "info",
        message: `任务已取消: ${taskId}`,
      });
    },
    [addLog],
  );

  // 获取任务状态
  const getTaskStatus = useCallback(
    (taskId: string): Task | undefined => {
      return workflow?.tasks.find((t) => t.id === taskId);
    },
    [workflow],
  );

  // 获取代理状态
  const getAgentStatus = useCallback(
    (agentId: string): Agent | undefined => {
      return agents.find((a) => a.id === agentId);
    },
    [agents],
  );

  return {
    // 状态
    workflow,
    agents,
    isPlanning,
    isRunning,
    isPaused,
    logs,
    error,

    // 操作
    generateWorkflow,
    startExecution,
    pauseExecution,
    resumeExecution,
    stopExecution,
    retryTask,
    cancelTask,

    // 监控
    getTaskStatus,
    getAgentStatus,
  };
}

export default useWorkflowOrchestrator;
