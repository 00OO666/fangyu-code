/**
 * Tauri 自动更新 Hook - v2.0 增强版
 *
 * 功能：
 * 1. 应用启动时自动检查更新
 * 2. 下载并验证更新包
 * 3. 安装后自动重启
 * 4. 支持手动触发检查
 * 5. 支持跳过特定版本
 * 6. 支持暂时关闭更新提示
 */

import { logger } from '@/lib/logger';
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_SKIPPED = "fangyu-code-skipped-version";
const STORAGE_KEY_DISMISSED = "fangyu-code-dismissed-update";

// 重试配置
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1秒

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
  isDismissed: boolean;
  checkForUpdates: (force?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  skipVersion: () => void;
  dismissUpdate: () => void;
  showUpdate: () => void;
  retryCheck: () => Promise<void>;
}

export function useTauriAutoUpdate(
  options: {
    checkOnMount?: boolean;
    autoCheckInterval?: number; // 分钟
  } = {},
): UseAutoUpdateReturn {
  const { checkOnMount = true, autoCheckInterval = 0 } = options; // 默认关闭自动检查

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // 检查版本是否被跳过
  const isVersionSkipped = useCallback((version: string): boolean => {
    try {
      const skipped = localStorage.getItem(STORAGE_KEY_SKIPPED);
      return skipped === version;
    } catch {
      return false;
    }
  }, []);

  // 检查更新是否被暂时关闭
  const isUpdateDismissed = useCallback((version: string): boolean => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
      return dismissed === version;
    } catch {
      return false;
    }
  }, []);

  // 检查更新（带重试逻辑）
  const checkForUpdates = useCallback(async (force: boolean = false) => {
    // 开发模式下跳过更新检查
    if (import.meta.env.DEV) {
      logger.debug('useTauriAutoUpdate', "[Auto Update] Skipping update check in development mode");
      return;
    }

    if (checking) return;

    setChecking(true);
    setError(null);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug('useTauriAutoUpdate', `[Auto Update] Retry attempt ${attempt + 1}/${MAX_RETRIES}...`);
        } else {
          logger.debug('useTauriAutoUpdate', "[Auto Update] Checking for updates...");
        }

        const update = await check();

        if (update) {
          logger.debug('useTauriAutoUpdate', "[Auto Update] Update available:", update);

          // 检查是否被跳过或暂时关闭
          const skipped = !force && isVersionSkipped(update.version);
          const dismissed = !force && isUpdateDismissed(update.version);

          if (skipped) {
            logger.debug('useTauriAutoUpdate', "[Auto Update] Version skipped by user:", update.version);
            setUpdateInfo(null);
            setChecking(false);
            return;
          }

          setUpdateInfo({
            available: true,
            currentVersion: update.currentVersion,
            latestVersion: update.version,
            body: update.body,
            date: update.date,
          });
          setPendingUpdate(update);
          setIsDismissed(dismissed);
        } else {
          logger.debug('useTauriAutoUpdate', "[Auto Update] No update available");
          setUpdateInfo({
            available: false,
            currentVersion: "",
            latestVersion: "",
          });
        }

        // 成功，退出重试循环
        setChecking(false);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn('useTauriAutoUpdate', `[Auto Update] Check failed (attempt ${attempt + 1});:`, lastError.message);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          logger.debug('useTauriAutoUpdate', `[Auto Update] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败
    const errorMsg = lastError?.message || "检查更新失败";
    logger.error('useTauriAutoUpdate', "[Auto Update] All retries failed:", errorMsg);

    // 网络错误时静默处理，不显示错误给用户
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
      logger.debug('useTauriAutoUpdate', "[Auto Update] Network unavailable, skipping update check silently");
    } else {
      setError(errorMsg);
    }

    setChecking(false);
  }, [checking, isVersionSkipped, isUpdateDismissed]);

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
      logger.debug('useTauriAutoUpdate', "[Auto Update] Downloading update...");

      // 下载更新包
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            logger.debug('useTauriAutoUpdate', "[Auto Update] Download started, contentLength:", (event.data as any).contentLength);
            setDownloadProgress(0);
            break;
          case "Progress": {
            const eventData = event.data as { downloaded?: number; contentLength?: number; chunkLength?: number };
            const downloaded = eventData.downloaded ?? 0;
            const total = eventData.contentLength ?? 0;
            let progress = 0;

            if (total > 0) {
              progress = Math.round((downloaded / total) * 100);
              progress = Math.max(0, Math.min(100, progress));
            } else if (downloaded > 0) {
              progress = Math.min(99, Math.floor(downloaded / 1024 / 1024));
            }

            if (isNaN(progress)) {
              progress = 0;
              logger.warn('useTauriAutoUpdate', "[Auto Update] Progress calculation resulted in NaN");
            }

            console.log(
              `[Auto Update] Download progress: ${progress}% (${downloaded}/${total} bytes)`,
            );
            setDownloadProgress(progress);
            break;
          }
          case "Finished":
            logger.debug('useTauriAutoUpdate', "[Auto Update] Download finished");
            setDownloadProgress(100);
            break;
        }
      });

      setDownloading(false);
      setInstalling(true);

      // 安装完成，准备重启
      logger.debug('useTauriAutoUpdate', "[Auto Update] Installing update and restarting...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重启应用
      await relaunch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "更新失败";
      logger.error('useTauriAutoUpdate', "[Auto Update] Install failed:", errorMsg);
      setError(errorMsg);
      setDownloading(false);
      setInstalling(false);
    }
  }, [pendingUpdate]);

  // 跳过此版本
  const skipVersion = useCallback(() => {
    if (updateInfo?.latestVersion) {
      try {
        localStorage.setItem(STORAGE_KEY_SKIPPED, updateInfo.latestVersion);
        logger.debug('useTauriAutoUpdate', "[Auto Update] Version skipped:", updateInfo.latestVersion);
        setUpdateInfo(null);
        setPendingUpdate(null);
      } catch (err) {
        logger.error('useTauriAutoUpdate', "[Auto Update] Failed to skip version:", err);
      }
    }
  }, [updateInfo]);

  // 暂时关闭更新提示
  const dismissUpdate = useCallback(() => {
    if (updateInfo?.latestVersion) {
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED, updateInfo.latestVersion);
        logger.debug('useTauriAutoUpdate', "[Auto Update] Update dismissed:", updateInfo.latestVersion);
        setIsDismissed(true);
      } catch (err) {
        logger.error('useTauriAutoUpdate', "[Auto Update] Failed to dismiss update:", err);
      }
    }
  }, [updateInfo]);

  // 重新显示更新提示
  const showUpdate = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_DISMISSED);
      setIsDismissed(false);
      logger.debug('useTauriAutoUpdate', "[Auto Update] Update shown again");
    } catch (err) {
      logger.error('useTauriAutoUpdate', "[Auto Update] Failed to show update:", err);
    }
  }, []);

  // 重试检查
  const retryCheck = useCallback(async () => {
    setError(null);
    await checkForUpdates(true);
  }, [checkForUpdates]);

  // 启动时检查更新
  useEffect(() => {
    if (checkOnMount) {
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkForUpdates]);

  // 定时检查更新（默认关闭）
  useEffect(() => {
    if (!autoCheckInterval || autoCheckInterval <= 0) return;

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
    isDismissed,
    checkForUpdates,
    installUpdate,
    skipVersion,
    dismissUpdate,
    showUpdate,
    retryCheck,
  };
}
