/**
 * VirtualList - 虚拟滚动列表组件
 *
 * 实现高性能的虚拟滚动，只渲染可见区域的项目
 * 支持动态高度项目和 overscan 配置
 *
 * _Requirements: 1.1_
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";

// =============================================================================
// 类型定义
// =============================================================================

export interface VirtualListProps<T> {
  /** 数据项列表 */
  items: T[];
  /** 渲染单个项目 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 获取项目的唯一键 */
  getItemKey: (item: T, index: number) => string | number;
  /** 预估的项目高度（用于初始计算） */
  estimatedItemHeight: number;
  /** 容器高度 */
  height: number;
  /** 容器宽度（可选） */
  width?: number | string;
  /** 上下额外渲染的项目数量 */
  overscan?: number;
  /** 滚动到底部时的回调 */
  onEndReached?: () => void;
  /** 触发 onEndReached 的阈值（距离底部的像素数） */
  endReachedThreshold?: number;
  /** 容器类名 */
  className?: string;
  /** 内容区域类名 */
  contentClassName?: string;
  /** 空列表时显示的内容 */
  emptyContent?: React.ReactNode;
  /** 是否自动滚动到底部 */
  autoScrollToBottom?: boolean;
}

export interface VirtualListRef {
  /** 滚动到指定索引 */
  scrollToIndex: (index: number, align?: "start" | "center" | "end") => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;
  /** 滚动到底部 */
  scrollToBottom: () => void;
  /** 获取当前滚动位置 */
  getScrollTop: () => number;
  /** 设置滚动位置 */
  setScrollTop: (scrollTop: number) => void;
}

interface ItemMeasurement {
  index: number;
  offset: number;
  height: number;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 二分查找找到第一个 offset >= scrollTop 的项目索引
 */
function findStartIndex(measurements: ItemMeasurement[], scrollTop: number): number {
  let low = 0;
  let high = measurements.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const measurement = measurements[mid];

    if (measurement.offset + measurement.height < scrollTop) {
      low = mid + 1;
    } else if (measurement.offset > scrollTop) {
      high = mid - 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, low);
}

// =============================================================================
// VirtualList 组件
// =============================================================================

function VirtualListInner<T>(props: VirtualListProps<T>, ref: React.ForwardedRef<VirtualListRef>) {
  const {
    items,
    renderItem,
    getItemKey,
    estimatedItemHeight,
    height,
    width = "100%",
    overscan = 3,
    onEndReached,
    endReachedThreshold = 100,
    className = "",
    contentClassName = "",
    emptyContent,
    autoScrollToBottom = false,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>([]);
  const measuredHeights = useRef<Map<string | number, number>>(new Map());
  const lastItemCount = useRef(items.length);
  const isAtBottom = useRef(false);

  // 计算所有项目的测量数据
  const calculateMeasurements = useCallback(() => {
    const newMeasurements: ItemMeasurement[] = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const key = getItemKey(items[i], i);
      const measuredHeight = measuredHeights.current.get(key);
      const itemHeight = measuredHeight ?? estimatedItemHeight;

      newMeasurements.push({
        index: i,
        offset,
        height: itemHeight,
      });

      offset += itemHeight;
    }

    return newMeasurements;
  }, [items, getItemKey, estimatedItemHeight]);

  // 更新测量数据
  useEffect(() => {
    setMeasurements(calculateMeasurements());
  }, [calculateMeasurements]);

  // 计算总高度
  const totalHeight = useMemo(() => {
    if (measurements.length === 0) return 0;
    const last = measurements[measurements.length - 1];
    return last.offset + last.height;
  }, [measurements]);

  // 计算可见范围
  const visibleRange = useMemo(() => {
    if (measurements.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    const startIndex = Math.max(0, findStartIndex(measurements, scrollTop) - overscan);
    const endScrollTop = scrollTop + height;

    let endIndex = startIndex;
    while (endIndex < measurements.length && measurements[endIndex].offset < endScrollTop) {
      endIndex++;
    }
    endIndex = Math.min(measurements.length - 1, endIndex + overscan);

    return { startIndex, endIndex };
  }, [measurements, scrollTop, height, overscan]);

  // 处理滚动事件
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const newScrollTop = target.scrollTop;
      setScrollTop(newScrollTop);

      // 检查是否到达底部
      const scrollBottom = newScrollTop + height;
      isAtBottom.current = scrollBottom >= totalHeight - endReachedThreshold;

      if (isAtBottom.current && onEndReached) {
        onEndReached();
      }
    },
    [height, totalHeight, endReachedThreshold, onEndReached]
  );

  // 测量项目高度
  const measureItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (!element) return;

      const key = getItemKey(items[index], index);
      const currentHeight = measuredHeights.current.get(key);
      const newHeight = element.getBoundingClientRect().height;

      if (currentHeight !== newHeight) {
        measuredHeights.current.set(key, newHeight);
        setMeasurements(calculateMeasurements());
      }
    },
    [items, getItemKey, calculateMeasurements]
  );

  // 自动滚动到底部
  useEffect(() => {
    if (autoScrollToBottom && items.length > lastItemCount.current) {
      if (isAtBottom.current || lastItemCount.current === 0) {
        containerRef.current?.scrollTo({
          top: totalHeight,
          behavior: "smooth",
        });
      }
    }
    lastItemCount.current = items.length;
  }, [items.length, autoScrollToBottom, totalHeight]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, align: "start" | "center" | "end" = "start") => {
      if (index < 0 || index >= measurements.length) return;

      const measurement = measurements[index];
      let targetScrollTop: number;

      switch (align) {
        case "center":
          targetScrollTop = measurement.offset - height / 2 + measurement.height / 2;
          break;
        case "end":
          targetScrollTop = measurement.offset - height + measurement.height;
          break;
        default:
          targetScrollTop = measurement.offset;
      }

      containerRef.current?.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    },
    scrollToTop: () => {
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    scrollToBottom: () => {
      containerRef.current?.scrollTo({ top: totalHeight, behavior: "smooth" });
    },
    getScrollTop: () => scrollTop,
    setScrollTop: (newScrollTop: number) => {
      containerRef.current?.scrollTo({ top: newScrollTop });
    },
  }));

  // 渲染空列表
  if (items.length === 0) {
    return (
      <div
        className={`virtual-list-empty ${className}`}
        style={{ height, width, overflow: "auto" }}
      >
        {emptyContent || <div className="text-center text-gray-500 py-8">暂无数据</div>}
      </div>
    );
  }

  // 渲染可见项目
  const visibleItems = [];
  for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
    const item = items[i];
    const measurement = measurements[i];
    if (!measurement) continue;

    visibleItems.push(
      <div
        key={getItemKey(item, i)}
        ref={(el) => measureItem(i, el)}
        style={{
          position: "absolute",
          top: measurement.offset,
          left: 0,
          right: 0,
        }}
      >
        {renderItem(item, i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height,
        width,
        overflow: "auto",
        position: "relative",
      }}
      onScroll={handleScroll}
    >
      <div
        className={`virtual-list-content ${contentClassName}`}
        style={{
          height: totalHeight,
          position: "relative",
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

// 使用 forwardRef 包装组件
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListRef> }
) => React.ReactElement;

export default VirtualList;
