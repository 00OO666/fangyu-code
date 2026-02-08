/**
 * 消息持久化 Hook
 *
 * 使用 IndexedDB 存储消息，支持刷新后恢复
 * 🔧 v2.2.6: 新增，解决刷新后消息丢失的问题
 */

import { logger } from "@/lib/logger";
import { useEffect, useCallback, useRef } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

const DB_NAME = "fangyu-code-messages";
const DB_VERSION = 1;
const STORE_NAME = "messages";
const MAX_MESSAGES = 500; // 最多保存 500 条消息

interface StoredSession {
  sessionId: string;
  messages: ClaudeStreamMessage[];
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * 打开 IndexedDB 数据库
 */
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
  });
};

/**
 * 保存消息到 IndexedDB
 */
const saveMessages = async (sessionId: string, messages: ClaudeStreamMessage[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // 只保存最近的消息
    const trimmedMessages = messages.slice(-MAX_MESSAGES);

    const data: StoredSession = {
      sessionId,
      messages: trimmedMessages,
      timestamp: Date.now(),
    };

    store.put(data);
  } catch (error) {
    logger.warn("useMessagePersistence", "[MessagePersistence] Failed to save messages:", error);
  }
};

/**
 * 从 IndexedDB 加载消息
 */
const loadMessages = async (sessionId: string): Promise<ClaudeStreamMessage[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.get(sessionId);
      request.onsuccess = () => {
        const data = request.result as StoredSession | undefined;
        resolve(data?.messages || []);
      };
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    logger.warn("useMessagePersistence", "[MessagePersistence] Failed to load messages:", error);
    return [];
  }
};

/**
 * 清除会话消息
 */
const clearMessages = async (sessionId: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(sessionId);
  } catch (error) {
    logger.warn("useMessagePersistence", "[MessagePersistence] Failed to clear messages:", error);
  }
};

/**
 * 清理过期的会话（超过 7 天）
 */
const cleanupOldSessions = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const data = cursor.value as StoredSession;
        if (data.timestamp < sevenDaysAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (error) {
    logger.warn(
      "useMessagePersistence",
      "[MessagePersistence] Failed to cleanup old sessions:",
      error
    );
  }
};

export interface UseMessagePersistenceOptions {
  sessionId: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseMessagePersistenceReturn {
  loadPersistedMessages: () => Promise<ClaudeStreamMessage[]>;
  persistMessages: (messages: ClaudeStreamMessage[]) => void;
  persistMessagesImmediately: (messages: ClaudeStreamMessage[]) => Promise<void>; // 🆕 立即保存
  clearPersistedMessages: () => Promise<void>;
}

/**
 * 消息持久化 Hook
 */
export function useMessagePersistence(
  options: UseMessagePersistenceOptions
): UseMessagePersistenceReturn {
  const { sessionId, enabled = true, debounceMs = 1000 } = options;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 启动时清理过期会话
  useEffect(() => {
    if (enabled) {
      cleanupOldSessions();
    }
  }, [enabled]);

  // 加载持久化的消息
  const loadPersistedMessages = useCallback(async (): Promise<ClaudeStreamMessage[]> => {
    if (!enabled || !sessionId) return [];
    return loadMessages(sessionId);
  }, [enabled, sessionId]);

  // 持久化消息（带防抖）
  const persistMessages = useCallback(
    (messages: ClaudeStreamMessage[]) => {
      if (!enabled || !sessionId) return;

      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 防抖保存
      saveTimeoutRef.current = setTimeout(() => {
        saveMessages(sessionId, messages);
      }, debounceMs);
    },
    [enabled, sessionId, debounceMs]
  );

  // 🆕 立即持久化消息（不防抖）
  const persistMessagesImmediately = useCallback(
    async (messages: ClaudeStreamMessage[]): Promise<void> => {
      if (!enabled || !sessionId) return;

      // 清除防抖定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // 立即保存
      await saveMessages(sessionId, messages);
    },
    [enabled, sessionId]
  );

  // 清除持久化的消息
  const clearPersistedMessages = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    await clearMessages(sessionId);
  }, [sessionId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadPersistedMessages,
    persistMessages,
    persistMessagesImmediately,
    clearPersistedMessages,
  };
}

export default useMessagePersistence;
