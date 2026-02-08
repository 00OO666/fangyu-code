import { spawn } from 'child_process';
import WebSocket from 'ws';
import { logger } from '../common/logger';
import { sendTelegramAlert } from '../common/alerter';

export class OpenClawClient {
  private gatewayUrl: string;
  private authToken: string;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(gatewayUrl: string, authToken: string) {
    this.gatewayUrl = gatewayUrl;
    this.authToken = authToken;
    this.connect();
  }

  private connect() {
    try {
      logger.info(`Connecting to OpenClaw Gateway: ${this.gatewayUrl}`);

      // 在 URL 中添加认证 token
      const urlWithAuth = `${this.gatewayUrl}?token=${this.authToken}`;
      this.ws = new WebSocket(urlWithAuth);

      this.ws.on('open', () => {
        this.isConnected = true;
        logger.info('Connected to OpenClaw Gateway');
        sendTelegramAlert('✅ OpenClaw Client 已连接到 Gateway', 'info');
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.info('Received message from Gateway:', message);
          await this.handleMessage(message);
        } catch (error: any) {
          logger.error('Failed to handle message:', error.message);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error.message);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        logger.warn('Disconnected from OpenClaw Gateway');
        sendTelegramAlert('⚠️ OpenClaw Client 断开连接', 'warning');
        this.scheduleReconnect();
      });
    } catch (error: any) {
      logger.error('Failed to connect:', error.message);
      this.scheduleReconnect();
    }
  }

  private async handleMessage(message: any) {
    try {
      logger.info('Received message from Gateway:', message);

      // 处理认证挑战
      if (message.event === 'connect.challenge') {
        const { nonce } = message.payload;
        logger.info('Received authentication challenge, responding...');

        // 响应认证挑战
        this.sendMessage({
          event: 'connect.authenticate',
          payload: {
            nonce,
            token: this.authToken
          }
        });
        return;
      }

      // 处理已认证消息
      if (message.event === 'connect.authenticated') {
        logger.info('Authentication successful!');
        sendTelegramAlert('✅ OpenClaw Client 认证成功', 'info');
        return;
      }

      // 处理来自 Gateway 的命令
      if (message.type === 'command') {
        const { command, sessionId } = message;
        logger.info(`Executing command: ${command}`);

        const result = await this.executeCommand(command);

        // 发送结果回 Gateway
        this.sendMessage({
          type: 'result',
          sessionId,
          result,
          success: true
        });
      }
    } catch (error: any) {
      logger.error('Failed to handle message:', error.message);

      // 发送错误回 Gateway
      if (message.sessionId) {
        this.sendMessage({
          type: 'result',
          sessionId: message.sessionId,
          result: error.message,
          success: false
        });
      }
    }
  }

  private sendMessage(message: any) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.error('Cannot send message: not connected');
    }
  }

  /**
   * 执行本地命令
   */
  async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Executing command: ${command}`);

        // 使用 PowerShell 执行命令（Windows）
        const childProcess = spawn('powershell', ['-Command', command], {
          shell: true,
        });

        let output = '';
        let errorOutput = '';

        childProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        childProcess.on('close', (code: number | null) => {
          if (code === 0) {
            logger.info('Command execution succeeded');
            resolve(output || '✅ 命令执行成功');
          } else {
            logger.error(`Command execution failed with code ${code}`);
            reject(new Error(errorOutput || `命令执行失败 (code: ${code})`));
          }
        });

        childProcess.on('error', (error: Error) => {
          logger.error('Process error:', error.message);
          reject(error);
        });
      } catch (error: any) {
        logger.error('Failed to execute command:', error.message);
        reject(error);
      }
    });
  }


  private scheduleReconnect() {
    logger.info('Reconnecting in 30 seconds...');
    setTimeout(() => {
      this.connect();
    }, 30000);
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  disconnect() {
    this.isConnected = false;
    logger.info('Disconnected from OpenClaw Gateway');
  }
}
