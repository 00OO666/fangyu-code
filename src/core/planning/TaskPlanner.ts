/**
 * TaskPlanner - 智能任务规划器
 *
 * 核心功能：
 * 1. 将用户需求分解为 DAG 工作流
 * 2. 识别可并行执行的任务
 * 3. 计算关键路径
 * 4. 动态调整工作流
 *
 * 灵感来源：
 * - Devin 2.0 的多代理调度
 * - Windsurf Cascade 的 Codemaps
 * - Claude Tasks Mode 的结构化规划
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  TaskType,
  TaskPriority,
  WorkflowDAG,
  WorkflowEdge,
  WorkflowMetadata,
  WorkflowConfig
} from '../types/workflow';

// ============================================
// Prompt Templates
// ============================================

const TASK_DECOMPOSITION_PROMPT = `你是一个资深软件架构师和项目管理专家。你需要分析用户的需求并生成一个详细的任务分解计划。

## 输入
用户需求：{{userPrompt}}

项目上下文：{{projectContext}}

## 输出要求
请生成一个 JSON 格式的任务分解，包含以下结构：

\`\`\`json
{
  "analysis": {
    "summary": "需求概述",
    "complexity": "simple|moderate|complex|extreme",
    "estimatedHours": 10,
    "keyComponents": ["组件1", "组件2"],
    "techStack": ["React", "TypeScript", "Node.js"],
    "risks": ["风险1", "风险2"]
  },
  "tasks": [
    {
      "id": "task-1",
      "description": "任务描述（简洁明确）",
      "type": "sequential|parallel|conditional",
      "priority": "low|medium|high|critical",
      "dependencies": [],
      "estimatedComplexity": 1-5,
      "requiredSkills": ["skill1", "skill2"],
      "requiredTools": ["tool1", "tool2"],
      "subtasks": [
        {
          "description": "子任务描述",
          "estimatedMinutes": 30
        }
      ],
      "acceptanceCriteria": ["验收标准1", "验收标准2"],
      "suggestedAgentType": "frontend|backend|testing|devops|general"
    }
  ],
  "parallelGroups": [
    ["task-2", "task-3", "task-4"]
  ],
  "criticalPath": ["task-1", "task-5", "task-8"]
}
\`\`\`

## 分解原则
1. **原子性**：每个任务应该是可独立完成的最小单元
2. **并行性**：最大化识别可并行执行的任务
3. **依赖性**：明确标注任务间的依赖关系
4. **可测试性**：每个任务应有明确的验收标准
5. **估算准确性**：根据复杂度合理估算时间

## 任务类型说明
- **sequential**: 必须顺序执行的任务
- **parallel**: 可以与其他任务并行执行
- **conditional**: 根据条件决定是否执行

## 优先级说明
- **critical**: 阻塞其他任务，必须优先完成
- **high**: 重要任务，尽快完成
- **medium**: 常规任务
- **low**: 可延后的任务

请确保生成的 JSON 是有效的，并且任务分解是完整的、可执行的。`;

const WORKFLOW_ADJUSTMENT_PROMPT = `你是一个工作流优化专家。根据当前执行状态，调整剩余工作流。

## 当前状态
已完成任务：{{completedTasks}}
失败任务：{{failedTasks}}
当前执行中：{{inProgressTasks}}
剩余任务：{{pendingTasks}}

## 失败原因分析
{{failureAnalysis}}

## 要求
1. 分析失败原因，提供替代方案
2. 重新评估剩余任务的优先级
3. 识别可以跳过的任务
4. 优化并行执行策略

请输出调整后的任务列表（JSON 格式）。`;

// ============================================
// TaskPlanner 类
// ============================================

export interface TaskPlannerConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxThinkingTokens: number;
  temperature: number;
}

export interface PlanningContext {
  projectPath?: string;
  existingFiles?: string[];
  techStack?: string[];
  constraints?: string[];
  previousPlans?: WorkflowDAG[];
}

export interface PlanningResult {
  workflow: WorkflowDAG;
  analysis: {
    summary: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'extreme';
    estimatedHours: number;
    keyComponents: string[];
    techStack: string[];
    risks: string[];
  };
  thinkingProcess?: string; // Claude 的思考过程
}

export class TaskPlanner {
  private config: TaskPlannerConfig;
  private planningHistory: Map<string, PlanningResult> = new Map();

  constructor(config: TaskPlannerConfig) {
    this.config = config;
  }

  /**
   * 🎯 核心方法：生成工作流 DAG
   */
  async generateWorkflowDAG(
    userPrompt: string,
    context?: PlanningContext
  ): Promise<PlanningResult> {
    const startTime = Date.now();

    // 构建完整的 prompt
    const fullPrompt = this.buildPrompt(userPrompt, context);

    // 调用 Claude API（使用 ultrathink 模式）
    const response = await this.callClaudeAPI(fullPrompt, true);

    // 解析响应
    const parsedResult = this.parseResponse(response);

    // 构建 WorkflowDAG
    const workflow = this.buildWorkflowDAG(parsedResult, userPrompt);

    // 验证 DAG 有效性
    this.validateDAG(workflow);

    // 计算关键路径
    this.calculateCriticalPath(workflow);

    const result: PlanningResult = {
      workflow,
      analysis: parsedResult.analysis,
      thinkingProcess: response.thinking
    };

    // 保存到历史
    this.planningHistory.set(workflow.metadata.id, result);

    console.log(`[TaskPlanner] Generated workflow in ${Date.now() - startTime}ms`);
    console.log(`[TaskPlanner] Tasks: ${workflow.tasks.length}, Parallel groups: ${workflow.parallelGroups.length}`);

    return result;
  }

  /**
   * 🔄 动态调整工作流
   */
  async adjustWorkflow(
    currentWorkflow: WorkflowDAG,
    executionState: {
      completedTasks: string[];
      failedTasks: string[];
      inProgressTasks: string[];
    },
    failureAnalysis?: string
  ): Promise<WorkflowDAG> {
    const prompt = WORKFLOW_ADJUSTMENT_PROMPT
      .replace('{{completedTasks}}', JSON.stringify(executionState.completedTasks))
      .replace('{{failedTasks}}', JSON.stringify(executionState.failedTasks))
      .replace('{{inProgressTasks}}', JSON.stringify(executionState.inProgressTasks))
      .replace('{{pendingTasks}}', JSON.stringify(
        currentWorkflow.tasks
          .filter(t => t.status === 'pending')
          .map(t => t.id)
      ))
      .replace('{{failureAnalysis}}', failureAnalysis || '无');

    const response = await this.callClaudeAPI(prompt, false);
    const adjustedTasks = this.parseAdjustmentResponse(response);

    // 更新工作流
    const updatedWorkflow = this.applyAdjustments(currentWorkflow, adjustedTasks);

    return updatedWorkflow;
  }

  /**
   * 📊 分析任务复杂度
   */
  async analyzeComplexity(task: Task): Promise<{
    score: number;
    factors: string[];
    suggestions: string[];
  }> {
    // 基于多个因素评估复杂度
    const factors: string[] = [];
    let score = task.estimatedComplexity;

    // 依赖数量
    if (task.dependencies.length > 3) {
      score += 1;
      factors.push(`高依赖数量 (${task.dependencies.length})`);
    }

    // 所需技能
    if (task.requiredSkills.length > 5) {
      score += 1;
      factors.push(`多技能要求 (${task.requiredSkills.length})`);
    }

    // 子任务数量
    if (task.subtasks && task.subtasks.length > 5) {
      score += 1;
      factors.push(`复杂子任务 (${task.subtasks.length})`);
    }

    const suggestions: string[] = [];
    if (score > 4) {
      suggestions.push('建议拆分为多个子任务');
      suggestions.push('考虑分配给专门的代理');
    }

    return {
      score: Math.min(score, 5),
      factors,
      suggestions
    };
  }

  /**
   * 🔍 识别并行机会
   */
  identifyParallelOpportunities(workflow: WorkflowDAG): string[][] {
    const parallelGroups: string[][] = [];
    const taskMap = new Map(workflow.tasks.map(t => [t.id, t]));

    // 使用拓扑排序找到同一层级的任务
    const levels = this.topologicalSort(workflow);

    for (const level of levels) {
      if (level.length > 1) {
        // 检查这些任务是否真的可以并行
        const canParallelize = level.every(taskId => {
          const task = taskMap.get(taskId)!;
          // 检查资源冲突
          return !this.hasResourceConflict(task, level, taskMap);
        });

        if (canParallelize) {
          parallelGroups.push(level);
        }
      }
    }

    return parallelGroups;
  }

  // ============================================
  // 私有方法
  // ============================================

  private buildPrompt(userPrompt: string, context?: PlanningContext): string {
    let projectContext = '';

    if (context) {
      if (context.projectPath) {
        projectContext += `项目路径: ${context.projectPath}\n`;
      }
      if (context.existingFiles?.length) {
        projectContext += `现有文件: ${context.existingFiles.slice(0, 20).join(', ')}\n`;
      }
      if (context.techStack?.length) {
        projectContext += `技术栈: ${context.techStack.join(', ')}\n`;
      }
      if (context.constraints?.length) {
        projectContext += `约束条件: ${context.constraints.join('; ')}\n`;
      }
    }

    return TASK_DECOMPOSITION_PROMPT
      .replace('{{userPrompt}}', userPrompt)
      .replace('{{projectContext}}', projectContext || '无特定上下文');
  }

  private async callClaudeAPI(
    prompt: string,
    useThinking: boolean
  ): Promise<{ content: string; thinking?: string }> {
    const requestBody: any = {
      model: this.config.model,
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    if (useThinking) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: this.config.maxThinkingTokens
      };
    }

    const response = await fetch(`${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    let content = '';
    let thinking = '';

    for (const block of data.content) {
      if (block.type === 'text') {
        content = block.text;
      } else if (block.type === 'thinking') {
        thinking = block.thinking;
      }
    }

    return { content, thinking };
  }

  private parseResponse(response: { content: string; thinking?: string }): any {
    // 提取 JSON
    const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      // 尝试直接解析
      try {
        return JSON.parse(response.content);
      } catch {
        throw new Error('Failed to parse Claude response as JSON');
      }
    }

    return JSON.parse(jsonMatch[1]);
  }

  private parseAdjustmentResponse(response: { content: string }): any {
    return this.parseResponse(response);
  }

  private buildWorkflowDAG(parsedResult: any, originalPrompt: string): WorkflowDAG {
    const workflowId = uuidv4();
    const now = Date.now();

    // 构建任务列表
    const tasks: Task[] = parsedResult.tasks.map((t: any, index: number) => ({
      id: t.id || `task-${index + 1}`,
      description: t.description,
      type: t.type as TaskType,
      priority: (t.priority || 'medium') as TaskPriority,
      dependencies: t.dependencies || [],
      dependents: [], // 后续计算
      estimatedComplexity: t.estimatedComplexity || 3,
      requiredSkills: t.requiredSkills || [],
      requiredTools: t.requiredTools || [],
      status: 'pending',
      progress: 0,
      metrics: {
        retryCount: 0
      },
      subtasks: t.subtasks?.map((st: any, stIndex: number) => ({
        id: `${t.id}-sub-${stIndex + 1}`,
        description: st.description,
        type: 'sequential' as TaskType,
        priority: t.priority as TaskPriority,
        dependencies: [],
        dependents: [],
        estimatedComplexity: 2,
        requiredSkills: [],
        requiredTools: [],
        status: 'pending',
        progress: 0,
        metrics: { retryCount: 0 },
        metadata: {}
      })),
      metadata: {
        acceptanceCriteria: t.acceptanceCriteria,
        suggestedAgentType: t.suggestedAgentType
      }
    }));

    // 计算 dependents
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          depTask.dependents.push(task.id);
        }
      }
    }

    // 构建边
    const edges: WorkflowEdge[] = [];
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        edges.push({
          id: `${depId}->${task.id}`,
          from: depId,
          to: task.id,
          type: 'dependency'
        });
      }
    }

    // 找到入口和出口
    const entryPoints = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);
    const exitPoints = tasks.filter(t => t.dependents.length === 0).map(t => t.id);

    // 构建元数据
    const metadata: WorkflowMetadata = {
      id: workflowId,
      name: parsedResult.analysis?.summary?.slice(0, 50) || 'Untitled Workflow',
      description: originalPrompt,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      createdBy: 'TaskPlanner',
      tags: parsedResult.analysis?.techStack || [],
      estimatedTotalTime: parsedResult.analysis?.estimatedHours * 60 || 60,
      parallelismLevel: Math.max(...(parsedResult.parallelGroups?.map((g: string[]) => g.length) || [1])),
      criticalPath: parsedResult.criticalPath || [],
      complexity: parsedResult.analysis?.complexity || 'moderate'
    };

    return {
      metadata,
      tasks,
      edges,
      parallelGroups: parsedResult.parallelGroups || [],
      entryPoints,
      exitPoints
    };
  }

  private validateDAG(workflow: WorkflowDAG): void {
    // 检查循环依赖
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (!visited.has(taskId)) {
        visited.add(taskId);
        recStack.add(taskId);

        const task = workflow.tasks.find(t => t.id === taskId);
        if (task) {
          for (const depId of task.dependents) {
            if (!visited.has(depId) && hasCycle(depId)) {
              return true;
            } else if (recStack.has(depId)) {
              return true;
            }
          }
        }
      }
      recStack.delete(taskId);
      return false;
    };

    for (const task of workflow.tasks) {
      if (hasCycle(task.id)) {
        throw new Error(`Circular dependency detected involving task: ${task.id}`);
      }
    }

    // 检查孤立任务
    const connectedTasks = new Set<string>();
    for (const task of workflow.tasks) {
      connectedTasks.add(task.id);
      task.dependencies.forEach(d => connectedTasks.add(d));
      task.dependents.forEach(d => connectedTasks.add(d));
    }

    // 检查依赖是否存在
    for (const task of workflow.tasks) {
      for (const depId of task.dependencies) {
        if (!workflow.tasks.find(t => t.id === depId)) {
          throw new Error(`Task ${task.id} depends on non-existent task: ${depId}`);
        }
      }
    }
  }

  private calculateCriticalPath(workflow: WorkflowDAG): void {
    // 使用最长路径算法计算关键路径
    const taskMap = new Map(workflow.tasks.map(t => [t.id, t]));
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();

    // 初始化
    for (const task of workflow.tasks) {
      distances.set(task.id, task.dependencies.length === 0 ? task.estimatedComplexity : -Infinity);
    }

    // 拓扑排序后计算最长路径
    const sortedTasks = this.topologicalSortFlat(workflow);

    for (const taskId of sortedTasks) {
      const task = taskMap.get(taskId)!;
      const currentDist = distances.get(taskId)!;

      for (const depId of task.dependents) {
        const depTask = taskMap.get(depId)!;
        const newDist = currentDist + depTask.estimatedComplexity;

        if (newDist > (distances.get(depId) || -Infinity)) {
          distances.set(depId, newDist);
          predecessors.set(depId, taskId);
        }
      }
    }

    // 找到最长路径的终点
    let maxDist = -Infinity;
    let endTask = '';
    for (const [taskId, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist;
        endTask = taskId;
      }
    }

    // 回溯构建关键路径
    const criticalPath: string[] = [];
    let current = endTask;
    while (current) {
      criticalPath.unshift(current);
      current = predecessors.get(current) || '';
    }

    workflow.metadata.criticalPath = criticalPath;
  }

  private topologicalSort(workflow: WorkflowDAG): string[][] {
    const levels: string[][] = [];
    const inDegree = new Map<string, number>();
    const taskMap = new Map(workflow.tasks.map(t => [t.id, t]));

    // 计算入度
    for (const task of workflow.tasks) {
      inDegree.set(task.id, task.dependencies.length);
    }

    // BFS 分层
    let currentLevel = workflow.tasks
      .filter(t => t.dependencies.length === 0)
      .map(t => t.id);

    while (currentLevel.length > 0) {
      levels.push(currentLevel);

      const nextLevel: string[] = [];
      for (const taskId of currentLevel) {
        const task = taskMap.get(taskId)!;
        for (const depId of task.dependents) {
          const newDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            nextLevel.push(depId);
          }
        }
      }
      currentLevel = nextLevel;
    }

    return levels;
  }

  private topologicalSortFlat(workflow: WorkflowDAG): string[] {
    return this.topologicalSort(workflow).flat();
  }

  private hasResourceConflict(
    task: Task,
    otherTaskIds: string[],
    taskMap: Map<string, Task>
  ): boolean {
    // 检查是否有资源冲突（如修改同一文件）
    // 这里简化实现，实际应该更复杂
    for (const otherId of otherTaskIds) {
      if (otherId === task.id) continue;
      const otherTask = taskMap.get(otherId);
      if (!otherTask) continue;

      // 检查技能冲突（例如都需要数据库操作）
      const sharedSkills = task.requiredSkills.filter(
        s => otherTask.requiredSkills.includes(s)
      );
      if (sharedSkills.includes('database-migration')) {
        return true; // 数据库迁移不能并行
      }
    }

    return false;
  }

  private applyAdjustments(
    workflow: WorkflowDAG,
    adjustments: any
  ): WorkflowDAG {
    // 应用调整
    const updatedWorkflow = { ...workflow };

    // 更新任务
    if (adjustments.updatedTasks) {
      for (const update of adjustments.updatedTasks) {
        const taskIndex = updatedWorkflow.tasks.findIndex(t => t.id === update.id);
        if (taskIndex >= 0) {
          updatedWorkflow.tasks[taskIndex] = {
            ...updatedWorkflow.tasks[taskIndex],
            ...update
          };
        }
      }
    }

    // 移除任务
    if (adjustments.removedTasks) {
      updatedWorkflow.tasks = updatedWorkflow.tasks.filter(
        t => !adjustments.removedTasks.includes(t.id)
      );
      updatedWorkflow.edges = updatedWorkflow.edges.filter(
        e => !adjustments.removedTasks.includes(e.from) &&
             !adjustments.removedTasks.includes(e.to)
      );
    }

    // 添加新任务
    if (adjustments.newTasks) {
      updatedWorkflow.tasks.push(...adjustments.newTasks);
    }

    // 更新元数据
    updatedWorkflow.metadata.updatedAt = Date.now();

    return updatedWorkflow;
  }
}

// 导出默认配置
export const DEFAULT_PLANNER_CONFIG: TaskPlannerConfig = {
  model: 'claude-opus-4-5-20251101',
  apiKey: '',
  maxThinkingTokens: 10000,
  temperature: 0.7
};
