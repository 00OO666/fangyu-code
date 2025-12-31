/**
 * usePromptSuggestion Hook
 *
 * 基于 Claude SDK 生成智能 Prompt 建议
 * 类似 Claude Code 2.0.67 的 Prompt Suggestions 功能
 *
 * 特性：
 * - 使用 Haiku 模型快速生成建议（低成本、低延迟）
 * - 防抖处理避免频繁调用
 * - 缓存机制减少重复请求
 * - 支持取消请求
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { claudeSDK } from '@/lib/claudeSDK';
import { extractTextFromContent } from '@/lib/sessionHelpers';
import type { ClaudeStreamMessage } from '@/types/claude';

// ============================================================================
// Types
// ============================================================================

export interface PromptSuggestion {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  source: 'ai' | 'template' | 'history';
}

export interface UsePromptSuggestionOptions {
  messages: ClaudeStreamMessage[];
  currentPrompt: string;
  enabled: boolean;
  debounceMs?: number;
  model?: string;
  maxCacheSize?: number;
  cacheExpiryMs?: number;
}

export interface UsePromptSuggestionReturn {
  suggestion: PromptSuggestion | null;
  isLoading: boolean;
  error: string | null;
  acceptSuggestion: () => string | null;
  dismissSuggestion: () => void;
  clearCache: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_CACHE_EXPIRY_MS = 120000; // 2 minutes
const DEFAULT_MAX_CACHE_SIZE = 50;

// System prompt for suggestion generation
const SUGGESTION_SYSTEM_PROMPT = `你是一个智能编程助手，根据对话历史预测用户下一步可能的编程操作。

核心规则：
1. 只返回一个简短的建议（5-30字）
2. 建议必须是具体的编程操作或技术指令
3. 建议应该与当前任务上下文紧密相关
4. 如果无法预测或上下文不明确，返回空字符串
5. 不要返回任何解释、前缀或格式标记
6. 使用与用户相同的语言
7. 禁止建议"感谢"、"好的"等无意义的客套话

上下文理解：
- [工具调用] 表示助手执行了某个操作
- [工具结果] 表示操作的返回结果
- [工具错误] 表示操作失败
- [执行结果] 表示命令行输出

编程场景建议：
- 代码修改后：运行测试、构建项目、提交代码、检查类型错误
- 工具调用成功后：验证结果、继续下一步、检查副作用
- 工具调用失败后：修复错误、查看日志、尝试替代方案
- 代码解释后：应用到项目中、修改相关代码、查看示例
- 功能完成后：编写测试、添加文档、重构优化、提交更改
- 调试过程中：添加日志、设置断点、检查变量值

直接输出建议文本，不要加引号或其他标记。`;

// Template-based suggestions for common scenarios
const TEMPLATE_SUGGESTIONS: Record<string, string[]> = {
  afterCodeChange: [
    '运行测试验证更改',
    '提交这些更改',
    '检查是否有其他需要修改的地方',
  ],
  afterError: [
    '修复这个错误',
    '解释这个错误的原因',
    '查看相关日志',
  ],
  afterCompletion: [
    '还有什么需要完成的吗',
    '总结一下刚才的更改',
    '运行完整测试套件',
  ],
  afterQuestion: [
    '请详细解释',
    '给个代码示例',
    '应用到当前项目',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 从消息内容中提取丰富的上下文信息
 * 包括：文本内容、工具调用、工具结果等
 */
function extractRichContext(content: any[] | undefined): string {
  if (!content || !Array.isArray(content)) return '';

  const parts: string[] = [];

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      // 文本内容（不截断）
      parts.push(block.text);
    } else if (block.type === 'tool_use') {
      // 工具调用：包含工具名和输入摘要
      const toolName = block.name || 'unknown_tool';
      const inputStr = typeof block.input === 'object'
        ? JSON.stringify(block.input).slice(0, 200)
        : String(block.input || '').slice(0, 200);
      parts.push(`[调用工具: ${toolName}] ${inputStr}`);
    } else if (block.type === 'tool_result') {
      // 工具结果：包含错误状态
      const isError = block.is_error === true;
      const resultContent = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content || '').slice(0, 300);
      parts.push(isError
        ? `[工具错误] ${resultContent}`
        : `[工具结果] ${resultContent.slice(0, 200)}`);
    }
  }

  return parts.join('\n');
}

/**
 * 从消息数组中提取完整的会话上下文
 * 对齐 Claude Code CLI 的上下文读取能力
 */
function extractFullSessionContext(messages: ClaudeStreamMessage[]): string {
  // 获取最近 6 条有意义的消息（增加数量以获取更多上下文）
  const meaningfulMessages = messages.filter(msg => {
    if (msg.type === 'system' && msg.subtype === 'init') return false;
    if (!msg.message?.content?.length && !msg.result) return false;
    return true;
  }).slice(-6);

  const contextParts: string[] = [];

  for (const msg of meaningfulMessages) {
    if (msg.type === 'user' && msg.message) {
      const text = extractRichContext(msg.message.content) || extractTextFromContent(msg.message.content);
      if (text) {
        contextParts.push(`[用户] ${text.slice(0, 500)}`);
      }
    } else if (msg.type === 'assistant' && msg.message) {
      const text = extractRichContext(msg.message.content) || extractTextFromContent(msg.message.content);
      if (text) {
        // 助手消息可能较长，适当截断但保留关键信息
        contextParts.push(`[助手] ${text.slice(0, 800)}`);
      }
    } else if (msg.type === 'result' && msg.result) {
      // 执行结果：包含命令输出等
      const resultText = msg.result.slice(0, 400);
      contextParts.push(`[执行结果] ${resultText}`);
    }
  }

  return contextParts.join('\n\n');
}

/**
 * 生成缓存 key
 */
function generateCacheKey(messages: ClaudeStreamMessage[], prompt: string): string {
  const lastMessages = messages.slice(-3);
  const contextHash = lastMessages
    .map(m => {
      const content = extractTextFromContent(m.message?.content);
      return `${m.type}:${content.slice(0, 50)}`;
    })
    .join('|');
  return `${contextHash}_${prompt.slice(0, 30)}`;
}

/**
 * 检测场景类型
 */
function detectScenario(messages: ClaudeStreamMessage[]): string | null {
  if (messages.length === 0) return null;

  const lastMessage = messages[messages.length - 1];
  const content = extractTextFromContent(lastMessage.message?.content).toLowerCase();

  // 检测错误场景
  if (content.includes('error') || content.includes('错误') || content.includes('failed') || content.includes('失败')) {
    return 'afterError';
  }

  // 检测完成场景
  if (content.includes('完成') || content.includes('done') || content.includes('已') || content.includes('成功')) {
    return 'afterCompletion';
  }

  // 检测代码修改场景
  if (content.includes('修改') || content.includes('更新') || content.includes('edited') || content.includes('modified')) {
    return 'afterCodeChange';
  }

  // 检测问题场景
  if (content.endsWith('?') || content.endsWith('？') || content.includes('是否') || content.includes('要不要')) {
    return 'afterQuestion';
  }

  return null;
}

/**
 * 获取模板建议
 */
function getTemplateSuggestion(scenario: string): PromptSuggestion | null {
  const templates = TEMPLATE_SUGGESTIONS[scenario];
  if (!templates || templates.length === 0) return null;

  // 随机选择一个模板
  const text = templates[Math.floor(Math.random() * templates.length)];
  return {
    text,
    confidence: 'medium',
    timestamp: Date.now(),
    source: 'template',
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePromptSuggestion({
  messages,
  currentPrompt,
  enabled,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  model = DEFAULT_MODEL,
  maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
  cacheExpiryMs = DEFAULT_CACHE_EXPIRY_MS,
}: UsePromptSuggestionOptions): UsePromptSuggestionReturn {
  // State
  const [suggestion, setSuggestion] = useState<PromptSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, PromptSuggestion>>(new Map());
  const lastRequestIdRef = useRef<number>(0);

  // Memoized values
  const cacheKey = useMemo(
    () => generateCacheKey(messages, currentPrompt),
    [messages, currentPrompt]
  );

  /**
   * 清理过期缓存
   */
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;

    // 删除过期项
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > cacheExpiryMs) {
        cache.delete(key);
      }
    }

    // 如果缓存过大，删除最旧的项
    if (cache.size > maxCacheSize) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, cache.size - maxCacheSize);
      toDelete.forEach(([key]) => cache.delete(key));
    }
  }, [cacheExpiryMs, maxCacheSize]);

  /**
   * 清空缓存
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  /**
   * 生成 AI 建议
   */
  const generateAISuggestion = useCallback(async (requestId: number): Promise<PromptSuggestion | null> => {
    try {
      // 🆕 使用增强的上下文提取（对齐 CLI 功能）
      const contextStr = extractFullSessionContext(messages);

      if (!contextStr.trim()) {
        return null;
      }

      const userMessage = currentPrompt.trim()
        ? `当前用户正在输入：「${currentPrompt}」\n\n完整对话历史（包含工具调用和执行结果）：\n${contextStr}\n\n请预测用户完整的输入内容：`
        : `完整对话历史（包含工具调用和执行结果）：\n${contextStr}\n\n请预测用户下一句可能的输入：`;

      const response = await claudeSDK.sendMessage(
        [{ role: 'user', content: userMessage }],
        {
          model,
          maxTokens: 60,
          temperature: 0.3,
          systemPrompt: SUGGESTION_SYSTEM_PROMPT,
        }
      );

      // 检查请求是否已被取消
      if (requestId !== lastRequestIdRef.current) {
        return null;
      }

      const suggestionText = response.content.trim();

      // 验证建议
      if (!suggestionText || suggestionText.length < 2 || suggestionText.length > 100) {
        return null;
      }

      // 如果用户已有输入，确保建议是有意义的补全
      if (currentPrompt.trim() && suggestionText === currentPrompt.trim()) {
        return null;
      }

      return {
        text: suggestionText,
        confidence: 'high',
        timestamp: Date.now(),
        source: 'ai',
      };
    } catch (err) {
      // 忽略取消错误
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      console.error('[usePromptSuggestion] AI generation failed:', err);
      throw err;
    }
  }, [messages, currentPrompt, model]);

  /**
   * 主要的建议生成逻辑
   */
  const generateSuggestion = useCallback(async () => {
    // 检查是否启用
    if (!enabled) {
      setSuggestion(null);
      return;
    }

    // 检查是否有足够的上下文
    if (messages.length === 0) {
      setSuggestion(null);
      return;
    }

    // 如果用户输入太长，不显示建议
    if (currentPrompt.length > 50) {
      setSuggestion(null);
      return;
    }

    // 清理缓存
    cleanupCache();

    // 检查缓存
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheExpiryMs) {
      setSuggestion(cached);
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 生成新的请求 ID
    const requestId = ++lastRequestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      // 首先尝试模板建议（快速）
      const scenario = detectScenario(messages);
      if (scenario && !currentPrompt.trim()) {
        const templateSuggestion = getTemplateSuggestion(scenario);
        if (templateSuggestion) {
          // 缓存模板建议
          cacheRef.current.set(cacheKey, templateSuggestion);
          setSuggestion(templateSuggestion);
          setIsLoading(false);
          return;
        }
      }

      // 调用 AI 生成建议
      const aiSuggestion = await generateAISuggestion(requestId);

      // 再次检查请求是否仍然有效
      if (requestId !== lastRequestIdRef.current) {
        return;
      }

      if (aiSuggestion) {
        // 缓存 AI 建议
        cacheRef.current.set(cacheKey, aiSuggestion);
        setSuggestion(aiSuggestion);
      } else {
        setSuggestion(null);
      }
    } catch (err) {
      if (requestId === lastRequestIdRef.current) {
        setError((err as Error).message);
        setSuggestion(null);
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, messages, currentPrompt, cacheKey, cleanupCache, cacheExpiryMs, generateAISuggestion]);

  /**
   * 防抖触发建议生成
   */
  useEffect(() => {
    const timer = setTimeout(generateSuggestion, debounceMs);
    return () => clearTimeout(timer);
  }, [generateSuggestion, debounceMs]);

  /**
   * 当用户输入变化时，立即清除当前建议
   */
  useEffect(() => {
    // 如果用户正在输入，暂时隐藏建议
    if (currentPrompt.length > 0) {
      // 检查建议是否以用户输入开头
      if (suggestion && !suggestion.text.toLowerCase().startsWith(currentPrompt.toLowerCase())) {
        setSuggestion(null);
      }
    }
  }, [currentPrompt, suggestion]);

  /**
   * 接受建议
   */
  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      const accepted = suggestion.text;
      setSuggestion(null);
      return accepted;
    }
    return null;
  }, [suggestion]);

  /**
   * 忽略建议
   */
  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
    // 增加请求 ID 以取消正在进行的请求
    lastRequestIdRef.current++;
  }, []);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestion,
    isLoading,
    error,
    acceptSuggestion,
    dismissSuggestion,
    clearCache,
  };
}

export default usePromptSuggestion;
