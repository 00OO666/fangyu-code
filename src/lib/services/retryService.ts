/**
 * RetryService - 自动重试服务
 * 支持指数退避配置的网络请求重试
 *
 * _Requirements: 2.2_
 * **Property 4: 指数退避重试**
 * **Validates: Requirements 2.2**
 */

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟（毫秒） */
  baseDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避乘数 */
  backoffMultiplier: number;
  /** 是否添加抖动（防止雷群效应） */
  jitter?: boolean;
  /** 可重试的错误类型 */
  retryableErrors?: string[];
  /** 重试前的回调 */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * 重试结果
 */
export interface RetryResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 成功时的数据 */
  data?: T;
  /** 失败时的错误 */
  error?: Error;
  /** 总尝试次数 */
  attempts: number;
  /** 总耗时（毫秒） */
  totalTime: number;
  /** 每次尝试的延迟记录 */
  delays: number[];
}

/**
 * 默认配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR',
    'TIMEOUT',
    'rate_limit',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * 计算第 N 次重试的延迟
 * 公式: min(baseDelay * backoffMultiplier^(N-1), maxDelay)
 *
 * @param attempt 当前尝试次数（从 1 开始）
 * @param config 重试配置
 * @returns 延迟时间（毫秒）
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const { baseDelay, maxDelay, backoffMultiplier, jitter } = config;

  // 指数退避计算
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);

  // 限制最大延迟
  let delay = Math.min(exponentialDelay, maxDelay);

  // 添加抖动（±25%）
  if (jitter) {
    const jitterRange = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitterRange;
  }

  return Math.round(delay);
}

/**
 * 判断错误是否可重试
 *
 * @param error 错误对象
 * @param config 重试配置
 * @returns 是否可重试
 */
export function isRetryableError(error: Error, config: RetryConfig): boolean {
  const retryableErrors = config.retryableErrors || DEFAULT_RETRY_CONFIG.retryableErrors!;

  const errorString = `${error.name} ${error.message}`.toLowerCase();

  return retryableErrors.some((pattern) => errorString.includes(pattern.toLowerCase()));
}

/**
 * 延迟执行
 *
 * @param ms 延迟毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行
 *
 * @param fn 要执行的异步函数
 * @param config 重试配置（可选，使用默认配置）
 * @returns 重试结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const mergedConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  const delays: number[] = [];
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= mergedConfig.maxRetries + 1; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt,
        totalTime: Date.now() - startTime,
        delays,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果是最后一次尝试或错误不可重试，直接返回失败
      if (attempt > mergedConfig.maxRetries || !isRetryableError(lastError, mergedConfig)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          delays,
        };
      }

      // 计算延迟
      const delay = calculateDelay(attempt, mergedConfig);
      delays.push(delay);

      // 调用重试回调
      if (mergedConfig.onRetry) {
        mergedConfig.onRetry(attempt, lastError, delay);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 不应该到达这里，但为了类型安全
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: mergedConfig.maxRetries + 1,
    totalTime: Date.now() - startTime,
    delays,
  };
}

/**
 * 创建带默认配置的重试函数
 *
 * @param defaultConfig 默认配置
 * @returns 配置好的 withRetry 函数
 */
export function createRetryFunction(defaultConfig: Partial<RetryConfig>) {
  return <T>(fn: () => Promise<T>, overrideConfig?: Partial<RetryConfig>) =>
    withRetry(fn, { ...defaultConfig, ...overrideConfig });
}

/**
 * 网络请求专用重试配置
 */
export const NETWORK_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * API 请求专用重试配置
 */
export const API_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: ['rate_limit', '429', '500', '502', '503', '504', 'TIMEOUT'],
};

/**
 * 带重试的网络请求
 */
export const withNetworkRetry = createRetryFunction(NETWORK_RETRY_CONFIG);

/**
 * 带重试的 API 请求
 */
export const withAPIRetry = createRetryFunction(API_RETRY_CONFIG);
