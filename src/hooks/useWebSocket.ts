/**
 * useWebSocket Hook
 *
 * WebSocket 连接管理 Hook，提供：
 * - 自动连接/重连
 * - 心跳保活
 * - 消息收发
 * - 事件订阅
 *
 * 主要用于跨窗口会话消息同步
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  WebSocketState,
  WebSocketMessage,
  WebSocketMessageType,
  WebSocketConfig,
  WebSocketEventHandlers,
} from '@/types/websocket';

// 默认配置
const DEFAULT_CONFIG: Required<Omit<WebSocketConfig, 'handlers'>> = {
  url: 'ws://localhost:9527',
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  autoReconnect: true,
};

// 生成唯一窗口 ID
const generateWindowId = () => {
  const stored = sessionStorage.getItem('fangyu_window_id');
  if (stored) return stored;
  const newId = `window_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem('fangyu_window_id', newId);
  return newId;
};

// 生成唯一消息 ID
const generateMessageId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * WebSocket 连接管理 Hook
 */
export function useWebSocket(config: WebSocketConfig = {}) {
  // 合并配置
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    url,
    reconnectInterval,
    maxReconnectAttempts,
    heartbeatInterval,
    autoReconnect,
  } = mergedConfig;

  // 状态
  const [state, setState] = useState<WebSocketState>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const windowIdRef = useRef<string>(generateWindowId());
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<Map<keyof WebSocketEventHandlers, Set<Function>>>(
    new Map()
  );
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const configRef = useRef(mergedConfig);

  // 更新配置引用
  useEffect(() => {
    configRef.current = mergedConfig;
  }, [url, reconnectInterval, maxReconnectAttempts, heartbeatInterval, autoReconnect]);

  // 清理函数
  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // 触发事件处理器
  const emit = useCallback(
    <K extends keyof WebSocketEventHandlers>(
      event: K,
      ...args: Parameters<NonNullable<WebSocketEventHandlers[K]>>
    ) => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            (handler as Function)(...args);
          } catch (error) {
            console.error(`[WebSocket] Error in ${event} handler:`, error);
          }
        });
      }
    },
    []
  );

  // 发送消息
  const send = useCallback(
    <T = any>(type: WebSocketMessageType, payload: T) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        console.warn('[WebSocket] Cannot send message: not connected');
        return;
      }

      const message: WebSocketMessage<T> = {
        type,
        payload,
        messageId: generateMessageId(),
        windowId: windowIdRef.current,
        timestamp: Date.now(),
      };

      wsRef.current.send(JSON.stringify(message));
    },
    []
  );

  // 启动心跳
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        send('ping', { timestamp: Date.now() });
      }
    }, configRef.current.heartbeatInterval);
  }, [send]);

  // 处理收到的消息
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // 消息去重（避免处理自己发送的消息）
        if (message.windowId === windowIdRef.current) {
          return;
        }

        // 基于 messageId 去重
        if (processedMessagesRef.current.has(message.messageId)) {
          return;
        }
        processedMessagesRef.current.add(message.messageId);

        // 限制已处理消息缓存大小
        if (processedMessagesRef.current.size > 1000) {
          const entries = Array.from(processedMessagesRef.current);
          entries.slice(0, 500).forEach((id) =>
            processedMessagesRef.current.delete(id)
          );
        }

        // 触发通用消息处理器
        emit('onMessage', message);

        // 根据消息类型触发特定处理器
        switch (message.type) {
          case 'session:message':
            emit('onSessionMessage', message.payload);
            break;
          case 'session:status':
            emit('onSessionStatus', message.payload);
            break;
          case 'file:change':
          case 'file:create':
          case 'file:delete':
            emit('onFileChange', message.payload);
            break;
          case 'pong':
            // 心跳响应，不需要特殊处理
            break;
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [emit]
  );

  // 连接 WebSocket
  const connect = useCallback(() => {
    // 如果已连接，先关闭
    if (wsRef.current) {
      wsRef.current.close();
    }

    cleanup();
    setState('connecting');

    try {
      const ws = new WebSocket(configRef.current.url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to', configRef.current.url);
        setState('connected');
        reconnectCountRef.current = 0;
        startHeartbeat();
        emit('onStateChange', 'connected');
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        cleanup();

        // 如果不是正常关闭且允许自动重连
        if (
          event.code !== 1000 &&
          configRef.current.autoReconnect &&
          reconnectCountRef.current < configRef.current.maxReconnectAttempts
        ) {
          setState('reconnecting');
          emit('onStateChange', 'reconnecting');

          reconnectTimerRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            console.log(
              `[WebSocket] Reconnecting... (${reconnectCountRef.current}/${configRef.current.maxReconnectAttempts})`
            );
            connect();
          }, configRef.current.reconnectInterval);
        } else {
          setState('disconnected');
          emit('onStateChange', 'disconnected');
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        const err = new Error('WebSocket connection error');
        setLastError(err);
        setState('error');
        emit('onStateChange', 'error');
        emit('onError', err);
      };

      ws.onmessage = handleMessage;

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      setState('error');
      emit('onStateChange', 'error');
      emit('onError', err);
    }
  }, [cleanup, startHeartbeat, handleMessage, emit]);

  // 关闭连接
  const close = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }
    setState('disconnected');
  }, [cleanup]);

  // 手动重连
  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0;
    connect();
  }, [connect]);

  // 注册事件处理器
  const on = useCallback(
    <K extends keyof WebSocketEventHandlers>(
      event: K,
      handler: NonNullable<WebSocketEventHandlers[K]>
    ): (() => void) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set());
      }
      handlersRef.current.get(event)!.add(handler);

      // 返回取消订阅函数
      return () => {
        handlersRef.current.get(event)?.delete(handler);
      };
    },
    []
  );

  // 注册初始处理器
  useEffect(() => {
    if (config.handlers) {
      const unsubscribes: (() => void)[] = [];

      Object.entries(config.handlers).forEach(([event, handler]) => {
        if (handler) {
          unsubscribes.push(
            on(event as keyof WebSocketEventHandlers, handler as any)
          );
        }
      });

      return () => {
        unsubscribes.forEach((unsub) => unsub());
      };
    }
  }, [config.handlers, on]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return {
    // 状态
    state,
    lastError,
    windowId: windowIdRef.current,
    isConnected: state === 'connected',

    // 方法
    connect,
    close,
    reconnect,
    send,
    on,
  };
}

export default useWebSocket;
