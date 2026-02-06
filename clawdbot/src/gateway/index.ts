import { SocketServer } from './socket-server';
import { TelegramBotHandler } from './telegram-bot';
import { ClaudeClient } from './claude-client';
import { MessageHandler } from './message-handler';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.gateway' });

async function main() {
  let telegramBot: TelegramBotHandler | null = null;

  try {
    logger.info('Starting Gateway Server...');

    // 检查必需的环境变量
    const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'CLAUDE_API_KEY', 'SOCKET_PORT'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // 启动 Socket.IO 服务器
    const socketPort = parseInt(process.env.SOCKET_PORT || '8080');
    const socketServer = new SocketServer(socketPort);
    logger.info(`Socket.IO server started on port ${socketPort}`);

    // 初始化 Telegram Bot
    telegramBot = new TelegramBotHandler(process.env.TELEGRAM_BOT_TOKEN!);
    logger.info('Telegram Bot initialized');

    // 初始化 Claude Client
    const claudeClient = new ClaudeClient(
      process.env.CLAUDE_API_KEY!,
      process.env.CLAUDE_BASE_URL
    );
    logger.info('Claude API client initialized');

    // 初始化消息处理器
    const messageHandler = new MessageHandler(
      telegramBot,
      claudeClient,
      socketServer
    );
    logger.info('Message handler initialized');

    logger.info('Gateway Server started successfully');
    await sendTelegramAlert('🚀 Gateway Server 启动成功', 'info');

    // 定期报告状态
    setInterval(async () => {
      const stats = {
        clients: socketServer.getClientCount(),
        conversations: messageHandler.getActiveConversations(),
      };
      logger.info('Gateway status:', stats);
    }, 5 * 60 * 1000); // 每5分钟

    // 优雅关闭
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      await sendTelegramAlert('⏹️ Gateway Server 正在关闭', 'warning');

      if (telegramBot) {
        await telegramBot.stop();
      }

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error: any) {
    logger.error('Failed to start Gateway Server:', error);
    await sendTelegramAlert(
      `❌ Gateway Server 启动失败: ${error?.message || String(error)}`,
      'critical'
    );

    if (telegramBot) {
      await telegramBot.stop();
    }

    process.exit(1);
  }
}

main();
