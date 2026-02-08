/**
 * useSearchWorker - 搜索 Worker Hook
 *
 * 功能:
 * - 管理搜索 Worker 生命周期
 * - 处理 Worker 消息
 * - 提供搜索接口
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type {
  SearchOptions,
  SearchResult,
  SearchProgress,
} from './useRipgrepSearch';

// ============================================================================
// Hook
// ============================================================================

export function useSearchWorker() {
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgress>({
    current: 0,
    status: 'completed',
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const currentSearchIdRef = useRef<string | null>(null);

  // 初始化 Worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/search.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event) => {
        const message = event.data;

        switch (message.type) {
          case 'progress':
            setProgress({
              current: message.current,
              total: message.total,
              status: 'searching',
            });
            break;

          case 'result':
            setResults((prev) => [...prev, ...message.results]);
            break;

          case 'complete':
            setIsSearching(false);
            setProgress((prev) => ({
              ...prev,
              status: 'completed',
            }));
            currentSearchIdRef.current = null;
            break;

          case 'error':
            setError(message.error);
            setIsSearching(false);
            setProgress({ current: 0, status: 'error' });
            currentSearchIdRef.current = null;
            logger.error('useSearchWorker', 'Search error:', message.error);
            break;

          default:
            logger.warn('useSearchWorker', 'Unknown message type:', message);
        }
      };

      workerRef.current.onerror = (error) => {
        logger.error('useSearchWorker', 'Worker error:', error);
        setError('Worker 错误');
        setIsSearching(false);
      };

      logger.info('useSearchWorker', 'Worker initialized');
    } catch (err) {
      logger.error('useSearchWorker', 'Failed to initialize worker:', err);
      setError('无法初始化 Worker');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        logger.info('useSearchWorker', 'Worker terminated');
      }
    };
  }, []);

  /**
   * 执行搜索
   */
  const search = useCallback(
    (path: string, pattern: string, options: SearchOptions) => {
      if (!workerRef.current) {
        setError('Worker 未初始化');
        return;
      }

      // 取消之前的搜索
      if (currentSearchIdRef.current) {
        workerRef.current.postMessage({
          type: 'cancel',
          id: currentSearchIdRef.current,
        });
      }

      // 生成新的搜索 ID
      const searchId = `search-${Date.now()}-${Math.random()}`;
      currentSearchIdRef.current = searchId;

      // 重置状态
      setIsSearching(true);
      setError(null);
      setResults([]);
      setProgress({ current: 0, status: 'searching' });

      // 发送搜索请求
      workerRef.current.postMessage({
        type: 'search',
        id: searchId,
        path,
        pattern,
        options,
      });

      logger.info('useSearchWorker', 'Search started:', { path, pattern, searchId });
    },
    []
  );

  /**
   * 取消搜索
   */
  const cancel = useCallback(() => {
    if (workerRef.current && currentSearchIdRef.current) {
      workerRef.current.postMessage({
        type: 'cancel',
        id: currentSearchIdRef.current,
      });
      setIsSearching(false);
      setProgress({ current: results.length, status: 'cancelled' });
      currentSearchIdRef.current = null;
      logger.info('useSearchWorker', 'Search cancelled');
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

  return {
    search,
    cancel,
    clear,
    isSearching,
    progress,
    results,
    error,
  };
}
