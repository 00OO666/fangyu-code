/**
 * AgentSwarmManager - 多代理群调度管理器
 *
 * 核心功能：
 * 1. 代理池管理（创建、销毁、克隆）
 * 2. 智能任务分配
 * 3. 并行执行调度
 * 4. 代理间通信
 * 5. 负载均衡
 *
 * 灵感来源：
 * - LangGraph 的多代理协调
 * - Windsurf Wave 13 的并行代理
 * - Swarms 框架的 DAG 编排
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  AgentType,
  AgentStatus,
  AgentCapabilities,
  AgentMessage,
  AgentCloneRequest,
  Task,
  WorkflowDAG,
  WorkflowConfig,
  WorkflowEvent,
  WorkflowEventType
} from '../types/workflow';

// ============================================
// 代理池接口
// ============================================

interface AgentPool {
  maxAgents: number;
  agents: Map<string, Agent>;
  idleAgents: Set<string>;
  busyAgents: Set<string>;
  taskAssignments: Map<string, string>; // taskId -> agentId
}

interface SchedulerState {
  isRunning: boolean;
  currentWorkflow?: WorkflowDAG;
  taskQueue: Task[];
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  inProgressTasks: Set<string>;
}

// ============================================
// 代理模板
// ============================================

const AGENT_TEMPLATES: Record<AgentType, Partial<Agent>> = {
  orchestrator: {
    type: 'orchestrator',
    capabilities: {
      languages: ['*'],
      frameworks: ['*'],
      tools: ['*'],
      specializations: ['planning', 'coordination', 'delegation']
    }
  },
  planner: {
    type: 'planner',
    capabilities: {
      languages: [],
      frameworks: [],
      tools: ['analysis'],
      specializations: ['task-decomposition', 'estimation', 'scheduling']
    }
  },
  frontend: {
    type: 'frontend',
    capabilities: {
      languages: ['typescript', 'javascript', 'html', 'css'],
      frameworks: ['react', 'vue', 'angular', 'next.js', 'tailwind'],
      tools: ['npm', 'vite', 'webpack', 'eslint'],
      specializations: ['ui-ux', 'responsive-design', 'accessibility', 'animations']
    }
  },
  backend: {
    type: 'backend',
    capabilities: {
      languages: ['typescript', 'javascript', 'python', 'rust', 'go'],
      frameworks: ['express', 'fastify', 'django', 'fastapi'],
      tools: ['docker', 'postgresql', 'redis', 'nginx'],
      specializations: ['api-design', 'database', 'security', 'performance']
    }
  },
  fullstack: {
    type: 'fullstack',
    capabilities: {
      languages: ['typescript', 'javascript', 'python'],
      frameworks: ['react', 'next.js', 'express', 'fastapi'],
      tools: ['npm', 'docker', 'git'],
      specializations: ['full-stack', 'integration', 'deployment']
    }
  },
  testing: {
    type: 'testing',
    capabilities: {
      languages: ['typescript', 'javascript', 'python'],
      frameworks: ['jest', 'vitest', 'playwright', 'cypress'],
      tools: ['npm', 'coverage'],
      specializations: ['unit-testing', 'e2e-testing', 'integration-testing', 'performance-testing']
    }
  },
  devops: {
    type: 'devops',
    capabilities: {
      languages: ['bash', 'python', 'yaml'],
      frameworks: [],
      tools: ['docker', 'kubernetes', 'terraform', 'github-actions', 'nginx'],
      specializations: ['ci-cd', 'infrastructure', 'monitoring', 'security']
    }
  },
  review: {
    type: 'review',
    capabilities: {
      languages: ['*'],
      frameworks: ['*'],
      tools: ['eslint', 'prettier', 'sonarqube'],
      specializations: ['code-review', 'security-audit', 'best-practices']
    }
  },
  docs: {
    type: 'docs',
    capabilities: {
      languages: ['markdown', 'typescript'],
      frameworks: ['docusaurus', 'vitepress'],
      tools: ['typedoc', 'jsdoc'],
      specializations: ['documentation', 'api-docs', 'tutorials']
    }
  },
  general: {
    type: 'general',
    capabilities: {
      languages: ['typescript', 'javascript', 'python'],
      frameworks: ['react', 'express'],
      tools: ['npm', 'git'],
      specializations: ['general-purpose']
    }
  }
};

// ============================================
// AgentSwarmManager 类
// ============================================

export class AgentSwarmManager extends EventEmitter {
  private pool: AgentPool;
  private scheduler: SchedulerState;
  private config: WorkflowConfig;
  private messageQueue: AgentMessage[] = [];
  private sandboxManager: any; // 将由 SandboxManager 注入

  constructor(config: WorkflowConfig) {
    super();
    this.config = config;

    this.pool = {
      maxAgents: config.maxAgents,
      agents: new Map(),
      idleAgents: new Set(),
      busyAgents: new Set(),
      taskAssignments: new Map()
    };

    this.scheduler = {
      isRunning: false,
      taskQueue: [],
      completedTasks: new Set(),
      failedTasks: new Set(),
      inProgressTasks: new Set()
    };
  }

  // ============================================
  // 代理生命周期管理
  // ============================================

  /**
   * 🚀 创建新代理
   */
  async createAgent(type: AgentType, name?: string): Promise<Agent> {
    if (this.pool.agents.size >= this.pool.maxAgents) {
      throw new Error(`Maximum agent limit reached (${this.pool.maxAgents})`);
    }

    const template = AGENT_TEMPLATES[type];
    const agentId = uuidv4();

    const agent: Agent = {
      id: agentId,
      name: name || `${type}-${agentId.slice(0, 8)}`,
      type,
      status: 'idle',
      capabilities: template.capabilities || {
        languages: [],
        frameworks: [],
        tools: [],
        specializations: []
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
    };

    // 创建沙箱环境
    if (this.sandboxManager) {
      const sandbox = await this.sandboxManager.createSandbox(agentId);
      agent.sandboxId = sandbox.id;
    }

    this.pool.agents.set(agentId, agent);
    this.pool.idleAgents.add(agentId);

    this.emitEvent('agent:created', { agent });
    console.log(`[AgentSwarm] Created agent: ${agent.name} (${agent.type})`);

    return agent;
  }

  /**
   * 🔄 克隆代理（应对高负载）
   */
  async cloneAgent(request: AgentCloneRequest): Promise<Agent> {
    const sourceAgent = this.pool.agents.get(request.sourceAgentId);
    if (!sourceAgent) {
      throw new Error(`Source agent not found: ${request.sourceAgentId}`);
    }

    if (this.pool.agents.size >= this.pool.maxAgents) {
      throw new Error(`Cannot clone: Maximum agent limit reached`);
    }

    console.log(`[AgentSwarm] Cloning agent ${sourceAgent.name}: ${request.reason}`);

    const cloneId = uuidv4();
    const clone: Agent = {
      ...sourceAgent,
      id: cloneId,
      name: `${sourceAgent.name}-clone-${cloneId.slice(0, 4)}`,
      status: 'idle',
      currentTask: undefined,
      taskQueue: request.inheritTasks ? [...sourceAgent.taskQueue] : [],
      sandboxId: undefined, // 新沙箱
      parentAgentId: sourceAgent.id,
      isClone: true,
      createdAt: Date.now(),
      performance: {
        ...sourceAgent.performance,
        tasksCompleted: 0,
        tasksFailed: 0
      }
    };

    // 合并能力
    if (request.capabilities) {
      clone.capabilities = {
        ...clone.capabilities,
        ...request.capabilities
      };
    }

    // 创建新沙箱
    if (this.sandboxManager) {
      const sandbox = await this.sandboxManager.createSandbox(cloneId);
      clone.sandboxId = sandbox.id;
    }

    this.pool.agents.set(cloneId, clone);
    this.pool.idleAgents.add(cloneId);

    this.emitEvent('agent:cloned', {
      source: sourceAgent,
      clone,
      reason: request.reason
    });

    return clone;
  }

  /**
   * 🗑️ 销毁代理
   */
  async destroyAgent(agentId: string): Promise<void> {
    const agent = this.pool.agents.get(agentId);
    if (!agent) return;

    // 如果代理正在执行任务，先取消
    if (agent.currentTask) {
      await this.cancelTask(agent.currentTask.id);
    }

    // 销毁沙箱
    if (agent.sandboxId && this.sandboxManager) {
      await this.sandboxManager.destroySandbox(agent.sandboxId);
    }

    this.pool.agents.delete(agentId);
    this.pool.idleAgents.delete(agentId);
    this.pool.busyAgents.delete(agentId);

    this.emitEvent('agent:destroyed', { agent });
    console.log(`[AgentSwarm] Destroyed agent: ${agent.name}`);
  }

  // ============================================
  // 工作流执行
  // ============================================

  /**
   * 🎯 部署代理群并执行工作流
   */
  async deployAndExecute(workflow: WorkflowDAG): Promise<void> {
    console.log(`[AgentSwarm] Deploying swarm for workflow: ${workflow.metadata.name}`);

    this.scheduler.currentWorkflow = workflow;
    this.scheduler.isRunning = true;
    this.scheduler.taskQueue = [...workflow.tasks.filter(t => t.status === 'pending')];

    // 分析工作流，确定需要的代理类型
    const requiredAgents = this.analyzeRequiredAgents(workflow);

    // 创建所需代理
    for (const agentSpec of requiredAgents) {
      const existingAgent = this.findMatchingAgent(agentSpec.type, agentSpec.capabilities);
      if (!existingAgent) {
        await this.createAgent(agentSpec.type);
      }
    }

    // 开始调度循环
    await this.startSchedulingLoop();
  }

  /**
   * 🔄 调度循环
   */
  private async startSchedulingLoop(): Promise<void> {
    this.emitEvent('workflow:started', {
      workflow: this.scheduler.currentWorkflow
    });

    while (this.scheduler.isRunning) {
      // 获取可执行的任务（依赖已满足）
      const readyTasks = this.getReadyTasks();

      if (readyTasks.length === 0 && this.scheduler.inProgressTasks.size === 0) {
        // 所有任务完成
        break;
      }

      // 并行分配任务
      const assignments = await Promise.all(
        readyTasks.slice(0, this.config.maxConcurrentTasks).map(async task => {
          try {
            await this.assignAndExecuteTask(task);
          } catch (error) {
            console.error(`[AgentSwarm] Task assignment failed:`, error);
          }
        })
      );

      // 等待一小段时间再检查
      await this.sleep(100);
    }

    // 完成或失败
    const status = this.scheduler.failedTasks.size > 0 ? 'failed' : 'completed';
    this.emitEvent(`workflow:${status}`, {
      workflow: this.scheduler.currentWorkflow,
      completedTasks: Array.from(this.scheduler.completedTasks),
      failedTasks: Array.from(this.scheduler.failedTasks)
    });

    this.scheduler.isRunning = false;
  }

  /**
   * 📊 获取可执行的任务
   */
  private getReadyTasks(): Task[] {
    if (!this.scheduler.currentWorkflow) return [];

    return this.scheduler.taskQueue.filter(task => {
      // 检查依赖是否都已完成
      const depsCompleted = task.dependencies.every(
        depId => this.scheduler.completedTasks.has(depId)
      );

      // 检查是否已在执行
      const notInProgress = !this.scheduler.inProgressTasks.has(task.id);

      return depsCompleted && notInProgress;
    });
  }

  /**
   * 🤖 分配并执行任务
   */
  private async assignAndExecuteTask(task: Task): Promise<void> {
    // 找到最合适的代理
    const agent = await this.findBestAgentForTask(task);

    if (!agent) {
      // 没有可用代理，考虑克隆
      const clonedAgent = await this.tryCloneForTask(task);
      if (!clonedAgent) {
        // 放回队列等待
        return;
      }
      return this.assignAndExecuteTask(task);
    }

    // 分配任务
    this.assignTask(task, agent);

    // 执行任务
    this.executeTask(agent, task).catch(error => {
      console.error(`[AgentSwarm] Task execution error:`, error);
      this.handleTaskFailure(task, agent, error);
    });
  }

  /**
   * 🎯 找到最适合任务的代理
   */
  private async findBestAgentForTask(task: Task): Promise<Agent | null> {
    const idleAgentIds = Array.from(this.pool.idleAgents);

    if (idleAgentIds.length === 0) return null;

    // 计算每个代理的适合度分数
    const scores = idleAgentIds.map(agentId => {
      const agent = this.pool.agents.get(agentId)!;
      return {
        agent,
        score: this.calculateAgentFitScore(agent, task)
      };
    });

    // 按分数排序
    scores.sort((a, b) => b.score - a.score);

    // 返回分数最高的代理（如果分数 > 0）
    return scores[0]?.score > 0 ? scores[0].agent : null;
  }

  /**
   * 📊 计算代理适合度分数
   */
  private calculateAgentFitScore(agent: Agent, task: Task): number {
    let score = 0;

    // 基于建议的代理类型
    const suggestedType = task.metadata?.suggestedAgentType;
    if (suggestedType && agent.type === suggestedType) {
      score += 50;
    }

    // 基于技能匹配
    const matchedSkills = task.requiredSkills.filter(
      skill => agent.capabilities.specializations.includes(skill) ||
               agent.capabilities.languages.includes(skill) ||
               agent.capabilities.frameworks.includes(skill)
    );
    score += matchedSkills.length * 10;

    // 基于工具匹配
    const matchedTools = task.requiredTools.filter(
      tool => agent.capabilities.tools.includes(tool)
    );
    score += matchedTools.length * 5;

    // 基于历史表现
    score += agent.performance.successRate * 20;

    // 减少等待时间较长的代理的分数（优先使用活跃代理）
    const idleTime = Date.now() - agent.performance.lastActiveAt;
    if (idleTime > 60000) { // 超过1分钟
      score -= 5;
    }

    return score;
  }

  /**
   * 🔄 尝试克隆代理处理任务
   */
  private async tryCloneForTask(task: Task): Promise<Agent | null> {
    if (this.pool.agents.size >= this.pool.maxAgents) {
      return null;
    }

    // 找到最适合克隆的源代理
    const busyAgentIds = Array.from(this.pool.busyAgents);
    let bestSource: Agent | null = null;
    let bestScore = 0;

    for (const agentId of busyAgentIds) {
      const agent = this.pool.agents.get(agentId)!;
      const score = this.calculateAgentFitScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestSource = agent;
      }
    }

    if (!bestSource || bestScore < 20) {
      // 如果没有合适的源，创建一个新的通用代理
      return await this.createAgent('general');
    }

    // 克隆代理
    return await this.cloneAgent({
      sourceAgentId: bestSource.id,
      reason: `High demand for ${task.metadata?.suggestedAgentType || 'general'} tasks`,
      taskId: task.id,
      inheritTasks: false
    });
  }

  /**
   * 📝 分配任务给代理
   */
  private assignTask(task: Task, agent: Agent): void {
    task.assignedAgentId = agent.id;
    task.status = 'in_progress';
    agent.currentTask = task;
    agent.status = 'busy';

    this.pool.idleAgents.delete(agent.id);
    this.pool.busyAgents.add(agent.id);
    this.pool.taskAssignments.set(task.id, agent.id);
    this.scheduler.inProgressTasks.add(task.id);

    // 从队列移除
    const queueIndex = this.scheduler.taskQueue.findIndex(t => t.id === task.id);
    if (queueIndex >= 0) {
      this.scheduler.taskQueue.splice(queueIndex, 1);
    }

    this.emitEvent('agent:assigned', { agent, task });
    this.emitEvent('task:started', { task, agent });

    console.log(`[AgentSwarm] Assigned task "${task.description}" to ${agent.name}`);
  }

  /**
   * 🏃 执行任务
   */
  private async executeTask(agent: Agent, task: Task): Promise<void> {
    const startTime = Date.now();
    task.metrics.startTime = startTime;

    try {
      // 这里将调用实际的任务执行逻辑
      // 例如：发送给 Claude API 并在沙箱中执行
      const result = await this.runTaskInSandbox(agent, task);

      // 更新任务状态
      task.status = 'completed';
      task.progress = 100;
      task.result = result;
      task.metrics.endTime = Date.now();
      task.metrics.duration = task.metrics.endTime - startTime;

      // 更新代理状态
      agent.performance.tasksCompleted++;
      agent.performance.avgCompletionTime = this.updateAverage(
        agent.performance.avgCompletionTime,
        agent.performance.tasksCompleted,
        task.metrics.duration
      );

      this.completeTask(task, agent);

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 🐳 在沙箱中执行任务
   */
  private async runTaskInSandbox(agent: Agent, task: Task): Promise<any> {
    // TODO: 实现实际的沙箱执行逻辑
    // 这里是占位实现

    // 模拟任务执行
    const executionTime = task.estimatedComplexity * 1000; // 每个复杂度单位 1 秒

    // 发送进度更新
    for (let progress = 0; progress <= 100; progress += 10) {
      task.progress = progress;
      this.emitEvent('task:progress', { task, agent, progress });
      await this.sleep(executionTime / 10);
    }

    return {
      success: true,
      output: `Task "${task.description}" completed successfully`,
      logs: [`[${new Date().toISOString()}] Task started`, `[${new Date().toISOString()}] Task completed`]
    };
  }

  /**
   * ✅ 完成任务
   */
  private completeTask(task: Task, agent: Agent): void {
    this.scheduler.inProgressTasks.delete(task.id);
    this.scheduler.completedTasks.add(task.id);

    agent.currentTask = undefined;
    agent.status = 'idle';
    agent.performance.lastActiveAt = Date.now();

    this.pool.busyAgents.delete(agent.id);
    this.pool.idleAgents.add(agent.id);
    this.pool.taskAssignments.delete(task.id);

    this.emitEvent('task:completed', { task, agent });
    this.emitEvent('agent:idle', { agent });

    console.log(`[AgentSwarm] Task completed: "${task.description}" by ${agent.name}`);
  }

  /**
   * ❌ 处理任务失败
   */
  private handleTaskFailure(task: Task, agent: Agent, error: Error): void {
    task.status = 'failed';
    task.result = {
      success: false,
      error: error.message,
      logs: [`[${new Date().toISOString()}] Task failed: ${error.message}`]
    };
    task.metrics.endTime = Date.now();
    task.metrics.retryCount++;

    agent.performance.tasksFailed++;
    agent.performance.successRate = agent.performance.tasksCompleted /
      (agent.performance.tasksCompleted + agent.performance.tasksFailed);

    // 检查是否应该重试
    if (task.metrics.retryCount < this.config.retryPolicy.maxRetries) {
      console.log(`[AgentSwarm] Retrying task "${task.description}" (attempt ${task.metrics.retryCount + 1})`);
      task.status = 'pending';
      this.scheduler.taskQueue.push(task);
    } else {
      this.scheduler.inProgressTasks.delete(task.id);
      this.scheduler.failedTasks.add(task.id);
      this.emitEvent('task:failed', { task, agent, error });
    }

    agent.currentTask = undefined;
    agent.status = 'idle';
    this.pool.busyAgents.delete(agent.id);
    this.pool.idleAgents.add(agent.id);
    this.pool.taskAssignments.delete(task.id);
  }

  /**
   * 🚫 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const agentId = this.pool.taskAssignments.get(taskId);
    if (agentId) {
      const agent = this.pool.agents.get(agentId);
      if (agent && agent.currentTask?.id === taskId) {
        agent.currentTask.status = 'cancelled';
        agent.currentTask = undefined;
        agent.status = 'idle';

        this.pool.busyAgents.delete(agentId);
        this.pool.idleAgents.add(agentId);
      }
    }

    this.scheduler.inProgressTasks.delete(taskId);
    this.pool.taskAssignments.delete(taskId);

    this.emitEvent('task:cancelled', { taskId });
  }

  // ============================================
  // 代理间通信
  // ============================================

  /**
   * 📨 发送消息给代理
   */
  sendMessage(message: AgentMessage): void {
    this.messageQueue.push(message);
    this.emitEvent('message:sent', { message });

    if (message.to === 'broadcast') {
      // 广播给所有代理
      for (const [agentId, agent] of this.pool.agents) {
        if (agentId !== message.from) {
          this.deliverMessage(agent, message);
        }
      }
    } else {
      const targetAgent = this.pool.agents.get(message.to);
      if (targetAgent) {
        this.deliverMessage(targetAgent, message);
      }
    }
  }

  /**
   * 📬 投递消息
   */
  private deliverMessage(agent: Agent, message: AgentMessage): void {
    // 代理处理消息
    switch (message.type) {
      case 'context-share':
        // 合并上下文
        agent.metadata.sharedContext = {
          ...agent.metadata.sharedContext,
          ...message.payload
        };
        break;
      case 'task-result':
        // 处理任务结果
        break;
      case 'status-update':
        // 更新状态
        break;
    }

    this.emitEvent('message:received', { agent, message });
  }

  // ============================================
  // 工具方法
  // ============================================

  /**
   * 分析工作流所需的代理
   */
  private analyzeRequiredAgents(workflow: WorkflowDAG): Array<{
    type: AgentType;
    capabilities: AgentCapabilities;
  }> {
    const requiredAgents: Map<AgentType, AgentCapabilities> = new Map();

    for (const task of workflow.tasks) {
      const suggestedType = (task.metadata?.suggestedAgentType as AgentType) || 'general';

      if (!requiredAgents.has(suggestedType)) {
        requiredAgents.set(suggestedType, {
          languages: [],
          frameworks: [],
          tools: [...task.requiredTools],
          specializations: [...task.requiredSkills]
        });
      } else {
        const existing = requiredAgents.get(suggestedType)!;
        existing.tools = [...new Set([...existing.tools, ...task.requiredTools])];
        existing.specializations = [...new Set([...existing.specializations, ...task.requiredSkills])];
      }
    }

    return Array.from(requiredAgents.entries()).map(([type, capabilities]) => ({
      type,
      capabilities
    }));
  }

  /**
   * 查找匹配的现有代理
   */
  private findMatchingAgent(type: AgentType, capabilities: AgentCapabilities): Agent | null {
    for (const agent of this.pool.agents.values()) {
      if (agent.type === type) {
        return agent;
      }
    }
    return null;
  }

  /**
   * 更新平均值
   */
  private updateAverage(currentAvg: number, count: number, newValue: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 发送事件
   */
  private emitEvent(type: WorkflowEventType, data: any): void {
    const event: WorkflowEvent = {
      type,
      timestamp: Date.now(),
      ...data
    };
    this.emit(type, event);
    this.emit('*', event); // 通配符事件
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 获取所有代理
   */
  getAgents(): Agent[] {
    return Array.from(this.pool.agents.values());
  }

  /**
   * 获取代理池状态
   */
  getPoolStatus(): {
    total: number;
    idle: number;
    busy: number;
    maxAgents: number;
  } {
    return {
      total: this.pool.agents.size,
      idle: this.pool.idleAgents.size,
      busy: this.pool.busyAgents.size,
      maxAgents: this.pool.maxAgents
    };
  }

  /**
   * 获取调度器状态
   */
  getSchedulerStatus(): SchedulerState {
    return { ...this.scheduler };
  }

  /**
   * 暂停工作流
   */
  pauseWorkflow(): void {
    this.scheduler.isRunning = false;
    this.emitEvent('workflow:paused', {
      workflow: this.scheduler.currentWorkflow
    });
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(): Promise<void> {
    if (this.scheduler.currentWorkflow) {
      this.scheduler.isRunning = true;
      this.emitEvent('workflow:resumed', {
        workflow: this.scheduler.currentWorkflow
      });
      await this.startSchedulingLoop();
    }
  }

  /**
   * 设置沙箱管理器
   */
  setSandboxManager(manager: any): void {
    this.sandboxManager = manager;
  }
}

// 导出默认配置
export const DEFAULT_SWARM_CONFIG: Partial<WorkflowConfig> = {
  maxAgents: 20,
  maxConcurrentTasks: 10,
  taskTimeout: 300000,
  retryPolicy: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  }
};
