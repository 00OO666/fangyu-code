import { logger } from "@/lib/logger";
import { getVersion } from "@tauri-apps/api/app";

// 可选导入：在未注册插件或非 Tauri 环境下，调用时会抛错，外层需做兜底
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateChannel = "stable" | "beta";

export interface UpdateInfo {
  currentVersion: string;
  availableVersion: string;
  notes?: string;
  pubDate?: string;
}

export interface UpdateProgressEvent {
  event: "Started" | "Progress" | "Finished";
  total?: number;
  downloaded?: number;
}

export interface UpdateHandle {
  version: string;
  notes?: string;
  date?: string;
  downloadAndInstall: (onProgress?: (e: UpdateProgressEvent) => void) => Promise<void>;
  download?: () => Promise<void>;
  install?: () => Promise<void>;
}

export interface CheckOptions {
  timeout?: number;
  channel?: UpdateChannel;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 是否静默处理网络错误，默认 false */
  silentOnNetworkError?: boolean;
}

export type CheckResult =
  | { status: "up-to-date"; currentVersion: string; skipped?: boolean }
  | { status: "available"; info: UpdateInfo; update: UpdateHandle }
  | { status: "error"; error: string };

function mapUpdateHandle(raw: Update): UpdateHandle {
  return {
    version: (raw as any).version ?? "",
    notes: (raw as any).notes,
    date: (raw as any).date,
    async downloadAndInstall(onProgress?: (e: UpdateProgressEvent) => void) {
      await (raw as any).downloadAndInstall((evt: any) => {
        if (!onProgress) return;
        const mapped: UpdateProgressEvent = {
          event: evt?.event,
        };
        if (evt?.event === "Started") {
          mapped.total = evt?.data?.contentLength ?? 0;
          mapped.downloaded = 0;
        } else if (evt?.event === "Progress") {
          mapped.total = evt?.data?.contentLength ?? mapped.total;
          mapped.downloaded = evt?.data?.downloaded ?? evt?.data?.chunkLength ?? mapped.downloaded;
        } else if (evt?.event === "Finished") {
          mapped.total = evt?.data?.contentLength ?? mapped.total;
          mapped.downloaded = mapped.total;
        }
        onProgress(mapped);
      });
    },
    download: (raw as any).download
      ? async () => {
          await (raw as any).download();
        }
      : undefined,
    install: (raw as any).install
      ? async () => {
          await (raw as any).install();
        }
      : undefined,
  };
}

export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "0.0.0";
  }
}

/**
 * 检查网络是否可用
 */
function isNetworkAvailable(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * 判断是否为网络相关错误
 */
function isNetworkError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("dns")
  );
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkForUpdate(opts: CheckOptions = {}): Promise<CheckResult> {
  const { maxRetries = 3, silentOnNetworkError = false } = opts;

  // 🔧 FIX: 网络不可用时静默跳过
  if (!isNetworkAvailable()) {
    if (silentOnNetworkError) {
      logger.debug("updater", "[Updater] Network unavailable, skipping update check");
      const currentVersion = await getCurrentVersion();
      return { status: "up-to-date", currentVersion, skipped: true };
    }
    return { status: "error", error: "网络不可用，请检查网络连接" };
  }

  let lastError: Error | null = null;

  // 🔧 FIX: 添加重试逻辑，使用指数退避
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 动态引入，避免在未安装插件时导致打包期问题
      const { check } = await import("@tauri-apps/plugin-updater");
      const currentVersion = await getCurrentVersion();
      const update = await check({ timeout: opts.timeout ?? 30000 } as any);
      if (!update) {
        return { status: "up-to-date", currentVersion };
      }

      const mapped = mapUpdateHandle(update);
      const info: UpdateInfo = {
        currentVersion,
        availableVersion: mapped.version,
        notes: mapped.notes,
        pubDate: mapped.date,
      };

      return { status: "available", info, update: mapped };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果是网络错误且还有重试次数，进行重试
      if (isNetworkError(lastError) && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s... 最大 10s
        logger.debug(
          "updater",
          `[Updater] Attempt ${attempt}/${maxRetries} failed, retrying in ${backoffMs}ms...`
        );
        await delay(backoffMs);
        continue;
      }

      // 非网络错误或已用尽重试次数，跳出循环
      break;
    }
  }

  // 所有重试都失败了
  logger.error("updater", "[Updater] Check failed after retries:", lastError);

  // 提供详细的错误信息
  let errorMessage = "检查更新失败";

  if (lastError) {
    errorMessage = lastError.message;

    // 🔧 FIX: 网络错误时静默处理
    if (isNetworkError(lastError) && silentOnNetworkError) {
      logger.debug("updater", "[Updater] Network error, silently skipping");
      const currentVersion = await getCurrentVersion();
      return { status: "up-to-date", currentVersion, skipped: true };
    }

    // 识别常见错误并提供友好提示
    if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
      errorMessage = "更新服务暂不可用（未找到更新信息）";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
      errorMessage = `网络连接超时（已重试 ${maxRetries} 次），请检查网络连接`;
    } else if (errorMessage.includes("signature") || errorMessage.includes("verify")) {
      errorMessage = "更新签名验证失败";
    } else if (
      errorMessage.toLowerCase().includes("pubkey") ||
      errorMessage.toLowerCase().includes("public key")
    ) {
      errorMessage = "更新公钥配置异常，请检查 tauri.conf.json 中的 pubkey";
    } else if (
      errorMessage.toLowerCase().includes("permission") ||
      errorMessage.toLowerCase().includes("not allowed")
    ) {
      errorMessage = "当前应用未授予更新权限，请确认 capabilities/default.json 启用了 updater 权限";
    } else if (errorMessage.includes("Failed to check for update")) {
      errorMessage = "检查更新服务失败，请稍后重试";
    }
  }

  return { status: "error", error: errorMessage };
}

export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
