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

  // 生成存储 key
  const getStorageKey = useCallback(() => {
    return sessionId ? `${DRAFT_KEY_PREFIX}${sessionId}` : `${DRAFT_KEY_PREFIX}global`;
  }, [sessionId]);

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
  const restoreDraft = useCallback((): string | null => {
    try {
      const key = getStorageKey();
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('[DraftPersistence] Failed to restore draft:', error);
      return null;
    }
  }, [getStorageKey]);

  // 组件挂载时恢复草稿
  useEffect(() => {
    // 只在首次挂载时恢复，避免 sessionId 变化时重复恢复
    if (hasRestoredRef.current) {
      return;
    }

    const draft = restoreDraft();
    if (draft && onRestore) {
      onRestore(draft);
      hasRestoredRef.current = true;
    }
  }, [restoreDraft, onRestore]);

  // sessionId 变化时重置恢复标记并尝试恢复新会话的草稿
  useEffect(() => {
    hasRestoredRef.current = false;
    const draft = restoreDraft();
    if (draft && onRestore) {
      onRestore(draft);
      hasRestoredRef.current = true;
    }
  }, [sessionId, restoreDraft, onRestore]);

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
