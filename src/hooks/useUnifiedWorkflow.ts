/**
 * useUnifiedWorkflow - 统一工作流 React Hook
 *
 * 封装 UnifiedWorkflowEngine，提供 React 友好的 API
 *
 * 功能：
 * 1. 状态管理（useState/useRef）
 * 2. 生命周期管理（useEffect cleanup）
 * 3. 事件订阅和状态同步
 * 4. 暴露所有操作方法
 *
 * Feature: unified-workflow-system
 */

import { logger } from '@/lib/logger';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    UnifiedWorkflowEngine,
    type UnifiedWorkflowConfig,
    type WorkflowState,
    type WorkflowProgress,
    type GenerateOptions,
} from '../core/workflow/UnifiedWorkflowEngine';
import type {
    WorkflowDAG,
    WorkflowLog,
    Agent,
    Task,
    WorkflowEvent,
} from '../core/types/workflow';

// ============================================
// 类型定义
// ============================================

export interface UseUnifiedWorkflowOptions {
    /** API 配置 */
    apiKey?: string;
    apiBaseUrl?: string;
    model?: string;
    /** 代理配置 */
    maxAgents?: number;
    maxConcurrentTasks?: number;
    /** 执行配置 */
    taskTimeout?: number;
    maxRetries?: number;
    /** 模式配置 */
    mode?: 'simple' | 'advanced';
    /** 自动初始化 */
    autoInitialize?: boolean;
}

export interface UseUnifiedWorkflowReturn {
    // 状态
    state: WorkflowState;
    workflow: WorkflowDAG | null;
    progress: WorkflowProgress;
    logs: WorkflowLog[];
    error: string | null;
    agents: Agent[];
    isInitialized: boolean;
    isLoading: boolean;

    // 操作方法
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
    generateWorkflow: (requirement: string, options?: GenerateOptions) => Promise<WorkflowDAG>;
    startExecution: () => Promise<void>;
    pauseExecution: () => void;
    resumeExecution: () => Promise<void>;
    cancelExecution: () => Promise<void>;
    retryTask: (taskId: string) => Promise<void>;

    // 查询方法
    getTaskStatus: (taskId: string) => Task | undefined;
    getAgentStatus: (agentId: string) => Agent | undefined;

    // 事件订阅
    subscribe: (eventType: string, handler: (event: WorkflowEvent) => void) => () => void;
}

// ============================================
// Hook 实现
// ============================================

export function useUnifiedWorkflow(
    options: UseUnifiedWorkflowOptions = {}
): UseUnifiedWorkflowReturn {
    const {
        apiKey,
        apiBaseUrl = 'https://hiapi.online/v1',
        model = 'claude-sonnet-4-20250514',
        maxAgents = 10,
        maxConcurrentTasks = 5,
        taskTimeout = 300000,
        maxRetries = 3,
        mode = 'advanced',
        autoInitialize = false,
    } = options;

    // 引擎实例
    const engineRef = useRef<UnifiedWorkflowEngine | null>(null);

    // 状态
    const [state, setState] = useState<WorkflowState>('idle');
    const [workflow, setWorkflow] = useState<WorkflowDAG | null>(null);
    const [progress, setProgress] = useState<WorkflowProgress>({
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        currentTask: null,
        percentage: 0,
    });
    const [logs, setLogs] = useState<WorkflowLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 构建配置
    const config = useMemo<Partial<UnifiedWorkflowConfig>>(() => ({
        api: {
            key: apiKey || localStorage.getItem('claude_api_key') || '',
            baseUrl: apiBaseUrl || localStorage.getItem('claude_api_base_url') || 'https://hiapi.online/v1',
            model,
        },
        agents: {
            maxAgents,
            maxConcurrentTasks,
        },
        execution: {
            taskTimeout,
            maxRetries,
            retryDelay: 1000,
        },
        mode,
    }), [apiKey, apiBaseUrl, model, maxAgents, maxConcurrentTasks, taskTimeout, maxRetries, mode]);

    // 更新状态的辅助函数
    const updateState = useCallback(() => {
        if (!engineRef.current) return;

        setState(engineRef.current.getState());
        setWorkflow(engineRef.current.getWorkflow());
        setProgress(engineRef.current.getProgress());
        setLogs(engineRef.current.getLogs());
        setError(engineRef.current.getError());
        setAgents(engineRef.current.getAgents());
    }, []);

    // 设置事件监听
    const setupEventListeners = useCallback(() => {
        if (!engineRef.current) return;

        const engine = engineRef.current;

        // 监听所有事件并更新状态
        engine.on('*', () => {
            updateState();
        });

        // 特定事件处理
        engine.on('workflow:stateChanged', () => {
            setState(engine.getState());
        });

        engine.on('workflow:created', () => {
            setWorkflow(engine.getWorkflow());
        });

        engine.on('task:progress', () => {
            setProgress(engine.getProgress());
        });

        engine.on('task:completed', () => {
            setProgress(engine.getProgress());
        });

        engine.on('task:failed', () => {
            setProgress(engine.getProgress());
            setError(engine.getError());
        });

        engine.on('agent:created', () => {
            setAgents(engine.getAgents());
        });

        engine.on('agent:destroyed', () => {
            setAgents(engine.getAgents());
        });
    }, [updateState]);

    // 初始化引擎
    const initialize = useCallback(async () => {
        if (engineRef.current) {
            logger.warn('useUnifiedWorkflow', '[useUnifiedWorkflow] Engine already initialized');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            engineRef.current = new UnifiedWorkflowEngine(config);
            await engineRef.current.initialize();
            setupEventListeners();
            setIsInitialized(true);
            updateState();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [config, setupEventListeners, updateState]);

    // 销毁引擎
    const destroy = useCallback(async () => {
        if (!engineRef.current) return;

        setIsLoading(true);

        try {
            await engineRef.current.destroy();
            engineRef.current = null;
            setIsInitialized(false);
            setState('idle');
            setWorkflow(null);
            setProgress({
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                inProgressTasks: 0,
                pendingTasks: 0,
                currentTask: null,
                percentage: 0,
            });
            setLogs([]);
            setError(null);
            setAgents([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 生成工作流
    const generateWorkflow = useCallback(async (
        requirement: string,
        genOptions?: GenerateOptions
    ): Promise<WorkflowDAG> => {
        if (!engineRef.current) {
            await initialize();
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await engineRef.current!.generateWorkflow(requirement, genOptions);
            updateState();
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [initialize, updateState]);

    // 开始执行
    const startExecution = useCallback(async () => {
        if (!engineRef.current) {
            throw new Error('Engine not initialized');
        }

        setIsLoading(true);
        setError(null);

        try {
            await engineRef.current.startExecution();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 暂停执行
    const pauseExecution = useCallback(() => {
        if (!engineRef.current) {
            logger.warn('useUnifiedWorkflow', '[useUnifiedWorkflow] Engine not initialized');
            return;
        }

        engineRef.current.pauseExecution();
        updateState();
    }, [updateState]);

    // 恢复执行
    const resumeExecution = useCallback(async () => {
        if (!engineRef.current) {
            throw new Error('Engine not initialized');
        }

        setIsLoading(true);

        try {
            await engineRef.current.resumeExecution();
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 取消执行
    const cancelExecution = useCallback(async () => {
        if (!engineRef.current) {
            logger.warn('useUnifiedWorkflow', '[useUnifiedWorkflow] Engine not initialized');
            return;
        }

        setIsLoading(true);

        try {
            await engineRef.current.cancelExecution();
            updateState();
        } finally {
            setIsLoading(false);
        }
    }, [updateState]);

    // 重试任务
    const retryTask = useCallback(async (taskId: string) => {
        if (!engineRef.current) {
            throw new Error('Engine not initialized');
        }

        setIsLoading(true);
        setError(null);

        try {
            await engineRef.current.retryTask(taskId);
            updateState();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [updateState]);

    // 获取任务状态
    const getTaskStatus = useCallback((taskId: string): Task | undefined => {
        return engineRef.current?.getTaskStatus(taskId);
    }, []);

    // 获取代理状态
    const getAgentStatus = useCallback((agentId: string): Agent | undefined => {
        return engineRef.current?.getAgentStatus(agentId);
    }, []);

    // 事件订阅
    const subscribe = useCallback((
        eventType: string,
        handler: (event: WorkflowEvent) => void
    ): () => void => {
        if (!engineRef.current) {
            logger.warn('useUnifiedWorkflow', '[useUnifiedWorkflow] Engine not initialized, subscription will be ignored');
            return () => { };
        }

        engineRef.current.on(eventType, handler as (...args: unknown[]) => void);

        // 返回取消订阅函数
        return () => {
            engineRef.current?.off(eventType, handler as (...args: unknown[]) => void);
        };
    }, []);

    // 自动初始化
    useEffect(() => {
        if (autoInitialize && !isInitialized && !isLoading) {
            initialize().catch(console.error);
        }
    }, [autoInitialize, isInitialized, isLoading, initialize]);

    // 清理
    useEffect(() => {
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy().catch(console.error);
                engineRef.current = null;
            }
        };
    }, []);

    return {
        // 状态
        state,
        workflow,
        progress,
        logs,
        error,
        agents,
        isInitialized,
        isLoading,

        // 操作方法
        initialize,
        destroy,
        generateWorkflow,
        startExecution,
        pauseExecution,
        resumeExecution,
        cancelExecution,
        retryTask,

        // 查询方法
        getTaskStatus,
        getAgentStatus,

        // 事件订阅
        subscribe,
    };
}

export default useUnifiedWorkflow;
