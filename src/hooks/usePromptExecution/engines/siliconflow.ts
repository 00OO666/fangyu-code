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
  maxThinkingTokens?: number }

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

    // Load SiliconFlow configuration
    const sfConfig = loadSiliconFlowConfig();
    if (!sfConfig.apiKey) {
      throw new Error("SiliconFlow API key not configured") }

    // Prepare LLM request
    const provider: LLMProvider = {
      name: "SiliconFlow",
      baseUrl: SILICONFLOW_API.BASE_URL,
      apiKey: sfConfig.apiKey,
      models: [model || sfConfig.defaultModel],
    };

    const request: LLMRequest = {
      model: model || sfConfig.defaultModel,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: maxThinkingTokens || 4096,
      stream: true,
    };

    // Execute request
    const llmService = new LLMApiService();
    const response = await llmService.sendRequest(provider, request);

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        message: { content: prompt },
        timestamp: Date.now(),
        engine: "siliconflow",
      },
    ]);

    // Add assistant response
    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        message: { content: response.content },
        timestamp: Date.now(),
        engine: "siliconflow",
      },
    ]);

    setIsLoading(false) } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('siliconflow', "[SiliconFlow Engine] Error:", errorMessage);
    setError(errorMessage);
    setIsLoading(false) }
}
