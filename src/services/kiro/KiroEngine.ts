/**
 * Kiro 引擎
 * 
 * 整合 TokenManager 和 ApiClient，提供统一的引擎接口
 */

import type { 
  KiroEngineConfig, 
  KiroModel, 
  KiroChatMessage,
  KiroTokenStatus,
  KiroValidationResult,
} from './types';
import { KIRO_MODELS, DEFAULT_KIRO_TOKEN_PATH } from './types';
import { KiroTokenManager } from './KiroTokenManager';
import { KiroApiClient } from './KiroApiClient';
import { KiroApiError } from './errors';

export class KiroEngine {
  private tokenManager: KiroTokenManager;
  private apiClient: KiroApiClient;
  private config: KiroEngineConfig;
  private conversationId: string | null = null;
  private history: KiroChatMessage[] = [];
  private initialized = false;

  /**
   * 可用模型列表
   */
  static readonly MODELS: KiroModel[] = KIRO_MODELS;

  constructor(config: KiroEngineConfig = {}) {
    this.config = {
      tokenPath: config.tokenPath || DEFAULT_KIRO_TOKEN_PATH,
      modelId: config.modelId,
      region: config.region,
    };
    this.tokenManager = new KiroTokenManager(this.config.tokenPath);
    this.apiClient = new KiroApiClient(this.tokenManager);
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.tokenManager.loadToken();
      this.initialized = true;
      console.log('[KiroEngine] 初始化成功');
    } catch (error) {
      console.error('[KiroEngine] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<KiroValidationResult> {
    try {
      await this.tokenManager.loadToken(true);

      if (!this.tokenManager.isValid()) {
        return {
          valid: false,
          error: 'Token 已过期，请重新登录 Kiro IDE',
          tokenStatus: this.tokenManager.getStatus(),
        };
      }

      return { 
        valid: true,
        tokenStatus: this.tokenManager.getStatus(),
      };
    } catch (error) {
      const message = error instanceof KiroApiError 
        ? error.getUserMessage() 
        : (error instanceof Error ? error.message : String(error));
      
      return {
        valid: false,
        error: message,
      };
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(
    content: string,
    options: { onChunk?: (chunk: string) => void } = {}
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.apiClient.chat(content, {
      modelId: this.config.modelId,
      conversationId: this.conversationId || undefined,
      history: this.history,
      onChunk: options.onChunk,
    });

    // 更新会话状态
    this.conversationId = response.conversationId;
    this.history.push(
      { role: 'user', content },
      { role: 'assistant', content: response.content }
    );

    return response.content;
  }

  /**
   * 开始新会话
   */
  startNewConversation(): void {
    this.conversationId = null;
    this.history = [];
    console.log('[KiroEngine] 开始新会话');
  }

  /**
   * 获取可用模型（根据账户类型过滤）
   */
  getAvailableModels(): KiroModel[] {
    const status = this.tokenManager.getStatus();
    return KiroEngine.MODELS.filter(model =>
      model.supportedBy.includes(status.accountType)
    );
  }

  /**
   * 获取所有模型
   */
  getAllModels(): KiroModel[] {
    return KiroEngine.MODELS;
  }

  /**
   * 设置模型
   */
  setModel(modelId: string): void {
    this.config.modelId = modelId || undefined;
    console.log('[KiroEngine] 设置模型:', modelId || 'Auto');
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): string | undefined {
    return this.config.modelId;
  }

  /**
   * 获取当前模型信息
   */
  getCurrentModelInfo(): KiroModel | null {
    if (!this.config.modelId) return null;
    return KiroEngine.MODELS.find(m => m.id === this.config.modelId) || null;
  }

  /**
   * 获取 Token 状态
   */
  getTokenStatus(): KiroTokenStatus {
    return this.tokenManager.getStatus();
  }

  /**
   * 获取 Token 路径
   */
  getTokenPath(): string {
    return this.tokenManager.getTokenPath();
  }

  /**
   * 设置 Token 路径
   */
  setTokenPath(path: string): void {
    this.tokenManager.setTokenPath(path);
    this.initialized = false;
  }

  /**
   * 获取会话 ID
   */
  getConversationId(): string | null {
    return this.conversationId;
  }

  /**
   * 获取会话历史
   */
  getHistory(): KiroChatMessage[] {
    return [...this.history];
  }

  /**
   * 获取配置
   */
  getConfig(): KiroEngineConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<KiroEngineConfig>): void {
    if (updates.tokenPath && updates.tokenPath !== this.config.tokenPath) {
      this.setTokenPath(updates.tokenPath);
    }
    if (updates.modelId !== undefined) {
      this.setModel(updates.modelId || '');
    }
    if (updates.region !== undefined) {
      this.config.region = updates.region;
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(): Promise<void> {
    await this.tokenManager.loadToken(true);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.tokenManager.clearCache();
    this.conversationId = null;
    this.history = [];
    this.initialized = false;
    console.log('[KiroEngine] 已清理资源');
  }
}

// 导出单例工厂
let defaultEngine: KiroEngine | null = null;

export function getDefaultKiroEngine(): KiroEngine {
  if (!defaultEngine) {
    defaultEngine = new KiroEngine();
  }
  return defaultEngine;
}

export function resetDefaultKiroEngine(): void {
  if (defaultEngine) {
    defaultEngine.dispose();
    defaultEngine = null;
  }
}
