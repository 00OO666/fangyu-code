/**
 * useMultiCursor Hook
 *
 * 多光标编辑管理 Hook，提供：
 * - 添加/删除光标
 * - 光标位置同步
 * - 批量编辑操作
 * - 选区管理
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * 光标位置
 */
export interface CursorPosition {
  /** 行号（从0开始） */
  line: number;
  /** 列号（从0开始） */
  column: number;
}

/**
 * 选区范围
 */
export interface SelectionRange {
  /** 起始位置 */
  start: CursorPosition;
  /** 结束位置 */
  end: CursorPosition;
}

/**
 * 光标实例
 */
export interface Cursor {
  /** 唯一ID */
  id: string;
  /** 光标位置 */
  position: CursorPosition;
  /** 选区（如果有） */
  selection?: SelectionRange;
  /** 是否是主光标 */
  isPrimary?: boolean;
}

/**
 * 多光标状态
 */
export interface MultiCursorState {
  /** 所有光标 */
  cursors: Cursor[];
  /** 主光标ID */
  primaryCursorId: string | null;
  /** 是否启用多光标模式 */
  isMultiCursorMode: boolean;
}

// 生成唯一ID
const generateCursorId = () => `cursor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * 多光标编辑 Hook
 */
export function useMultiCursor() {
  const [state, setState] = useState<MultiCursorState>({
    cursors: [],
    primaryCursorId: null,
    isMultiCursorMode: false,
  });

  /**
   * 添加光标
   */
  const addCursor = useCallback((position: CursorPosition, selection?: SelectionRange) => {
    const id = generateCursorId();
    const newCursor: Cursor = {
      id,
      position,
      selection,
      isPrimary: state.cursors.length === 0,
    };

    setState(prev => ({
      ...prev,
      cursors: [...prev.cursors, newCursor],
      primaryCursorId: prev.primaryCursorId || id,
      isMultiCursorMode: true,
    }));

    return id;
  }, [state.cursors.length]);

  /**
   * 删除光标
   */
  const removeCursor = useCallback((cursorId: string) => {
    setState(prev => {
      const newCursors = prev.cursors.filter(c => c.id !== cursorId);

      // 如果删除的是主光标，选择新的主光标
      let newPrimaryId = prev.primaryCursorId;
      if (cursorId === prev.primaryCursorId && newCursors.length > 0) {
        newPrimaryId = newCursors[0].id;
        newCursors[0] = { ...newCursors[0], isPrimary: true };
      }

      return {
        ...prev,
        cursors: newCursors,
        primaryCursorId: newCursors.length > 0 ? newPrimaryId : null,
        isMultiCursorMode: newCursors.length > 1,
      };
    });
  }, []);

  /**
   * 更新光标位置
   */
  const updateCursor = useCallback((cursorId: string, updates: Partial<Cursor>) => {
    setState(prev => ({
      ...prev,
      cursors: prev.cursors.map(c =>
        c.id === cursorId ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  /**
   * 移动所有光标
   */
  const moveAllCursors = useCallback((deltaLine: number, deltaColumn: number) => {
    setState(prev => ({
      ...prev,
      cursors: prev.cursors.map(c => ({
        ...c,
        position: {
          line: Math.max(0, c.position.line + deltaLine),
          column: Math.max(0, c.position.column + deltaColumn),
        },
      })),
    }));
  }, []);

  /**
   * 在下一行添加光标（Ctrl+Alt+Down）
   */
  const addCursorBelow = useCallback(() => {
    const primary = state.cursors.find(c => c.isPrimary);
    if (!primary) return;

    addCursor({
      line: primary.position.line + 1,
      column: primary.position.column,
    });
  }, [state.cursors, addCursor]);

  /**
   * 在上一行添加光标（Ctrl+Alt+Up）
   */
  const addCursorAbove = useCallback(() => {
    const primary = state.cursors.find(c => c.isPrimary);
    if (!primary || primary.position.line === 0) return;

    addCursor({
      line: primary.position.line - 1,
      column: primary.position.column,
    });
  }, [state.cursors, addCursor]);

  /**
   * 选择所有匹配项（Ctrl+Shift+L）
   */
  const selectAllOccurrences = useCallback((text: string, content: string) => {
    if (!text) return;

    // 清除现有光标
    setState(prev => ({ ...prev, cursors: [], primaryCursorId: null }));

    // 查找所有匹配项
    const lines = content.split('\n');
    const newCursors: Cursor[] = [];

    lines.forEach((line, lineIndex) => {
      let startIndex = 0;
      while (true) {
        const index = line.indexOf(text, startIndex);
        if (index === -1) break;

        newCursors.push({
          id: generateCursorId(),
          position: { line: lineIndex, column: index },
          selection: {
            start: { line: lineIndex, column: index },
            end: { line: lineIndex, column: index + text.length },
          },
          isPrimary: newCursors.length === 0,
        });

        startIndex = index + 1;
      }
    });

    if (newCursors.length > 0) {
      setState({
        cursors: newCursors,
        primaryCursorId: newCursors[0].id,
        isMultiCursorMode: newCursors.length > 1,
      });
    }
  }, []);

  /**
   * 清除所有光标（只保留主光标）
   */
  const clearSecondary = useCallback(() => {
    setState(prev => {
      const primary = prev.cursors.find(c => c.isPrimary);
      return {
        ...prev,
        cursors: primary ? [primary] : [],
        primaryCursorId: primary?.id || null,
        isMultiCursorMode: false,
      };
    });
  }, []);

  /**
   * 清除所有光标
   */
  const clearAll = useCallback(() => {
    setState({
      cursors: [],
      primaryCursorId: null,
      isMultiCursorMode: false,
    });
  }, []);

  /**
   * 设置主光标
   */
  const setPrimary = useCallback((cursorId: string) => {
    setState(prev => ({
      ...prev,
      cursors: prev.cursors.map(c => ({
        ...c,
        isPrimary: c.id === cursorId,
      })),
      primaryCursorId: cursorId,
    }));
  }, []);

  // 计算属性
  const primaryCursor = useMemo(() =>
    state.cursors.find(c => c.isPrimary) || null,
    [state.cursors]
  );

  const cursorCount = state.cursors.length;

  return {
    // 状态
    ...state,
    primaryCursor,
    cursorCount,

    // 方法
    addCursor,
    removeCursor,
    updateCursor,
    moveAllCursors,
    addCursorBelow,
    addCursorAbove,
    selectAllOccurrences,
    clearSecondary,
    clearAll,
    setPrimary,
  };
}

export default useMultiCursor;
