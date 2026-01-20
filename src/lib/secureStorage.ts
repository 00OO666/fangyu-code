/**
 * SecureStorage - 安全存储模块
 * 使用 Tauri 安全存储 API 存储敏感数据
 *
 * _Requirements: 7.1_
 * **Property 7: API 密钥安全存储**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 *
 * 🔒 安全改进 (v2.7.6):
 * - 开发环境使用 Web Crypto API 进行 AES-GCM 加密
 * - 添加安全警告日志
 * - 移除不安全的 Base64 编码
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// 类型定义
// =============================================================================

/** 安全存储接口 */
export interface SecureStorage {
  /** 存储值 */
  setItem(key: string, value: string): Promise<void>;
  /** 获取值 */
  getItem(key: string): Promise<string | null>;
  /** 删除值 */
  removeItem(key: string): Promise<void>;
  /** 清除所有值 */
  clear(): Promise<void>;
  /** 检查键是否存在 */
  hasItem(key: string): Promise<boolean>;
  /** 获取所有键 */
  getAllKeys(): Promise<string[]>;
}

/** 存储的 API 密钥信息 */
export interface StoredAPIKey {
  /** 提供商 */
  provider: APIKeyProvider;
  /** 密钥（加密存储） */
  key: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsedAt?: string;
  /** 是否已验证 */
  isValid?: boolean;
}

/** API 密钥提供商 */
export type APIKeyProvider = 'claude' | 'openai' | 'gemini' | 'siliconflow' | 'hiapi' | 'other';

// =============================================================================
// Web Crypto API 加密工具（开发环境使用）
// =============================================================================

/**
 * 🔒 派生加密密钥
 * 使用 PBKDF2 从设备指纹派生 AES-GCM 密钥
 */
async function deriveEncryptionKey(): Promise<CryptoKey> {
  // 使用设备指纹作为密钥材料（比硬编码密钥更安全）
  const deviceFingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(deviceFingerprint),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 使用固定盐值（设备相关）
  const salt = encoder.encode('fangyu_code_secure_storage_v1');

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 🔒 使用 AES-GCM 加密数据
 */
async function encryptData(plaintext: string): Promise<string> {
  const key = await deriveEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // 将 IV 和密文组合，然后 Base64 编码
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * 🔒 使用 AES-GCM 解密数据
 */
async function decryptData(ciphertext: string): Promise<string | null> {
  try {
    const key = await deriveEncryptionKey();

    // Base64 解码
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    // 分离 IV 和密文
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    logger.warn('secureStorage', '[SecureStorage] 解密失败，可能是旧格式数据:', error);
    return null;
  }
}

/**
 * 🔒 尝试解密数据，兼容旧的 Base64 格式
 */
async function decryptDataWithFallback(encoded: string): Promise<string | null> {
  // 首先尝试新的加密格式
  const decrypted = await decryptData(encoded);
  if (decrypted !== null) {
    return decrypted;
  }

  // 回退到旧的 Base64 格式（用于迁移）
  try {
    const decoded = atob(encoded);
    // 如果成功解码且看起来像有效数据，记录警告并返回
    if (decoded && decoded.length > 0) {
      console.warn(
        '[SecureStorage] ⚠️ 检测到旧格式数据（Base64），建议重新保存以使用加密存储'
      );
      return decoded;
    }
  } catch {
    // 忽略解码错误
  }

  return null;
}

// =============================================================================
// 安全存储实现
// =============================================================================

/**
 * 安全存储前缀
 */
const SECURE_STORAGE_PREFIX = 'fangyu_secure_';

/**
 * 检查是否在 Tauri 环境中
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 🔒 记录安全警告（开发环境）
 */
function logSecurityWarning(): void {
  if (!isTauriEnvironment()) {
    console.warn(
      '[SecureStorage] ⚠️ 安全警告: 当前运行在开发环境，使用 Web Crypto API 加密。' +
      '生产环境请使用 Tauri 安全存储以获得更高安全性。'
    );
  }
}

/**
 * 安全存储实现
 * 在 Tauri 环境中使用 Rust 后端的安全存储
 * 在非 Tauri 环境中使用 Web Crypto API 加密的 localStorage
 *
 * 🔒 安全改进: 开发环境现在使用 AES-GCM 加密，而非简单的 Base64 编码
 */
export const secureStorage: SecureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const prefixedKey = `${SECURE_STORAGE_PREFIX}${key}`;

    if (isTauriEnvironment()) {
      try {
        await invoke('secure_store_set', { key: prefixedKey, value });
        return;
      } catch (error) {
        logger.warn('secureStorage', '[SecureStorage] Tauri secure storage failed, falling back:', error);
      }
    }

    // 🔒 使用 Web Crypto API 加密（开发环境）
    logSecurityWarning();
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(prefixedKey, encrypted);
    } catch (error) {
      logger.error('secureStorage', '[SecureStorage] 加密失败:', error);
      throw new Error('无法安全存储数据');
    }
  },

  async getItem(key: string): Promise<string | null> {
    const prefixedKey = `${SECURE_STORAGE_PREFIX}${key}`;

    if (isTauriEnvironment()) {
      try {
        const value = await invoke<string | null>('secure_store_get', { key: prefixedKey });
        return value;
      } catch (error) {
        logger.warn('secureStorage', '[SecureStorage] Tauri secure storage failed, falling back:', error);
      }
    }

    // 🔒 使用 Web Crypto API 解密（开发环境）
    const encoded = localStorage.getItem(prefixedKey);
    if (encoded) {
      return decryptDataWithFallback(encoded);
    }
    return null;
  },

  async removeItem(key: string): Promise<void> {
    const prefixedKey = `${SECURE_STORAGE_PREFIX}${key}`;

    if (isTauriEnvironment()) {
      try {
        await invoke('secure_store_remove', { key: prefixedKey });
        return;
      } catch (error) {
        logger.warn('secureStorage', '[SecureStorage] Tauri secure storage failed, falling back:', error);
      }
    }

    // 回退到 localStorage
    localStorage.removeItem(prefixedKey);
  },

  async clear(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('secure_store_clear');
        return;
      } catch (error) {
        logger.warn('secureStorage', '[SecureStorage] Tauri secure storage failed, falling back:', error);
      }
    }

    // 回退到 localStorage - 只清除带前缀的键
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SECURE_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  },

  async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  },

  async getAllKeys(): Promise<string[]> {
    if (isTauriEnvironment()) {
      try {
        const keys = await invoke<string[]>('secure_store_list_keys');
        return keys
          .filter((k) => k.startsWith(SECURE_STORAGE_PREFIX))
          .map((k) => k.slice(SECURE_STORAGE_PREFIX.length));
      } catch (error) {
        logger.warn('secureStorage', '[SecureStorage] Tauri secure storage failed, falling back:', error);
      }
    }

    // 回退到 localStorage
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SECURE_STORAGE_PREFIX)) {
        keys.push(key.slice(SECURE_STORAGE_PREFIX.length));
      }
    }
    return keys;
  },
};

// =============================================================================
// API 密钥管理
// =============================================================================

const API_KEY_PREFIX = 'api_key_';

/**
 * 保存 API 密钥
 *
 * @param provider 提供商
 * @param key API 密钥
 */
export async function saveAPIKey(provider: APIKeyProvider, key: string): Promise<void> {
  const storedKey: StoredAPIKey = {
    provider,
    key,
    createdAt: new Date().toISOString(),
  };

  await secureStorage.setItem(`${API_KEY_PREFIX}${provider}`, JSON.stringify(storedKey));
}

/**
 * 获取 API 密钥
 *
 * @param provider 提供商
 * @returns API 密钥或 null
 */
export async function getAPIKey(provider: APIKeyProvider): Promise<string | null> {
  const stored = await secureStorage.getItem(`${API_KEY_PREFIX}${provider}`);
  if (!stored) return null;

  try {
    const parsed: StoredAPIKey = JSON.parse(stored);
    return parsed.key;
  } catch {
    return null;
  }
}

/**
 * 获取 API 密钥详细信息
 *
 * @param provider 提供商
 * @returns 存储的 API 密钥信息或 null
 */
export async function getAPIKeyInfo(provider: APIKeyProvider): Promise<StoredAPIKey | null> {
  const stored = await secureStorage.getItem(`${API_KEY_PREFIX}${provider}`);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * 删除 API 密钥
 *
 * @param provider 提供商
 */
export async function removeAPIKey(provider: APIKeyProvider): Promise<void> {
  await secureStorage.removeItem(`${API_KEY_PREFIX}${provider}`);
}

/**
 * 获取所有已保存的 API 密钥提供商
 *
 * @returns 提供商列表
 */
export async function getStoredProviders(): Promise<APIKeyProvider[]> {
  const keys = await secureStorage.getAllKeys();
  return keys
    .filter((k) => k.startsWith(API_KEY_PREFIX))
    .map((k) => k.slice(API_KEY_PREFIX.length) as APIKeyProvider);
}

/**
 * 更新 API 密钥的最后使用时间
 *
 * @param provider 提供商
 */
export async function updateAPIKeyLastUsed(provider: APIKeyProvider): Promise<void> {
  const info = await getAPIKeyInfo(provider);
  if (info) {
    info.lastUsedAt = new Date().toISOString();
    await secureStorage.setItem(`${API_KEY_PREFIX}${provider}`, JSON.stringify(info));
  }
}

/**
 * 设置 API 密钥验证状态
 *
 * @param provider 提供商
 * @param isValid 是否有效
 */
export async function setAPIKeyValidation(
  provider: APIKeyProvider,
  isValid: boolean
): Promise<void> {
  const info = await getAPIKeyInfo(provider);
  if (info) {
    info.isValid = isValid;
    await secureStorage.setItem(`${API_KEY_PREFIX}${provider}`, JSON.stringify(info));
  }
}

// =============================================================================
// 密钥遮罩工具
// =============================================================================

/**
 * 遮罩 API 密钥用于显示
 *
 * @param key API 密钥
 * @param visibleChars 可见字符数（前后各显示的字符数）
 * @returns 遮罩后的密钥
 */
export function maskAPIKey(key: string, visibleChars = 4): string {
  if (!key || key.length <= visibleChars * 2) {
    return '••••••••';
  }

  const prefix = key.slice(0, visibleChars);
  const suffix = key.slice(-visibleChars);
  const maskedLength = Math.min(key.length - visibleChars * 2, 16);
  const masked = '•'.repeat(maskedLength);

  return `${prefix}${masked}${suffix}`;
}

/**
 * 检查密钥是否已存储在安全存储中（而非 localStorage）
 *
 * @param provider 提供商
 * @returns 是否安全存储
 */
export async function isKeySecurelyStored(provider: APIKeyProvider): Promise<boolean> {
  // 检查 localStorage 中是否有未加密的密钥
  const localStorageKey = `api_key_${provider}`;
  const insecureKey = localStorage.getItem(localStorageKey);

  if (insecureKey) {
    // 如果在 localStorage 中找到未加密的密钥，说明不安全
    return false;
  }

  // 检查安全存储中是否有密钥
  const secureKey = await getAPIKey(provider);
  return secureKey !== null;
}

/**
 * 迁移 localStorage 中的密钥到安全存储
 *
 * @param provider 提供商
 * @param localStorageKey localStorage 中的键名
 * @returns 是否成功迁移
 */
export async function migrateKeyToSecureStorage(
  provider: APIKeyProvider,
  localStorageKey: string
): Promise<boolean> {
  const insecureKey = localStorage.getItem(localStorageKey);

  if (!insecureKey) {
    return false;
  }

  try {
    // 保存到安全存储
    await saveAPIKey(provider, insecureKey);

    // 从 localStorage 删除
    localStorage.removeItem(localStorageKey);

    logger.debug('secureStorage', `[SecureStorage] Migrated ${provider} API key to secure storage`);
    return true;
  } catch (error) {
    logger.error('secureStorage', `[SecureStorage] Failed to migrate ${provider} API key:`, error);
    return false;
  }
}
