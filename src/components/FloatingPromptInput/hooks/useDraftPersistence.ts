import { useEffect, useCallback, useRef } from 'react';

const DRAFT_KEY_PREFIX = 'prompt_draft_';
const DRAFT_DEBOUNCE_MS = 300;

interface UseDraftPersistenceOptions {
  sessionId?: string;
  onRestore?: (draft: string) => void;
}

/**
 * 草稿持久化 Hook
 * 使用 localStorage 保存和恢复输入框草稿，支持按会话隔离
 */
export function useDraftPersistence({
  sessionId,
  onRestore,
}: UseDraftPersistenceOptions) {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredRef = useRef(false);
  // 🔧 FIX: 使用 ref 存储 sessionId，避免 useEffect 依赖变化导致重复恢复
  const sessionIdRef = useRef(sessionId);
  const onRestoreRef = useRef(onRestore);

  // 更新 refs
  onRestoreRef.current = onRestore;

  // 生成存储 key
  const getStorageKey = useCallback((sid?: string) => {
    const id = sid ?? sessionIdRef.current;
    return id ? `${DRAFT_KEY_PREFIX}${id}` : `${DRAFT_KEY_PREFIX}global`;
  }, []);

  // 保存草稿到 localStorage（带防抖）
  const saveDraft = useCallback((content: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        const key = getStorageKey();
        if (content.trim()) {
          localStorage.setItem(key, content);
        } else {
          // 如果内容为空，删除草稿
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.warn('[DraftPersistence] Failed to save draft:', error);
      }
    }, DRAFT_DEBOUNCE_MS);
  }, [getStorageKey]);

  // 清除草稿
  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    try {
      const key = getStorageKey();
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[DraftPersistence] Failed to clear draft:', error);
    }
  }, [getStorageKey]);

  // 恢复草稿
  const restoreDraft = useCallback((sid?: string): string | null => {
    try {
      const key = getStorageKey(sid);
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('[DraftPersistence] Failed to restore draft:', error);
      return null;
    }
  }, [getStorageKey]);

  // 🔧 FIX: 合并两个 useEffect，只在 sessionId 变化时恢复草稿
  useEffect(() => {
    // sessionId 变化时更新 ref
    const prevSessionId = sessionIdRef.current;
    sessionIdRef.current = sessionId;

    // 如果 sessionId 没变且已经恢复过，跳过
    if (prevSessionId === sessionId && hasRestoredRef.current) {
      return;
    }

    // sessionId 变化时重置恢复标记
    if (prevSessionId !== sessionId) {
      hasRestoredRef.current = false;
    }

    // 尝试恢复草稿
    const draft = restoreDraft(sessionId);
    if (draft && onRestoreRef.current && !hasRestoredRef.current) {
      onRestoreRef.current(draft);
      hasRestoredRef.current = true;
    }
  }, [sessionId, restoreDraft]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveDraft,
    clearDraft,
    restoreDraft,
  };
}
