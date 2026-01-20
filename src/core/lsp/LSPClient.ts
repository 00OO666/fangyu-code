/**
 * LSP Client - 前端 LSP 功能的统一接口
 *
 * 功能：
 * 1. 封装 RealLSPClient，提供更简洁的 API
 * 2. 实现结果缓存，提升性能
 * 3. 统一错误处理
 * 4. 提供类型安全的接口
 */

import { RealLSPClient } from '../tools/LSPAutoLoader';
import {
  Position,
  Location,
  HoverInfo,
  Diagnostic,
} from '../types/unified-agent';
import { CompletionItem, WorkspaceEdit } from '../tools/LSPTools';
import { logger } from '@/lib/logger';

// 缓存配置
const CACHE_TTL = 5000; // 5秒缓存过期时间
const MAX_CACHE_SIZE = 100; // 最大缓存条目数

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * LSP Client 类
 * 为 UI 组件提供 LSP 功能的统一接口
 */
export class LSPClient {
  private realClient: RealLSPClient;
  private hoverCache: Map<string, CacheEntry<HoverInfo | null>> = new Map();
  private definitionCache: Map<string, CacheEntry<Location | null>> = new Map();
  private referencesCache: Map<string, CacheEntry<Location[]>> = new Map();
  private diagnosticsCache: Map<string, CacheEntry<Diagnostic[]>> = new Map();
  private completionCache: Map<string, CacheEntry<CompletionItem[]>> = new Map();

  constructor(realClient: RealLSPClient) {
    this.realClient = realClient;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(file: string, position?: Position): string {
    if (position) {
      return `${file}:${position.line}:${position.character}`;
    }
    return file;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid<T>(cache: Map<string, CacheEntry<T>>, key: string): boolean {
    const entry = cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    return (now - entry.timestamp) < CACHE_TTL;
  }

  /**
   * 获取缓存数据
   */
  private getCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    if (this.isCacheValid(cache, key)) {
      return cache.get(key)!.data;
    }
    return null;
  }

  /**
   * 设置缓存数据
   */
  private setCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    // 限制缓存大小
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.hoverCache.clear();
    this.definitionCache.clear();
    this.referencesCache.clear();
    this.diagnosticsCache.clear();
    this.completionCache.clear();
    logger.debug('LSPClient', 'All caches cleared');
  }

  /**
   * 清除特定文件的缓存
   */
  clearFileCache(file: string): void {
    // 清除所有与该文件相关的缓存
    for (const key of this.hoverCache.keys()) {
      if (key.startsWith(file)) {
        this.hoverCache.delete(key);
      }
    }
    for (const key of this.definitionCache.keys()) {
      if (key.startsWith(file)) {
        this.definitionCache.delete(key);
      }
    }
    for (const key of this.referencesCache.keys()) {
      if (key.startsWith(file)) {
        this.referencesCache.delete(key);
      }
    }
    this.diagnosticsCache.delete(file);
    for (const key of this.completionCache.keys()) {
      if (key.startsWith(file)) {
        this.completionCache.delete(key);
      }
    }
    logger.debug('LSPClient', `Cache cleared for file: ${file}`);
  }

  /**
   * 获取悬停信息
   */
  async hover(file: string, position: Position): Promise<HoverInfo | null> {
    const cacheKey = this.getCacheKey(file, position);

    // 检查缓存
    const cached = this.getCachedData(this.hoverCache, cacheKey);
    if (cached !== null) {
      logger.debug('LSPClient', `Hover cache hit: ${cacheKey}`);
      return cached;
    }

    // 调用真实客户端
    try {
      const result = await this.realClient.textDocumentHover(file, position);
      this.setCachedData(this.hoverCache, cacheKey, result);
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Hover failed:', error);
      return null;
    }
  }

  /**
   * 跳转到定义
   */
  async gotoDefinition(file: string, position: Position): Promise<Location | null> {
    const cacheKey = this.getCacheKey(file, position);

    // 检查缓存
    const cached = this.getCachedData(this.definitionCache, cacheKey);
    if (cached !== null) {
      logger.debug('LSPClient', `Definition cache hit: ${cacheKey}`);
      return cached;
    }

    // 调用真实客户端
    try {
      const result = await this.realClient.textDocumentDefinition(file, position);
      this.setCachedData(this.definitionCache, cacheKey, result);
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Go to definition failed:', error);
      return null;
    }
  }

  /**
   * 查找引用
   */
  async findReferences(file: string, position: Position): Promise<Location[]> {
    const cacheKey = this.getCacheKey(file, position);

    // 检查缓存
    const cached = this.getCachedData(this.referencesCache, cacheKey);
    if (cached !== null) {
      logger.debug('LSPClient', `References cache hit: ${cacheKey}`);
      return cached;
    }

    // 调用真实客户端
    try {
      const result = await this.realClient.textDocumentReferences(file, position);
      this.setCachedData(this.referencesCache, cacheKey, result);
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Find references failed:', error);
      return [];
    }
  }

  /**
   * 重命名符号
   */
  async rename(file: string, position: Position, newName: string): Promise<WorkspaceEdit | null> {
    // 重命名操作不使用缓存
    try {
      const result = await this.realClient.textDocumentRename(file, position, newName);
      // 重命名后清除所有缓存
      this.clearCache();
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Rename failed:', error);
      return null;
    }
  }

  /**
   * 获取诊断信息
   */
  async getDiagnostics(file: string): Promise<Diagnostic[]> {
    const cacheKey = file;

    // 检查缓存
    const cached = this.getCachedData(this.diagnosticsCache, cacheKey);
    if (cached !== null) {
      logger.debug('LSPClient', `Diagnostics cache hit: ${cacheKey}`);
      return cached;
    }

    // 调用真实客户端
    try {
      const result = await this.realClient.textDocumentDiagnostics(file);
      this.setCachedData(this.diagnosticsCache, cacheKey, result);
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Get diagnostics failed:', error);
      return [];
    }
  }

  /**
   * 代码补全
   */
  async completion(file: string, position: Position): Promise<CompletionItem[]> {
    const cacheKey = this.getCacheKey(file, position);

    // 检查缓存
    const cached = this.getCachedData(this.completionCache, cacheKey);
    if (cached !== null) {
      logger.debug('LSPClient', `Completion cache hit: ${cacheKey}`);
      return cached;
    }

    // 调用真实客户端
    try {
      const result = await this.realClient.textDocumentCompletion(file, position);
      this.setCachedData(this.completionCache, cacheKey, result);
      return result;
    } catch (error) {
      logger.error('LSPClient', 'Completion failed:', error);
      return [];
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      hover: this.hoverCache.size,
      definition: this.definitionCache.size,
      references: this.referencesCache.size,
      diagnostics: this.diagnosticsCache.size,
      completion: this.completionCache.size,
      total: this.hoverCache.size + this.definitionCache.size +
             this.referencesCache.size + this.diagnosticsCache.size +
             this.completionCache.size,
    };
  }
}

export default LSPClient;
