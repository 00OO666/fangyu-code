/**
 * Multi-Engine Settings Service Property Tests
 * 
 * Property-based tests for the multi-engine settings system
 * 
 * Feature: settings-refactor
 * Property 1: Engine Configuration Independence
 * Validates: Requirements 1.1, 1.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
    EngineType,
    EngineSettings,
    MultiEngineSettingsStore,
    LegacyClaudeSettings,
    DEFAULT_ENGINE_SETTINGS,
    createDefaultMultiEngineSettings,
} from '../types/multiEngineSettings';

// =============================================================================
// Arbitraries
// =============================================================================

/** 生成引擎类型 */
const engineTypeArb = fc.constantFrom<EngineType>('claude-code', 'codex', 'gemini');

/** 生成两个不同的引擎类型 */
const twoDistinctEnginesArb = fc.tuple(engineTypeArb, engineTypeArb).filter(
    ([a, b]) => a !== b
);

/** 生成权限规则 */
const permissionRuleArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ':', '*', '(', ')'),
    { minLength: 1, maxLength: 20 }
);

/** 生成权限配置 */
const permissionsArb = fc.record({
    allow: fc.array(permissionRuleArb, { maxLength: 10 }),
    deny: fc.array(permissionRuleArb, { maxLength: 5 }),
});

/** 生成环境变量键 */
const envKeyArb = fc.stringOf(
    fc.constantFrom('A', 'B', 'C', 'D', 'E', '_'),
    { minLength: 1, maxLength: 20 }
);

/** 生成环境变量值 */
const envValueArb = fc.string({ minLength: 0, maxLength: 50 });

/** 生成环境变量配置 */
const envArb = fc.dictionary(envKeyArb, envValueArb, { maxKeys: 10 });

/** 生成引擎设置 */
const engineSettingsArb: fc.Arbitrary<EngineSettings> = fc.record({
    permissions: permissionsArb,
    env: envArb,
    hooks: fc.constant([]),
});

/** 生成旧版设置 */
const legacySettingsArb: fc.Arbitrary<LegacyClaudeSettings> = fc.record({
    permissions: fc.option(permissionsArb, { nil: undefined }),
    env: fc.option(envArb, { nil: undefined }),
    language: fc.option(fc.constantFrom('Chinese', 'English'), { nil: undefined }),
    showSystemInitialization: fc.option(fc.boolean(), { nil: undefined }),
    verbose: fc.option(fc.boolean(), { nil: undefined }),
});

// =============================================================================
// Mock localStorage
// =============================================================================

class MockLocalStorage {
    private store: Map<string, string> = new Map();

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

// =============================================================================
// Test Service (with injectable storage)
// =============================================================================

class TestableMultiEngineSettingsService {
    private settings: MultiEngineSettingsStore;
    private storage: MockLocalStorage;

    constructor(storage: MockLocalStorage) {
        this.settings = createDefaultMultiEngineSettings();
        this.storage = storage;
    }

    getEngineSettings(engine: EngineType): EngineSettings {
        return this.settings.engines[engine] || DEFAULT_ENGINE_SETTINGS[engine];
    }

    updateEngineSettings(engine: EngineType, settings: Partial<EngineSettings>): void {
        this.settings.engines[engine] = {
            ...this.settings.engines[engine],
            ...settings,
        };
    }

    updateEnginePermissions(engine: EngineType, permissions: { allow: string[]; deny: string[] }): void {
        if (!this.settings.engines[engine]) {
            this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
        }
        this.settings.engines[engine].permissions = permissions;
    }

    updateEngineEnv(engine: EngineType, env: Record<string, string>): void {
        if (!this.settings.engines[engine]) {
            this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
        }
        this.settings.engines[engine].env = env;
    }

    save(): void {
        this.storage.setItem('fangyu-multi-engine-settings', JSON.stringify(this.settings));
    }

    load(): void {
        const stored = this.storage.getItem('fangyu-multi-engine-settings');
        if (stored) {
            this.settings = JSON.parse(stored);
        }
    }

    getSettings(): MultiEngineSettingsStore {
        return this.settings;
    }

    migrateFromLegacy(legacy: LegacyClaudeSettings): MultiEngineSettingsStore {
        const newSettings = createDefaultMultiEngineSettings();

        if (legacy.permissions) {
            newSettings.engines['claude-code'].permissions = {
                allow: Array.isArray(legacy.permissions.allow) ? legacy.permissions.allow : [],
                deny: Array.isArray(legacy.permissions.deny) ? legacy.permissions.deny : [],
            };
        }

        if (legacy.env && typeof legacy.env === 'object') {
            newSettings.engines['claude-code'].env = {
                ...DEFAULT_ENGINE_SETTINGS['claude-code'].env,
                ...legacy.env,
            };
        }

        if (legacy.language) {
            newSettings.general.language = legacy.language;
        }
        if (typeof legacy.showSystemInitialization === 'boolean') {
            newSettings.general.showSystemInitialization = legacy.showSystemInitialization;
        }
        if (typeof legacy.verbose === 'boolean') {
            newSettings.general.verbose = legacy.verbose;
        }

        this.settings = newSettings;
        return newSettings;
    }
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Multi-Engine Settings Service Property Tests', () => {
    let storage: MockLocalStorage;
    let service: TestableMultiEngineSettingsService;

    beforeEach(() => {
        storage = new MockLocalStorage();
        service = new TestableMultiEngineSettingsService(storage);
    });

    /**
     * Property 1: Engine Configuration Independence
     * For any two different engines, saving configuration for one engine
     * SHALL NOT affect the configuration of the other engine.
     * 
     * Validates: Requirements 1.1, 1.3
     */
    describe('Property 1: Engine Configuration Independence', () => {
        it('updating one engine permissions does not affect other engines', () => {
            fc.assert(
                fc.property(
                    twoDistinctEnginesArb,
                    permissionsArb,
                    ([engine1, engine2], newPermissions) => {
                        // Get original settings for engine2
                        const originalEngine2Settings = JSON.stringify(service.getEngineSettings(engine2));

                        // Update engine1 permissions
                        service.updateEnginePermissions(engine1, newPermissions);

                        // Verify engine2 settings are unchanged
                        const currentEngine2Settings = JSON.stringify(service.getEngineSettings(engine2));
                        expect(currentEngine2Settings).toBe(originalEngine2Settings);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('updating one engine env does not affect other engines', () => {
            fc.assert(
                fc.property(
                    twoDistinctEnginesArb,
                    envArb,
                    ([engine1, engine2], newEnv) => {
                        // Get original settings for engine2
                        const originalEngine2Env = JSON.stringify(service.getEngineSettings(engine2).env);

                        // Update engine1 env
                        service.updateEngineEnv(engine1, newEnv);

                        // Verify engine2 env is unchanged
                        const currentEngine2Env = JSON.stringify(service.getEngineSettings(engine2).env);
                        expect(currentEngine2Env).toBe(originalEngine2Env);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('saving and loading preserves all engine configurations independently', () => {
            fc.assert(
                fc.property(
                    engineSettingsArb,
                    engineSettingsArb,
                    engineSettingsArb,
                    (claudeSettings, codexSettings, geminiSettings) => {
                        // Set different settings for each engine
                        service.updateEngineSettings('claude-code', claudeSettings);
                        service.updateEngineSettings('codex', codexSettings);
                        service.updateEngineSettings('gemini', geminiSettings);

                        // Save and reload
                        service.save();
                        const newService = new TestableMultiEngineSettingsService(storage);
                        newService.load();

                        // Verify each engine's settings are preserved
                        expect(newService.getEngineSettings('claude-code').permissions).toEqual(claudeSettings.permissions);
                        expect(newService.getEngineSettings('codex').permissions).toEqual(codexSettings.permissions);
                        expect(newService.getEngineSettings('gemini').permissions).toEqual(geminiSettings.permissions);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    /**
     * Property 7: Settings Migration Preservation
     * For any valid legacy settings file, migration SHALL preserve all existing
     * configuration values and set Claude Code as the default engine.
     * 
     * Validates: Requirements 6.1, 6.2
     */
    describe('Property 7: Settings Migration Preservation', () => {
        it('migration preserves legacy permissions', () => {
            fc.assert(
                fc.property(
                    permissionsArb,
                    (permissions) => {
                        const legacy: LegacyClaudeSettings = { permissions };
                        const migrated = service.migrateFromLegacy(legacy);

                        expect(migrated.engines['claude-code'].permissions.allow).toEqual(permissions.allow);
                        expect(migrated.engines['claude-code'].permissions.deny).toEqual(permissions.deny);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('migration preserves legacy env variables', () => {
            fc.assert(
                fc.property(
                    envArb,
                    (env) => {
                        const legacy: LegacyClaudeSettings = { env };
                        const migrated = service.migrateFromLegacy(legacy);

                        // All legacy env vars should be present
                        for (const [key, value] of Object.entries(env)) {
                            expect(migrated.engines['claude-code'].env[key]).toBe(value);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('migration sets claude-code as default engine', () => {
            fc.assert(
                fc.property(
                    legacySettingsArb,
                    (legacy) => {
                        const migrated = service.migrateFromLegacy(legacy);
                        expect(migrated.activeEngine).toBe('claude-code');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('migration preserves general settings', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('Chinese', 'English'),
                    fc.boolean(),
                    (language, verbose) => {
                        const legacy: LegacyClaudeSettings = { language, verbose };
                        const migrated = service.migrateFromLegacy(legacy);

                        expect(migrated.general.language).toBe(language);
                        expect(migrated.general.verbose).toBe(verbose);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 9: Engine Default Initialization
     * For any newly created engine configuration, the Settings_System SHALL
     * populate it with the appropriate default values for that engine type.
     * 
     * Validates: Requirements 7.1, 7.2, 7.3
     */
    describe('Property 9: Engine Default Initialization', () => {
        it('new settings have default values for all engines', () => {
            fc.assert(
                fc.property(
                    engineTypeArb,
                    (engine) => {
                        const newService = new TestableMultiEngineSettingsService(new MockLocalStorage());
                        const settings = newService.getEngineSettings(engine);

                        // Should have default permissions
                        expect(settings.permissions).toBeDefined();
                        expect(Array.isArray(settings.permissions.allow)).toBe(true);
                        expect(Array.isArray(settings.permissions.deny)).toBe(true);

                        // Should have default env
                        expect(settings.env).toBeDefined();
                        expect(typeof settings.env).toBe('object');

                        // Should have hooks array
                        expect(Array.isArray(settings.hooks)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('claude-code has anthropic-specific default env vars', () => {
            const newService = new TestableMultiEngineSettingsService(new MockLocalStorage());
            const settings = newService.getEngineSettings('claude-code');

            expect('ANTHROPIC_API_KEY' in settings.env || 'ANTHROPIC_BASE_URL' in settings.env).toBe(true);
        });

        it('codex has openai-specific default env vars', () => {
            const newService = new TestableMultiEngineSettingsService(new MockLocalStorage());
            const settings = newService.getEngineSettings('codex');

            expect('OPENAI_API_KEY' in settings.env || 'OPENAI_BASE_URL' in settings.env).toBe(true);
        });

        it('gemini has google-specific default env vars', () => {
            const newService = new TestableMultiEngineSettingsService(new MockLocalStorage());
            const settings = newService.getEngineSettings('gemini');

            expect('GOOGLE_API_KEY' in settings.env || 'GOOGLE_BASE_URL' in settings.env).toBe(true);
        });
    });
});
