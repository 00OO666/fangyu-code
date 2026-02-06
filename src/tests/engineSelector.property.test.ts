/**
 * Engine Selector Property Tests
 * 
 * Property-based tests for engine selector state management
 * 
 * Feature: session-summary-generator
 * Property 3: Engine Selector State Management
 * Validates: Requirements 4.2, 4.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SummaryEngine, ENGINE_MODELS } from '@/types/summary';

// =============================================================================
// Generators
// =============================================================================

const engineArb: fc.Arbitrary<SummaryEngine> = fc.constantFrom(
    'claude',
    'codex',
    'gemini'
);

const engineAvailabilityArb: fc.Arbitrary<Record<SummaryEngine, boolean>> = fc.record({
    claude: fc.boolean(),
    codex: fc.boolean(),
    gemini: fc.boolean(),
});

// =============================================================================
// Engine Selector State Logic (extracted for testing)
// =============================================================================

interface EngineState {
    selectedEngine: SummaryEngine;
    availability: Record<SummaryEngine, boolean>;
}

function canSelectEngine(
    engine: SummaryEngine,
    availability: Record<SummaryEngine, boolean>
): boolean {
    return availability[engine] === true;
}

function selectEngine(
    state: EngineState,
    newEngine: SummaryEngine
): EngineState {
    if (!canSelectEngine(newEngine, state.availability)) {
        return state; // 不可用引擎不能选择
    }
    return {
        ...state,
        selectedEngine: newEngine,
    };
}

function getDisabledReason(
    engine: SummaryEngine,
    availability: Record<SummaryEngine, boolean>
): string | null {
    if (availability[engine]) {
        return null;
    }

    switch (engine) {
        case 'claude':
            return 'Claude Code CLI 未安装';
        case 'codex':
            return 'Codex CLI 未安装';
        case 'gemini':
            return 'Gemini CLI 未安装';
        default:
            return '未知引擎';
    }
}

// =============================================================================
// Tests
// =============================================================================

describe('Engine Selector Property Tests', () => {
    // ===========================================================================
    // Property 3: Engine Selector State Management
    // ===========================================================================

    describe('Property 3: Engine Selector State Management', () => {
        /**
         * Feature: session-summary-generator
         * Property 3: Engine Selector State Management
         * 
         * For any engine click event, the selector SHALL immediately update to show
         * the new engine as selected, and for any unavailable engine, it SHALL be
         * displayed as disabled with correct reason.
         */

        it('should select available engine immediately', () => {
            fc.assert(
                fc.property(
                    engineArb,
                    engineArb,
                    engineAvailabilityArb,
                    (currentEngine, targetEngine, availability) => {
                        const state: EngineState = {
                            selectedEngine: currentEngine,
                            availability,
                        };

                        const newState = selectEngine(state, targetEngine);

                        if (canSelectEngine(targetEngine, availability)) {
                            // 可用引擎应该被选中
                            expect(newState.selectedEngine).toBe(targetEngine);
                        } else {
                            // 不可用引擎应该保持原状态
                            expect(newState.selectedEngine).toBe(currentEngine);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should show disabled state for unavailable engines', () => {
            fc.assert(
                fc.property(
                    engineArb,
                    engineAvailabilityArb,
                    (engine, availability) => {
                        const isAvailable = canSelectEngine(engine, availability);
                        const reason = getDisabledReason(engine, availability);

                        if (isAvailable) {
                            // 可用引擎不应该有禁用原因
                            expect(reason).toBeNull();
                        } else {
                            // 不可用引擎应该有禁用原因
                            expect(reason).toBeTruthy();
                            expect(typeof reason).toBe('string');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain state when selecting same engine', () => {
            fc.assert(
                fc.property(
                    engineArb,
                    engineAvailabilityArb,
                    (engine, availability) => {
                        // 确保引擎可用
                        const availabilityWithEngine = { ...availability, [engine]: true };

                        const state: EngineState = {
                            selectedEngine: engine,
                            availability: availabilityWithEngine,
                        };

                        const newState = selectEngine(state, engine);

                        // 选择相同引擎应该保持状态
                        expect(newState.selectedEngine).toBe(engine);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    // ===========================================================================
    // Engine Models Tests
    // ===========================================================================

    describe('Engine Models', () => {
        it('should have models for all engines', () => {
            fc.assert(
                fc.property(engineArb, (engine) => {
                    const models = ENGINE_MODELS[engine];

                    expect(models).toBeDefined();
                    expect(Array.isArray(models)).toBe(true);
                    expect(models.length).toBeGreaterThan(0);
                }),
                { numRuns: 10 }
            );
        });

        it('should have valid model structure', () => {
            fc.assert(
                fc.property(engineArb, (engine) => {
                    const models = ENGINE_MODELS[engine];

                    models.forEach(model => {
                        expect(model.id).toBeTruthy();
                        expect(typeof model.id).toBe('string');
                        expect(model.name).toBeTruthy();
                        expect(typeof model.name).toBe('string');
                        expect(typeof model.costPer1k).toBe('number');
                        expect(model.costPer1k).toBeGreaterThanOrEqual(0);
                    });
                }),
                { numRuns: 10 }
            );
        });

        it('should have at least one recommended model per engine', () => {
            fc.assert(
                fc.property(engineArb, (engine) => {
                    const models = ENGINE_MODELS[engine];
                    const hasRecommended = models.some(m => m.recommended === true);

                    // 每个引擎应该有至少一个推荐模型
                    expect(hasRecommended).toBe(true);
                }),
                { numRuns: 10 }
            );
        });
    });

    // ===========================================================================
    // State Transitions
    // ===========================================================================

    describe('State Transitions', () => {
        it('should handle rapid engine switches', () => {
            fc.assert(
                fc.property(
                    fc.array(engineArb, { minLength: 1, maxLength: 10 }),
                    engineAvailabilityArb,
                    (engineSequence, availability) => {
                        let state: EngineState = {
                            selectedEngine: 'claude',
                            availability: { ...availability, claude: true }, // 确保初始引擎可用
                        };

                        // 快速切换多个引擎
                        for (const engine of engineSequence) {
                            state = selectEngine(state, engine);
                        }

                        // 最终状态应该是最后一个可用的引擎
                        const lastAvailableEngine = [...engineSequence]
                            .reverse()
                            .find(e => canSelectEngine(e, state.availability));

                        if (lastAvailableEngine) {
                            expect(state.selectedEngine).toBe(lastAvailableEngine);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
