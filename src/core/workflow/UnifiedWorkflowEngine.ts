/**
 * UnifiedWorkflowEngine - 统一工作流引擎
 *
 * 合并了两套实现的优势：
 * - WorkflowManagerPanel (Spec 驱动) - SpecGenerationEngine 规范生成
 * - useWorkflowOrchestrator (Devin 风格) - TaskPlanner DAG 分解、AgentSwarmManager 并行执行
 *
 * 核心功能：
 * 1. 需求解析和规范生成
 * 2. 智能任务分解（DAG）
 * 3. 多代理并行执行
 * 4. 暂停/恢复/重试/取消控制
 * 5. 事件驱动架构
 */

import { logger } from '@/lib/logger';
import { BrowserEventEmitter } from '../../lib/BrowserEventEmitter';
import { v4 as uuidv4 } from 'uuid';
import type {
    Task,
    WorkflowDAG,
    WorkflowConfig,
    WorkflowEvent,
    WorkflowEventType,
    WorkflowLog,
    Agent,
    WorkflowMetadata,
    WorkflowEdge,
} from '../types/workflow';
import { DEFAULT_WORKFLOW_CONFIG } from '../types/workflow';
import { AgentSwarmManager } from '../agents/AgentSwarmManager';
import { TaskPlanner, type PlanningContext, type TaskPlannerConfig } from '../planning/TaskPlanner';
import { SpecGenerationEngine, type TechnicalSpec } from '../spec/SpecGenerationEngine';
import { RealAPIClient } from '../api/RealAPIClient';

// ============================================
// 类型定义
// ============================================

export type WorkflowState = 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface UnifiedWorkflowConfig {
    // API 配置
    api: {
        key: string;
        baseUrl: string;
        model: string;
    };
    // 代理配置
    agents: {
        maxAgents: number;
        maxConcurrentTasks: number;
    };
    // 执行配置
    execution: {
        taskTimeout: number;
        maxRetries: number;
        retryDelay: number;
    };
    // 模式配置
    mode: 'simple' | 'advanced';
}

export interface WorkflowProgress {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    currentTask: Task | null;
    percentage: number;
}

export interface GenerateOptions {
    mode?: 'simple' | 'advanced';
    projectPath?: string;
    techStack?: string[];
    constraints?: string[];
}

// ============================================
// UnifiedWorkflowEngine 类
// ============================================

export class UnifiedWorkflowEngine extends BrowserEventEmitter {
    private config: UnifiedWorkflowConfig;
    private workflowConfig: WorkflowConfig;
    private state: WorkflowState = 'idle';
    private workflow: WorkflowDAG | null = null;
    private logs: WorkflowLog[] = [];
    private error: string | null = null;

    // 核心组件
    private taskPlanner: TaskPlanner | null = null;
    private agentSwarmManager: AgentSwarmManager | null = null;
    private specEngine: SpecGenerationEngine | null = null;
    private apiClient: RealAPIClient | null = null;

    // 执行状态
    private completedTaskIds: Set<string> = new Set();
    private failedTaskIds: Set<string> = new Set();
    private inProgressTaskIds: Set<string> = new Set();
    private taskQueue: Task[] = [];

    constructor(config?: Partial<UnifiedWorkflowConfig>) {
        super();

        // 默认配置
        this.config = {
            api: {
                key: '',
                baseUrl: 'https://hiapi.online/v1',
                model: 'claude-sonnet-4-20250514',
            },
            agents: {
                maxAgents: 10,
                maxConcurrentTasks: 5,
            },
            execution: {
                taskTimeout: 300000, // 5 分钟
                maxRetries: 3,
                retryDelay: 1000,
            },
            mode: 'advanced',
            ...config,
        };

        // 转换为 WorkflowConfig
        this.workflowConfig = {
            ...DEFAULT_WORKFLOW_CONFIG,
            maxAgents: this.config.agents.maxAgents,
            maxConcurrentTasks: this.config.agents.maxConcurrentTasks,
            taskTimeout: this.config.execution.taskTimeout,
            retryPolicy: {
                maxRetries: this.config.execution.maxRetries,
                backoffMultiplier: 2,
                initialDelay: this.config.execution.retryDelay,
            },
        };
    }

    // ============================================
    // 生命周期方法
    // ============================================

    /**
     * 初始化引擎
     */
    async initialize(): Promise<void> {
        this.addLog('info', '初始化统一工作流引擎...');

        // 从 localStorage 读取 API 配置
        const apiKey = this.config.api.key || localStorage.getItem('claude_api_key') || '';
        const baseUrl = this.config.api.baseUrl || localStorage.getItem('claude_api_base_url') || 'https://hiapi.online/v1';

        if (!apiKey) {
            const error = 'API Key 未配置。请在设置中配置 API Key。';
            this.addLog('error', error);
            throw new Error(error);
        }

        // 初始化 TaskPlanner
        const plannerConfig: TaskPlannerConfig = {
            model: this.config.api.model,
            apiKey,
            baseUrl,
            maxThinkingTokens: 10000,
            temperature: 0.7,
        };
        this.taskPlanner = new TaskPlanner(plannerConfig);

        // 初始化 RealAPIClient 和 SpecGenerationEngine（简单模式）
        this.apiClient = new RealAPIClient({
            apiKey,
            baseUrl,
        });
        this.specEngine = new SpecGenerationEngine(this.apiClient, this.config.api.model);

        // 初始化 AgentSwarmManager
        this.agentSwarmManager = new AgentSwarmManager(this.workflowConfig);

        // 监听 AgentSwarmManager 事件
        this.setupAgentSwarmEvents();

        this.addLog('info', '统一工作流引擎初始化完成');
        this.emitEvent('workflow:created', { engine: this });
    }

    /**
     * 销毁引擎
     */
    async destroy(): Promise<void> {
        this.addLog('info', '销毁统一工作流引擎...');

        // 如果正在执行，先取消
        if (this.state === 'executing' || this.state === 'paused') {
            await this.cancelExecution();
        }

        // 清理资源
        if (this.agentSwarmManager) {
            this.agentSwarmManager.removeAllListeners();
        }

        this.taskPlanner = null;
        this.agentSwarmManager = null;
        this.workflow = null;
        this.logs = [];
        this.state = 'idle';

        this.removeAllListeners();
        this.addLog('info', '统一工作流引擎已销毁');
    }

    // ============================================
    // 工作流生成
    // ============================================

    /**
     * 生成工作流
     */
    async generateWorkflow(requirement: string, options?: GenerateOptions): Promise<WorkflowDAG> {
        if (!this.taskPlanner) {
            await this.initialize();
        }

        const mode = options?.mode || this.config.mode;
        this.setState('planning');
        this.addLog('info', `开始分析需求 (${mode} 模式): ${requirement.slice(0, 100)}...`);

        try {
            if (mode === 'simple' && this.specEngine) {
                // 简单模式：使用 SpecGenerationEngine
                this.workflow = await this.generateWorkflowFromSpec(requirement, options);
            } else {
                // 高级模式：使用 TaskPlanner
                const context: PlanningContext = {
                    projectPath: options?.projectPath,
                    techStack: options?.techStack || ['react', 'typescript'],
                    constraints: options?.constraints,
                };

                const result = await this.taskPlanner!.generateWorkflowDAG(requirement, context);
                this.workflow = result.workflow;

                if (result.thinkingProcess) {
                    this.addLog('debug', `AI 思考过程: ${result.thinkingProcess.slice(0, 500)}...`);
                }
            }

            this.resetExecutionState();

            this.addLog('info', `工作流生成完成: ${this.workflow.tasks.length} 个任务`);
            this.addLog('info', `并行组: ${this.workflow.parallelGroups.length} 个`);
            this.addLog('info', `关键路径: ${this.workflow.metadata.criticalPath.join(' → ')}`);

            this.setState('idle');
            this.emitEvent('workflow:created', { workflow: this.workflow });

            return this.workflow;
        } catch (error: any) {
            this.error = error.message;
            this.addLog('error', `工作流生成失败: ${error.message}`);
            this.setState('failed');
            throw error;
        }
    }

    /**
     * 从 TechnicalSpec 生成 WorkflowDAG（简单模式）
     */
    private async generateWorkflowFromSpec(requirement: string, _options?: GenerateOptions): Promise<WorkflowDAG> {
        // 生成技术规范
        const spec = await this.specEngine!.generateSpec(requirement, 'feature', {
            includeArchitecture: true,
            includeAPI: true,
            includeTesting: true,
            includeDeployment: false,
            detailLevel: 'standard',
        });

        // 将 TechnicalSpec 转换为 WorkflowDAG
        return this.convertSpecToDAG(spec, requirement);
    }

    /**
     * 将 TechnicalSpec 转换为 WorkflowDAG
     */
    private convertSpecToDAG(spec: TechnicalSpec, originalRequirement: string): WorkflowDAG {
        const workflowId = uuidv4();
        const now = Date.now();
        const tasks: Task[] = [];
        const edges: WorkflowEdge[] = [];

        // 从实现阶段创建任务
        let taskIndex = 0;
        for (const phase of spec.implementation.phases) {
            for (const taskSpec of phase.tasks) {
                const taskId = taskSpec.id || `task-${++taskIndex}`;
                const task: Task = {
                    id: taskId,
                    description: `${taskSpec.title}: ${taskSpec.description}`,
                    type: 'sequential',
                    priority: 'medium',
                    dependencies: taskSpec.dependencies || [],
                    dependents: [],
                    estimatedComplexity: Math.min(5, Math.max(1, Math.ceil((taskSpec.estimatedHours || 2) / 2))) as 1 | 2 | 3 | 4 | 5,
                    requiredSkills: [],
                    requiredTools: [],
                    status: 'pending',
                    progress: 0,
                    metrics: { retryCount: 0 },
                    metadata: {
                        phase: phase.phase,
                        phaseName: phase.name,
                        suggestedAgentType: taskSpec.assignedTo || 'general',
                    },
                };
                tasks.push(task);
            }
        }

        // 计算 dependents
        for (const task of tasks) {
            for (const depId of task.dependencies) {
                const depTask = tasks.find(t => t.id === depId);
                if (depTask) {
                    depTask.dependents.push(task.id);
                    edges.push({
                        id: `${depId}->${task.id}`,
                        from: depId,
                        to: task.id,
                        type: 'dependency',
                    });
                }
            }
        }

        // 找到入口和出口
        const entryPoints = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);
        const exitPoints = tasks.filter(t => t.dependents.length === 0).map(t => t.id);

        // 识别并行组
        const parallelGroups = this.identifyParallelGroups(tasks);

        // 构建元数据
        const metadata: WorkflowMetadata = {
            id: workflowId,
            name: spec.metadata.title,
            description: originalRequirement,
            version: '1.0.0',
            createdAt: now,
            updatedAt: now,
            createdBy: 'SpecGenerationEngine',
            tags: [],
            estimatedTotalTime: tasks.reduce((sum, t) => sum + t.estimatedComplexity * 10, 0),
            parallelismLevel: Math.max(...parallelGroups.map(g => g.length), 1),
            criticalPath: this.calculateCriticalPathFromTasks(tasks, entryPoints, exitPoints),
            complexity: this.determineComplexity(tasks.length),
        };

        return {
            metadata,
            tasks,
            edges,
            parallelGroups,
            entryPoints,
            exitPoints,
        };
    }

    /**
     * 识别并行组
     */
    private identifyParallelGroups(tasks: Task[]): string[][] {
        const groups: string[][] = [];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const inDegree = new Map<string, number>();

        // 计算入度
        for (const task of tasks) {
            inDegree.set(task.id, task.dependencies.length);
        }

        // BFS 分层
        let currentLevel = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);

        while (currentLevel.length > 0) {
            if (currentLevel.length > 1) {
                groups.push(currentLevel);
            }

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

        return groups;
    }

    /**
     * 计算关键路径
     */
    private calculateCriticalPathFromTasks(tasks: Task[], _entryPoints: string[], _exitPoints: string[]): string[] {
        if (tasks.length === 0) return [];
        if (tasks.length === 1) return [tasks[0].id];

        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const distances = new Map<string, number>();
        const predecessors = new Map<string, string>();

        // 初始化
        for (const task of tasks) {
            distances.set(task.id, task.dependencies.length === 0 ? task.estimatedComplexity : -Infinity);
        }

        // 拓扑排序
        const sorted = this.topologicalSort(tasks);

        // 计算最长路径
        for (const taskId of sorted) {
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

        return criticalPath;
    }

    /**
     * 拓扑排序
     */
    private topologicalSort(tasks: Task[]): string[] {
        const result: string[] = [];
        const inDegree = new Map<string, number>();
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        for (const task of tasks) {
            inDegree.set(task.id, task.dependencies.length);
        }

        const queue = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);

        while (queue.length > 0) {
            const taskId = queue.shift()!;
            result.push(taskId);

            const task = taskMap.get(taskId)!;
            for (const depId of task.dependents) {
                const newDegree = (inDegree.get(depId) || 0) - 1;
                inDegree.set(depId, newDegree);
                if (newDegree === 0) {
                    queue.push(depId);
                }
            }
        }

        return result;
    }

    /**
     * 确定复杂度
     */
    private determineComplexity(taskCount: number): 'simple' | 'moderate' | 'complex' | 'extreme' {
        if (taskCount <= 3) return 'simple';
        if (taskCount <= 8) return 'moderate';
        if (taskCount <= 15) return 'complex';
        return 'extreme';
    }

    // ============================================
    // 工作流执行控制
    // ============================================

    /**
     * 开始执行
     */
    async startExecution(): Promise<void> {
        if (!this.workflow) {
            throw new Error('没有可执行的工作流。请先生成工作流。');
        }

        if (!this.agentSwarmManager) {
            await this.initialize();
        }

        this.setState('executing');
        this.error = null;
        this.addLog('info', '开始执行工作流...');

        try {
            // 初始化任务队列
            this.taskQueue = [...this.workflow.tasks.filter(t => t.status === 'pending')];

            // 部署代理群并执行
            await this.agentSwarmManager!.deployAndExecute(this.workflow);
        } catch (error: any) {
            this.error = error.message;
            this.addLog('error', `执行失败: ${error.message}`);
            this.setState('failed');
            this.emitEvent('workflow:failed', { error: error.message });
            throw error;
        }
    }

    /**
     * 暂停执行
     */
    pauseExecution(): void {
        if (this.state !== 'executing') {
            this.addLog('warn', '工作流未在执行中，无法暂停');
            return;
        }

        this.agentSwarmManager?.pauseWorkflow();
        this.setState('paused');
        this.addLog('info', '工作流已暂停');
        this.emitEvent('workflow:paused', { workflow: this.workflow });
    }

    /**
     * 恢复执行
     */
    async resumeExecution(): Promise<void> {
        if (this.state !== 'paused') {
            this.addLog('warn', '工作流未暂停，无法恢复');
            return;
        }

        this.setState('executing');
        this.addLog('info', '工作流已恢复');
        this.emitEvent('workflow:resumed', { workflow: this.workflow });

        await this.agentSwarmManager?.resumeWorkflow();
    }

    /**
     * 取消执行
     */
    async cancelExecution(): Promise<void> {
        if (this.state !== 'executing' && this.state !== 'paused') {
            this.addLog('warn', '工作流未在执行中，无法取消');
            return;
        }

        // 停止所有正在执行的任务
        for (const taskId of this.inProgressTaskIds) {
            await this.agentSwarmManager?.cancelTask(taskId);
        }

        this.agentSwarmManager?.pauseWorkflow();
        this.setState('cancelled');
        this.addLog('info', '工作流已取消');
        this.emitEvent('workflow:cancelled', { workflow: this.workflow });
    }

    /**
     * 重试失败的任务
     */
    async retryTask(taskId: string): Promise<void> {
        if (!this.workflow) {
            throw new Error('没有工作流');
        }

        const task = this.workflow.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`任务不存在: ${taskId}`);
        }

        if (task.status !== 'failed') {
            this.addLog('warn', `任务 ${taskId} 未失败，无需重试`);
            return;
        }

        // 重置任务状态
        task.status = 'pending';
        task.progress = 0;
        task.result = undefined;
        task.metrics.retryCount++;

        // 从失败集合移除
        this.failedTaskIds.delete(taskId);

        // 添加到队列
        this.taskQueue.push(task);

        this.addLog('info', `重试任务: ${task.description} (第 ${task.metrics.retryCount} 次)`);
        this.emitEvent('task:queued', { task });

        // 如果工作流已暂停或完成，重新开始执行
        if (this.state === 'paused' || this.state === 'completed' || this.state === 'failed') {
            await this.resumeExecution();
        }
    }

    // ============================================
    // 状态查询
    // ============================================

    /**
     * 获取当前状态
     */
    getState(): WorkflowState {
        return this.state;
    }

    /**
     * 获取工作流
     */
    getWorkflow(): WorkflowDAG | null {
        return this.workflow;
    }

    /**
     * 获取进度
     */
    getProgress(): WorkflowProgress {
        const totalTasks = this.workflow?.tasks.length || 0;
        const completedTasks = this.completedTaskIds.size;
        const failedTasks = this.failedTaskIds.size;
        const inProgressTasks = this.inProgressTaskIds.size;
        const pendingTasks = totalTasks - completedTasks - failedTasks - inProgressTasks;

        const currentTask = this.workflow?.tasks.find(t =>
            this.inProgressTaskIds.has(t.id)
        ) || null;

        const percentage = totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100)
            : 0;

        return {
            totalTasks,
            completedTasks,
            failedTasks,
            inProgressTasks,
            pendingTasks,
            currentTask,
            percentage,
        };
    }

    /**
     * 获取日志
     */
    getLogs(): WorkflowLog[] {
        return [...this.logs];
    }

    /**
     * 获取错误
     */
    getError(): string | null {
        return this.error;
    }

    /**
     * 获取代理列表
     */
    getAgents(): Agent[] {
        return this.agentSwarmManager?.getAgents() || [];
    }

    /**
     * 获取任务状态
     */
    getTaskStatus(taskId: string): Task | undefined {
        return this.workflow?.tasks.find(t => t.id === taskId);
    }

    /**
     * 获取代理状态
     */
    getAgentStatus(agentId: string): Agent | undefined {
        return this.getAgents().find(a => a.id === agentId);
    }

    // ============================================
    // 私有方法
    // ============================================

    /**
     * 设置状态
     */
    private setState(newState: WorkflowState): void {
        const oldState = this.state;
        this.state = newState;
        this.emitEvent('workflow:stateChanged' as WorkflowEventType, {
            oldState,
            newState,
            workflow: this.workflow
        });
    }

    /**
     * 重置执行状态
     */
    private resetExecutionState(): void {
        this.completedTaskIds.clear();
        this.failedTaskIds.clear();
        this.inProgressTaskIds.clear();
        this.taskQueue = [];
        this.error = null;
    }

    /**
     * 添加日志
     */
    private addLog(
        level: 'info' | 'warn' | 'error' | 'debug',
        message: string,
        taskId?: string,
        agentId?: string
    ): void {
        const log: WorkflowLog = {
            timestamp: Date.now(),
            level,
            message,
            taskId,
            agentId,
        };
        this.logs.push(log);

        // 限制日志数量
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-500);
        }

        // 控制台输出
        const prefix = `[UnifiedWorkflow]`;
        switch (level) {
            case 'error':
                logger.error('UnifiedWorkflowEngine', prefix, message);
                break;
            case 'warn':
                logger.warn('UnifiedWorkflowEngine', prefix, message);
                break;
            case 'debug':
                logger.debug('UnifiedWorkflowEngine', prefix, message);
                break;
            default:
                logger.debug('UnifiedWorkflowEngine', prefix, message);
        }
    }

    /**
     * 发送事件
     */
    private emitEvent(type: WorkflowEventType, data: any): void {
        const event: WorkflowEvent = {
            type,
            timestamp: Date.now(),
            workflowId: this.workflow?.metadata.id,
            data,
        };
        this.emit(type, event);
        this.emit('*', event); // 通配符事件
    }

    /**
     * 设置 AgentSwarmManager 事件监听
     */
    private setupAgentSwarmEvents(): void {
        if (!this.agentSwarmManager) return;

        // 任务事件
        this.agentSwarmManager.on('task:started', (event) => {
            const task = event.task as Task;
            this.inProgressTaskIds.add(task.id);
            this.addLog('info', `任务开始: ${task.description}`, task.id, event.agent?.id);
            this.emitEvent('task:started', event);
        });

        this.agentSwarmManager.on('task:progress', (event) => {
            this.emitEvent('task:progress', event);
        });

        this.agentSwarmManager.on('task:completed', (event) => {
            const task = event.task as Task;
            this.inProgressTaskIds.delete(task.id);
            this.completedTaskIds.add(task.id);
            this.addLog('info', `任务完成: ${task.description}`, task.id, event.agent?.id);
            this.emitEvent('task:completed', event);
        });

        this.agentSwarmManager.on('task:failed', (event) => {
            const task = event.task as Task;
            this.inProgressTaskIds.delete(task.id);
            this.failedTaskIds.add(task.id);
            this.addLog('error', `任务失败: ${task.description} - ${event.error?.message}`, task.id, event.agent?.id);
            this.emitEvent('task:failed', event);
        });

        this.agentSwarmManager.on('task:cancelled', (event) => {
            this.inProgressTaskIds.delete(event.taskId);
            this.addLog('info', `任务取消: ${event.taskId}`);
            this.emitEvent('task:cancelled', event);
        });

        // 代理事件
        this.agentSwarmManager.on('agent:created', (event) => {
            this.addLog('info', `代理创建: ${event.agent.name} (${event.agent.type})`);
            this.emitEvent('agent:created', event);
        });

        this.agentSwarmManager.on('agent:assigned', (event) => {
            this.addLog('info', `代理分配: ${event.agent.name} → ${event.task.description}`);
            this.emitEvent('agent:assigned', event);
        });

        this.agentSwarmManager.on('agent:idle', (event) => {
            this.emitEvent('agent:idle', event);
        });

        this.agentSwarmManager.on('agent:destroyed', (event) => {
            this.addLog('info', `代理销毁: ${event.agent.name}`);
            this.emitEvent('agent:destroyed', event);
        });

        // 工作流事件
        this.agentSwarmManager.on('workflow:started', (event) => {
            this.addLog('info', '工作流执行开始');
            this.emitEvent('workflow:started', event);
        });

        this.agentSwarmManager.on('workflow:completed', (event) => {
            this.setState('completed');
            this.addLog('info', '工作流执行完成！');
            this.emitEvent('workflow:completed', event);
        });

        this.agentSwarmManager.on('workflow:failed', (event) => {
            this.setState('failed');
            this.error = '工作流执行失败';
            this.addLog('error', '工作流执行失败');
            this.emitEvent('workflow:failed', event);
        });
    }
}

// 导出默认配置
export const DEFAULT_UNIFIED_CONFIG: UnifiedWorkflowConfig = {
    api: {
        key: '',
        baseUrl: 'https://hiapi.online/v1',
        model: 'claude-sonnet-4-20250514',
    },
    agents: {
        maxAgents: 10,
        maxConcurrentTasks: 5,
    },
    execution: {
        taskTimeout: 300000,
        maxRetries: 3,
        retryDelay: 1000,
    },
    mode: 'advanced',
};

export default UnifiedWorkflowEngine;
