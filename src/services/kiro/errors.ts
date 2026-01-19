/**
 * Kiro API 集成 - 错误定义
 */

/**
 * Kiro API 错误代码
 */
export type KiroErrorCode =
  | 'TOKEN_NOT_FOUND'      // Token 文件不存在
  | 'TOKEN_INVALID'        // Token 格式无效
  | 'TOKEN_EXPIRED'        // Token 已过期
  | 'NO_TOKEN'             // 没有 Token
  | 'UNAUTHORIZED'         // 401 未授权
  | 'FORBIDDEN'            // 403 禁止访问
  | 'RATE_LIMITED'         // 429 速率限制
  | 'INVALID_MODEL'        // 无效的模型 ID
  | 'NETWORK_ERROR'        // 网络错误
  | 'PARSE_ERROR'          // 响应解析错误
  | 'UNKNOWN_ERROR';       // 未知错误

/**
 * Kiro API 错误类
 */
export class KiroApiError extends Error {
  readonly code: KiroErrorCode;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(code: KiroErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'KiroApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = this.isRetryable(code);
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(code: KiroErrorCode): boolean {
    return ['RATE_LIMITED', 'NETWORK_ERROR'].includes(code);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'TOKEN_NOT_FOUND':
        return 'Token 文件不存在，请先登录 Kiro IDE';
      case 'TOKEN_INVALID':
        return 'Token 格式无效，请重新登录 Kiro IDE';
      case 'TOKEN_EXPIRED':
        return 'Token 已过期，请重新登录 Kiro IDE';
      case 'NO_TOKEN':
        return '没有可用的 Token';
      case 'UNAUTHORIZED':
        return 'Token 已失效，请重新登录 Kiro IDE';
      case 'FORBIDDEN':
        return '账户可能受限，请检查 Kiro 订阅状态';
      case 'RATE_LIMITED':
        return '请求过于频繁，正在重试...';
      case 'INVALID_MODEL':
        return '不支持的模型，请选择其他模型';
      case 'NETWORK_ERROR':
        return '网络连接失败，请检查网络';
      case 'PARSE_ERROR':
        return '响应解析失败';
      default:
        return this.message || '未知错误';
    }
  }

  /**
   * 从 HTTP 状态码创建错误
   */
  static fromHttpStatus(statusCode: number, responseText?: string): KiroApiError {
    switch (statusCode) {
      case 401:
        return new KiroApiError('UNAUTHORIZED', responseText || 'Unauthorized', statusCode);
      case 403:
        return new KiroApiError('FORBIDDEN', responseText || 'Forbidden', statusCode);
      case 429:
        return new KiroApiError('RATE_LIMITED', responseText || 'Rate limited', statusCode);
      case 400:
        if (responseText?.includes('INVALID_MODEL')) {
          return new KiroApiError('INVALID_MODEL', responseText, statusCode);
        }
        return new KiroApiError('UNKNOWN_ERROR', responseText || 'Bad request', statusCode);
      default:
        return new KiroApiError('UNKNOWN_ERROR', responseText || `HTTP ${statusCode}`, statusCode);
    }
  }
}

/**
 * 判断是否为 KiroApiError
 */
export function isKiroApiError(error: unknown): error is KiroApiError {
  return error instanceof KiroApiError;
}

/**
 * 遮蔽 Token（用于日志）
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '(no token)';
  if (token.length <= 10) return '***';
  return token.substring(0, 10) + '...[MASKED]';
}
