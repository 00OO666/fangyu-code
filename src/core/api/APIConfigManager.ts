/**
 * APIConfigManager - API 配置管理器
 * 
 * 管理多个 AI 提供商的 API 配置
 * 支持 HiAPI、Anthropic、OpenAI、Google 等
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { RealAPIClient, APIClientConfig, createHiAPIClient, createOpenAIClient } from './RealAPIClient';

// =============================================================================
// 类型定义
// =============================================================================

/** 提供商类型 */
export type APIProvider = 
  | 'hiapi'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'custom';

/** 提供商配置 */
export interface ProviderConfig {
  provider: APIProvider;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  models?: string[];
}

/** 配置存储 */
export interface APIConfigStore {
  activeProvider: APIProvider;
  providers: Record<APIProvider, ProviderConfig>;
  defaultModel: string;
  lastUpdated: number;
}

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  provider: APIProvider;
  message: string;
  latency?: number;
  models?: string[];
}

// =============================================================================
// 默认配置
// =============================================================================

/** 默认提供商配置 */
const DEFAULT_PROVIDER_CONFIGS: Record<APIProvider, Omit<ProviderConfig, 'apiKey'>> = {
  hiapi: {
    provider: 'hiapi',
    name: 'HiAPI 中转服务',
    baseUrl: 'https://hiapi.online/v1',
    enabled: true,
    priority: 1,
    timeout: 30000,
    maxRetries: 3,
    models: [
      'claude-3.5-sonnet',
      'claude-3-opus',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-4o-mini',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
    ],
  },
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    enabled: false,
    priority: 2,
    timeout: 30000,
    maxRetries: 3,
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  anthropic: {
    provider: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    enabled: false,
    priority: 3,
    timeout: 30000,
    maxRetries: 3,
    headers: {
      'anthropic-version': '2023-06-01',
    },
    models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  google: {
    provider: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    enabled: false,
    priority: 4,
    timeout: 30000,
    maxRetries: 3,
    models: ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  azure: {
    provider: 'azure',
    name: 'Azure OpenAI',
    baseUrl: '',
    enabled: false,
    priority: 5,
    timeout: 30000,
    maxRetries: 3,
    models: ['gpt-4o', 'gpt-4-turbo'],
  },
  custom: {
    provider: 'custom',
    name: '自定义',
    baseUrl: '',
    enabled: false,
    priority: 10,
    timeout: 30000,
    maxRetries: 3,
    models: [],
  },
};

// =============================================================================
// APIConfigManager 类
// =============================================================================

export class APIConfigManager {
  private configs: Map<APIProvider, ProviderConfig> = new Map();
  private clients: Map<APIProvider, RealAPIClient> = new Map();
  private activeProvider: APIProvider = 'hiapi';
  private defaultModel: string = 'gpt-4o';
  private storageKey: string = 'fangyu-api-config';

  constructor() {
    this.initializeDefaults();
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 配置提供商
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  configureProvider(provider: APIProvider, config: Partial<ProviderConfig>): void {
    const existing = this.configs.get(provider);
    const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
    
    const newConfig: ProviderConfig = {
      ...defaultConfig,
      ...existing,
      ...config,
      provider,
      apiKey: config.apiKey ?? existing?.apiKey ?? '',
    };

    this.configs.set(provider, newConfig);

    // 如果有 API 密钥，创建客户端
    if (newConfig.apiKey && newConfig.enabled) {
      this.createClient(provider, newConfig);
    }
  }

  /**
   * 设置活动提供商
   */
  setActiveProvider(provider: APIProvider): void {
    const config = this.configs.get(provider);
    if (!config?.enabled || !config?.apiKey) {
      throw new Error(`Provider ${provider} is not configured or enabled`);
    }
    this.activeProvider = provider;
  }

  /**
   * 获取活动提供商
   */
  getActiveProvider(): APIProvider {
    return this.activeProvider;
  }

  /**
   * 获取活动客户端
   */
  getActiveClient(): RealAPIClient | undefined {
    return this.clients.get(this.activeProvider);
  }

  /**
   * 获取提供商配置
   */
  getProviderConfig(provider: APIProvider): ProviderConfig | undefined {
    return this.configs.get(provider);
  }

  /**
   * 获取所有提供商配置
   */
  getAllConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 获取已启用的提供商
   */
  getEnabledProviders(): ProviderConfig[] {
    return Array.from(this.configs.values())
      .filter(c => c.enabled && c.apiKey)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取客户端
   */
  getClient(provider: APIProvider): RealAPIClient | undefined {
    return this.clients.get(provider);
  }

  /**
   * 验证 API 凭证
   * Requirements: 2.5
   */
  async validateCredentials(provider: APIProvider): Promise<ValidationResult> {
    const config = this.configs.get(provider);
    if (!config?.apiKey) {
      return {
        valid: false,
        provider,
        message: 'API 密钥未配置',
      };
    }

    // 创建临时客户端进行验证
    const client = new RealAPIClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: 10000,
      headers: config.headers,
    });

    const startTime = Date.now();

    try {
      const valid = await client.validateCredentials();
      const latency = Date.now() - startTime;

      if (valid) {
        // 尝试获取模型列表
        const models = await client.listModels();
        
        return {
          valid: true,
          provider,
          message: '验证成功',
          latency,
          models: models.length > 0 ? models : config.models,
        };
      }

      return {
        valid: false,
        provider,
        message: 'API 密钥无效或已过期',
        latency,
      };
    } catch (error) {
      return {
        valid: false,
        provider,
        message: error instanceof Error ? error.message : '验证失败',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 验证所有已配置的提供商
   */
  async validateAllProviders(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const config of this.configs.values()) {
      if (config.apiKey) {
        const result = await this.validateCredentials(config.provider);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 设置默认模型
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * 获取默认模型
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * 获取提供商支持的模型
   */
  getProviderModels(provider: APIProvider): string[] {
    const config = this.configs.get(provider);
    return config?.models ?? [];
  }

  /**
   * 启用提供商
   */
  enableProvider(provider: APIProvider): void {
    const config = this.configs.get(provider);
    if (config) {
      config.enabled = true;
      if (config.apiKey) {
        this.createClient(provider, config);
      }
    }
  }

  /**
   * 禁用提供商
   */
  disableProvider(provider: APIProvider): void {
    const config = this.configs.get(provider);
    if (config) {
      config.enabled = false;
      this.clients.delete(provider);
    }
  }

  /**
   * 导出配置
   */
  exportConfig(): APIConfigStore {
    const providers: Record<APIProvider, ProviderConfig> = {} as Record<APIProvider, ProviderConfig>;
    
    for (const [provider, config] of this.configs) {
      providers[provider] = { ...config };
    }

    return {
      activeProvider: this.activeProvider,
      providers,
      defaultModel: this.defaultModel,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 导入配置
   */
  importConfig(store: APIConfigStore): void {
    this.activeProvider = store.activeProvider;
    this.defaultModel = store.defaultModel;

    for (const [provider, config] of Object.entries(store.providers)) {
      this.configureProvider(provider as APIProvider, config);
    }
  }

  /**
   * 保存到本地存储
   */
  saveToStorage(): void {
    try {
      const config = this.exportConfig();
      // 移除敏感信息（API 密钥）用于日志
      const safeConfig = { ...config };
      for (const provider of Object.keys(safeConfig.providers)) {
        const p = provider as APIProvider;
        if (safeConfig.providers[p]) {
          safeConfig.providers[p] = {
            ...safeConfig.providers[p],
            apiKey: safeConfig.providers[p].apiKey ? '***' : '',
          };
        }
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(config));
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 从本地存储加载
   */
  loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const config = JSON.parse(stored) as APIConfigStore;
        this.importConfig(config);
        return true;
      }
    } catch {
      // 忽略加载错误
    }
    return false;
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.configs.clear();
    this.clients.clear();
    this.activeProvider = 'hiapi';
    this.defaultModel = 'gpt-4o';
    this.initializeDefaults();
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 初始化默认配置
   */
  private initializeDefaults(): void {
    for (const [provider, config] of Object.entries(DEFAULT_PROVIDER_CONFIGS)) {
      this.configs.set(provider as APIProvider, {
        ...config,
        apiKey: '',
      });
    }
  }

  /**
   * 创建客户端
   */
  private createClient(provider: APIProvider, config: ProviderConfig): void {
    const clientConfig: APIClientConfig = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      headers: config.headers,
    };

    let client: RealAPIClient;

    switch (provider) {
      case 'hiapi':
        client = createHiAPIClient(config.apiKey, clientConfig);
        break;
      case 'openai':
        client = createOpenAIClient(config.apiKey, clientConfig);
        break;
      default:
        client = new RealAPIClient(clientConfig);
    }

    this.clients.set(provider, client);
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建配置管理器
 */
export function createAPIConfigManager(): APIConfigManager {
  return new APIConfigManager();
}

/**
 * 获取提供商显示名称
 */
export function getProviderDisplayName(provider: APIProvider): string {
  return DEFAULT_PROVIDER_CONFIGS[provider]?.name ?? provider;
}

/**
 * 获取所有支持的提供商
 */
export function getSupportedProviders(): APIProvider[] {
  return Object.keys(DEFAULT_PROVIDER_CONFIGS) as APIProvider[];
}

export default APIConfigManager;
