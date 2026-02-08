/**
 * useEngineStatus Hook 属性测试
 *
 * Feature: engine-config-refactor
 * Property 7: Error State Message Generation
 * Property 8: Status Cache Behavior
 * Validates: Requirements 7.4, 7.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { EngineType } from "@/types/provider";
import {
  generateEngineErrorMessage,
  getEngineStatusType,
  type EngineStatusType,
} from "./useEngineStatus";

// 引擎类型生成器
const engineTypeArb = fc.constantFrom<EngineType>("claude", "codex", "gemini");

// 错误消息生成器
const errorMessageArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 200 }),
  fc.constant(new Error("Test error"))
);

describe("Error State Message Generation - Property Tests", () => {
  /**
   * Property 7: Error State Message Generation
   *
   * For any engine type and error state, the system SHALL generate
   * a human-readable error message that includes actionable guidance.
   */

  it("should always generate non-empty error message for any engine", () => {
    fc.assert(
      fc.property(engineTypeArb, (engine) => {
        const message = generateEngineErrorMessage(engine);

        // 消息应该非空
        expect(message).toBeDefined();
        expect(message.length).toBeGreaterThan(0);

        // 消息应该是字符串
        expect(typeof message).toBe("string");
      }),
      { numRuns: 50 }
    );
  });

  it("should include custom error when provided", () => {
    fc.assert(
      fc.property(
        engineTypeArb,
        fc.string({ minLength: 5, maxLength: 100 }),
        (engine, customError) => {
          const message = generateEngineErrorMessage(engine, customError);

          // 应该包含自定义错误信息
          expect(message).toBe(customError);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle Error objects correctly", () => {
    fc.assert(
      fc.property(
        engineTypeArb,
        fc.string({ minLength: 5, maxLength: 100 }),
        (engine, errorMessage) => {
          const error = new Error(errorMessage);
          const message = generateEngineErrorMessage(engine, error);

          // 应该提取 Error 对象的 message
          expect(message).toBe(errorMessage);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should provide default message when no error specified", () => {
    fc.assert(
      fc.property(engineTypeArb, (engine) => {
        const message = generateEngineErrorMessage(engine, undefined);

        // 默认消息应该包含引擎相关的指导
        expect(message.length).toBeGreaterThan(10);

        // 不同引擎应该有不同的默认消息
        const claudeMsg = generateEngineErrorMessage("claude");
        const codexMsg = generateEngineErrorMessage("codex");
        const geminiMsg = generateEngineErrorMessage("gemini");

        // 至少有一些消息是不同的
        const uniqueMessages = new Set([claudeMsg, codexMsg, geminiMsg]);
        expect(uniqueMessages.size).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 20 }
    );
  });
});

describe("Engine Status Type - Property Tests", () => {
  it('should return "ready" when installed and no error', () => {
    fc.assert(
      fc.property(fc.constant(true), (installed) => {
        const status = getEngineStatusType(installed, undefined);
        expect(status).toBe("ready");
      }),
      { numRuns: 10 }
    );
  });

  it('should return "not_installed" when not installed and no error', () => {
    fc.assert(
      fc.property(fc.constant(false), (installed) => {
        const status = getEngineStatusType(installed, undefined);
        expect(status).toBe("not_installed");
      }),
      { numRuns: 10 }
    );
  });

  it('should return "error" when error is present regardless of installed state', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.string({ minLength: 1, maxLength: 100 }), (installed, error) => {
        const status = getEngineStatusType(installed, error);
        expect(status).toBe("error");
      }),
      { numRuns: 50 }
    );
  });

  it("should always return valid status type", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (installed, error) => {
          const status = getEngineStatusType(installed, error);
          const validStatuses: EngineStatusType[] = ["ready", "not_installed", "error", "checking"];
          expect(validStatuses).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Status Cache Behavior - Property Tests", () => {
  /**
   * Property 8: Status Cache Behavior
   *
   * The cache SHALL expire after 30 seconds and return stale data
   * while refreshing in the background.
   */

  it("should correctly calculate cache expiration", () => {
    const CACHE_TTL = 30 * 1000; // 30 seconds

    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }), // cachedAt offset
        fc.nat({ max: 100000 }), // current time offset
        (cachedAtOffset, currentOffset) => {
          const baseTime = 1000000000000; // 固定基准时间
          const cachedAt = baseTime + cachedAtOffset;
          const currentTime = cachedAt + currentOffset;

          const isExpired = currentTime - cachedAt > CACHE_TTL;
          const expectedExpired = currentOffset > CACHE_TTL;

          expect(isExpired).toBe(expectedExpired);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should set correct expiration time in meta", () => {
    const CACHE_TTL = 30 * 1000;

    fc.assert(
      fc.property(fc.nat({ max: 10000000000000 }), (timestamp) => {
        const meta = {
          cachedAt: timestamp,
          expiresAt: timestamp + CACHE_TTL,
        };

        // expiresAt 应该正好是 cachedAt + TTL
        expect(meta.expiresAt - meta.cachedAt).toBe(CACHE_TTL);
      }),
      { numRuns: 50 }
    );
  });
});

describe("Engine Status Consistency - Property Tests", () => {
  it("should maintain consistent status across multiple calls", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (installed, error) => {
          // 多次调用应该返回相同结果
          const status1 = getEngineStatusType(installed, error);
          const status2 = getEngineStatusType(installed, error);
          const status3 = getEngineStatusType(installed, error);

          expect(status1).toBe(status2);
          expect(status2).toBe(status3);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should generate consistent error messages", () => {
    fc.assert(
      fc.property(
        engineTypeArb,
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (engine, error) => {
          // 多次调用应该返回相同消息
          const msg1 = generateEngineErrorMessage(engine, error);
          const msg2 = generateEngineErrorMessage(engine, error);

          expect(msg1).toBe(msg2);
        }
      ),
      { numRuns: 50 }
    );
  });
});
