/**
 * Engine-Model Persistence Property Tests
 * 
 * Property 2: Engine-Model Selection Persistence
 * 
 * Requirements: 3.2, 3.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { SummaryEngine, SummaryAPIConfig } from '@/types/summary';
import { ENGINE_MODELS } from '@/types/summary';

// =============================================================================
// Mock Storage
// =============================================================================

let mockStorage: Record<string, string> = {};

const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { mockStorage = {}; },
};

// =============================================================================
// 持久化逻辑模拟
// =============================================================================

const STORAGE_KEY = 'fangyu-summary-api-config';

function saveConfig(config: SummaryAPIConfig): void {
    const stored = {
        version: 1,
        config: {
            engine: config.engine,
            model: config.model,
            apiEndpoint: config.apiEndpoint,
            customParams: config.customParams,
            updatedAt: config.updatedAt,
        },
    };
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function loadConfig(): SummaryAPIConfig | null {
    const stored = mockLocalStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
        const parsed = JSON.parse(stored);
        return parsed.config;
    } catch {
        return null;
    }
}

function getModelsForEngine(engine: SummaryEngine): string[] {
    return ENGINE_MODELS[engine]?.map(m => m.id) || [];
}

// =============================================================================
// Property 2: Engine-Model Selection Persistence
// =============================================================================

describe('Property 2: Engine-Model Selection Persistence', () => {
    beforeEach(() => {
        mockStorage = {};
    });

    // 引擎生成器
    const engineArb = fc.constantFrom<SummaryEngine>('claude', 'codex', 'gemini', 'siliconflow');

    // 根据引擎生成有效模型
    const engineModelArb = engineArb.chain(engine => {
        const models = getModelsForEngine(engine);
        if (models.length === 0) {
            return fc.constant({ engine, model: 'default-model' });
        }
        return fc.constantFrom(...models).map(model => ({ engine, model }));
    });

    it('should persist engine selection across saves', () => {
        fc.assert(
            fc.property(
                engineArb,
                (engine) => {
                    const models = getModelsForEngine(engine);
                    const model = models[0] || 'default';

                    const config: SummaryAPIConfig = {
                        engine,
                        model,
                        updatedAt: Date.now(),
                    };

                    saveConfig(config);
                    const loaded = loadConfig();

                    expect(loaded).not.toBeNull();
                    expect(loaded?.engine).toBe(engine);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should persist model selection for each engine', () => {
        fc.assert(
            fc.property(
                engineModelArb,
                ({ engine, model }) => {
                    const config: SummaryAPIConfig = {
                        engine,
                        model,
                        updatedAt: Date.now(),
                    };

                    saveConfig(config);
                    const loaded = loadConfig();

                    expect(loaded).not.toBeNull();
                    expect(loaded?.engine).toBe(engine);
                    expect(loaded?.model).toBe(model);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve custom parameters', () => {
        fc.assert(
            fc.property(
                engineModelArb,
                fc.record({
                    maxTokens: fc.integer({ min: 100, max: 100000 }),
                    temperature: fc.float({ min: 0, max: 2, noNaN: true }),
                    includeCodeSnippets: fc.boolean(),
                }),
                ({ engine, model }, customParams) => {
                    const config: SummaryAPIConfig = {
                        engine,
                        model,
                        customParams,
                        updatedAt: Date.now(),
                    };

                    saveConfig(config);
                    const loaded = loadConfig();

                    expect(loaded).not.toBeNull();
                    expect(loaded?.customParams?.maxTokens).toBe(customParams.maxTokens);
                    expect(loaded?.customParams?.temperature).toBeCloseTo(customParams.temperature, 5);
                    expect(loaded?.customParams?.includeCodeSnippets).toBe(customParams.includeCodeSnippets);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle multiple sequential saves', () => {
        fc.assert(
            fc.property(
                fc.array(engineModelArb, { minLength: 2, maxLength: 10 }),
                (selections) => {
                    // 依次保存多个配置
                    for (const { engine, model } of selections) {
                        const config: SummaryAPIConfig = {
                            engine,
                            model,
                            updatedAt: Date.now(),
                        };
                        saveConfig(config);
                    }

                    // 最后一个应该被保留
                    const lastSelection = selections[selections.length - 1];
                    const loaded = loadConfig();

                    expect(loaded).not.toBeNull();
                    expect(loaded?.engine).toBe(lastSelection.engine);
                    expect(loaded?.model).toBe(lastSelection.model);
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should return null for empty storage', () => {
        mockStorage = {};
        const loaded = loadConfig();
        expect(loaded).toBeNull();
    });

    it('should handle corrupted storage gracefully', () => {
        mockLocalStorage.setItem(STORAGE_KEY, 'invalid json {{{');
        const loaded = loadConfig();
        expect(loaded).toBeNull();
    });

    it('should preserve updatedAt timestamp', () => {
        fc.assert(
            fc.property(
                engineModelArb,
                fc.integer({ min: 1000000000000, max: 2000000000000 }),
                ({ engine, model }, timestamp) => {
                    const config: SummaryAPIConfig = {
                        engine,
                        model,
                        updatedAt: timestamp,
                    };

                    saveConfig(config);
                    const loaded = loadConfig();

                    expect(loaded).not.toBeNull();
                    expect(loaded?.updatedAt).toBe(timestamp);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have valid models for each engine in ENGINE_MODELS', () => {
        const engines: SummaryEngine[] = ['claude', 'codex', 'gemini', 'siliconflow'];

        for (const engine of engines) {
            const models = ENGINE_MODELS[engine];
            expect(models).toBeDefined();
            expect(models.length).toBeGreaterThan(0);

            // 每个模型应该有必要的字段
            for (const model of models) {
                expect(model.id).toBeDefined();
                expect(model.name).toBeDefined();
                expect(model.costPer1k).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('should have at least one recommended model per engine', () => {
        const engines: SummaryEngine[] = ['claude', 'codex', 'gemini', 'siliconflow'];

        for (const engine of engines) {
            const models = ENGINE_MODELS[engine];
            const hasRecommended = models.some(m => m.recommended);
            expect(hasRecommended).toBe(true);
        }
    });
});
