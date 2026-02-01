import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';

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

export class SocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private clients: Map<string, Socket> = new Map();
  private pendingRequests: Map<string, any> = new Map();

  constructor(port: number) {
    const httpServer = createServer();
    this.io = new Server(httpServer, {
      cors: { origin: '*' },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
    });

    this.setupHandlers();
    httpServer.listen(port);
    logger.info(`Socket.IO server listening on port ${port}`);
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.clients.set(socket.id, socket);

      // 客户端就绪
      socket.on('client:ready', () => {
        logger.info(`Client ready: ${socket.id}`);
        sendTelegramAlert(`✅ Node Client 已连接: ${socket.id}`, 'info');
      });

      // 工具执行结果
      socket.on('tool:result', (data) => {
        this.handleToolResult(data);
      });

      // 健康检查响应
      socket.on('health:pong', (data) => {
        this.recordHealth(socket.id, data);
      });

      // 执行进度
      socket.on('tool:progress', (data) => {
        logger.debug(`Tool progress: ${data.id} - ${data.progress}%`);
      });

      // 断开连接
      socket.on('disconnect', () => {
        logger.warn(`Client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
        sendTelegramAlert(`⚠️ Node Client 断开连接: ${socket.id}`, 'warning');
      });
    });

    // 定期健康检查
    setInterval(() => {
      this.io.emit('health:ping');
    }, 30000);
  }

  // 执行工具
  async executeTool(tool: string, input: any): Promise<any> {
    if (this.clients.size === 0) {
      throw new Error('No client connected');
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Tool execution timeout'));
      }, 120000); // 2分钟超时

      // 保存请求
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // 发送执行请求
      this.io.emit('tool:execute', { id, tool, input });
      logger.info(`Tool execution requested: ${tool} (${id})`);
    });
  }

  private handleToolResult(data: any) {
    const request = this.pendingRequests.get(data.id);
    if (!request) {
      logger.warn(`Received result for unknown request: ${data.id}`);
      return;
    }

    clearTimeout(request.timeout);
    this.pendingRequests.delete(data.id);

    if (data.success) {
      logger.info(`Tool execution succeeded: ${data.id}`);
      request.resolve(data.output);
    } else {
      logger.error(`Tool execution failed: ${data.id} - ${data.error}`);
      request.reject(new Error(data.error));
    }
  }

  private recordHealth(clientId: string, data: any) {
    logger.debug(`Health check from ${clientId}:`, data);
    // TODO: 保存到数据库
  }

  // 获取连接的客户端数量
  getClientCount(): number {
    return this.clients.size;
  }

  // 检查是否有客户端连接
  hasClients(): boolean {
    return this.clients.size > 0;
  }
}
