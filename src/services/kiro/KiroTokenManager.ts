/**
 * Kiro Token 管理器
 * 
 * 负责读取、验证和监控 Kiro SSO Token
 */

import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import type { KiroToken, KiroTokenStatus, KiroAccountType } from './types';
import { DEFAULT_KIRO_TOKEN_PATH } from './types';
import { KiroApiError, maskToken } from './errors';

export class KiroTokenManager {
  private token: KiroToken | null = null;
  private tokenPath: string;
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 分钟缓存

  constructor(customPath?: string) {
    this.tokenPath = customPath || DEFAULT_KIRO_TOKEN_PATH;
  }

  /**
   * 获取默认 Token 路径（展开 ~）
   */
  private expandPath(path: string): string {
    // Tauri 后端会处理 ~ 展开
    return path;
  }

  /**
   * 加载 Token
   */
  async loadToken(forceReload = false): Promise<KiroToken> {
    // 检查缓存
    if (!forceReload && this.token && Date.now() - this.lastLoadTime < this.CACHE_TTL_MS) {
      return this.token;
    }

    try {
      const content = await invoke<string>('read_kiro_token', {
        path: this.expandPath(this.tokenPath)
      });

      this.token = JSON.parse(content) as KiroToken;
      this.lastLoadTime = Date.now();

      logger.debug('KiroTokenManager', 'Token 加载成功:', {
        region: this.token.region,
        expiresAt: this.token.expiresAt,
        hasProfileArn: !!this.token.profileArn,
        tokenPreview: maskToken(this.token.accessToken),
      });

      return this.token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('不存在') || message.includes('not found')) {
        throw new KiroApiError('TOKEN_NOT_FOUND', `Token 文件不存在: ${this.tokenPath}`);
      }

      throw new KiroApiError('TOKEN_INVALID', `无法读取 Token: ${message}`);
    }
  }

  /**
   * 检查 Token 是否有效（未过期）
   */
  isValid(): boolean {
    if (!this.token) return false;

    try {
      const expiresAt = new Date(this.token.expiresAt);
      return expiresAt > new Date();
    } catch {
      return false;
    }
  }

  /**
   * 获取 Token 状态
   */
  getStatus(): KiroTokenStatus {
    if (!this.token) {
      return {
        isValid: false,
        expiresIn: 0,
        region: '',
        accountType: 'builders-id',
      };
    }

    try {
      const expiresAt = new Date(this.token.expiresAt);
      const now = new Date();
      const expiresIn = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

      return {
        isValid: expiresAt > now,
        expiresIn,
        region: this.token.region || 'us-east-1',
        accountType: this.getAccountType(),
      };
    } catch {
      return {
        isValid: false,
        expiresIn: 0,
        region: this.token.region || 'us-east-1',
        accountType: 'builders-id',
      };
    }
  }

  /**
   * 获取账户类型
   */
  getAccountType(): KiroAccountType {
    return this.token?.profileArn ? 'iam-identity-center' : 'builders-id';
  }

  /**
   * 获取 Access Token
   */
  getAccessToken(): string | null {
    return this.token?.accessToken || null;
  }

  /**
   * 获取 Region
   */
  getRegion(): string {
    return this.token?.region || 'us-east-1';
  }

  /**
   * 获取 Profile ARN（IAM Identity Center）
   */
  getProfileArn(): string | null {
    return this.token?.profileArn || null;
  }

  /**
   * 获取遮蔽的 Token（用于日志和 UI）
   */
  getMaskedToken(): string {
    return maskToken(this.token?.accessToken);
  }

  /**
   * 获取 Token 路径
   */
  getTokenPath(): string {
    return this.tokenPath;
  }

  /**
   * 设置 Token 路径
   */
  setTokenPath(path: string): void {
    this.tokenPath = path || DEFAULT_KIRO_TOKEN_PATH;
    this.clearCache();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.token = null;
    this.lastLoadTime = 0;
  }

  /**
   * 格式化过期时间
   */
  formatExpiresIn(): string {
    const status = this.getStatus();

    if (!status.isValid) {
      return '已过期';
    }

    const hours = Math.floor(status.expiresIn / 3600);
    const minutes = Math.floor((status.expiresIn % 3600) / 60);

    if (hours > 0) {
      return `${hours}小时${minutes}分钟后过期`;
    }

    return `${minutes}分钟后过期`;
  }
}

// 导出单例（可选）
let defaultManager: KiroTokenManager | null = null;

export function getDefaultTokenManager(): KiroTokenManager {
  if (!defaultManager) {
    defaultManager = new KiroTokenManager();
  }
  return defaultManager;
}
