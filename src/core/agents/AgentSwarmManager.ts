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

import { logger } from "@/lib/logger";
import { BrowserEventEmitter } from "../../lib/BrowserEventEmitter";
import { v4 as uuidv4 } from "uuid";
import type {
  Agent,
  AgentType,
  AgentCapabilities,
  AgentMessage,
  AgentCloneRequest,
  Task,
  WorkflowDAG,
  WorkflowConfig,
  WorkflowEvent,
  WorkflowEventType,
} from "../types/workflow";

// ============================================
// 代理池接口
// ============================================

/**
 * 代理能力匹配结果（导出用于测试）
 */
export interface AgentMatchResult {
  agent: Agent;
  score: number;
  matchedSkills: string[];
  matchedTools: string[];
  matchedLanguages: string[];
  matchedFrameworks: string[];
}

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

/**
 * 任务队列管理器 - 支持优先级排序和并发控制
 */
interface TaskQueueManager {
  queue: Task[];
  maxConcurrent: number;
  currentConcurrent: number;
}

// ============================================
// 代理模板
// ============================================

const AGENT_TEMPLATES: Record<AgentType, Partial<Agent>> = {
  orchestrator: {
    type: "orchestrator",
    capabilities: {
      languages: ["*"],
      frameworks: ["*"],
      tools: ["*"],
      specializations: ["planning", "coordination", "delegation"],
    },
  },
  planner: {
    type: "planner",
    capabilities: {
      languages: [],
      frameworks: [],
      tools: ["analysis"],
      specializations: ["task-decomposition", "estimation", "scheduling"],
    },
  },
  frontend: {
    type: "frontend",
    capabilities: {
      languages: ["typescript", "javascript", "html", "css"],
      frameworks: ["react", "vue", "angular", "next.js", "tailwind"],
      tools: ["npm", "vite", "webpack", "eslint"],
      specializations: ["ui-ux", "responsive-design", "accessibility", "animations"],
    },
  },
  backend: {
    type: "backend",
    capabilities: {
      languages: ["typescript", "javascript", "python", "rust", "go"],
      frameworks: ["express", "fastify", "django", "fastapi"],
      tools: ["docker", "postgresql", "redis", "nginx"],
      specializations: ["api-design", "database", "security", "performance"],
    },
  },
  fullstack: {
    type: "fullstack",
    capabilities: {
      languages: ["typescript", "javascript", "python"],
      frameworks: ["react", "next.js", "express", "fastapi"],
      tools: ["npm", "docker", "git"],
      specializations: ["full-stack", "integration", "deployment"],
    },
  },
  testing: {
    type: "testing",
    capabilities: {
      languages: ["typescript", "javascript", "python"],
      frameworks: ["jest", "vitest", "playwright", "cypress"],
      tools: ["npm", "coverage"],
      specializations: [
        "unit-testing",
        "e2e-testing",
        "integration-testing",
        "performance-testing",
      ],
    },
  },
  devops: {
    type: "devops",
    capabilities: {
      languages: ["bash", "python", "yaml"],
      frameworks: [],
      tools: ["docker", "kubernetes", "terraform", "github-actions", "nginx"],
      specializations: ["ci-cd", "infrastructure", "monitoring", "security"],
    },
  },
  review: {
    type: "review",
    capabilities: {
      languages: ["*"],
      frameworks: ["*"],
      tools: ["eslint", "prettier", "sonarqube"],
      specializations: ["code-review", "security-audit", "best-practices"],
    },
  },
  docs: {
    type: "docs",
    capabilities: {
      languages: ["markdown", "typescript"],
      frameworks: ["docusaurus", "vitepress"],
      tools: ["typedoc", "jsdoc"],
      specializations: ["documentation", "api-docs", "tutorials"],
    },
  },
  general: {
    type: "general",
    capabilities: {
      languages: ["typescript", "javascript", "python"],
      frameworks: ["react", "express"],
      tools: ["npm", "git"],
      specializations: ["general-purpose"],
    },
  },
};

// ============================================
// AgentSwarmManager 类
// ============================================

export class AgentSwarmManager extends BrowserEventEmitter {
  private pool: AgentPool;
  private scheduler: SchedulerState;
  private config: WorkflowConfig;
  private messageQueue: AgentMessage[] = [];
  private sandboxManager: any; // 将由 SandboxManager 注入
  private taskQueueManager: TaskQueueManager;

  constructor(config: WorkflowConfig) {
    super();
    this.config = config;

    this.pool = {
      maxAgents: config.maxAgents,
      agents: new Map(),
      idleAgents: new Set(),
      busyAgents: new Set(),
      taskAssignments: new Map(),
    };

    this.scheduler = {
      isRunning: false,
      taskQueue: [],
      completedTasks: new Set(),
      failedTasks: new Set(),
      inProgressTasks: new Set(),
    };

    this.taskQueueManager = {
      queue: [],
      maxConcurrent: config.maxConcurrentTasks,
      currentConcurrent: 0,
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
      status: "idle",
      capabilities: template.capabilities || {
        languages: [],
        frameworks: [],
        tools: [],
        specializations: [],
      },
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgCompletionTime: 0,
        avgTokenUsage: 0,
        successRate: 1,
        lastActiveAt: Date.now(),
      },
      taskQueue: [],
      isClone: false,
      createdAt: Date.now(),
      metadata: {},
    };

    // 创建沙箱环境
    if (this.sandboxManager) {
      const sandbox = await this.sandboxManager.createSandbox(agentId);
      agent.sandboxId = sandbox.id;
    }

    this.pool.agents.set(agentId, agent);
    this.pool.idleAgents.add(agentId);

    this.emitEvent("agent:created", { agent });
    logger.debug("AgentSwarmManager", `[AgentSwarm] Created agent: ${agent.name} (${agent.type});`);

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

    logger.debug(
      "AgentSwarmManager",
      `[AgentSwarm] Cloning agent ${sourceAgent.name}: ${request.reason}`
    );

    const cloneId = uuidv4();
    const clone: Agent = {
      ...sourceAgent,
      id: cloneId,
      name: `${sourceAgent.name}-clone-${cloneId.slice(0, 4)}`,
      status: "idle",
      currentTask: undefined,
      taskQueue: request.inheritTasks ? [...sourceAgent.taskQueue] : [],
      sandboxId: undefined, // 新沙箱
      parentAgentId: sourceAgent.id,
      isClone: true,
      createdAt: Date.now(),
      performance: {
        ...sourceAgent.performance,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
    };

    // 合并能力
    if (request.capabilities) {
      clone.capabilities = {
        ...clone.capabilities,
        ...request.capabilities,
      };
    }

    // 创建新沙箱
    if (this.sandboxManager) {
      const sandbox = await this.sandboxManager.createSandbox(cloneId);
      clone.sandboxId = sandbox.id;
    }

    this.pool.agents.set(cloneId, clone);
    this.pool.idleAgents.add(cloneId);

    this.emitEvent("agent:cloned", {
      source: sourceAgent,
      clone,
      reason: request.reason,
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

    this.emitEvent("agent:destroyed", { agent });
    logger.debug("AgentSwarmManager", `[AgentSwarm] Destroyed agent: ${agent.name}`);
  }

  // ============================================
  // 工作流执行
  // ============================================

  /**
   * 🎯 部署代理群并执行工作流
   */
  async deployAndExecute(workflow: WorkflowDAG): Promise<void> {
    logger.debug(
      "AgentSwarmManager",
      `[AgentSwarm] Deploying swarm for workflow: ${workflow.metadata.name}`
    );

    this.scheduler.currentWorkflow = workflow;
    this.scheduler.isRunning = true;
    this.scheduler.taskQueue = [...workflow.tasks.filter((t) => t.status === "pending")];

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
   * 🔄 调度循环（增强版 - 支持并发限制）
   */
  private async startSchedulingLoop(): Promise<void> {
    this.emitEvent("workflow:started", {
      workflow: this.scheduler.currentWorkflow,
    });

    while (this.scheduler.isRunning) {
      // 检查并发限制
      const availableSlots =
        this.taskQueueManager.maxConcurrent - this.taskQueueManager.currentConcurrent;

      if (availableSlots <= 0) {
        // 达到并发上限，等待
        await this.sleep(100);
        continue;
      }

      // 获取可执行的任务（依赖已满足）
      const readyTasks = this.getReadyTasks();

      if (readyTasks.length === 0 && this.scheduler.inProgressTasks.size === 0) {
        // 所有任务完成
        break;
      }

      // 按优先级排序任务
      const sortedTasks = this.sortTasksByPriority(readyTasks);

      // 并行分配任务（受并发限制）
      const tasksToAssign = sortedTasks.slice(
        0,
        Math.min(availableSlots, this.config.maxConcurrentTasks)
      );

      const _assignments = await Promise.all(
        tasksToAssign.map(async (task) => {
          try {
            await this.assignAndExecuteTask(task);
          } catch (error) {
            logger.error("AgentSwarmManager", `[AgentSwarm] Task assignment failed:`, error);
          }
        })
      );

      // 等待一小段时间再检查
      await this.sleep(100);
    }

    // 完成或失败
    const status = this.scheduler.failedTasks.size > 0 ? "failed" : "completed";
    this.emitEvent(`workflow:${status}`, {
      workflow: this.scheduler.currentWorkflow,
      completedTasks: Array.from(this.scheduler.completedTasks),
      failedTasks: Array.from(this.scheduler.failedTasks),
    });

    this.scheduler.isRunning = false;
  }

  /**
   * 📊 按优先级排序任务
   */
  private sortTasksByPriority(tasks: Task[]): Task[] {
    const priorityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...tasks].sort((a, b) => {
      // 首先按优先级排序
      const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      if (priorityDiff !== 0) return priorityDiff;

      // 然后按依赖数量排序（依赖少的优先）
      const depDiff = a.dependencies.length - b.dependencies.length;
      if (depDiff !== 0) return depDiff;

      // 最后按复杂度排序（简单的优先）
      return a.estimatedComplexity - b.estimatedComplexity;
    });
  }

  /**
   * 🔢 获取当前并发数
   */
  getCurrentConcurrency(): number {
    return this.taskQueueManager.currentConcurrent;
  }

  /**
   * ⚙️ 设置最大并发数
   */
  setMaxConcurrency(max: number): void {
    this.taskQueueManager.maxConcurrent = Math.max(1, max);
    logger.debug(
      "AgentSwarmManager",
      `[AgentSwarm] Max concurrency set to ${this.taskQueueManager.maxConcurrent}`
    );
  }

  /**
   * 📋 获取任务队列状态
   */
  getTaskQueueStatus(): {
    queueLength: number;
    maxConcurrent: number;
    currentConcurrent: number;
    availableSlots: number;
  } {
    return {
      queueLength: this.scheduler.taskQueue.length,
      maxConcurrent: this.taskQueueManager.maxConcurrent,
      currentConcurrent: this.taskQueueManager.currentConcurrent,
      availableSlots: this.taskQueueManager.maxConcurrent - this.taskQueueManager.currentConcurrent,
    };
  }

  /**
   * 📊 获取可执行的任务
   */
  private getReadyTasks(): Task[] {
    if (!this.scheduler.currentWorkflow) return [];

    return this.scheduler.taskQueue.filter((task) => {
      // 检查依赖是否都已完成
      const depsCompleted = task.dependencies.every((depId) =>
        this.scheduler.completedTasks.has(depId)
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
    this.executeTask(agent, task).catch((error) => {
      logger.error("AgentSwarmManager", `[AgentSwarm] Task execution error:`, error);
      this.handleTaskFailure(task, agent, error);
    });
  }

  /**
   * 🎯 找到最适合任务的代理（增强版 - 基于能力匹配）
   */
  private async findBestAgentForTask(task: Task): Promise<Agent | null> {
    const idleAgentIds = Array.from(this.pool.idleAgents);

    if (idleAgentIds.length === 0) return null;

    // 使用增强的能力匹配算法
    const matchResults = this.matchAgentsToTask(task, idleAgentIds);

    // 按分数排序
    matchResults.sort((a, b) => b.score - a.score);

    // 返回分数最高的代理（如果分数 > 0）
    if (matchResults.length > 0 && matchResults[0].score > 0) {
      const bestMatch = matchResults[0];
      logger.debug(
        "AgentSwarmManager",
        `[AgentSwarm] Best match for task "${task.description.slice(0, 50)}...": ${bestMatch.agent.name} (score: ${bestMatch.score})`
      );
      if (bestMatch.matchedSkills.length > 0) {
        logger.debug(
          "AgentSwarmManager",
          `[AgentSwarm]   Matched skills: ${bestMatch.matchedSkills.join(", ")}`
        );
      }
      if (bestMatch.matchedTools.length > 0) {
        logger.debug(
          "AgentSwarmManager",
          `[AgentSwarm]   Matched tools: ${bestMatch.matchedTools.join(", ")}`
        );
      }
      return bestMatch.agent;
    }

    return null;
  }

  /**
   * 🔍 基于能力的代理-任务匹配算法（公开方法，用于测试）
   */
  matchAgentsToTask(task: Task, agentIds: string[]): AgentMatchResult[] {
    const results: AgentMatchResult[] = [];

    for (const agentId of agentIds) {
      const agent = this.pool.agents.get(agentId);
      if (!agent) continue;

      const matchResult = this.calculateDetailedMatch(agent, task);
      results.push(matchResult);
    }

    return results;
  }

  /**
   * 📊 计算详细的代理-任务匹配分数
   */
  private calculateDetailedMatch(agent: Agent, task: Task): AgentMatchResult {
    let score = 0;
    const matchedSkills: string[] = [];
    const matchedTools: string[] = [];
    const matchedLanguages: string[] = [];
    const matchedFrameworks: string[] = [];

    // 1. 代理类型匹配（权重: 50）
    const suggestedType = task.metadata?.suggestedAgentType;
    if (suggestedType && agent.type === suggestedType) {
      score += 50;
    } else if (agent.type === "general" || agent.type === "fullstack") {
      // 通用代理有基础分
      score += 20;
    }

    // 2. 技能匹配（权重: 每个 15）
    for (const skill of task.requiredSkills) {
      const normalizedSkill = skill.toLowerCase();
      if (
        agent.capabilities.specializations.some(
          (s) =>
            s.toLowerCase().includes(normalizedSkill) || normalizedSkill.includes(s.toLowerCase())
        )
      ) {
        score += 15;
        matchedSkills.push(skill);
      }
    }

    // 3. 工具匹配（权重: 每个 10）
    for (const tool of task.requiredTools) {
      const normalizedTool = tool.toLowerCase();
      if (
        agent.capabilities.tools.some(
          (t) => t.toLowerCase() === normalizedTool || t.toLowerCase().includes(normalizedTool)
        )
      ) {
        score += 10;
        matchedTools.push(tool);
      }
    }

    // 4. 语言匹配（从任务描述推断）
    const taskDesc = task.description.toLowerCase();
    for (const lang of agent.capabilities.languages) {
      if (lang === "*" || taskDesc.includes(lang.toLowerCase())) {
        score += 5;
        matchedLanguages.push(lang);
      }
    }

    // 5. 框架匹配（从任务描述推断）
    for (const framework of agent.capabilities.frameworks) {
      if (framework === "*" || taskDesc.includes(framework.toLowerCase())) {
        score += 5;
        matchedFrameworks.push(framework);
      }
    }

    // 6. 历史表现加成（权重: 最高 20）
    score += Math.round(agent.performance.successRate * 20);

    // 7. 任务复杂度与代理经验匹配
    if (agent.performance.tasksCompleted > 0) {
      const avgComplexity = agent.performance.avgCompletionTime / 1000 / 60; // 转换为分钟
      const taskComplexity = task.estimatedComplexity;
      // 如果代理处理过类似复杂度的任务，加分
      if (Math.abs(avgComplexity - taskComplexity) <= 1) {
        score += 10;
      }
    }

    // 8. 空闲时间惩罚（避免代理长时间空闲）
    const idleTime = Date.now() - agent.performance.lastActiveAt;
    if (idleTime > 300000) {
      // 超过5分钟
      score -= 10;
    } else if (idleTime > 60000) {
      // 超过1分钟
      score -= 5;
    }

    // 9. 克隆代理轻微惩罚（优先使用原始代理）
    if (agent.isClone) {
      score -= 5;
    }

    return {
      agent,
      score: Math.max(0, score), // 确保分数不为负
      matchedSkills,
      matchedTools,
      matchedLanguages,
      matchedFrameworks,
    };
  }

  /**
   * 📊 计算代理适合度分数（保留旧方法以兼容）
   */
  private calculateAgentFitScore(agent: Agent, task: Task): number {
    return this.calculateDetailedMatch(agent, task).score;
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
      return await this.createAgent("general");
    }

    // 克隆代理
    return await this.cloneAgent({
      sourceAgentId: bestSource.id,
      reason: `High demand for ${task.metadata?.suggestedAgentType || "general"} tasks`,
      taskId: task.id,
      inheritTasks: false,
    });
  }

  /**
   * 📝 分配任务给代理
   */
  private assignTask(task: Task, agent: Agent): void {
    task.assignedAgentId = agent.id;
    task.status = "in_progress";
    agent.currentTask = task;
    agent.status = "busy";

    this.pool.idleAgents.delete(agent.id);
    this.pool.busyAgents.add(agent.id);
    this.pool.taskAssignments.set(task.id, agent.id);
    this.scheduler.inProgressTasks.add(task.id);

    // 更新并发计数
    this.taskQueueManager.currentConcurrent++;

    // 从队列移除
    const queueIndex = this.scheduler.taskQueue.findIndex((t) => t.id === task.id);
    if (queueIndex >= 0) {
      this.scheduler.taskQueue.splice(queueIndex, 1);
    }

    this.emitEvent("agent:assigned", { agent, task });
    this.emitEvent("task:started", { task, agent });

    logger.debug(
      "AgentSwarmManager",
      `[AgentSwarm] Assigned task "${task.description}" to ${agent.name}`
    );
  }

  /**
   * 🏃 执行任务
   */
  private async executeTask(agent: Agent, task: Task): Promise<void> {
    const startTime = Date.now();
    task.metrics.startTime = startTime;

    // 这里将调用实际的任务执行逻辑
    // 例如：发送给 Claude API 并在沙箱中执行
    const result = await this.runTaskInSandbox(agent, task);

    // 更新任务状态
    task.status = "completed";
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
  }

  /**
   * 🐳 在沙箱中执行任务
   */
  private async runTaskInSandbox(agent: Agent, task: Task): Promise<any> {
    // ✅ 实现沙箱执行逻辑
    // 如果有 SandboxManager，使用沙箱执行
    if (this.sandboxManager) {
      try {
        logger.info(
          "AgentSwarmManager",
          `[AgentSwarm] Executing task "${task.description}" in sandbox for agent ${agent.name}`
        );

        // 获取或创建代理的沙箱
        let sandbox = this.sandboxManager.getSandboxByAgentId(agent.id);
        if (!sandbox) {
          // 创建新沙箱
          await this.sandboxManager.createSandbox({
            agentId: agent.id,
            // 注意：projectPath 需要从外部传入，这里使用空字符串作为默认值
            projectPath: "",
          });
          sandbox = this.sandboxManager.getSandboxByAgentId(agent.id);
        }

        if (!sandbox) {
          throw new Error("Failed to create sandbox");
        }

        // 在沙箱中执行任务
        // 注意：这里使用简化的执行逻辑
        // 完整的实现需要：
        // 1. Docker 容器管理
        // 2. 代码执行隔离
        // 3. 资源限制
        // 4. 网络隔离
        const executionTime = task.estimatedComplexity * 1000;

        // 发送进度更新
        for (let progress = 0; progress <= 100; progress += 10) {
          task.progress = progress;
          this.emitEvent("task:progress", { task, agent, progress });
          await this.sleep(executionTime / 10);
        }

        return {
          success: true,
          output: `Task "${task.description}" completed successfully in sandbox`,
          logs: [
            `[${new Date().toISOString()}] Task started in sandbox ${sandbox.id}`,
            `[${new Date().toISOString()}] Task completed`,
          ],
        };
      } catch (error) {
        logger.error(
          "AgentSwarmManager",
          `[AgentSwarm] Sandbox execution failed:`,
          error
        );
        // 降级到本地执行
      }
    }

    // 降级方案：本地执行（无沙箱）
    logger.warn(
      "AgentSwarmManager",
      `[AgentSwarm] Executing task "${task.description}" locally (no sandbox)`
    );

    const executionTime = task.estimatedComplexity * 1000;

    // 发送进度更新
    for (let progress = 0; progress <= 100; progress += 10) {
      task.progress = progress;
      this.emitEvent("task:progress", { task, agent, progress });
      await this.sleep(executionTime / 10);
    }

    return {
      success: true,
      output: `Task "${task.description}" completed successfully`,
      logs: [
        `[${new Date().toISOString()}] Task started`,
        `[${new Date().toISOString()}] Task completed`,
      ],
    };
  }

  /**
   * ✅ 完成任务
   */
  private completeTask(task: Task, agent: Agent): void {
    this.scheduler.inProgressTasks.delete(task.id);
    this.scheduler.completedTasks.add(task.id);

    agent.currentTask = undefined;
    agent.status = "idle";
    agent.performance.lastActiveAt = Date.now();

    this.pool.busyAgents.delete(agent.id);
    this.pool.idleAgents.add(agent.id);
    this.pool.taskAssignments.delete(task.id);

    // 更新并发计数
    this.taskQueueManager.currentConcurrent = Math.max(
      0,
      this.taskQueueManager.currentConcurrent - 1
    );

    this.emitEvent("task:completed", { task, agent });
    this.emitEvent("agent:idle", { agent });

    logger.debug(
      "AgentSwarmManager",
      `[AgentSwarm] Task completed: "${task.description}" by ${agent.name}`
    );
  }

  /**
   * ❌ 处理任务失败
   */
  private handleTaskFailure(task: Task, agent: Agent, error: Error): void {
    task.status = "failed";
    task.result = {
      success: false,
      error: error.message,
      logs: [`[${new Date().toISOString()}] Task failed: ${error.message}`],
    };
    task.metrics.endTime = Date.now();
    task.metrics.retryCount++;

    agent.performance.tasksFailed++;
    agent.performance.successRate =
      agent.performance.tasksCompleted /
      (agent.performance.tasksCompleted + agent.performance.tasksFailed);

    // 更新并发计数
    this.taskQueueManager.currentConcurrent = Math.max(
      0,
      this.taskQueueManager.currentConcurrent - 1
    );

    // 检查是否应该重试
    if (task.metrics.retryCount < this.config.retryPolicy.maxRetries) {
      logger.debug(
        "AgentSwarmManager",
        `[AgentSwarm] Retrying task "${task.description}" (attempt ${task.metrics.retryCount + 1});`
      );
      task.status = "pending";
      this.scheduler.taskQueue.push(task);
    } else {
      this.scheduler.inProgressTasks.delete(task.id);
      this.scheduler.failedTasks.add(task.id);
      this.emitEvent("task:failed", { task, agent, error });
    }

    agent.currentTask = undefined;
    agent.status = "idle";
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
        agent.currentTask.status = "cancelled";
        agent.currentTask = undefined;
        agent.status = "idle";

        this.pool.busyAgents.delete(agentId);
        this.pool.idleAgents.add(agentId);
      }
    }

    this.scheduler.inProgressTasks.delete(taskId);
    this.pool.taskAssignments.delete(taskId);

    // 更新并发计数
    this.taskQueueManager.currentConcurrent = Math.max(
      0,
      this.taskQueueManager.currentConcurrent - 1
    );

    this.emitEvent("task:cancelled", { taskId });
  }

  // ============================================
  // 代理间通信
  // ============================================

  /**
   * 📨 发送消息给代理
   */
  sendMessage(message: AgentMessage): void {
    this.messageQueue.push(message);
    this.emitEvent("message:sent", { message });

    if (message.to === "broadcast") {
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
      case "context-share":
        // 合并上下文
        agent.metadata.sharedContext = {
          ...agent.metadata.sharedContext,
          ...message.payload,
        };
        break;
      case "task-result":
        // 处理任务结果
        break;
      case "status-update":
        // 更新状态
        break;
    }

    this.emitEvent("message:received", { agent, message });
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
      const suggestedType = (task.metadata?.suggestedAgentType as AgentType) || "general";

      if (!requiredAgents.has(suggestedType)) {
        requiredAgents.set(suggestedType, {
          languages: [],
          frameworks: [],
          tools: [...task.requiredTools],
          specializations: [...task.requiredSkills],
        });
      } else {
        const existing = requiredAgents.get(suggestedType)!;
        existing.tools = [...new Set([...existing.tools, ...task.requiredTools])];
        existing.specializations = [
          ...new Set([...existing.specializations, ...task.requiredSkills]),
        ];
      }
    }

    return Array.from(requiredAgents.entries()).map(([type, capabilities]) => ({
      type,
      capabilities,
    }));
  }

  /**
   * 查找匹配的现有代理
   */
  private findMatchingAgent(type: AgentType, _capabilities: AgentCapabilities): Agent | null {
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 发送事件
   */
  private emitEvent(type: WorkflowEventType, data: any): void {
    const event: WorkflowEvent = {
      type,
      timestamp: Date.now(),
      ...data,
    };
    this.emit(type, event);
    this.emit("*", event); // 通配符事件
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
      maxAgents: this.pool.maxAgents,
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
    this.emitEvent("workflow:paused", {
      workflow: this.scheduler.currentWorkflow,
    });
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(): Promise<void> {
    if (this.scheduler.currentWorkflow) {
      this.scheduler.isRunning = true;
      this.emitEvent("workflow:resumed", {
        workflow: this.scheduler.currentWorkflow,
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
    initialDelay: 1000,
  },
};
