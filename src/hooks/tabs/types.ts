/**
 * Tab 类型定义
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 从 useTabs.tsx 拆分出类型定义
 * - 集中管理所有 Tab 相关类型
 *
 * _Requirements: 1.1_
 */

import type { Session } from "@/lib/api";
import type { ThemeName } from "@/types/theme";

/**
 * Tab 接口 - 简化的标签页数据结构
 */
export interface Tab {
  id: string;
  title: string;
  type: "session" | "new";

  // Session data
  projectPath?: string;
  session?: Session;
  engine?: "claude" | "codex" | "gemini";
  themeName?: ThemeName;

  // Smart mode flag (智能会话模式)
  smartMode?: boolean;

  // State management (simplified)
  state: "idle" | "streaming" | "error";
  errorMessage?: string;
  hasUnsavedChanges: boolean;

  // Metadata
  createdAt: number;
  lastActiveAt: number;
}

/** TabSession - 带 isActive 标记的 Tab */
export type TabSession = Tab & { isActive: boolean };

/** @deprecated Use Tab instead */
export type TabSessionData = Tab;

/**
 * Tab Context 值接口
 */
export interface TabContextValue {
  tabs: TabSession[];
  activeTabId: string | null;
  createNewTab: (session?: Session, projectPath?: string, activate?: boolean) => string;
  createSmartTab: (activate?: boolean) => string;
  switchToTab: (tabId: string) => void;
  closeTab: (
    tabId: string,
    force?: boolean
  ) => Promise<{ needsConfirmation?: boolean; tabId?: string } | void>;
  updateTabState: (tabId: string, state: Tab["state"], errorMessage?: string) => void;
  updateTabChanges: (tabId: string, hasChanges: boolean) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  updateTabEngine: (tabId: string, engine: "claude" | "codex" | "gemini") => void;
  updateTabTheme: (tabId: string, themeName: ThemeName) => void;
  updateTabSession: (
    tabId: string,
    sessionInfo: {
      sessionId: string;
      projectId: string;
      projectPath: string;
      engine?: "claude" | "codex" | "gemini";
    }
  ) => void;
  upgradeSmartSession: (
    tabId: string,
    firstMessage: string
  ) => Promise<{ projectPath: string; title: string } | null>;
  getTabById: (tabId: string) => TabSession | undefined;
  getActiveTab: () => TabSession | undefined;
  openSessionInBackground: (session: Session) => { tabId: string; isNew: boolean };
  getTabStats: () => { total: number; active: number; hasChanges: number };
  registerTabCleanup: (tabId: string, cleanup: () => Promise<void> | void) => void;
  canCloseTab: (tabId: string) => { canClose: boolean; hasUnsavedChanges: boolean };
  forceCloseTab: (tabId: string) => Promise<void>;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Multi-window support
  detachTab: (tabId: string) => Promise<string | null>;
  isTabDetached: (tabId: string) => boolean;
  getDetachedTabs: () => string[];
  createNewTabAsWindow: (session?: Session, projectPath?: string) => Promise<string | null>;

  // Backward compatibility aliases
  /** @deprecated Use updateTabState instead */
  updateTabStreamingStatus: (tabId: string, isStreaming: boolean, sessionId: string | null) => void;
  /** @deprecated Use updateTabState instead */
  clearTabError: (tabId: string) => void;
}

/**
 * 持久化状态结构
 */
export interface PersistedTabState {
  tabs: Tab[];
  activeTabId: string | null;
}

/**
 * 存储键常量
 */
export const TAB_STORAGE_KEY = "claude-workbench-tabs-state";
