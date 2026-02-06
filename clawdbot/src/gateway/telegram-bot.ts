import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';

export interface TelegramMessage {
  chatId: number;
  messageId: number;
  text: string;
  from: {
    id: number;
    username?: string;
    firstName: string;
  };
}

export class TelegramBotHandler {
  private bot: TelegramBot;
  private messageHandler?: (message: TelegramMessage) => Promise<void>;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
    logger.info('Telegram Bot initialized');
  }

  private setupHandlers() {
    // 处理文本消息
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;

      const telegramMessage: TelegramMessage = {
        chatId: msg.chat.id,
        messageId: msg.message_id,
        text: msg.text,
        from: {
          id: msg.from!.id,
          username: msg.from!.username,
          firstName: msg.from!.first_name,
        },
      };

      logger.info(`Received message from ${msg.from!.first_name}: ${msg.text}`);

      try {
        if (this.messageHandler) {
          await this.messageHandler(telegramMessage);
        }
      } catch (error) {
        logger.error('Error handling message:', error);
        await this.sendMessage(
          msg.chat.id,
          '抱歉，处理消息时出错了。请稍后再试。'
        );
      }
    });

    // 处理错误
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
      sendTelegramAlert(`❌ Telegram Bot 轮询错误: ${error.message}`, 'critical');
    });

    // 处理 webhook 错误
    this.bot.on('webhook_error', (error) => {
      logger.error('Telegram webhook error:', error);
      sendTelegramAlert(`❌ Telegram Bot Webhook 错误: ${error.message}`, 'critical');
    });
  }

  // 设置消息处理器
  onMessage(handler: (message: TelegramMessage) => Promise<void>) {
    this.messageHandler = handler;
  }

  // 发送消息
  async sendMessage(chatId: number, text: string, options?: any): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options,
      });
      logger.debug(`Sent message to ${chatId}`);
    } catch (error) {
      logger.error(`Failed to send message to ${chatId}:`, error);
      throw error;
    }
  }

  // 发送"正在输入"状态
  async sendTyping(chatId: number): Promise<void> {
    try {
      await this.bot.sendChatAction(chatId, 'typing');
    } catch (error) {
      logger.error(`Failed to send typing action to ${chatId}:`, error);
    }
  }

  // 停止 Bot
  async stop(): Promise<void> {
    logger.info('Stopping Telegram Bot...');
    await this.bot.stopPolling();
    logger.info('Telegram Bot stopped');
  }
}
