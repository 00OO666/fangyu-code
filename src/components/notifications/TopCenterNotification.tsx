/**
 * 顶部居中通知组件
 *
 * 显示在整个应用界面的顶部居中，层级最高（使用 CSS 变量 --z-notification）
 * 用于：模型切换、Plan 模式切换、设置更改等重要全局通知
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { notificationService } from "@/services/notificationService";
import type { Notification, NotificationType } from "@/types/notification";

const typeConfig: Record<
  NotificationType,
  {
    icon: React.FC<{ className?: string }>;
    iconClassName: string;
    bgClassName: string;
    borderClassName: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClassName: "text-green-500",
    bgClassName: "bg-green-500/15",
    borderClassName: "border-green-500/30",
  },
  error: {
    icon: XCircle,
    iconClassName: "text-red-500",
    bgClassName: "bg-red-500/15",
    borderClassName: "border-red-500/30",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-amber-500",
    bgClassName: "bg-amber-500/15",
    borderClassName: "border-amber-500/30",
  },
  info: {
    icon: Info,
    iconClassName: "text-blue-500",
    bgClassName: "bg-blue-500/15",
    borderClassName: "border-blue-500/30",
  },
};

interface TopCenterNotificationProps {
  className?: string;
}

export const TopCenterNotification: React.FC<TopCenterNotificationProps> = ({ className }) => {
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((newNotification) => {
      if (newNotification.position === "top-center") {
        if (newNotification.duration === 0) {
          // 关闭通知 - 使用函数式更新来访问最新状态
          setNotification((current) => {
            if (current?.id === newNotification.id) {
              return null;
            }
            return current;
          });
        } else {
          // 显示新通知
          setNotification(newNotification);
        }
      }
    });

    return unsubscribe;
  }, []); // Empty dependency array - only subscribe once on mount

  if (!notification) return null;

  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <div className={cn("fixed top-4 left-1/2 -translate-x-1/2", className)} style={{ zIndex: 'var(--z-notification)' }}>
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl",
              "bg-background/95",
              config.bgClassName,
              config.borderClassName,
            )}
          >
            <Icon className={cn("h-5 w-5 flex-shrink-0", config.iconClassName)} />

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{notification.message}</div>
              {notification.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {notification.description}
                </div>
              )}
            </div>

            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg",
                  config.bgClassName,
                  "hover:brightness-110 transition-all",
                )}
              >
                {notification.action.label}
              </button>
            )}

            <button
              onClick={() => notificationService.close(notification.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-foreground/10 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
