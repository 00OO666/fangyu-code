/**
 * useSmartRecommendation - 智能推荐系统 v2
 *
 * 改进点：
 * 1. 检测已启用的 MCP，避免重复推荐
 * 2. 基于对话上下文预测需求，而非简单关键词匹配
 * 3. 支持 MCP / Skill / Agent / Tool 多种类型
 * 4. 更智能的置信度计算
 */

import { logger } from "@/lib/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type RecommendationType = "mcp" | "skill" | "agent" | "tool";

export interface SmartRecommendation {
  id: string;
  name: string;
  type: RecommendationType;
  reason: string;
  confidence: number;
  /** 触发的上下文片段 */
  contextSnippet?: string;
  /** 快捷操作 */
  action?: {
    label: string;
    handler: () => Promise<void>;
  };
}

interface RecommendationRule {
  id: string;
  name: string;
  type: RecommendationType;
  /** 触发条件：关键词组（任一组匹配即触发） */
  triggerGroups: string[][];
  /** 排除条件：如果包含这些词则不触发 */
  excludeKeywords?: string[];
  /** 上下文模式：需要满足的对话模式 */
  contextPatterns?: RegExp[];
  /** 推荐理由模板 */
  reasonTemplate: string;
  /** 基础权重 */
  baseWeight: number;
  /** MCP 服务器 ID（用于检测是否已启用） */
  mcpServerId?: string;
  /** 引擎类型 */
  engine?: "claude" | "codex" | "gemini";
}

// 推荐规则配置
const RECOMMENDATION_RULES: RecommendationRule[] = [
  // === MCP 工具 ===
  {
    id: "mcp:github",
    name: "GitHub MCP",
    type: "mcp",
    triggerGroups: [
      ["github", "repo"],
      ["pull request", "pr"],
      ["issue", "bug report"],
      ["fork", "仓库"],
      ["commit", "push"],
    ],
    excludeKeywords: ["github.com/"], // 如果只是提到链接，不推荐
    reasonTemplate: "检测到 GitHub 操作需求",
    baseWeight: 0.9,
    mcpServerId: "github",
    engine: "claude",
  },
  {
    id: "mcp:fetch",
    name: "Fetch MCP",
    type: "mcp",
    triggerGroups: [
      ["fetch", "api"],
      ["http请求", "request"],
      ["获取网页", "scrape"],
      ["调用接口", "endpoint"],
    ],
    contextPatterns: [/请.*(?:获取|抓取|请求).*(?:网页|api|接口)/i],
    reasonTemplate: "检测到 HTTP 请求需求",
    baseWeight: 0.85,
    mcpServerId: "fetch",
    engine: "claude",
  },
  {
    id: "mcp:puppeteer",
    name: "Puppeteer MCP",
    type: "mcp",
    triggerGroups: [
      ["截图", "screenshot"],
      ["浏览器自动化", "browser automation"],
      ["爬虫", "crawler"],
      ["页面交互", "click"],
    ],
    reasonTemplate: "检测到浏览器自动化需求",
    baseWeight: 0.9,
    mcpServerId: "puppeteer",
    engine: "claude",
  },
  {
    id: "mcp:context7",
    name: "Context7 文档",
    type: "mcp",
    triggerGroups: [
      ["查文档", "documentation"],
      ["最新版本", "latest version"],
      ["api用法", "how to use"],
    ],
    contextPatterns: [/(?:react|vue|node|typescript).*(?:文档|用法|api)/i],
    reasonTemplate: "检测到技术文档查询需求",
    baseWeight: 0.7,
    mcpServerId: "context7",
    engine: "claude",
  },
  {
    id: "mcp:memory",
    name: "Memory MCP",
    type: "mcp",
    triggerGroups: [
      ["记住", "remember"],
      ["下次还要", "持久化"],
      ["跨会话", "cross session"],
    ],
    reasonTemplate: "检测到持久化记忆需求",
    baseWeight: 0.8,
    mcpServerId: "memory",
    engine: "claude",
  },

  // === Skills ===
  {
    id: "skill:smart-debug",
    name: "智能调试",
    type: "skill",
    triggerGroups: [
      ["调试", "debug"],
      ["报错", "error"],
      ["502", "500"],
      ["不工作", "not working"],
    ],
    reasonTemplate: "检测到调试需求，可使用智能调试 Skill",
    baseWeight: 0.75,
  },
  {
    id: "skill:task-planner",
    name: "任务规划",
    type: "skill",
    triggerGroups: [
      ["任务规划", "task plan"],
      ["帮我拆解", "break down"],
      ["分步骤", "step by step"],
    ],
    reasonTemplate: "检测到复杂任务，可使用任务规划 Skill",
    baseWeight: 0.7,
  },
  {
    id: "skill:ui-ux-master",
    name: "UI/UX 设计",
    type: "skill",
    triggerGroups: [
      ["美化", "beautify"],
      ["ui设计", "ui design"],
      ["响应式", "responsive"],
      ["样式", "style"],
    ],
    reasonTemplate: "检测到 UI 设计需求",
    baseWeight: 0.7,
  },

  // === Agents ===
  {
    id: "agent:code-review",
    name: "代码审查",
    type: "agent",
    triggerGroups: [
      ["代码审查", "code review"],
      ["检查代码", "review code"],
      ["质量检查", "quality check"],
    ],
    reasonTemplate: "检测到代码审查需求",
    baseWeight: 0.8,
  },
];

// 存储 key
const DISMISSED_KEY = "fangyu-smart-rec-dismissed";
const SNOOZED_KEY = "fangyu-smart-rec-snoozed";
const SNOOZE_DURATION = 30 * 60 * 1000; // 30 分钟

function loadSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

interface SnoozedItem {
  id: string;
  until: number;
}

function loadSnoozed(): Map<string, number> {
  try {
    const stored = localStorage.getItem(SNOOZED_KEY);
    if (!stored) return new Map();
    const items: SnoozedItem[] = JSON.parse(stored);
    const now = Date.now();
    // 过滤掉已过期的
    return new Map(items.filter((i) => i.until > now).map((i) => [i.id, i.until]));
  } catch {
    return new Map();
  }
}

function saveSnoozed(map: Map<string, number>): void {
  try {
    const items: SnoozedItem[] = [...map.entries()].map(([id, until]) => ({ id, until }));
    localStorage.setItem(SNOOZED_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function useSmartRecommendation() {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadSet(DISMISSED_KEY));
  const [snoozed, setSnoozed] = useState<Map<string, number>>(loadSnoozed());
  const [enabledMCPs, setEnabledMCPs] = useState<Set<string>>(new Set());

  const lastAnalyzedRef = useRef<string>("");
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 🔧 FIX: 使用 useRef 存储状态，避免 analyze 函数重新创建导致无限循环
  const dismissedRef = useRef(dismissed);
  const snoozedRef = useRef(snoozed);
  const enabledMCPsRef = useRef(enabledMCPs);

  // 保持 ref 与 state 同步
  useEffect(() => {
    dismissedRef.current = dismissed;
  }, [dismissed]);

  useEffect(() => {
    snoozedRef.current = snoozed;
  }, [snoozed]);

  useEffect(() => {
    enabledMCPsRef.current = enabledMCPs;
  }, [enabledMCPs]);

  // 同步到 localStorage
  useEffect(() => {
    saveSet(DISMISSED_KEY, dismissed);
  }, [dismissed]);

  useEffect(() => {
    saveSnoozed(snoozed);
  }, [snoozed]);

  // 获取已启用的 MCP 列表
  const refreshEnabledMCPs = useCallback(async () => {
    try {
      const engines: Array<"claude" | "codex" | "gemini"> = ["claude", "codex", "gemini"];
      const enabled = new Set<string>();

      for (const engine of engines) {
        try {
          const servers = await api.mcpGetEngineServersWithStatus(engine);
          for (const server of servers) {
            if (server.enabled) {
              enabled.add(`${engine}:${server.id}`);
              // 也添加 spec.command 作为备用匹配
              if (server.spec?.command) {
                enabled.add(`${engine}:${server.spec.command}`);
              }
            }
          }
        } catch {
          // 忽略单个引擎的错误
        }
      }

      setEnabledMCPs(enabled);
    } catch (error) {
      logger.warn(
        "useSmartRecommendation",
        "[SmartRecommendation] Failed to refresh enabled MCPs:",
        error
      );
    }
  }, []);

  // 初始化时获取已启用的 MCP
  useEffect(() => {
    refreshEnabledMCPs();
    // 每 30 秒刷新一次
    const interval = setInterval(refreshEnabledMCPs, 30000);
    return () => clearInterval(interval);
  }, [refreshEnabledMCPs]);

  /**
   * 分析内容并生成推荐
   */
  const analyze = useCallback((content: string) => {
    // 防抖：500ms 内只分析一次
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current);
    }

    analyzeTimeoutRef.current = setTimeout(() => {
      if (!content || content === lastAnalyzedRef.current) return;
      lastAnalyzedRef.current = content;

      const lowerContent = content.toLowerCase();
      const now = Date.now();
      const newRecs: SmartRecommendation[] = [];

      // 🔧 FIX: 使用 ref 获取最新状态，避免依赖数组变化导致函数重新创建
      const currentDismissed = dismissedRef.current;
      const currentSnoozed = snoozedRef.current;
      const currentEnabledMCPs = enabledMCPsRef.current;

      for (const rule of RECOMMENDATION_RULES) {
        // 1. 检查是否已永久忽略
        if (currentDismissed.has(rule.id)) continue;

        // 2. 检查是否在暂停期
        const snoozeUntil = currentSnoozed.get(rule.id);
        if (snoozeUntil && snoozeUntil > now) continue;

        // 3. 检查 MCP 是否已启用
        if (rule.type === "mcp" && rule.mcpServerId && rule.engine) {
          const mcpKey = `${rule.engine}:${rule.mcpServerId}`;
          if (currentEnabledMCPs.has(mcpKey)) continue;
        }

        // 4. 检查排除关键词
        if (rule.excludeKeywords?.some((kw) => lowerContent.includes(kw.toLowerCase()))) {
          continue;
        }

        // 5. 检查触发条件
        let matchedGroup: string[] | null = null;
        let matchCount = 0;

        for (const group of rule.triggerGroups) {
          const matches = group.filter((kw) => lowerContent.includes(kw.toLowerCase()));
          if (matches.length > matchCount) {
            matchCount = matches.length;
            matchedGroup = matches;
          }
        }

        // 6. 检查上下文模式
        let patternMatch = false;
        if (rule.contextPatterns) {
          patternMatch = rule.contextPatterns.some((p) => p.test(content));
        }

        // 7. 计算置信度
        if (matchedGroup || patternMatch) {
          const keywordScore = matchedGroup ? matchedGroup.length * 0.3 : 0;
          const patternScore = patternMatch ? 0.4 : 0;
          const confidence = Math.min((keywordScore + patternScore) * rule.baseWeight, 1.0);

          if (confidence >= 0.25) {
            newRecs.push({
              id: rule.id,
              name: rule.name,
              type: rule.type,
              reason: rule.reasonTemplate,
              confidence,
              contextSnippet: matchedGroup?.join(", "),
            });
          }
        }
      }

      // 按置信度排序，最多显示 2 个
      const topRecs = newRecs.sort((a, b) => b.confidence - a.confidence).slice(0, 2);

      setRecommendations(topRecs);
    }, 500);
  }, []); // 🔧 FIX: 移除依赖，使用 ref 获取最新状态

  /**
   * 永久忽略某个推荐
   */
  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /**
   * 暂时忽略（30 分钟后再提醒）
   */
  const snooze = useCallback((id: string) => {
    setSnoozed((prev) => {
      const next = new Map(prev);
      next.set(id, Date.now() + SNOOZE_DURATION);
      return next;
    });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /**
   * 清除当前所有推荐
   */
  const clearAll = useCallback(() => {
    setRecommendations([]);
  }, []);

  /**
   * 重置所有忽略设置
   */
  const resetAll = useCallback(() => {
    setDismissed(new Set());
    setSnoozed(new Map());
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(SNOOZED_KEY);
  }, []);

  /**
   * 手动刷新 MCP 状态
   */
  const refresh = useCallback(() => {
    refreshEnabledMCPs();
  }, [refreshEnabledMCPs]);

  return {
    recommendations,
    analyze,
    dismiss,
    snooze,
    clearAll,
    resetAll,
    refresh,
    enabledMCPs,
  };
}
