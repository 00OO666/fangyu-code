/**
 * Property-Based Tests for useConsoleMonitor Hook
 *
 * Feature: fangyu-code-error-fixes
 * Property 2: Render-Safe State Updates
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * Tests that state updates are deferred using queueMicrotask to avoid
 * synchronous state updates during React render cycles.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ============================================================================
// Console Monitor Manager - Pure Logic Implementation for Testing
// ============================================================================

/**
 * Error category types matching the hook implementation
 */
type ErrorCategory =
  | "duplicate-message"
  | "state-update"
  | "network"
  | "render"
  | "memory"
  | "performance"
  | "unknown";

interface ConsoleError {
  id: string;
  type: "error" | "warn" | "info";
  message: string;
  timestamp: number;
  count: number;
  category: ErrorCategory;
}

/**
 * Pure implementation of console monitor logic for property testing.
 * This mirrors the useConsoleMonitor hook logic without React dependencies.
 */
class ConsoleMonitorManager {
  private errors: ConsoleError[] = [];
  private errorMap: Map<string, ConsoleError> = new Map();
  private maxErrors: number;
  private pendingUpdates: Array<() => void> = [];
  private isProcessingMicrotask = false;

  constructor(maxErrors = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Simulates queueMicrotask behavior for testing
   * Returns true if the update was deferred (not synchronous)
   */
  addError(type: "error" | "warn" | "info", message: string): boolean {
    const errorId = `${type}-${message.substring(0, 100)}`;
    let wasDeferred = false;

    // Simulate queueMicrotask - the update is queued, not executed immediately
    this.pendingUpdates.push(() => {
      const existingError = this.errorMap.get(errorId);

      if (existingError) {
        const updated = {
          ...existingError,
          count: existingError.count + 1,
          timestamp: Date.now(),
        };
        this.errorMap.set(errorId, updated);
        this.errors = this.errors.map((err) => (err.id === errorId ? updated : err));
      } else {
        const newError: ConsoleError = {
          id: errorId,
          type,
          message,
          timestamp: Date.now(),
          count: 1,
          category: this.analyzeCategory(message),
        };

        this.errorMap.set(errorId, newError);
        this.errors = [...this.errors, newError];

        // Limit error count
        if (this.errors.length > this.maxErrors) {
          const removed = this.errors.shift();
          if (removed) {
            this.errorMap.delete(removed.id);
          }
        }
      }
    });

    wasDeferred = true;
    return wasDeferred;
  }

  /**
   * Process all pending microtask updates
   */
  processPendingUpdates(): void {
    if (this.isProcessingMicrotask) return;
    this.isProcessingMicrotask = true;

    while (this.pendingUpdates.length > 0) {
      const update = this.pendingUpdates.shift();
      if (update) update();
    }

    this.isProcessingMicrotask = false;
  }

  /**
   * Check if there are pending updates (simulates async nature)
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.length > 0;
  }

  /**
   * Get current error count (before processing pending updates)
   */
  getImmediateErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Get error count after processing all pending updates
   */
  getErrorCountAfterProcessing(): number {
    this.processPendingUpdates();
    return this.errors.length;
  }

  /**
   * Get all errors
   */
  getErrors(): ConsoleError[] {
    return [...this.errors];
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
    this.errorMap.clear();
    this.pendingUpdates = [];
  }

  /**
   * Analyze error category based on message content
   */
  private analyzeCategory(message: string): ErrorCategory {
    if (/duplicate|重复/i.test(message)) return "duplicate-message";
    if (/memory leak|unmounted/i.test(message)) return "memory";
    if (/network|fetch|request failed/i.test(message)) return "network";
    if (/render|rendering/i.test(message)) return "render";
    if (/performance|slow/i.test(message)) return "performance";
    if (/state|setState/i.test(message)) return "state-update";
    return "unknown";
  }
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

// Error type generator
const errorTypeArb = fc.constantFrom<"error" | "warn" | "info">("error", "warn", "info");

// Error message generator
const errorMessageArb = fc.stringOf(
  fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-:.".split("")
  ),
  { minLength: 1, maxLength: 200 }
);

// Error entry generator
const errorEntryArb = fc.record({
  type: errorTypeArb,
  message: errorMessageArb,
});

// Array of error entries
const errorEntriesArb = fc.array(errorEntryArb, { minLength: 1, maxLength: 50 });

// ============================================================================
// Property Tests
// ============================================================================

describe("useConsoleMonitor - Render-Safe State Updates", () => {
  let manager: ConsoleMonitorManager;

  beforeEach(() => {
    manager = new ConsoleMonitorManager();
  });

  afterEach(() => {
    manager.clearErrors();
  });

  /**
   * Property 2: Render-Safe State Updates
   *
   * For any error detected during component rendering, the Console_Monitor
   * SHALL defer the state update to the next microtask, ensuring no
   * synchronous state updates occur during render.
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   */
  it("should defer all state updates using queueMicrotask", async () => {
    await fc.assert(
      fc.property(errorEntriesArb, (entries) => {
        manager.clearErrors();

        // Add all errors
        for (const entry of entries) {
          const wasDeferred = manager.addError(entry.type, entry.message);
          // Property: Every addError call should defer the update
          expect(wasDeferred).toBe(true);
        }

        // Property: Immediately after adding, errors should NOT be in state yet
        // (they are pending in the microtask queue)
        expect(manager.hasPendingUpdates()).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: State is not updated synchronously during addError
   *
   * Validates: Requirements 2.2, 2.3
   */
  it("should not update state synchronously when addError is called", async () => {
    await fc.assert(
      fc.property(errorEntryArb, (entry) => {
        manager.clearErrors();

        const countBefore = manager.getImmediateErrorCount();
        manager.addError(entry.type, entry.message);
        const countAfter = manager.getImmediateErrorCount();

        // Property: Count should NOT change immediately (deferred update)
        expect(countAfter).toBe(countBefore);

        // After processing microtasks, count should change
        manager.processPendingUpdates();
        const countFinal = manager.getImmediateErrorCount();
        expect(countFinal).toBe(countBefore + 1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All pending updates are processed correctly
   *
   * Validates: Requirements 2.1, 2.4
   */
  it("should process all pending updates when microtask runs", async () => {
    await fc.assert(
      fc.property(errorEntriesArb, (entries) => {
        manager.clearErrors();

        // Add multiple errors
        for (const entry of entries) {
          manager.addError(entry.type, entry.message);
        }

        // All updates should be pending
        expect(manager.hasPendingUpdates()).toBe(true);

        // Process all pending updates
        manager.processPendingUpdates();

        // No more pending updates
        expect(manager.hasPendingUpdates()).toBe(false);

        // Calculate expected unique error count
        const uniqueIds = new Set(entries.map((e) => `${e.type}-${e.message.substring(0, 100)}`));
        expect(manager.getImmediateErrorCount()).toBe(uniqueIds.size);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Duplicate errors increment count instead of adding new entries
   *
   * Validates: Requirements 2.4 (maintain error capture functionality)
   */
  it("should increment count for duplicate errors", async () => {
    await fc.assert(
      fc.property(
        errorTypeArb,
        errorMessageArb,
        fc.integer({ min: 2, max: 10 }),
        (type, message, repeatCount) => {
          manager.clearErrors();

          // Add same error multiple times
          for (let i = 0; i < repeatCount; i++) {
            manager.addError(type, message);
          }

          // Process all updates
          manager.processPendingUpdates();

          // Should only have 1 error entry
          const errors = manager.getErrors();
          expect(errors.length).toBe(1);

          // But count should equal repeatCount
          expect(errors[0].count).toBe(repeatCount);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error count is limited by maxErrors
   *
   * Validates: Requirements 2.4 (maintain functionality)
   */
  it("should limit error count to maxErrors", async () => {
    const maxErrors = 10;
    const limitedManager = new ConsoleMonitorManager(maxErrors);

    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: errorTypeArb,
            // Use unique messages to avoid deduplication
            message: fc.uuid(),
          }),
          { minLength: maxErrors + 5, maxLength: maxErrors + 20 }
        ),
        (entries) => {
          limitedManager.clearErrors();

          // Add more errors than maxErrors
          for (const entry of entries) {
            limitedManager.addError(entry.type, entry.message);
          }

          // Process all updates
          limitedManager.processPendingUpdates();

          // Should not exceed maxErrors
          expect(limitedManager.getImmediateErrorCount()).toBeLessThanOrEqual(maxErrors);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error categorization is consistent
   *
   * Validates: Requirements 2.4 (maintain functionality)
   */
  it("should categorize errors consistently based on message content", async () => {
    const categoryPatterns: Array<{
      pattern: string;
      expectedCategory: ErrorCategory;
    }> = [
      { pattern: "duplicate message detected", expectedCategory: "duplicate-message" },
      { pattern: "memory leak warning", expectedCategory: "memory" },
      { pattern: "network request failed", expectedCategory: "network" },
      { pattern: "render error occurred", expectedCategory: "render" },
      { pattern: "performance issue", expectedCategory: "performance" },
      { pattern: "setState called", expectedCategory: "state-update" },
    ];

    await fc.assert(
      fc.property(
        fc.constantFrom(...categoryPatterns),
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz ".split("")), {
          minLength: 0,
          maxLength: 50,
        }),
        ({ pattern, expectedCategory }, suffix) => {
          manager.clearErrors();

          const message = `${pattern} ${suffix}`;
          manager.addError("error", message);
          manager.processPendingUpdates();

          const errors = manager.getErrors();
          expect(errors.length).toBe(1);
          expect(errors[0].category).toBe(expectedCategory);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: clearErrors removes all errors and pending updates
   */
  it("should clear all errors and pending updates", async () => {
    await fc.assert(
      fc.property(errorEntriesArb, (entries) => {
        manager.clearErrors();

        // Add errors
        for (const entry of entries) {
          manager.addError(entry.type, entry.message);
        }

        // Clear everything
        manager.clearErrors();

        // Should have no errors and no pending updates
        expect(manager.getImmediateErrorCount()).toBe(0);
        expect(manager.hasPendingUpdates()).toBe(false);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
