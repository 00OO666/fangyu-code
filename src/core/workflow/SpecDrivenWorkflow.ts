/**
 * Spec-Driven Workflow - 规范驱动工作流
 *
 * 整合规范生成引擎、LSP 自动加载器和代理协作系统
 * 实现完整的 Kiro 风格的规范驱动开发流程
 *
 * 工作流程：
 * 1. 用户提供自然语言需求
 * 2. 规范生成引擎生成技术规范
 * 3. 规范分析代理验证规范
 * 4. 创建协作工作流
 * 5. 多代理协作执行任务
 * 6. LSP 提供实时代码分析支持
 * 7. 生成最终报告
 */

import { SpecGenerationEngine, TechnicalSpec, SpecType } from '../spec/SpecGenerationEngine';
import { AgentCollaborationSystem, CollaborationWorkflow, AgentExecutionResult, CollaborationTask } from '../agents/AgentCollaborationSystem';
import { LSPAutoLoader } from '../tools/LSPAutoLoader';
import type { RealAPIClient } from '../api/RealAPIClient';

// 工作流配置
export interface WorkflowConfig {
  workspaceRoot: string;
  apiClient: RealAPIClient;
  model?: string;
  enableLSP?: boolean;
}

// 工作流执行选项
export interface WorkflowExecutionOptions {
  dryRun?: boolean;
  parallelExecution?: boolean;
  stopOnError?: boolean;
}

// 工作流执行结果
export interface WorkflowExecutionResult {
  workflowId: string;
  spec: TechnicalSpec;
  workflow: CollaborationWorkflow;
  success: boolean;
  duration: number;
  report: string;
  errors?: string[];
}

/**
 * 规范驱动工作流管理器
 */
export class SpecDrivenWorkflow {
  private specEngine: SpecGenerationEngine;
  private collaborationSystem: AgentCollaborationSystem;
  private lspLoader?: LSPAutoLoader;
  private workspaceRoot: string;

  constructor(config: WorkflowConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.specEngine = new SpecGenerationEngine(config.apiClient, config.model);
    this.collaborationSystem = new AgentCollaborationSystem();

    if (config.enableLSP !== false) {
      this.lspLoader = new LSPAutoLoader(config.workspaceRoot);
    }
  }

  /**
   * 初始化工作流系统
   */
  async initialize(): Promise<void> {
    if (this.lspLoader) {
      await this.lspLoader.initialize();
      console.log('LSP Auto Loader initialized');
      console.log(this.lspLoader.getLLMContext());
    }
  }

  /**
   * 从需求创建并执行完整的工作流
   */
  async executeFromRequirements(
    requirements: string,
    type: SpecType,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 步骤 1: 生成技术规范
      console.log('Step 1: Generating technical specification...');
      const spec = await this.specEngine.generateSpec(requirements, type);
      console.log(`Specification generated: ${spec.metadata.title}`);

      // 步骤 2: 验证规范（使用 SpecAnalyzer 代理）
      console.log('Step 2: Validating specification...');
      const validationResult = await this.validateSpec(spec);
      if (!validationResult.valid) {
        errors.push(`Specification validation failed: ${validationResult.issues.join(', ')}`);
        if (options.stopOnError) {
          throw new Error('Specification validation failed');
        }
      }

      // 步骤 3: 创建协作工作流
      console.log('Step 3: Creating collaboration workflow...');
      const workflow = this.collaborationSystem.createWorkflowFromSpec(spec);
      console.log(`Workflow created: ${workflow.id}`);

      // 步骤 4: 执行工作流（如果不是 dry run）
      if (!options.dryRun) {
        console.log('Step 4: Executing workflow...');
        await this.collaborationSystem.executeWorkflow(
          workflow.id,
          (agentId, task) => this.executeAgentTask(agentId, task)
        );
        console.log('Workflow execution completed');
      } else {
        console.log('Step 4: Skipped (dry run mode)');
      }

      // 步骤 5: 生成报告
      console.log('Step 5: Generating report...');
      const report = this.collaborationSystem.generateWorkflowReport(workflow.id);

      const duration = Date.now() - startTime;

      return {
        workflowId: workflow.id,
        spec,
        workflow,
        success: workflow.status === 'completed',
        duration,
        report,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : String(error));

      throw new Error(`Workflow execution failed: ${errors.join(', ')}`);
    }
  }

  /**
   * 验证技术规范
   */
  private async validateSpec(spec: TechnicalSpec): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // 检查必需字段
    if (!spec.metadata.title) {
      issues.push('Missing specification title');
    }

    if (!spec.requirements.summary) {
      issues.push('Missing requirements summary');
    }

    if (spec.requirements.acceptanceCriteria.length === 0) {
      issues.push('No acceptance criteria defined');
    }

    if (spec.implementation.phases.length === 0) {
      issues.push('No implementation phases defined');
    }

    // 检查任务依赖的有效性
    for (const phase of spec.implementation.phases) {
      for (const task of phase.tasks) {
        if (task.dependencies) {
          for (const depId of task.dependencies) {
            const depExists = phase.tasks.some((t) => t.id === depId);
            if (!depExists) {
              issues.push(`Task ${task.id} has invalid dependency: ${depId}`);
            }
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 执行代理任务
   */
  private async executeAgentTask(
    agentId: string,
    task: CollaborationTask
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      console.log(`Executing task ${task.id} with agent ${agentId}...`);

      // 构建任务上下文
      const context = this.buildTaskContext(task);

      // 调用代理执行任务
      // 注意：这里需要实际的代理执行逻辑
      // 在真实实现中，这应该调用 UnifiedAgentOrchestrator
      const output = await this.mockAgentExecution(agentId, task, context);

      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        agentId,
        success: true,
        output,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        agentId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * 构建任务上下文
   */
  private buildTaskContext(task: CollaborationTask): Record<string, unknown> {
    const context: Record<string, unknown> = {
      taskId: task.id,
      title: task.title,
      description: task.description,
      dependencies: task.input || {},
    };

    // 添加 LSP 上下文（如果可用）
    if (this.lspLoader) {
      context.lspContext = this.lspLoader.getLLMContext();
      context.lspTools = this.lspLoader.getTools();
    }

    return context;
  }

  /**
   * Mock 代理执行（用于测试）
   * 在真实实现中，这应该调用实际的代理系统
   */
  private async mockAgentExecution(
    agentId: string,
    task: CollaborationTask,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // 模拟执行延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      agentId,
      taskId: task.id,
      result: `Task ${task.title} completed by ${agentId}`,
      context,
    };
  }

  /**
   * 获取工作流状态
   */
  getWorkflowStatus(workflowId: string) {
    return this.collaborationSystem.getWorkflowStatus(workflowId);
  }

  /**
   * 取消工作流
   */
  cancelWorkflow(workflowId: string): void {
    this.collaborationSystem.cancelWorkflow(workflowId);
  }

  /**
   * 重试失败的任务
   */
  async retryFailedTask(workflowId: string, taskId: string): Promise<AgentExecutionResult> {
    return this.collaborationSystem.retryFailedTask(
      workflowId,
      taskId,
      (agentId, task) => this.executeAgentTask(agentId, task)
    );
  }

  /**
   * 导出规范
   */
  async exportSpec(
    spec: TechnicalSpec,
    format: 'json' | 'yaml' | 'markdown'
  ): Promise<string> {
    return this.specEngine.exportSpec(spec, format);
  }

  /**
   * 更新规范
   */
  async updateSpec(spec: TechnicalSpec, updates: string): Promise<TechnicalSpec> {
    return this.specEngine.updateSpec(spec, updates);
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows() {
    return this.collaborationSystem.getAllWorkflows();
  }

  /**
   * 关闭工作流系统
   */
  async shutdown(): Promise<void> {
    if (this.lspLoader) {
      await this.lspLoader.shutdown();
    }
  }
}

export default SpecDrivenWorkflow;
