/**
 * Agent Collaboration System - 代理协作系统
 *
 * 实现 Kiro 风格的 Agentic 协作机制：
 * 1. 任务依赖管理
 * 2. 代理间数据传递
 * 3. 工作流编排
 * 4. 结果聚合
 *
 * 灵感来源：Kiro 的多代理协作架构
 */

import type { TechnicalSpec, ImplementationPhase, TaskSpec } from '../spec/SpecGenerationEngine';

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

// 协作任务
export interface CollaborationTask {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  status: TaskStatus;
  dependencies: string[];
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// 工作流阶段
export interface WorkflowPhase {
  phase: number;
  name: string;
  tasks: CollaborationTask[];
  status: TaskStatus;
}

// 协作工作流
export interface CollaborationWorkflow {
  id: string;
  name: string;
  spec: TechnicalSpec;
  phases: WorkflowPhase[];
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// 代理执行结果
export interface AgentExecutionResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
}

/**
 * 代理协作系统
 */
export class AgentCollaborationSystem {
  private workflows: Map<string, CollaborationWorkflow> = new Map();
  private taskResults: Map<string, AgentExecutionResult> = new Map();

  /**
   * 从技术规范创建协作工作流
   */
  createWorkflowFromSpec(spec: TechnicalSpec): CollaborationWorkflow {
    const workflowId = `workflow-${Date.now()}`;

    // 将规范的实现阶段转换为工作流阶段
    const phases: WorkflowPhase[] = spec.implementation.phases.map((implPhase) => {
      const tasks = this.createTasksFromPhase(implPhase, spec);

      return {
        phase: implPhase.phase,
        name: implPhase.name,
        tasks,
        status: 'pending' as TaskStatus,
      };
    });

    const workflow: CollaborationWorkflow = {
      id: workflowId,
      name: spec.metadata.title,
      spec,
      phases,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.workflows.set(workflowId, workflow);

    return workflow;
  }

  /**
   * 从实现阶段创建协作任务
   */
  private createTasksFromPhase(
    phase: ImplementationPhase,
    spec: TechnicalSpec
  ): CollaborationTask[] {
    return phase.tasks.map((taskSpec) => {
      // 根据任务类型分配代理
      const agentId = this.assignAgentForTask(taskSpec, spec);

      return {
        id: taskSpec.id,
        title: taskSpec.title,
        description: taskSpec.description,
        assignedAgent: agentId,
        status: 'pending',
        dependencies: taskSpec.dependencies || [],
      };
    });
  }

  /**
   * 为任务分配最合适的代理
   */
  private assignAgentForTask(task: TaskSpec, spec: TechnicalSpec): string {
    // 如果任务已指定代理，直接使用
    if (task.assignedTo) {
      return task.assignedTo;
    }

    // 根据任务描述智能分配代理
    const description = task.description.toLowerCase();

    if (description.includes('generate') || description.includes('implement') || description.includes('create code')) {
      return 'code-generator';
    }

    if (description.includes('test') || description.includes('unit test') || description.includes('integration test')) {
      return 'test-writer';
    }

    if (description.includes('deploy') || description.includes('build') || description.includes('release')) {
      return 'deployer';
    }

    if (description.includes('monitor') || description.includes('observability') || description.includes('metrics')) {
      return 'monitor';
    }

    if (description.includes('frontend') || description.includes('ui') || description.includes('component')) {
      return 'frontend';
    }

    if (description.includes('backend') || description.includes('api') || description.includes('database')) {
      return 'backend';
    }

    if (description.includes('document') || description.includes('readme') || description.includes('guide')) {
      return 'docs';
    }

    // 默认分配给 orchestrator
    return 'orchestrator';
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string,
    agentExecutor: (agentId: string, task: CollaborationTask) => Promise<AgentExecutionResult>
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = 'in_progress';
    workflow.startedAt = new Date().toISOString();

    try {
      // 按阶段顺序执行
      for (const phase of workflow.phases) {
        await this.executePhase(phase, agentExecutor);
      }

      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
    } catch (error) {
      workflow.status = 'failed';
      throw error;
    }
  }

  /**
   * 执行工作流阶段
   */
  private async executePhase(
    phase: WorkflowPhase,
    agentExecutor: (agentId: string, task: CollaborationTask) => Promise<AgentExecutionResult>
  ): Promise<void> {
    phase.status = 'in_progress';

    // 获取所有可以立即执行的任务（没有依赖或依赖已完成）
    const readyTasks = this.getReadyTasks(phase.tasks);

    while (readyTasks.length > 0) {
      // 并行执行所有就绪的任务
      const results = await Promise.all(
        readyTasks.map((task) => this.executeTask(task, agentExecutor))
      );

      // 更新任务状态
      results.forEach((result) => {
        this.taskResults.set(result.taskId, result);

        const task = phase.tasks.find((t) => t.id === result.taskId);
        if (task) {
          if (result.success) {
            task.status = 'completed';
            task.output = result.output;
            task.completedAt = new Date().toISOString();
          } else {
            task.status = 'failed';
            task.error = result.error;
          }
        }
      });

      // 检查是否有失败的任务
      const failedTasks = results.filter((r) => !r.success);
      if (failedTasks.length > 0) {
        phase.status = 'failed';
        throw new Error(`Phase ${phase.name} failed: ${failedTasks.length} tasks failed`);
      }

      // 获取下一批就绪的任务
      readyTasks.length = 0;
      readyTasks.push(...this.getReadyTasks(phase.tasks));
    }

    // 检查是否所有任务都完成
    const allCompleted = phase.tasks.every((t) => t.status === 'completed');
    if (allCompleted) {
      phase.status = 'completed';
    } else {
      phase.status = 'blocked';
      throw new Error(`Phase ${phase.name} is blocked: some tasks cannot be completed`);
    }
  }

  /**
   * 获取所有就绪的任务（没有依赖或依赖已完成）
   */
  private getReadyTasks(tasks: CollaborationTask[]): CollaborationTask[] {
    return tasks.filter((task) => {
      if (task.status !== 'pending') {
        return false;
      }

      // 检查所有依赖是否已完成
      return task.dependencies.every((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
    });
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: CollaborationTask,
    agentExecutor: (agentId: string, task: CollaborationTask) => Promise<AgentExecutionResult>
  ): Promise<AgentExecutionResult> {
    task.status = 'in_progress';
    task.startedAt = new Date().toISOString();

    // 收集依赖任务的输出作为输入
    const dependencyOutputs = this.collectDependencyOutputs(task);
    task.input = dependencyOutputs;

    try {
      const result = await agentExecutor(task.assignedAgent, task);
      return result;
    } catch (error) {
      return {
        taskId: task.id,
        agentId: task.assignedAgent,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
      };
    }
  }

  /**
   * 收集依赖任务的输出
   */
  private collectDependencyOutputs(task: CollaborationTask): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    for (const depId of task.dependencies) {
      const result = this.taskResults.get(depId);
      if (result && result.output) {
        outputs[depId] = result.output;
      }
    }

    return outputs;
  }

  /**
   * 获取工作流状态
   */
  getWorkflowStatus(workflowId: string): CollaborationWorkflow | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * 获取任务结果
   */
  getTaskResult(taskId: string): AgentExecutionResult | null {
    return this.taskResults.get(taskId) || null;
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows(): CollaborationWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 取消工作流
   */
  cancelWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow && workflow.status === 'in_progress') {
      workflow.status = 'failed';
      workflow.completedAt = new Date().toISOString();
    }
  }

  /**
   * 重试失败的任务
   */
  async retryFailedTask(
    workflowId: string,
    taskId: string,
    agentExecutor: (agentId: string, task: CollaborationTask) => Promise<AgentExecutionResult>
  ): Promise<AgentExecutionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // 查找任务
    let task: CollaborationTask | undefined;
    for (const phase of workflow.phases) {
      task = phase.tasks.find((t) => t.id === taskId);
      if (task) break;
    }

    if (!task) {
      throw new Error(`Task ${taskId} not found in workflow ${workflowId}`);
    }

    if (task.status !== 'failed') {
      throw new Error(`Task ${taskId} is not in failed state`);
    }

    // 重置任务状态
    task.status = 'pending';
    task.error = undefined;

    // 重新执行任务
    return this.executeTask(task, agentExecutor);
  }

  /**
   * 生成工作流报告
   */
  generateWorkflowReport(workflowId: string): string {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return `Workflow ${workflowId} not found`;
    }

    let report = `# Workflow Report: ${workflow.name}\n\n`;
    report += `**Status**: ${workflow.status}\n`;
    report += `**Created**: ${workflow.createdAt}\n`;
    if (workflow.startedAt) {
      report += `**Started**: ${workflow.startedAt}\n`;
    }
    if (workflow.completedAt) {
      report += `**Completed**: ${workflow.completedAt}\n`;
    }
    report += `\n`;

    for (const phase of workflow.phases) {
      report += `## Phase ${phase.phase}: ${phase.name}\n`;
      report += `**Status**: ${phase.status}\n\n`;

      for (const task of phase.tasks) {
        report += `### Task: ${task.title}\n`;
        report += `- **Agent**: ${task.assignedAgent}\n`;
        report += `- **Status**: ${task.status}\n`;
        if (task.dependencies.length > 0) {
          report += `- **Dependencies**: ${task.dependencies.join(', ')}\n`;
        }
        if (task.error) {
          report += `- **Error**: ${task.error}\n`;
        }
        report += `\n`;
      }
    }

    return report;
  }
}

export default AgentCollaborationSystem;
