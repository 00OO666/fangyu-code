import { SocketServer } from './socket-server';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';

async function main() {
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

    // TODO: 启动 Telegram Bot
    // TODO: 初始化数据库

    logger.info('Gateway Server started successfully');
    await sendTelegramAlert('🚀 Gateway Server 启动成功', 'info');

    // 优雅关闭
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await sendTelegramAlert('⏹️ Gateway Server 正在关闭', 'warning');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await sendTelegramAlert('⏹️ Gateway Server 正在关闭', 'warning');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Gateway Server:', error);
    await sendTelegramAlert(`❌ Gateway Server 启动失败: ${error.message}`, 'critical');
    process.exit(1);
  }
}

main();
