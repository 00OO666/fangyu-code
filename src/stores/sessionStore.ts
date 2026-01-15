/**
 * Session Store - Zustand 状态管理
 *
 * 用于替代部分 Context API，减少不必要的重渲染
 *
 * 优势：
 * - 只有订阅了特定状态的组件才会重渲染
 * - 比 Context API 性能更好
 * - 代码更简洁
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExecutionEngineConfig } from '@/components/ExecutionEngineSelector';

// Store 接口
interface SessionStore {
  // 引擎配置
  executionEngineConfig: ExecutionEngineConfig;
  setExecutionEngineConfig: (config: ExecutionEngineConfig) => void;

  // 预览状态
  showPreview: boolean;
  previewUrl: string | null;
  isPreviewMaximized: boolean;
  splitPosition: number;

  setShowPreview: (show: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setIsPreviewMaximized: (maximized: boolean) => void;
  setSplitPosition: (position: number) => void;

  // 预填充消息（用于摘要续接等场景）
  prefillMessage: string | null;
  setPrefillMessage: (message: string | null) => void;
  consumePrefillMessage: () => string | null;
}

// 默认引擎配置
const getDefaultConfig = (): ExecutionEngineConfig => {
  // 尝试从 localStorage 读取
  try {
    const stored = localStorage.getItem('execution_engine_config');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[SessionStore] Failed to load config from localStorage:', error);
  }

  // 默认配置
  return {
    engine: 'claude',
    codexMode: 'read-only',
    codexModel: 'gpt-5.2-codex',
    geminiModel: 'gemini-3-flash',
  };
};

// 创建 Store
export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // 引擎配置
      executionEngineConfig: getDefaultConfig(),
      setExecutionEngineConfig: (config) => {
        console.log('[SessionStore] Setting engine config:', config);
        set({ executionEngineConfig: config });
      },

      // 预览状态
      showPreview: false,
      previewUrl: null,
      isPreviewMaximized: false,
      splitPosition: 50,

      setShowPreview: (show) => set({ showPreview: show }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      setIsPreviewMaximized: (maximized) => set({ isPreviewMaximized: maximized }),
      setSplitPosition: (position) => set({ splitPosition: position }),

      // 预填充消息
      prefillMessage: null,
      setPrefillMessage: (message) => set({ prefillMessage: message }),
      consumePrefillMessage: () => {
        const message = get().prefillMessage;
        if (message) {
          set({ prefillMessage: null });
        }
        return message;
      },
    }),
    {
      name: 'session-storage',
      // 只持久化引擎配置（不持久化预填充消息）
      partialize: (state) => ({
        executionEngineConfig: state.executionEngineConfig,
      }),
    }
  )
);

// 选择器 Hooks（性能优化）
export const useExecutionEngineConfig = () =>
  useSessionStore((state) => state.executionEngineConfig);

export const useSetExecutionEngineConfig = () =>
  useSessionStore((state) => state.setExecutionEngineConfig);

export const usePreviewState = () =>
  useSessionStore((state) => ({
    showPreview: state.showPreview,
    previewUrl: state.previewUrl,
    isPreviewMaximized: state.isPreviewMaximized,
    splitPosition: state.splitPosition,
  }));

export const usePreviewActions = () =>
  useSessionStore((state) => ({
    setShowPreview: state.setShowPreview,
    setPreviewUrl: state.setPreviewUrl,
    setIsPreviewMaximized: state.setIsPreviewMaximized,
    setSplitPosition: state.setSplitPosition,
  }));

// 预填充消息 Hooks
export const usePrefillMessage = () =>
  useSessionStore((state) => state.prefillMessage);

export const useSetPrefillMessage = () =>
  useSessionStore((state) => state.setPrefillMessage);

export const useConsumePrefillMessage = () =>
  useSessionStore((state) => state.consumePrefillMessage);
