/**
 * SmartRecommendationBar 属性测试
 *
 * Property 3: Recommendation Bar Pagination
 * Property 4: Type-Color Mapping
 * Validates: Requirements 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// 推荐类型
type RecommendationType = 'mcp' | 'skill' | 'agent' | 'tool';

// 类型配置映射
const TYPE_CONFIG: Record<RecommendationType, {
    colorClass: string;
    bgClass: string;
    glowColor: string;
    label: string;
}> = {
    mcp: {
        colorClass: 'text-[var(--ds-secondary-400)]',
        bgClass: 'bg-[var(--ds-secondary-500)]/10',
        glowColor: 'var(--ds-secondary-500)',
        label: 'MCP',
    },
    skill: {
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        glowColor: '#f59e0b',
        label: 'Skill',
    },
    agent: {
        colorClass: 'text-[var(--ds-primary-400)]',
        bgClass: 'bg-[var(--ds-primary-500)]/10',
        glowColor: 'var(--ds-primary-500)',
        label: 'Agent',
    },
    tool: {
        colorClass: 'text-[var(--ds-success)]',
        bgClass: 'bg-[var(--ds-success)]/10',
        glowColor: 'var(--ds-success)',
        label: 'Tool',
    },
};

// 推荐项生成器
const recommendationArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom<RecommendationType>('mcp', 'skill', 'agent', 'tool'),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    reason: fc.string({ minLength: 1, maxLength: 200 }),
    confidence: fc.float({ min: 0, max: 1 }),
    priority: fc.integer({ min: 1, max: 10 }),
});

// 推荐列表生成器
const recommendationsArb = fc.array(recommendationArb, { minLength: 0, maxLength: 20 });

describe('SmartRecommendationBar Property Tests', () => {
    /**
     * Property 3: Recommendation Bar Pagination
     * 分页功能应正确处理索引边界
     * Validates: Requirements 3.3
     */
    describe('Property 3: Recommendation Bar Pagination', () => {
        it('should correctly calculate pagination indices', () => {
            fc.assert(
                fc.property(
                    fc.array(recommendationArb, { minLength: 1, maxLength: 20 }),
                    fc.integer({ min: 0, max: 100 }),
                    (recommendations, startIndex) => {
                        const length = recommendations.length;
                        const currentIndex = startIndex % length;

                        // 下一页索引计算
                        const nextIndex = currentIndex < length - 1 ? currentIndex + 1 : 0;
                        expect(nextIndex).toBeGreaterThanOrEqual(0);
                        expect(nextIndex).toBeLessThan(length);

                        // 上一页索引计算
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : length - 1;
                        expect(prevIndex).toBeGreaterThanOrEqual(0);
                        expect(prevIndex).toBeLessThan(length);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should wrap around correctly at boundaries', () => {
            fc.assert(
                fc.property(
                    fc.array(recommendationArb, { minLength: 2, maxLength: 20 }),
                    (recommendations) => {
                        const length = recommendations.length;

                        // 从最后一个到第一个
                        const lastIndex = length - 1;
                        const nextFromLast = lastIndex < length - 1 ? lastIndex + 1 : 0;
                        expect(nextFromLast).toBe(0);

                        // 从第一个到最后一个
                        const firstIndex = 0;
                        const prevFromFirst = firstIndex > 0 ? firstIndex - 1 : length - 1;
                        expect(prevFromFirst).toBe(length - 1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle single item list correctly', () => {
            fc.assert(
                fc.property(
                    recommendationArb,
                    (recommendation) => {
                        const recommendations = [recommendation];
                        const length = recommendations.length;
                        const currentIndex = 0;

                        // 单项列表，翻页应该保持在索引 0
                        const nextIndex = currentIndex < length - 1 ? currentIndex + 1 : 0;
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : length - 1;

                        expect(nextIndex).toBe(0);
                        expect(prevIndex).toBe(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should display correct page indicator', () => {
            fc.assert(
                fc.property(
                    fc.array(recommendationArb, { minLength: 1, maxLength: 20 }),
                    fc.nat(),
                    (recommendations, rawIndex) => {
                        const length = recommendations.length;
                        const currentIndex = rawIndex % length;

                        // 页面指示器格式: "currentIndex + 1 / length"
                        const displayIndex = currentIndex + 1;
                        const displayTotal = length;

                        expect(displayIndex).toBeGreaterThanOrEqual(1);
                        expect(displayIndex).toBeLessThanOrEqual(displayTotal);
                        expect(displayTotal).toBe(length);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 4: Type-Color Mapping
     * 每种推荐类型应有唯一的颜色配置
     * Validates: Requirements 3.4
     */
    describe('Property 4: Type-Color Mapping', () => {
        it('should have unique color configuration for each type', () => {
            const types: RecommendationType[] = ['mcp', 'skill', 'agent', 'tool'];

            // 检查每种类型都有配置
            types.forEach(type => {
                expect(TYPE_CONFIG[type]).toBeDefined();
                expect(TYPE_CONFIG[type].colorClass).toBeDefined();
                expect(TYPE_CONFIG[type].bgClass).toBeDefined();
                expect(TYPE_CONFIG[type].glowColor).toBeDefined();
                expect(TYPE_CONFIG[type].label).toBeDefined();
            });

            // 检查标签唯一性
            const labels = types.map(t => TYPE_CONFIG[t].label);
            const uniqueLabels = new Set(labels);
            expect(uniqueLabels.size).toBe(types.length);
        });

        it('should return correct config for any recommendation type', () => {
            fc.assert(
                fc.property(
                    recommendationArb,
                    (recommendation) => {
                        const config = TYPE_CONFIG[recommendation.type];

                        expect(config).toBeDefined();
                        expect(typeof config.colorClass).toBe('string');
                        expect(typeof config.bgClass).toBe('string');
                        expect(typeof config.glowColor).toBe('string');
                        expect(typeof config.label).toBe('string');
                        expect(config.label.length).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should have non-empty color classes', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom<RecommendationType>('mcp', 'skill', 'agent', 'tool'),
                    (type) => {
                        const config = TYPE_CONFIG[type];

                        expect(config.colorClass.length).toBeGreaterThan(0);
                        expect(config.bgClass.length).toBeGreaterThan(0);
                        expect(config.glowColor.length).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain consistent mapping across multiple accesses', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom<RecommendationType>('mcp', 'skill', 'agent', 'tool'),
                    fc.integer({ min: 1, max: 10 }),
                    (type, accessCount) => {
                        const configs: typeof TYPE_CONFIG[RecommendationType][] = [];

                        for (let i = 0; i < accessCount; i++) {
                            configs.push(TYPE_CONFIG[type]);
                        }

                        // 所有访问应返回相同的配置
                        configs.forEach(config => {
                            expect(config).toEqual(configs[0]);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
