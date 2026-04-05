/**
 * Kiro Engine Handler
 *
 * 处理 Kiro 引擎的执行逻辑
 * 从 usePromptExecution.ts 提取（行 2082-2215）
 */

import { logger } from '@/lib/logger';
import { getDefaultKiroEngine } from "@/services/kiro";
import type { UsePromptExecutionConfig } from "../types";

export interface KiroEngineContext {
  config: UsePromptExecutionConfig;
  prompt: string;
  model: string;
  maxThinkingTokens?: number;
}

/**
 * 执行 Kiro 引擎请求
 */
export async function executeKiroRequest(context: KiroEngineContext): Promise<void> {
  const { config, prompt, model } = context;
  const { projectPath, setMessages, setIsLoading, setError, setExtractedSessionInfo } = config;

  try {
    setIsLoading(true);

    const kiroEngine = getDefaultKiroEngine();
    const validation = await kiroEngine.validateConfig();
    if (!validation.valid) {
      throw new Error(validation.error || "Kiro 未配置或登录已失效");
    }

    if (model) {
      kiroEngine.setModel(model);
    }

    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: prompt }] },
        timestamp: new Date().toISOString(),
        engine: "kiro",
      },
    ]);

    const response = await kiroEngine.sendMessage(prompt);

    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: response }],
        },
        timestamp: new Date().toISOString(),
        engine: "kiro",
      },
      {
        type: "result",
        subtype: "success",
        timestamp: new Date().toISOString(),
        model: model || kiroEngine.getCurrentModel() || "auto",
      },
    ]);

    const conversationId = kiroEngine.getConversationId();
    if (conversationId) {
      const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
      setExtractedSessionInfo({ sessionId: conversationId, projectId, engine: "kiro" });
    }

    setIsLoading(false);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('kiro', "[Kiro Engine] Error:", errorMessage);
    setError(errorMessage);
    setIsLoading(false);
  }
}
