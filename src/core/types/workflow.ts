/**
 * Fangyu Code 2.0 - 多代理工作流系统类型定义
 *
 * 核心概念：
 * - Task: 单个任务单元
 * - WorkflowDAG: 有向无环图工作流
 * - Agent: 自主执行代理
 * - Sandbox: 隔离执行环境
 */

// ============================================
// Task 相关类型
// ============================================

export type TaskStatus = 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'sequential' | 'parallel' | 'conditional' | 'loop';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskMetrics {
  startTime?: number;
  endTime?: number;
  duration?: number;
  retryCount: number;
  tokenUsage?: {
    input: number;
    output: number;
    cache: number;
  };
}

export interface Task {
  id: string;
  parentId?: string; // 父任务 ID（用于子任务）
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dependencies: string[]; // 依赖的任务 ID
  dependents: string[]; // 被依赖的任务 ID
  estimatedComplexity: 1 | 2 | 3 | 4 | 5;
  requiredSkills: string[]; // ['react', 'typescript', 'api-design']
  requiredTools: string[]; // ['npm', 'git', 'docker']
  assignedAgentId?: string;
  status: TaskStatus;
  progress: number; // 0-100
  result?: TaskResult;
  metrics: TaskMetrics;
  subtasks?: Task[]; // 嵌套子任务
  condition?: TaskCondition; // 条件执行
  metadata: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: TaskArtifact[];
  logs: string[];
}

export interface TaskArtifact {
  type: 'file' | 'directory' | 'url' | 'data';
  path: string;
  description: string;
  size?: number;
}

export interface TaskCondition {
  type: 'if' | 'switch' | 'while';
  expression: string;
  branches: {
    condition: string;
    targetTaskId: string;
  }[];
  defaultTaskId?: string;
}

// ============================================
// Workflow DAG 相关类型
// ============================================

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  type: 'dependency' | 'conditional' | 'loop-back';
  condition?: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  tags: string[];
  estimatedTotalTime: number; // 分钟
  parallelismLevel: number; // 最大并行数
  criticalPath: string[]; // 关键路径上的任务 ID
  complexity: 'simple' | 'moderate' | 'complex' | 'extreme';
}

export interface WorkflowDAG {
  metadata: WorkflowMetadata;
  tasks: Task[];
  edges: WorkflowEdge[];
  parallelGroups: string[][]; // 可并行执行的任务组
  entryPoints: string[]; // 入口任务（无依赖）
  exitPoints: string[]; // 出口任务（无后续）
}

export interface WorkflowExecutionState {
  workflowId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  currentTasks: string[]; // 当前执行中的任务
  completedTasks: string[];
  failedTasks: string[];
  pendingTasks: string[];
  progress: number; // 0-100
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  taskId?: string;
  agentId?: string;
  message: string;
  data?: any;
}

// ============================================
// Agent 相关类型
// ============================================

export type AgentType =
  | 'orchestrator'  // 总调度
  | 'planner'       // 任务规划
  | 'frontend'      // 前端开发
  | 'backend'       // 后端开发
  | 'fullstack'     // 全栈开发
  | 'testing'       // 测试
  | 'devops'        // DevOps
  | 'review'        // 代码审查
  | 'docs'          // 文档
  | 'general';      // 通用

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline' | 'cloning';

export interface AgentCapabilities {
  languages: string[]; // ['typescript', 'python', 'rust']
  frameworks: string[]; // ['react', 'vue', 'express']
  tools: string[]; // ['git', 'docker', 'npm']
  specializations: string[]; // ['api-design', 'ui-ux', 'testing']
}

export interface AgentPerformance {
  tasksCompleted: number;
  tasksFailed: number;
  avgCompletionTime: number; // 秒
  avgTokenUsage: number;
  successRate: number; // 0-1
  lastActiveAt: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  performance: AgentPerformance;
  currentTask?: Task;
  taskQueue: string[]; // 待处理任务 ID
  sandboxId?: string;
  parentAgentId?: string; // 克隆源
  isClone: boolean;
  createdAt: number;
  metadata: Record<string, any>;
}

export interface AgentMessage {
  id: string;
  from: string; // Agent ID
  to: string | 'broadcast'; // Agent ID 或广播
  type: 'task-assignment' | 'task-result' | 'context-share' | 'status-update' | 'error' | 'request';
  payload: any;
  timestamp: number;
  priority: TaskPriority;
}

export interface AgentCloneRequest {
  sourceAgentId: string;
  reason: string;
  taskId?: string;
  inheritTasks: boolean;
  capabilities?: Partial<AgentCapabilities>;
}

// ============================================
// Sandbox 相关类型
// ============================================

export type SandboxStatus = 'creating' | 'running' | 'paused' | 'stopped' | 'error';

export interface SandboxSpec {
  baseImage: string; // 'node:20-alpine'
  workspaceDir: string; // '/workspace'
  environmentVars: Record<string, string>;
  exposedPorts: number[];
  volumes: SandboxVolume[];
  memoryLimit: string; // '2g'
  cpuLimit: number; // CPU 核数
  networkMode: 'bridge' | 'host' | 'none';
  capabilities: string[]; // Docker capabilities
}

export interface SandboxVolume {
  hostPath: string;
  containerPath: string;
  mode: 'ro' | 'rw'; // 只读或读写
}

export interface Sandbox {
  id: string;
  agentId: string;
  containerId?: string;
  status: SandboxStatus;
  spec: SandboxSpec;
  createdAt: number;
  lastActiveAt: number;
  terminals: SandboxTerminal[];
  files: SandboxFileSystem;
  browser?: SandboxBrowser;
  metrics: SandboxMetrics;
}

export interface SandboxTerminal {
  id: string;
  name: string;
  cwd: string;
  isActive: boolean;
  history: TerminalHistoryEntry[];
}

export interface TerminalHistoryEntry {
  command: string;
  output: string;
  exitCode: number;
  timestamp: number;
  duration: number;
}

export interface SandboxFileSystem {
  rootPath: string;
  watchedPaths: string[];
  recentChanges: FileChange[];
}

export interface FileChange {
  type: 'create' | 'modify' | 'delete' | 'rename';
  path: string;
  oldPath?: string; // 用于重命名
  timestamp: number;
  size?: number;
}

export interface SandboxBrowser {
  isActive: boolean;
  currentUrl?: string;
  viewport: { width: number; height: number };
  screenshots: string[]; // Base64 截图历史
}

export interface SandboxMetrics {
  cpuUsage: number; // 0-100
  memoryUsage: number; // bytes
  diskUsage: number; // bytes
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

// ============================================
// 事件类型
// ============================================

export type WorkflowEventType =
  | 'workflow:created'
  | 'workflow:started'
  | 'workflow:paused'
  | 'workflow:resumed'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'task:queued'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'agent:created'
  | 'agent:cloned'
  | 'agent:assigned'
  | 'agent:idle'
  | 'agent:error'
  | 'agent:destroyed'
  | 'sandbox:created'
  | 'sandbox:started'
  | 'sandbox:stopped'
  | 'sandbox:error'
  | 'message:sent'
  | 'message:received';

export interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: number;
  workflowId?: string;
  taskId?: string;
  agentId?: string;
  sandboxId?: string;
  data: any;
}

// ============================================
// 配置类型
// ============================================

export interface WorkflowConfig {
  maxAgents: number;
  maxConcurrentTasks: number;
  taskTimeout: number; // 毫秒
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number; // 毫秒
  };
  sandbox: {
    defaultImage: string;
    memoryLimit: string;
    cpuLimit: number;
    timeout: number; // 毫秒
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    persist: boolean;
    maxLogs: number;
  };
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxAgents: 20,
  maxConcurrentTasks: 10,
  taskTimeout: 300000, // 5 分钟
  retryPolicy: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  },
  sandbox: {
    defaultImage: 'node:20-alpine',
    memoryLimit: '2g',
    cpuLimit: 1,
    timeout: 600000 // 10 分钟
  },
  logging: {
    level: 'info',
    persist: true,
    maxLogs: 10000
  }
};
