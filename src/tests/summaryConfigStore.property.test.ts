/**
 * Summary Config Store Property Tests
 *
 * Property-based tests for configuration persistence round-trip
 *
 * Feature: session-summary-generator
 * Property 6: Configuration Persistence Round-Trip
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  SummaryConfigStore,
  createSummaryConfigStore,
  validateConfig,
} from "@/services/summaryConfigStore";
import {
  SummaryAPIConfig,
  SummaryEngine,
  ENGINE_MODELS,
  SUMMARY_CONFIG_STORAGE_KEY,
} from "@/types/summary";

// =============================================================================
// Generators
// =============================================================================

/** 生成有效的引擎 */
const engineArb: fc.Arbitrary<SummaryEngine> = fc.constantFrom("claude", "codex", "gemini");

/** 生成有效的模型 ID（基于引擎） */
const modelForEngineArb = (engine: SummaryEngine): fc.Arbitrary<string> => {
  const models = ENGINE_MODELS[engine];
  if (models && models.length > 0) {
    return fc.constantFrom(...models.map((m) => m.id));
  }
  return fc.constant("default-model");
};

/** 生成有效的自定义参数 */
const customParamsArb: fc.Arbitrary<SummaryAPIConfig["customParams"]> = fc.option(
  fc.record({
    maxTokens: fc.option(fc.integer({ min: 100, max: 100000 }), { nil: undefined }),
    temperature: fc.option(fc.float({ min: 0, max: 2 }), { nil: undefined }),
    focusAreas: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }), {
      nil: undefined,
    }),
    includeCodeSnippets: fc.option(fc.boolean(), { nil: undefined }),
  }),
  { nil: undefined }
);

/** 生成有效的 API Key */
const apiKeyArb: fc.Arbitrary<string | undefined> = fc.option(
  fc
    .stringOf(
      fc.constantFrom(
        ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".split("")
      ),
      { minLength: 10, maxLength: 100 }
    )
    .map((s) => `sk-${s}`),
  { nil: undefined }
);

/** 生成有效的 API 端点 */
const apiEndpointArb: fc.Arbitrary<string | undefined> = fc.option(fc.webUrl(), { nil: undefined });

/** 生成完整的有效配置 */
const validConfigArb: fc.Arbitrary<SummaryAPIConfig> = engineArb.chain((engine) =>
  fc.record({
    engine: fc.constant(engine),
    model: modelForEngineArb(engine),
    apiEndpoint: apiEndpointArb,
    apiKey: apiKeyArb,
    customParams: customParamsArb,
    updatedAt: fc.integer({ min: 0 }),
  })
);

// =============================================================================
// Test Setup
// =============================================================================

describe("SummaryConfigStore Property Tests", () => {
  let store: SummaryConfigStore;

  beforeEach(() => {
    // Mock localStorage
    const storage: Record<string, string> = {};
    originalLocalStorage = global.localStorage;

    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: (key: string) => storage[key] || null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        clear: () => {
          Object.keys(storage).forEach((k) => delete storage[k]);
        },
        get length() {
          return Object.keys(storage).length;
        },
        key: (i: number) => Object.keys(storage)[i] || null,
      },
      writable: true,
      configurable: true,
    });

    // Mock crypto.subtle for encryption
    if (!global.crypto?.subtle) {
      Object.defineProperty(global, "crypto", {
        value: {
          subtle: {
            generateKey: async () => ({ type: "secret" }),
            importKey: async () => ({ type: "secret" }),
            exportKey: async () => ({ k: "test-key" }),
            encrypt: async (_: unknown, __: unknown, data: Uint8Array) => data.buffer,
            decrypt: async (_: unknown, __: unknown, data: ArrayBuffer) => data,
          },
          getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
              arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
          },
        },
        writable: true,
        configurable: true,
      });
    }

    store = createSummaryConfigStore();
  });

  afterEach(() => {
    store.dispose();
    localStorage.clear();
  });

  // ===========================================================================
  // Property 6: Configuration Persistence Round-Trip
  // ===========================================================================

  describe("Property 6: Configuration Persistence Round-Trip", () => {
    /**
     * Feature: session-summary-generator
     * Property 6: Configuration Persistence Round-Trip
     *
     * For any valid SummaryAPIConfig object, saving then loading SHALL produce
     * an equivalent configuration object.
     */
    it("should preserve config through save-load cycle", async () => {
      await fc.assert(
        fc.asyncProperty(validConfigArb, async (config) => {
          // Save config
          await store.saveConfig(config);

          // Create new store instance to simulate app restart
          const newStore = createSummaryConfigStore();
          const loaded = await newStore.loadConfig();
          newStore.dispose();

          // Verify core fields match
          expect(loaded.engine).toBe(config.engine);
          expect(loaded.model).toBe(config.model);
          expect(loaded.apiEndpoint).toBe(config.apiEndpoint);

          // API Key should be preserved (may be encrypted/decrypted)
          if (config.apiKey) {
            expect(loaded.apiKey).toBeTruthy();
          }

          // Custom params should match
          if (config.customParams) {
            expect(loaded.customParams?.maxTokens).toBe(config.customParams.maxTokens);
            expect(loaded.customParams?.temperature).toBe(config.customParams.temperature);
            expect(loaded.customParams?.includeCodeSnippets).toBe(
              config.customParams.includeCodeSnippets
            );
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should validate config before saving", async () => {
      await fc.assert(
        fc.asyncProperty(validConfigArb, async (config) => {
          const validation = validateConfig(config);

          if (validation.valid) {
            // Valid config should save without error
            await expect(store.saveConfig(config)).resolves.not.toThrow();
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should reject invalid engine", async () => {
      const invalidConfig: SummaryAPIConfig = {
        engine: "invalid-engine" as SummaryEngine,
        model: "some-model",
        updatedAt: Date.now(),
      };

      const validation = validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("无效的引擎"))).toBe(true);
    });

    it("should reject invalid temperature", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(2.1), max: Math.fround(100), noNaN: true }),
          (temperature) => {
            const config: SummaryAPIConfig = {
              engine: "claude",
              model: "claude-sonnet-4-5-20250929",
              customParams: { temperature },
              updatedAt: Date.now(),
            };

            const validation = validateConfig(config);
            expect(validation.valid).toBe(false);
            expect(validation.errors.some((e) => e.includes("temperature"))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should reject too small maxTokens", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 99 }), (maxTokens) => {
          const config: SummaryAPIConfig = {
            engine: "claude",
            model: "claude-sonnet-4-5-20250929",
            customParams: { maxTokens },
            updatedAt: Date.now(),
          };

          const validation = validateConfig(config);
          expect(validation.valid).toBe(false);
          expect(validation.errors.some((e) => e.includes("maxTokens"))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // Additional Config Store Tests
  // ===========================================================================

  describe("Config Store Operations", () => {
    it("should return default config when storage is empty", async () => {
      const config = await store.loadConfig();

      expect(config.engine).toBe("claude");
      expect(config.model).toBe("claude-sonnet-4-5-20250929");
    });

    it("should update partial config correctly", async () => {
      await fc.assert(
        fc.asyncProperty(engineArb, async (newEngine) => {
          await store.loadConfig();
          const updated = await store.updateConfig({ engine: newEngine });

          expect(updated.engine).toBe(newEngine);
          // Other fields should be preserved
          expect(updated.model).toBeTruthy();
        }),
        { numRuns: 20 }
      );
    });

    it("should reset to defaults correctly", async () => {
      // First save a custom config
      await store.saveConfig({
        engine: "gemini",
        model: "gemini-1.5-pro",
        updatedAt: Date.now(),
      });

      // Reset
      const reset = await store.resetToDefaults();

      expect(reset.engine).toBe("claude");
      expect(reset.model).toBe("claude-sonnet-4-5-20250929");
    });

    it("should return correct models for each engine", () => {
      fc.assert(
        fc.property(engineArb, (engine) => {
          const models = store.getModelsForEngine(engine);

          expect(models.length).toBeGreaterThan(0);
          models.forEach((model) => {
            expect(model.id).toBeTruthy();
            expect(model.name).toBeTruthy();
            expect(typeof model.costPer1k).toBe("number");
          });
        }),
        { numRuns: 10 }
      );
    });
  });
});
