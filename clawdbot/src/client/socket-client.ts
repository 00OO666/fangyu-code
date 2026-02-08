import WebSocket from 'ws';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';
import { ToolExecutor } from './tool-executor';

export class SocketClient {
  private ws: WebSocket | null = null;
  private executor: ToolExecutor;
  private reconnectAttempts = 0;
  private isConnected = false;
  private serverUrl: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private chatId: string = '6145538033'; // 默认 Chat ID

  constructor(serverUrl: string) {
    this.executor = new ToolExecutor();
    this.serverUrl = serverUrl;
    this.connect();
  }

  private connect() {
    try {
      logger.info(`Connecting to Gateway Server: ${this.serverUrl}`);
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        logger.info('Connected to Gateway Server');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // 发送注册消息
        this.send({
          type: 'connected',
          chatId: this.chatId,
        });

        // 启动心跳
        this.startPing();

        sendTelegramAlert('✅ Node Client 已连接到 Gateway', 'info');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error: any) {
          logger.error('Failed to parse message:', error.message);
        }
      });

      this.ws.on('close', () => {
        logger.warn('Disconnected from Gateway Server');
        this.isConnected = false;
        this.stopPing();

        if (this.reconnectAttempts === 0) {
          sendTelegramAlert('⚠️ Node Client 断开连接，正在重连...', 'warning');
        }

        // 自动重连
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        logger.error('Connection error:', error.message);
      });
    } catch (error: any) {
      logger.error('Failed to connect:', error.message);
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: any) {
    logger.info(`Received message: ${message.type}`);

    // 处理不同类型的消息
    switch (message.type) {
      case 'ping':
        // 响应心跳
        this.send({ type: 'pong' });
        break;

      case 'execute':
      case 'send_command':
        // 执行命令
        this.executeCommand(message);
        break;

      case 'start_claude':
        // 启动 Claude Code
        this.startClaude(message);
        break;

      case 'stop_claude':
        // 停止 Claude Code
        this.stopClaude(message);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async executeCommand(message: any) {
    try {
      const command = message.command || message.input;
      logger.info(`Executing command: ${command}`);

      // 发送"正在处理"的消息
      this.send({
        type: 'output',
        chatId: message.chatId,
        text: `⏳ 正在执行命令...\n\`\`\`\n${command}\n\`\`\``,
      });

      // 执行命令（这里可以执行各种操作）
      // 例如：运行 shell 命令、调用 Claude Code 等
      const result = await this.executor.execute('shell', { command });

      // 发送结果回服务器
      this.send({
        type: 'output',
        chatId: message.chatId,
        text: `✅ 执行成功\n\`\`\`\n${result}\n\`\`\``,
      });

      logger.info('Command execution succeeded');
    } catch (error: any) {
      logger.error(`Command execution failed: ${error.message}`);

      this.send({
        type: 'error',
        chatId: message.chatId,
        text: error.message,
      });
    }
  }

  private async startClaude(message: any) {
    try {
      logger.info('Starting Claude Code...');

      // 这里可以启动 Claude Code
      // 例如：spawn('claude', ['code'])

      this.send({
        type: 'output',
        chatId: message.chatId,
        text: '✅ Claude Code 已启动',
      });
    } catch (error: any) {
      logger.error(`Failed to start Claude Code: ${error.message}`);

      this.send({
        type: 'error',
        chatId: message.chatId,
        text: `启动失败: ${error.message}`,
      });
    }
  }

  private async stopClaude(message: any) {
    try {
      logger.info('Stopping Claude Code...');

      // 这里可以停止 Claude Code

      this.send({
        type: 'output',
        chatId: message.chatId,
        text: '✅ Claude Code 已停止',
      });
    } catch (error: any) {
      logger.error(`Failed to stop Claude Code: ${error.message}`);

      this.send({
        type: 'error',
        chatId: message.chatId,
        text: `停止失败: ${error.message}`,
      });
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      logger.warn('Cannot send message: WebSocket is not connected');
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // 每 30 秒发送一次心跳
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return; // 已经在重连中
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // 检查连接状态
  isClientConnected(): boolean {
    return this.isConnected;
  }

  // 断开连接
  disconnect() {
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
