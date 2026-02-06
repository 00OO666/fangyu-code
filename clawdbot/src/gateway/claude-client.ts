import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../common/logger';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ClaudeClient {
  private client: Anthropic;
  private model: string = 'claude-opus-4-20250514';

  constructor(apiKey: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL,
    });
    logger.info('Claude API client initialized');
  }

  // 发送消息到 Claude
  async sendMessage(
    messages: ClaudeMessage[],
    systemPrompt?: string
  ): Promise<ClaudeResponse> {
    try {
      logger.info(`Sending message to Claude (${messages.length} messages)`);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      logger.info(
        `Received response from Claude (${response.usage.input_tokens} in, ${response.usage.output_tokens} out)`
      );

      return {
        content,
        stopReason: response.stop_reason || 'unknown',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      logger.error('Failed to send message to Claude:', error);
      throw error;
    }
  }

  // 设置模型
  setModel(model: string) {
    this.model = model;
    logger.info(`Claude model set to: ${model}`);
  }
}
