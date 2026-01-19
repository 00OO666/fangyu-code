/**
 * Output Parser - 解析模型输出中的工具调用
 */

import type { ToolCall, ParseResult } from './types';
import { v4 as uuidv4 } from 'uuid';

// 生成唯一 ID (不依赖 uuid 库)
function generateId(): string {
  return 'toolu_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 检测输出是否包含工具调用
 */
function hasToolCall(output: string): boolean {
  return /<tool_call>/i.test(output);
}

/**
 * 从 XML 中提取标签内容
 */
function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * 解析 input 标签中的参数
 */
function parseInputParams(inputXml: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  
  // 匹配所有 <param>value</param> 格式
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match;
  
  while ((match = paramRegex.exec(inputXml)) !== null) {
    const [, key, value] = match;
    // 尝试解析 JSON，否则保持字符串
    try {
      params[key] = JSON.parse(value.trim());
    } catch {
      params[key] = value.trim();
    }
  }
  
  return params;
}

/**
 * 解析单个 tool_call 块
 */
function parseToolCallBlock(block: string): ToolCall | null {
  const name = extractTagContent(block, 'name');
  const inputXml = extractTagContent(block, 'input');
  
  if (!name) {
    return null;
  }
  
  const input = inputXml ? parseInputParams(inputXml) : {};
  
  return {
    id: generateId(),
    name,
    input,
  };
}

/**
 * 解析模型输出
 */
function parse(output: string): ParseResult {
  const toolCalls: ToolCall[] = [];
  let text = output;
  
  // 匹配所有 tool_call 块
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let match;
  
  while ((match = toolCallRegex.exec(output)) !== null) {
    const toolCall = parseToolCallBlock(match[1]);
    if (toolCall) {
      toolCalls.push(toolCall);
    }
    // 从文本中移除 tool_call 块
    text = text.replace(match[0], '');
  }
  
  // 清理文本
  text = text.trim();
  
  return {
    text,
    toolCalls,
    hasToolCall: toolCalls.length > 0,
  };
}

/**
 * 从解析结果中提取纯文本
 */
function extractText(output: string): string {
  return parse(output).text;
}

export const outputParser = {
  parse,
  hasToolCall,
  extractText,
  parseToolCallBlock,
  parseInputParams,
};
