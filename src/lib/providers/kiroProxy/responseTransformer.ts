/**
 * Response Transformer - 响应格式转换
 */

import type { ChatResponse, ContentBlock, ToolCall, ParseResult } from './types';

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return 'msg_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * 将解析结果转换为 Anthropic 响应格式
 */
function toAnthropicResponse(
  parseResult: ParseResult,
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0
): ChatResponse {
  const content: ContentBlock[] = [];
  
  // 添加文本内容
  if (parseResult.text) {
    content.push({ type: 'text', text: parseResult.text });
  }
  
  // 添加工具调用
  for (const toolCall of parseResult.toolCalls) {
    content.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    });
  }
  
  // 如果没有内容，添加空文本
  if (content.length === 0) {
    content.push({ type: 'text', text: '' });
  }
  
  return {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: parseResult.hasToolCall ? 'tool_use' : 'end_turn',
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/**
 * 将纯文本转换为 Anthropic 响应格式
 */
function textToAnthropicResponse(
  text: string,
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0
): ChatResponse {
  return {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/**
 * 将工具调用转换为 Anthropic 响应格式
 */
function toolCallsToAnthropicResponse(
  toolCalls: ToolCall[],
  text: string = '',
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0
): ChatResponse {
  const content: ContentBlock[] = [];
  
  if (text) {
    content.push({ type: 'text', text });
  }
  
  for (const toolCall of toolCalls) {
    content.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    });
  }
  
  return {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: 'tool_use',
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/**
 * 创建错误响应
 */
function errorResponse(
  error: string,
  model: string
): ChatResponse {
  return {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: `Error: ${error}` }],
    model,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

export const responseTransformer = {
  toAnthropicResponse,
  textToAnthropicResponse,
  toolCallsToAnthropicResponse,
  errorResponse,
  generateMessageId,
};
