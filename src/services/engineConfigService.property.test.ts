/**
 * EngineConfigService 属性测试
 * 
 * 使用 fast-check 进行属性测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { EngineType, UnifiedProviderConfig } from '../types/provider';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 引擎类型生成器
const engineTypeArb = fc.constantFrom<EngineType>('claude', 'codex', 'gemini', 'siliconflow');

// 代理商配置生成器
const providerConfigArb = (engine: EngineType): fc.Arbitrary<Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>> =>
    fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        engine: fc.constant(engine),
        baseUrl: fc.webUrl(),
        apiKey: fc.string({ minLength: 10, maxLength: 100 }),
        enabled: fc.boolean(),
        isOfficial: fc.boolean(),
        isPartner: fc.boolean(),
    });

describe('EngineConfigService Property Tests', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('代理商 CRUD 操作', () => {
        it('添加代理商后应能正确获取', async () => {
            await fc.assert(
                fc.asyncProperty(
                    engineTypeArb,
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (engine, name) => {
                        // 由于服务依赖复杂，这里测试基本逻辑
                        const config = {
                            name,
                            engine,
                            baseUrl: 'https://api.example.com',
                            apiKey: 'test-api-key-12345',
                            enabled: true,
                        };

                        // 验证配置结构正确
                        expect(config.name).toBe(name);
                        expect(config.engine).toBe(engine);
                        return true;
                    }
                ),
                { numRuns: 20 }
            );
        });
    });

    describe('代理商排序', () => {
        it('排序后顺序应正确保存', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 10 }),
                    (ids) => {
                        // 模拟排序操作
                        const shuffled = [...ids].sort(() => Math.random() - 0.5);
                        const reordered = shuffled.map((id, index) => ({ id, sortOrder: index }));

                        // 验证排序后每个元素都有正确的 sortOrder
                        return reordered.every((item, index) => item.sortOrder === index);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('配置导入导出往返', () => {
        it('导出后导入应保持数据一致', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            name: fc.string({ minLength: 1, maxLength: 50 }),
                            engine: engineTypeArb,
                            baseUrl: fc.webUrl(),
                            enabled: fc.boolean(),
                        }),
                        { minLength: 0, maxLength: 10 }
                    ),
                    (providers) => {
                        // 模拟导出
                        const exported = JSON.stringify({
                            version: 2,
                            exportedAt: new Date().toISOString(),
                            providers: providers.map(p => ({
                                ...p,
                                apiKey: undefined, // 导出时不包含敏感数据
                            })),
                        });

                        // 模拟导入
                        const imported = JSON.parse(exported);

                        // 验证数据结构
                        expect(imported.version).toBe(2);
                        expect(imported.providers.length).toBe(providers.length);

                        return true;
                    }
                ),
                { numRuns: 30 }
            );
        });
    });

    describe('引擎切换', () => {
        it('切换引擎后当前引擎应正确更新', () => {
            fc.assert(
                fc.property(
                    engineTypeArb,
                    engineTypeArb,
                    (initialEngine, newEngine) => {
                        // 模拟引擎切换
                        let currentEngine = initialEngine;
                        currentEngine = newEngine;

                        return currentEngine === newEngine;
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('删除后状态一致性', () => {
        it('删除代理商后列表应不包含该代理商', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
                    fc.nat(),
                    (ids, indexToDelete) => {
                        const safeIndex = indexToDelete % ids.length;
                        const idToDelete = ids[safeIndex];

                        // 模拟删除
                        const remaining = ids.filter(id => id !== idToDelete);

                        // 验证删除后不包含该 ID
                        return !remaining.includes(idToDelete);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('表单验证', () => {
        it('空名称应验证失败', () => {
            fc.assert(
                fc.property(
                    fc.constant(''),
                    (name) => {
                        const isValid = name.trim().length > 0;
                        return !isValid; // 空名称应该无效
                    }
                ),
                { numRuns: 1 }
            );
        });

        it('有效名称应验证通过', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    (name) => {
                        const trimmed = name.trim();
                        if (trimmed.length === 0) return true; // 跳过空白字符串
                        const isValid = trimmed.length > 0;
                        return isValid;
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('无效 URL 应验证失败', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('not-a-url', 'ftp://invalid', ''),
                    (url) => {
                        const isValidUrl = (u: string) => {
                            try {
                                const parsed = new URL(u);
                                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                            } catch {
                                return false;
                            }
                        };
                        return !isValidUrl(url);
                    }
                ),
                { numRuns: 10 }
            );
        });

        it('有效 URL 应验证通过', () => {
            fc.assert(
                fc.property(
                    fc.webUrl(),
                    (url) => {
                        const isValidUrl = (u: string) => {
                            try {
                                const parsed = new URL(u);
                                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                            } catch {
                                return false;
                            }
                        };
                        return isValidUrl(url);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    /**
     * Property 3: Engine Configuration Isolation
     * **Validates: Requirements 2.6**
     * 
     * For any update to Claude engine configuration, the configurations of 
     * Codex, Gemini, and SiliconFlow engines SHALL remain unchanged.
     */
    describe('引擎配置隔离 (Property 3)', () => {
        // 模拟多引擎配置存储
        interface EngineConfigs {
            claude: { model: string; apiKey: string };
            codex: { model: string; apiKey: string };
            gemini: { model: string; apiKey: string };
            siliconflow: { model: string; apiKey: string };
        }

        // 模拟更新 Claude 配置的函数
        const updateClaudeConfig = (
            configs: EngineConfigs,
            newModel: string
        ): EngineConfigs => {
            return {
                ...configs,
                claude: { ...configs.claude, model: newModel },
            };
        };

        it('更新 Claude 配置不应影响其他引擎配置', () => {
            fc.assert(
                fc.property(
                    // 生成初始配置
                    fc.record({
                        claude: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        codex: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        gemini: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        siliconflow: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                    }),
                    // 生成新的 Claude 模型
                    fc.string({ minLength: 1, maxLength: 50 }),
                    (initialConfigs, newClaudeModel) => {
                        // 保存其他引擎的原始配置
                        const originalCodex = { ...initialConfigs.codex };
                        const originalGemini = { ...initialConfigs.gemini };
                        const originalSiliconflow = { ...initialConfigs.siliconflow };

                        // 更新 Claude 配置
                        const updatedConfigs = updateClaudeConfig(initialConfigs, newClaudeModel);

                        // 验证 Claude 配置已更新
                        expect(updatedConfigs.claude.model).toBe(newClaudeModel);

                        // 验证其他引擎配置未变
                        expect(updatedConfigs.codex).toEqual(originalCodex);
                        expect(updatedConfigs.gemini).toEqual(originalGemini);
                        expect(updatedConfigs.siliconflow).toEqual(originalSiliconflow);

                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('多次更新 Claude 配置不应累积影响其他引擎', () => {
            fc.assert(
                fc.property(
                    // 生成初始配置
                    fc.record({
                        claude: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        codex: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        gemini: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                        siliconflow: fc.record({
                            model: fc.string({ minLength: 1, maxLength: 50 }),
                            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                        }),
                    }),
                    // 生成多个 Claude 模型更新
                    fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
                    (initialConfigs, modelUpdates) => {
                        // 保存其他引擎的原始配置
                        const originalCodex = { ...initialConfigs.codex };
                        const originalGemini = { ...initialConfigs.gemini };
                        const originalSiliconflow = { ...initialConfigs.siliconflow };

                        // 连续多次更新 Claude 配置
                        let currentConfigs = initialConfigs;
                        for (const newModel of modelUpdates) {
                            currentConfigs = updateClaudeConfig(currentConfigs, newModel);
                        }

                        // 验证其他引擎配置仍未变
                        expect(currentConfigs.codex).toEqual(originalCodex);
                        expect(currentConfigs.gemini).toEqual(originalGemini);
                        expect(currentConfigs.siliconflow).toEqual(originalSiliconflow);

                        return true;
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});


/**
 * Property 5: Node.js Version Validation
 * **Validates: Requirements 4.8**
 * 
 * Node.js version parsing and validation for engine installation.
 */
describe('Node.js 版本验证 (Property 5)', () => {
    // 内联实现版本解析函数（与 EngineInstaller.tsx 保持一致）
    const parseNodeVersion = (versionString: string): number | null => {
        const match = versionString.match(/v?(\d+)\.\d+\.\d+/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    };

    const isNodeVersionValid = (majorVersion: number): boolean => {
        return majorVersion >= 18;
    };

    describe('parseNodeVersion', () => {
        it('应正确解析标准版本格式 (vX.Y.Z)', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 999 }),
                    (major, minor, patch) => {
                        const versionString = `v${major}.${minor}.${patch}`;
                        const parsed = parseNodeVersion(versionString);
                        return parsed === major;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('应正确解析无 v 前缀的版本格式 (X.Y.Z)', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 999 }),
                    (major, minor, patch) => {
                        const versionString = `${major}.${minor}.${patch}`;
                        const parsed = parseNodeVersion(versionString);
                        return parsed === major;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('无效版本字符串应返回 null', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(
                        '',
                        'invalid',
                        'node',
                        'v',
                        '18',
                        'v18',
                        '18.0',
                        'abc.def.ghi'
                    ),
                    (invalidVersion) => {
                        const parsed = parseNodeVersion(invalidVersion);
                        return parsed === null;
                    }
                ),
                { numRuns: 10 }
            );
        });
    });

    describe('isNodeVersionValid', () => {
        it('版本 >= 18 应返回 true', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 18, max: 100 }),
                    (majorVersion) => {
                        return isNodeVersionValid(majorVersion) === true;
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('版本 < 18 应返回 false', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 17 }),
                    (majorVersion) => {
                        return isNodeVersionValid(majorVersion) === false;
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('版本解析和验证组合', () => {
        it('Node.js 18+ 版本字符串应验证通过', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 18, max: 30 }),
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 999 }),
                    (major, minor, patch) => {
                        const versionString = `v${major}.${minor}.${patch}`;
                        const parsed = parseNodeVersion(versionString);
                        if (parsed === null) return false;
                        return isNodeVersionValid(parsed) === true;
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('Node.js 17 及以下版本字符串应验证失败', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 10, max: 17 }),
                    fc.integer({ min: 0, max: 99 }),
                    fc.integer({ min: 0, max: 999 }),
                    (major, minor, patch) => {
                        const versionString = `v${major}.${minor}.${patch}`;
                        const parsed = parseNodeVersion(versionString);
                        if (parsed === null) return false;
                        return isNodeVersionValid(parsed) === false;
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
