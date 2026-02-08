/**
 * RetryService 属性测试
 *
 * **Property 4: 指数退避重试**
 * **Validates: Requirements 2.2**
 *
 * 对于任何网络错误触发的重试序列，第 N 次重试的延迟应该等于
 * min(baseDelay * backoffMultiplier^(N-1), maxDelay)
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import {
  calculateDelay,
  isRetryableError,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "./retryService";

describe("RetryService Property Tests", () => {
  describe("Property 4: 指数退避重试", () => {
    // Feature: fangyu-code-audit, Property 4: 指数退避重试
    it("延迟应该遵循指数退避公式（无抖动）", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // attempt
          fc.integer({ min: 100, max: 5000 }), // baseDelay
          fc.integer({ min: 10000, max: 60000 }), // maxDelay
          fc.double({ min: 1.5, max: 3, noNaN: true }), // backoffMultiplier
          (attempt, baseDelay, maxDelay, backoffMultiplier) => {
            const config: RetryConfig = {
              ...DEFAULT_RETRY_CONFIG,
              baseDelay,
              maxDelay,
              backoffMultiplier,
              jitter: false, // 禁用抖动以便精确测试
            };

            const delay = calculateDelay(attempt, config);
            const expectedDelay = Math.min(
              baseDelay * Math.pow(backoffMultiplier, attempt - 1),
              maxDelay
            );

            expect(delay).toBe(Math.round(expectedDelay));
          }
        ),
        { numRuns: 100 }
      );
    });

    it("延迟不应超过 maxDelay", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // attempt
          fc.integer({ min: 100, max: 5000 }), // baseDelay
          fc.integer({ min: 1000, max: 30000 }), // maxDelay
          fc.double({ min: 1.5, max: 5, noNaN: true }), // backoffMultiplier
          (attempt, baseDelay, maxDelay, backoffMultiplier) => {
            const config: RetryConfig = {
              ...DEFAULT_RETRY_CONFIG,
              baseDelay,
              maxDelay,
              backoffMultiplier,
              jitter: false,
            };

            const delay = calculateDelay(attempt, config);
            expect(delay).toBeLessThanOrEqual(maxDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("带抖动的延迟应在 ±25% 范围内", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // attempt
          fc.integer({ min: 1000, max: 5000 }), // baseDelay
          fc.integer({ min: 10000, max: 60000 }), // maxDelay
          fc.double({ min: 1.5, max: 3, noNaN: true }), // backoffMultiplier
          (attempt, baseDelay, maxDelay, backoffMultiplier) => {
            const config: RetryConfig = {
              ...DEFAULT_RETRY_CONFIG,
              baseDelay,
              maxDelay,
              backoffMultiplier,
              jitter: true,
            };

            // 运行多次以测试抖动范围
            const delays: number[] = [];
            for (let i = 0; i < 10; i++) {
              delays.push(calculateDelay(attempt, config));
            }

            const baseExpected = Math.min(
              baseDelay * Math.pow(backoffMultiplier, attempt - 1),
              maxDelay
            );
            const minExpected = baseExpected * 0.75;
            const maxExpected = baseExpected * 1.25;

            // 所有延迟应在范围内
            delays.forEach((delay) => {
              expect(delay).toBeGreaterThanOrEqual(Math.round(minExpected));
              expect(delay).toBeLessThanOrEqual(Math.round(maxExpected));
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it("第一次尝试的延迟应等于 baseDelay（无抖动）", () => {
      fc.assert(
        fc.property(fc.integer({ min: 100, max: 10000 }), (baseDelay) => {
          const config: RetryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            baseDelay,
            jitter: false,
          };

          const delay = calculateDelay(1, config);
          expect(delay).toBe(baseDelay);
        }),
        { numRuns: 100 }
      );
    });

    it("延迟应随尝试次数单调递增（直到达到 maxDelay）", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }), // baseDelay
          fc.integer({ min: 10000, max: 60000 }), // maxDelay
          fc.double({ min: 1.5, max: 3, noNaN: true }), // backoffMultiplier
          (baseDelay, maxDelay, backoffMultiplier) => {
            const config: RetryConfig = {
              ...DEFAULT_RETRY_CONFIG,
              baseDelay,
              maxDelay,
              backoffMultiplier,
              jitter: false,
            };

            let prevDelay = 0;
            for (let attempt = 1; attempt <= 10; attempt++) {
              const delay = calculateDelay(attempt, config);
              expect(delay).toBeGreaterThanOrEqual(prevDelay);
              prevDelay = delay;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("可重试错误判断", () => {
    it("应正确识别可重试的错误", () => {
      const retryablePatterns = [
        "ECONNRESET",
        "ETIMEDOUT",
        "rate_limit",
        "429",
        "500",
        "502",
        "503",
        "504",
      ];

      fc.assert(
        fc.property(fc.constantFrom(...retryablePatterns), (pattern) => {
          const error = new Error(`Network error: ${pattern}`);
          expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it("应正确拒绝不可重试的错误", () => {
      const nonRetryablePatterns = [
        "Invalid API key",
        "Authentication failed",
        "Permission denied",
        "Not found",
        "400",
        "401",
        "403",
        "404",
      ];

      fc.assert(
        fc.property(fc.constantFrom(...nonRetryablePatterns), (pattern) => {
          const error = new Error(pattern);
          expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("withRetry 函数", () => {
    it("成功时应返回正确的结果", async () => {
      const result = await withRetry(async () => "success", { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.delays).toHaveLength(0);
    });

    it("失败后重试应记录正确的尝试次数", async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error("ECONNRESET");
        }
        return "success";
      };

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10, // 使用短延迟加速测试
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.delays).toHaveLength(2); // 2 次重试前的延迟
    });

    it("达到最大重试次数后应返回失败", async () => {
      const fn = async () => {
        throw new Error("ETIMEDOUT");
      };

      const result = await withRetry(fn, {
        maxRetries: 2,
        baseDelay: 10,
        jitter: false,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // 1 次初始 + 2 次重试
      expect(result.error?.message).toContain("ETIMEDOUT");
    });

    it("不可重试的错误应立即返回失败", async () => {
      const fn = async () => {
        throw new Error("Invalid API key");
      };

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.delays).toHaveLength(0);
    });

    it("onRetry 回调应被正确调用", async () => {
      const onRetry = vi.fn();
      let callCount = 0;

      const fn = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error("ECONNRESET");
        }
        return "success";
      };

      await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        jitter: false,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), 20);
    });

    it("totalTime 应反映实际耗时", async () => {
      const startTime = Date.now();

      const result = await withRetry(async () => "success", {
        maxRetries: 1,
        baseDelay: 10,
      });

      const elapsed = Date.now() - startTime;
      expect(result.totalTime).toBeLessThanOrEqual(elapsed + 50); // 允许 50ms 误差
    });
  });

  describe("延迟记录准确性", () => {
    it("delays 数组应记录每次重试的延迟", async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 4) {
          throw new Error("ECONNRESET");
        }
        return "success";
      };

      const result = await withRetry(fn, {
        maxRetries: 5,
        baseDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.delays).toHaveLength(3);
      expect(result.delays[0]).toBe(100); // 第 1 次重试
      expect(result.delays[1]).toBe(200); // 第 2 次重试
      expect(result.delays[2]).toBe(400); // 第 3 次重试
    });
  });
});
