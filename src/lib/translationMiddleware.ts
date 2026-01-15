import { api, type TranslationConfig } from "./api";

/**
 * 速率限制配置接口
 */
interface RateLimitConfig {
  rpm: number; // Requests Per Minute
  tpm: number; // Tokens Per Minute
  maxConcurrent: number; // 最大并发请求数
  batchSize: number; // 批处理大小
}

/**
 * 请求队列项接口
 */
interface QueueItem {
  id: string;
  text: string;
  targetLanguage: string;
  priority: number;
  estimatedTokens: number;
  timestamp: number;
  resolve: (result: string) => void;
  reject: (error: any) => void;
}

/**
 * 翻译中间件 - 提供透明的中英文翻译功能 (性能优化版)
 *
 * 核心功能：
 * 1. 中文输入自动翻译为英文发送给Claude API
 * 2. Claude英文响应自动翻译为中文显示给用户
 * 3. 对用户完全透明
 * 4. 智能速率限制管理 (RPM: 1,000, TPM: 80,000)
 * 5. 请求队列和批处理优化
 * 6. 智能缓存和去重机制
 */
export class TranslationMiddleware {
  private config: TranslationConfig | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null; // 🚀 缓存初始化 Promise，避免重复初始化
  private cachedIsEnabled: boolean | null = null; // 🚀 缓存 isEnabled 状态

  // 性能优化相关
  private rateLimitConfig: RateLimitConfig = {
    rpm: 950, // 略低于1,000以留安全余量
    tpm: 75000, // 略低于80,000以留安全余量
    maxConcurrent: 5, // 最大并发请求数
    batchSize: 10, // 批处理大小
  };

  // 速率限制跟踪
  private requestTimes: number[] = [];
  private tokenUsage: Array<{ timestamp: number; tokens: number }> = [];
  private activeRequests = 0;

  // 请求队列
  private translationQueue: QueueItem[] = [];
  private isProcessingQueue = false;

  // 智能缓存
  private translationCache = new Map<
    string,
    { result: string; timestamp: number; tokens: number }
  >();
  private maxCacheSize = 1000;
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  constructor() {
    this.init();
    this.startQueueProcessor();
    this.startCacheCleanup();
  }

  /**
   * 估算文本的Token数量 (粗略估算)
   */
  private estimateTokens(text: string): number {
    // 英文: 大约4个字符 = 1个token
    // 中文: 大约1-2个字符 = 1个token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 1.5 + otherChars / 4);
  }

  /**
   * 检查是否可以发送请求（速率限制）
   */
  private canMakeRequest(estimatedTokens: number): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 清理过期的请求时间记录
    this.requestTimes = this.requestTimes.filter((time) => time > oneMinuteAgo);
    this.tokenUsage = this.tokenUsage.filter((usage) => usage.timestamp > oneMinuteAgo);

    // 检查RPM限制
    if (this.requestTimes.length >= this.rateLimitConfig.rpm) {
      return false;
    }

    // 检查TPM限制
    const currentTokenUsage = this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0);
    if (currentTokenUsage + estimatedTokens > this.rateLimitConfig.tpm) {
      return false;
    }

    // 检查并发限制
    if (this.activeRequests >= this.rateLimitConfig.maxConcurrent) {
      return false;
    }

    return true;
  }

  /**
   * 记录请求和Token使用
   */
  private recordRequest(tokens: number): void {
    const now = Date.now();
    this.requestTimes.push(now);
    this.tokenUsage.push({ timestamp: now, tokens });
    this.activeRequests++;
  }

  /**
   * 完成请求记录
   */
  private completeRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string, targetLanguage: string): string {
    return `${targetLanguage}:${text.trim().toLowerCase()}`;
  }

  /**
   * 从缓存获取翻译结果
   */
  private getFromCache(text: string, targetLanguage: string): string | null {
    const key = this.getCacheKey(text, targetLanguage);
    const cached = this.translationCache.get(key);

    if (cached) {
      // 检查缓存是否过期 (1小时)
      if (Date.now() - cached.timestamp < 3600000) {
        this.cacheHitCount++;
        return cached.result;
      } else {
        this.translationCache.delete(key);
      }
    }

    this.cacheMissCount++;
    return null;
  }

  /**
   * 存储到缓存
   */
  private storeToCache(text: string, targetLanguage: string, result: string, tokens: number): void {
    const key = this.getCacheKey(text, targetLanguage);

    // 如果缓存已满，删除最旧的条目
    if (this.translationCache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.translationCache.keys())[0];
      this.translationCache.delete(oldestKey);
    }

    this.translationCache.set(key, {
      result,
      timestamp: Date.now(),
      tokens,
    });
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000); // 每秒检查队列
  }

  /**
   * 启动缓存清理器
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // 每5分钟清理过期缓存
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this.translationCache.entries()) {
      if (now - value.timestamp > 3600000) {
        // 1小时过期
        expired.push(key);
      }
    }

    expired.forEach((key) => this.translationCache.delete(key));

    if (expired.length > 0) {
    }
  }

  /**
   * 处理翻译队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.translationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // 按优先级排序队列
      this.translationQueue.sort((a, b) => b.priority - a.priority);

      // 收集可以批处理的项目
      const batchItems: QueueItem[] = [];
      let totalEstimatedTokens = 0;

      for (const item of this.translationQueue) {
        if (batchItems.length >= this.rateLimitConfig.batchSize) {
          break;
        }

        if (totalEstimatedTokens + item.estimatedTokens > this.rateLimitConfig.tpm / 4) {
          break; // 避免单次批处理消耗太多token
        }

        if (this.canMakeRequest(item.estimatedTokens)) {
          batchItems.push(item);
          totalEstimatedTokens += item.estimatedTokens;
        } else {
          break; // 达到速率限制，停止处理
        }
      }

      if (batchItems.length > 0) {
        await this.processBatch(batchItems);

        // 从队列中移除已处理的项目
        this.translationQueue = this.translationQueue.filter((item) => !batchItems.includes(item));
      }
    } catch (error) {
      console.error("[TranslationMiddleware] Queue processing error:", error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 处理批量翻译
   */
  private async processBatch(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;

    try {
      // 记录请求
      const totalTokens = items.reduce((sum, item) => sum + item.estimatedTokens, 0);
      this.recordRequest(totalTokens);

      // 去重处理 - 相同文本和目标语言的请求
      const uniqueItems = new Map<string, QueueItem[]>();

      for (const item of items) {
        const key = this.getCacheKey(item.text, item.targetLanguage);
        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, []);
        }
        uniqueItems.get(key)!.push(item);
      }

      // 处理每个唯一的翻译请求
      for (const [, duplicateItems] of uniqueItems.entries()) {
        const firstItem = duplicateItems[0];

        try {
          // 检查缓存
          let result = this.getFromCache(firstItem.text, firstItem.targetLanguage);

          if (!result) {
            // 执行翻译
            result = await api.translateText(firstItem.text, firstItem.targetLanguage);

            // 存储到缓存
            if (result) {
              this.storeToCache(
                firstItem.text,
                firstItem.targetLanguage,
                result,
                firstItem.estimatedTokens,
              );
            }
          }

          // 解析所有重复的请求
          if (result) {
            duplicateItems.forEach((item) => item.resolve(result!));
          } else {
            duplicateItems.forEach((item) => item.reject(new Error("Translation failed")));
          }
        } catch (error) {
          // 拒绝所有重复的请求
          duplicateItems.forEach((item) => item.reject(error));
        }
      }
    } catch (error) {
      // 拒绝所有项目
      items.forEach((item) => item.reject(error));
    } finally {
      this.completeRequest();
    }
  }

  /**
   * 优化的队列化翻译方法
   */
  private async queueTranslation(
    text: string,
    targetLanguage: string,
    priority: number = 1,
  ): Promise<string> {
    // 检查缓存
    const cachedResult = this.getFromCache(text, targetLanguage);
    if (cachedResult) {
      return cachedResult;
    }

    return new Promise<string>((resolve, reject) => {
      const queueItem: QueueItem = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        targetLanguage,
        priority,
        estimatedTokens: this.estimateTokens(text),
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // 添加到队列
      this.translationQueue.push(queueItem);

      // 如果可以立即处理，触发队列处理
      if (this.canMakeRequest(queueItem.estimatedTokens) && !this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * 配置速率限制 (根据API配额调整)
   */
  public configureRateLimits(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = {
      ...this.rateLimitConfig,
      ...config,
    };
  }

  /**
   * 获取性能统计信息
   */
  public getPerformanceStats(): {
    queueLength: number;
    activeRequests: number;
    cacheSize: number;
    cacheHitRate: number;
    rateLimits: RateLimitConfig;
    tokenUsageLastMinute: number;
    requestsLastMinute: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentTokenUsage = this.tokenUsage
      .filter((usage) => usage.timestamp > oneMinuteAgo)
      .reduce((sum, usage) => sum + usage.tokens, 0);

    const recentRequests = this.requestTimes.filter((time) => time > oneMinuteAgo).length;

    const totalCacheAccess = this.cacheHitCount + this.cacheMissCount;
    const cacheHitRate = totalCacheAccess > 0 ? this.cacheHitCount / totalCacheAccess : 0;

    return {
      queueLength: this.translationQueue.length,
      activeRequests: this.activeRequests,
      cacheSize: this.translationCache.size,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      rateLimits: this.rateLimitConfig,
      tokenUsageLastMinute: recentTokenUsage,
      requestsLastMinute: recentRequests,
    };
  }

  /**
   * 初始化翻译中间件
   */
  private async init(): Promise<void> {
    try {
      this.config = await api.getTranslationConfig();
      this.initialized = true;
      this.cachedIsEnabled = this.config?.enabled ?? false; // 🚀 缓存状态
    } catch (error) {
      console.warn("[TranslationMiddleware] ⚠️ Failed to load saved config, using default:", error);
      this.config = {
        enabled: true, // 🔧 修复：默认启用翻译功能
        api_base_url: "https://api.siliconflow.cn/v1",
        api_key: "sk-ednywbvnfwerfcxnqjkmnhxvgcqoyuhmjvfywrshpxsgjbzm",
        model: "tencent/Hunyuan-MT-7B",
        timeout_seconds: 30,
        cache_ttl_seconds: 3600,
      };
      this.initialized = true;
      this.cachedIsEnabled = true; // 🚀 缓存状态
    }
  }

  /**
   * 确保中间件已初始化
   * 🚀 性能优化：使用 Promise 缓存避免重复初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // 如果已经有初始化 Promise 在进行中，等待它完成
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    // 创建并缓存初始化 Promise
    this.initPromise = this.init();
    await this.initPromise;
  }

  /**
   * 检查翻译功能是否启用
   * 🚀 性能优化：优先使用缓存状态，避免每次都等待初始化
   */
  public async isEnabled(): Promise<boolean> {
    // 如果已有缓存，直接返回（同步路径，极快）
    if (this.cachedIsEnabled !== null) {
      return this.cachedIsEnabled;
    }
    await this.ensureInitialized();
    return this.config?.enabled ?? false;
  }

  /**
   * 同步检查翻译功能是否启用（用于性能敏感场景）
   * 🚀 新增：完全同步的检查方法
   */
  public isEnabledSync(): boolean {
    return this.cachedIsEnabled ?? false;
  }

  /**
   * 检测文本语言
   */
  public async detectLanguage(text: string): Promise<string> {
    try {
      return await api.detectTextLanguage(text);
    } catch (error) {
      console.error("[TranslationMiddleware] Language detection failed:", error);
      // 使用更强的中英文检测回退
      return this.detectChineseContent(text) ? "zh" : "en";
    }
  }

  /**
   * 改进的中文内容检测，更智能地处理混合内容
   */
  private detectChineseContent(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // 扩展的中文字符范围匹配
    const chineseChars = text.match(
      /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g,
    );

    if (!chineseChars) {
      return false;
    }

    // 简化的预处理：只移除明确的非中文内容
    const preprocessedText = text
      // 保留中文标点和全角字符
      // 移除明确的URL
      .replace(/https?:\/\/[^\s\u4e00-\u9fff]+/g, " ")
      // 移除Windows路径（但保留包含中文的路径）
      .replace(/[a-zA-Z]:[\\//](?![\s\S]*[\u4e00-\u9fff])[^\s]+/g, " ")
      // 移除纯英文的错误前缀（但保留包含中文的错误信息）
      .replace(/^\s*(error|warning|info|debug):\s*(?![\s\S]*[\u4e00-\u9fff])/gim, " ")
      // 移除纯英文代码块
      .replace(/```(?![\s\S]*[\u4e00-\u9fff])[\s\S]*?```/g, " ")
      // 移除纯英文行内代码
      .replace(/`(?![^`]*[\u4e00-\u9fff])[^`]+`/g, " ")
      // 移除邮箱地址
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 重新计算中文字符
    const finalChineseChars = preprocessedText.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
    const totalLength = preprocessedText.length;
    const chineseCount = finalChineseChars?.length || 0;

    // 🔧 优化：更宽松的中文检测逻辑
    // 1. 有1个或以上中文字符就可能是中文（适合短文本）
    // 2. 对于较长文本，要求中文字符占比达到一定比例
    // 3. 特殊处理：如果中文字符数量足够多，直接认为是中文
    if (chineseCount >= 1) {
      const ratio = totalLength > 0 ? chineseCount / totalLength : 1;
      const originalRatio = text.length > 0 ? chineseChars.length / text.length : 0;

      // 短文本：有中文字符就认为是中文
      if (text.length <= 20 && chineseCount >= 1) {
        return true;
      }

      // 长文本：要求一定比例，或中文字符数量足够多
      return ratio >= 0.1 || originalRatio >= 0.08 || chineseCount >= 5;
    }

    return false;
  }

  /**
   * 检测是否为斜杠命令
   *
   * @param text 输入文本
   * @returns 是否为斜杠命令
   */
  private isSlashCommand(text: string): boolean {
    const trimmedText = text.trim();

    // 检查是否以斜杠开头
    if (!trimmedText.startsWith("/")) {
      return false;
    }

    // 排除双斜杠注释（如 // 注释）
    if (trimmedText.startsWith("//")) {
      return false;
    }

    // 排除直接的URL（整个字符串是URL）
    if (trimmedText.match(/^https?:\/\/|^ftp:\/\/|^file:\/\/|^\/\//)) {
      return false;
    }

    return true;
  }

  /**
   * 翻译用户输入（中文->英文）
   *
   * 在发送给Claude API之前调用此方法
   * 如果输入是中文，则翻译为英文
   * 如果输入已经是英文或翻译功能未启用，则直接返回原文
   *
   * 特殊处理：
   * - 跳过斜杠命令（以 / 开头的命令）的翻译，保持原样传递
   * - 增强了斜杠命令检测的鲁棒性，避免误判URL等情况
   *
   * @param userInput 用户输入的原始文本
   * @returns 处理后的文本（翻译后的英文或原始文本）
   */
  public async translateUserInput(userInput: string): Promise<{
    translatedText: string;
    originalText: string;
    wasTranslated: boolean;
    detectedLanguage: string;
  }> {
    await this.ensureInitialized();

    // 检查是否为斜杠命令 - 如果是，直接返回原文不翻译
    if (this.isSlashCommand(userInput)) {
      // 对于斜杠命令，我们仍然检测语言，但不进行翻译
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    // 检查翻译功能是否启用
    if (!this.config?.enabled) {
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    try {
      // 检测语言
      const detectedLanguage = await this.detectLanguage(userInput);
      // 改进的中文检测策略：同时使用语言代码检测和内容检测
      const isChineseByCode = detectedLanguage?.toLowerCase().startsWith("zh");
      const isChineseByContent = this.detectChineseContent(userInput);

      // 优先信任内容检测，因为它更准确
      const isAsciiOnly = /^[\u0000-\u007F]*$/.test(userInput);
      const shouldTranslate = isChineseByContent || (isChineseByCode && !isAsciiOnly);

      // 如果检测到中文，使用队列化翻译为英文
      if (shouldTranslate) {
        try {
          const translatedText = await this.queueTranslation(userInput, "en", 3); // 高优先级

          // 验证翻译结果不为空且不等于原文
          if (translatedText && translatedText.trim() !== userInput.trim()) {
            return {
              translatedText,
              originalText: userInput,
              wasTranslated: true,
              detectedLanguage,
            };
          } else {
            console.warn(
              "[TranslationMiddleware] ⚠️ Translation returned empty or unchanged result, using original text",
            );
          }
        } catch (error) {
          console.error("[TranslationMiddleware] ❌ Translation failed:", error);
        }
      }

      // 如果已经是英文或其他语言，直接返回
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage,
      };
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to translate user input:", error);
      // 降级策略：翻译失败时返回原文
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }
  }

  /**
   * 翻译Claude响应（英文->中文）
   *
   * 在显示Claude响应给用户之前调用此方法
   * 如果响应是英文且用户原始输入是中文，则翻译为中文
   * 如果翻译功能未启用或用户输入本来就是英文，则直接返回原文
   *
   * @param claudeResponse Claude API返回的响应文本
   * @param userInputWasChinese 用户原始输入是否为中文（用于决定是否需要翻译响应）
   * @returns 处理后的响应文本（翻译后的中文或原始文本）
   */
  public async translateClaudeResponse(
    claudeResponse: string,
    _userInputWasChinese: boolean = false, // 🔧 参数保留用于API兼容性，但当前未使用
  ): Promise<{
    translatedText: string;
    originalText: string;
    wasTranslated: boolean;
    detectedLanguage: string;
  }> {
    await this.ensureInitialized();

    // 🔧 防重复翻译：检查内容是否过短或为空
    if (!claudeResponse || claudeResponse.trim().length === 0) {
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: "unknown",
      };
    }

    // 🔧 防重复翻译：检查内容是否过短（少于3个字符的内容通常不需要翻译）
    if (claudeResponse.trim().length < 3) {
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: "short",
      };
    }

    // 检查翻译功能是否启用
    if (!this.config?.enabled) {
      const detectedLang = await this.detectLanguage(claudeResponse);
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    try {
      // 检测响应语言
      const detectedLanguage = await this.detectLanguage(claudeResponse);

      // 🔧 优化：只翻译确定为英文的响应
      if (detectedLanguage === "en") {
        try {
          const translatedText = await this.queueTranslation(claudeResponse, "zh", 2); // 中等优先级

          return {
            translatedText,
            originalText: claudeResponse,
            wasTranslated: true,
            detectedLanguage,
          };
        } catch (translationError) {
          console.error("[TranslationMiddleware] ❌ Translation queue failed:", translationError);
          // 翻译失败时返回原文，不抛出错误
          return {
            translatedText: claudeResponse,
            originalText: claudeResponse,
            wasTranslated: false,
            detectedLanguage,
          };
        }
      }

      // 如果响应已经是中文或其他语言，直接返回原文
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage,
      };
    } catch (error) {
      console.error("[TranslationMiddleware] ❌ Failed to translate Claude response:", error);
      // 降级策略：翻译失败时返回原文
      const detectedLang = await this.detectLanguage(claudeResponse);
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }
  }

  /**
   * 批量翻译文本（用于处理多条消息）- 性能优化版
   * 使用队列化处理和智能去重
   */
  public async translateBatch(texts: string[], targetLanguage: string = "zh"): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.config?.enabled) {
      return texts;
    }

    try {
      // 过滤空文本
      const validTexts = texts.filter((text) => text && text.trim().length > 0);

      if (validTexts.length === 0) {
        return texts;
      }
      // 使用 Promise.all 并行处理，队列系统会自动管理速率限制
      const translationPromises = validTexts.map(
        (text) => this.queueTranslation(text, targetLanguage, 1), // 标准优先级
      );

      const translatedTexts = await Promise.all(translationPromises);

      // 重新组装结果，保持原始数组的结构
      const results: string[] = [];
      let translatedIndex = 0;

      for (const originalText of texts) {
        if (originalText && originalText.trim().length > 0) {
          results.push(translatedTexts[translatedIndex++]);
        } else {
          results.push(originalText); // 保持空文本不变
        }
      }

      return results;
    } catch (error) {
      console.error("[TranslationMiddleware] Batch translation failed:", error);
      return texts; // 降级策略：返回原文
    }
  }

  /**
   * 更新翻译配置
   */
  public async updateConfig(config: TranslationConfig): Promise<void> {
    try {
      await api.updateTranslationConfig(config);
      this.config = config;
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to update configuration:", error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  public async getConfig(): Promise<TranslationConfig> {
    await this.ensureInitialized();
    return this.config!;
  }

  /**
   * 启用/禁用翻译功能
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    if (this.config) {
      this.config.enabled = enabled;
      await this.updateConfig(this.config);
    }
  }

  /**
   * 清空翻译缓存
   */
  public async clearCache(): Promise<void> {
    try {
      await api.clearTranslationCache();
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to clear cache:", error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  public async getCacheStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  }> {
    try {
      const stats = await api.getTranslationCacheStats();
      return {
        totalEntries: stats.total_entries,
        expiredEntries: stats.expired_entries,
        activeEntries: stats.active_entries,
      };
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to get cache stats:", error);
      throw error;
    }
  }

  /**
   * 翻译错误消息或状态消息（用于UI反馈）
   * 专门用于翻译错误信息、通知消息等UI反馈内容
   */
  public async translateErrorMessage(message: string): Promise<string> {
    await this.ensureInitialized();

    if (!this.config?.enabled || !message || message.trim().length === 0) {
      return message;
    }

    try {
      // 检测语言，如果是英文则翻译为中文
      const detectedLanguage = await this.detectLanguage(message);

      if (detectedLanguage === "en") {
        const result = await this.queueTranslation(message, "zh", 2); // 中等优先级
        return result || message;
      }

      return message;
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to translate error message:", error);
      return message; // 失败时返回原消息
    }
  }

  /**
   * 批量翻译错误消息
   */
  public async translateErrorMessages(messages: string[]): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.config?.enabled) {
      return messages;
    }

    try {
      const translationPromises = messages.map((message) => this.translateErrorMessage(message));

      return await Promise.all(translationPromises);
    } catch (error) {
      console.error("[TranslationMiddleware] Failed to translate error messages:", error);
      return messages;
    }
  }
}

// 导出单例实例
export const translationMiddleware = new TranslationMiddleware();

/**
 * 工具函数：检测是否为斜杠命令
 * 可以在其他组件中使用，确保检测逻辑的一致性
 *
 * @param text 输入文本
 * @returns 是否为斜杠命令
 */
export function isSlashCommand(text: string): boolean {
  const trimmedText = text.trim();

  // 检查是否以斜杠开头
  if (!trimmedText.startsWith("/")) {
    return false;
  }

  // 排除双斜杠注释（如 // 注释）
  if (trimmedText.startsWith("//")) {
    return false;
  }

  // 排除直接的URL（整个字符串是URL）
  if (trimmedText.match(/^https?:\/\/|^ftp:\/\/|^file:\/\/|^\/\//)) {
    return false;
  }

  return true;
}

/**
 * 翻译结果接口
 */
export interface TranslationResult {
  translatedText: string;
  originalText: string;
  wasTranslated: boolean;
  detectedLanguage: string;
}

/**
 * 翻译中间件状态接口
 */
export interface TranslationStatus {
  enabled: boolean;
  cacheEntries: number;
  lastError?: string;
}
