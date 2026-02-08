/**
 * Property-Based Tests for Pricing System
 *
 * Feature: fangyu-code-error-fixes
 * Property 4: Pricing System Robustness
 * Validates: Requirements 6.1, 6.2, 6.3
 *
 * Tests that getPricingForModel returns a valid ModelPricing object
 * without throwing, and synthetic models are handled silently.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { getPricingForModel, MODEL_PRICING, type ModelPricing } from "./pricing";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Validate that a pricing object has all required fields with valid values
 */
function isValidPricing(pricing: ModelPricing): boolean {
  return (
    pricing !== null &&
    typeof pricing === "object" &&
    typeof pricing.input === "number" &&
    typeof pricing.output === "number" &&
    typeof pricing.cacheWrite === "number" &&
    typeof pricing.cacheRead === "number" &&
    pricing.input >= 0 &&
    pricing.output >= 0 &&
    pricing.cacheWrite >= 0 &&
    pricing.cacheRead >= 0
  );
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

// Engine type generator
const engineArb = fc.oneof(
  fc.constant("claude"),
  fc.constant("codex"),
  fc.constant("gemini"),
  fc.constant(undefined)
);

// Known model names
const knownModelArb = fc.constantFrom(
  "claude-opus-4.5",
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
  "gpt-5.1-codex",
  "codex-mini-latest",
  "gemini-2.5-pro",
  "gemini-2.5-flash"
);

// Synthetic model names (should be handled silently)
const syntheticModelArb = fc.constantFrom(
  "<synthetic>",
  "synthetic",
  "synthetic-model",
  "test-synthetic-v1"
);

// Random string model names (unknown models)
const randomModelArb = fc.stringOf(
  fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.".split("")),
  { minLength: 1, maxLength: 50 }
);

// Any model input (including undefined)
const anyModelArb = fc.oneof(
  knownModelArb,
  syntheticModelArb,
  randomModelArb,
  fc.constant(undefined)
);

// ============================================================================
// Property Tests
// ============================================================================

describe("Pricing System - Robustness", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  /**
   * Property 4: Pricing System Robustness
   *
   * For any model identifier passed to getPricingForModel, the function
   * SHALL return a valid ModelPricing object without throwing, and
   * synthetic models SHALL be handled silently without warnings.
   *
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  it("should never throw for any model input", async () => {
    await fc.assert(
      fc.property(anyModelArb, engineArb, (model, engine) => {
        // Should not throw
        const result = getPricingForModel(model, engine);

        // Should return valid pricing
        expect(isValidPricing(result)).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Synthetic models are handled silently
   *
   * Validates: Requirements 6.1
   */
  it("should handle synthetic models silently without warnings", async () => {
    await fc.assert(
      fc.property(syntheticModelArb, engineArb, (model, engine) => {
        consoleWarnSpy.mockClear();
        consoleDebugSpy.mockClear();

        const result = getPricingForModel(model, engine);

        // Should return valid pricing
        expect(isValidPricing(result)).toBe(true);

        // Should NOT log any warnings for synthetic models
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        // Should NOT log debug messages for synthetic models either
        // (they are silently handled)
        const syntheticDebugCalls = consoleDebugSpy.mock.calls.filter(
          (call) => call[0]?.includes?.("synthetic") || call[0]?.includes?.("<synthetic>")
        );
        expect(syntheticDebugCalls.length).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Known models return correct pricing
   *
   * Validates: Requirements 6.3
   */
  it("should return correct pricing for known models", async () => {
    await fc.assert(
      fc.property(knownModelArb, (model) => {
        const result = getPricingForModel(model);

        // Should return valid pricing
        expect(isValidPricing(result)).toBe(true);

        // Should match the expected pricing from MODEL_PRICING
        const expectedPricing = MODEL_PRICING[model];
        if (expectedPricing) {
          expect(result.input).toBe(expectedPricing.input);
          expect(result.output).toBe(expectedPricing.output);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unknown models use debug level logging (not warn)
   *
   * Validates: Requirements 6.2
   */
  it("should use debug level logging for unknown models", async () => {
    // Generate truly unknown model names
    const unknownModelArb = fc
      .stringOf(fc.constantFrom(..."xyz123".split("")), {
        minLength: 5,
        maxLength: 20,
      })
      .filter(
        (s) =>
          !s.includes("claude") &&
          !s.includes("codex") &&
          !s.includes("gemini") &&
          !s.includes("gpt") &&
          !s.includes("synthetic") &&
          !s.includes("opus") &&
          !s.includes("sonnet") &&
          !s.includes("haiku")
      );

    await fc.assert(
      fc.property(unknownModelArb, (model) => {
        consoleWarnSpy.mockClear();
        consoleDebugSpy.mockClear();

        const result = getPricingForModel(model);

        // Should return valid pricing (default)
        expect(isValidPricing(result)).toBe(true);

        // Should NOT use console.warn
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Undefined model returns engine-appropriate default
   *
   * Validates: Requirements 6.3
   */
  it("should return engine-appropriate default for undefined model", async () => {
    await fc.assert(
      fc.property(engineArb, (engine) => {
        const result = getPricingForModel(undefined, engine);

        // Should return valid pricing
        expect(isValidPricing(result)).toBe(true);

        // Should match engine-specific default
        if (engine === "codex") {
          expect(result).toEqual(MODEL_PRICING["codex-mini-latest"]);
        } else if (engine === "gemini") {
          expect(result).toEqual(MODEL_PRICING["gemini-2.5-pro"]);
        } else {
          expect(result).toEqual(MODEL_PRICING["default"]);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All pricing values are non-negative
   *
   * Validates: Requirements 6.3
   */
  it("should always return non-negative pricing values", async () => {
    await fc.assert(
      fc.property(anyModelArb, engineArb, (model, engine) => {
        const result = getPricingForModel(model, engine);

        expect(result.input).toBeGreaterThanOrEqual(0);
        expect(result.output).toBeGreaterThanOrEqual(0);
        expect(result.cacheWrite).toBeGreaterThanOrEqual(0);
        expect(result.cacheRead).toBeGreaterThanOrEqual(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Model name normalization is case-insensitive
   *
   * Validates: Requirements 6.3
   */
  it("should handle model names case-insensitively", async () => {
    const caseVariantArb = fc.constantFrom(
      "CLAUDE-OPUS-4.5",
      "Claude-Opus-4.5",
      "claude-OPUS-4.5",
      "GEMINI-2.5-PRO",
      "Gemini-2.5-Pro"
    );

    await fc.assert(
      fc.property(caseVariantArb, (model) => {
        const result = getPricingForModel(model);

        // Should return valid pricing (not default for known models)
        expect(isValidPricing(result)).toBe(true);

        // Should match the lowercase version
        const lowerModel = model.toLowerCase();
        const lowerResult = getPricingForModel(lowerModel);
        expect(result).toEqual(lowerResult);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pricing object structure is consistent
   *
   * Validates: Requirements 6.3
   */
  it("should always return pricing with consistent structure", async () => {
    await fc.assert(
      fc.property(anyModelArb, engineArb, (model, engine) => {
        const result = getPricingForModel(model, engine);

        // Should have exactly these 4 properties
        const keys = Object.keys(result).sort();
        expect(keys).toEqual(["cacheRead", "cacheWrite", "input", "output"]);

        // All values should be numbers
        expect(typeof result.input).toBe("number");
        expect(typeof result.output).toBe("number");
        expect(typeof result.cacheWrite).toBe("number");
        expect(typeof result.cacheRead).toBe("number");

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
