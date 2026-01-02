/**
 * useCodeFolding Hook
 *
 * 代码折叠管理 Hook，提供：
 * - 区域折叠/展开
 * - 自动检测可折叠区域
 * - 折叠状态持久化
 * - 批量操作
 */

import { useCallback, useEffect, useState } from "react";

/**
 * 折叠区域类型
 */
export type FoldingRegionType =
  | "block" // 代码块 { }
  | "function" // 函数
  | "class" // 类
  | "import" // 导入语句
  | "comment" // 注释块
  | "region" // #region 区域
  | "array" // 数组 [ ]
  | "object" // 对象 { }
  | "jsx" // JSX 元素
  | "markdown"; // Markdown 标题

/**
 * 折叠区域
 */
export interface FoldingRegion {
  /** 唯一ID */
  id: string;
  /** 起始行（从0开始） */
  startLine: number;
  /** 结束行 */
  endLine: number;
  /** 区域类型 */
  type: FoldingRegionType;
  /** 是否已折叠 */
  isFolded: boolean;
  /** 折叠预览文本 */
  preview?: string;
  /** 嵌套层级 */
  level: number;
  /** 父区域ID */
  parentId?: string;
}

/**
 * 折叠状态
 */
export interface CodeFoldingState {
  /** 所有折叠区域 */
  regions: FoldingRegion[];
  /** 已折叠的区域ID集合 */
  foldedIds: Set<string>;
}

// 生成区域ID
const generateRegionId = (startLine: number, endLine: number) => `region_${startLine}_${endLine}`;

// 正则表达式用于检测可折叠区域
const FOLDING_PATTERNS = {
  // 函数定义
  function:
    /^(?:export\s+)?(?:async\s+)?function\s+\w+|^(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
  // 类定义
  class: /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
  // 导入语句（多行）
  import: /^import\s+\{[^}]*$/,
  // 注释块
  comment: /^\/\*|^\/\*\*/,
  // #region
  region: /^\/\/\s*#?region|^\/\*\s*#?region/i,
  // JSX 元素
  jsx: /<[A-Z][a-zA-Z0-9]*(?:\s|>)/,
};

/**
 * 代码折叠 Hook
 */
export function useCodeFolding(initialContent?: string) {
  const [state, setState] = useState<CodeFoldingState>({
    regions: [],
    foldedIds: new Set(),
  });

  /**
   * 分析代码并检测可折叠区域
   */
  const analyzeCode = useCallback((content: string): FoldingRegion[] => {
    const lines = content.split("\n");
    const regions: FoldingRegion[] = [];
    const stack: { line: number; type: FoldingRegionType; level: number; char: string }[] = [];

    let inMultiLineComment = false;
    let commentStart = -1;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // 检测多行注释
      if (!inMultiLineComment && (trimmed.startsWith("/*") || trimmed.startsWith("/**"))) {
        inMultiLineComment = true;
        commentStart = index;
      }
      if (inMultiLineComment && trimmed.endsWith("*/")) {
        if (index > commentStart) {
          regions.push({
            id: generateRegionId(commentStart, index),
            startLine: commentStart,
            endLine: index,
            type: "comment",
            isFolded: false,
            preview: lines[commentStart].trim().slice(0, 50) + "...",
            level: 0,
          });
        }
        inMultiLineComment = false;
        commentStart = -1;
      }

      // 检测 #region
      if (trimmed.match(/^\/\/\s*#?region/i) || trimmed.match(/^\/\*\s*#?region/i)) {
        stack.push({ line: index, type: "region", level: stack.length, char: "region" });
      }
      if (trimmed.match(/^\/\/\s*#?endregion/i) || trimmed.match(/^\/\*\s*#?endregion/i)) {
        const start = stack.pop();
        if (start && start.char === "region") {
          regions.push({
            id: generateRegionId(start.line, index),
            startLine: start.line,
            endLine: index,
            type: "region",
            isFolded: false,
            preview: lines[start.line].replace(/\/\/\s*#?region\s*/i, "").trim() || "Region",
            level: start.level,
          });
        }
      }

      // 检测代码块（花括号）
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === "{") {
          // 判断类型
          let type: FoldingRegionType = "block";
          if (FOLDING_PATTERNS.function.test(trimmed)) type = "function";
          else if (FOLDING_PATTERNS.class.test(trimmed)) type = "class";
          else if (trimmed.includes("=>")) type = "function";

          stack.push({ line: index, type, level: stack.length, char: "{" });
        } else if (char === "}") {
          const start = stack.pop();
          if (start && start.char === "{" && index > start.line) {
            regions.push({
              id: generateRegionId(start.line, index),
              startLine: start.line,
              endLine: index,
              type: start.type,
              isFolded: false,
              preview: lines[start.line].trim().slice(0, 60),
              level: start.level,
            });
          }
        }
      }
    });

    // 按起始行排序
    return regions.sort((a, b) => a.startLine - b.startLine);
  }, []);

  /**
   * 更新内容并重新分析
   */
  const updateContent = useCallback(
    (content: string) => {
      const newRegions = analyzeCode(content);

      // 保留之前的折叠状态
      setState((prev) => {
        const newFoldedIds = new Set<string>();
        newRegions.forEach((region) => {
          if (prev.foldedIds.has(region.id)) {
            region.isFolded = true;
            newFoldedIds.add(region.id);
          }
        });

        return {
          regions: newRegions,
          foldedIds: newFoldedIds,
        };
      });
    },
    [analyzeCode],
  );

  /**
   * 切换折叠状态
   */
  const toggleFold = useCallback((regionId: string) => {
    setState((prev) => {
      const newFoldedIds = new Set(prev.foldedIds);
      const newRegions = prev.regions.map((r) => {
        if (r.id === regionId) {
          const newFolded = !r.isFolded;
          if (newFolded) {
            newFoldedIds.add(regionId);
          } else {
            newFoldedIds.delete(regionId);
          }
          return { ...r, isFolded: newFolded };
        }
        return r;
      });

      return { regions: newRegions, foldedIds: newFoldedIds };
    });
  }, []);

  /**
   * 折叠指定区域
   */
  const fold = useCallback((regionId: string) => {
    setState((prev) => {
      const newFoldedIds = new Set(prev.foldedIds);
      newFoldedIds.add(regionId);

      return {
        ...prev,
        regions: prev.regions.map((r) => (r.id === regionId ? { ...r, isFolded: true } : r)),
        foldedIds: newFoldedIds,
      };
    });
  }, []);

  /**
   * 展开指定区域
   */
  const unfold = useCallback((regionId: string) => {
    setState((prev) => {
      const newFoldedIds = new Set(prev.foldedIds);
      newFoldedIds.delete(regionId);

      return {
        ...prev,
        regions: prev.regions.map((r) => (r.id === regionId ? { ...r, isFolded: false } : r)),
        foldedIds: newFoldedIds,
      };
    });
  }, []);

  /**
   * 折叠所有区域
   */
  const foldAll = useCallback(() => {
    setState((prev) => ({
      regions: prev.regions.map((r) => ({ ...r, isFolded: true })),
      foldedIds: new Set(prev.regions.map((r) => r.id)),
    }));
  }, []);

  /**
   * 展开所有区域
   */
  const unfoldAll = useCallback(() => {
    setState((prev) => ({
      regions: prev.regions.map((r) => ({ ...r, isFolded: false })),
      foldedIds: new Set(),
    }));
  }, []);

  /**
   * 折叠指定层级
   */
  const foldLevel = useCallback((level: number) => {
    setState((prev) => {
      const newFoldedIds = new Set<string>();
      const newRegions = prev.regions.map((r) => {
        const shouldFold = r.level >= level;
        if (shouldFold) newFoldedIds.add(r.id);
        return { ...r, isFolded: shouldFold };
      });

      return { regions: newRegions, foldedIds: newFoldedIds };
    });
  }, []);

  /**
   * 获取指定行所在的区域
   */
  const getRegionAtLine = useCallback(
    (line: number): FoldingRegion | null => {
      // 找到包含该行的最内层区域
      let result: FoldingRegion | null = null;
      for (const region of state.regions) {
        if (line >= region.startLine && line <= region.endLine) {
          if (!result || region.level > result.level) {
            result = region;
          }
        }
      }
      return result;
    },
    [state.regions],
  );

  /**
   * 检查行是否被折叠隐藏
   */
  const isLineHidden = useCallback(
    (line: number): boolean => {
      for (const region of state.regions) {
        if (region.isFolded && line > region.startLine && line <= region.endLine) {
          return true;
        }
      }
      return false;
    },
    [state.regions],
  );

  // 初始化
  useEffect(() => {
    if (initialContent) {
      updateContent(initialContent);
    }
  }, [initialContent, updateContent]);

  // 计算属性
  const foldedCount = state.foldedIds.size;
  const totalRegions = state.regions.length;

  return {
    // 状态
    ...state,
    foldedCount,
    totalRegions,

    // 方法
    updateContent,
    toggleFold,
    fold,
    unfold,
    foldAll,
    unfoldAll,
    foldLevel,
    getRegionAtLine,
    isLineHidden,
  };
}

export default useCodeFolding;
