/**
 * 消息内容提取工具库
 *
 * 从 ClaudeCodeSession 提取（原分散在多处的内容提取逻辑）
 * 统一处理 Claude API 返回的多种消息格式
 */

import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * 内容来源标识符
 */
export type ContentSource =
  | 'direct_content'          // message.content (string)
  | 'array_content'           // message.content (array)
  | 'content_text'            // message.content.text
  | 'message_content_string'  // message.message.content (string)
  | 'message_content_array'   // message.message.content (array)
  | 'direct_text'             // message.text
  | 'result_field'            // message.result
  | 'error_field'             // message.error
  | 'summary_field';          // message.summary

/**
 * 内容提取结果
 */
export interface ExtractedContent {
  /** 提取的文本内容 */
  text: string;
  /** 内容来源列表（按优先级排序） */
  sources: ContentSource[];
  /** 是否成功提取到内容 */
  hasContent: boolean;
}

/**
 * 从 Claude 消息中提取文本内容
 *
 * 支持 8 种内容格式，按优先级依次尝试：
 * 1. message.content (string)
 * 2. message.content (array with text items)
 * 3. message.content.text
 * 4. message.message.content (string)
 * 5. message.message.content (array)
 * 6. message.text
 * 7. message.result
 * 8. message.error
 * 9. message.summary
 *
 * @param message - Claude 流式消息对象
 * @returns 提取的内容对象
 *
 * @example
 * const extracted = extractMessageContent(message);
 * if (extracted.hasContent) {
 *   console.log('Content:', extracted.text);
 *   console.log('Source:', extracted.sources[0]);
 * }
 */
export function extractMessageContent(message: ClaudeStreamMessage): ExtractedContent {
  let textContent = '';
  const contentSources: ContentSource[] = [];

  // Method 1: Direct content string
  if (typeof message.content === 'string' && message.content.trim()) {
    textContent = message.content;
    contentSources.push('direct_content');
  }

  // Method 2: Array content (Claude API format)
  if (!textContent && Array.isArray(message.content)) {
    const arrayContent = message.content
      .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text || '';
        return item.content || item.text || '';
      })
      .join('\n');
    if (arrayContent.trim()) {
      textContent = arrayContent;
      contentSources.push('array_content');
    }
  }

  // Method 3: Object with text property
  if (!textContent && message.content?.text && typeof message.content.text === 'string') {
    textContent = message.content.text;
    contentSources.push('content_text');
  }

  // Method 4: Nested in message.content (Claude Code SDK primary format)
  if (!textContent && message.message?.content) {
    const messageContent: any = message.message.content;
    if (typeof messageContent === 'string' && messageContent.trim()) {
      textContent = messageContent;
      contentSources.push('message_content_string');
    } else if (Array.isArray(messageContent)) {
      const nestedContent = messageContent
        .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text || '';
          return item.content || item.text || '';
        })
        .join('\n');
      if (nestedContent.trim()) {
        textContent = nestedContent;
        contentSources.push('message_content_array');
      }
    }
  }

  // Method 5: Direct text property
  if (!textContent && (message as any).text && typeof (message as any).text === 'string') {
    textContent = (message as any).text;
    contentSources.push('direct_text');
  }

  // Method 6: Result field (for result-type messages)
  if (!textContent && (message as any).result && typeof (message as any).result === 'string') {
    textContent = (message as any).result;
    contentSources.push('result_field');
  }

  // Method 7: Error field (for error messages)
  if (!textContent && (message as any).error && typeof (message as any).error === 'string') {
    textContent = (message as any).error;
    contentSources.push('error_field');
  }

  // Method 8: Summary field (for summary messages)
  if (!textContent && (message as any).summary && typeof (message as any).summary === 'string') {
    textContent = (message as any).summary;
    contentSources.push('summary_field');
  }

  return {
    text: textContent,
    sources: contentSources,
    hasContent: textContent.trim().length > 0
  };
}

/**
 * 判断消息是否为 Claude 响应消息
 *
 * @param message - 消息对象
 * @returns 是否为 Claude 响应
 */
export function isClaudeResponse(message: ClaudeStreamMessage): boolean {
  return (
    message.type === 'assistant' ||
    message.type === 'result' ||
    (message.type === 'system' && message.subtype !== 'init') ||
    // 任何有实际内容的消息都可能是 Claude 响应
    !!(
      message.content ||
      message.message?.content ||
      (message as any).text ||
      (message as any).result ||
      (message as any).summary ||
      (message as any).error
    )
  );
}

/**
 * 提取思考块内容
 *
 * @param message - Claude 消息对象
 * @returns 思考块文本，如果没有则返回空字符串
 */
export function extractThinkingContent(message: ClaudeStreamMessage): string {
  if (!message.message?.content) return '';

  const content = message.message.content;
  if (!Array.isArray(content)) return '';

  const thinkingBlocks = content.filter((item: any) => item.type === 'thinking');
  return thinkingBlocks.map((item: any) => item.thinking || '').join('\n\n');
}

/**
 * 检查消息是否包含思考块
 *
 * @param message - Claude 消息对象
 * @returns 是否包含思考块
 */
export function hasThinkingBlock(message: ClaudeStreamMessage): boolean {
  if (!message.message?.content) return false;
  const content = message.message.content;
  if (!Array.isArray(content)) return false;
  return content.some((item: any) => item.type === 'thinking');
}
