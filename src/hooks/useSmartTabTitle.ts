/**
 * 智能标签页标题 Hook
 *
 * 根据对话内容自动生成有意义的标签页标题
 * 策略：
 * - 🔧 优化：等 AI 回复后再命名（避免首条消息被截断用作标题的问题）
 * - 第一轮对话完成：快速命名（用户消息前 20 字 + 确保有 AI 回复）
 * - 3 轮对话：智能命名（提取关键词）
 * - 支持手动编辑
 */

import { useEffect, useRef } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface UseSmartTabTitleOptions {
  /** 消息列表 */
  messages: ClaudeStreamMessage[];
  /** 初始标题（通常是项目名） */
  initialTitle: string;
  /** 标题更新回调 */
  onTitleUpdate: (title: string) => void;
  /** 是否启用自动命名（默认 true） */
  enabled?: boolean;
}

/**
 * 从用户消息中提取文本内容
 */
function extractUserMessageText(message: ClaudeStreamMessage): string {
  if (message.type !== 'user') return '';

  const content = message.message?.content;
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text || '')
      .join('\n');
  }

  return '';
}

/**
 * 清理文本：移除特殊字符、换行、多余空格
 */
function cleanText(text: string): string {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[<>{}[\]]/g, '')
    .trim();
}

/**
 * 快速命名：智能提取核心主题（ChatGPT 风格）
 */
function generateQuickTitle(messages: ClaudeStreamMessage[], maxLength: number = 25): string | null {
  const userMessage = messages.find(m => m.type === 'user');
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
      result = result.replace(pattern, '').trim();
    }
  }

  // 提取第一句话或第一个短语
  const firstPart = result.split(/[。？！，,?!：:]/)[0].trim();
  const final = firstPart || result;

  // 按字符截断，支持中文
  const chars = [...final];
  if (chars.length > maxLength) {
    return chars.slice(0, maxLength).join('') + '...';
  }

  return final;
}

/**
 * 智能命名：提取关键词组合
 *
 * 提取策略：
 * 1. 查找常见动作词：创建、修复、优化、添加、删除、实现等
 * 2. 提取技术关键词：文件名、函数名、组件名等
 * 3. 组合成简洁标题
 *
 * 🔧 优化：只分析最近 3 条用户消息，避免历史任务摘要干扰
 */
function generateSmartTitle(messages: ClaudeStreamMessage[]): string | null {
  // 收集所有用户消息
  const userMessages = messages.filter(m => m.type === 'user');
  if (userMessages.length === 0) return null;

  // 🔧 FIX: 只取最近 3 条用户消息，避免第一条粘贴的历史摘要干扰
  const recentUserMessages = userMessages.slice(-3);

  // 合并最近用户消息的文本
  const allText = recentUserMessages
    .map(m => extractUserMessageText(m))
    .join(' ');

  if (!allText) return null;

  const cleaned = cleanText(allText).toLowerCase();

  // 关键词模式（优先级从高到低）
  const patterns = [
    // 常见动作词
    { pattern: /创建\s*([^\s、，。]+)/g, prefix: '创建' },
    { pattern: /修复\s*([^\s、，。]+)/g, prefix: '修复' },
    { pattern: /添加\s*([^\s、，。]+)/g, prefix: '添加' },
    { pattern: /实现\s*([^\s、，。]+)/g, prefix: '实现' },
    { pattern: /优化\s*([^\s、，。]+)/g, prefix: '优化' },
    { pattern: /删除\s*([^\s、，。]+)/g, prefix: '删除' },

    // 英文动作词
    { pattern: /create\s+([^\s,\.]+)/gi, prefix: 'Create' },
    { pattern: /fix\s+([^\s,\.]+)/gi, prefix: 'Fix' },
    { pattern: /add\s+([^\s,\.]+)/gi, prefix: 'Add' },
    { pattern: /implement\s+([^\s,\.]+)/gi, prefix: 'Implement' },
    { pattern: /optimize\s+([^\s,\.]+)/gi, prefix: 'Optimize' },
    { pattern: /delete\s+([^\s,\.]+)/gi, prefix: 'Delete' },
  ];

  // 尝试匹配动作词
  for (const { pattern, prefix } of patterns) {
    const matches = cleaned.match(pattern);
    if (matches && matches.length > 0) {
      // 提取关键词（第一个匹配）
      const keywordMatch = matches[0];
      const keyword = keywordMatch
        .replace(/^(create|fix|add|implement|optimize|delete)\s+/i, '')
        .replace(/^(创建|修复|添加|实现|优化|删除)\s*/, '')
        .substring(0, 20)
        .trim();

      if (keyword) {
        return `${prefix} ${keyword}`;
      }
    }
  }

  // 如果没有找到动作词，尝试提取文件名或函数名
  // 文件名模式：xxx.ts, xxx.tsx, xxx.js 等
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
  return messages.filter(m => m.type === 'user').length;
}

/**
 * 🔧 检查是否有 AI 回复
 * 确保在生成标题前，AI 已经回复过
 */
function hasAssistantReply(messages: ClaudeStreamMessage[]): boolean {
  return messages.some(m => m.type === 'assistant');
}

/**
 * 智能标签页标题 Hook
 */
export function useSmartTabTitle({
  messages,
  initialTitle,
  onTitleUpdate,
  enabled = true,
}: UseSmartTabTitleOptions) {
  const lastAppliedTitleRef = useRef<string>(initialTitle);
  const userRoundsRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const currentUserRounds = countUserRounds(messages);
    const hasReply = hasAssistantReply(messages);

    // 🔧 优化：阶段 1 - 等 AI 回复后立即智能命名（ChatGPT 风格）
    // 第一轮对话后就提取关键词，不再使用简单截断
    if (currentUserRounds === 1 && hasReply && userRoundsRef.current !== 1) {
      userRoundsRef.current = 1;

      const smartTitle = generateSmartTitle(messages);
      if (smartTitle && smartTitle !== lastAppliedTitleRef.current) {
        console.log('[useSmartTabTitle] Phase 1 - Smart naming (ChatGPT style):', smartTitle);
        onTitleUpdate(smartTitle);
        lastAppliedTitleRef.current = smartTitle;
      }
    }

    // 阶段 2：3 轮对话时智能命名
    if (currentUserRounds >= 3 && userRoundsRef.current < 3) {
      userRoundsRef.current = 3;

      const smartTitle = generateSmartTitle(messages);
      if (smartTitle && smartTitle !== lastAppliedTitleRef.current) {
        console.log('[useSmartTabTitle] Phase 2 - Smart naming:', smartTitle);
        onTitleUpdate(smartTitle);
        lastAppliedTitleRef.current = smartTitle;
      }
    }

    // 更新轮数参考
    userRoundsRef.current = Math.max(userRoundsRef.current, currentUserRounds);
  }, [messages, enabled, onTitleUpdate]);
}

/**
 * 验证标题是否被手动修改（相对于自动生成的标题）
 */
export function isTitleManuallyEdited(title: string, originalTitle: string): boolean {
  // 如果标题等于原始标题，说明没有被修改
  if (title === originalTitle) return false;

  // 如果标题不像自动生成的（不包含 "..." 或常见动作词），可能是手动编辑的
  const autoPatterns = [
    /\.\.\.$/,  // 以 ... 结尾
    /^(create|fix|add|implement|optimize|delete)\s+/i,
    /^(创建|修复|添加|实现|优化|删除)\s*/,
  ];

  const looksAutoGenerated = autoPatterns.some(p => p.test(title));
  return !looksAutoGenerated;
}
