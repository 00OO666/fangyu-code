/**
 * Recent Sessions Store - 最近会话状态管理
 *
 * 功能：
 * - 管理最近会话列表（按最近使用时间排序）
 * - 支持添加、删除、切换、清空会话
 * - 使用 localStorage 自动持久化和恢复状态
 * - 最多保留 50 条会话记录
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RecentSessionsState, SessionSnapshot } from '@/types/recentSessions';

/**
 * 最近会话最大保存数量。
 */
const MAX_RECENT_SESSIONS = 50;

/**
 * localStorage 持久化 key。
 */
const RECENT_SESSIONS_STORAGE_KEY = 'recent-sessions-storage';

/**
 * 最近会话 Store 类型定义。
 */
interface RecentSessionsStore extends RecentSessionsState {
  /**
   * 添加（或更新）最近会话，并将其移动到列表首位。
   */
  addRecentSession: (session: SessionSnapshot) => void;
  /**
   * 从最近会话列表中删除指定会话。
   */
  removeRecentSession: (sessionId: string) => void;
  /**
   * 切换当前会话，并刷新该会话的最近使用时间。
   */
  switchSession: (sessionId: string) => void;
  /**
   * 清空所有最近会话记录。
   */
  clearRecentSessions: () => void;
}

/**
 * 将会话插入列表头部，并去重后截断到最大数量。
 */
const upsertSessionToTop = (
  sessions: SessionSnapshot[],
  nextSession: SessionSnapshot
): SessionSnapshot[] => {
  const deduplicatedSessions = sessions.filter((session) => session.id !== nextSession.id);
  return [nextSession, ...deduplicatedSessions].slice(0, MAX_RECENT_SESSIONS);
};

/**
 * 最近会话 Zustand Store。
 */
export const useRecentSessionsStore = create<RecentSessionsStore>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      limit: MAX_RECENT_SESSIONS,

      addRecentSession: (session) =>
        set((state) => ({
          sessions: upsertSessionToTop(state.sessions, session),
          currentSessionId: session.id,
        })),

      removeRecentSession: (sessionId) =>
        set((state) => {
          const nextSessions = state.sessions.filter((session) => session.id !== sessionId);
          const nextCurrentSessionId =
            state.currentSessionId === sessionId ? nextSessions[0]?.id ?? null : state.currentSessionId;

          return {
            sessions: nextSessions,
            currentSessionId: nextCurrentSessionId,
          };
        }),

      switchSession: (sessionId) =>
        set((state) => {
          const sessionToSwitch = state.sessions.find((session) => session.id === sessionId);

          if (!sessionToSwitch) {
            return state;
          }

          const switchedSession: SessionSnapshot = {
            ...sessionToSwitch,
            timestamp: Date.now(),
          };

          return {
            sessions: upsertSessionToTop(state.sessions, switchedSession),
            currentSessionId: sessionId,
          };
        }),

      clearRecentSessions: () =>
        set({
          sessions: [],
          currentSessionId: null,
        }),
    }),
    {
      name: RECENT_SESSIONS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions.slice(0, MAX_RECENT_SESSIONS),
        currentSessionId: state.currentSessionId,
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<RecentSessionsState> | undefined;
        const persistedSessions = Array.isArray(typedPersistedState?.sessions)
          ? typedPersistedState.sessions.slice(0, MAX_RECENT_SESSIONS)
          : [];
        const persistedCurrentSessionId =
          typedPersistedState?.currentSessionId &&
          persistedSessions.some((session) => session.id === typedPersistedState.currentSessionId)
            ? typedPersistedState.currentSessionId
            : null;

        return {
          ...currentState,
          sessions: persistedSessions,
          currentSessionId: persistedCurrentSessionId,
          limit: MAX_RECENT_SESSIONS,
        };
      },
    }
  )
);

/**
 * 最近会话列表选择器。
 */
export const useRecentSessions = () => useRecentSessionsStore((state) => state.sessions);

/**
 * 当前最近会话 ID 选择器。
 */
export const useCurrentRecentSessionId = () =>
  useRecentSessionsStore((state) => state.currentSessionId);

/**
 * 最近会话 actions 选择器。
 */
export const useRecentSessionsActions = () =>
  useRecentSessionsStore((state) => ({
    addRecentSession: state.addRecentSession,
    removeRecentSession: state.removeRecentSession,
    switchSession: state.switchSession,
    clearRecentSessions: state.clearRecentSessions,
  }));
