/**
 * 操作通知服务
 *
 * 提供统一的通知管理，支持两种位置：
 * 1. chat - 聊天输入框上方
 * 2. global - 顶部标题栏右侧
 */

import {
  type Notification,
  type NotificationOptions,
  type NotificationPosition,
  NotificationType,
} from "@/types/notification";

type NotificationListener = (notification: Notification) => void;

class NotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private notifications: Map<string, Notification> = new Map();
  private idCounter = 0;

  /**
   * 订阅通知事件
   */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 发送通知
   */
  notify(message: string, options?: NotificationOptions): string {
    const notification: Notification = {
      id: `notification-${++this.idCounter}-${Date.now()}`,
      type: options?.type || "info",
      message,
      description: options?.description,
      position: options?.position || "chat",
      duration: options?.duration ?? 3000,
      timestamp: Date.now(),
      action: options?.action,
    };

    this.notifications.set(notification.id, notification);
    this.emit(notification);

    // 自动关闭
    if (notification.duration > 0) {
      setTimeout(() => {
        this.close(notification.id);
      }, notification.duration);
    }

    return notification.id;
  }

  /**
   * 发送成功通知
   */
  success(message: string, options?: Omit<NotificationOptions, "type">): string {
    return this.notify(message, { ...options, type: "success" });
  }

  /**
   * 发送错误通知
   */
  error(message: string, options?: Omit<NotificationOptions, "type">): string {
    return this.notify(message, { ...options, type: "error" });
  }

  /**
   * 发送信息通知
   */
  info(message: string, options?: Omit<NotificationOptions, "type">): string {
    return this.notify(message, { ...options, type: "info" });
  }

  /**
   * 发送警告通知
   */
  warning(message: string, options?: Omit<NotificationOptions, "type">): string {
    return this.notify(message, { ...options, type: "warning" });
  }

  /**
   * 关闭通知
   */
  close(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.delete(id);
      this.emit({ ...notification, duration: 0 });
    }
  }

  /**
   * 关闭所有通知
   */
  closeAll(): void {
    this.notifications.forEach((_, id) => this.close(id));
  }

  /**
   * 触发监听器
   */
  private emit(notification: Notification): void {
    this.listeners.forEach((listener) => listener(notification));
  }

  /**
   * 获取所有活跃通知
   */
  getActiveNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * 获取指定位置的活跃通知
   */
  getNotificationsByPosition(position: NotificationPosition): Notification[] {
    return Array.from(this.notifications.values()).filter((n) => n.position === position);
  }
}

// 单例实例
export const notificationService = new NotificationService();

// 便捷方法
export const notify = {
  success: (message: string, options?: Omit<NotificationOptions, "type">) =>
    notificationService.success(message, options),
  error: (message: string, options?: Omit<NotificationOptions, "type">) =>
    notificationService.error(message, options),
  info: (message: string, options?: Omit<NotificationOptions, "type">) =>
    notificationService.info(message, options),
  warning: (message: string, options?: Omit<NotificationOptions, "type">) =>
    notificationService.warning(message, options),
  close: (id: string) => notificationService.close(id),
  closeAll: () => notificationService.closeAll(),
};
