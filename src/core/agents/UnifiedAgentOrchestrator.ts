/**
 * Unified Agent Orchestrator
 * 
 * Core orchestration system that manages agent lifecycle, task assignment,
 * and coordination across multiple AI models.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  AgentRole,
  AgentRoleType,
  AgentStatus,
  AgentMetrics,
  Task,
  TaskType,
  TaskStatus,
  TaskResult,
  ConcurrencyConfig,
  PoolStatus,
  BackgroundTaskStatus,
} from '@core/types/unified-agent';
import { AGENT_ROLES, getAgentRole, getBestAgentForTaskType } from './AgentRoles';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  defaultConcurrency: 5,
  providerConcurrency: {
    anthropic: 3,
    openai: 5,
    google: 10,
    xai: 5,
  },
  modelConcurrency: {
    'claude-opus-4-5-20250514': 2,
    'o3': 2,
    'gemini-2.5-pro': 3,
  },
};

// ============================================================================
// Types
// ============================================================================

interface TaskQueueItem {
  task: Task;
  resolve: (result: TaskResult) => void;
  reject: (error: Error) => void;
}

type TaskExecutor = (task: Task, agent: Agent) => Promise<TaskResult>;

// ============================================================================
// Unified Agent Orchestrator
// ============================================================================

export class UnifiedAgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private taskQueue: TaskQueueItem[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private backgroundTasks: Map<string, BackgroundTaskStatus> = new Map();
  private concurrencyConfig: ConcurrencyConfig;
  private taskExecutor?: TaskExecutor;

  constructor(config?: Partial<ConcurrencyConfig>) {
    this.concurrencyConfig = {
      ...DEFAULT_CONCURRENCY_CONFIG,
      ...config,
    };
  }

  // ==========================================================================
  // Agent Lifecycle
  // ==========================================================================

  /**
   * Create a new agent with the specified role
   */
  async createAgent(
    roleType: AgentRoleType,
    config?: Partial<AgentRole>
  ): Promise<Agent> {
    const baseRole = getAgentRole(roleType);
    const role: AgentRole = {
      ...baseRole,
      ...config,
      id: config?.id || baseRole.id,
    };

    const agent: Agent = {
      id: uuidv4(),
      role,
      status: 'idle',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalTokensUsed: 0,
        averageCompletionTime: 0,
        successRate: 1,
      },
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  /**
   * Clone an existing agent for high-demand scenarios
   */
  async cloneAgent(agentId: string, reason: string): Promise<Agent> {
    const original = this.agents.get(agentId);
    if (!original) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const cloned: Agent = {
      ...original,
      id: uuidv4(),
      status: 'idle',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalTokensUsed: 0,
        averageCompletionTime: 0,
        successRate: 1,
      },
    };

    this.agents.set(cloned.id, cloned);
    console.log(`Cloned agent ${agentId} -> ${cloned.id}, reason: ${reason}`);
    return cloned;
  }

  /**
   * Destroy an agent and release resources
   */
  async destroyAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (agent.status === 'busy') {
      throw new Error(`Cannot destroy busy agent: ${agentId}`);
    }

    this.agents.delete(agentId);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by role type
   */
  getAgentsByRole(roleType: AgentRoleType): Agent[] {
    return this.getAllAgents().filter((agent) => agent.role.type === roleType);
  }

  // ==========================================================================
  // Task Assignment
  // ==========================================================================

  /**
   * Assign a task to the most suitable agent
   */
  async assignTask(task: Task): Promise<Agent> {
    // Find the best agent for this task
    const bestRoleType = this.determineBestRole(task);
    let agent = this.findAvailableAgent(bestRoleType);

    // If no agent available, create one (always allow creation for assignment)
    if (!agent) {
      agent = await this.createAgent(bestRoleType);
    }

    // Assign the task
    task.assignedAgent = agent.id;
    task.status = 'in_progress';
    task.startedAt = Date.now();

    // Update agent status
    agent.status = 'busy';
    agent.lastActiveAt = Date.now();
    this.agents.set(agent.id, agent);

    this.runningTasks.set(task.id, task);

    return agent;
  }

  /**
   * Calculate how well an agent fits a task (0-100)
   */
  calculateFitScore(agent: Agent, task: Task): number {
    let score = 0;
    const role = agent.role;

    // Role type match (40 points)
    const bestRole = getBestAgentForTaskType(task.type);
    if (role.type === bestRole) {
      score += 40;
    } else if (role.type === 'orchestrator') {
      score += 20; // Orchestrator can handle anything
    }

    // Capability match (30 points)
    const caps = role.capabilities;
    if (caps.specializations?.some((s) => task.description.toLowerCase().includes(s))) {
      score += 30;
    } else if (caps.languages?.includes('*') || caps.frameworks?.includes('*')) {
      score += 15;
    }

    // Agent availability (20 points)
    if (agent.status === 'idle') {
      score += 20;
    }

    // Performance history (10 points)
    if (agent.metrics.successRate >= 0.9) {
      score += 10;
    } else if (agent.metrics.successRate >= 0.7) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * Determine the best role type for a task
   */
  private determineBestRole(task: Task): AgentRoleType {
    return getBestAgentForTaskType(task.type);
  }

  /**
   * Find an available agent of the specified role
   */
  private findAvailableAgent(roleType: AgentRoleType): Agent | undefined {
    const agents = this.getAgentsByRole(roleType);
    return agents.find((agent) => agent.status === 'idle');
  }

  /**
   * Check if we can create a new agent (respecting concurrency limits)
   */
  private canCreateAgent(roleType: AgentRoleType): boolean {
    const role = getAgentRole(roleType);
    const provider = role.model.provider;
    const model = role.model.model;

    // Check provider concurrency
    const providerAgents = this.getAllAgents().filter(
      (a) => a.role.model.provider === provider && a.status === 'busy'
    );
    const providerLimit = this.concurrencyConfig.providerConcurrency[provider];
    if (providerAgents.length >= providerLimit) {
      return false;
    }

    // Check model concurrency
    const modelLimit = this.concurrencyConfig.modelConcurrency[model];
    if (modelLimit) {
      const modelAgents = this.getAllAgents().filter(
        (a) => a.role.model.model === model && a.status === 'busy'
      );
      if (modelAgents.length >= modelLimit) {
        return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  /**
   * Set the task executor function
   */
  setTaskExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
  }

  /**
   * Execute a task with the assigned agent
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const agent = task.assignedAgent ? this.agents.get(task.assignedAgent) : undefined;
    if (!agent) {
      throw new Error(`No agent assigned to task: ${task.id}`);
    }

    if (!this.taskExecutor) {
      throw new Error('No task executor configured');
    }

    const startTime = Date.now();

    try {
      const result = await this.taskExecutor(task, agent);
      
      // Update task
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = Date.now();
      task.result = result;

      // Update agent metrics
      this.updateAgentMetrics(agent, result, Date.now() - startTime);

      // Release agent
      agent.status = 'idle';
      this.agents.set(agent.id, agent);
      this.runningTasks.delete(task.id);

      // Process queue
      this.processQueue();

      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tokensUsed: 0,
        duration: Date.now() - startTime,
      };

      task.status = 'failed';
      task.completedAt = Date.now();
      task.result = errorResult;

      this.updateAgentMetrics(agent, errorResult, Date.now() - startTime);

      agent.status = 'idle';
      this.agents.set(agent.id, agent);
      this.runningTasks.delete(task.id);

      this.processQueue();

      return errorResult;
    }
  }

  /**
   * Update agent metrics after task completion
   */
  private updateAgentMetrics(agent: Agent, result: TaskResult, duration: number): void {
    const metrics = agent.metrics;
    
    if (result.success) {
      metrics.tasksCompleted++;
    } else {
      metrics.tasksFailed++;
    }

    metrics.totalTokensUsed += result.tokensUsed;
    
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.averageCompletionTime = 
      (metrics.averageCompletionTime * (totalTasks - 1) + duration) / totalTasks;
    metrics.successRate = metrics.tasksCompleted / totalTasks;
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const item = this.taskQueue[0];
      const bestRole = this.determineBestRole(item.task);
      const agent = this.findAvailableAgent(bestRole);

      if (agent) {
        this.taskQueue.shift();
        this.assignTask(item.task).then(item.resolve).catch(item.reject);
      } else if (this.canCreateAgent(bestRole)) {
        this.taskQueue.shift();
        this.createAgent(bestRole)
          .then(() => this.assignTask(item.task))
          .then(item.resolve)
          .catch(item.reject);
      } else {
        break; // Can't process more tasks
      }
    }
  }

  // ==========================================================================
  // Background Execution
  // ==========================================================================

  /**
   * Spawn a background agent for async task execution
   */
  async spawnBackground(roleType: AgentRoleType, prompt: string): Promise<string> {
    const taskId = uuidv4();
    const agent = await this.createAgent(roleType);

    const task: Task = {
      id: taskId,
      description: prompt,
      type: roleType as TaskType,
      priority: 5,
      status: 'pending',
      dependencies: [],
      createdAt: Date.now(),
      isBackground: true,
    };

    const status: BackgroundTaskStatus = {
      taskId,
      status: 'in_progress',
      progress: 0,
      startedAt: Date.now(),
    };

    this.backgroundTasks.set(taskId, status);

    // Execute in background
    this.assignTask(task)
      .then(() => this.executeTask(task))
      .then((result) => {
        const bgStatus = this.backgroundTasks.get(taskId);
        if (bgStatus) {
          bgStatus.status = result.success ? 'completed' : 'failed';
          bgStatus.progress = 100;
          bgStatus.output = result.output ? [result.output] : undefined;
        }
      })
      .catch((error) => {
        const bgStatus = this.backgroundTasks.get(taskId);
        if (bgStatus) {
          bgStatus.status = 'failed';
          bgStatus.output = [error.message];
        }
      });

    return taskId;
  }

  /**
   * Get background task status
   */
  getBackgroundStatus(taskId: string): BackgroundTaskStatus | undefined {
    return this.backgroundTasks.get(taskId);
  }

  /**
   * Cancel a background task
   */
  async cancelBackground(taskId: string): Promise<void> {
    const status = this.backgroundTasks.get(taskId);
    if (!status) {
      throw new Error(`Background task not found: ${taskId}`);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      throw new Error(`Cannot cancel completed task: ${taskId}`);
    }

    status.status = 'cancelled';
    
    // Find and release the agent
    const task = this.runningTasks.get(taskId);
    if (task?.assignedAgent) {
      const agent = this.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        this.agents.set(agent.id, agent);
      }
    }

    this.runningTasks.delete(taskId);
  }

  /**
   * Get all background tasks
   */
  getAllBackgroundTasks(): BackgroundTaskStatus[] {
    return Array.from(this.backgroundTasks.values());
  }

  // ==========================================================================
  // Concurrency Control
  // ==========================================================================

  /**
   * Get current concurrency configuration
   */
  getConcurrencyLimits(): ConcurrencyConfig {
    return { ...this.concurrencyConfig };
  }

  /**
   * Update concurrency configuration
   */
  setConcurrencyLimits(config: Partial<ConcurrencyConfig>): void {
    this.concurrencyConfig = {
      ...this.concurrencyConfig,
      ...config,
    };
  }

  // ==========================================================================
  // Status & Metrics
  // ==========================================================================

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.agents.get(agentId)?.metrics;
  }

  /**
   * Get pool status
   */
  getPoolStatus(): PoolStatus {
    const agents = this.getAllAgents();
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === 'busy').length,
      idleAgents: agents.filter((a) => a.status === 'idle').length,
      queuedTasks: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
    };
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActiveAt = Date.now();
      this.agents.set(agentId, agent);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let orchestratorInstance: UnifiedAgentOrchestrator | null = null;

export function getOrchestrator(): UnifiedAgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new UnifiedAgentOrchestrator();
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
