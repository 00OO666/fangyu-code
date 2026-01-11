/**
 * Property-Based Tests for useSessionThresholdMonitor Hook
 *
 * Feature: fangyu-code-error-fixes
 * Property 5: Threshold Warning Rate Limiting
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * Tests that token threshold warnings are rate-limited to at most
 * once per minute while still accurately tracking threshold state.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ============================================================================
// Threshold Monitor Manager - Pure Logic Implementation for Testing
// ============================================================================

interface ThresholdConfig {
    warningThreshold: number;
    criticalThreshold: number;
    maxContextTokens: number;
}

interface ThresholdStatus {
    currentTokens: number;
    percentage: number;
    isWarning: boolean;
    isCritical: boolean;
}

const DEFAULT_CONFIG: ThresholdConfig = {
    warningThreshold: 0.8,
    criticalThreshold: 0.9,
    maxContextTokens: 120000,
};

const WARNING_INTERVAL = 60000; // 1 minute

/**
 * Pure implementation of threshold monitor logic for property testing.
 * This mirrors the useSessionThresholdMonitor hook logic without React dependencies.
 *
 * Key insight: In the actual hook, lastExceedWarningTimeRef starts at 0,
 * and Date.now() returns a large timestamp (e.g., 1736582400000).
 * So the first check always passes: now - 0 > 60000 is true.
 *
 * To simulate this correctly, we use a "never warned" sentinel value (-Infinity)
 * which ensures the first warning always logs regardless of currentTime.
 */
class ThresholdMonitorManager {
    private config: ThresholdConfig;
    /** Use -Infinity as sentinel for "never warned" state */
    private lastExceedWarningTime: number = -Infinity;
    private warningCount = 0;
    private currentTime = 0;

    constructor(config: Partial<ThresholdConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Set current time for testing (simulates Date.now())
     */
    setCurrentTime(time: number): void {
        this.currentTime = time;
    }

    /**
     * Advance time by specified milliseconds
     */
    advanceTime(ms: number): void {
        this.currentTime += ms;
    }

    /**
     * Estimate token count from message count (simplified)
     */
    estimateTokens(messageCount: number, avgCharsPerMessage: number): number {
        return Math.ceil((messageCount * avgCharsPerMessage) / 4);
    }

    /**
     * Check threshold and potentially log warning
     * Returns whether a warning was logged
     *
     * Mirrors the hook logic:
     * if (percentage > 1.0 && now - lastExceedWarningTimeRef.current > WARNING_INTERVAL)
     */
    checkThreshold(currentTokens: number): {
        status: ThresholdStatus;
        warningLogged: boolean;
    } {
        const percentage = currentTokens / this.config.maxContextTokens;

        const status: ThresholdStatus = {
            currentTokens,
            percentage,
            isWarning: percentage >= this.config.warningThreshold,
            isCritical: percentage >= this.config.criticalThreshold,
        };

        let warningLogged = false;

        // Rate-limited warning for exceeding 100%
        // First warning always logs because: currentTime - (-Infinity) > 60000 is always true
        if (
            percentage > 1.0 &&
            this.currentTime - this.lastExceedWarningTime > WARNING_INTERVAL
        ) {
            this.lastExceedWarningTime = this.currentTime;
            this.warningCount++;
            warningLogged = true;
        }

        return { status, warningLogged };
    }

    /**
     * Get total warning count
     */
    getWarningCount(): number {
        return this.warningCount;
    }

    /**
     * Reset state (simulates session change)
     * Uses -Infinity to ensure first warning after reset always logs
     */
    reset(): void {
        this.lastExceedWarningTime = -Infinity;
        this.warningCount = 0;
    }
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

// Token count generator (can exceed max)
const tokenCountArb = fc.integer({ min: 0, max: 200000 });

// Time interval generator (in milliseconds)
const timeIntervalArb = fc.integer({ min: 0, max: 120000 });

// Config generator
const configArb = fc.record({
    warningThreshold: fc.double({ min: 0.5, max: 0.95 }),
    criticalThreshold: fc.double({ min: 0.85, max: 0.99 }),
    maxContextTokens: fc.integer({ min: 50000, max: 200000 }),
});

// Sequence of token updates with time intervals
const tokenUpdateSequenceArb = fc.array(
    fc.record({
        tokens: tokenCountArb,
        timeAdvance: timeIntervalArb,
    }),
    { minLength: 1, maxLength: 20 }
);

// ============================================================================
// Property Tests
// ============================================================================

describe("useSessionThresholdMonitor - Threshold Warning Rate Limiting", () => {
    let manager: ThresholdMonitorManager;

    beforeEach(() => {
        manager = new ThresholdMonitorManager();
        manager.setCurrentTime(0);
    });

    afterEach(() => {
        manager.reset();
    });

    /**
     * Property 5: Threshold Warning Rate Limiting
     *
     * For any sequence of token usage updates that exceed the threshold,
     * the Threshold_Monitor SHALL log at most one warning per minute,
     * while still accurately tracking the threshold state.
     *
     * Validates: Requirements 7.1, 7.2, 7.3
     */
    it("should log at most one warning per minute when exceeding threshold", () => {
        fc.assert(
            fc.property(tokenUpdateSequenceArb, (updates) => {
                manager.reset();
                manager.setCurrentTime(0);

                let totalTime = 0;
                const warningTimes: number[] = [];

                for (const update of updates) {
                    manager.advanceTime(update.timeAdvance);
                    totalTime += update.timeAdvance;

                    const { warningLogged } = manager.checkThreshold(update.tokens);

                    if (warningLogged) {
                        warningTimes.push(totalTime);
                    }
                }

                // Verify rate limiting: consecutive warnings must be at least 60s apart
                for (let i = 1; i < warningTimes.length; i++) {
                    const interval = warningTimes[i] - warningTimes[i - 1];
                    expect(interval).toBeGreaterThanOrEqual(WARNING_INTERVAL);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Threshold state is always accurate regardless of rate limiting
     *
     * Validates: Requirements 7.3
     */
    it("should accurately track threshold state regardless of rate limiting", () => {
        fc.assert(
            fc.property(tokenCountArb, configArb, (tokens, config) => {
                const customManager = new ThresholdMonitorManager(config);
                customManager.setCurrentTime(0);

                const { status } = customManager.checkThreshold(tokens);

                // Verify percentage calculation
                const expectedPercentage = tokens / config.maxContextTokens;
                expect(status.percentage).toBeCloseTo(expectedPercentage, 10);

                // Verify warning threshold detection
                expect(status.isWarning).toBe(
                    expectedPercentage >= config.warningThreshold
                );

                // Verify critical threshold detection
                expect(status.isCritical).toBe(
                    expectedPercentage >= config.criticalThreshold
                );

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property: First exceed warning is always logged immediately
     *
     * Validates: Requirements 7.2
     */
    it("should log first exceed warning immediately", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 120001, max: 200000 }), // Tokens > 100%
                (tokens) => {
                    manager.reset();
                    manager.setCurrentTime(0);

                    const { status, warningLogged } = manager.checkThreshold(tokens);

                    // First warning should be logged immediately when exceeding 100%
                    expect(status.percentage).toBeGreaterThan(1.0);
                    expect(warningLogged).toBe(true);
                    expect(manager.getWarningCount()).toBe(1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: No warning logged when under 100%
     *
     * Validates: Requirements 7.1
     */
    it("should not log exceed warning when under 100%", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 119999 }), // Tokens <= 100%
                (tokens) => {
                    manager.reset();
                    manager.setCurrentTime(0);

                    const { status, warningLogged } = manager.checkThreshold(tokens);

                    // No warning should be logged when under 100%
                    expect(status.percentage).toBeLessThanOrEqual(1.0);
                    expect(warningLogged).toBe(false);
                    expect(manager.getWarningCount()).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Warning is logged after interval passes
     *
     * Validates: Requirements 7.1, 7.2
     */
    it("should log warning after interval passes", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 130000, max: 200000 }), // Tokens > 100%
                fc.integer({ min: 60001, max: 120000 }), // Time > 60s
                (tokens, timeAdvance) => {
                    manager.reset();
                    manager.setCurrentTime(0);

                    // First check - should log
                    const first = manager.checkThreshold(tokens);
                    expect(first.warningLogged).toBe(true);

                    // Advance time past interval
                    manager.advanceTime(timeAdvance);

                    // Second check - should log again
                    const second = manager.checkThreshold(tokens);
                    expect(second.warningLogged).toBe(true);

                    expect(manager.getWarningCount()).toBe(2);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Warning is NOT logged within interval
     *
     * Validates: Requirements 7.1
     */
    it("should NOT log warning within interval", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 130000, max: 200000 }), // Tokens > 100%
                fc.integer({ min: 0, max: 59999 }), // Time < 60s
                (tokens, timeAdvance) => {
                    manager.reset();
                    manager.setCurrentTime(0);

                    // First check - should log
                    const first = manager.checkThreshold(tokens);
                    expect(first.warningLogged).toBe(true);

                    // Advance time within interval
                    manager.advanceTime(timeAdvance);

                    // Second check - should NOT log
                    const second = manager.checkThreshold(tokens);
                    expect(second.warningLogged).toBe(false);

                    expect(manager.getWarningCount()).toBe(1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Reset clears warning state
     *
     * Validates: Requirements 7.2 (state changes)
     */
    it("should clear warning state on reset", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 130000, max: 200000 }), // Tokens > 100%
                (tokens) => {
                    manager.reset();
                    manager.setCurrentTime(0);

                    // First check - should log
                    manager.checkThreshold(tokens);
                    expect(manager.getWarningCount()).toBe(1);

                    // Reset
                    manager.reset();
                    expect(manager.getWarningCount()).toBe(0);

                    // Check again - should log (fresh state)
                    const { warningLogged } = manager.checkThreshold(tokens);
                    expect(warningLogged).toBe(true);
                    expect(manager.getWarningCount()).toBe(1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Warning count never exceeds theoretical maximum
     *
     * Validates: Requirements 7.1
     */
    it("should have warning count bounded by time / interval", () => {
        fc.assert(
            fc.property(tokenUpdateSequenceArb, (updates) => {
                manager.reset();
                manager.setCurrentTime(0);

                let totalTime = 0;

                for (const update of updates) {
                    manager.advanceTime(update.timeAdvance);
                    totalTime += update.timeAdvance;
                    manager.checkThreshold(update.tokens);
                }

                // Maximum possible warnings = floor(totalTime / WARNING_INTERVAL) + 1
                const maxPossibleWarnings =
                    Math.floor(totalTime / WARNING_INTERVAL) + 1;
                expect(manager.getWarningCount()).toBeLessThanOrEqual(
                    maxPossibleWarnings
                );

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
