/**
 * CLI 监控性能优化工具
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 防抖 Hook
 * @param value - 需要防抖的值
 * @param delay - 延迟时间（毫秒）
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流 Hook
 * @param callback - 需要节流的回调函数
 * @param delay - 延迟时间（毫秒）
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        return callback(...args);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * 缓存 Hook
 * @param key - 缓存键
 * @param fetcher - 数据获取函数
 * @param ttl - 缓存有效期（毫秒）
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(
    new Map()
  );

  const fetchData = useCallback(async () => {
    // 检查缓存
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
      return;
    }

    // 获取新数据
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cacheRef.current.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cacheRef.current.delete(key);
    fetchData();
  }, [key, fetchData]);

  return { data, loading, error, invalidate };
}

/**
 * 虚拟滚动 Hook
 * @param items - 所有项目
 * @param itemHeight - 每个项目的高度
 * @param containerHeight - 容器高度
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll,
    startIndex,
    endIndex,
  };
}

/**
 * 懒加载 Hook
 * @param callback - 加载更多的回调函数
 * @param hasMore - 是否还有更多数据
 */
export function useLazyLoad(callback: () => void, hasMore: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, hasMore]);

  return loadMoreRef;
}

/**
 * 批量更新 Hook
 * @param initialValue - 初始值
 * @param batchSize - 批量大小
 * @param delay - 延迟时间（毫秒）
 */
export function useBatchUpdate<T>(
  initialValue: T[],
  batchSize: number = 10,
  delay: number = 100
) {
  const [items, setItems] = useState<T[]>(initialValue);
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setItems(initialValue);
    setDisplayedItems([]);
    setCurrentIndex(0);
  }, [initialValue]);

  useEffect(() => {
    if (currentIndex >= items.length) return;

    const timer = setTimeout(() => {
      const nextBatch = items.slice(currentIndex, currentIndex + batchSize);
      setDisplayedItems((prev) => [...prev, ...nextBatch]);
      setCurrentIndex((prev) => prev + batchSize);
    }, delay);

    return () => clearTimeout(timer);
  }, [items, currentIndex, batchSize, delay]);

  return {
    displayedItems,
    isLoading: currentIndex < items.length,
    progress: items.length === 0 ? 100 : Math.min((currentIndex / items.length) * 100, 100),
  };
}

/**
 * 内存监控 Hook
 */
export function useMemoryMonitor() {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const checkMemory = () => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize / 1024 / 1024; // MB
        const total = memory.jsHeapSizeLimit / 1024 / 1024; // MB
        const percentage = (used / total) * 100;

        setMemoryUsage({ used, total, percentage });
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryUsage;
}

/**
 * 性能监控 Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - startTime.current;

    if (renderTime > 100) {
      console.warn(
        `[Performance] ${componentName} took ${renderTime}ms to render (render #${renderCount.current})`
      );
    }

    startTime.current = Date.now();
  });

  return {
    renderCount: renderCount.current,
  };
}
