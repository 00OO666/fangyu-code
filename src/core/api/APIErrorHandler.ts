/**
 * APIErrorHandler - API 错误处理器
 *
 * 实现结构化错误处理和智能重试策略
 *
 * Requirements: 1.5, 1.6
 */

import { APIError, APIErrorCode } from "./RealAPIClient";

// =============================================================================
// 类型定义
// =============================================================================

/** 重试策略配置 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

/** 重试上下文 */
export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError: APIError | null;
  startTime: number;
  delays: number[];
}

/** 重试决策 */
export interface RetryDecision {
  shouldRetry: boolean;
  delay: number;
  reason: string;
}

/** 错误分类 */
export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "validation"
  | "rate_limit"
  | "server"
  | "network"
  | "timeout"
  | "unknown";

/** 错误处理结果 */
export interface ErrorHandlingResult {
  error: APIError;
  category: ErrorCategory;
  userMessage: string;
  technicalMessage: string;
  suggestions: string[];
  retryable: boolean;
}

// =============================================================================
// 默认配置
// =============================================================================

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/** 错误码到分类的映射 */
const ERROR_CATEGORY_MAP: Record<APIErrorCode, ErrorCategory> = {
  [APIErrorCode.INVALID_API_KEY]: "authentication",
  [APIErrorCode.EXPIRED_API_KEY]: "authentication",
  [APIErrorCode.INVALID_REQUEST]: "validation",
  [APIErrorCode.MODEL_NOT_FOUND]: "validation",
  [APIErrorCode.CONTEXT_TOO_LONG]: "validation",
  [APIErrorCode.RATE_LIMITED]: "rate_limit",
  [APIErrorCode.SERVER_ERROR]: "server",
  [APIErrorCode.SERVICE_UNAVAILABLE]: "server",
  [APIErrorCode.NETWORK_ERROR]: "network",
  [APIErrorCode.TIMEOUT]: "timeout",
  [APIErrorCode.UNKNOWN]: "unknown",
};

/** 用户友好的错误消息 */
const USER_MESSAGES: Record<APIErrorCode, string> = {
  [APIErrorCode.INVALID_API_KEY]: "API 密钥无效，请检查配置",
  [APIErrorCode.EXPIRED_API_KEY]: "API 密钥已过期，请更新密钥",
  [APIErrorCode.INVALID_REQUEST]: "请求格式错误",
  [APIErrorCode.MODEL_NOT_FOUND]: "指定的模型不存在或不可用",
  [APIErrorCode.CONTEXT_TOO_LONG]: "输入内容过长，请减少消息长度",
  [APIErrorCode.RATE_LIMITED]: "请求过于频繁，请稍后重试",
  [APIErrorCode.SERVER_ERROR]: "服务器内部错误，请稍后重试",
  [APIErrorCode.SERVICE_UNAVAILABLE]: "服务暂时不可用，请稍后重试",
  [APIErrorCode.NETWORK_ERROR]: "网络连接失败，请检查网络",
  [APIErrorCode.TIMEOUT]: "请求超时，请稍后重试",
  [APIErrorCode.UNKNOWN]: "发生未知错误",
};

/** 错误建议 */
const ERROR_SUGGESTIONS: Record<APIErrorCode, string[]> = {
  [APIErrorCode.INVALID_API_KEY]: [
    "检查 API 密钥是否正确复制",
    "确认密钥格式为 sk-xxx",
    "尝试重新生成 API 密钥",
  ],
  [APIErrorCode.EXPIRED_API_KEY]: ["登录 API 提供商控制台", "生成新的 API 密钥", "更新应用配置"],
  [APIErrorCode.INVALID_REQUEST]: [
    "检查请求参数格式",
    "确认消息内容不为空",
    "验证模型名称是否正确",
  ],
  [APIErrorCode.MODEL_NOT_FOUND]: [
    "检查模型名称拼写",
    "确认模型是否在当前提供商可用",
    "尝试使用其他模型",
  ],
  [APIErrorCode.CONTEXT_TOO_LONG]: [
    "减少输入消息的长度",
    "删除不必要的历史消息",
    "使用支持更长上下文的模型",
  ],
  [APIErrorCode.RATE_LIMITED]: ["等待一段时间后重试", "减少请求频率", "考虑升级 API 套餐"],
  [APIErrorCode.SERVER_ERROR]: [
    "等待几分钟后重试",
    "检查 API 提供商状态页面",
    "尝试切换到备用提供商",
  ],
  [APIErrorCode.SERVICE_UNAVAILABLE]: ["等待服务恢复", "检查 API 提供商状态", "使用备用 API 端点"],
  [APIErrorCode.NETWORK_ERROR]: ["检查网络连接", "确认防火墙设置", "尝试使用代理"],
  [APIErrorCode.TIMEOUT]: ["检查网络稳定性", "增加超时时间设置", "减少请求内容大小"],
  [APIErrorCode.UNKNOWN]: ["查看详细错误日志", "联系技术支持", "尝试重新操作"],
};

// =============================================================================
// APIErrorHandler 类
// =============================================================================

export class APIErrorHandler {
  private config: RetryConfig;
  private context: RetryContext;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.context = this.createContext();
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 处理错误并返回结构化结果
   * Requirements: 1.5
   */
  handleError(error: APIError): ErrorHandlingResult {
    const category = this.categorizeError(error);

    return {
      error,
      category,
      userMessage: USER_MESSAGES[error.code] ?? USER_MESSAGES[APIErrorCode.UNKNOWN],
      technicalMessage: error.message,
      suggestions: ERROR_SUGGESTIONS[error.code] ?? ERROR_SUGGESTIONS[APIErrorCode.UNKNOWN],
      retryable: error.retryable,
    };
  }

  /**
   * 决定是否应该重试
   * Requirements: 1.6
   */
  shouldRetry(error: APIError): RetryDecision {
    // 更新上下文
    this.context.attempt++;
    this.context.lastError = error;

    // 检查是否超过最大重试次数
    if (this.context.attempt > this.config.maxRetries) {
      return {
        shouldRetry: false,
        delay: 0,
        reason: `已达到最大重试次数 (${this.config.maxRetries})`,
      };
    }

    // 检查错误是否可重试
    if (!error.retryable) {
      return {
        shouldRetry: false,
        delay: 0,
        reason: `错误类型 ${error.code} 不可重试`,
      };
    }

    // 计算延迟
    const delay = this.calculateDelay(error);
    this.context.delays.push(delay);

    return {
      shouldRetry: true,
      delay,
      reason: `第 ${this.context.attempt}/${this.config.maxRetries} 次重试`,
    };
  }

  /**
   * 执行带重试的操作
   * Requirements: 1.6
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (context: RetryContext, decision: RetryDecision) => void
  ): Promise<T> {
    this.reset();

    while (true) {
      try {
        return await operation();
      } catch (error) {
        const apiError = this.normalizeError(error);
        const decision = this.shouldRetry(apiError);

        if (!decision.shouldRetry) {
          throw apiError;
        }

        onRetry?.(this.getContext(), decision);
        await this.delay(decision.delay);
      }
    }
  }

  /**
   * 获取当前重试上下文
   */
  getContext(): RetryContext {
    return { ...this.context };
  }

  /**
   * 重置重试上下文
   */
  reset(): void {
    this.context = this.createContext();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * 分类错误
   */
  categorizeError(error: APIError): ErrorCategory {
    return ERROR_CATEGORY_MAP[error.code] ?? "unknown";
  }

  /**
   * 将任意错误转换为 APIError
   */
  normalizeError(error: unknown): APIError {
    if (this.isAPIError(error)) {
      return error;
    }

    if (error instanceof Error) {
      // 检查是否为网络错误
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        return {
          code: APIErrorCode.NETWORK_ERROR,
          message: error.message,
          retryable: true,
        };
      }

      // 检查是否为超时
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        return {
          code: APIErrorCode.TIMEOUT,
          message: error.message,
          retryable: true,
        };
      }

      return {
        code: APIErrorCode.UNKNOWN,
        message: error.message,
        retryable: false,
      };
    }

    return {
      code: APIErrorCode.UNKNOWN,
      message: String(error),
      retryable: false,
    };
  }

  /**
   * 从 HTTP 状态码创建错误
   */
  createErrorFromStatus(
    statusCode: number,
    message?: string,
    details?: Record<string, unknown>
  ): APIError {
    let code: APIErrorCode;
    let retryable = false;

    switch (statusCode) {
      case 400:
        code = APIErrorCode.INVALID_REQUEST;
        break;
      case 401:
        code = APIErrorCode.INVALID_API_KEY;
        break;
      case 403:
        code = APIErrorCode.EXPIRED_API_KEY;
        break;
      case 404:
        code = APIErrorCode.MODEL_NOT_FOUND;
        break;
      case 413:
        code = APIErrorCode.CONTEXT_TOO_LONG;
        break;
      case 429:
        code = APIErrorCode.RATE_LIMITED;
        retryable = true;
        break;
      case 500:
        code = APIErrorCode.SERVER_ERROR;
        retryable = true;
        break;
      case 502:
      case 503:
      case 504:
        code = APIErrorCode.SERVICE_UNAVAILABLE;
        retryable = true;
        break;
      default:
        code = APIErrorCode.UNKNOWN;
    }

    return {
      code,
      message: message ?? `HTTP ${statusCode}`,
      details,
      retryable,
      statusCode,
    };
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 创建新的重试上下文
   */
  private createContext(): RetryContext {
    return {
      attempt: 0,
      totalAttempts: this.config.maxRetries,
      lastError: null,
      startTime: Date.now(),
      delays: [],
    };
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  private calculateDelay(error: APIError): number {
    // 如果错误指定了 retryAfter，优先使用
    if (error.retryAfter) {
      return Math.min(error.retryAfter, this.config.maxDelay);
    }

    // 指数退避
    const exponentialDelay =
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, this.context.attempt - 1);

    // 添加抖动
    const jitter = exponentialDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    const delay = exponentialDelay + jitter;

    // 限制在最大延迟内
    return Math.min(Math.max(delay, this.config.baseDelay), this.config.maxDelay);
  }

  /**
   * 检查是否为 APIError
   */
  private isAPIError(error: unknown): error is APIError {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      "retryable" in error
    );
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建错误处理器
 */
export function createErrorHandler(config?: Partial<RetryConfig>): APIErrorHandler {
  return new APIErrorHandler(config);
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: APIError): boolean {
  return error.retryable;
}

/**
 * 获取错误的用户友好消息
 */
export function getUserMessage(error: APIError): string {
  return USER_MESSAGES[error.code] ?? USER_MESSAGES[APIErrorCode.UNKNOWN];
}

/**
 * 获取错误的建议
 */
export function getErrorSuggestions(error: APIError): string[] {
  return ERROR_SUGGESTIONS[error.code] ?? ERROR_SUGGESTIONS[APIErrorCode.UNKNOWN];
}

export default APIErrorHandler;
