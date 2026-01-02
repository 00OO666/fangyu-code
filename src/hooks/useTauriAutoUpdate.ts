/**
 * Tauri 自动更新 Hook
 *
 * 功能：
 * 1. 应用启动时自动检查更新
 * 2. 下载并验证更新包
 * 3. 安装后自动重启
 * 4. 支持手动触发检查
 */

import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  body?: string;
  date?: string;
}

export interface UseAutoUpdateReturn {
  updateInfo: UpdateInfo | null;
  checking: boolean;
  downloading: boolean;
  installing: boolean;
  error: string | null;
  downloadProgress: number;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export function useTauriAutoUpdate(
  options: {
    checkOnMount?: boolean;
    autoCheckInterval?: number; // 分钟
  } = {},
): UseAutoUpdateReturn {
  const { checkOnMount = true, autoCheckInterval = 60 } = options;

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  // 检查更新
  const checkForUpdates = useCallback(async () => {
    if (checking) return;

    setChecking(true);
    setError(null);

    try {
      console.log("[Auto Update] Checking for updates...");
      const update = await check();

      if (update) {
        console.log("[Auto Update] Update available:", update);
        setUpdateInfo({
          available: true,
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          body: update.body,
          date: update.date,
        });
        setPendingUpdate(update);
      } else {
        console.log("[Auto Update] No update available");
        setUpdateInfo({
          available: false,
          currentVersion: "", // Tauri 会自动填充
          latestVersion: "",
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "检查更新失败";
      console.error("[Auto Update] Check failed:", errorMsg);
      setError(errorMsg);
    } finally {
      setChecking(false);
    }
  }, [checking]);

  // 下载并安装更新
  const installUpdate = useCallback(async () => {
    if (!pendingUpdate) {
      setError("没有可用的更新");
      return;
    }

    setDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      console.log("[Auto Update] Downloading update...");

      // 下载更新包
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            console.log("[Auto Update] Download started, contentLength:", event.data.contentLength);
            setDownloadProgress(0);
            break;
          case "Progress": {
            // 🔧 FIX: 安全计算进度，避免 NaN 和 Infinity
            const downloaded = event.data.downloaded ?? 0;
            const total = event.data.contentLength ?? 0;
            let progress = 0;

            if (total > 0) {
              progress = Math.round((downloaded / total) * 100);
              // 确保进度在 0-100 范围内
              progress = Math.max(0, Math.min(100, progress));
            } else if (downloaded > 0) {
              // 如果无法获取总大小，显示已下载大小（MB）
              progress = Math.min(99, Math.floor(downloaded / 1024 / 1024)); // 每 MB 加 1%
            }

            // 确保不是 NaN
            if (isNaN(progress)) {
              progress = 0;
              console.warn("[Auto Update] Progress calculation resulted in NaN");
            }

            console.log(
              `[Auto Update] Download progress: ${progress}% (${downloaded}/${total} bytes)`,
            );
            setDownloadProgress(progress);
            break;
          }
          case "Finished":
            console.log("[Auto Update] Download finished");
            setDownloadProgress(100);
            break;
        }
      });

      setDownloading(false);
      setInstalling(true);

      // 安装完成，准备重启
      console.log("[Auto Update] Installing update and restarting...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 短暂延迟让用户看到进度

      // 重启应用
      await relaunch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "更新失败";
      console.error("[Auto Update] Install failed:", errorMsg);
      setError(errorMsg);
      setDownloading(false);
      setInstalling(false);
    }
  }, [pendingUpdate]);

  // 启动时检查更新
  useEffect(() => {
    if (checkOnMount) {
      // 延迟 5 秒检查，避免影响启动速度
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkForUpdates]);

  // 定时检查更新
  useEffect(() => {
    if (!autoCheckInterval) return;

    const interval = setInterval(
      () => {
        checkForUpdates();
      },
      autoCheckInterval * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [autoCheckInterval, checkForUpdates]);

  return {
    updateInfo,
    checking,
    downloading,
    installing,
    error,
    downloadProgress,
    checkForUpdates,
    installUpdate,
  };
}
