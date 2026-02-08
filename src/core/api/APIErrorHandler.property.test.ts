/**
 * APIErrorHandler 属性测试
 *
 * Property 4: 错误处理结构化
 *
 * Validates: Requirements 1.5
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  APIErrorHandler,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  createErrorHandler,
  isRetryableError,
  getUserMessage,
  getErrorSuggestions,
} from "./APIErrorHandler";
import { APIError, APIErrorCode } from "./RealAPIClient";

// =============================================================================
// 测试生成器
// =============================================================================

/** 生成 API 错误码 */
const errorCodeArb = fc.constantFrom(...Object.values(APIErrorCode));

/** 生成错误消息 */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

/** 生成 HTTP 状态码 */
const httpStatusArb = fc.constantFrom(400, 401, 403, 404, 413, 429, 500, 502, 503, 504);

/** 生成 API 错误 */
const apiErrorArb: fc.Arbitrary<APIError> = fc.record({
  code: errorCodeArb,
  message: errorMessageArb,
  retryable: fc.boolean(),
  retryAfter: fc.option(fc.integer({ min: 100, max: 60000 }), { nil: undefined }),
  statusCode: fc.option(httpStatusArb, { nil: undefined }),
  details: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
});

/** 生成可重试的 API 错误 */
const retryableErrorArb: fc.Arbitrary<APIError> = fc.record({
  code: fc.constantFrom(
    APIErrorCode.NETWORK_ERROR,
    APIErrorCode.TIMEOUT,
    APIErrorCode.RATE_LIMITED,
    APIErrorCode.SERVER_ERROR,
    APIErrorCode.SERVICE_UNAVAILABLE
  ),
  message: errorMessageArb,
  retryable: fc.constant(true),
  retryAfter: fc.option(fc.integer({ min: 100, max: 60000 }), { nil: undefined }),
});

/** 生成不可重试的 API 错误 */
const nonRetryableErrorArb: fc.Arbitrary<APIError> = fc.record({
  code: fc.constantFrom(
    APIErrorCode.INVALID_API_KEY,
    APIErrorCode.EXPIRED_API_KEY,
    APIErrorCode.INVALID_REQUEST,
    APIErrorCode.MODEL_NOT_FOUND,
    APIErrorCode.CONTEXT_TOO_LONG
  ),
  message: errorMessageArb,
  retryable: fc.constant(false),
});

/** 生成重试配置 */
const retryConfigArb: fc.Arbitrary<Partial<RetryConfig>> = fc.record({
  maxRetries: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  baseDelay: fc.option(fc.integer({ min: 100, max: 5000 }), { nil: undefined }),
  maxDelay: fc.option(fc.integer({ min: 5000, max: 60000 }), { nil: undefined }),
  backoffMultiplier: fc.option(
    fc.float({ min: Math.fround(1.1), max: Math.fround(3), noNaN: true }),
    { nil: undefined }
  ),
  jitterFactor: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(0.5), noNaN: true }), {
    nil: undefined,
  }),
});

// =============================================================================
// Property 4: 错误处理结构化
// Validates: Requirements 1.5
// =============================================================================

describe("APIErrorHandler Property Tests", () => {
  describe("Property 4: 错误处理结构化", () => {
    let handler: APIErrorHandler;

    beforeEach(() => {
      handler = new APIErrorHandler();
    });

    it("handleError 应返回完整的结构化结果", () => {
      fc.assert(
        fc.property(apiErrorArb, (error) => {
          const result = handler.handleError(error);

          // 结果应包含所有必需字段
          expect(result.error).toBe(error);
          expect(typeof result.category).toBe("string");
          expect(typeof result.userMessage).toBe("string");
          expect(typeof result.technicalMessage).toBe("string");
          expect(Array.isArray(result.suggestions)).toBe(true);
          expect(typeof result.retryable).toBe("boolean");

          // 用户消息不应为空
          expect(result.userMessage.length).toBeGreaterThan(0);

          // 建议应该是字符串数组
          for (const suggestion of result.suggestions) {
            expect(typeof suggestion).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });

    it("错误分类应该是有效的类别", () => {
      fc.assert(
        fc.property(apiErrorArb, (error) => {
          const category = handler.categorizeError(error);

          const validCategories = [
            "authentication",
            "authorization",
            "validation",
            "rate_limit",
            "server",
            "network",
            "timeout",
            "unknown",
          ];

          expect(validCategories).toContain(category);
        }),
        { numRuns: 100 }
      );
    });

    it("normalizeError 应将任意错误转换为 APIError", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().map((s) => new Error(s)),
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (error) => {
            const normalized = handler.normalizeError(error);

            // 结果应该是有效的 APIError
            expect(typeof normalized.code).toBe("string");
            expect(typeof normalized.message).toBe("string");
            expect(typeof normalized.retryable).toBe("boolean");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("createErrorFromStatus 应根据状态码创建正确的错误", () => {
      fc.assert(
        fc.property(httpStatusArb, errorMessageArb, (status, message) => {
          const error = handler.createErrorFromStatus(status, message);

          // 错误应该有正确的状态码
          expect(error.statusCode).toBe(status);
          expect(error.message).toBe(message);

          // 4xx 错误通常不可重试（除了 429）
          if (status >= 400 && status < 500 && status !== 429) {
            expect(error.retryable).toBe(false);
          }

          // 5xx 错误和 429 应该可重试
          if (status >= 500 || status === 429) {
            expect(error.retryable).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 重试策略属性测试
  // Validates: Requirements 1.6
  // ===========================================================================

  describe("重试策略属性测试", () => {
    it("可重试错误应该允许重试（在限制内）", () => {
      fc.assert(
        fc.property(retryableErrorArb, (error) => {
          const handler = new APIErrorHandler({ maxRetries: 3 });

          // 第一次重试应该被允许
          const decision = handler.shouldRetry(error);
          expect(decision.shouldRetry).toBe(true);
          expect(decision.delay).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("不可重试错误应该立即拒绝重试", () => {
      fc.assert(
        fc.property(nonRetryableErrorArb, (error) => {
          const handler = new APIErrorHandler();

          const decision = handler.shouldRetry(error);
          expect(decision.shouldRetry).toBe(false);
          expect(decision.delay).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("超过最大重试次数后应拒绝重试", () => {
      fc.assert(
        fc.property(retryableErrorArb, fc.integer({ min: 1, max: 5 }), (error, maxRetries) => {
          const handler = new APIErrorHandler({ maxRetries });

          // 消耗所有重试次数
          for (let i = 0; i < maxRetries; i++) {
            handler.shouldRetry(error);
          }

          // 下一次应该被拒绝
          const decision = handler.shouldRetry(error);
          expect(decision.shouldRetry).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("重试延迟应该在配置范围内", () => {
      fc.assert(
        fc.property(
          // 使用没有 retryAfter 的错误，这样才会使用配置的延迟
          fc.record({
            code: fc.constantFrom(
              APIErrorCode.NETWORK_ERROR,
              APIErrorCode.TIMEOUT,
              APIErrorCode.SERVER_ERROR,
              APIErrorCode.SERVICE_UNAVAILABLE
            ),
            message: errorMessageArb,
            retryable: fc.constant(true),
          }),
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 5000, max: 30000 }),
          (error, baseDelay, maxDelay) => {
            const handler = new APIErrorHandler({
              baseDelay,
              maxDelay,
              maxRetries: 5,
              jitterFactor: 0, // 禁用抖动以便精确测试
            });

            const decision = handler.shouldRetry(error);

            if (decision.shouldRetry) {
              // 延迟应该在合理范围内
              expect(decision.delay).toBeGreaterThanOrEqual(baseDelay);
              expect(decision.delay).toBeLessThanOrEqual(maxDelay);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("reset 应该清除重试上下文", () => {
      fc.assert(
        fc.property(retryableErrorArb, (error) => {
          const handler = new APIErrorHandler({ maxRetries: 3 });

          // 消耗一些重试次数
          handler.shouldRetry(error);
          handler.shouldRetry(error);

          // 重置
          handler.reset();

          // 应该可以重新开始重试
          const context = handler.getContext();
          expect(context.attempt).toBe(0);
          expect(context.lastError).toBe(null);
          expect(context.delays).toEqual([]);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 配置属性测试
  // ===========================================================================

  describe("配置属性测试", () => {
    it("应使用默认配置初始化", () => {
      const handler = new APIErrorHandler();
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
      expect(config.baseDelay).toBe(DEFAULT_RETRY_CONFIG.baseDelay);
      expect(config.maxDelay).toBe(DEFAULT_RETRY_CONFIG.maxDelay);
    });

    it("应正确合并自定义配置", () => {
      fc.assert(
        fc.property(retryConfigArb, (customConfig) => {
          const handler = new APIErrorHandler(customConfig);
          const config = handler.getConfig();

          // 自定义值应该覆盖默认值
          if (customConfig.maxRetries !== undefined) {
            expect(config.maxRetries).toBe(customConfig.maxRetries);
          }
          if (customConfig.baseDelay !== undefined) {
            expect(config.baseDelay).toBe(customConfig.baseDelay);
          }
        }),
        { numRuns: 50 }
      );
    });

    it("updateConfig 应正确更新配置", () => {
      fc.assert(
        fc.property(retryConfigArb, (newConfig) => {
          const handler = new APIErrorHandler();
          handler.updateConfig(newConfig);
          const config = handler.getConfig();

          if (newConfig.maxRetries !== undefined) {
            expect(config.maxRetries).toBe(newConfig.maxRetries);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 工具函数属性测试
  // ===========================================================================

  describe("工具函数属性测试", () => {
    it("createErrorHandler 应创建有效的处理器", () => {
      fc.assert(
        fc.property(retryConfigArb, (config) => {
          const handler = createErrorHandler(config);
          expect(handler).toBeInstanceOf(APIErrorHandler);
        }),
        { numRuns: 50 }
      );
    });

    it("isRetryableError 应正确判断可重试性", () => {
      fc.assert(
        fc.property(apiErrorArb, (error) => {
          const result = isRetryableError(error);
          expect(result).toBe(error.retryable);
        }),
        { numRuns: 100 }
      );
    });

    it("getUserMessage 应返回非空字符串", () => {
      fc.assert(
        fc.property(apiErrorArb, (error) => {
          const message = getUserMessage(error);
          expect(typeof message).toBe("string");
          expect(message.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it("getErrorSuggestions 应返回字符串数组", () => {
      fc.assert(
        fc.property(apiErrorArb, (error) => {
          const suggestions = getErrorSuggestions(error);
          expect(Array.isArray(suggestions)).toBe(true);
          expect(suggestions.length).toBeGreaterThan(0);

          for (const s of suggestions) {
            expect(typeof s).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // ===========================================================================
  // 上下文追踪属性测试
  // ===========================================================================

  describe("上下文追踪属性测试", () => {
    it("重试上下文应正确追踪尝试次数", () => {
      fc.assert(
        fc.property(retryableErrorArb, fc.integer({ min: 1, max: 5 }), (error, attempts) => {
          const handler = new APIErrorHandler({ maxRetries: 10 });

          for (let i = 0; i < attempts; i++) {
            handler.shouldRetry(error);
          }

          const context = handler.getContext();
          expect(context.attempt).toBe(attempts);
        }),
        { numRuns: 50 }
      );
    });

    it("重试上下文应记录所有延迟", () => {
      fc.assert(
        fc.property(retryableErrorArb, fc.integer({ min: 1, max: 3 }), (error, attempts) => {
          const handler = new APIErrorHandler({ maxRetries: 10 });

          for (let i = 0; i < attempts; i++) {
            handler.shouldRetry(error);
          }

          const context = handler.getContext();
          expect(context.delays.length).toBe(attempts);

          for (const delay of context.delays) {
            expect(delay).toBeGreaterThan(0);
          }
        }),
        { numRuns: 50 }
      );
    });

    it("重试上下文应记录最后一个错误", () => {
      fc.assert(
        fc.property(retryableErrorArb, (error) => {
          const handler = new APIErrorHandler();
          handler.shouldRetry(error);

          const context = handler.getContext();
          expect(context.lastError).toEqual(error);
        }),
        { numRuns: 50 }
      );
    });
  });
});
