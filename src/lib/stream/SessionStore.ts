/**
 * SessionStore - 会话状态管理
 *
 * 轻量级状态管理，不依赖外部库
 * 使用发布-订阅模式实现状态更新通知
 */

import type { ClaudeStreamMessage } from '@/types/claude';
import type { EngineType } from './converters';

/**
 * 会话状态
 */
export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'streaming'
  | 'completed'
  | 'error';

/**
 * 会话数据
 */
export interface SessionData {
  id: string;
  engine: EngineType;
  status: SessionStatus;
  messages: ClaudeStreamMessage[];
  rawJsonl: string[];
  error: string | null;
  claudeSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Store 状态
 */
interface StoreState {
  sessions: Map<string, SessionData>;
  activeSessionId: string | null;
}

/**
 * 订阅者回调
 */
type Subscriber = () => void;

/**
 * 选择器
 */
type Selector<T> = (state: StoreState) => T;

/**
 * SessionStore 类
 */
class SessionStore {
  private state: StoreState = {
    sessions: new Map(),
    activeSessionId: null,
  };

  private subscribers: Set<Subscriber> = new Set();

  /**
   * 获取当前状态
   */
  getState(): StoreState {
    return this.state;
  }

  /**
   * 订阅状态变更
   */
  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * 通知所有订阅者
   */
  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }

  /**
   * 创建新会话
   */
  createSession(id: string, engine: EngineType): SessionData {
    const session: SessionData = {
      id,
      engine,
      status: 'idle',
      messages: [],
      rawJsonl: [],
      error: null,
      claudeSessionId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, session),
    };

    this.notify();
    return session;
  }

  /**
   * 获取会话
   */
  getSession(id: string): SessionData | undefined {
    return this.state.sessions.get(id);
  }

  /**
   * 设置活跃会话
   */
  setActiveSession(id: string | null): void {
    if (this.state.activeSessionId !== id) {
      this.state = {
        ...this.state,
        activeSessionId: id,
      };
      this.notify();
    }
  }

  /**
   * 获取活跃会话
   */
  getActiveSession(): SessionData | undefined {
    if (!this.state.activeSessionId) return undefined;
    return this.state.sessions.get(this.state.activeSessionId);
  }

  /**
   * 更新会话状态
   */
  updateSessionStatus(id: string, status: SessionStatus): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      status,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 设置会话错误
   */
  setSessionError(id: string, error: string | null): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      error,
      status: error ? 'error' : session.status,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 设置 Claude 会话 ID
   */
  setClaudeSessionId(id: string, claudeSessionId: string): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      claudeSessionId,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 追加消息
   */
  appendMessage(id: string, message: ClaudeStreamMessage): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 批量追加消息
   */
  appendMessages(id: string, messages: ClaudeStreamMessage[]): void {
    if (messages.length === 0) return;

    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      messages: [...session.messages, ...messages],
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 设置消息列表（替换）
   */
  setMessages(id: string, messages: ClaudeStreamMessage[]): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      messages,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 追加原始 JSONL
   */
  appendRawJsonl(id: string, jsonl: string): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      rawJsonl: [...session.rawJsonl, jsonl],
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 设置原始 JSONL 列表
   */
  setRawJsonl(id: string, rawJsonl: string[]): void {
    const session = this.state.sessions.get(id);
    if (!session) return;

    const updated: SessionData = {
      ...session,
      rawJsonl,
      updatedAt: Date.now(),
    };

    this.state = {
      ...this.state,
      sessions: new Map(this.state.sessions).set(id, updated),
    };

    this.notify();
  }

  /**
   * 清除会话
   */
  clearSession(id: string): void {
    const sessions = new Map(this.state.sessions);
    sessions.delete(id);

    this.state = {
      ...this.state,
      sessions,
      activeSessionId: this.state.activeSessionId === id ? null : this.state.activeSessionId,
    };

    this.notify();
  }

  /**
   * 清除所有会话
   */
  clearAllSessions(): void {
    this.state = {
      sessions: new Map(),
      activeSessionId: null,
    };

    this.notify();
  }

  /**
   * 获取所有会话 ID
   */
  getAllSessionIds(): string[] {
    return Array.from(this.state.sessions.keys());
  }

  /**
   * 获取会话数量
   */
  get sessionCount(): number {
    return this.state.sessions.size;
  }
}

/**
 * 全局单例
 */
export const sessionStore = new SessionStore();

/**
 * React Hook: 订阅 Store 状态
 */
import { useSyncExternalStore, useCallback } from 'react';

export function useSessionStore<T>(selector: Selector<T>): T {
  const getSnapshot = useCallback(() => selector(sessionStore.getState()), [selector]);

  return useSyncExternalStore(
    sessionStore.subscribe.bind(sessionStore),
    getSnapshot,
    getSnapshot
  );
}

/**
 * React Hook: 获取会话数据
 */
export function useSession(id: string): SessionData | undefined {
  return useSessionStore(
    useCallback((state) => state.sessions.get(id), [id])
  );
}

/**
 * React Hook: 获取活跃会话
 */
export function useActiveSession(): SessionData | undefined {
  return useSessionStore((state) => {
    if (!state.activeSessionId) return undefined;
    return state.sessions.get(state.activeSessionId);
  });
}

/**
 * React Hook: 获取会话消息
 */
export function useSessionMessages(id: string): ClaudeStreamMessage[] {
  return useSessionStore(
    useCallback((state) => state.sessions.get(id)?.messages ?? [], [id])
  );
}

/**
 * React Hook: 获取会话状态
 */
export function useSessionStatus(id: string): SessionStatus {
  return useSessionStore(
    useCallback((state) => state.sessions.get(id)?.status ?? 'idle', [id])
  );
}
