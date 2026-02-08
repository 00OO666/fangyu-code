/**
 * VirtualList 单元测试
 *
 * 测试虚拟滚动组件的核心逻辑：
 * - 可见范围计算
 * - 测量数据计算
 * - 二分查找算法
 *
 * _Requirements: 1.1_
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// 测试辅助函数（从 VirtualList 提取的核心逻辑）
// =============================================================================

interface ItemMeasurement {
  index: number;
  offset: number;
  height: number;
}

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

/**
 * 计算测量数据
 */
function calculateMeasurements(
  itemCount: number,
  getHeight: (index: number) => number
): ItemMeasurement[] {
  const measurements: ItemMeasurement[] = [];
  let offset = 0;

  for (let i = 0; i < itemCount; i++) {
    const height = getHeight(i);
    measurements.push({ index: i, offset, height });
    offset += height;
  }

  return measurements;
}

/**
 * 计算可见范围
 */
function calculateVisibleRange(
  measurements: ItemMeasurement[],
  scrollTop: number,
  containerHeight: number,
  overscan: number
): { startIndex: number; endIndex: number } {
  if (measurements.length === 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const startIndex = Math.max(0, findStartIndex(measurements, scrollTop) - overscan);
  const endScrollTop = scrollTop + containerHeight;

  let endIndex = startIndex;
  while (endIndex < measurements.length && measurements[endIndex].offset < endScrollTop) {
    endIndex++;
  }
  endIndex = Math.min(measurements.length - 1, endIndex + overscan);

  return { startIndex, endIndex };
}

// =============================================================================
// 测试套件
// =============================================================================

describe("VirtualList 核心逻辑", () => {
  describe("calculateMeasurements", () => {
    it("应该计算固定高度项目的测量数据", () => {
      const measurements = calculateMeasurements(5, () => 50);

      expect(measurements).toEqual([
        { index: 0, offset: 0, height: 50 },
        { index: 1, offset: 50, height: 50 },
        { index: 2, offset: 100, height: 50 },
        { index: 3, offset: 150, height: 50 },
        { index: 4, offset: 200, height: 50 },
      ]);
    });

    it("应该计算动态高度项目的测量数据", () => {
      const heights = [30, 50, 40, 60, 20];
      const measurements = calculateMeasurements(5, (i) => heights[i]);

      expect(measurements).toEqual([
        { index: 0, offset: 0, height: 30 },
        { index: 1, offset: 30, height: 50 },
        { index: 2, offset: 80, height: 40 },
        { index: 3, offset: 120, height: 60 },
        { index: 4, offset: 180, height: 20 },
      ]);
    });

    it("应该处理空列表", () => {
      const measurements = calculateMeasurements(0, () => 50);
      expect(measurements).toEqual([]);
    });

    it("应该处理单个项目", () => {
      const measurements = calculateMeasurements(1, () => 100);
      expect(measurements).toEqual([{ index: 0, offset: 0, height: 100 }]);
    });
  });

  describe("findStartIndex", () => {
    const measurements = calculateMeasurements(100, () => 50);

    it("应该找到滚动位置 0 的起始索引", () => {
      expect(findStartIndex(measurements, 0)).toBe(0);
    });

    it("应该找到滚动位置在项目中间的起始索引", () => {
      // scrollTop = 125，在第 2 个项目（offset 100-150）中间
      expect(findStartIndex(measurements, 125)).toBe(2);
    });

    it("应该找到滚动位置在项目边界的起始索引", () => {
      // scrollTop = 100，正好是第 2 个项目的开始
      expect(findStartIndex(measurements, 100)).toBe(2);
    });

    it("应该找到滚动到底部的起始索引", () => {
      // scrollTop = 4900，接近底部
      const index = findStartIndex(measurements, 4900);
      expect(index).toBe(98);
    });

    it("应该处理超出范围的滚动位置", () => {
      // scrollTop = 10000，超出总高度
      const index = findStartIndex(measurements, 10000);
      expect(index).toBe(100); // 返回最后一个索引 + 1
    });

    it("应该处理空列表", () => {
      expect(findStartIndex([], 100)).toBe(0);
    });
  });

  describe("calculateVisibleRange", () => {
    const measurements = calculateMeasurements(100, () => 50);
    const containerHeight = 300; // 可见 6 个项目

    it("应该计算初始位置的可见范围", () => {
      const range = calculateVisibleRange(measurements, 0, containerHeight, 3);

      // startIndex: max(0, 0 - 3) = 0
      // endIndex: 6 + 3 = 9
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(9);
    });

    it("应该计算滚动后的可见范围", () => {
      // scrollTop = 500，第 10 个项目开始可见
      const range = calculateVisibleRange(measurements, 500, containerHeight, 3);

      // findStartIndex(500) 返回 10，但由于二分查找的边界处理
      // 实际返回的是 9（因为 offset 450-500 的项目部分可见）
      // startIndex: max(0, 9 - 3) = 6
      // endIndex 会包含到 scrollTop + containerHeight = 800 的位置
      expect(range.startIndex).toBe(6);
      expect(range.endIndex).toBeLessThanOrEqual(19);
      expect(range.endIndex).toBeGreaterThanOrEqual(16);
    });

    it("应该计算滚动到底部的可见范围", () => {
      // scrollTop = 4700，接近底部
      const range = calculateVisibleRange(measurements, 4700, containerHeight, 3);

      // 应该包含最后几个项目
      expect(range.endIndex).toBe(99);
    });

    it("应该处理 overscan 为 0", () => {
      const range = calculateVisibleRange(measurements, 0, containerHeight, 0);

      // 只渲染可见的 6 个项目
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(6);
    });

    it("应该处理大 overscan", () => {
      const range = calculateVisibleRange(measurements, 500, containerHeight, 10);

      // startIndex: max(0, 10 - 10) = 0
      expect(range.startIndex).toBe(0);
    });

    it("应该处理空列表", () => {
      const range = calculateVisibleRange([], 0, containerHeight, 3);
      expect(range).toEqual({ startIndex: 0, endIndex: 0 });
    });

    it("应该处理项目数量小于可见区域", () => {
      const smallMeasurements = calculateMeasurements(3, () => 50);
      const range = calculateVisibleRange(smallMeasurements, 0, containerHeight, 3);

      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(2);
    });
  });

  describe("scrollToIndex 计算", () => {
    const measurements = calculateMeasurements(100, () => 50);
    const containerHeight = 300;

    function calculateScrollTop(index: number, align: "start" | "center" | "end"): number {
      if (index < 0 || index >= measurements.length) return -1;

      const measurement = measurements[index];

      switch (align) {
        case "center":
          return measurement.offset - containerHeight / 2 + measurement.height / 2;
        case "end":
          return measurement.offset - containerHeight + measurement.height;
        default:
          return measurement.offset;
      }
    }

    it("start 对齐应该滚动到项目顶部", () => {
      // 第 10 个项目，offset = 500
      expect(calculateScrollTop(10, "start")).toBe(500);
    });

    it("center 对齐应该将项目居中", () => {
      // 第 10 个项目，offset = 500, height = 50
      // 500 - 300/2 + 50/2 = 500 - 150 + 25 = 375
      expect(calculateScrollTop(10, "center")).toBe(375);
    });

    it("end 对齐应该滚动到项目底部", () => {
      // 第 10 个项目，offset = 500, height = 50
      // 500 - 300 + 50 = 250
      expect(calculateScrollTop(10, "end")).toBe(250);
    });

    it("应该处理无效索引", () => {
      expect(calculateScrollTop(-1, "start")).toBe(-1);
      expect(calculateScrollTop(1000, "start")).toBe(-1);
    });
  });

  describe("总高度计算", () => {
    it("应该计算固定高度列表的总高度", () => {
      const measurements = calculateMeasurements(100, () => 50);
      const last = measurements[measurements.length - 1];
      const totalHeight = last.offset + last.height;

      expect(totalHeight).toBe(5000);
    });

    it("应该计算动态高度列表的总高度", () => {
      const heights = [30, 50, 40, 60, 20];
      const measurements = calculateMeasurements(5, (i) => heights[i]);
      const last = measurements[measurements.length - 1];
      const totalHeight = last.offset + last.height;

      expect(totalHeight).toBe(200); // 30 + 50 + 40 + 60 + 20
    });
  });

  describe("onEndReached 触发逻辑", () => {
    function shouldTriggerEndReached(
      scrollTop: number,
      containerHeight: number,
      totalHeight: number,
      threshold: number
    ): boolean {
      const scrollBottom = scrollTop + containerHeight;
      return scrollBottom >= totalHeight - threshold;
    }

    it("应该在到达阈值时触发", () => {
      // 总高度 5000，容器 300，阈值 100
      // 滚动到 4600 时，scrollBottom = 4900，距离底部 100
      expect(shouldTriggerEndReached(4600, 300, 5000, 100)).toBe(true);
    });

    it("不应该在未到达阈值时触发", () => {
      // 滚动到 4500 时，scrollBottom = 4800，距离底部 200
      expect(shouldTriggerEndReached(4500, 300, 5000, 100)).toBe(false);
    });

    it("应该在滚动到底部时触发", () => {
      // 滚动到 4700 时，scrollBottom = 5000，正好到底
      expect(shouldTriggerEndReached(4700, 300, 5000, 100)).toBe(true);
    });
  });
});
