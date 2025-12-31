/**
 * 自动提取聊天消息中的代码
 * 支持：
 * 1. Markdown 代码块 (```language\ncode```)
 * 2. 工具调用中的代码 (Write/Edit 工具)
 */

import { useState, useEffect } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface ExtractedCode {
  code: string;
  language: string;
  hasNewCode: boolean;  // 标记是否检测到新代码
  source: 'markdown' | 'tool_use';  // 代码来源
}

export const useCanvasExtractor = (messages: ClaudeStreamMessage[]): ExtractedCode | null => {
  const [extractedCode, setExtractedCode] = useState<ExtractedCode | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;

    // 获取最后一条 assistant 消息
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(m => m.type === 'assistant');

    if (!lastAssistantMessage) return;

    const messageId = lastAssistantMessage.id || String(messages.length);
    const hasNewCode = messageId !== lastMessageId;

    const messageContent = lastAssistantMessage.message?.content;
    if (!messageContent) return;

    // 1️⃣ 先尝试提取工具调用中的代码（优先级最高）
    if (Array.isArray(messageContent)) {
      for (const item of messageContent) {
        if (item.type === 'tool_use') {
          const toolName = item.name;
          const input = item.input;

          // Write 工具 - 直接获取文件内容
          if (toolName === 'Write' && input?.content) {
            const language = detectLanguageFromPath(input.file_path || '');
            if (isPreviewableLanguage(language)) {
              setExtractedCode({
                code: input.content,
                language,
                hasNewCode,
                source: 'tool_use',
              });
              setLastMessageId(messageId);
              return;
            }
          }

          // Edit 工具 - 使用 new_string
          if (toolName === 'Edit' && input?.new_string) {
            const language = detectLanguageFromPath(input.file_path || '');
            if (isPreviewableLanguage(language)) {
              setExtractedCode({
                code: input.new_string,
                language,
                hasNewCode,
                source: 'tool_use',
              });
              setLastMessageId(messageId);
              return;
            }
          }
        }
      }
    }

    // 2️⃣ 提取 Markdown 代码块
    let content = '';
    if (typeof messageContent === 'string') {
      content = messageContent;
    } else if (Array.isArray(messageContent)) {
      content = messageContent
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text || '')
        .join('\n');
    }

    if (!content) return;

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];

    if (matches.length === 0) return;

    // 优先提取可预览的语言
    const priorityLanguages = ['html', 'jsx', 'tsx', 'javascript', 'typescript', 'markdown', 'md', 'svg'];
    let bestMatch = matches[0];

    for (const match of matches) {
      const lang = match[1]?.toLowerCase() || 'text';
      if (priorityLanguages.includes(lang)) {
        bestMatch = match;
        break;
      }
    }

    const language = bestMatch[1]?.toLowerCase() || 'javascript';
    const code = bestMatch[2].trim();

    setExtractedCode({
      code,
      language,
      hasNewCode,
      source: 'markdown',
    });
    setLastMessageId(messageId);
  }, [messages, lastMessageId]);

  return extractedCode;
};

// 从文件路径检测语言
function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'jsx': 'jsx',
    'tsx': 'tsx',
    'js': 'javascript',
    'ts': 'typescript',
    'md': 'markdown',
    'svg': 'svg',
  };
  return extMap[ext] || 'text';
}

// 判断语言是否可预览
function isPreviewableLanguage(language: string): boolean {
  const previewable = ['html', 'htm', 'jsx', 'tsx', 'javascript', 'typescript', 'markdown', 'md', 'svg'];
  return previewable.includes(language);
}

export default useCanvasExtractor;
