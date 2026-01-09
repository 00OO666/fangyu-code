/**
 * 用户友好错误消息属性测试
 *
 * **Property 3: 错误消息用户友好性**
 * **Validates: Requirements 2.1**
 *
 * 对于任何 API 调用失败，系统返回的错误消息应该包含：
 * (1) 用户可理解的描述
 * (2) 建议的解决方案
 * (3) 不包含技术堆栈信息
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toUserFriendlyError,
  getUserFriendlyMessage,
  getErrorSuggestions,
  isErrorRetryable,
  getErrorCategory,
  formatErrorForDisplay,
  createErrorSummary,
  FriendlyError,
  type ErrorCategory,
} from './userFriendlyErrors';

// 技术术语列表（不应出现在用户消息中）
const TECHNICAL_TERMS = [
  'stack trace',
  'stacktrace',
  'at line',
  'at Object.',
  'at Function.',
  'at Module.',
  'node_modules',
  'TypeError:',
  'ReferenceError:',
  'SyntaxError:',
  'undefined is not',
  'null is not',
  'Cannot read property',
  'Cannot read properties',
  '__dirname',
  '__filename',
  'process.env',
  'webpack',
  'vite',
  'rollup',
];

// 已知的错误模式
const KNOWN_ERROR_PATTERNS = [
  // 网络错误
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'network error',
  'fetch failed',
  // 认证错误
  '401 Unauthorized',
  'invalid api key',
  'authentication failed',
  // 速率限制
  '429 Too Many Requests',
  'rate limit exceeded',
  // 服务器错误
  '500 Internal Server Error',
  '502 Bad Gateway',
  '503 Service Unavailable',
  '504 Gateway Timeout',
  // 客户端错误
  '400 Bad Request',
  '404 Not Found',
  'context too long',
  'model not found',
];

describe('UserFriendlyErrors Property Tests', () => {
  describe('Property 3: 错误消息用户友好性', () => {
    // Feature: fangyu-code-audit, Property 3: 错误消息用户友好性
    it('所有错误应返回包含必要字段的结构化结果', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const error = new Error(errorMessage);
          const result = toUserFriendlyError(error);

          // 验证结构完整性
          expect(result).toHaveProperty('category');
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('description');
          expect(result).toHaveProperty('suggestions');
          expect(result).toHaveProperty('retryable');

          // 验证类型
          expect(typeof result.category).toBe('string');
          expect(typeof result.title).toBe('string');
          expect(typeof result.description).toBe('string');
          expect(Array.isArray(result.suggestions)).toBe(true);
          expect(typeof result.retryable).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('用户消息不应包含技术堆栈信息', () => {
      fc.assert(
        fc.property(fc.constantFrom(...KNOWN_ERROR_PATTERNS), (errorPattern) => {
          const error = new Error(errorPattern);
          const result = toUserFriendlyError(error);

          // 检查标题和描述不包含技术术语
          const combinedText = `${result.title} ${result.description}`.toLowerCase();

          for (const term of TECHNICAL_TERMS) {
            expect(combinedText).not.toContain(term.toLowerCase());
          }
        }),
        { numRuns: 50 }
      );
    });

    it('所有错误应提供至少一个建议解决方案', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const error = new Error(errorMessage);
          const suggestions = getErrorSuggestions(error);

          expect(suggestions.length).toBeGreaterThan(0);
          suggestions.forEach((suggestion) => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('错误类别应是有效的类别', () => {
      const validCategories: ErrorCategory[] = [
        'network',
        'authentication',
        'authorization',
        'validation',
        'rate_limit',
        'server',
        'client',
        'timeout',
        'unknown',
      ];

      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const error = new Error(errorMessage);
          const category = getErrorCategory(error);

          expect(validCategories).toContain(category);
        }),
        { numRuns: 100 }
      );
    });

    it('已知错误模式应映射到正确的类别', () => {
      const categoryMappings: Array<{ pattern: string; expectedCategory: ErrorCategory }> = [
        { pattern: 'ECONNRESET', expectedCategory: 'network' },
        { pattern: 'ETIMEDOUT', expectedCategory: 'timeout' },
        { pattern: '401 Unauthorized', expectedCategory: 'authentication' },
        { pattern: '403 Forbidden', expectedCategory: 'authorization' },
        { pattern: '429 Rate Limit', expectedCategory: 'rate_limit' },
        { pattern: '500 Internal Server Error', expectedCategory: 'server' },
        { pattern: '400 Bad Request', expectedCategory: 'client' },
      ];

      fc.assert(
        fc.property(fc.constantFrom(...categoryMappings), ({ pattern, expectedCategory }) => {
          const error = new Error(pattern);
          const category = getErrorCategory(error);

          expect(category).toBe(expectedCategory);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('可重试性判断', () => {
    it('网络和服务器错误应标记为可重试', () => {
      const retryablePatterns = [
        'ECONNRESET',
        'ETIMEDOUT',
        'network error',
        '500 Internal Server Error',
        '502 Bad Gateway',
        '503 Service Unavailable',
        '429 Rate Limit',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...retryablePatterns), (pattern) => {
          const error = new Error(pattern);
          expect(isErrorRetryable(error)).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('认证和验证错误应标记为不可重试', () => {
      const nonRetryablePatterns = [
        '401 Unauthorized',
        'invalid api key',
        '403 Forbidden',
        '400 Bad Request',
        '404 Not Found',
        'context too long',
      ];

      fc.assert(
        fc.property(fc.constantFrom(...nonRetryablePatterns), (pattern) => {
          const error = new Error(pattern);
          expect(isErrorRetryable(error)).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('格式化输出', () => {
    it('formatErrorForDisplay 应返回可读的格式化字符串', () => {
      fc.assert(
        fc.property(fc.constantFrom(...KNOWN_ERROR_PATTERNS), (pattern) => {
          const error = new Error(pattern);
          const formatted = formatErrorForDisplay(error);

          // 应包含标题和描述
          expect(formatted.length).toBeGreaterThan(0);
          // 应包含建议部分
          expect(formatted).toContain('建议');
        }),
        { numRuns: 50 }
      );
    });

    it('createErrorSummary 应返回不包含堆栈的摘要', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const error = new Error(errorMessage);
          error.stack = 'at Object.<anonymous> (/path/to/file.js:10:5)';

          const summary = createErrorSummary(error);

          expect(summary).toHaveProperty('category');
          expect(summary).toHaveProperty('message');
          expect(summary).toHaveProperty('timestamp');

          // 摘要不应包含堆栈信息
          expect(summary.message).not.toContain('at Object');
          expect(summary.message).not.toContain('/path/to/');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('FriendlyError 类', () => {
    it('FriendlyError.from 应正确转换任意错误', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
          const originalError = new Error(errorMessage);
          const friendlyError = FriendlyError.from(originalError);

          expect(friendlyError).toBeInstanceOf(FriendlyError);
          expect(friendlyError).toBeInstanceOf(Error);
          expect(friendlyError.category).toBeDefined();
          expect(friendlyError.title).toBeDefined();
          expect(friendlyError.description).toBeDefined();
          expect(friendlyError.suggestions).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('FriendlyError.from 对已有的 FriendlyError 应返回相同实例', () => {
      const original = FriendlyError.from(new Error('test'));
      const converted = FriendlyError.from(original);

      expect(converted).toBe(original);
    });
  });

  describe('边界情况', () => {
    it('应正确处理空字符串错误', () => {
      const error = new Error('');
      const result = toUserFriendlyError(error);

      expect(result.category).toBe('unknown');
      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('应正确处理非 Error 对象', () => {
      const testCases = [
        'string error',
        { message: 'object error' },
        { error: 'nested error' },
        { error: { message: 'deeply nested' } },
        null,
        undefined,
        123,
      ];

      testCases.forEach((testCase) => {
        const result = toUserFriendlyError(testCase);

        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('suggestions');
      });
    });

    it('getUserFriendlyMessage 应返回非空字符串', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.record({ message: fc.string() }),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (error) => {
            const message = getUserFriendlyMessage(error);
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
