/**
 * useChatHistorySaver - 自动保存聊天消息到历史数据库
 *
 * 功能:
 * - 自动在消息发送/接收时保存到 SQLite
 * - 支持批量保存
 * - 包含 token 使用统计
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

export interface SaveMessageOptions {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokensInput?: number;
  tokensOutput?: number;
  model?: string;
  projectPath?: string;
}

export function useChatHistorySaver() {
  /**
   * 保存单条消息
   */
  const saveMessage = useCallback(async (options: SaveMessageOptions): Promise<number> => {
    try {
      const messageId = await invoke<number>("save_chat_message", {
        sessionId: options.sessionId,
        role: options.role,
        content: options.content,
        tokensInput: options.tokensInput || 0,
        tokensOutput: options.tokensOutput || 0,
        model: options.model,
        projectPath: options.projectPath,
      });

      return messageId;
    } catch (error) {
      logger.error("useChatHistorySaver", "Failed to save chat message:", error);
      throw error;
    }
  }, []);

  /**
   * 批量保存多条消息（用于导入历史记录）
   */
  const saveMessages = useCallback(
    async (messages: SaveMessageOptions[]): Promise<void> => {
      try {
        await Promise.all(messages.map((msg) => saveMessage(msg)));
      } catch (error) {
        logger.error("useChatHistorySaver", "Failed to save multiple messages:", error);
        throw error;
      }
    },
    [saveMessage]
  );

  /**
   * 更新会话标题
   */
  const updateSessionTitle = useCallback(
    async (sessionId: string, title: string): Promise<void> => {
      try {
        await invoke("update_session_title", {
          sessionId,
          title,
        });
      } catch (error) {
        logger.error("useChatHistorySaver", "Failed to update session title:", error);
        throw error;
      }
    },
    []
  );

  return {
    saveMessage,
    saveMessages,
    updateSessionTitle,
  };
}
