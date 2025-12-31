/**
 * useSubagentExecution - 子代理执行追踪 Hook
 *
 * 功能:
 * - 追踪子代理执行状态
 * - 实时进度更新
 * - 执行历史记录
 * - 错误处理和重试
 *
 * 来源: Claude Code Subagent Execution + Cursor Agent Runtime
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================
// 类型定义
// ============================================================

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubagentExecution {
  id: string;
  subagentName: string;
  prompt: string;
  status: ExecutionStatus;
  progress: number;
  currentStep?: string;
  result?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ExecutionEvent {
  executionId: string;
  type: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  data?: any;
  timestamp: string;
}

// ============================================================
// Hook
// ============================================================

interface UseSubagentExecutionOptions {
  /** 会话ID（可选，用于过滤） */
  sessionId?: string;
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 是否自动清理已完成的执行 */
  autoCleanup?: boolean;
  /** 清理延迟（毫秒） */
  cleanupDelay?: number;
}

export function useSubagentExecution(options: UseSubagentExecutionOptions = {}) {
  const {
    // sessionId 和 pollingInterval 保留用于未来扩展
    autoCleanup = true,
    cleanupDelay = 30000, // 30秒
  } = options;

  const [executions, setExecutions] = useState<Map<string, SubagentExecution>>(new Map());
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const eventListenersRef = useRef<Map<string, Set<(event: ExecutionEvent) => void>>>(new Map());
  const cleanupTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * 开始执行子代理
   */
  const startExecution = useCallback(
    (subagentName: string, prompt: string, metadata?: Record<string, any>): string => {
      const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const execution: SubagentExecution = {
        id,
        subagentName,
        prompt,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
        metadata,
      };

      setExecutions((prev) => new Map(prev).set(id, execution));

      // 发送启动事件
      const event: ExecutionEvent = {
        executionId: id,
        type: 'start',
        data: { subagentName, prompt },
        timestamp: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, event]);
      emitEvent(id, event);

      // 模拟开始执行
      setTimeout(() => {
        updateExecution(id, {
          status: 'running',
          progress: 10,
          currentStep: '初始化...',
        });
      }, 100);

      return id;
    },
    []
  );

  /**
   * 更新执行状态
   */
  const updateExecution = useCallback(
    (executionId: string, updates: Partial<SubagentExecution>) => {
      setExecutions((prev) => {
        const execution = prev.get(executionId);
        if (!execution) return prev;

        const updated = { ...execution, ...updates };
        const newMap = new Map(prev);
        newMap.set(executionId, updated);

        // 发送进度事件
        if (updates.progress !== undefined || updates.currentStep) {
          const event: ExecutionEvent = {
            executionId,
            type: 'progress',
            data: {
              progress: updates.progress,
              currentStep: updates.currentStep,
            },
            timestamp: new Date().toISOString(),
          };
          setEvents((prev) => [...prev, event]);
          emitEvent(executionId, event);
        }

        return newMap;
      });
    },
    []
  );

  /**
   * 完成执行
   */
  const completeExecution = useCallback(
    (executionId: string, result: any) => {
      setExecutions((prev) => {
        const execution = prev.get(executionId);
        if (!execution) return prev;

        const completedAt = new Date().toISOString();
        const duration = Date.now() - new Date(execution.startedAt).getTime();

        const updated: SubagentExecution = {
          ...execution,
          status: 'completed',
          progress: 100,
          result,
          completedAt,
          duration,
        };

        const newMap = new Map(prev);
        newMap.set(executionId, updated);

        // 发送完成事件
        const event: ExecutionEvent = {
          executionId,
          type: 'complete',
          data: { result, duration },
          timestamp: completedAt,
        };
        setEvents((prev) => [...prev, event]);
        emitEvent(executionId, event);

        // 设置自动清理
        if (autoCleanup) {
          const timer = setTimeout(() => {
            setExecutions((prev) => {
              const newMap = new Map(prev);
              newMap.delete(executionId);
              return newMap;
            });
            cleanupTimersRef.current.delete(executionId);
          }, cleanupDelay);

          cleanupTimersRef.current.set(executionId, timer);
        }

        return newMap;
      });
    },
    [autoCleanup, cleanupDelay]
  );

  /**
   * 执行失败
   */
  const failExecution = useCallback(
    (executionId: string, error: string) => {
      setExecutions((prev) => {
        const execution = prev.get(executionId);
        if (!execution) return prev;

        const completedAt = new Date().toISOString();
        const duration = Date.now() - new Date(execution.startedAt).getTime();

        const updated: SubagentExecution = {
          ...execution,
          status: 'failed',
          error,
          completedAt,
          duration,
        };

        const newMap = new Map(prev);
        newMap.set(executionId, updated);

        // 发送错误事件
        const event: ExecutionEvent = {
          executionId,
          type: 'error',
          data: { error, duration },
          timestamp: completedAt,
        };
        setEvents((prev) => [...prev, event]);
        emitEvent(executionId, event);

        return newMap;
      });
    },
    []
  );

  /**
   * 取消执行
   */
  const cancelExecution = useCallback((executionId: string) => {
    setExecutions((prev) => {
      const execution = prev.get(executionId);
      if (!execution) return prev;

      const updated: SubagentExecution = {
        ...execution,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      };

      const newMap = new Map(prev);
      newMap.set(executionId, updated);

      // 发送取消事件
      const event: ExecutionEvent = {
        executionId,
        type: 'cancel',
        timestamp: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, event]);
      emitEvent(executionId, event);

      return newMap;
    });
  }, []);

  /**
   * 重试执行
   */
  const retryExecution = useCallback(
    (executionId: string): string | null => {
      const execution = executions.get(executionId);
      if (!execution || execution.status !== 'failed') return null;

      return startExecution(execution.subagentName, execution.prompt, execution.metadata);
    },
    [executions, startExecution]
  );

  /**
   * 获取执行详情
   */
  const getExecution = useCallback(
    (executionId: string): SubagentExecution | undefined => {
      return executions.get(executionId);
    },
    [executions]
  );

  /**
   * 获取所有执行
   */
  const getAllExecutions = useCallback(
    (filter?: { status?: ExecutionStatus; subagentName?: string }): SubagentExecution[] => {
      let result = Array.from(executions.values());

      if (filter?.status) {
        result = result.filter((e) => e.status === filter.status);
      }

      if (filter?.subagentName) {
        result = result.filter((e) => e.subagentName === filter.subagentName);
      }

      return result.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    },
    [executions]
  );

  /**
   * 获取活跃执行
   */
  const getActiveExecutions = useCallback((): SubagentExecution[] => {
    return getAllExecutions({ status: 'running' });
  }, [getAllExecutions]);

  /**
   * 监听执行事件
   */
  const addEventListener = useCallback(
    (executionId: string, listener: (event: ExecutionEvent) => void) => {
      if (!eventListenersRef.current.has(executionId)) {
        eventListenersRef.current.set(executionId, new Set());
      }
      eventListenersRef.current.get(executionId)!.add(listener);

      // 返回清理函数
      return () => {
        eventListenersRef.current.get(executionId)?.delete(listener);
      };
    },
    []
  );

  /**
   * 触发事件
   */
  const emitEvent = useCallback((executionId: string, event: ExecutionEvent) => {
    const listeners = eventListenersRef.current.get(executionId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }

    // 全局监听器
    const globalListeners = eventListenersRef.current.get('*');
    if (globalListeners) {
      globalListeners.forEach((listener) => listener(event));
    }
  }, []);

  /**
   * 清理已完成的执行
   */
  const cleanup = useCallback(() => {
    setExecutions((prev) => {
      const newMap = new Map(prev);
      const now = Date.now();

      for (const [id, execution] of newMap.entries()) {
        if (
          execution.status === 'completed' ||
          execution.status === 'failed' ||
          execution.status === 'cancelled'
        ) {
          const completedTime = execution.completedAt
            ? new Date(execution.completedAt).getTime()
            : now;
          if (now - completedTime > cleanupDelay) {
            newMap.delete(id);
          }
        }
      }

      return newMap;
    });
  }, [cleanupDelay]);

  /**
   * 获取统计信息
   */
  const getStats = useCallback(() => {
    const all = Array.from(executions.values());
    return {
      total: all.length,
      running: all.filter((e) => e.status === 'running').length,
      completed: all.filter((e) => e.status === 'completed').length,
      failed: all.filter((e) => e.status === 'failed').length,
      cancelled: all.filter((e) => e.status === 'cancelled').length,
    };
  }, [executions]);

  // 清理定时器
  useEffect(() => {
    return () => {
      cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      cleanupTimersRef.current.clear();
    };
  }, []);

  return {
    // 状态
    executions: Array.from(executions.values()),
    events,

    // 控制方法
    startExecution,
    updateExecution,
    completeExecution,
    failExecution,
    cancelExecution,
    retryExecution,

    // 查询方法
    getExecution,
    getAllExecutions,
    getActiveExecutions,
    getStats,

    // 事件监听
    addEventListener,

    // 清理
    cleanup,
  };
}

export default useSubagentExecution;
