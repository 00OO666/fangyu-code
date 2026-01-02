/**
 * useToolRecommendation - 智能工具推荐 Hook
 *
 * 功能：
 * - 分析对话内容，识别可能需要的工具
 * - 根据关键词和上下文推荐 MCP/SKILL/Hook
 * - 弹出推荐提示，一键启用
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToolRecommendation {
  /** 工具 ID */
  toolId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具类型 */
  toolType: "mcp" | "skill" | "hook";
  /** 推荐原因 */
  reason: string;
  /** 匹配到的关键词 */
  matchedKeywords: string[];
  /** 推荐置信度 (0-1) */
  confidence: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 关键词到工具的映射配置
 */
const KEYWORD_TOOL_MAPPING: Array<{
  keywords: string[];
  toolId: string;
  toolName: string;
  toolType: "mcp" | "skill" | "hook";
  reason: string;
  weight: number; // 权重，用于计算置信度
}> = [
  // GitHub 相关
  {
    keywords: [
      "github",
      "git",
      "仓库",
      "repository",
      "pr",
      "pull request",
      "issue",
      "fork",
      "clone",
      "commit",
    ],
    toolId: "mcp:claude:github",
    toolName: "GitHub",
    toolType: "mcp",
    reason: "检测到 GitHub 相关操作，建议启用 GitHub MCP 工具",
    weight: 1.0,
  },
  // 文件系统相关
  {
    keywords: [
      "文件",
      "file",
      "目录",
      "directory",
      "读取",
      "写入",
      "read",
      "write",
      "创建文件",
      "create file",
    ],
    toolId: "mcp:claude:filesystem",
    toolName: "Filesystem",
    toolType: "mcp",
    reason: "检测到文件系统操作需求，建议启用 Filesystem MCP 工具",
    weight: 0.8,
  },
  // HTTP 请求相关
  {
    keywords: ["api", "http", "fetch", "请求", "request", "get", "post", "url", "网页", "web"],
    toolId: "mcp:claude:fetch",
    toolName: "Fetch",
    toolType: "mcp",
    reason: "检测到 HTTP 请求需求，建议启用 Fetch MCP 工具",
    weight: 0.9,
  },
  // 浏览器自动化相关
  {
    keywords: [
      "截图",
      "screenshot",
      "爬虫",
      "crawler",
      "scrape",
      "浏览器",
      "browser",
      "自动化",
      "puppeteer",
      "页面",
    ],
    toolId: "mcp:claude:puppeteer",
    toolName: "Puppeteer",
    toolType: "mcp",
    reason: "检测到浏览器自动化需求，建议启用 Puppeteer MCP 工具",
    weight: 0.9,
  },
  // 记忆/知识管理相关
  {
    keywords: ["记住", "remember", "记忆", "memory", "存储知识", "跨会话", "持久化"],
    toolId: "mcp:claude:memory",
    toolName: "Memory",
    toolType: "mcp",
    reason: "检测到持久化记忆需求，建议启用 Memory MCP 工具",
    weight: 0.85,
  },
  // 文档查询相关
  {
    keywords: ["文档", "documentation", "docs", "react", "vue", "node", "typescript", "api文档"],
    toolId: "mcp:claude:context7",
    toolName: "Context7",
    toolType: "mcp",
    reason: "检测到技术文档查询需求，建议启用 Context7 MCP 工具",
    weight: 0.7,
  },
  // 复杂推理相关
  {
    keywords: [
      "分析",
      "analyze",
      "推理",
      "reasoning",
      "复杂",
      "complex",
      "步骤",
      "step by step",
      "思考",
      "think",
    ],
    toolId: "mcp:claude:sequential-thinking",
    toolName: "Sequential Thinking",
    toolType: "mcp",
    reason: "检测到复杂推理需求，建议启用 Sequential Thinking MCP 工具",
    weight: 0.6,
  },
];

/**
 * 已忽略的推荐（避免重复提示）
 */
const DISMISSED_KEY = "fangyu-code-dismissed-recommendations";

function loadDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // ignore
  }
}

export function useToolRecommendation() {
  const [recommendations, setRecommendations] = useState<ToolRecommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed());
  const lastAnalyzedText = useRef<string>("");

  // 同步到 localStorage
  useEffect(() => {
    saveDismissed(dismissed);
  }, [dismissed]);

  /**
   * 分析文本内容，生成工具推荐
   */
  const analyzeContent = useCallback(
    (content: string, enabledTools: Set<string> = new Set()) => {
      if (!content || content === lastAnalyzedText.current) return;
      lastAnalyzedText.current = content;

      const lowerContent = content.toLowerCase();
      const newRecommendations: ToolRecommendation[] = [];

      for (const mapping of KEYWORD_TOOL_MAPPING) {
        // 跳过已启用的工具
        if (enabledTools.has(mapping.toolId)) continue;

        // 跳过已忽略的推荐
        if (dismissed.has(mapping.toolId)) continue;

        // 检查关键词匹配
        const matchedKeywords = mapping.keywords.filter((kw) =>
          lowerContent.includes(kw.toLowerCase()),
        );

        if (matchedKeywords.length > 0) {
          // 计算置信度：匹配关键词数量 / 总关键词数量 * 权重
          const confidence = Math.min(
            (matchedKeywords.length / mapping.keywords.length) * mapping.weight,
            1.0,
          );

          // 只推荐置信度超过阈值的工具
          if (confidence >= 0.2) {
            newRecommendations.push({
              toolId: mapping.toolId,
              toolName: mapping.toolName,
              toolType: mapping.toolType,
              reason: mapping.reason,
              matchedKeywords,
              confidence,
              timestamp: Date.now(),
            });
          }
        }
      }

      // 按置信度排序，保留前 3 个推荐
      const topRecommendations = newRecommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      setRecommendations(topRecommendations);
    },
    [dismissed],
  );

  /**
   * 忽略某个推荐（不再提示）
   */
  const dismissRecommendation = useCallback((toolId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(toolId);
      return next;
    });
    setRecommendations((prev) => prev.filter((r) => r.toolId !== toolId));
  }, []);

  /**
   * 清除所有推荐
   */
  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  /**
   * 重置已忽略的推荐
   */
  const resetDismissed = useCallback(() => {
    setDismissed(new Set());
    localStorage.removeItem(DISMISSED_KEY);
  }, []);

  /**
   * 移除单个推荐
   */
  const removeRecommendation = useCallback((toolId: string) => {
    setRecommendations((prev) => prev.filter((r) => r.toolId !== toolId));
  }, []);

  return {
    recommendations,
    analyzeContent,
    dismissRecommendation,
    clearRecommendations,
    resetDismissed,
    removeRecommendation,
  };
}
