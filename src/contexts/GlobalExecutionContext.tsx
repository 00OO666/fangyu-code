/**
 * GlobalExecutionContext - 全局执行状态管理
 *
 * 解决问题：切换Tab时正在执行的命令会丢失
 *
 * 核心功能：
 * - 记录所有Tab的执行状态（isStreaming, sessionId, projectPath）
 * - Tab切换时保存状态，切回时恢复
 * - 支持后台Tab继续执行
 * - 提供全局取消/暂停接口
 *
 * 使用方式：
 * 1. 在 App.tsx 最外层包裹 <GlobalExecutionProvider>
 * 2. 在 usePromptExecution 中注册/更新执行状态
 * 3. 在 useTabs.switchToTab 中恢复状态
 */

import { logger } from '@/lib/logger';
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Tab执行状态
 */
export interface TabExecutionState {
  /** Tab ID */
  tabId: string;
  /** 是否正在执行 */
  isStreaming: boolean;
  /** 会话ID */
  sessionId: string | null;
  /** 项目路径 */
  projectPath: string;
  /** 执行引擎 */
  engine: 'claude' | 'codex' | 'gemini';
  /** 开始时间 */
  startedAt: number;
  /** 最后更新时间 */
  lastUpdateAt: number;
  /** 当前提示词（用于UI显示） */
  currentPrompt?: string;
  /** 已发送的提示词数量 */
  promptCount: number;
}

/**
 * 全局执行上下文值
 */
interface GlobalExecutionContextValue {
  /** 获取所有执行中的Tab */
  getActiveExecutions: () => TabExecutionState[];

  /** 获取指定Tab的执行状态 */
  getTabState: (tabId: string) => TabExecutionState | undefined;

  /** 注册/更新Tab的执行状态 */
  updateTabState: (tabId: string, state: Partial<TabExecutionState>) => void;

  /** 标记Tab开始执行 */
  startExecution: (tabId: string, sessionId: string | null, projectPath: string, engine: 'claude' | 'codex' | 'gemini', prompt?: string) => void;

  /** 标记Tab执行完成 */
  endExecution: (tabId: string) => void;

  /** 清除Tab的执行状态（Tab关闭时调用） */
  clearTabState: (tabId: string) => void;

  /** 获取执行中Tab的数量 */
  getActiveCount: () => number;

  /** 检查Tab是否正在执行 */
  isTabExecuting: (tabId: string) => boolean;
}

// ============================================================================
// Context
// ============================================================================

const GlobalExecutionContext = createContext<GlobalExecutionContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface GlobalExecutionProviderProps {
  children: React.ReactNode;
}

export const GlobalExecutionProvider: React.FC<GlobalExecutionProviderProps> = ({ children }) => {
  // 使用 Map 存储所有Tab的执行状态（性能更好）
  const statesRef = useRef<Map<string, TabExecutionState>>(new Map());

  // 使用 state 触发UI更新（仅在需要时）
  const [, forceUpdate] = useState({});

  // 触发重新渲染
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  /**
   * 获取所有执行中的Tab
   * 🔧 FIX: 不使用 useCallback，避免作为依赖时导致无限循环
   */
  const getActiveExecutions = (): TabExecutionState[] => {
    return Array.from(statesRef.current.values()).filter(state => state.isStreaming);
  };

  /**
   * 获取指定Tab的执行状态
   * 🔧 FIX: 不使用 useCallback，避免作为依赖时导致无限循环
   */
  const getTabState = (tabId: string): TabExecutionState | undefined => {
    return statesRef.current.get(tabId);
  };

  /**
   * 更新Tab执行状态
   */
  const updateTabState = useCallback((tabId: string, partialState: Partial<TabExecutionState>) => {
    const existing = statesRef.current.get(tabId);

    const newState: TabExecutionState = {
      tabId,
      isStreaming: partialState.isStreaming ?? existing?.isStreaming ?? false,
      sessionId: partialState.sessionId ?? existing?.sessionId ?? null,
      projectPath: partialState.projectPath ?? existing?.projectPath ?? '',
      engine: partialState.engine ?? existing?.engine ?? 'claude',
      startedAt: partialState.startedAt ?? existing?.startedAt ?? Date.now(),
      lastUpdateAt: Date.now(),
      currentPrompt: partialState.currentPrompt ?? existing?.currentPrompt,
      promptCount: partialState.promptCount ?? existing?.promptCount ?? 0,
    };

    statesRef.current.set(tabId, newState);

    // 只在 isStreaming 状态变化时触发UI更新（减少不必要的渲染）
    if (existing?.isStreaming !== newState.isStreaming) {
      triggerUpdate();
    }
  }, [triggerUpdate]);

  /**
   * 标记Tab开始执行
   */
  const startExecution = useCallback((
    tabId: string,
    sessionId: string | null,
    projectPath: string,
    engine: 'claude' | 'codex' | 'gemini',
    prompt?: string
  ) => {
    const existing = statesRef.current.get(tabId);

    updateTabState(tabId, {
      isStreaming: true,
      sessionId,
      projectPath,
      engine,
      currentPrompt: prompt,
      promptCount: (existing?.promptCount ?? 0) + 1,
      startedAt: Date.now(),
    });

    logger.debug('GlobalExecutionContext', `[GlobalExecution] ▶️ Tab ${tabId} started execution (engine: ${engine}, session: ${sessionId});`);
  }, [updateTabState]);

  /**
   * 标记Tab执行完成
   */
  const endExecution = useCallback((tabId: string) => {
    const existing = statesRef.current.get(tabId);
    if (!existing) return;

    updateTabState(tabId, {
      isStreaming: false,
      currentPrompt: undefined,
    });

    logger.debug('GlobalExecutionContext', `[GlobalExecution] ⏹️ Tab ${tabId} ended execution`);
  }, [updateTabState]);

  /**
   * 清除Tab状态（Tab关闭时）
   */
  const clearTabState = useCallback((tabId: string) => {
    const hadState = statesRef.current.has(tabId);
    statesRef.current.delete(tabId);

    if (hadState) {
      triggerUpdate();
      logger.debug('GlobalExecutionContext', `[GlobalExecution] 🗑️ Tab ${tabId} state cleared`);
    }
  }, [triggerUpdate]);

  /**
   * 获取执行中Tab数量
   */
  const getActiveCount = useCallback((): number => {
    return getActiveExecutions().length;
  }, [getActiveExecutions]);

  /**
   * 检查Tab是否正在执行
   */
  const isTabExecuting = useCallback((tabId: string): boolean => {
    return statesRef.current.get(tabId)?.isStreaming ?? false;
  }, []);

  const value: GlobalExecutionContextValue = {
    getActiveExecutions,
    getTabState,
    updateTabState,
    startExecution,
    endExecution,
    clearTabState,
    getActiveCount,
    isTabExecuting,
  };

  return (
    <GlobalExecutionContext.Provider value={value}>
      {children}
    </GlobalExecutionContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * 使用全局执行上下文
 */
export const useGlobalExecution = (): GlobalExecutionContextValue => {
  const context = useContext(GlobalExecutionContext);
  if (!context) {
    throw new Error('useGlobalExecution must be used within GlobalExecutionProvider');
  }
  return context;
};
