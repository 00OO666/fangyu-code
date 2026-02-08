/**
 * useDraggable Hook 测试
 *
 * 测试拖拽功能的工具函数：
 * - 位置约束
 * - localStorage 读写
 * - 默认位置计算
 */

import { describe, it, expect } from "vitest";
import type { Position } from "@/hooks/useDraggable";

// 测试工具函数（从 useDraggable 中提取的逻辑）

/**
 * 约束位置在视口内
 */
function constrainPosition(
  position: Position,
  panelSize: { width: number; height: number },
  margin: number,
  windowWidth: number,
  windowHeight: number
): Position {
  const maxX = windowWidth - panelSize.width - margin;
  const maxY = windowHeight - panelSize.height - margin;

  return {
    x: Math.max(margin, Math.min(position.x, maxX)),
    y: Math.max(margin, Math.min(position.y, maxY)),
  };
}

/**
 * 计算默认位置（右下角）
 */
function getDefaultPosition(
  panelSize: { width: number; height: number },
  margin: number,
  windowWidth: number,
  windowHeight: number
): Position {
  return {
    x: windowWidth - panelSize.width - margin,
    y: windowHeight - panelSize.height - margin,
  };
}

/**
 * 从 localStorage 读取位置
 */
function loadPosition(store: Record<string, string>, key: string): Position | null {
  try {
    const saved = store[key];
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

/**
 * 保存位置到 localStorage
 */
function savePosition(store: Record<string, string>, key: string, position: Position): void {
  store[key] = JSON.stringify(position);
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock window dimensions
const mockWindowDimensions = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  Object.defineProperty(window, "innerHeight", { value: height, writable: true });
};

describe("useDraggable 工具函数", () => {
  const WINDOW_WIDTH = 1920;
  const WINDOW_HEIGHT = 1080;
  const PANEL_SIZE = { width: 420, height: 560 };
  const MARGIN = 16;

  describe("getDefaultPosition", () => {
    it("应该计算右下角位置", () => {
      const pos = getDefaultPosition(PANEL_SIZE, MARGIN, WINDOW_WIDTH, WINDOW_HEIGHT);

      expect(pos.x).toBe(1920 - 420 - 16); // 1484
      expect(pos.y).toBe(1080 - 560 - 16); // 504
    });

    it("应该根据面板尺寸调整", () => {
      const smallPanel = { width: 200, height: 300 };
      const pos = getDefaultPosition(smallPanel, MARGIN, WINDOW_WIDTH, WINDOW_HEIGHT);

      expect(pos.x).toBe(1920 - 200 - 16); // 1704
      expect(pos.y).toBe(1080 - 300 - 16); // 764
    });

    it("应该根据边距调整", () => {
      const pos = getDefaultPosition(PANEL_SIZE, 32, WINDOW_WIDTH, WINDOW_HEIGHT);

      expect(pos.x).toBe(1920 - 420 - 32); // 1468
      expect(pos.y).toBe(1080 - 560 - 32); // 488
    });
  });

  describe("constrainPosition", () => {
    it("应该约束 X 坐标不小于边距", () => {
      const pos = constrainPosition(
        { x: 5, y: 100 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      expect(pos.x).toBe(MARGIN);
      expect(pos.y).toBe(100);
    });

    it("应该约束 Y 坐标不小于边距", () => {
      const pos = constrainPosition(
        { x: 100, y: 5 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      expect(pos.x).toBe(100);
      expect(pos.y).toBe(MARGIN);
    });

    it("应该约束 X 坐标不超出右边界", () => {
      const pos = constrainPosition(
        { x: 2000, y: 100 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      // maxX = 1920 - 420 - 16 = 1484
      expect(pos.x).toBe(1484);
    });

    it("应该约束 Y 坐标不超出下边界", () => {
      const pos = constrainPosition(
        { x: 100, y: 2000 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      // maxY = 1080 - 560 - 16 = 504
      expect(pos.y).toBe(504);
    });

    it("应该同时约束 X 和 Y", () => {
      const pos = constrainPosition(
        { x: -100, y: -100 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      expect(pos.x).toBe(MARGIN);
      expect(pos.y).toBe(MARGIN);
    });

    it("应该保持有效位置不变", () => {
      const pos = constrainPosition(
        { x: 500, y: 300 },
        PANEL_SIZE,
        MARGIN,
        WINDOW_WIDTH,
        WINDOW_HEIGHT
      );

      expect(pos.x).toBe(500);
      expect(pos.y).toBe(300);
    });

    it("应该处理小窗口情况", () => {
      const pos = constrainPosition(
        { x: 100, y: 100 },
        PANEL_SIZE,
        MARGIN,
        500, // 小窗口
        400
      );

      // maxX = 500 - 420 - 16 = 64
      // maxY = 400 - 560 - 16 = -176 (负数，应该用 margin)
      expect(pos.x).toBe(64);
      expect(pos.y).toBe(MARGIN); // 因为 maxY < margin
    });
  });

  describe("loadPosition", () => {
    it("应该从存储中读取位置", () => {
      const store: Record<string, string> = {
        "test-key": JSON.stringify({ x: 300, y: 400 }),
      };

      const pos = loadPosition(store, "test-key");

      expect(pos).toEqual({ x: 300, y: 400 });
    });

    it("应该在键不存在时返回 null", () => {
      const store: Record<string, string> = {};

      const pos = loadPosition(store, "test-key");

      expect(pos).toBeNull();
    });

    it("应该处理无效 JSON", () => {
      const store: Record<string, string> = {
        "test-key": "invalid json",
      };

      const pos = loadPosition(store, "test-key");

      expect(pos).toBeNull();
    });

    it("应该处理缺少字段的 JSON", () => {
      const store: Record<string, string> = {
        "test-key": JSON.stringify({ x: 100 }), // 缺少 y
      };

      const pos = loadPosition(store, "test-key");

      expect(pos).toBeNull();
    });

    it("应该处理非数字字段", () => {
      const store: Record<string, string> = {
        "test-key": JSON.stringify({ x: "not a number", y: 100 }),
      };

      const pos = loadPosition(store, "test-key");

      expect(pos).toBeNull();
    });
  });

  describe("savePosition", () => {
    it("应该保存位置到存储", () => {
      const store: Record<string, string> = {};

      savePosition(store, "test-key", { x: 500, y: 300 });

      expect(store["test-key"]).toBe(JSON.stringify({ x: 500, y: 300 }));
    });

    it("应该覆盖已有位置", () => {
      const store: Record<string, string> = {
        "test-key": JSON.stringify({ x: 100, y: 100 }),
      };

      savePosition(store, "test-key", { x: 500, y: 300 });

      expect(store["test-key"]).toBe(JSON.stringify({ x: 500, y: 300 }));
    });
  });

  describe("集成场景", () => {
    it("应该正确处理完整的位置恢复流程", () => {
      const store: Record<string, string> = {};

      // 1. 初始化时没有保存的位置，使用默认位置
      let pos = loadPosition(store, "panel-pos");
      expect(pos).toBeNull();

      const defaultPos = getDefaultPosition(PANEL_SIZE, MARGIN, WINDOW_WIDTH, WINDOW_HEIGHT);
      expect(defaultPos.x).toBe(1484);
      expect(defaultPos.y).toBe(504);

      // 2. 用户拖拽到新位置
      const newPos = { x: 200, y: 300 };
      savePosition(store, "panel-pos", newPos);

      // 3. 重新加载时恢复位置
      pos = loadPosition(store, "panel-pos");
      expect(pos).toEqual(newPos);

      // 4. 约束位置在视口内
      const constrained = constrainPosition(pos!, PANEL_SIZE, MARGIN, WINDOW_WIDTH, WINDOW_HEIGHT);
      expect(constrained).toEqual(newPos); // 位置有效，不变
    });

    it("应该处理窗口缩小后的位置恢复", () => {
      const store: Record<string, string> = {};

      // 1. 在大窗口中保存位置
      savePosition(store, "panel-pos", { x: 1400, y: 500 });

      // 2. 窗口缩小后恢复
      const pos = loadPosition(store, "panel-pos");
      const constrained = constrainPosition(
        pos!,
        PANEL_SIZE,
        MARGIN,
        1024, // 缩小的窗口
        768
      );

      // maxX = 1024 - 420 - 16 = 588
      // maxY = 768 - 560 - 16 = 192
      expect(constrained.x).toBe(588);
      expect(constrained.y).toBe(192);
    });
  });
});
