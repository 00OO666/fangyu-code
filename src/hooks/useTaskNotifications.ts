/**
 * useTaskNotifications - 后台任务通知 Hook
 *
 * 功能:
 * - 监听任务状态变化
 * - 发送系统通知（完成、失败）
 * - 播放提示音
 * - 显示桌面通知
 *
 * 来源: Cursor/Windsurf 任务完成通知
 */

import { logger } from "@/lib/logger";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface TaskNotificationOptions {
  /** 是否启用系统通知 */
  enableSystemNotification?: boolean;
  /** 是否启用声音提示 */
  enableSound?: boolean;
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 要监听的会话ID（可选） */
  sessionId?: string;
}

interface TaskState {
  id: string;
  name: string;
  status: string;
  result?: {
    success: boolean;
    error?: string;
    duration_ms: number;
  };
}

/**
 * 使用系统通知 API
 */
async function sendSystemNotification(title: string, body: string, icon?: string) {
  // 检查通知权限
  if (!("Notification" in window)) {
    logger.warn("useTaskNotifications", "浏览器不支持通知");
    return;
  }

  if (Notification.permission === "denied") {
    logger.warn("useTaskNotifications", "通知权限被拒绝");
    return;
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      logger.warn("useTaskNotifications", "通知权限请求被拒绝");
      return;
    }
  }

  // 发送通知
  const notification = new Notification(title, {
    body,
    icon: icon || "/icon.png",
    tag: "fangyu-code-task",
    requireInteraction: false,
  });

  // 点击通知时聚焦窗口
  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // 自动关闭
  setTimeout(() => {
    notification.close();
  }, 5000);
}

/**
 * 播放提示音
 */
function playNotificationSound(type: "success" | "error") {
  try {
    // 使用 Web Audio API 生成简单提示音
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === "success") {
      // 成功音效：上升音调
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    } else {
      // 失败音效：下降音调
      oscillator.frequency.setValueAtTime(392.0, audioContext.currentTime); // G4
      oscillator.frequency.setValueAtTime(329.63, audioContext.currentTime + 0.15); // E4
    }

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    logger.warn("useTaskNotifications", "播放提示音失败:", error);
  }
}

/**
 * 后台任务通知 Hook
 */
export function useTaskNotifications(options: TaskNotificationOptions = {}) {
  const {
    enableSystemNotification = true,
    enableSound = true,
    pollingInterval = 2000,
    sessionId,
  } = options;

  // 记录上次已知的任务状态
  const lastTaskStatesRef = useRef<Map<string, TaskState>>(new Map());

  // 处理任务状态变化
  const handleTaskStateChange = useCallback(
    async (task: TaskState, previousState?: TaskState) => {
      // 只处理状态变化
      if (!previousState || previousState.status === task.status) {
        return;
      }

      // 任务完成
      if (task.status === "completed" && previousState.status === "running") {
        const duration = task.result?.duration_ms
          ? (task.result.duration_ms / 1000).toFixed(1)
          : "?";

        if (enableSystemNotification) {
          await sendSystemNotification("✅ 任务完成", `${task.name} 已完成，耗时 ${duration}秒`);
        }

        if (enableSound) {
          playNotificationSound("success");
        }
      }

      // 任务失败
      if (task.status === "failed" && previousState.status === "running") {
        const errorMsg = task.result?.error || "未知错误";

        if (enableSystemNotification) {
          await sendSystemNotification("❌ 任务失败", `${task.name}: ${errorMsg}`);
        }

        if (enableSound) {
          playNotificationSound("error");
        }
      }

      // 任务被取消
      if (task.status === "cancelled" && previousState.status === "running") {
        if (enableSystemNotification) {
          await sendSystemNotification("⚠️ 任务已取消", task.name);
        }
      }
    },
    [enableSystemNotification, enableSound]
  );

  // 轮询检查任务状态
  useEffect(() => {
    let isMounted = true;

    const checkTasks = async () => {
      if (!isMounted) return;

      try {
        const tasks = await api.listBackgroundTasks(sessionId, false);

        for (const task of tasks) {
          const taskState: TaskState = {
            id: task.id,
            name: task.name,
            status: task.status,
            result: task.result,
          };

          const previousState = lastTaskStatesRef.current.get(task.id);
          await handleTaskStateChange(taskState, previousState);

          lastTaskStatesRef.current.set(task.id, taskState);
        }

        // 清理不存在的任务
        const currentTaskIds = new Set(tasks.map((t: any) => t.id));
        for (const id of lastTaskStatesRef.current.keys()) {
          if (!currentTaskIds.has(id)) {
            lastTaskStatesRef.current.delete(id);
          }
        }
      } catch (error) {
        // 静默处理错误（任务管理器可能未初始化）
      }
    };

    // 立即检查一次
    checkTasks();

    // 定时轮询
    const intervalId = setInterval(checkTasks, pollingInterval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [sessionId, pollingInterval, handleTaskStateChange]);

  // 返回手动触发通知的方法
  return {
    notifySuccess: (taskName: string, duration?: number) => {
      if (enableSystemNotification) {
        const durationStr = duration ? `，耗时 ${(duration / 1000).toFixed(1)}秒` : "";
        sendSystemNotification("✅ 任务完成", `${taskName}${durationStr}`);
      }
      if (enableSound) {
        playNotificationSound("success");
      }
    },
    notifyError: (taskName: string, error?: string) => {
      if (enableSystemNotification) {
        sendSystemNotification("❌ 任务失败", `${taskName}: ${error || "未知错误"}`);
      }
      if (enableSound) {
        playNotificationSound("error");
      }
    },
    requestPermission: async () => {
      if ("Notification" in window && Notification.permission === "default") {
        return await Notification.requestPermission();
      }
      return Notification.permission;
    },
  };
}

export default useTaskNotifications;
