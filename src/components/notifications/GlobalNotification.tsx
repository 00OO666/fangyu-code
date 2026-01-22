/**
 * 全局通知组件
 *
 * 显示在顶部标题栏右侧，用于提示非聊天窗口的设置更改
 * 如：MCP/Hook/Skill 的开启关闭、系统设置更改等
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import Info from 'lucide-react/dist/esm/icons/info'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import X from 'lucide-react/dist/esm/icons/x';
import { cn } from '@/lib/utils';
import { Notification, NotificationType } from '@/types/notification';
import { notificationService } from '@/services/notificationService';

const typeConfig: Record<NotificationType, {
  icon: React.FC<{ className?: string }>;
  iconClassName: string;
  bgClassName: string;
  borderClassName: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-emerald-500',
    bgClassName: 'bg-emerald-500/10',
    borderClassName: 'border-emerald-500/20',
  },
  error: {
    icon: XCircle,
    iconClassName: 'text-red-500',
    bgClassName: 'bg-red-500/10',
    borderClassName: 'border-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-amber-500',
    bgClassName: 'bg-amber-500/10',
    borderClassName: 'border-amber-500/20',
  },
  info: {
    icon: Info,
    iconClassName: 'text-blue-500',
    bgClassName: 'bg-blue-500/10',
    borderClassName: 'border-blue-500/20',
  },
};

interface GlobalNotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const GlobalNotificationItem: React.FC<GlobalNotificationItemProps> = ({ notification, onClose }) => {
  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm shadow-lg',
        config.bgClassName,
        config.borderClassName
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', config.iconClassName)} />

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">
          {notification.message}
        </div>
        {notification.description && (
          <div className="text-[10px] text-muted-foreground truncate">
            {notification.description}
          </div>
        )}
      </div>

      {notification.action && (
        <button
          onClick={notification.action.onClick}
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full',
            config.bgClassName,
            'hover:brightness-110 transition-all'
          )}
        >
          {notification.action.label}
        </button>
      )}

      <button
        onClick={() => onClose(notification.id)}
        className="flex-shrink-0 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </motion.div>
  );
};

interface GlobalNotificationProps {
  className?: string;
  maxVisible?: number;
}

export const GlobalNotification: React.FC<GlobalNotificationProps> = ({
  className,
  maxVisible = 3,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      if (notification.position === 'global') {
        if (notification.duration === 0) {
          // 关闭通知
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        } else {
          // 添加或更新通知
          setNotifications(prev => {
            const exists = prev.find(n => n.id === notification.id);
            if (exists) {
              return prev.map(n => n.id === notification.id ? notification : n);
            }
            // 限制最大数量，移除最早的
            const newList = [...prev, notification];
            if (newList.length > maxVisible) {
              return newList.slice(-maxVisible);
            }
            return newList;
          });
        }
      }
    });

    return unsubscribe;
  }, [maxVisible]);

  const handleClose = (id: string) => {
    notificationService.close(id);
  };

  if (notifications.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence mode="popLayout">
        {notifications.map(notification => (
          <GlobalNotificationItem
            key={notification.id}
            notification={notification}
            onClose={handleClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
