/**
 * 智能标签页标题 Hook
 *
 * 根据对话内容自动生成有意义的标签页标题
 *
 * v2.0 更新：类似 ChatGPT 的 AI 标题生成
 * - 第一轮对话完成后，使用 Haiku 模型生成简短标题
 * - 如果 AI 调用失败，回退到正则匹配方案
 * - 支持手动编辑锁定（用户编辑后不再自动更新）
 * - 防抖机制避免频繁调用
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef } from "react";
import { claudeSDK } from "@/lib/claudeSDK";
import type { ClaudeStreamMessage } from "@/types/claude";

// ============================================================================
// Types
// ============================================================================

interface UseSmartTabTitleOptions {
  /** 消息列表 */
  messages: ClaudeStreamMessage[];
  /** 初始标题（通常是项目名） */
  initialTitle: string;
  /** 标题更新回调 */
  onTitleUpdate: (title: string) => void;
  /** 是否启用自动命名（默认 true） */
  enabled?: boolean;
  /** 是否使用 AI 生成标题（默认 true） */
  useAI?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** AI 标题生成使用的模型 */
const TITLE_GEN_MODEL = "claude-haiku-4-5-20251001";

/** AI 标题生成的 System Prompt */
const TITLE_GEN_SYSTEM_PROMPT = `你是一个会话标题生成器。根据用户的第一条消息和 AI 的回复，生成一个简短、准确的会话标题。

核心规则：
1. 标题必须简短：中文 3-10 个字，英文 2-6 个单词
2. 标题应该概括对话的核心主题或目的
3. 优先使用动词开头（如：修复、优化、创建、实现）
4. 如果涉及具体文件或功能，可以包含在标题中
5. 不要使用标点符号（除非是文件名中的点）
6. 不要加引号、前缀或解释
7. 使用与用户消息相同的语言

示例输入输出：
- "帮我修复登录页面的bug" → "修复登录页面bug"
- "我想添加一个暗色模式切换功能" → "添加暗色模式"
- "Can you help me create a React component for user profile?" → "Create user profile component"
- "优化这个函数的性能" → "优化函数性能"
- "解释一下 useEffect 的用法" → "useEffect 用法"

直接输出标题，不要任何其他内容。`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 从用户消息中提取文本内容
 */
function extractUserMessageText(message: ClaudeStreamMessage): string {
  if (message.type !== "user") return "";

  const content = message.message?.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text || "")
      .join("\n");
  }

  return "";
}

/**
 * 从 AI 消息中提取文本内容（简化版，只取前 200 字）
 */
function extractAssistantMessageText(message: ClaudeStreamMessage): string {
  if (message.type !== "assistant") return "";

  const content = message.message?.content as string | any[] | undefined;
  if (typeof content === "string") return content.slice(0, 200);

  if (Array.isArray(content)) {
    const text = content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text || "")
      .join("\n");
    return text.slice(0, 200);
  }

  return "";
}

/**
 * 清理文本：移除特殊字符、换行、多余空格
 */
function cleanText(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[<>{}[\]]/g, "")
    .trim();
}

/**
 * 使用 AI 生成标题（ChatGPT 风格）
 */
async function generateTitleWithAI(
  userMessage: string,
  assistantMessage: string,
): Promise<string | null> {
  try {
    // 构建用于生成标题的对话上下文
    const contextMessage = `用户消息：${userMessage.slice(0, 500)}

AI 回复摘要：${assistantMessage.slice(0, 200)}`;

    const response = await claudeSDK.sendMessage([{ role: "user", content: contextMessage }], {
      model: TITLE_GEN_MODEL,
      maxTokens: 50,
      temperature: 0.3,
      systemPrompt: TITLE_GEN_SYSTEM_PROMPT,
    });

    if (response?.content) {
      // 清理 AI 返回的标题
      let title = response.content.trim();

      // 移除可能的引号
      title = title.replace(/^["'「『]|["'」』]$/g, "");

      // 移除可能的前缀
      title = title.replace(/^(标题：|Title:\s*)/i, "");

      // 确保标题不过长
      if (title.length > 25) {
        title = title.slice(0, 22) + "...";
      }

      return title || null;
    }

    return null;
  } catch (error) {
    logger.warn('useSmartTabTitle', "[useSmartTabTitle] AI title generation failed:", error);
    return null;
  }
}

/**
 * 快速命名：智能提取核心主题（回退方案）
 */
function generateQuickTitle(
  messages: ClaudeStreamMessage[],
  maxLength: number = 25,
): string | null {
  const userMessage = messages.find((m) => m.type === "user");
  if (!userMessage) return null;

  const text = extractUserMessageText(userMessage);
  if (!text) return null;

  const cleaned = cleanText(text);

  // 移除常见问句前缀和冗余词（多次应用直到稳定）
  let result = cleaned;
  const prefixPatterns = [
    /^(请|帮我|帮忙|能不能|可以|可否|怎么|如何|为什么|测试一下|试试|你现在|根据|能否|是否)\s*/,
    /^(我想|我要|我需要|给我|告诉我|看看|检查一下)\s*/,
    /^(please|help me|can you|could you|how to|why|test|i want to|i need)\s*/i,
  ];

  for (let i = 0; i < 3; i++) {
    for (const pattern of prefixPatterns) {
      result = result.replace(pattern, "").trim();
    }
  }

  // 提取第一句话或第一个短语
  const firstPart = result.split(/[。？！，,?!：:]/)[0].trim();
  const final = firstPart || result;

  // 按字符截断，支持中文
  const chars = [...final];
  if (chars.length > maxLength) {
    return chars.slice(0, maxLength).join("") + "...";
  }

  return final;
}

/**
 * 智能命名：提取关键词组合（回退方案）
 */
function generateSmartTitle(messages: ClaudeStreamMessage[]): string | null {
  // 收集所有用户消息
  const userMessages = messages.filter((m) => m.type === "user");
  if (userMessages.length === 0) return null;

  // 只取最近 3 条用户消息，避免第一条粘贴的历史摘要干扰
  const recentUserMessages = userMessages.slice(-3);

  // 合并最近用户消息的文本
  const allText = recentUserMessages.map((m) => extractUserMessageText(m)).join(" ");

  if (!allText) return null;

  const cleaned = cleanText(allText).toLowerCase();

  // 关键词模式（优先级从高到低）
  const patterns = [
    // 常见动作词
    { pattern: /创建\s*([^\s、，。]+)/g, prefix: "创建" },
    { pattern: /修复\s*([^\s、，。]+)/g, prefix: "修复" },
    { pattern: /添加\s*([^\s、，。]+)/g, prefix: "添加" },
    { pattern: /实现\s*([^\s、，。]+)/g, prefix: "实现" },
    { pattern: /优化\s*([^\s、，。]+)/g, prefix: "优化" },
    { pattern: /删除\s*([^\s、，。]+)/g, prefix: "删除" },

    // 英文动作词
    { pattern: /create\s+([^\s,.]+)/gi, prefix: "Create" },
    { pattern: /fix\s+([^\s,.]+)/gi, prefix: "Fix" },
    { pattern: /add\s+([^\s,.]+)/gi, prefix: "Add" },
    { pattern: /implement\s+([^\s,.]+)/gi, prefix: "Implement" },
    { pattern: /optimize\s+([^\s,.]+)/gi, prefix: "Optimize" },
    { pattern: /delete\s+([^\s,.]+)/gi, prefix: "Delete" },
  ];

  // 尝试匹配动作词
  for (const { pattern, prefix } of patterns) {
    const matches = cleaned.match(pattern);
    if (matches && matches.length > 0) {
      // 提取关键词（第一个匹配）
      const keywordMatch = matches[0];
      const keyword = keywordMatch
        .replace(/^(create|fix|add|implement|optimize|delete)\s+/i, "")
        .replace(/^(创建|修复|添加|实现|优化|删除)\s*/, "")
        .substring(0, 20)
        .trim();

      if (keyword) {
        return `${prefix} ${keyword}`;
      }
    }
  }

  // 如果没有找到动作词，尝试提取文件名或函数名
  const fileMatches = cleaned.match(/[\w-]+\.(ts|tsx|js|jsx|py|php|java|go|rs|rb|vue|jsx?)/i);
  if (fileMatches) {
    return fileMatches[0];
  }

  // 最后的备选：取第一条消息的前 20 字
  return generateQuickTitle(messages, 20);
}

/**
 * 计算用户轮数（不包括系统消息和 AI 回复）
 */
function countUserRounds(messages: ClaudeStreamMessage[]): number {
  return messages.filter((m) => m.type === "user").length;
}

/**
 * 检查是否有 AI 回复
 */
function hasAssistantReply(messages: ClaudeStreamMessage[]): boolean {
  return messages.some((m) => m.type === "assistant");
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * 智能标签页标题 Hook
 *
 * v2.0：支持 AI 生成标题
 */
export function useSmartTabTitle({
  messages,
  initialTitle,
  onTitleUpdate,
  enabled = true,
  useAI = true,
}: UseSmartTabTitleOptions) {
  const lastAppliedTitleRef = useRef<string>(initialTitle);
  const userRoundsRef = useRef<number>(0);
  const isGeneratingRef = useRef<boolean>(false);
  const aiAttemptedRef = useRef<boolean>(false);

  // 🔧 FIX: 使用 useRef 存储回调，避免 useEffect 重新执行导致无限循环
  const onTitleUpdateRef = useRef(onTitleUpdate);
  useEffect(() => {
    onTitleUpdateRef.current = onTitleUpdate;
  }, [onTitleUpdate]);

  // AI 标题生成函数
  const generateTitle = useCallback(async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    try {
      const userMessage = messages.find((m) => m.type === "user");
      const assistantMessage = messages.find((m) => m.type === "assistant");

      if (!userMessage || !assistantMessage) {
        isGeneratingRef.current = false;
        return;
      }

      const userText = extractUserMessageText(userMessage);
      const assistantText = extractAssistantMessageText(assistantMessage);

      let title: string | null = null;

      // 尝试使用 AI 生成标题
      if (useAI && !aiAttemptedRef.current) {
        aiAttemptedRef.current = true;
        logger.debug('useSmartTabTitle', "[useSmartTabTitle] Attempting AI title generation...");
        title = await generateTitleWithAI(userText, assistantText);

        if (title) {
          logger.debug('useSmartTabTitle', "[useSmartTabTitle] AI generated title:", title);
        }
      }

      // 如果 AI 失败，使用回退方案
      if (!title) {
        logger.debug('useSmartTabTitle', "[useSmartTabTitle] Falling back to regex-based title generation");
        title = generateSmartTitle(messages);
      }

      if (title && title !== lastAppliedTitleRef.current) {
        onTitleUpdateRef.current(title);
        lastAppliedTitleRef.current = title;
      }
    } catch (error) {
      logger.error('useSmartTabTitle', "[useSmartTabTitle] Title generation error:", error);
    } finally {
      isGeneratingRef.current = false;
    }
  }, [messages, useAI]); // 🔧 FIX: 移除 onTitleUpdate 依赖

  useEffect(() => {
    if (!enabled) return;

    const currentUserRounds = countUserRounds(messages);
    const hasReply = hasAssistantReply(messages);

    // 阶段 1：第一轮对话完成后生成标题（ChatGPT 风格）
    if (currentUserRounds === 1 && hasReply && userRoundsRef.current !== 1) {
      userRoundsRef.current = 1;

      // 延迟 500ms 再生成标题，确保 AI 回复已经稳定
      setTimeout(() => {
        generateTitle();
      }, 500);
    }

    // 阶段 2：3 轮对话时重新生成标题（使用回退方案）
    if (currentUserRounds >= 3 && userRoundsRef.current < 3) {
      userRoundsRef.current = 3;

      const smartTitle = generateSmartTitle(messages);
      if (smartTitle && smartTitle !== lastAppliedTitleRef.current) {
        logger.debug('useSmartTabTitle', "[useSmartTabTitle] Phase 2 - Keyword-based title:", smartTitle);
        // 🔧 FIX: 使用 setTimeout 避免在渲染期间调用 setState
        setTimeout(() => {
          onTitleUpdateRef.current(smartTitle);
          lastAppliedTitleRef.current = smartTitle;
        }, 0);
      }
    }

    // 更新轮数参考
    userRoundsRef.current = Math.max(userRoundsRef.current, currentUserRounds);
  }, [messages, enabled, generateTitle]); // 🔧 FIX: 移除 onTitleUpdate 依赖
}

/**
 * 验证标题是否被手动修改（相对于自动生成的标题）
 */
export function isTitleManuallyEdited(title: string, originalTitle: string): boolean {
  // 如果标题等于原始标题，说明没有被修改
  if (title === originalTitle) return false;

  // 如果标题不像自动生成的（不包含 "..." 或常见动作词），可能是手动编辑的
  const autoPatterns = [
    /\.\.\.$/, // 以 ... 结尾
    /^(create|fix|add|implement|optimize|delete)\s+/i,
    /^(创建|修复|添加|实现|优化|删除)\s*/,
  ];

  const looksAutoGenerated = autoPatterns.some((p) => p.test(title));
  return !looksAutoGenerated;
}
