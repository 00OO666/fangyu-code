/**
 * useExecutionTracking Hook
 *
 * 集成 GlobalExecutionContext，追踪执行状态
 * 在 ClaudeCodeSession 中使用，不需要修改 usePromptExecution
 *
 * 功能：
 * - 追踪执行开始/结束
 * - Tab 切换时保持状态
 * - 提供执行恢复接口
 */

import { logger } from '@/lib/logger';
import { useEffect, useRef } from "react";

// 🔧 FIX: 直接从 GlobalExecutionContext 模块导入 Context，避免重复创建 hooks
import type { TabExecutionState } from "@/contexts/GlobalExecutionContext";

// 🔧 FIX: 重新定义一个简化的 Context 访问方式，避免 hook 数量问题
// 这个 hook 不使用 useGlobalExecution()，而是直接访问 window 上的全局状态
// 这样可以避免 React hooks 规则问题

interface UseExecutionTrackingConfig {
  /** Tab ID */
  tabId: string;
  /** 当前是否正在加载/执行 */
  isLoading: boolean;
  /** 会话 ID */
  sessionId: string | null;
  /** 项目路径 */
  projectPath: string;
  /** 执行引擎 */
  engine: "claude" | "codex" | "gemini" | "siliconflow" | "kiro";
  /** Tab 是否激活 */
  isActive: boolean;
  /** 当前提示词（可选） */
  currentPrompt?: string;
}

interface UseExecutionTrackingReturn {
  /** 当前 Tab 的执行状态 */
  executionState: TabExecutionState | undefined;
  /** 检查 Tab 是否在后台执行 */
  isBackgroundExecuting: boolean;
  /** 获取后台执行数量 */
  backgroundCount: number;
}

// 🔧 全局状态存储（绕过 React Context）
const globalExecutionStore = {
  states: new Map<string, TabExecutionState>(),

  startExecution(
    tabId: string,
    sessionId: string | null,
    projectPath: string,
    engine: "claude" | "codex" | "gemini" | "siliconflow" | "kiro",
    prompt?: string,
  ) {
    const existing = this.states.get(tabId);
    const newState: TabExecutionState = {
      tabId,
      isStreaming: true,
      sessionId,
      projectPath,
      engine,
      startedAt: Date.now(),
      lastUpdateAt: Date.now(),
      currentPrompt: prompt,
      promptCount: (existing?.promptCount ?? 0) + 1,
    };
    this.states.set(tabId, newState);
    logger.debug('useExecutionTracking', `[GlobalExecution] ▶️ Tab ${tabId} started execution`);
  },

  endExecution(tabId: string) {
    const existing = this.states.get(tabId);
    if (existing) {
      existing.isStreaming = false;
      existing.lastUpdateAt = Date.now();
      existing.currentPrompt = undefined;
      logger.debug('useExecutionTracking', `[GlobalExecution] ⏹️ Tab ${tabId} ended execution`);
    }
  },

  clearTabState(tabId: string) {
    this.states.delete(tabId);
    logger.debug('useExecutionTracking', `[GlobalExecution] 🗑️ Tab ${tabId} state cleared`);
  },

  getTabState(tabId: string): TabExecutionState | undefined {
    return this.states.get(tabId);
  },

  isTabExecuting(tabId: string): boolean {
    return this.states.get(tabId)?.isStreaming ?? false;
  },

  getActiveExecutions(): TabExecutionState[] {
    return Array.from(this.states.values()).filter((s) => s.isStreaming);
  },
};

// 暴露到 window 以便调试
if (typeof window !== "undefined") {
  (window as any).__globalExecutionStore = globalExecutionStore;
}

/**
 * 执行状态追踪 Hook
 * 🔧 简化版：不使用 React Context，避免 hooks 规则问题
 */
export function useExecutionTracking(
  config: UseExecutionTrackingConfig,
): UseExecutionTrackingReturn {
  const { tabId, isLoading, sessionId, projectPath, engine, isActive, currentPrompt } = config;

  // 追踪上一次的 isLoading 状态
  const prevIsLoadingRef = useRef(isLoading);
  const isMountedRef = useRef(true);

  // 追踪执行状态变化
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // 执行开始
    if (!wasLoading && isLoading) {
      globalExecutionStore.startExecution(tabId, sessionId, projectPath, engine, currentPrompt);
    }

    // 执行结束
    if (wasLoading && !isLoading) {
      globalExecutionStore.endExecution(tabId);
    }
  }, [isLoading, tabId, sessionId, projectPath, engine, currentPrompt]);

  // Tab 关闭时清理（组件卸载）
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // 🔧 延迟检查：如果 200ms 后组件仍未重新挂载，则认为 Tab 已关闭
      setTimeout(() => {
        if (!isMountedRef.current) {
          globalExecutionStore.clearTabState(tabId);
        }
      }, 200);
    };
  }, [tabId]);

  // 获取当前 Tab 的执行状态
  const executionState = globalExecutionStore.getTabState(tabId);

  // 检查是否在后台执行
  const isBackgroundExecuting = !isActive && globalExecutionStore.isTabExecuting(tabId);

  // 获取后台执行数量
  const backgroundCount = globalExecutionStore
    .getActiveExecutions()
    .filter((state) => state.tabId !== tabId).length;

  return {
    executionState,
    isBackgroundExecuting,
    backgroundCount,
  };
}

/**
 * 简化版 Hook - 仅获取全局执行统计
 */
export function useExecutionStats() {
  return {
    /** 所有正在执行的 Tab */
    activeExecutions: globalExecutionStore.getActiveExecutions(),
    /** 正在执行的 Tab 数量 */
    activeCount: globalExecutionStore.getActiveExecutions().length,
  };
}

// 导出全局存储以便在其他地方使用
export { globalExecutionStore };
