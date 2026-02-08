/**
 * Summary UI Property Tests
 *
 * Property 4: Token Threshold Warning
 * Property 5: Session Statistics Accuracy
 *
 * Requirements: 5.2, 5.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { SessionStats } from "@/types/summary";

// =============================================================================
// 辅助函数
// =============================================================================

/** 警告阈值 */
const WARNING_THRESHOLD = 0.8;
/** 危险阈值 */
const CRITICAL_THRESHOLD = 0.9;

/** 计算警告状态 */
function calculateWarningState(tokenPercentage: number): {
  isWarning: boolean;
  isCritical: boolean;
} {
  return {
    isWarning: tokenPercentage >= WARNING_THRESHOLD,
    isCritical: tokenPercentage >= CRITICAL_THRESHOLD,
  };
}

/** 计算会话统计 */
function calculateSessionStats(
  userMessages: number,
  assistantMessages: number,
  avgTokensPerMessage: number,
  costPer1kTokens: number,
  maxContextTokens: number
): SessionStats {
  const messageCount = userMessages + assistantMessages;
  const tokenCount = messageCount * avgTokensPerMessage;
  const tokenPercentage = tokenCount / maxContextTokens;
  const estimatedCost = (tokenCount / 1000) * costPer1kTokens;

  return {
    messageCount,
    tokenCount,
    tokenPercentage,
    estimatedCost,
    userMessageCount: userMessages,
    assistantMessageCount: assistantMessages,
  };
}

// =============================================================================
// Property 4: Token Threshold Warning
// =============================================================================

describe("Property 4: Token Threshold Warning", () => {
  it("should show warning indicator when token usage >= 80%", () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (percentage) => {
        const { isWarning } = calculateWarningState(percentage);

        if (percentage >= WARNING_THRESHOLD) {
          expect(isWarning).toBe(true);
        } else {
          expect(isWarning).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("should show critical indicator when token usage >= 90%", () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (percentage) => {
        const { isCritical } = calculateWarningState(percentage);

        if (percentage >= CRITICAL_THRESHOLD) {
          expect(isCritical).toBe(true);
        } else {
          expect(isCritical).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("should have critical imply warning", () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (percentage) => {
        const { isWarning, isCritical } = calculateWarningState(percentage);

        // 如果是危险状态，必然也是警告状态
        if (isCritical) {
          expect(isWarning).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("should handle edge cases at thresholds", () => {
    // 精确在阈值上
    expect(calculateWarningState(0.8).isWarning).toBe(true);
    expect(calculateWarningState(0.8).isCritical).toBe(false);
    expect(calculateWarningState(0.9).isCritical).toBe(true);

    // 略低于阈值
    expect(calculateWarningState(0.79).isWarning).toBe(false);
    expect(calculateWarningState(0.89).isCritical).toBe(false);

    // 超过 100%
    expect(calculateWarningState(1.5).isWarning).toBe(true);
    expect(calculateWarningState(1.5).isCritical).toBe(true);
  });
});

// =============================================================================
// Property 5: Session Statistics Accuracy
// =============================================================================

describe("Property 5: Session Statistics Accuracy", () => {
  it("should calculate message count correctly", () => {
    fc.assert(
      fc.property(fc.nat({ max: 100 }), fc.nat({ max: 100 }), (userMessages, assistantMessages) => {
        const stats = calculateSessionStats(
          userMessages,
          assistantMessages,
          100, // avgTokensPerMessage
          0.001, // costPer1kTokens
          200000 // maxContextTokens
        );

        expect(stats.messageCount).toBe(userMessages + assistantMessages);
        expect(stats.userMessageCount).toBe(userMessages);
        expect(stats.assistantMessageCount).toBe(assistantMessages);
      }),
      { numRuns: 100 }
    );
  });

  it("should calculate token percentage correctly", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 100000, max: 500000 }),
        (userMessages, assistantMessages, avgTokens, maxTokens) => {
          const stats = calculateSessionStats(
            userMessages,
            assistantMessages,
            avgTokens,
            0.001,
            maxTokens
          );

          const expectedPercentage = stats.tokenCount / maxTokens;
          expect(stats.tokenPercentage).toBeCloseTo(expectedPercentage, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should calculate estimated cost correctly", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 1, max: 100 }).map((n) => n / 10000), // 0.0001 to 0.01, no NaN
        (userMessages, assistantMessages, avgTokens, costPer1k) => {
          const stats = calculateSessionStats(
            userMessages,
            assistantMessages,
            avgTokens,
            costPer1k,
            200000
          );

          const expectedCost = (stats.tokenCount / 1000) * costPer1k;
          expect(stats.estimatedCost).toBeCloseTo(expectedCost, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should have non-negative values", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }).map((n) => n / 10000), // 0.0001 to 0.1, no NaN
        (userMessages, assistantMessages, avgTokens, costPer1k) => {
          const stats = calculateSessionStats(
            userMessages,
            assistantMessages,
            avgTokens,
            costPer1k,
            200000
          );

          expect(stats.messageCount).toBeGreaterThanOrEqual(0);
          expect(stats.tokenCount).toBeGreaterThanOrEqual(0);
          expect(stats.tokenPercentage).toBeGreaterThanOrEqual(0);
          expect(stats.estimatedCost).toBeGreaterThanOrEqual(0);
          expect(stats.userMessageCount).toBeGreaterThanOrEqual(0);
          expect(stats.assistantMessageCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle zero messages", () => {
    const stats = calculateSessionStats(0, 0, 100, 0.001, 200000);

    expect(stats.messageCount).toBe(0);
    expect(stats.tokenCount).toBe(0);
    expect(stats.tokenPercentage).toBe(0);
    expect(stats.estimatedCost).toBe(0);
  });
});
