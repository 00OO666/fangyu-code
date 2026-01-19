/**
 * Summary Config Store Service
 * 
 * 摘要 API 配置的存储和管理服务
 * 独立于主聊天 API 配置
 * 
 * Requirements: 2.3, 6.1, 6.2, 6.3, 6.4
 */

import {
  SummaryAPIConfig,
  StoredSummaryConfig,
  ConfigValidationResult,
  SummaryEngine,
  ENGINE_MODELS,
  DEFAULT_SUMMARY_CONFIG,
  SUMMARY_CONFIG_STORAGE_KEY,
  SUMMARY_CONFIG_VERSION,
} from '@/types/summary';

// =============================================================================
// 加密工具
// =============================================================================

/** 获取或创建加密密钥 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const keyStorageKey = 'fangyu-summary-encryption-key';
  const storedKey = localStorage.getItem(keyStorageKey);
  
  if (storedKey) {
    try {
      const keyData = JSON.parse(storedKey);
      return await crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      // 密钥损坏，重新生成
    }
  }
  
  // 生成新密钥
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 导出并存储
  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(keyStorageKey, JSON.stringify(exportedKey));
  
  return key;
}

/** 加密 API Key */
async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey) return '';
  
  try {
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(apiKey);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    // 合并 IV 和加密数据
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[SummaryConfigStore] Failed to encrypt API key:', error);
    return '';
  }
}

/** 解密 API Key */
async function decryptApiKey(encryptedKey: string): Promise<string> {
  if (!encryptedKey) return '';
  
  try {
    const key = await getOrCreateEncryptionKey();
    const combined = new Uint8Array(
      atob(encryptedKey).split('').map(c => c.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('[SummaryConfigStore] Failed to decrypt API key:', error);
    return '';
  }
}

// =============================================================================
// 配置验证
// =============================================================================

/** 验证配置 */
export function validateConfig(config: SummaryAPIConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证引擎
  const validEngines: SummaryEngine[] = ['claude', 'codex', 'gemini', 'siliconflow', 'kiro'];
  if (!validEngines.includes(config.engine)) {
    errors.push(`无效的引擎: ${config.engine}`);
  }
  
  // 验证模型
  const engineModels = ENGINE_MODELS[config.engine];
  if (engineModels) {
    const validModel = engineModels.find(m => m.id === config.model);
    if (!validModel) {
      warnings.push(`模型 ${config.model} 不在预设列表中，可能是自定义模型`);
    }
  }
  
  // 验证自定义参数
  if (config.customParams) {
    if (config.customParams.maxTokens && config.customParams.maxTokens < 100) {
      errors.push('maxTokens 不能小于 100');
    }
    if (config.customParams.maxTokens && config.customParams.maxTokens > 100000) {
      warnings.push('maxTokens 设置过大，可能导致费用过高');
    }
    if (config.customParams.temperature !== undefined) {
      if (config.customParams.temperature < 0 || config.customParams.temperature > 2) {
        errors.push('temperature 必须在 0-2 之间');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// SummaryConfigStore 类
// =============================================================================

export class SummaryConfigStore {
  private config: SummaryAPIConfig | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 1000;
  
  /** 获取当前配置 */
  getConfig(): SummaryAPIConfig | null {
    return this.config ? { ...this.config } : null;
  }
  
  /** 加载配置 */
  async loadConfig(): Promise<SummaryAPIConfig> {
    try {
      const stored = localStorage.getItem(SUMMARY_CONFIG_STORAGE_KEY);
      
      if (!stored) {
        this.config = { ...DEFAULT_SUMMARY_CONFIG };
        return this.config;
      }
      
      const parsed: StoredSummaryConfig = JSON.parse(stored);
      
      // 版本迁移（如果需要）
      if (parsed.version !== SUMMARY_CONFIG_VERSION) {
        console.warn('[SummaryConfigStore] Config version mismatch, migrating...');
        // 未来版本迁移逻辑
      }
      
      // 解密 API Key
      let apiKey = parsed.config.apiKey;
      if (parsed.encryptedApiKey) {
        apiKey = await decryptApiKey(parsed.encryptedApiKey);
      }
      
      this.config = {
        ...parsed.config,
        apiKey,
      };
      
      // 验证配置
      const validation = validateConfig(this.config);
      if (!validation.valid) {
        console.error('[SummaryConfigStore] Invalid config, resetting to defaults:', validation.errors);
        this.config = { ...DEFAULT_SUMMARY_CONFIG };
        await this.saveConfig(this.config);
      }
      
      return this.config;
    } catch (error) {
      console.error('[SummaryConfigStore] Failed to load config, resetting to defaults:', error);
      this.config = { ...DEFAULT_SUMMARY_CONFIG };
      return this.config;
    }
  }
  
  /** 保存配置 */
  async saveConfig(config: SummaryAPIConfig): Promise<void> {
    // 验证配置
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`配置无效: ${validation.errors.join(', ')}`);
    }
    
    // 加密 API Key
    let encryptedApiKey: string | undefined;
    const configToStore = { ...config };
    
    if (config.apiKey) {
      encryptedApiKey = await encryptApiKey(config.apiKey);
      delete configToStore.apiKey; // 不存储明文
    }
    
    const stored: StoredSummaryConfig = {
      version: SUMMARY_CONFIG_VERSION,
      config: {
        ...configToStore,
        updatedAt: Date.now(),
      },
      encryptedApiKey,
    };
    
    localStorage.setItem(SUMMARY_CONFIG_STORAGE_KEY, JSON.stringify(stored));
    this.config = config;
  }
  
  /** 防抖保存配置 */
  debouncedSave(config: SummaryAPIConfig): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.config = config;
    
    this.saveTimeout = setTimeout(async () => {
      try {
        await this.saveConfig(config);
      } catch (error) {
        console.error('[SummaryConfigStore] Debounced save failed:', error);
      }
    }, this.debounceMs);
  }
  
  /** 重置为默认配置 */
  async resetToDefaults(): Promise<SummaryAPIConfig> {
    this.config = { ...DEFAULT_SUMMARY_CONFIG };
    await this.saveConfig(this.config);
    return this.config;
  }
  
  /** 更新部分配置 */
  async updateConfig(partial: Partial<SummaryAPIConfig>): Promise<SummaryAPIConfig> {
    const current = this.config || { ...DEFAULT_SUMMARY_CONFIG };
    const updated = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };
    
    await this.saveConfig(updated);
    return updated;
  }
  
  /** 检查配置是否已设置 */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.engine && !!this.config.model;
  }
  
  /** 检查是否有 API Key */
  hasApiKey(): boolean {
    return !!this.config?.apiKey;
  }
  
  /** 获取当前引擎的模型列表 */
  getModelsForEngine(engine?: SummaryEngine): typeof ENGINE_MODELS[SummaryEngine] {
    const targetEngine = engine || this.config?.engine || 'claude';
    return ENGINE_MODELS[targetEngine] || [];
  }
  
  /** 清除保存定时器 */
  dispose(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }
}

// =============================================================================
// 单例实例
// =============================================================================

let instance: SummaryConfigStore | null = null;

/** 获取 SummaryConfigStore 单例 */
export function getSummaryConfigStore(): SummaryConfigStore {
  if (!instance) {
    instance = new SummaryConfigStore();
  }
  return instance;
}

/** 创建新的 SummaryConfigStore 实例（用于测试） */
export function createSummaryConfigStore(): SummaryConfigStore {
  return new SummaryConfigStore();
}

export default SummaryConfigStore;
