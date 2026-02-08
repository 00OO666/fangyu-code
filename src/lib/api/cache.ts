import { logger } from "@/lib/logger";

/**
 * 会话列表缓存
 * 30天过期，像微信一样快速加载
 * 使用 localStorage 持久化，刷新页面也能瞬间加载
 * 在创建/删除会话时会自动清除缓存确保数据一致性
 */
interface SessionCacheEntry<T> {
  data: T;
  timestamp: number;
}

const SESSION_CACHE: {
  codexSessions?: SessionCacheEntry<import("@/types/codex").CodexSession[]>;
  geminiSessionsByProject: Map<string, SessionCacheEntry<import("@/types/gemini").GeminiSession[]>>;
} = {
  geminiSessionsByProject: new Map(),
};

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (像微信一样长期缓存)
const CACHE_STORAGE_KEY = "fangyu-sessions-cache";

// 从 localStorage 恢复缓存（应用启动时）
function restoreCacheFromStorage() {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.codexSessions && Date.now() - parsed.codexSessions.timestamp < CACHE_TTL) {
        SESSION_CACHE.codexSessions = parsed.codexSessions;
        logger.debug("cache", "[api] Restored Codex sessions cache from localStorage");
      }
    }
  } catch (e) {
    logger.debug("cache", "[api] Failed to restore cache from localStorage:", e);
  }
}

// 保存缓存到 localStorage
function saveCacheToStorage() {
  try {
    const toSave = {
      codexSessions: SESSION_CACHE.codexSessions,
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    logger.debug("cache", "[api] Failed to save cache to localStorage:", e);
  }
}

// 应用启动时恢复缓存
restoreCacheFromStorage();

function isCacheValid<T>(entry: SessionCacheEntry<T> | undefined): entry is SessionCacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// Export cache-related utilities
export {
  SESSION_CACHE,
  CACHE_TTL,
  CACHE_STORAGE_KEY,
  restoreCacheFromStorage,
  saveCacheToStorage,
  isCacheValid,
};

export type { SessionCacheEntry };
