/**
 * ModelRouter - 多模型路由器
 *
 * 支持多个 AI 提供商，实现智能路由、回退和健康监控
 *
 * Requirements: 7.1, 7.3, 7.4, 7.7
 */

import { ModelProvider, ModelConfig } from "../types/unified-agent";
import {
  RealAPIClient,
  createHiAPIClient,
  createOpenAIClient,
  APIClientConfig,
} from "../api/RealAPIClient";
import { TokenTracker } from "../api/TokenTracker";

// 模型健康状态
export interface ModelHealth {
  provider: ModelProvider;
  model: string;
  healthy: boolean;
  lastCheck: number;
  latency: number;
  errorCount: number;
  successCount: number;
  lastError?: string;
  consecutiveFailures: number;
  recoveryAttempts: number;
}

// 健康监控配置
export interface HealthMonitorConfig {
  checkInterval: number; // 健康检查间隔（毫秒）
  unhealthyThreshold: number; // 标记为不健康的连续失败次数
  recoveryThreshold: number; // 恢复健康的连续成功次数
  maxRecoveryAttempts: number; // 最大恢复尝试次数
  circuitBreakerTimeout: number; // 熔断器超时（毫秒）
}

// 模型使用统计
export interface ModelUsageStats {
  provider: ModelProvider;
  model: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  averageLatency: number;
}

// 请求选项
export interface ModelRequestOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// 响应结果
export interface ModelResponse {
  content: string;
  model: string;
  provider: ModelProvider;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latency: number;
  cost: number;
}

// 模型定价（每 1M tokens）
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-3-opus": { input: 15, output: 75 },
  "claude-3-sonnet": { input: 3, output: 15 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "claude-3.5-sonnet": { input: 3, output: 15 },
  // OpenAI
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4o": { input: 5, output: 15 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  // Google
  "gemini-pro": { input: 0.5, output: 1.5 },
  "gemini-1.5-pro": { input: 3.5, output: 10.5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  // xAI
  "grok-1": { input: 5, output: 15 },
  "grok-2": { input: 2, output: 10 },
};

// 默认回退链
const DEFAULT_FALLBACK_CHAIN: Record<ModelProvider, ModelProvider[]> = {
  anthropic: ["openai", "google", "xai"],
  openai: ["anthropic", "google", "xai"],
  google: ["anthropic", "openai", "xai"],
  xai: ["anthropic", "openai", "google"],
};

// API 客户端接口
export interface ModelAPIClient {
  chat(options: ModelRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
  }>;
}

/**
 * ModelRouter 类
 */
export class ModelRouter {
  private configs: Map<string, ModelConfig> = new Map();
  private health: Map<string, ModelHealth> = new Map();
  private usage: Map<string, ModelUsageStats> = new Map();
  private clients: Map<ModelProvider, ModelAPIClient> = new Map();
  private realClients: Map<string, RealAPIClient> = new Map();
  private tokenTracker: TokenTracker;
  private fallbackChain: Record<ModelProvider, ModelProvider[]>;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private healthMonitorConfig: HealthMonitorConfig;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, { open: boolean; openedAt: number }> = new Map();

  constructor(options?: {
    fallbackChain?: Record<ModelProvider, ModelProvider[]>;
    maxRetries?: number;
    healthMonitor?: Partial<HealthMonitorConfig>;
  }) {
    this.fallbackChain = options?.fallbackChain ?? DEFAULT_FALLBACK_CHAIN;
    this.maxRetries = options?.maxRetries ?? 3;
    this.tokenTracker = new TokenTracker();
    this.healthMonitorConfig = {
      checkInterval: options?.healthMonitor?.checkInterval ?? 60000,
      unhealthyThreshold: options?.healthMonitor?.unhealthyThreshold ?? 3,
      recoveryThreshold: options?.healthMonitor?.recoveryThreshold ?? 2,
      maxRecoveryAttempts: options?.healthMonitor?.maxRecoveryAttempts ?? 5,
      circuitBreakerTimeout: options?.healthMonitor?.circuitBreakerTimeout ?? 30000,
    };
  }

  // ==========================================================================
  // RealAPIClient 集成
  // Requirements: 2.4
  // ==========================================================================

  /**
   * 注册 RealAPIClient 作为默认客户端
   */
  registerRealClient(provider: ModelProvider, config: APIClientConfig): void {
    const client = new RealAPIClient(config);
    this.realClients.set(provider, client);

    // 同时注册为 ModelAPIClient
    this.clients.set(provider, client);
  }

  /**
   * 使用 HiAPI 中转服务
   */
  useHiAPI(apiKey: string, options?: Partial<APIClientConfig>): void {
    const client = createHiAPIClient(apiKey, options);

    // HiAPI 支持多个提供商，注册为默认
    this.realClients.set("hiapi" as ModelProvider, client);

    // 为所有提供商注册同一个客户端（HiAPI 中转）
    const providers: ModelProvider[] = ["anthropic", "openai", "google", "xai"];
    for (const provider of providers) {
      if (!this.clients.has(provider)) {
        this.clients.set(provider, client);
      }
    }
  }

  /**
   * 使用 OpenAI 直连
   */
  useOpenAI(apiKey: string, options?: Partial<APIClientConfig>): void {
    const client = createOpenAIClient(apiKey, options);
    this.realClients.set("openai", client);
    this.clients.set("openai", client);
  }

  /**
   * 获取 RealAPIClient
   */
  getRealClient(provider: ModelProvider): RealAPIClient | undefined {
    return this.realClients.get(provider);
  }

  /**
   * 获取 Token 追踪器
   */
  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  // ==========================================================================
  // 配置管理
  // ==========================================================================

  /**
   * 注册模型配置
   * Requirements: 7.1
   */
  registerModel(id: string, config: ModelConfig): void {
    this.configs.set(id, config);

    // 初始化健康状态
    const healthKey = `${config.provider}:${config.model}`;
    if (!this.health.has(healthKey)) {
      this.health.set(healthKey, {
        provider: config.provider,
        model: config.model,
        healthy: true,
        lastCheck: Date.now(),
        latency: 0,
        errorCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        recoveryAttempts: 0,
      });
    }

    // 初始化熔断器
    if (!this.circuitBreakers.has(healthKey)) {
      this.circuitBreakers.set(healthKey, { open: false, openedAt: 0 });
    }

    // 初始化使用统计
    if (!this.usage.has(healthKey)) {
      this.usage.set(healthKey, {
        provider: config.provider,
        model: config.model,
        totalRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
      });
    }
  }

  /**
   * 注册 API 客户端
   */
  registerClient(provider: ModelProvider, client: ModelAPIClient): void {
    this.clients.set(provider, client);
  }

  /**
   * 获取模型配置
   */
  getConfig(id: string): ModelConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * 获取所有已注册的模型
   */
  listModels(): Array<{ id: string; config: ModelConfig }> {
    return Array.from(this.configs.entries()).map(([id, config]) => ({
      id,
      config,
    }));
  }

  // ==========================================================================
  // 请求路由
  // ==========================================================================

  /**
   * 发送请求到模型
   * Requirements: 7.1, 7.3
   */
  async chat(modelId: string, options: ModelRequestOptions): Promise<ModelResponse> {
    const config = this.configs.get(modelId);
    if (!config) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // 尝试主模型
    try {
      return await this.executeWithRetry(config, options);
    } catch (error) {
      // 尝试回退模型
      return await this.executeWithFallback(config, options, error as Error);
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    config: ModelConfig,
    options: ModelRequestOptions,
    retries: number = 0
  ): Promise<ModelResponse> {
    const client = this.clients.get(config.provider);
    if (!client) {
      throw new Error(`No client registered for provider: ${config.provider}`);
    }

    const startTime = Date.now();
    const healthKey = `${config.provider}:${config.model}`;

    try {
      const result = await client.chat({
        ...options,
        temperature: options.temperature ?? config.temperature,
        maxTokens: options.maxTokens ?? config.maxTokens,
      });

      const latency = Date.now() - startTime;
      const totalTokens = result.usage.inputTokens + result.usage.outputTokens;
      const cost = this.calculateCost(
        config.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );

      // 更新健康状态
      this.updateHealth(healthKey, true, latency);

      // 更新使用统计
      this.updateUsage(
        healthKey,
        result.usage.inputTokens,
        result.usage.outputTokens,
        cost,
        latency
      );

      // 记录到 TokenTracker
      this.tokenTracker.recordUsage({
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        totalTokens,
        model: config.model,
      });

      return {
        content: result.content,
        model: config.model,
        provider: config.provider,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens,
        },
        latency,
        cost,
      };
    } catch (error) {
      // 更新健康状态
      this.updateHealth(healthKey, false, 0, (error as Error).message);

      // 重试
      if (retries < this.maxRetries) {
        await this.delay(this.retryDelay * Math.pow(2, retries));
        return this.executeWithRetry(config, options, retries + 1);
      }

      throw error;
    }
  }

  /**
   * 带回退的执行
   * Requirements: 7.3
   */
  private async executeWithFallback(
    originalConfig: ModelConfig,
    options: ModelRequestOptions,
    originalError: Error
  ): Promise<ModelResponse> {
    // 检查是否有配置的回退模型
    if (originalConfig.fallbackModel) {
      const fallbackConfig = this.configs.get(originalConfig.fallbackModel);
      if (fallbackConfig) {
        try {
          return await this.executeWithRetry(fallbackConfig, options);
        } catch {
          // 继续尝试其他回退
        }
      }
    }

    // 尝试回退链中的其他提供商
    const fallbackProviders = this.fallbackChain[originalConfig.provider] ?? [];

    for (const provider of fallbackProviders) {
      // 找到该提供商的健康模型
      const healthyModel = this.findHealthyModel(provider);
      if (healthyModel) {
        try {
          return await this.executeWithRetry(healthyModel, options);
        } catch {
          // 继续尝试下一个
        }
      }
    }

    // 所有回退都失败
    throw new Error(`All fallback models failed. Original error: ${originalError.message}`);
  }

  /**
   * 查找健康的模型
   */
  private findHealthyModel(provider: ModelProvider): ModelConfig | null {
    for (const [, config] of this.configs) {
      if (config.provider === provider) {
        const healthKey = `${config.provider}:${config.model}`;
        const health = this.health.get(healthKey);
        if (health?.healthy) {
          return config;
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // 健康监控
  // ==========================================================================

  /**
   * 获取模型健康状态
   * Requirements: 7.7
   */
  getHealth(provider: ModelProvider, model: string): ModelHealth | undefined {
    return this.health.get(`${provider}:${model}`);
  }

  /**
   * 获取所有健康状态
   */
  getAllHealth(): ModelHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * 检查模型是否健康
   */
  isHealthy(provider: ModelProvider, model: string): boolean {
    const health = this.health.get(`${provider}:${model}`);
    return health?.healthy ?? false;
  }

  /**
   * 更新健康状态
   */
  private updateHealth(key: string, success: boolean, latency: number, error?: string): void {
    const health = this.health.get(key);
    if (!health) return;

    if (success) {
      health.successCount++;
      health.latency = latency;
      health.consecutiveFailures = 0;

      // 检查是否达到恢复阈值
      if (!health.healthy) {
        health.recoveryAttempts = 0;
        health.healthy = true;
        this.closeCircuitBreaker(key);
      }
    } else {
      health.errorCount++;
      health.consecutiveFailures++;
      health.lastError = error;

      // 检查是否达到不健康阈值
      if (health.consecutiveFailures >= this.healthMonitorConfig.unhealthyThreshold) {
        health.healthy = false;
        this.openCircuitBreaker(key);
      }
    }
    health.lastCheck = Date.now();
  }

  /**
   * 执行健康检查
   * Requirements: 7.7
   */
  async performHealthCheck(provider: ModelProvider, model: string): Promise<boolean> {
    const config = Array.from(this.configs.values()).find(
      (c) => c.provider === provider && c.model === model
    );

    if (!config) return false;

    const client = this.clients.get(provider);
    if (!client) return false;

    const healthKey = `${provider}:${model}`;
    const startTime = Date.now();

    try {
      await client.chat({
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 1,
      });

      this.updateHealth(healthKey, true, Date.now() - startTime);
      return true;
    } catch (error) {
      this.updateHealth(healthKey, false, 0, (error as Error).message);
      return false;
    }
  }

  /**
   * 重置健康状态（用于恢复）
   */
  resetHealth(provider: ModelProvider, model: string): void {
    const key = `${provider}:${model}`;
    const health = this.health.get(key);
    if (health) {
      health.healthy = true;
      health.errorCount = 0;
      health.consecutiveFailures = 0;
      health.recoveryAttempts = 0;
      health.lastError = undefined;
    }

    // 重置熔断器
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.open = false;
      breaker.openedAt = 0;
    }
  }

  /**
   * 启动自动健康检查
   * Requirements: 7.7
   */
  startHealthMonitoring(): void {
    for (const [key, health] of this.health) {
      if (this.healthCheckTimers.has(key)) continue;

      const timer = setInterval(async () => {
        await this.performHealthCheck(health.provider, health.model);
      }, this.healthMonitorConfig.checkInterval);

      this.healthCheckTimers.set(key, timer);
    }
  }

  /**
   * 停止自动健康检查
   */
  stopHealthMonitoring(): void {
    for (const [key, timer] of this.healthCheckTimers) {
      clearInterval(timer);
      this.healthCheckTimers.delete(key);
    }
  }

  /**
   * 检查熔断器状态
   * Requirements: 7.7
   */
  isCircuitOpen(provider: ModelProvider, model: string): boolean {
    const key = `${provider}:${model}`;
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return false;

    if (breaker.open) {
      // 检查是否超过熔断超时时间
      if (Date.now() - breaker.openedAt > this.healthMonitorConfig.circuitBreakerTimeout) {
        // 半开状态，允许一次尝试
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 打开熔断器
   */
  private openCircuitBreaker(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.open = true;
      breaker.openedAt = Date.now();
    }
  }

  /**
   * 关闭熔断器
   */
  private closeCircuitBreaker(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.open = false;
      breaker.openedAt = 0;
    }
  }

  /**
   * 尝试恢复不健康的模型
   * Requirements: 7.7
   */
  async attemptRecovery(provider: ModelProvider, model: string): Promise<boolean> {
    const key = `${provider}:${model}`;
    const health = this.health.get(key);
    if (!health) return false;

    if (health.recoveryAttempts >= this.healthMonitorConfig.maxRecoveryAttempts) {
      return false;
    }

    health.recoveryAttempts++;
    const success = await this.performHealthCheck(provider, model);

    if (success) {
      this.resetHealth(provider, model);
      return true;
    }

    return false;
  }

  /**
   * 获取所有不健康的模型
   */
  getUnhealthyModels(): ModelHealth[] {
    return Array.from(this.health.values()).filter((h) => !h.healthy);
  }

  /**
   * 获取健康监控状态摘要
   * Requirements: 7.7
   */
  getHealthSummary(): {
    totalModels: number;
    healthyModels: number;
    unhealthyModels: number;
    circuitBreakersOpen: number;
    averageLatency: number;
    models: Array<{
      provider: ModelProvider;
      model: string;
      healthy: boolean;
      circuitOpen: boolean;
      latency: number;
      errorRate: number;
    }>;
  } {
    const models: Array<{
      provider: ModelProvider;
      model: string;
      healthy: boolean;
      circuitOpen: boolean;
      latency: number;
      errorRate: number;
    }> = [];

    let totalLatency = 0;
    let healthyCount = 0;
    let circuitOpenCount = 0;

    for (const [, health] of this.health) {
      const circuitOpen = this.isCircuitOpen(health.provider, health.model);
      const totalRequests = health.successCount + health.errorCount;
      const errorRate = totalRequests > 0 ? health.errorCount / totalRequests : 0;

      models.push({
        provider: health.provider,
        model: health.model,
        healthy: health.healthy,
        circuitOpen,
        latency: health.latency,
        errorRate,
      });

      if (health.healthy) healthyCount++;
      if (circuitOpen) circuitOpenCount++;
      totalLatency += health.latency;
    }

    return {
      totalModels: this.health.size,
      healthyModels: healthyCount,
      unhealthyModels: this.health.size - healthyCount,
      circuitBreakersOpen: circuitOpenCount,
      averageLatency: this.health.size > 0 ? totalLatency / this.health.size : 0,
      models,
    };
  }

  // ==========================================================================
  // Token 统计
  // ==========================================================================

  /**
   * 获取使用统计
   * Requirements: 7.4
   */
  getUsage(provider: ModelProvider, model: string): ModelUsageStats | undefined {
    return this.usage.get(`${provider}:${model}`);
  }

  /**
   * 获取所有使用统计
   */
  getAllUsage(): ModelUsageStats[] {
    return Array.from(this.usage.values());
  }

  /**
   * 获取总成本
   */
  getTotalCost(): number {
    let total = 0;
    for (const stats of this.usage.values()) {
      total += stats.totalCost;
    }
    return total;
  }

  /**
   * 获取总 Token 使用量
   */
  getTotalTokens(): number {
    let total = 0;
    for (const stats of this.usage.values()) {
      total += stats.totalTokens;
    }
    return total;
  }

  /**
   * 更新使用统计
   */
  private updateUsage(
    key: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    latency: number
  ): void {
    const stats = this.usage.get(key);
    if (!stats) return;

    stats.totalRequests++;
    stats.inputTokens += inputTokens;
    stats.outputTokens += outputTokens;
    stats.totalTokens += inputTokens + outputTokens;
    stats.totalCost += cost;

    // 计算移动平均延迟
    stats.averageLatency =
      (stats.averageLatency * (stats.totalRequests - 1) + latency) / stats.totalRequests;
  }

  /**
   * 计算成本
   * Requirements: 7.4
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      // 默认定价
      return (inputTokens * 0.001 + outputTokens * 0.002) / 1000;
    }

    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;
  }

  /**
   * 重置使用统计
   */
  resetUsage(): void {
    for (const stats of this.usage.values()) {
      stats.totalRequests = 0;
      stats.totalTokens = 0;
      stats.inputTokens = 0;
      stats.outputTokens = 0;
      stats.totalCost = 0;
      stats.averageLatency = 0;
    }
  }

  /**
   * 获取按提供商分组的使用统计
   * Requirements: 7.4
   */
  getUsageByProvider(): Map<
    ModelProvider,
    {
      totalRequests: number;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      totalCost: number;
    }
  > {
    const byProvider = new Map<
      ModelProvider,
      {
        totalRequests: number;
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
      }
    >();

    for (const stats of this.usage.values()) {
      const existing = byProvider.get(stats.provider) ?? {
        totalRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
      };

      byProvider.set(stats.provider, {
        totalRequests: existing.totalRequests + stats.totalRequests,
        totalTokens: existing.totalTokens + stats.totalTokens,
        inputTokens: existing.inputTokens + stats.inputTokens,
        outputTokens: existing.outputTokens + stats.outputTokens,
        totalCost: existing.totalCost + stats.totalCost,
      });
    }

    return byProvider;
  }

  /**
   * 获取使用摘要
   * Requirements: 7.4
   */
  getUsageSummary(): {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    averageTokensPerRequest: number;
    averageCostPerRequest: number;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  } {
    let totalRequests = 0;
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCost = 0;
    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};

    for (const stats of this.usage.values()) {
      totalRequests += stats.totalRequests;
      totalTokens += stats.totalTokens;
      inputTokens += stats.inputTokens;
      outputTokens += stats.outputTokens;
      totalCost += stats.totalCost;

      // 按提供商
      if (!byProvider[stats.provider]) {
        byProvider[stats.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      byProvider[stats.provider].requests += stats.totalRequests;
      byProvider[stats.provider].tokens += stats.totalTokens;
      byProvider[stats.provider].cost += stats.totalCost;

      // 按模型
      if (!byModel[stats.model]) {
        byModel[stats.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      byModel[stats.model].requests += stats.totalRequests;
      byModel[stats.model].tokens += stats.totalTokens;
      byModel[stats.model].cost += stats.totalCost;
    }

    return {
      totalRequests,
      totalTokens,
      inputTokens,
      outputTokens,
      totalCost,
      averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
      averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      byProvider,
      byModel,
    };
  }

  /**
   * 估算请求成本
   * Requirements: 7.4
   */
  estimateCost(
    modelId: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): number {
    const config = this.configs.get(modelId);
    if (!config) return 0;
    return this.calculateCost(config.model, estimatedInputTokens, estimatedOutputTokens);
  }

  /**
   * 获取模型定价信息
   */
  getPricing(model: string): { input: number; output: number } | undefined {
    return MODEL_PRICING[model];
  }

  /**
   * 获取所有支持的模型定价
   */
  getAllPricing(): Record<string, { input: number; output: number }> {
    return { ...MODEL_PRICING };
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ModelRouter;
