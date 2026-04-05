/**
 * useNotify Hook - 便捷的通知系统钩子
 *
 * 提供简单易用的通知 API，自动处理组件生命周期
 */

import { useCallback } from "react";
import { notificationService } from "@/services/notificationService";
import {
  type NotificationOptions,
  type NotificationPosition,
  NotificationTemplates,
} from "@/types/notification";

export interface UseNotifyOptions {
  /** 默认通知位置 */
  defaultPosition?: NotificationPosition;
  /** 默认持续时间 */
  defaultDuration?: number;
}

export interface NotifyAPI {
  /** 成功通知 */
  success: (message: string, options?: Partial<NotificationOptions>) => string;
  /** 错误通知 */
  error: (message: string, options?: Partial<NotificationOptions>) => string;
  /** 信息通知 */
  info: (message: string, options?: Partial<NotificationOptions>) => string;
  /** 警告通知 */
  warning: (message: string, options?: Partial<NotificationOptions>) => string;
  /** 关闭通知 */
  close: (id: string) => void;
  /** 关闭所有通知 */
  closeAll: () => void;
  /** 预设模板 */
  templates: typeof NotificationTemplates;
  /** 使用模板发送通知 */
  fromTemplate: <K extends keyof typeof NotificationTemplates>(
    templateName: K,
    ...args: Parameters<(typeof NotificationTemplates)[K]>
  ) => string;
}

/**
 * 通知系统 Hook
 *
 * @example
 * ```tsx
 * // 基础用法
 * const notify = useNotify();
 * notify.success('操作成功');
 * notify.error('操作失败', { description: '请检查网络连接' });
 *
 * // 指定位置
 * const notify = useNotify({ defaultPosition: 'global' });
 * notify.info('设置已保存');
 *
 * // 使用模板
 * notify.fromTemplate('hookEnabled', 'auto-compact');
 * notify.fromTemplate('mcpEnabled', 'GitHub');
 * ```
 */
export function useNotify(options: UseNotifyOptions = {}): NotifyAPI {
  const { defaultPosition = "chat", defaultDuration } = options;

  const mergeOptions = useCallback(
    (opts?: Partial<NotificationOptions>): NotificationOptions => ({
      position: defaultPosition,
      ...(defaultDuration !== undefined && { duration: defaultDuration }),
      ...opts,
    }),
    [defaultPosition, defaultDuration],
  );

  const success = useCallback(
    (message: string, opts?: Partial<NotificationOptions>) => {
      return notificationService.success(message, mergeOptions(opts));
    },
    [mergeOptions],
  );

  const error = useCallback(
    (message: string, opts?: Partial<NotificationOptions>) => {
      return notificationService.error(message, mergeOptions(opts));
    },
    [mergeOptions],
  );

  const info = useCallback(
    (message: string, opts?: Partial<NotificationOptions>) => {
      return notificationService.info(message, mergeOptions(opts));
    },
    [mergeOptions],
  );

  const warning = useCallback(
    (message: string, opts?: Partial<NotificationOptions>) => {
      return notificationService.warning(message, mergeOptions(opts));
    },
    [mergeOptions],
  );

  const close = useCallback((id: string) => {
    notificationService.close(id);
  }, []);

  const closeAll = useCallback(() => {
    notificationService.closeAll();
  }, []);

  const fromTemplate = useCallback(
    <K extends keyof typeof NotificationTemplates>(
      templateName: K,
      ...args: Parameters<(typeof NotificationTemplates)[K]>
    ): string => {
      // @ts-expect-error - TypeScript 无法正确推断模板函数的参数类型
      const template = NotificationTemplates[templateName](...args);
      return notificationService.notify(template.message, {
        ...template,
        position: defaultPosition,
      });
    },
    [defaultPosition],
  );

  return {
    success,
    error,
    info,
    warning,
    close,
    closeAll,
    templates: NotificationTemplates,
    fromTemplate,
  };
}

/**
 * 全局通知 Hook - 默认在标题栏显示
 *
 * @example
 * ```tsx
 * const notify = useGlobalNotify();
 * notify.success('MCP 工具已启用');
 * ```
 */
export function useGlobalNotify(
  options: Omit<UseNotifyOptions, "defaultPosition"> = {},
): NotifyAPI {
  return useNotify({ ...options, defaultPosition: "global" });
}

/**
 * 聊天通知 Hook - 默认在聊天区域显示
 *
 * @example
 * ```tsx
 * const notify = useChatNotify();
 * notify.success('消息已发送');
 * ```
 */
export function useChatNotify(options: Omit<UseNotifyOptions, "defaultPosition"> = {}): NotifyAPI {
  return useNotify({ ...options, defaultPosition: "chat" });
}

// 导出便捷方法（非 Hook，可在任何地方使用）
export const notify = {
  success: (message: string, options?: NotificationOptions) =>
    notificationService.success(message, options),
  error: (message: string, options?: NotificationOptions) =>
    notificationService.error(message, options),
  info: (message: string, options?: NotificationOptions) =>
    notificationService.info(message, options),
  warning: (message: string, options?: NotificationOptions) =>
    notificationService.warning(message, options),
  close: (id: string) => notificationService.close(id),
  closeAll: () => notificationService.closeAll(),

  /** 全局通知（标题栏） */
  global: {
    success: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.success(message, { ...options, position: "global" }),
    error: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.error(message, { ...options, position: "global" }),
    info: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.info(message, { ...options, position: "global" }),
    warning: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.warning(message, { ...options, position: "global" }),
  },

  /** 聊天通知（输入框上方） */
  chat: {
    success: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.success(message, { ...options, position: "chat" }),
    error: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.error(message, { ...options, position: "chat" }),
    info: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.info(message, { ...options, position: "chat" }),
    warning: (message: string, options?: Omit<NotificationOptions, "position">) =>
      notificationService.warning(message, { ...options, position: "chat" }),
  },

  /** 使用预设模板 */
  template: <K extends keyof typeof NotificationTemplates>(
    templateName: K,
    position: NotificationPosition,
    ...args: Parameters<(typeof NotificationTemplates)[K]>
  ): string => {
    // @ts-expect-error Template overloads are heterogeneous across notification factories.
    const template = NotificationTemplates[templateName](...args);
    return notificationService.notify(template.message, {
      ...template,
      position,
    });
  },
};

export default useNotify;
