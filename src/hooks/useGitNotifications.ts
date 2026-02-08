/**
 * useGitNotifications Hook
 *
 * 监听 Git 操作事件（pre-commit hook、commit、push 等）
 * 并显示全局通知，让用户知道后台发生了什么
 */

import { logger } from "@/lib/logger";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { notify } from "@/services/notificationService";
import { NotificationTemplates } from "@/types/notification";

interface GitFormatEvent {
  filesCount: number;
}

interface GitCommitEvent {
  commitHash: string;
  message: string;
}

interface GitPushEvent {
  branch: string;
  remote: string;
}

export function useGitNotifications() {
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const activeNotificationIds = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const setupListeners = async () => {
      // 监听格式化开始
      const formatStartUnlisten = await listen("git-format-start", () => {
        const id = notify.info(
          NotificationTemplates.gitFormatting().message,
          NotificationTemplates.gitFormatting()
        );
        activeNotificationIds.current.set("format", id);
      });
      unlistenRefs.current.push(formatStartUnlisten);

      // 监听格式化完成
      const formatCompleteUnlisten = await listen<GitFormatEvent>(
        "git-format-complete",
        (event) => {
          // 关闭之前的"正在格式化"通知
          const prevId = activeNotificationIds.current.get("format");
          if (prevId) {
            notify.close(prevId);
            activeNotificationIds.current.delete("format");
          }

          // 显示完成通知
          const template = NotificationTemplates.gitFormatComplete(event.payload.filesCount);
          notify.success(template.message, template);
        }
      );
      unlistenRefs.current.push(formatCompleteUnlisten);

      // 监听提交开始
      const commitStartUnlisten = await listen("git-commit-start", () => {
        const id = notify.info(
          NotificationTemplates.gitCommitStart().message,
          NotificationTemplates.gitCommitStart()
        );
        activeNotificationIds.current.set("commit", id);
      });
      unlistenRefs.current.push(commitStartUnlisten);

      // 监听提交完成
      const commitCompleteUnlisten = await listen<GitCommitEvent>(
        "git-commit-complete",
        (event) => {
          // 关闭之前的"正在提交"通知
          const prevId = activeNotificationIds.current.get("commit");
          if (prevId) {
            notify.close(prevId);
            activeNotificationIds.current.delete("commit");
          }

          // 显示完成通知
          const template = NotificationTemplates.gitCommitComplete(event.payload.commitHash);
          notify.success(template.message, template);
        }
      );
      unlistenRefs.current.push(commitCompleteUnlisten);

      // 监听推送开始
      const pushStartUnlisten = await listen("git-push-start", () => {
        const id = notify.info(
          NotificationTemplates.gitPushStart().message,
          NotificationTemplates.gitPushStart()
        );
        activeNotificationIds.current.set("push", id);
      });
      unlistenRefs.current.push(pushStartUnlisten);

      // 监听推送完成
      const pushCompleteUnlisten = await listen<GitPushEvent>("git-push-complete", () => {
        // 关闭之前的"正在推送"通知
        const prevId = activeNotificationIds.current.get("push");
        if (prevId) {
          notify.close(prevId);
          activeNotificationIds.current.delete("push");
        }

        // 显示完成通知
        const template = NotificationTemplates.gitPushComplete();
        notify.success(template.message, template);
      });
      unlistenRefs.current.push(pushCompleteUnlisten);

      logger.debug("useGitNotifications", "[GitNotifications] ✅ Git event listeners registered");
    };

    setupListeners();

    // 清理
    return () => {
      unlistenRefs.current.forEach((unlisten) => unlisten());
      unlistenRefs.current = [];
      activeNotificationIds.current.clear();
    };
  }, []);
}

export default useGitNotifications;
