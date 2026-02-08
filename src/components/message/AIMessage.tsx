import React from "react";
import { ClaudeIcon } from "@/components/icons/ClaudeIcon";
import { CodexIcon } from "@/components/icons/CodexIcon";
import { GeminiIcon } from "@/components/icons/GeminiIcon";
import { MessageBubble } from "./MessageBubble";
import { MessageContent } from "./MessageContent";
import { ToolCallsGroup } from "./ToolCallsGroup";
import { ThinkingBlock } from "./ThinkingBlock";
import { MessageActions } from "./MessageActions";
import { cn } from "@/lib/utils";
import { tokenExtractor } from "@/lib/tokenExtractor";
import { formatTimestamp } from "@/lib/messageUtils";
import type { ClaudeStreamMessage } from '@/types/claude';
import { useSession } from "@/contexts/SessionContext";
import { useStreamingBuffer } from "@/hooks/useStreamingBuffer";
import { useTranslation } from "@/hooks/useTranslation";

interface AIMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 链接检测回调 */
  onLinkDetected?: (url: string) => void;
}

/**
 * 提取AI消息的文本内容
 *
 * ✅ FIX: 移除文本中的 <thinking> 标签内容，避免重复显示
 *
 * 🔧 FIX v2.3: 优化正则表达式性能
 * - 预编译正则表达式，避免每次调用都重新编译
 * - 使用更高效的字符串处理方式
 */
const THINKING_TAG_REGEX = /<thinking>[\s\S]*?<\/thinking>/g;

const extractAIText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';

  const content = message.message.content as string | unknown[];

  // 如果是字符串，移除 thinking 标签后返回
  if (typeof content === 'string') {
    return content.replace(THINKING_TAG_REGEX, '').trim();
  }

  // 如果是数组，提取所有text类型的内容并移除 thinking 标签
  if (Array.isArray(content)) {
    const text = content
      .filter((item: unknown) => (item as { type?: string }).type === 'text')
      .map((item: unknown) => (item as { text?: string }).text || '')
      .join('\n\n');

    return text.replace(THINKING_TAG_REGEX, '').trim();
  }

  return '';
};

/**
 * 检测消息中是否有工具调用
 *
 * 注意：只检查 tool_use，不检查 tool_result
 * tool_result 是工具执行的结果，通常通过 ToolCallsGroup 根据 tool_use 匹配显示
 * Codex 的 function_call_output 事件会生成仅包含 tool_result 的消息，
 * 这些消息不应该触发工具卡片渲染（避免空白消息卡片）
 */
const hasToolCalls = (message: ClaudeStreamMessage): boolean => {
  if (!message.message?.content) return false;

  const content = message.message.content;
  if (!Array.isArray(content)) return false;

  return content.some((item: any) => item.type === 'tool_use');
};

/**
 * 检测消息中是否有思考块
 *
 * 支持三种格式：
 * 1. 顶层 thinking 消息（message.type === 'thinking'）- Codex reasoning
 * 2. 独立的 thinking 块（content item.type === 'thinking'）- Claude native
 * 3. 文本中的 <thinking> 标签（Claude Code CLI 格式）
 */
const hasThinkingBlock = (message: ClaudeStreamMessage): boolean => {
  // 检查顶层 thinking 消息
  if (message.type === 'thinking') return true;

  if (!message.message?.content) return false;

  const content = message.message.content;
  if (!Array.isArray(content)) return false;

  // 检查是否有独立的 thinking 块
  const hasThinkingType = content.some((item: any) => item.type === 'thinking');
  if (hasThinkingType) return true;

  // 检查文本中是否包含 <thinking> 标签
  const textContent = content
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text || '')
    .join('');

  return textContent.includes('<thinking>');
};

/**
 * 提取思考块内容
 *
 * 支持三种格式：
 * 1. 顶层 thinking 消息（message.type === 'thinking'）- Codex reasoning
 * 2. 独立的 thinking 块（content item.type === 'thinking'）- Claude native
 * 3. 文本中的 <thinking> 标签（Claude Code CLI 格式）
 *
 * ✅ FIX: 使用特殊的分隔符连接多个思考块，以便 ThinkingBlock 组件能够识别并渲染分割线
 *
 * 🔧 FIX v2.3: 优化正则表达式性能
 * - 预编译正则表达式
 * - 使用 matchAll 替代 while + exec 循环
 */
const THINKING_EXTRACT_REGEX = /<thinking>([\s\S]*?)<\/thinking>/g;

const extractThinkingContent = (message: ClaudeStreamMessage): string => {
  // 检查顶层 thinking 消息
  if (message.type === 'thinking') {
    return (message as any).content || '';
  }

  if (!message.message?.content) return '';

  const content = message.message.content;
  if (!Array.isArray(content)) return '';

  // 首先尝试提取独立的 thinking 块
  const thinkingBlocks = content.filter((item: any) => item.type === 'thinking');
  if (thinkingBlocks.length > 0) {
    // 支持多种字段名（thinking, text, content）
    return thinkingBlocks.map((item: any) => item.thinking || item.text || item.content || '').join('\n\n---divider---\n\n');
  }

  // 如果没有独立的 thinking 块，从文本中提取 <thinking> 标签内容
  const textContent = content
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text || '')
    .join('');

  // 🔧 优化：使用 matchAll 替代 while + exec 循环
  const matches = Array.from(textContent.matchAll(THINKING_EXTRACT_REGEX))
    .map(match => match[1].trim());

  return matches.join('\n\n---divider---\n\n');
};

/**
 * AI消息组件（重构版）
 * 左对齐卡片样式，支持工具调用展示和思考块
 *
 * 打字机效果逻辑：
 * - 统一依赖 isStreaming prop（只有在流式输出时才启用）
 * - isStreaming 由 SessionMessages 组件传入，表示当前是最后一条消息且会话正在进行
 * - 历史消息加载时 isStreaming=false，不会触发打字机效果
 */
const AIMessageComponent: React.FC<AIMessageProps> = ({
  message,
  isStreaming = false,
  className,
  onLinkDetected
}) => {
  // 🔧 FIX: 提取 messageId 用于 ThinkingBlock
  const messageId = (message as any).uuid || (message as any).id;

  const { t } = useTranslation();

  const text = extractAIText(message);
  const hasTools = hasToolCalls(message);
  const hasThinking = hasThinkingBlock(message);
  const rawThinkingContent = hasThinking ? extractThinkingContent(message) : '';

  // 🆕 从 SessionContext 获取 Thinking 状态管理函数
  const { getThinkingOpenState, onThinkingToggle } = useSession();

  // Detect engine type for avatar styling
  const isCodexMessage = (message as any).engine === 'codex';
  const isGeminiMessage = (message as any).geminiMetadata?.provider === 'gemini' || (message as any).engine === 'gemini';

  // 🆕 Placeholder for engines without visible thinking output
  const trimmedThinking = rawThinkingContent.trim();
  const shouldShowThinkingPlaceholder = trimmedThinking.length === 0 && (isCodexMessage || isGeminiMessage);
  const thinkingContent = trimmedThinking.length > 0
    ? rawThinkingContent
    : shouldShowThinkingPlaceholder
      ? t('thinking.unavailable', 'thinking 不可用')
      : '';
  const shouldRenderThinking = hasThinking || shouldShowThinkingPlaceholder;

  // 打字机效果只在流式输出时启用
  // isStreaming=true 表示：当前是最后一条消息 && 会话正在进行中
  const enableTypewriter = isStreaming;

  // 🔍 DEBUG: 暂时注释掉空消息过滤，看看是否有消息被误判
  // if (!text && !hasTools && !hasThinking) {
  //   logger.debug('AIMessage', '[AIMessage] ⚠️ Skipping empty message:', messageId);
  //   return null;
  // }

  // 🆕 使用缓冲 Hook 优化流式输出
  const bufferedText = useStreamingBuffer(text, {
    enabled: isStreaming,
    isStreaming: isStreaming,
    bufferSize: 5,   // 每 5 个字符更新一次
    maxDelay: 30     // 最多延迟 30ms
  });

  // 使用缓冲后的文本进行渲染，而不是原始文本
  const displayText = isStreaming ? bufferedText : text;

  // 提取 tokens 统计
  const tokenStats = message.message?.usage ? (() => {
    const extractedTokens = tokenExtractor.extract({
      type: 'assistant',
      message: { usage: message.message.usage }
    });
    const parts = [`${extractedTokens.input_tokens}/${extractedTokens.output_tokens}`];
    if (extractedTokens.cache_creation_tokens > 0) {
      parts.push(`创建${extractedTokens.cache_creation_tokens}`);
    }
    if (extractedTokens.cache_read_tokens > 0) {
      parts.push(`缓存${extractedTokens.cache_read_tokens}`);
    }
    return parts.join(' | ');
  })() : null;

  const assistantName = isGeminiMessage ? 'Gemini' : isCodexMessage ? 'Codex' : 'Claude';

  // Select icon based on engine
  const Icon = isGeminiMessage ? GeminiIcon : isCodexMessage ? CodexIcon : ClaudeIcon;

  // 构建 tooltip 内容
  const formattedTime = formatTimestamp((message as any).receivedAt ?? (message as any).timestamp);
  const tooltipParts: string[] = [];
  if (formattedTime) tooltipParts.push(formattedTime);
  if (tokenStats) tooltipParts.push(tokenStats);

  return (
    <div className={cn("relative group", className)}>
      <MessageBubble variant="assistant">
        {/* Header: Logo + Name + Time + Token Stats */}
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn(isGeminiMessage || isCodexMessage ? "w-4 h-4" : "w-5 h-5", "flex-shrink-0")} />
          <span className="font-semibold text-base">{assistantName}</span>
          {formattedTime && (
            <span className="text-xs text-muted-foreground">{formattedTime}</span>
          )}
          {tokenStats && (
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">{tokenStats}</span>
          )}
        </div>

        {/* Actions Toolbar - Visible on Hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <MessageActions content={displayText || thinkingContent} />
        </div>

        {/* Content: All left-aligned, no left padding */}
        <div className="space-y-1">
          {/* Thinking Block - Compact */}
          {shouldRenderThinking && thinkingContent && (
            <ThinkingBlock
              content={thinkingContent}
              isStreaming={enableTypewriter && hasThinking && trimmedThinking.length > 0}
              autoCollapseDelay={2500}
              messageId={messageId}
              isOpen={getThinkingOpenState?.(messageId)}
              onToggle={(isOpen) => onThinkingToggle?.(messageId, isOpen)}
            />
          )}

          {/* Main Text Content - Compact */}
          {displayText && (
            <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-[1.5]">
              <MessageContent
                content={displayText}
                isStreaming={enableTypewriter && !hasTools && !hasThinking}
                enableTypewriter={enableTypewriter && !hasTools && !hasThinking}
              />
            </div>
          )}

          {/* Tool Calls */}
          {hasTools && (
            <ToolCallsGroup
              message={message}
              onLinkDetected={onLinkDetected}
            />
          )}
        </div>
      </MessageBubble>
    </div>
  );
};

// 使用 React.memo 优化性能，避免不必要的重渲染
export const AIMessage = React.memo(AIMessageComponent, (prevProps, nextProps) => {
  // 自定义比较函数：返回 true 表示 props 相同，不需要重新渲染
  // 返回 false 表示 props 不同，需要重新渲染
  const messageId = (prevProps.message as any).uuid || (prevProps.message as any).id;
  const nextMessageId = (nextProps.message as any).uuid || (nextProps.message as any).id;

  return (
    messageId === nextMessageId &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.className === nextProps.className &&
    prevProps.onLinkDetected === nextProps.onLinkDetected
  );
});
