/**
 * SiliconFlow Engine Handler
 *
 * 处理 SiliconFlow 引擎的执行逻辑
 * 从 usePromptExecution.ts 提取（行 2216+）
 */

import { logger } from '@/lib/logger';
import { LLMApiService, type LLMProvider, type LLMRequest } from "@/lib/services/llmApiService";
import { loadSiliconFlowConfig, SILICONFLOW_API } from "@/config/siliconflowConfig";
import type { UsePromptExecutionConfig } from "../types";

export interface SiliconFlowEngineContext {
  config: UsePromptExecutionConfig;
  prompt: string;
  model: string;
  maxThinkingTokens?: number;
}

/**
 * 执行 SiliconFlow 引擎请求
 */
export async function executeSiliconFlowRequest(
  context: SiliconFlowEngineContext
): Promise<void> {
  const { config, prompt, model, maxThinkingTokens } = context;
  const { setMessages, setIsLoading, setError } = config;

  try {
    setIsLoading(true);

    const sfConfig = loadSiliconFlowConfig();
    if (!sfConfig.apiKey) {
      throw new Error("SiliconFlow API key not configured");
    }

    const provider: LLMProvider = {
      id: "siliconflow",
      name: "SiliconFlow",
      apiUrl: SILICONFLOW_API.BASE_URL + SILICONFLOW_API.CHAT_ENDPOINT,
      apiKey: sfConfig.apiKey,
      model: model || sfConfig.selectedModel,
      temperature: sfConfig.temperature,
      maxTokens: sfConfig.maxTokens,
      apiFormat: "openai",
    };

    const request: LLMRequest = {
      systemPrompt: "You are a helpful AI assistant powered by SiliconFlow.",
      userPrompt: prompt,
      maxTokens: maxThinkingTokens || sfConfig.maxTokens,
      temperature: sfConfig.temperature,
    };

    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        message: { role: "user", content: [{ type: "text", text: prompt }] },
        timestamp: new Date().toISOString(),
        engine: "siliconflow",
      },
    ]);

    const response = await LLMApiService.call(provider, request);

    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: response.content }],
        },
        timestamp: new Date().toISOString(),
        engine: "siliconflow",
      },
      {
        type: "result",
        subtype: "success",
        timestamp: new Date().toISOString(),
        model: provider.model,
      },
    ]);

    setIsLoading(false);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('siliconflow', "[SiliconFlow Engine] Error:", errorMessage);
    setError(errorMessage);
    setIsLoading(false);
  }
}
