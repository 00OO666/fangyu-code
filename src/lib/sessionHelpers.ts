/**
 * Session Helper Functions
 *
 * Utility functions for ClaudeCodeSession component
 * - Project path selection
 * - Output copying (JSONL, Markdown)
 * - Conversation context extraction
 * - Preview state management
 *
 * All functions are pure or have minimal side effects for better testability
 */

import { open } from "@tauri-apps/plugin-dialog";
import type { ClaudeStreamMessage } from '@/types/claude';
import { copyTextToClipboard } from '@/lib/clipboard';
import { loadContextConfig, type PromptContextConfig } from './promptContextConfig';


// ============================================================================
// Type Definitions
// ============================================================================

export interface PreviewState {
  showPreview: boolean;
  showPreviewPrompt: boolean;
  previewUrl: string;
  isPreviewMaximized: boolean;
  splitPosition: number;
}

/**
 * Message content part - can be text, tool_use, tool_result, etc.
 */
export interface MessageContentPart {
  type: string;
  text?: string | { text: string };
  [key: string]: any;
}

/**
 * Message content - can be a string or an array of content parts
 */
export type MessageContent = string | MessageContentPart[] | null | undefined;

// ============================================================================
// Project Path Selection
// ============================================================================

/**
 * Opens a file dialog to select a project directory
 * @returns Selected path or null if cancelled
 */
export async function selectProjectPath(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择项目目录"
    });

    return selected as string | null;
  } catch (err) {
    console.error("Failed to select directory:", err);
    throw new Error(`Failed to select directory: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================================
// Output Copying Functions
// ============================================================================

/**
 * Copies JSONL output to clipboard
 * @param rawJsonlOutput Array of JSONL strings
 */
export async function copyAsJsonl(rawJsonlOutput: string[]): Promise<void> {
  const jsonl = rawJsonlOutput.join('\n');
  await copyTextToClipboard(jsonl);
}

/**
 * Generates and copies Markdown formatted conversation to clipboard
 * @param messages Array of Claude stream messages
 * @param projectPath Current project path
 */
export async function copyAsMarkdown(
  messages: ClaudeStreamMessage[],
  projectPath: string
): Promise<void> {
  let markdown = `# Claude 代码会话\n\n`;
  markdown += `**Project:** ${projectPath}\n`;
  markdown += `**Date:** ${new Date().toISOString()}\n\n`;
  markdown += `---\n\n`;

  for (const msg of messages) {
    if (msg.type === "system" && msg.subtype === "init") {
      markdown += `## System Initialization\n\n`;
      markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
      markdown += `- Model: \`${msg.model || 'default'}\`\n`;
      if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
      if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
      markdown += `\n`;
    } else if (msg.type === "assistant" && msg.message) {
      markdown += `## Assistant\n\n`;
      for (const content of msg.message.content || []) {
        if (content.type === "text") {
          const textContent = typeof content.text === 'string'
            ? content.text
            : (content.text?.text || JSON.stringify(content.text || content));
          markdown += `${textContent}\n\n`;
        } else if (content.type === "tool_use") {
          markdown += `### Tool: ${content.name}\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
        }
      }
      if (msg.message.usage) {
        const { input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens } = msg.message.usage;
        let tokenText = `*Tokens: ${input_tokens} in, ${output_tokens} out`;
        if (cache_creation_tokens && cache_creation_tokens > 0) {
          tokenText += `, creation: ${cache_creation_tokens}`;
        }
        if (cache_read_tokens && cache_read_tokens > 0) {
          tokenText += `, read: ${cache_read_tokens}`;
        }
        markdown += tokenText + `*\n\n`;
      }
    } else if (msg.type === "user" && msg.message) {
      markdown += `## User\n\n`;
      for (const content of msg.message.content || []) {
        if (content.type === "text") {
          const textContent = typeof content.text === 'string'
            ? content.text
            : (content.text?.text || JSON.stringify(content.text));
          markdown += `${textContent}\n\n`;
        } else if (content.type === "tool_result") {
          markdown += `### Tool Result\n\n`;
          let contentText = '';
          if (typeof content.content === 'string') {
            contentText = content.content;
          } else if (content.content && typeof content.content === 'object') {
            if (content.content.text) {
              contentText = content.content.text;
            } else if (Array.isArray(content.content)) {
              contentText = content.content
                .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                .join('\n');
            } else {
              contentText = JSON.stringify(content.content, null, 2);
            }
          }
          markdown += `\`\`\`\n${contentText}\n\`\`\`\n\n`;
        }
      }
    } else if (msg.type === "result") {
      markdown += `## Execution Result\n\n`;
      if (msg.result) {
        markdown += `${msg.result}\n\n`;
      }
      if (msg.error) {
        markdown += `**Error:** ${msg.error}\n\n`;
      }
    }
  }

  await copyTextToClipboard(markdown);
}

// ============================================================================
// Conversation Context Extraction
// ============================================================================

/**
 * Extracts text content from message content (string or array format)
 *
 * @param content - Message content (can be string, array of parts, null, or undefined)
 * @returns Extracted text as a string (empty string if no text found)
 *
 * @example
 * // String content
 * extractTextFromContent("Hello world") // => "Hello world"
 *
 * // Array content
 * extractTextFromContent([
 *   { type: "text", text: "Hello" },
 *   { type: "text", text: "World" }
 * ]) // => "Hello\nWorld"
 *
 * // Edge cases
 * extractTextFromContent(null) // => ""
 * extractTextFromContent(undefined) // => ""
 */
export function extractTextFromContent(content: MessageContent): string {
  // Handle null or undefined
  if (content == null) {
    return "";
  }

  // Handle string content
  if (typeof content === 'string') {
    return content;
  }

  // Handle array content
  if (Array.isArray(content)) {
    return content
      .filter((part: MessageContentPart) => part.type === "text")
      .map((part: MessageContentPart) => {
        // Handle nested text structure
        if (typeof part.text === 'string') {
          return part.text;
        }
        if (part.text && typeof part.text === 'object' && 'text' in part.text) {
          return part.text.text;
        }
        return '';
      })
      .filter(Boolean) // Remove empty strings
      .join("\n");
  }

  // Fallback for unexpected types
  return "";
}

/**
 * Extracts conversation context from recent messages for prompt enhancement
 * @param messages Array of Claude stream messages
 * @param customConfig Optional custom configuration (if not provided, loads from localStorage)
 * @returns Array of context strings
 */
export function getConversationContext(
  messages: ClaudeStreamMessage[],
  customConfig?: Partial<PromptContextConfig>
): string[] {
  // Load config from localStorage and merge with custom config
  const config = {
    ...loadContextConfig(),
    ...customConfig,
  };

  const contextMessages: string[] = [];

  // Filter out system init messages and get meaningful content
  const meaningfulMessages = messages.filter(msg => {
    // Skip system init messages
    if (msg.type === "system" && msg.subtype === "init") return false;
    // Skip empty messages
    if (!msg.message?.content?.length && !msg.result) return false;
    return true;
  });

  // Get the last N messages based on config
  const recentMessages = meaningfulMessages.slice(-config.maxMessages);

  for (const msg of recentMessages) {
    let contextLine = "";

    if (msg.type === "user" && msg.message) {
      // Extract user message text using helper function
      const userText = extractTextFromContent(msg.message.content);

      if (userText) {
        // Truncate based on config
        const truncated = userText.length > config.maxUserMessageLength
          ? userText.substring(0, config.maxUserMessageLength) + "..."
          : userText;
        contextLine = `用户: ${truncated}`;
      }
    } else if (msg.type === "assistant" && msg.message) {
      // Extract assistant message text using helper function
      const assistantText = extractTextFromContent(msg.message.content);

      if (assistantText) {
        // Truncate based on config
        const truncated = assistantText.length > config.maxAssistantMessageLength
          ? assistantText.substring(0, config.maxAssistantMessageLength) + "..."
          : assistantText;
        contextLine = `助手: ${truncated}`;
      }
    } else if (msg.type === "result" && msg.result && config.includeExecutionResults) {
      // Include execution results if enabled in config
      const resultText = msg.result;
      const truncated = resultText.length > config.maxExecutionResultLength
        ? resultText.substring(0, config.maxExecutionResultLength) + "..."
        : resultText;
      contextLine = `执行结果: ${truncated}`;
    }

    if (contextLine) {
      contextMessages.push(contextLine);
    }
  }

  return contextMessages;
}

// ============================================================================
// Preview State Management
// ============================================================================

/**
 * Handles link detection and shows preview prompt
 * @param url Detected URL
 * @param currentState Current preview state
 * @returns Updated preview state
 */
export function handleLinkDetected(url: string, currentState: PreviewState): PreviewState {
  if (!currentState.showPreview && !currentState.showPreviewPrompt) {
    return {
      ...currentState,
      previewUrl: url,
      showPreviewPrompt: true
    };
  }
  return currentState;
}

/**
 * Closes the preview window
 * @param currentState Current preview state
 * @returns Updated preview state
 */
export function handleClosePreview(currentState: PreviewState): PreviewState {
  return {
    ...currentState,
    showPreview: false,
    isPreviewMaximized: false
    // Keep previewUrl so it can be restored when reopening
  };
}

/**
 * Updates the preview URL
 * @param url New URL
 * @param currentState Current preview state
 * @returns Updated preview state
 */
export function handlePreviewUrlChange(url: string, currentState: PreviewState): PreviewState {
  return {
    ...currentState,
    previewUrl: url
  };
}

/**
 * Toggles preview maximize state
 * @param currentState Current preview state
 * @returns Updated preview state
 */
export function handleTogglePreviewMaximize(currentState: PreviewState): PreviewState {
  const newMaximized = !currentState.isPreviewMaximized;
  return {
    ...currentState,
    isPreviewMaximized: newMaximized,
    // Reset split position when toggling maximize
    splitPosition: newMaximized ? currentState.splitPosition : 50
  };
}
