import { logger } from '@/lib/logger';

/**
 * Window Heartbeat Worker
 *
 * 功能:
 * - 不受 Page Visibility 节流影响
 * - 持续发送心跳信号
 * - 检测窗口是否被"冻结"
 */

interface HeartbeatConfig {
  interval: number;
  windowId: string;
}

let heartbeatTimer: number | null = null;
let config: HeartbeatConfig | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      config = payload as HeartbeatConfig;
      startHeartbeat();
      break;

    case 'STOP':
      stopHeartbeat();
      break;

    case 'PING':
      self.postMessage({ type: 'PONG', timestamp: Date.now() });
      break;
  }
};

function startHeartbeat() {
  if (!config || heartbeatTimer !== null) return;

  heartbeatTimer = self.setInterval(() => {
    self.postMessage({
      type: 'HEARTBEAT',
      windowId: config!.windowId,
      timestamp: Date.now(),
    });
  }, config.interval);

  logger.debug('windowHeartbeat.worker', `[Worker] Heartbeat started for window ${config.windowId}`);
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    self.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    logger.debug('windowHeartbeat.worker', '[Worker] Heartbeat stopped');
  }
}
