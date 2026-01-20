/**
 * Kiro Engine Handler
 *
 * 处理 Kiro 引擎的执行逻辑
 * 从 usePromptExecution.ts 提取（行 2082-2215）
 */

import { logger } from '@/lib/logger';
import { LLMApiService, type LLMProvider, type LLMRequest } from "@/lib/services/llmApiService";
import { getDefaultKiroEngine } from "@/services/kiro";
import type { UsePromptExecutionConfig } from "../types";

export interface KiroEngineContext {
  config: UsePromptExecutionConfig;
  prompt: string;
  model: string;
  maxThinkingTokens?: number }

/**
 * 执行 Kiro 引擎请求
 */
export async function executeKiroRequest(context: KiroEngineContext): Promise<void> {
  const { config, prompt, model, maxThinkingTokens } = context;
  const { projectPath, setMessages, setIsLoading, setError } = config;

  try {
    setIsLoading(true);

    // Get Kiro engine configuration
    const kiroEngine = getDefaultKiroEngine();
    if (!kiroEngine) {
      throw new Error("Kiro engine not configured") }

    // Prepare LLM request
    const provider: LLMProvider = {
      name: kiroEngine.name,
      baseUrl: kiroEngine.baseUrl,
      apiKey: kiroEngine.apiKey,
      models: kiroEngine.models,
    };

    const request: LLMRequest = {
      model: model || kiroEngine.models[0],
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
        engine: "kiro",
      },
    ]);

    // Add assistant response
    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        message: { content: response.content },
        timestamp: Date.now(),
        engine: "kiro",
      },
    ]);

    setIsLoading(false) } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('kiro', "[Kiro Engine] Error:", errorMessage);
    setError(errorMessage);
    setIsLoading(false) }
}
