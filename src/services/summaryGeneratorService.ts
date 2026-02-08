/**
 * Summary Generator Service
 *
 * 摘要生成服务，支持三引擎 API 调用
 *
 * Requirements: 1.2, 2.4, 2.6
 */

import {
  SummaryAPIConfig,
  SummaryResult,
  GenerationOptions,
  GenerationProgress,
  SummaryEngine,
  DEFAULT_SUMMARY_CONFIG,
} from "@/types/summary";
import type { ClaudeStreamMessage } from "@/types/claude";
import { getSummaryConfigStore } from "./summaryConfigStore";
import { getCurrentProvider } from "@/services/engineConfigService";

// =============================================================================
// 类型定义
// =============================================================================

interface APICallConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}

// =============================================================================
// 摘要提示词模板
// =============================================================================

const SUMMARY_PROMPT_TEMPLATE = `请为以下对话生成一个详细的摘要，使用 Markdown 格式。摘要应该包括：

1. **对话主题**：简要说明对话的主要主题
2. **关键讨论点**：列出讨论的主要问题和解决方案
3. **重要决策**：记录做出的重要决策或结论
4. **待办事项**：列出未完成的任务或需要继续的工作
5. **技术细节**：记录重要的技术实现细节、代码片段或配置

请确保摘要详细且易于理解，以便在新会话中快速恢复上下文。

---

{conversation}`;

const SUMMARY_PROMPT_TEMPLATE_EN = `Please generate a detailed summary of the following conversation in Markdown format. The summary should include:

1. **Topic**: Brief description of the main topic
2. **Key Discussion Points**: List the main issues and solutions discussed
3. **Important Decisions**: Record important decisions or conclusions made
4. **Action Items**: List incomplete tasks or work that needs to continue
5. **Technical Details**: Record important technical implementation details, code snippets, or configurations

Please ensure the summary is detailed and easy to understand for quick context recovery in a new session.

---

{conversation}`;

// =============================================================================
// 辅助函数
// =============================================================================

/** 提取消息文本内容 */
function extractMessageContent(message: any): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((c: any) => (c.type === "text" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** 格式化对话内容 */
function formatConversation(messages: ClaudeStreamMessage[]): string {
  return messages
    .map((msg, idx) => {
      if (msg.type === "user") {
        const content = extractMessageContent(msg.message);
        return content ? `## User Message ${idx + 1}\n${content}` : "";
      } else if (msg.type === "assistant") {
        const content = extractMessageContent(msg.message);
        return content ? `## Assistant Response ${idx + 1}\n${content}` : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** 检测语言 */
function detectLanguage(text: string): "zh" | "en" {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.length;
  return chineseChars / totalChars > 0.1 ? "zh" : "en";
}

// =============================================================================
// 引擎 API 调用
// =============================================================================

/** 调用 Claude API（直接调用，和 InlineAPITester 一样） */
async function callClaudeAPI(config: APICallConfig): Promise<string> {
  const response = await fetch(`${config.endpoint}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [{ role: "user", content: config.prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

/** 调用 OpenAI/Codex API */
async function callCodexAPI(config: APICallConfig): Promise<string> {
  const response = await fetch(config.endpoint || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: config.prompt }],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/** 调用 Gemini API */
async function callGeminiAPI(config: APICallConfig): Promise<string> {
  const endpoint =
    config.endpoint ||
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  const response = await fetch(`${endpoint}?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: config.prompt }] }],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// =============================================================================
// SummaryGeneratorService 类
// =============================================================================

export class SummaryGeneratorService {
  private abortController: AbortController | null = null;
  private progress: GenerationProgress = {
    status: "idle",
    percentage: 0,
  };
  private progressListeners: Set<(progress: GenerationProgress) => void> = new Set();

  /** 获取当前进度 */
  getProgress(): GenerationProgress {
    return { ...this.progress };
  }

  /** 订阅进度更新 */
  onProgress(listener: (progress: GenerationProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /** 更新进度 */
  private updateProgress(update: Partial<GenerationProgress>): void {
    this.progress = { ...this.progress, ...update };
    this.progressListeners.forEach((listener) => listener(this.progress));
  }

  /** 取消生成 */
  cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.updateProgress({ status: "idle", percentage: 0 });
  }

  /** 获取有效配置（支持回退） */
  private async getEffectiveConfig(customConfig?: SummaryAPIConfig): Promise<SummaryAPIConfig> {
    // 优先使用传入的配置
    if (customConfig && customConfig.engine && customConfig.model) {
      return customConfig;
    }

    // 尝试加载摘要专用配置
    const store = getSummaryConfigStore();
    const summaryConfig = await store.loadConfig();

    if (summaryConfig && store.isConfigured()) {
      return summaryConfig;
    }

    // 回退到默认配置
    return { ...DEFAULT_SUMMARY_CONFIG };
  }

  /** 获取 API Key（支持从各引擎配置获取） */
  private getApiKeyForEngine(engine: SummaryEngine, config: SummaryAPIConfig): string {
    // 优先使用配置中的 API Key
    if (config.apiKey) {
      return config.apiKey;
    }

    // 尝试从各引擎的全局配置获取
    switch (engine) {
      case "claude": {
        // Claude 引擎：从当前代理商配置获取
        const claudeProvider = getCurrentProvider("claude");
        return claudeProvider?.apiKey || "";
      }
      default:
        return "";
    }
  }

  /** 获取 API Endpoint（支持从各引擎配置获取） */
  private getEndpointForEngine(engine: SummaryEngine, config: SummaryAPIConfig): string {
    // 优先使用配置中的 Endpoint
    if (config.apiEndpoint) {
      return config.apiEndpoint;
    }

    // 尝试从各引擎的全局配置获取
    switch (engine) {
      case "claude": {
        // Claude 引擎：从当前代理商配置获取
        const claudeProvider = getCurrentProvider("claude");
        return claudeProvider?.baseUrl || "https://api.anthropic.com";
      }
      default:
        return "";
    }
  }

  /** 生成摘要 */
  async generateSummary(
    messages: ClaudeStreamMessage[],
    customConfig?: SummaryAPIConfig,
    options?: GenerationOptions
  ): Promise<SummaryResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    try {
      // 更新进度
      this.updateProgress({
        status: "preparing",
        percentage: 10,
        currentStep: "准备生成摘要...",
      });

      // 获取有效配置
      const config = await this.getEffectiveConfig(customConfig);

      // 格式化对话内容
      const conversation = formatConversation(messages);
      if (!conversation) {
        throw new Error("没有可用的对话内容");
      }

      // 选择提示词模板
      const language = options?.language || detectLanguage(conversation);
      const template = language === "zh" ? SUMMARY_PROMPT_TEMPLATE : SUMMARY_PROMPT_TEMPLATE_EN;
      const prompt = template.replace("{conversation}", conversation);

      // 更新进度
      this.updateProgress({
        status: "generating",
        percentage: 30,
        currentStep: `使用 ${config.engine} 生成摘要...`,
        estimatedTimeRemaining: 30,
      });

      // 准备 API 调用配置
      const apiConfig: APICallConfig = {
        endpoint: this.getEndpointForEngine(config.engine, config),
        apiKey: this.getApiKeyForEngine(config.engine, config),
        model: config.model,
        prompt,
        maxTokens: config.customParams?.maxTokens || 4096,
        temperature: config.customParams?.temperature || 0.3,
      };

      // 根据引擎调用对应 API
      let summary: string;

      switch (config.engine) {
        case "claude":
          summary = await callClaudeAPI(apiConfig);
          break;
        case "codex":
          summary = await callCodexAPI(apiConfig);
          break;
        case "gemini":
          summary = await callGeminiAPI(apiConfig);
          break;
        default:
          throw new Error(`不支持的引擎: ${config.engine}`);
      }

      // 更新进度
      this.updateProgress({
        status: "completed",
        percentage: 100,
        currentStep: "摘要生成完成",
      });

      const generationTime = Date.now() - startTime;

      return {
        success: true,
        summary,
        metadata: {
          tokensUsed: Math.ceil(prompt.length / 4) + Math.ceil(summary.length / 4),
          generationTime,
          model: config.model,
          engine: config.engine,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.updateProgress({
        status: "error",
        percentage: 0,
        currentStep: `生成失败: ${errorMessage}`,
      });

      return {
        success: false,
        error: errorMessage,
        metadata: {
          tokensUsed: 0,
          generationTime: Date.now() - startTime,
          model: customConfig?.model || "unknown",
          engine: customConfig?.engine || "claude",
          timestamp: Date.now(),
        },
      };
    } finally {
      this.abortController = null;
    }
  }

  /** 重置状态 */
  reset(): void {
    this.cancelGeneration();
    this.progress = { status: "idle", percentage: 0 };
    this.progressListeners.clear();
  }
}

// =============================================================================
// 单例实例
// =============================================================================

let instance: SummaryGeneratorService | null = null;

/** 获取 SummaryGeneratorService 单例 */
export function getSummaryGeneratorService(): SummaryGeneratorService {
  if (!instance) {
    instance = new SummaryGeneratorService();
  }
  return instance;
}

/** 创建新的 SummaryGeneratorService 实例（用于测试） */
export function createSummaryGeneratorService(): SummaryGeneratorService {
  return new SummaryGeneratorService();
}

export default SummaryGeneratorService;
