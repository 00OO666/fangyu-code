/**
 * Tab 管理模块入口
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 将 700+ 行的 useTabs.tsx 拆分为多个专注的模块
 * - useTabState - 基础状态管理
 * - useTabPersistence - 持久化逻辑
 * - useMultiWindow - 多窗口支持
 *
 * _Requirements: 1.1_
 */

import { createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from "react";
import type { Tab, TabSession, TabContextValue } from "./types";
import { useTabState } from "./useTabState";
import { useTabPersistence } from "./useTabPersistence";
import { useMultiWindow } from "./useMultiWindow";
import { useTheme } from "@/contexts/ThemeContext";

// Re-export types
export type { Tab, TabSession, TabSessionData, TabContextValue } from "./types";

// 🔧 FIX (v2.7.6): 导出 TabContext 供需要可选访问的 hooks 使用
export const TabContext = createContext<TabContextValue | null>(null);

interface TabProviderProps {
  children: ReactNode;
}

/**
 * TabProvider - 标签页状态管理 Provider
 *
 * 组合多个专注的 hooks 提供完整的标签页管理功能
 */
export const TabProvider: React.FC<TabProviderProps> = ({ children }) => {
  // 基础状态管理
  const tabState = useTabState();
  const { themeName, setTheme } = useTheme();

  // 持久化
  useTabPersistence({
    tabs: tabState.tabs,
    activeTabId: tabState.activeTabId,
    setTabs: tabState.setTabs,
    setActiveTabId: tabState.setActiveTabId,
  });

  // 多窗口支持
  const multiWindow = useMultiWindow({
    tabs: tabState.tabs,
    activeTabId: tabState.activeTabId,
    setTabs: tabState.setTabs,
    setActiveTabId: tabState.setActiveTabId,
    forceCloseTab: tabState.forceCloseTab,
    generateTabId: tabState.generateTabId,
  });

  const activeTab = useMemo(
    () => tabState.tabs.find((tab) => tab.id === tabState.activeTabId),
    [tabState.tabs, tabState.activeTabId]
  );

  // 🔧 FIX: 激活标签页时同步主题，但不覆盖“最近一次主题”记录
  useEffect(() => {
    if (!activeTab?.themeName) return;
    if (activeTab.themeName === themeName) return;
    setTheme(activeTab.themeName, { persistLast: false });
  }, [activeTab?.themeName, themeName, setTheme]);

  // 🔧 FIX (v2.7.6): 使用 useMemo 缓存 contextValue，避免不必要的重渲染
  const contextValue: TabContextValue = useMemo(
    () => ({
      tabs: tabState.tabsWithActive,
      activeTabId: tabState.activeTabId,
      createNewTab: tabState.createNewTab,
      createSmartTab: tabState.createSmartTab,
      switchToTab: tabState.switchToTab,
      closeTab: tabState.closeTab,
      updateTabState: tabState.updateTabState,
      updateTabChanges: tabState.updateTabChanges,
      updateTabTitle: tabState.updateTabTitle,
      updateTabEngine: tabState.updateTabEngine,
      updateTabTheme: tabState.updateTabTheme,
      updateTabSession: tabState.updateTabSession,
      upgradeSmartSession: tabState.upgradeSmartSession,
      getTabById: tabState.getTabById,
      getActiveTab: tabState.getActiveTab,
      openSessionInBackground: tabState.openSessionInBackground,
      getTabStats: tabState.getTabStats,
      registerTabCleanup: tabState.registerTabCleanup,
      canCloseTab: tabState.canCloseTab,
      forceCloseTab: tabState.forceCloseTab,
      reorderTabs: tabState.reorderTabs,

      // Multi-window support
      detachTab: multiWindow.detachTab,
      isTabDetached: multiWindow.isTabDetached,
      getDetachedTabs: multiWindow.getDetachedTabs,
      createNewTabAsWindow: multiWindow.createNewTabAsWindow,

      // Backward compatibility
      updateTabStreamingStatus: tabState.updateTabStreamingStatus,
      clearTabError: tabState.clearTabError,
    }),
    [
      tabState.tabsWithActive,
      tabState.activeTabId,
      tabState.createNewTab,
      tabState.createSmartTab,
      tabState.switchToTab,
      tabState.closeTab,
      tabState.updateTabState,
      tabState.updateTabChanges,
      tabState.updateTabTitle,
      tabState.updateTabEngine,
      tabState.updateTabTheme,
      tabState.updateTabSession,
      tabState.upgradeSmartSession,
      tabState.getTabById,
      tabState.getActiveTab,
      tabState.openSessionInBackground,
      tabState.getTabStats,
      tabState.registerTabCleanup,
      tabState.canCloseTab,
      tabState.forceCloseTab,
      tabState.reorderTabs,
      multiWindow.detachTab,
      multiWindow.isTabDetached,
      multiWindow.getDetachedTabs,
      multiWindow.createNewTabAsWindow,
      tabState.updateTabStreamingStatus,
      tabState.clearTabError,
    ]
  );

  return <TabContext.Provider value={contextValue}>{children}</TabContext.Provider>;
};

/**
 * useTabs - 使用标签页状态管理
 */
export const useTabs = (): TabContextValue => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabProvider");
  }
  return context;
};

/**
 * useActiveTab - 获取当前活跃标签页
 */
export const useActiveTab = (): TabSession | undefined => {
  const { getActiveTab } = useTabs();
  return getActiveTab();
};

/**
 * useTabSession - 获取特定标签页的会话管理钩子
 */
export const useTabSession = (tabId: string) => {
  const {
    getTabById,
    updateTabChanges,
    updateTabStreamingStatus,
    updateTabTitle,
    updateTabEngine,
    updateTabSession,
    registerTabCleanup,
  } = useTabs();

  const tab = getTabById(tabId);

  const markAsChanged = useCallback(() => {
    updateTabChanges(tabId, true);
  }, [tabId, updateTabChanges]);

  const markAsUnchanged = useCallback(() => {
    updateTabChanges(tabId, false);
  }, [tabId, updateTabChanges]);

  const updateTitle = useCallback(
    (title: string) => {
      updateTabTitle(tabId, title);
    },
    [tabId, updateTabTitle]
  );

  const updateStreaming = useCallback(
    (isStreaming: boolean, sessionId: string | null) => {
      updateTabStreamingStatus(tabId, isStreaming, sessionId);
    },
    [tabId, updateTabStreamingStatus]
  );

  const updateEngine = useCallback(
    (engine: "claude" | "codex" | "gemini") => {
      updateTabEngine(tabId, engine);
    },
    [tabId, updateTabEngine]
  );

  const updateSession = useCallback(
    (sessionInfo: {
      sessionId: string;
      projectId: string;
      projectPath: string;
      engine?: "claude" | "codex" | "gemini";
    }) => {
      updateTabSession(tabId, sessionInfo);
    },
    [tabId, updateTabSession]
  );

  const setCleanup = useCallback(
    (cleanup: () => Promise<void> | void) => {
      registerTabCleanup(tabId, cleanup);
    },
    [tabId, registerTabCleanup]
  );

  return {
    tab,
    markAsChanged,
    markAsUnchanged,
    updateTitle,
    updateStreaming,
    updateEngine,
    updateSession,
    setCleanup,
  };
};
