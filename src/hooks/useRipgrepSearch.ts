/**
 * useRipgrepSearch - Ripgrep 搜索 Hook
 *
 * 功能:
 * - 调用后端 search_content 命令
 * - 实现流式搜索（AsyncGenerator）
 * - 逐步返回结果，不阻塞 UI
 * - 支持搜索进度和取消
 * - 搜索结果缓存
 */

import { invoke } from '@tauri-apps/api/core';
import { useCallback, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

// ============================================================================
// 类型定义
// ============================================================================

export interface SearchOptions {
  regex: boolean;
  case_sensitive: boolean;
  whole_word: boolean;
  max_results?: number;
  follow_symlinks: boolean;
  file_type?: string;
}

export interface SearchResult {
  file_path: string;
  line_number: number;
  column: number;
  line_content: string;
  matched_text: string;
}

export interface SearchProgress {
  current: number;
  total?: number;
  status: 'searching' | 'completed' | 'cancelled' | 'error';
}

// ============================================================================
// 搜索缓存
// ============================================================================

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

function getCacheKey(path: string, pattern: string, options: SearchOptions): string {
  return JSON.stringify({ path, pattern, options });
}

function getFromCache(key: string): SearchResult[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;

  // 检查是否过期
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }

  return entry.results;
}

function setToCache(key: string, results: SearchResult[]): void {
  searchCache.set(key, {
    results,
    timestamp: Date.now(),
  });

  // 限制缓存大小（最多 50 个）
  if (searchCache.size > 50) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
}

// ============================================================================
// 流式搜索生成器
// ============================================================================

async function* searchContentStream(
  path: string,
  pattern: string,
  options: SearchOptions,
  onProgress?: (progress: SearchProgress) => void
): AsyncGenerator<SearchResult[], void, unknown> {
  try {
    // 检查缓存
    const cacheKey = getCacheKey(path, pattern, options);
    const cached = getFromCache(cacheKey);
    if (cached) {
      logger.info('useRipgrepSearch', 'Using cached results');
      onProgress?.({ current: cached.length, total: cached.length, status: 'completed' });
      yield cached;
      return;
    }

    // 调用后端搜索
    onProgress?.({ current: 0, status: 'searching' });

    const results = await invoke<SearchResult[]>('search_content', {
      path,
      pattern,
      options,
    });

    // 缓存结果
    setToCache(cacheKey, results);

    // 分批返回结果（每批 50 个）
    const batchSize = 50;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      onProgress?.({
        current: i + batch.length,
        total: results.length,
        status: i + batch.length >= results.length ? 'completed' : 'searching',
      });
      yield batch;
    }
  } catch (error) {
    logger.error('useRipgrepSearch', 'Search failed:', error);
    onProgress?.({ current: 0, status: 'error' });
    throw error;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useRipgrepSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgress>({
    current: 0,
    status: 'completed',
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 执行搜索
   */
  const search = useCallback(
    async (path: string, pattern: string, options: SearchOptions) => {
      // 取消之前的搜索
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsSearching(true);
      setError(null);
      setResults([]);
      setProgress({ current: 0, status: 'searching' });

      try {
        const generator = searchContentStream(path, pattern, options, setProgress);
        const allResults: SearchResult[] = [];

        for await (const batch of generator) {
          // 检查是否被取消
          if (abortControllerRef.current.signal.aborted) {
            setProgress({ current: allResults.length, status: 'cancelled' });
            break;
          }

          allResults.push(...batch);
          setResults([...allResults]); // 更新 UI
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '搜索失败';
        setError(errorMessage);
        logger.error('useRipgrepSearch', 'Search error:', err);
      } finally {
        setIsSearching(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  /**
   * 取消搜索
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSearching(false);
      setProgress({ current: results.length, status: 'cancelled' });
    }
  }, [results.length]);

  /**
   * 清除结果
   */
  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    setProgress({ current: 0, status: 'completed' });
  }, []);

  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    searchCache.clear();
    logger.info('useRipgrepSearch', 'Cache cleared');
  }, []);

  return {
    search,
    cancel,
    clear,
    clearCache,
    isSearching,
    progress,
    results,
    error,
  };
}
