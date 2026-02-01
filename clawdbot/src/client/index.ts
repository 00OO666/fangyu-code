import { SocketClient } from './socket-client';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';

async function main() {
  try {
    logger.info('Starting Node Client...');

    // 检查必需的环境变量
    const gatewayUrl = process.env.GATEWAY_URL;
    if (!gatewayUrl) {
      throw new Error('Missing required environment variable: GATEWAY_URL');
    }

    // 连接到 Gateway Server
    const client = new SocketClient(gatewayUrl);

    logger.info('Node Client started successfully');
    await sendTelegramAlert('🚀 Node Client 启动成功', 'info');

    // 优雅关闭
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      client.disconnect();
      await sendTelegramAlert('⏹️ Node Client 正在关闭', 'warning');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      client.disconnect();
      await sendTelegramAlert('⏹️ Node Client 正在关闭', 'warning');
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Failed to start Node Client:', error);
    await sendTelegramAlert(`❌ Node Client 启动失败: ${error.message}`, 'critical');
    process.exit(1);
  }
}

main();
