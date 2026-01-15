import React from "react";
import type { Session } from "@/lib/api";
import type { RewindMode } from "@/lib/api";

/**
 * ✅ SessionContext - 解决 Props Drilling 问题
 *
 * 将会话相关的配置和回调函数集中管理，避免通过多层组件传递
 *
 * 优化前问题：
 * - SessionMessages 接收 10+ 个 props
 * - Props 通过多层组件传递
 * - 中间组件不使用但必须传递
 *
 * 优化后：
 * - 子组件直接从 Context 获取需要的数据
 * - 减少 props 传递层级
 * - 代码更清晰易维护
 */

// Session 配置接口
export interface SessionSettings {
  showSystemInitialization?: boolean;
  hideWarmupMessages?: boolean;
}

// Session 上下文数据接口
interface SessionContextValue {
  // Session 信息
  session: Session | null;
  projectPath: string;
  sessionId: string | null;
  projectId: string | null;

  // Session 配置
  settings: SessionSettings;

  // 回调函数
  onLinkDetected?: (url: string) => void;
  onRevert?: (promptIndex: number, mode: RewindMode) => void;
  getPromptIndexForMessage?: (index: number) => number;
  displayableToMessagesIndexMap?: Map<number, number>; // 🔧 FIX: displayableMessages 索引到 messages 索引的映射

  // 🆕 Thinking Block 状态管理
  getThinkingOpenState?: (messageId: string) => boolean;
  onThinkingToggle?: (messageId: string, isOpen: boolean) => void;
}

const SessionContext = React.createContext<SessionContextValue | undefined>(undefined);

interface SessionProviderProps {
  session: Session | null;
  projectPath: string;
  sessionId: string | null;
  projectId: string | null;
  settings: SessionSettings;
  onLinkDetected?: (url: string) => void;
  onRevert?: (promptIndex: number, mode: RewindMode) => void;
  getPromptIndexForMessage?: (index: number) => number;
  displayableToMessagesIndexMap?: Map<number, number>; // 🔧 FIX
  getThinkingOpenState?: (messageId: string) => boolean;
  onThinkingToggle?: (messageId: string, isOpen: boolean) => void;
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({
  session,
  projectPath,
  sessionId,
  projectId,
  settings,
  onLinkDetected,
  onRevert,
  getPromptIndexForMessage,
  displayableToMessagesIndexMap,
  getThinkingOpenState,
  onThinkingToggle,
  children,
}) => {
  // 🔧 FIX v2.4: 简化实现，直接传递 Map
  // 之前的 useRef + useEffect 方案导致 contextValue 不更新
  // Map 的变化频率不高，直接依赖不会造成性能问题

  const contextValue = React.useMemo<SessionContextValue>(
    () => ({
      session,
      projectPath,
      sessionId,
      projectId,
      settings,
      onLinkDetected,
      onRevert,
      getPromptIndexForMessage,
      displayableToMessagesIndexMap,
      getThinkingOpenState,
      onThinkingToggle,
    }),
    [
      session,
      projectPath,
      sessionId,
      projectId,
      settings,
      onLinkDetected,
      onRevert,
      getPromptIndexForMessage,
      displayableToMessagesIndexMap,
      getThinkingOpenState,
      onThinkingToggle,
    ]
  );

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
};

/**
 * ✅ useSession Hook - 获取 Session 上下文
 *
 * @example
 * function MessageComponent() {
 *   const { settings, onLinkDetected } = useSession();
 *   // 使用配置和回调...
 * }
 */
export const useSession = (): SessionContextValue => {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

SessionProvider.displayName = "SessionProvider";
