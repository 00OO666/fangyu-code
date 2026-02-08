import { io, Socket } from 'socket.io-client';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';
import { ToolExecutor } from './tool-executor';

interface ServerToClientEvents {
  'tool:execute': (data: { id: string; tool: string; input: any }) => void;
  'health:ping': () => void;
  'config:update': (config: any) => void;
  'tool:cancel': (data: { id: string }) => void;
}

interface ClientToServerEvents {
  'tool:result': (data: {
    id: string;
    success: boolean;
    output?: any;
    error?: string;
  }) => void;
  'health:pong': (data: {
    cpu: number;
    memory: number;
    uptime: number;
    tools: string[];
  }) => void;
  'client:ready': () => void;
  'tool:progress': (data: {
    id: string;
    progress: number;
    message: string;
  }) => void;
}

export class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private executor: ToolExecutor;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(serverUrl: string) {
    this.executor = new ToolExecutor();

    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    // 连接成功
    this.socket.on('connect', () => {
      logger.info('Connected to Gateway Server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.socket.emit('client:ready');
      sendTelegramAlert('✅ Node Client 已连接到 Gateway', 'info');
    });

    // 执行工具
    this.socket.on('tool:execute', async (data) => {
      try {
        logger.info(`Executing tool: ${data.tool} (${data.id})`);
        const output = await this.executor.execute(data.tool, data.input);
        this.socket.emit('tool:result', {
          id: data.id,
          success: true,
          output,
        });
        logger.info(`Tool execution succeeded: ${data.id}`);
      } catch (error: any) {
        logger.error(`Tool execution failed: ${data.id} - ${error.message}`);
        this.socket.emit('tool:result', {
          id: data.id,
          success: false,
          error: error.message,
        });
      }
    });

    // 健康检查
    this.socket.on('health:ping', () => {
      const health = this.getHealthStatus();
      this.socket.emit('health:pong', health);
    });

    // 配置更新
    this.socket.on('config:update', (config) => {
      logger.info('Received config update:', config);
      // TODO: 更新配置
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      logger.warn(`Disconnected: ${reason}`);
      this.isConnected = false;
      this.reconnectAttempts++;

      if (this.reconnectAttempts === 1) {
        sendTelegramAlert('⚠️ Node Client 断开连接，正在重连...', 'warning');
      }
    });

    // 重连成功
    this.socket.on('reconnect' as any, (attemptNumber: number) => {
      logger.info(`Reconnected after ${attemptNumber} attempts`);
      sendTelegramAlert(`✅ Node Client 重连成功（尝试 ${attemptNumber} 次）`, 'info');
    });

    // 重连失败
    this.socket.on('reconnect_failed' as any, () => {
      logger.error('Reconnection failed');
      sendTelegramAlert('🚨 Node Client 重连失败', 'critical');
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      logger.error('Connection error:', error.message);
    });
  }

  private getHealthStatus() {
    const usage = process.memoryUsage();
    return {
      cpu: process.cpuUsage().user / 1000000, // 转换为秒
      memory: usage.heapUsed / 1024 / 1024, // 转换为 MB
      uptime: process.uptime(),
      tools: this.executor.getAvailableTools(),
    };
  }

  // 检查连接状态
  isClientConnected(): boolean {
    return this.isConnected;
  }

  // 断开连接
  disconnect() {
    this.socket.disconnect();
  }
}
