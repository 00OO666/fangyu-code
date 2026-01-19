/**
 * useDraggable - 通用拖拽 Hook
 *
 * 功能:
 * - 支持鼠标拖拽移动元素
 * - 位置持久化到 localStorage
 * - 视口边界约束
 * - 双击重置位置
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================
// 类型定义
// ============================================================

export interface Position {
  x: number;
  y: number;
}

export interface DraggableOptions {
  /** 初始位置（如果 localStorage 没有保存的位置） */
  defaultPosition?: Position;
  /** localStorage 存储键 */
  storageKey?: string;
  /** 是否约束在视口内 */
  constrainToViewport?: boolean;
  /** 面板尺寸（用于边界计算） */
  panelSize?: { width: number; height: number };
  /** 边距（距离视口边缘的最小距离） */
  margin?: number;
}

export interface DraggableResult {
  /** 当前位置 */
  position: Position;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 拖拽区域的事件处理器 */
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    style: React.CSSProperties;
  };
  /** 重置位置到默认值 */
  resetPosition: () => void;
  /** 手动设置位置 */
  setPosition: (pos: Position) => void;
}

// ============================================================
// 常量
// ============================================================

const DEFAULT_MARGIN = 16;
const DEFAULT_PANEL_SIZE = { width: 420, height: 560 };

// ============================================================
// 工具函数
// ============================================================

/**
 * 从 localStorage 读取位置
 */
function loadPosition(key: string): Position | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
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
function savePosition(key: string, position: Position): void {
  try {
    localStorage.setItem(key, JSON.stringify(position));
  } catch {
    // 忽略存储错误（如 localStorage 已满）
  }
}

/**
 * 约束位置在视口内
 */
function constrainPosition(
  position: Position,
  panelSize: { width: number; height: number },
  margin: number
): Position {
  const maxX = window.innerWidth - panelSize.width - margin;
  const maxY = window.innerHeight - panelSize.height - margin;

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
  margin: number
): Position {
  return {
    x: window.innerWidth - panelSize.width - margin,
    y: window.innerHeight - panelSize.height - margin,
  };
}

// ============================================================
// Hook
// ============================================================

export function useDraggable(options: DraggableOptions = {}): DraggableResult {
  const {
    defaultPosition,
    storageKey = 'fangyu-draggable-position',
    constrainToViewport = true,
    panelSize = DEFAULT_PANEL_SIZE,
    margin = DEFAULT_MARGIN,
  } = options;

  // 计算初始位置
  const getInitialPosition = useCallback((): Position => {
    // 1. 尝试从 localStorage 读取
    const saved = loadPosition(storageKey);
    if (saved) {
      // 确保保存的位置仍在视口内
      return constrainToViewport
        ? constrainPosition(saved, panelSize, margin)
        : saved;
    }

    // 2. 使用提供的默认位置
    if (defaultPosition) {
      return constrainToViewport
        ? constrainPosition(defaultPosition, panelSize, margin)
        : defaultPosition;
    }

    // 3. 计算默认位置（右下角）
    return getDefaultPosition(panelSize, margin);
  }, [storageKey, defaultPosition, constrainToViewport, panelSize, margin]);

  // 状态
  const [position, setPositionState] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);

  // Refs 用于拖拽计算
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const positionStartRef = useRef<Position | null>(null);

  /**
   * 设置位置（带约束和持久化）
   */
  const setPosition = useCallback(
    (newPosition: Position) => {
      const constrained = constrainToViewport
        ? constrainPosition(newPosition, panelSize, margin)
        : newPosition;
      setPositionState(constrained);
      savePosition(storageKey, constrained);
    },
    [constrainToViewport, panelSize, margin, storageKey]
  );

  /**
   * 重置位置到默认值
   */
  const resetPosition = useCallback(() => {
    const defaultPos = defaultPosition || getDefaultPosition(panelSize, margin);
    setPosition(defaultPos);
  }, [defaultPosition, panelSize, margin, setPosition]);

  /**
   * 鼠标按下 - 开始拖拽
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;

      // 阻止默认行为和冒泡
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      positionStartRef.current = { ...position };
    },
    [position]
  );

  /**
   * 鼠标移动 - 更新位置
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !positionStartRef.current) {
        return;
      }

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const newPosition: Position = {
        x: positionStartRef.current.x + deltaX,
        y: positionStartRef.current.y + deltaY,
      };

      // 实时约束位置
      const constrained = constrainToViewport
        ? constrainPosition(newPosition, panelSize, margin)
        : newPosition;

      setPositionState(constrained);
    },
    [isDragging, constrainToViewport, panelSize, margin]
  );

  /**
   * 鼠标释放 - 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // 保存最终位置
      savePosition(storageKey, position);
    }
    dragStartRef.current = null;
    positionStartRef.current = null;
  }, [isDragging, position, storageKey]);

  /**
   * 双击 - 重置位置
   */
  const handleDoubleClick = useCallback(() => {
    resetPosition();
  }, [resetPosition]);

  // 监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 监听窗口大小变化，重新约束位置
  useEffect(() => {
    const handleResize = () => {
      if (constrainToViewport) {
        setPositionState((prev) => constrainPosition(prev, panelSize, margin));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainToViewport, panelSize, margin]);

  // 🆕 监听 panelSize 变化，重新约束位置（用于最小化/展开切换）
  useEffect(() => {
    if (constrainToViewport) {
      setPositionState((prev) => constrainPosition(prev, panelSize, margin));
    }
  }, [constrainToViewport, panelSize.width, panelSize.height, margin]);

  return {
    position,
    isDragging,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onDoubleClick: handleDoubleClick,
      style: {
        cursor: isDragging ? 'move' : 'move',
        userSelect: 'none' as const,
      },
    },
    resetPosition,
    setPosition,
  };
}

export default useDraggable;
