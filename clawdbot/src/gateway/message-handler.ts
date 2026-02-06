import { TelegramMessage, TelegramBotHandler } from './telegram-bot';
import { ClaudeClient, ClaudeMessage } from './claude-client';
import { SocketServer } from './socket-server';
import { logger } from '../common/logger';

export interface ConversationContext {
  chatId: number;
  messages: ClaudeMessage[];
  lastActivity: Date;
}

export class MessageHandler {
  private telegramBot: TelegramBotHandler;
  private claudeClient: ClaudeClient;
  private socketServer: SocketServer;
  private conversations: Map<number, ConversationContext> = new Map();
  private systemPrompt: string;

  constructor(
    telegramBot: TelegramBotHandler,
    claudeClient: ClaudeClient,
    socketServer: SocketServer
  ) {
    this.telegramBot = telegramBot;
    this.claudeClient = claudeClient;
    this.socketServer = socketServer;

    // 设置系统提示词
    this.systemPrompt = `你是一个智能助手，可以帮助用户完成各种任务。

你可以使用以下工具：
- browser: 浏览器自动化（访问网页、截图、填写表单等）
- http: 发送 HTTP 请求
- command: 执行命令行命令
- python: 执行 Python 脚本

当你需要使用工具时，请按照以下格式回复：
\`\`\`tool
{
  "tool": "工具名称",
  "input": {
    // 工具参数
  }
}
\`\`\`

请用中文回复用户。`;

    // 设置消息处理器
    this.telegramBot.onMessage(this.handleMessage.bind(this));

    // 定期清理过期会话（30分钟无活动）
    setInterval(() => this.cleanupOldConversations(), 5 * 60 * 1000);

    logger.info('Message handler initialized');
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const { chatId, text, from } = message;

    logger.info(`Processing message from ${from.firstName} (${chatId}): ${text}`);

    // 发送"正在输入"状态
    await this.telegramBot.sendTyping(chatId);

    try {
      // 获取或创建会话上下文
      let context = this.conversations.get(chatId);
      if (!context) {
        context = {
          chatId,
          messages: [],
          lastActivity: new Date(),
        };
        this.conversations.set(chatId, context);
      }

      // 添加用户消息
      context.messages.push({
        role: 'user',
        content: text,
      });
      context.lastActivity = new Date();

      // 发送到 Claude
      const response = await this.claudeClient.sendMessage(
        context.messages,
        this.systemPrompt
      );

      // 检查是否需要执行工具
      const toolCall = this.extractToolCall(response.content);
      if (toolCall) {
        await this.handleToolCall(chatId, toolCall, context);
      } else {
        // 直接回复用户
        await this.telegramBot.sendMessage(chatId, response.content);

        // 添加助手消息到上下文
        context.messages.push({
          role: 'assistant',
          content: response.content,
        });
      }

      // 限制会话历史长度（保留最近 20 条消息）
      if (context.messages.length > 20) {
        context.messages = context.messages.slice(-20);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      await this.telegramBot.sendMessage(
        chatId,
        '抱歉，处理消息时出错了。请稍后再试。'
      );
    }
  }

  // 提取工具调用
  private extractToolCall(content: string): any | null {
    const match = content.match(/```tool\s*\n([\s\S]*?)\n```/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]);
    } catch (error) {
      logger.error('Failed to parse tool call:', error);
      return null;
    }
  }

  // 处理工具调用
  private async handleToolCall(
    chatId: number,
    toolCall: any,
    context: ConversationContext
  ): Promise<void> {
    const { tool, input } = toolCall;

    logger.info(`Executing tool: ${tool}`);

    try {
      // 检查是否有客户端连接
      if (!this.socketServer.hasClients()) {
        await this.telegramBot.sendMessage(
          chatId,
          '抱歉，工具执行服务暂时不可用。请稍后再试。'
        );
        return;
      }

      // 通知用户正在执行工具
      await this.telegramBot.sendMessage(chatId, `正在执行工具: ${tool}...`);

      // 执行工具
      const result = await this.socketServer.executeTool(tool, input);

      // 将工具结果添加到上下文
      const toolResultMessage = `工具执行结果：\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;

      context.messages.push({
        role: 'assistant',
        content: toolResultMessage,
      });

      // 让 Claude 处理工具结果
      const response = await this.claudeClient.sendMessage(
        context.messages,
        this.systemPrompt
      );

      // 回复用户
      await this.telegramBot.sendMessage(chatId, response.content);

      // 添加助手消息到上下文
      context.messages.push({
        role: 'assistant',
        content: response.content,
      });
    } catch (error: any) {
      logger.error('Tool execution failed:', error);
      await this.telegramBot.sendMessage(
        chatId,
        `工具执行失败: ${error?.message || String(error)}`
      );
    }
  }

  // 清理过期会话
  private cleanupOldConversations(): void {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30分钟

    for (const [chatId, context] of this.conversations.entries()) {
      if (now.getTime() - context.lastActivity.getTime() > timeout) {
        this.conversations.delete(chatId);
        logger.info(`Cleaned up conversation for chat ${chatId}`);
      }
    }
  }

  // 获取活跃会话数量
  getActiveConversations(): number {
    return this.conversations.size;
  }
}
