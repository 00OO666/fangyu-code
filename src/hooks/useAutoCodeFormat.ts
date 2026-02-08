/**
 * 自动代码格式化 Hook
 *
 * 当 AI 响应完成后，自动检测代码块并使用 Biome 格式化
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { codeFormatService } from "@/services/codeFormatService";
import { notify } from "@/services/notificationService";

interface FormatOptions {
  enabled?: boolean;
  autoFormat?: boolean;
  showNotification?: boolean;
}

interface CodeBlock {
  language: string;
  content: string;
  filePath?: string;
}

/**
 * 提取消息中的代码块
 */
function extractCodeBlocks(message: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(message)) !== null) {
    const language = match[1] || "text";
    const content = match[2];

    // 只处理 TypeScript/JavaScript 代码
    if (["typescript", "tsx", "javascript", "jsx", "ts", "js"].includes(language)) {
      codeBlocks.push({ language, content });
    }
  }

  return codeBlocks;
}

/**
 * 解析文件路径（从代码块注释中提取）
 */
function extractFilePath(content: string): string | null {
  // 匹配 // file: path 或 // @file path 格式
  const fileMatch = content.match(/^\/\/\s*(?:@?file:?\s*)([^\n]+)/im);
  if (fileMatch) {
    return fileMatch[1].trim();
  }

  // 匹配相对路径（src/xxx.tsx）
  const pathMatch = content.match(
    /^(?:src|components|hooks|lib|services|utils)[/\\][\w/\\.-]+\.(tsx?|jsx?)$/im
  );
  if (pathMatch) {
    return pathMatch[0];
  }

  return null;
}

/**
 * 自动代码格式化 Hook
 */
export function useAutoCodeFormat(
  messages: Array<{ role: string; content: string }>,
  isStreaming: boolean,
  projectPath: string | undefined,
  options: FormatOptions = {}
) {
  const { enabled = true, autoFormat = true, showNotification = true } = options;

  const lastProcessedRef = useRef<number>(0);
  const formatTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // 检查是否启用自动格式化
    if (!enabled || !autoFormat || !projectPath) {
      return;
    }

    // 流式输出中不处理
    if (isStreaming) {
      return;
    }

    // 检查是否���新消息
    const messageCount = messages.length;
    if (messageCount <= lastProcessedRef.current) {
      return;
    }

    // 只处理最新的 AI 消息
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.role !== "assistant") {
      return;
    }

    // 延迟执行，避免频繁格式化
    if (formatTimeoutRef.current) {
      clearTimeout(formatTimeoutRef.current);
    }

    formatTimeoutRef.current = setTimeout(async () => {
      const codeBlocks = extractCodeBlocks(latestMessage.content);

      if (codeBlocks.length === 0) {
        lastProcessedRef.current = messageCount;
        return;
      }

      // 处理每个代码块
      for (const block of codeBlocks) {
        const filePath =
          extractFilePath(block.content) ||
          `src/temp.${block.language === "typescript" ? "ts" : "js"}`;
        const fullPath = `${projectPath}/${filePath}`;

        try {
          // 调用 Biome 格式化
          const formatted = await invoke<string>("run_biome_format", {
            filePath: fullPath,
            content: block.content,
          });

          // 检查是否有变化
          if (formatted !== block.content) {
            // 分析改动
            const changes = analyzeChanges(block.content, formatted);
            const summary = codeFormatService.generateSummary(changes, filePath);

            // 保存到历史
            codeFormatService.addFormatRecord({
              filePath: fullPath,
              changes,
              summary,
              undoAvailable: false, // 临时代码块不支持撤销
            });

            // 显示通知
            if (showNotification) {
              notify.success(summary, {
                description: "点击查看详情",
                duration: 5000,
                position: "chat",
                action: {
                  label: "查看",
                  onClick: () => {
                    // 触发打开格式化历史弹窗
                    window.dispatchEvent(new CustomEvent("open-format-history"));
                  },
                },
              });
            }
          }
        } catch (error) {
          // 静默失败，不影响用户体验
          logger.debug("useAutoCodeFormat", "[AutoCodeFormat] Format failed:", error);
        }
      }

      lastProcessedRef.current = messageCount;
    }, 1000); // 延迟 1 秒

    return () => {
      if (formatTimeoutRef.current) {
        clearTimeout(formatTimeoutRef.current);
      }
    };
  }, [messages, isStreaming, projectPath, enabled, autoFormat, showNotification]);
}

/**
 * 分析代码变化
 */
function analyzeChanges(
  original: string,
  formatted: string
): Array<{
  line?: number;
  type: "indent" | "quote" | "semicolon" | "lineending" | "spacing" | "trailing-comma" | "other";
  description: string;
  before?: string;
  after?: string;
}> {
  const changes: Array<{
    line?: number;
    type: "indent" | "quote" | "semicolon" | "lineending" | "spacing" | "trailing-comma" | "other";
    description: string;
    before?: string;
    after?: string;
  }> = [];

  // 检查引号变化
  if (original.includes("'") && formatted.includes('"')) {
    changes.push({
      type: "quote",
      description: "统一使用双引号",
    });
  }

  // 检查分号
  const originalSemicolons = (original.match(/;/g) || []).length;
  const formattedSemicolons = (formatted.match(/;/g) || []).length;
  if (formattedSemicolons > originalSemicolons) {
    changes.push({
      type: "semicolon",
      description: `添加 ${formattedSemicolons - originalSemicolons} 个分号`,
    });
  }

  // 检查换行符
  if (original.includes("\r\n") && !formatted.includes("\r\n")) {
    changes.push({ type: "lineending", description: "CRLF 转换为 LF" });
  }

  // 检查尾随逗号
  const originalTrailing =
    (original.match(/,\s*\]/g) || []).length + (original.match(/,\s*\}/g) || []).length;
  const formattedTrailing =
    (formatted.match(/,\s*\]/g) || []).length + (formatted.match(/,\s*\}/g) || []).length;
  if (formattedTrailing > originalTrailing) {
    changes.push({
      type: "trailing-comma",
      description: `添加 ${formattedTrailing - originalTrailing} 个尾随逗号`,
    });
  }

  // 如果没有检测到具体变化但内容确实变了
  if (changes.length === 0 && original !== formatted) {
    changes.push({ type: "indent", description: "调整缩进（2 空格）" });
  }

  return changes;
}
