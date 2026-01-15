/**
 * API Extended Types - 扩展 API 类型定义
 * 
 * 🏗️ 代码质量优化 (v2.7.6):
 * - 替代 api.ts 中的 any 类型
 * - 提供更精确的类型定义
 * 
 * _Requirements: 4.3 (消除 any 类型)_
 */

// =============================================================================
// Hook 相关类型
// =============================================================================

/**
 * Hook 事件上下文
 */
export interface HookEventContext {
    /** 事件类型 */
    eventType: string;
    /** 触发时间戳 */
    timestamp: number;
    /** 会话 ID */
    sessionId?: string;
    /** 项目路径 */
    projectPath?: string;
    /** 消息内容 */
    message?: string;
    /** 文件路径 */
    filePath?: string;
    /** 额外数据 */
    metadata?: Record<string, unknown>;
}

/**
 * Hook 执行结果
 */
export interface HookExecutionResult {
    /** 是否成功 */
    success: boolean;
    /** 执行的 Hook 数量 */
    executedCount: number;
    /** 错误信息 */
    errors?: string[];
    /** 执行结果 */
    results?: Array<{
        hookId: string;
        success: boolean;
        output?: string;
        error?: string;
    }>;
}

// =============================================================================
// 后台任务相关类型
// =============================================================================

/**
 * 后台任务类型
 */
export type BackgroundTaskType =
    | 'file_indexing'
    | 'code_analysis'
    | 'translation'
    | 'compression'
    | 'backup'
    | 'sync'
    | 'custom';

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 任务进度
 */
export interface TaskProgress {
    /** 当前进度 (0-100) */
    percentage: number;
    /** 当前步骤描述 */
    currentStep?: string;
    /** 已处理项数 */
    processedItems?: number;
    /** 总项数 */
    totalItems?: number;
    /** 预计剩余时间（秒） */
    estimatedTimeRemaining?: number;
}

/**
 * 任务结果
 */
export interface TaskResult {
    /** 是否成功 */
    success: boolean;
    /** 结果数据 */
    data?: unknown;
    /** 错误信息 */
    error?: string;
    /** 执行时间（毫秒） */
    duration?: number;
}

// =============================================================================
// 并行任务相关类型
// =============================================================================

/**
 * Agent 类型
 */
export type AgentType =
    | 'code_analyzer'
    | 'file_processor'
    | 'translator'
    | 'summarizer'
    | 'validator'
    | 'custom';

/**
 * Agent 消息类型
 */
export type AgentMessageType =
    | 'task_assignment'
    | 'progress_update'
    | 'result'
    | 'error'
    | 'coordination'
    | 'heartbeat';

/**
 * Agent 消息负载
 */
export interface AgentMessagePayload {
    /** 消息类型 */
    type: AgentMessageType;
    /** 任务 ID */
    taskId?: string;
    /** 进度信息 */
    progress?: TaskProgress;
    /** 结果数据 */
    result?: TaskResult;
    /** 错误信息 */
    error?: string;
    /** 额外数据 */
    metadata?: Record<string, unknown>;
}

// =============================================================================
// 导出所有类型
// =============================================================================

export type {
    HookEventContext as HookContext,
    HookExecutionResult as HookResult,
};
