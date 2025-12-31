/**
 * SessionConnection - 会话连接管理
 *
 * 封装 Tauri 事件监听，提供统一的消息流接口
 * 支持 Claude、Codex、Gemini 引擎
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { AsyncQueue } from './AsyncQueue';
import { converterRegistry, type EngineType } from './converters';
import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * 连接状态
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'closed';

/**
 * 会话连接配置
 */
export interface SessionConnectionConfig {
  /**
   * 会话 ID
   */
  sessionId: string;

  /**
   * 引擎类型
   */
  engine: EngineType;

  /**
   * Tab ID（用于消息过滤）
   */
  tabId?: string;

  /**
   * 是否启用调试日志
   */
  debug?: boolean;

  /**
   * 错误回调
   */
  onError?: (error: string) => void;

  /**
   * 状态变更回调
   */
  onStateChange?: (state: ConnectionState) => void;

  /**
   * 会话完成回调
   */
  onComplete?: (success: boolean) => void;
}

/**
 * 会话连接类
 */
export class SessionConnection {
  private config: SessionConnectionConfig;
  private messageQueue: AsyncQueue<ClaudeStreamMessage>;
  private rawQueue: AsyncQueue<string>;
  private unlisteners: UnlistenFn[] = [];
  private state: ConnectionState = 'disconnected';
  private isSetup = false;

  constructor(config: SessionConnectionConfig) {
    this.config = config;
    this.messageQueue = new AsyncQueue<ClaudeStreamMessage>(() => this.cleanup());
    this.rawQueue = new AsyncQueue<string>();
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取消息流（用于 for await...of）
   */
  get messages(): AsyncQueue<ClaudeStreamMessage> {
    return this.messageQueue;
  }

  /**
   * 获取原始 JSONL 流
   */
  get rawMessages(): AsyncQueue<string> {
    return this.rawQueue;
  }

  /**
   * 建立连接
   */
  async connect(): Promise<void> {
    if (this.isSetup) {
      console.warn('[SessionConnection] Already connected');
      return;
    }

    this.setState('connecting');

    try {
      await this.setupListeners();
      this.isSetup = true;
      this.setState('connected');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  private async setupListeners(): Promise<void> {
    const { sessionId, engine, tabId, debug } = this.config;

    // 根据引擎类型选择事件名称前缀
    const eventPrefix = this.getEventPrefix(engine);

    // 监听消息输出
    const outputUnlisten = await listen<string>(
      `${eventPrefix}-output:${sessionId}`,
      (event) => {
        try {
          if (debug) {
            console.log(`[SessionConnection] Received:`, event.payload);
          }

          // 存储原始消息
          this.rawQueue.enqueue(event.payload);

          // 转换消息
          const result = converterRegistry.convertLine(event.payload, engine);
          if (result.message) {
            this.messageQueue.enqueue(result.message);
          }
        } catch (error) {
          console.error('[SessionConnection] Failed to process message:', error);
        }
      }
    );
    this.unlisteners.push(outputUnlisten);

    // 监听错误
    const errorUnlisten = await listen<string>(
      `${eventPrefix}-error:${sessionId}`,
      (event) => {
        console.error(`[SessionConnection] Error:`, event.payload);
        this.config.onError?.(event.payload);
      }
    );
    this.unlisteners.push(errorUnlisten);

    // 监听完成事件
    const completeUnlisten = await listen<boolean>(
      `${eventPrefix}-complete:${sessionId}`,
      (event) => {
        if (debug) {
          console.log(`[SessionConnection] Complete:`, event.payload);
        }
        this.setState('closed');
        this.config.onComplete?.(event.payload);
        this.close();
      }
    );
    this.unlisteners.push(completeUnlisten);

    // 监听会话状态变更
    const stateUnlisten = await listen<{ session_id: string; status: string; success?: boolean }>(
      `${eventPrefix}-session-state`,
      (event) => {
        if (event.payload.session_id === sessionId) {
          if (debug) {
            console.log(`[SessionConnection] State change:`, event.payload);
          }
          if (event.payload.status === 'stopped') {
            this.setState('closed');
            this.close();
          }
        }
      }
    );
    this.unlisteners.push(stateUnlisten);

    // 如果有 tabId，还要监听全局事件进行过滤
    if (tabId) {
      const globalUnlisten = await listen<{ tab_id: string; payload: string }>(
        `${eventPrefix}-output`,
        (event) => {
          if (event.payload.tab_id === tabId) {
            try {
              this.rawQueue.enqueue(event.payload.payload);
              const result = converterRegistry.convertLine(event.payload.payload, engine);
              if (result.message) {
                this.messageQueue.enqueue(result.message);
              }
            } catch (error) {
              console.error('[SessionConnection] Failed to process global message:', error);
            }
          }
        }
      );
      this.unlisteners.push(globalUnlisten);
    }
  }

  /**
   * 获取事件名称前缀
   */
  private getEventPrefix(engine: EngineType): string {
    switch (engine) {
      case 'codex':
        return 'codex';
      case 'gemini':
        return 'gemini';
      default:
        return 'claude';
    }
  }

  /**
   * 设置状态
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.config.onStateChange?.(state);
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.cleanup();
    this.setState('closed');
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    // 取消所有监听器
    for (const unlisten of this.unlisteners) {
      try {
        unlisten();
      } catch (error) {
        console.warn('[SessionConnection] Failed to unlisten:', error);
      }
    }
    this.unlisteners = [];

    // 结束队列
    this.messageQueue.done();
    this.rawQueue.done();

    // 重置转换器
    converterRegistry.reset(this.config.engine);

    this.isSetup = false;
  }

  /**
   * 静态工厂方法：创建并连接
   */
  static async create(config: SessionConnectionConfig): Promise<SessionConnection> {
    const connection = new SessionConnection(config);
    await connection.connect();
    return connection;
  }
}

/**
 * 连接管理器
 * 管理多个会话连接（支持多 Tab）
 */
export class ConnectionManager {
  private connections: Map<string, SessionConnection> = new Map();

  /**
   * 创建或获取连接
   */
  async getOrCreate(config: SessionConnectionConfig): Promise<SessionConnection> {
    const key = `${config.engine}:${config.sessionId}`;

    const existing = this.connections.get(key);
    if (existing && existing.getState() === 'connected') {
      return existing;
    }

    // 关闭旧连接
    if (existing) {
      existing.close();
      this.connections.delete(key);
    }

    // 创建新连接
    const connection = await SessionConnection.create(config);
    this.connections.set(key, connection);

    return connection;
  }

  /**
   * 获取连接
   */
  get(sessionId: string, engine: EngineType): SessionConnection | undefined {
    const key = `${engine}:${sessionId}`;
    return this.connections.get(key);
  }

  /**
   * 关闭连接
   */
  close(sessionId: string, engine: EngineType): void {
    const key = `${engine}:${sessionId}`;
    const connection = this.connections.get(key);
    if (connection) {
      connection.close();
      this.connections.delete(key);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * 获取活跃连接数
   */
  get activeCount(): number {
    return this.connections.size;
  }
}

/**
 * 全局连接管理器单例
 */
export const connectionManager = new ConnectionManager();
