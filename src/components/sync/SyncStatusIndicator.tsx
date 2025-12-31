/**
 * SyncStatusIndicator 组件
 *
 * 实时同步状态指示器，显示 WebSocket 连接状态
 * - 绿色：已连接
 * - 黄色：连接中/重连中
 * - 红色：连接错误
 * - 灰色：未连接
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { WebSocketState } from '@/types/websocket';

export interface SyncStatusIndicatorProps {
  /** 连接状态 */
  state: WebSocketState;
  /** 窗口 ID */
  windowId?: string;
  /** 自定义类名 */
  className?: string;
  /** 点击时重连 */
  onReconnect?: () => void;
}

// 状态配置
const STATE_CONFIG: Record<
  WebSocketState,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    label: string;
    description: string;
    pulse: boolean;
  }
> = {
  connected: {
    icon: Wifi,
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    label: '已连接',
    description: '实时同步已启用，消息将跨窗口同步',
    pulse: false,
  },
  connecting: {
    icon: RefreshCw,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    label: '连接中',
    description: '正在建立连接...',
    pulse: true,
  },
  reconnecting: {
    icon: RefreshCw,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    label: '重连中',
    description: '正在尝试重新连接...',
    pulse: true,
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    label: '连接错误',
    description: '连接失败，点击重试',
    pulse: false,
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    label: '未连接',
    description: '实时同步已禁用',
    pulse: false,
  },
};

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  state,
  windowId,
  className,
  onReconnect,
}) => {
  const config = STATE_CONFIG[state];
  const IconComponent = config.icon;

  const handleClick = () => {
    if ((state === 'error' || state === 'disconnected') && onReconnect) {
      onReconnect();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full cursor-default',
              config.bgColor,
              (state === 'error' || state === 'disconnected') &&
                onReconnect &&
                'cursor-pointer hover:opacity-80',
              className
            )}
            onClick={handleClick}
            whileTap={
              (state === 'error' || state === 'disconnected') && onReconnect
                ? { scale: 0.95 }
                : undefined
            }
          >
            {/* 状态图标 */}
            <motion.div
              animate={
                config.pulse
                  ? {
                      rotate: [0, 360],
                    }
                  : undefined
              }
              transition={
                config.pulse
                  ? {
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }
                  : undefined
              }
            >
              <IconComponent
                className={cn('h-3 w-3', config.color)}
              />
            </motion.div>

            {/* 状态点 */}
            <motion.div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                state === 'connected'
                  ? 'bg-green-500'
                  : state === 'connecting' || state === 'reconnecting'
                  ? 'bg-yellow-500'
                  : state === 'error'
                  ? 'bg-red-500'
                  : 'bg-muted-foreground'
              )}
              animate={
                config.pulse
                  ? {
                      opacity: [1, 0.4, 1],
                    }
                  : undefined
              }
              transition={
                config.pulse
                  ? {
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : undefined
              }
            />

            {/* 状态标签 */}
            <span className={cn('text-xs font-medium', config.color)}>
              {config.label}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
            {windowId && (
              <p className="text-xs text-muted-foreground/70">
                窗口 ID: {windowId.slice(0, 16)}...
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SyncStatusIndicator;
