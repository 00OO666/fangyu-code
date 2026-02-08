/**
 * useSearchHistory - 搜索历史管理 Hook
 *
 * 功能:
 * - 保存最近 50 个搜索记录
 * - 支持收藏常用搜索
 * - 提供搜索建议
 * - localStorage 持久化
 */

import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

// ============================================================================
// 类型定义
// ============================================================================

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
  filterType?: string;
  pinned?: boolean; // 收藏标记
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'recent' | 'recommended';
  metadata?: {
    resultCount?: number;
    timestamp?: number;
    itemType?: string;
  };
}

// ============================================================================
// 常量
// ============================================================================

const STORAGE_KEY = 'fangyu-code-search-history';
const MAX_HISTORY_ITEMS = 50;
const MAX_SUGGESTIONS = 10;

// ============================================================================
// Hook
// ============================================================================

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      logger.error('useSearchHistory', 'Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存历史记录
  const saveHistory = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setHistory(items);
    } catch (error) {
      logger.error('useSearchHistory', 'Failed to save history:', error);
    }
  }, []);

  // 添加搜索记录
  const addSearch = useCallback(
    (query: string, resultCount: number, filterType?: string) => {
      if (!query.trim()) return;

      const newItem: SearchHistoryItem = {
        id: `${Date.now()}-${Math.random()}`,
        query: query.trim(),
        timestamp: Date.now(),
        resultCount,
        filterType,
        pinned: false,
      };

      // 移除重复项（相同查询和过滤器）
      const filtered = history.filter(
        (item) => !(item.query === newItem.query && item.filterType === newItem.filterType)
      );

      // 添加到开头，保留收藏项
      const pinnedItems = filtered.filter((item) => item.pinned);
      const unpinnedItems = filtered.filter((item) => !item.pinned);

      const newHistory = [
        ...pinnedItems,
        newItem,
        ...unpinnedItems.slice(0, MAX_HISTORY_ITEMS - pinnedItems.length - 1),
      ];

      saveHistory(newHistory);
    },
    [history, saveHistory]
  );

  // 删除搜索记录
  const removeSearch = useCallback(
    (id: string) => {
      const newHistory = history.filter((item) => item.id !== id);
      saveHistory(newHistory);
    },
    [history, saveHistory]
  );

  // 清除所有历史
  const clearHistory = useCallback(() => {
    // 保留收藏项
    const pinnedItems = history.filter((item) => item.pinned);
    saveHistory(pinnedItems);
  }, [history, saveHistory]);

  // 切换收藏状态
  const togglePin = useCallback(
    (id: string) => {
      const newHistory = history.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      );
      saveHistory(newHistory);
    },
    [history, saveHistory]
  );

  // 获取搜索建议
  const getSuggestions = useCallback(
    (query: string, recentItems?: Array<{ id: string; name: string; type: string }>): SearchSuggestion[] => {
      if (!query.trim()) {
        // 无查询时，返回最近的历史记录
        return history
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            text: item.query,
            type: 'history' as const,
            metadata: {
              resultCount: item.resultCount,
              timestamp: item.timestamp,
            },
          }));
      }

      const lowerQuery = query.toLowerCase();
      const suggestions: SearchSuggestion[] = [];

      // 1. 匹配历史搜索
      const historyMatches = history
        .filter((item) => item.query.toLowerCase().includes(lowerQuery))
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          text: item.query,
          type: 'history' as const,
          metadata: {
            resultCount: item.resultCount,
            timestamp: item.timestamp,
          },
        }));

      suggestions.push(...historyMatches);

      // 2. 匹配最近使用的项目（如果提供）
      if (recentItems) {
        const recentMatches = recentItems
          .filter((item) => item.name.toLowerCase().includes(lowerQuery))
          .slice(0, 3)
          .map((item) => ({
            id: `recent-${item.id}`,
            text: item.name,
            type: 'recent' as const,
            metadata: {
              itemType: item.type,
            },
          }));

        suggestions.push(...recentMatches);
      }

      // 限制总数
      return suggestions.slice(0, MAX_SUGGESTIONS);
    },
    [history]
  );

  // 获取收藏的搜索
  const getPinnedSearches = useCallback(() => {
    return history.filter((item) => item.pinned);
  }, [history]);

  return {
    history,
    loading,
    addSearch,
    removeSearch,
    clearHistory,
    togglePin,
    getSuggestions,
    getPinnedSearches,
  };
}
