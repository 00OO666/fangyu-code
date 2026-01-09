/**
 * 用户友好错误消息系统
 * 将技术错误转换为用户可理解的消息
 *
 * _Requirements: 2.1_
 * **Property 3: 错误消息用户友好性**
 * **Validates: Requirements 2.1**
 */

// =============================================================================
// 类型定义
// =============================================================================

/** 错误类别 */
export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'client'
  | 'timeout'
  | 'unknown';

/** 用户友好错误 */
export interface UserFriendlyError {
  /** 错误类别 */
  category: ErrorCategory;
  /** 用户可理解的标题 */
  title: string;
  /** 用户可理解的描述 */
  description: string;
  /** 建议的解决方案 */
  suggestions: string[];
  /** 是否可重试 */
  retryable: boolean;
  /** 原始错误（用于日志） */
  originalError?: Error;
  /** 错误代码（用于支持） */
  errorCode?: string;
}

/** 错误模式匹配规则 */
interface ErrorPattern {
  /** 匹配模式（正则或字符串） */
  pattern: RegExp | string;
  /** 错误类别 */
  category: ErrorCategory;
  /** 用户友好标题 */
  title: string;
  /** 用户友好描述 */
  description: string;
  /** 建议的解决方案 */
  suggestions: string[];
  /** 是否可重试 */
  retryable: boolean;
}

// =============================================================================
// 错误模式定义
// =============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // 网络错误
  {
    pattern: /ECONNRESET|ECONNREFUSED|ENETUNREACH|ENOTFOUND/i,
    category: 'network',
    title: '网络连接失败',
    description: '无法连接到服务器，请检查您的网络连接。',
    suggestions: [
      '检查您的网络连接是否正常',
      '尝试刷新页面或重新连接',
      '如果使用 VPN，请尝试切换节点',
    ],
    retryable: true,
  },
  {
    pattern: /network|fetch failed|failed to fetch/i,
    category: 'network',
    title: '网络请求失败',
    description: '网络请求未能完成，可能是网络不稳定。',
    suggestions: ['检查网络连接', '稍后重试', '如果问题持续，请联系支持'],
    retryable: true,
  },

  // 超时错误
  {
    pattern: /timeout|ETIMEDOUT|timed out/i,
    category: 'timeout',
    title: '请求超时',
    description: '服务器响应时间过长，请稍后重试。',
    suggestions: ['稍等片刻后重试', '检查网络连接速度', '如果问题持续，服务器可能繁忙'],
    retryable: true,
  },

  // 认证错误
  {
    pattern: /401|unauthorized|invalid.*api.*key|authentication/i,
    category: 'authentication',
    title: 'API 密钥无效',
    description: '您的 API 密钥无效或已过期。',
    suggestions: [
      '检查 API 密钥是否正确',
      '确认 API 密钥未过期',
      '前往设置页面重新配置 API 密钥',
    ],
    retryable: false,
  },
  {
    pattern: /403|forbidden|access denied/i,
    category: 'authorization',
    title: '访问被拒绝',
    description: '您没有权限执行此操作。',
    suggestions: ['检查您的账户权限', '确认 API 密钥有足够的权限', '联系管理员获取访问权限'],
    retryable: false,
  },

  // 速率限制
  {
    pattern: /429|rate.*limit|too many requests|quota/i,
    category: 'rate_limit',
    title: '请求过于频繁',
    description: '您的请求频率超过了限制，请稍后再试。',
    suggestions: ['等待几分钟后重试', '减少请求频率', '考虑升级您的 API 计划'],
    retryable: true,
  },

  // 服务器错误
  {
    pattern: /500|internal.*server.*error/i,
    category: 'server',
    title: '服务器内部错误',
    description: '服务器遇到了问题，我们正在处理。',
    suggestions: ['稍后重试', '如果问题持续，请联系支持'],
    retryable: true,
  },
  {
    pattern: /502|bad.*gateway/i,
    category: 'server',
    title: '网关错误',
    description: '服务器网关出现问题。',
    suggestions: ['稍后重试', '服务可能正在维护中'],
    retryable: true,
  },
  {
    pattern: /503|service.*unavailable/i,
    category: 'server',
    title: '服务暂时不可用',
    description: '服务器暂时无法处理请求，可能正在维护。',
    suggestions: ['稍后重试', '查看服务状态页面'],
    retryable: true,
  },
  {
    pattern: /504|gateway.*timeout/i,
    category: 'server',
    title: '网关超时',
    description: '服务器响应超时。',
    suggestions: ['稍后重试', '检查网络连接'],
    retryable: true,
  },

  // 客户端错误
  {
    pattern: /400|bad.*request|invalid.*request/i,
    category: 'client',
    title: '请求格式错误',
    description: '发送的请求格式不正确。',
    suggestions: ['检查输入内容是否正确', '刷新页面后重试'],
    retryable: false,
  },
  {
    pattern: /404|not.*found/i,
    category: 'client',
    title: '资源未找到',
    description: '请求的资源不存在。',
    suggestions: ['检查请求的地址是否正确', '资源可能已被删除或移动'],
    retryable: false,
  },
  {
    pattern: /context.*too.*long|token.*limit|max.*tokens/i,
    category: 'validation',
    title: '内容过长',
    description: '发送的内容超过了模型的处理限制。',
    suggestions: ['减少输入内容的长度', '分批发送内容', '清理对话历史后重试'],
    retryable: false,
  },
  {
    pattern: /model.*not.*found|invalid.*model/i,
    category: 'validation',
    title: '模型不可用',
    description: '请求的 AI 模型不存在或不可用。',
    suggestions: ['检查模型名称是否正确', '选择其他可用的模型', '确认您的账户有权访问该模型'],
    retryable: false,
  },
];

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 将错误转换为用户友好的错误对象
 *
 * @param error 原始错误
 * @returns 用户友好的错误对象
 */
export function toUserFriendlyError(error: unknown): UserFriendlyError {
  const errorMessage = getErrorMessage(error);
  const originalError = error instanceof Error ? error : new Error(String(error));

  // 尝试匹配已知的错误模式
  for (const pattern of ERROR_PATTERNS) {
    const regex =
      typeof pattern.pattern === 'string' ? new RegExp(pattern.pattern, 'i') : pattern.pattern;

    if (regex.test(errorMessage)) {
      return {
        category: pattern.category,
        title: pattern.title,
        description: pattern.description,
        suggestions: pattern.suggestions,
        retryable: pattern.retryable,
        originalError,
      };
    }
  }

  // 默认的未知错误
  return {
    category: 'unknown',
    title: '发生了错误',
    description: '操作未能完成，请稍后重试。',
    suggestions: ['刷新页面后重试', '如果问题持续，请联系支持'],
    retryable: true,
    originalError,
  };
}

/**
 * 从错误对象中提取错误消息
 *
 * @param error 错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    // 尝试从常见的错误对象结构中提取消息
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.error === 'object' && obj.error !== null) {
      const innerError = obj.error as Record<string, unknown>;
      if (typeof innerError.message === 'string') return innerError.message;
    }
  }
  return String(error);
}

/**
 * 获取用户友好的错误消息（简化版）
 *
 * @param error 错误对象
 * @returns 用户友好的错误消息
 */
export function getUserFriendlyMessage(error: unknown): string {
  const friendlyError = toUserFriendlyError(error);
  return friendlyError.description;
}

/**
 * 获取错误的建议解决方案
 *
 * @param error 错误对象
 * @returns 建议解决方案数组
 */
export function getErrorSuggestions(error: unknown): string[] {
  const friendlyError = toUserFriendlyError(error);
  return friendlyError.suggestions;
}

/**
 * 判断错误是否可重试
 *
 * @param error 错误对象
 * @returns 是否可重试
 */
export function isErrorRetryable(error: unknown): boolean {
  const friendlyError = toUserFriendlyError(error);
  return friendlyError.retryable;
}

/**
 * 获取错误类别
 *
 * @param error 错误对象
 * @returns 错误类别
 */
export function getErrorCategory(error: unknown): ErrorCategory {
  const friendlyError = toUserFriendlyError(error);
  return friendlyError.category;
}

/**
 * 格式化错误用于显示
 *
 * @param error 错误对象
 * @returns 格式化的错误字符串
 */
export function formatErrorForDisplay(error: unknown): string {
  const friendlyError = toUserFriendlyError(error);
  let result = `${friendlyError.title}\n\n${friendlyError.description}`;

  if (friendlyError.suggestions.length > 0) {
    result += '\n\n建议：\n';
    result += friendlyError.suggestions.map((s) => `• ${s}`).join('\n');
  }

  return result;
}

/**
 * 创建用于日志的错误摘要（不包含技术堆栈）
 *
 * @param error 错误对象
 * @returns 错误摘要对象
 */
export function createErrorSummary(error: unknown): {
  category: ErrorCategory;
  message: string;
  timestamp: string;
} {
  const friendlyError = toUserFriendlyError(error);
  return {
    category: friendlyError.category,
    message: friendlyError.description,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// 错误类
// =============================================================================

/**
 * 用户友好错误类
 * 可以直接抛出并在 UI 中显示
 */
export class FriendlyError extends Error {
  public readonly category: ErrorCategory;
  public readonly title: string;
  public readonly description: string;
  public readonly suggestions: string[];
  public readonly retryable: boolean;

  constructor(friendlyError: UserFriendlyError) {
    super(friendlyError.description);
    this.name = 'FriendlyError';
    this.category = friendlyError.category;
    this.title = friendlyError.title;
    this.description = friendlyError.description;
    this.suggestions = friendlyError.suggestions;
    this.retryable = friendlyError.retryable;
  }

  /**
   * 从任意错误创建 FriendlyError
   */
  static from(error: unknown): FriendlyError {
    if (error instanceof FriendlyError) {
      return error;
    }
    return new FriendlyError(toUserFriendlyError(error));
  }
}
