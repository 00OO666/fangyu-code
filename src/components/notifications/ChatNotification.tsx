/**
 * 聊天内通知组件
 *
 * 显示在聊天输入框上方，用于提示聊天过程中的操作结果
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
  className: string;
  bgClassName: string;
}> = {
  success: {
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
    bgClassName: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
  },
  error: {
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
  },
  info: {
    icon: Info,
    className: 'text-blue-600 dark:text-blue-400',
    bgClassName: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  },
};

interface ChatNotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const ChatNotificationItem: React.FC<ChatNotificationItemProps> = ({ notification, onClose }) => {
  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-sm',
        config.bgClassName
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.className)} />

      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium', config.className)}>
          {notification.message}
        </div>
        {notification.description && (
          <div className="text-xs text-muted-foreground mt-1">
            {notification.description}
          </div>
        )}
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            className={cn(
              'text-xs font-medium mt-2 underline hover:no-underline',
              config.className
            )}
          >
            {notification.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onClose(notification.id)}
        className="flex-shrink-0 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </motion.div>
  );
};

export const ChatNotification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      if (notification.position === 'chat') {
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
            return [...prev, notification];
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleClose = (id: string) => {
    notificationService.close(id);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-2">
      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
          {notifications.map(notification => (
            <ChatNotificationItem
              key={notification.id}
              notification={notification}
              onClose={handleClose}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
};
