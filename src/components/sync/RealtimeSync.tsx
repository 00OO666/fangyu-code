/**
 * RealtimeSync 组件
 *
 * 实时同步组件，用于跨窗口会话消息同步
 * - 当前窗口的会话消息发送到其他窗口
 * - 接收其他窗口的会话消息并更新本地状态
 *
 * 使用场景：
 * - 多窗口协作编辑
 * - 跨窗口会话状态同步
 * - 实时消息通知
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { ClaudeStreamMessage } from '@/types/claude';
import type {
  SessionMessagePayload,
  SessionStatusPayload,
} from '@/types/websocket';

export interface RealtimeSyncProps {
  /** 会话 ID */
  sessionId: string | null;
  /** 项目 ID */
  projectId: string | null;
  /** 项目路径 */
  projectPath: string;
  /** 当前消息列表 */
  messages: ClaudeStreamMessage[];
  /** 是否正在流式输出 */
  isStreaming: boolean;
  /** 消息更新回调 */
  onMessagesUpdate?: (messages: ClaudeStreamMessage[]) => void;
  /** 启用同步（默认 false，避免性能开销） */
  enabled?: boolean;
}

/**
 * RealtimeSync 组件
 *
 * 注意：此组件不渲染任何 UI，仅用于后台同步
 */
export const RealtimeSync: React.FC<RealtimeSyncProps> = ({
  sessionId,
  projectId,
  projectPath,
  messages,
  isStreaming,
  onMessagesUpdate,
  enabled = false,
}) => {
  // 缓存上一次发送的消息数量，避免重复发送
  const lastSentCountRef = useRef(0);

  // WebSocket 连接
  const { state, send, on, connect, close } = useWebSocket({
    autoReconnect: enabled,
  });

  // 处理接收到的会话消息
  const handleSessionMessage = useCallback(
    (payload: SessionMessagePayload) => {
      // 只处理当前会话的消息
      if (
        sessionId &&
        payload.sessionId === sessionId &&
        onMessagesUpdate &&
        payload.messages.length > 0
      ) {
        console.log(
          `[RealtimeSync] Received ${payload.messages.length} new messages from remote window`
        );
        onMessagesUpdate(payload.messages);
      }
    },
    [sessionId, onMessagesUpdate]
  );

  // 处理接收到的会话状态更新
  const handleSessionStatus = useCallback(
    (payload: SessionStatusPayload) => {
      // 只处理当前会话的状态
      if (sessionId && payload.sessionId === sessionId) {
        console.log(
          `[RealtimeSync] Session status changed to: ${payload.status}`,
          payload.error
        );
        // TODO: 根据状态更新 UI
      }
    },
    [sessionId]
  );

  // 注册事件监听器
  useEffect(() => {
    if (!enabled) return;

    const unsubscribes = [
      on('onSessionMessage', handleSessionMessage),
      on('onSessionStatus', handleSessionStatus),
      on('onStateChange', (newState) => {
        console.log('[RealtimeSync] Connection state changed:', newState);
      }),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [enabled, on, handleSessionMessage, handleSessionStatus]);

  // 启用时自动连接
  useEffect(() => {
    if (enabled) {
      console.log('[RealtimeSync] Enabling real-time sync, connecting...');
      connect();
    } else if (!enabled) {
      console.log('[RealtimeSync] Disabling real-time sync, disconnecting...');
      close();
    }

    return () => {
      if (enabled) {
        close();
      }
    };
  }, [enabled, connect, close]);

  // 发送消息更新（当消息列表变化时）
  useEffect(() => {
    if (!enabled || !sessionId || !projectId || state !== 'connected') return;

    // 只发送新增消息（避免重复发送整个列表）
    const newMessageCount = messages.length - lastSentCountRef.current;
    if (newMessageCount > 0) {
      const newMessages = messages.slice(-newMessageCount);

      const payload: SessionMessagePayload = {
        sessionId,
        projectId,
        projectPath,
        messages: newMessages,
        isStreaming,
      };

      send('session:message', payload);
      lastSentCountRef.current = messages.length;

      console.log(
        `[RealtimeSync] Sent ${newMessages.length} new messages to remote windows`
      );
    }
  }, [
    enabled,
    sessionId,
    projectId,
    projectPath,
    messages,
    isStreaming,
    state,
    send,
  ]);

  // 组件卸载时关闭连接
  useEffect(() => {
    return () => {
      if (enabled) {
        close();
      }
    };
  }, [enabled, close]);

  // 不渲染任何内容
  return null;
};

export default RealtimeSync;
