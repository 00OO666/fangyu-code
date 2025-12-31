/**
 * WebSocket 实时通信类型定义
 *
 * 用于跨窗口会话消息同步、状态更新、协作编辑等场景
 */

import type { ClaudeStreamMessage } from './claude';

/**
 * WebSocket 连接状态
 */
export type WebSocketState =
  | 'disconnected'  // 未连接
  | 'connecting'    // 连接中
  | 'connected'     // 已连接
  | 'reconnecting'  // 重连中
  | 'error';        // 连接错误

/**
 * WebSocket 消息类型
 */
export type WebSocketMessageType =
  // 会话相关
  | 'session:new'           // 新会话创建
  | 'session:message'       // 会话消息更新
  | 'session:status'        // 会话状态更新
  | 'session:close'         // 会话关闭
  // 项目相关
  | 'project:create'        // 项目创建
  | 'project:update'        // 项目更新
  | 'project:delete'        // 项目删除
  // 文件相关
  | 'file:change'           // 文件变更
  | 'file:create'           // 文件创建
  | 'file:delete'           // 文件删除
  // 窗口相关
  | 'window:focus'          // 窗口获得焦点
  | 'window:blur'           // 窗口失去焦点
  | 'window:close'          // 窗口关闭
  // 系统相关
  | 'ping'                  // 心跳
  | 'pong'                  // 心跳响应
  | 'error';                // 错误消息

/**
 * WebSocket 消息基础结构
 */
export interface WebSocketMessage<T = any> {
  /** 消息类型 */
  type: WebSocketMessageType;
  /** 消息负载 */
  payload: T;
  /** 消息 ID（用于去重和追踪） */
  messageId: string;
  /** 发送窗口 ID */
  windowId: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 会话消息更新负载
 */
export interface SessionMessagePayload {
  /** 会话 ID */
  sessionId: string;
  /** 项目 ID */
  projectId: string;
  /** 项目路径 */
  projectPath: string;
  /** 新增消息 */
  messages: ClaudeStreamMessage[];
  /** 是否正在流式输出 */
  isStreaming: boolean;
}

/**
 * 会话状态更新负载
 */
export interface SessionStatusPayload {
  /** 会话 ID */
  sessionId: string;
  /** 项目 ID */
  projectId: string;
  /** 状态 */
  status: 'active' | 'paused' | 'stopped' | 'error';
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 文件变更负载
 */
export interface FileChangePayload {
  /** 项目路径 */
  projectPath: string;
  /** 文件路径（相对于项目根目录） */
  filePath: string;
  /** 变更类型 */
  changeType: 'create' | 'update' | 'delete';
  /** 文件内容（创建/更新时） */
  content?: string;
}

/**
 * WebSocket 事件处理器映射
 */
export interface WebSocketEventHandlers {
  /** 连接状态变化 */
  onStateChange?: (state: WebSocketState) => void;
  /** 收到消息 */
  onMessage?: (message: WebSocketMessage) => void;
  /** 会话消息更新 */
  onSessionMessage?: (payload: SessionMessagePayload) => void;
  /** 会话状态更新 */
  onSessionStatus?: (payload: SessionStatusPayload) => void;
  /** 文件变更 */
  onFileChange?: (payload: FileChangePayload) => void;
  /** 连接错误 */
  onError?: (error: Error) => void;
}

/**
 * WebSocket 连接配置
 */
export interface WebSocketConfig {
  /** WebSocket 服务器地址（默认 ws://localhost:9527） */
  url?: string;
  /** 重连间隔（毫秒，默认 3000） */
  reconnectInterval?: number;
  /** 最大重连次数（默认 10） */
  maxReconnectAttempts?: number;
  /** 心跳间隔（毫秒，默认 30000） */
  heartbeatInterval?: number;
  /** 自动重连（默认 true） */
  autoReconnect?: boolean;
  /** 事件处理器 */
  handlers?: WebSocketEventHandlers;
}

/**
 * WebSocket 连接实例
 */
export interface WebSocketConnection {
  /** 当前连接状态 */
  state: WebSocketState;
  /** 发送消息 */
  send: <T = any>(type: WebSocketMessageType, payload: T) => void;
  /** 关闭连接 */
  close: () => void;
  /** 重新连接 */
  reconnect: () => void;
  /** 注册事件处理器 */
  on: <K extends keyof WebSocketEventHandlers>(
    event: K,
    handler: NonNullable<WebSocketEventHandlers[K]>
  ) => () => void;
}
