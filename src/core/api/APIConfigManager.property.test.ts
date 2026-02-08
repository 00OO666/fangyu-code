/**
 * APIConfigManager 属性测试
 *
 * Property 6: 多提供商路由正确性
 *
 * Validates: Requirements 2.4, 2.5, 2.6
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  APIConfigManager,
  APIProvider,
  ProviderConfig,
  createAPIConfigManager,
  getProviderDisplayName,
  getSupportedProviders,
} from "./APIConfigManager";

// =============================================================================
// 测试生成器
// =============================================================================

/** 生成提供商类型 */
const providerArb: fc.Arbitrary<APIProvider> = fc.constantFrom(
  "hiapi",
  "openai",
  "anthropic",
  "google",
  "azure",
  "custom"
);

/** 生成 API 密钥 */
const apiKeyArb = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"), {
    minLength: 20,
    maxLength: 64,
  })
  .map((s) => `sk-${s}`);

/** 生成 Base URL */
const baseUrlArb = fc.constantFrom(
  "https://api.hiapi.online/v1",
  "https://api.openai.com/v1",
  "https://api.anthropic.com/v1",
  "https://custom-api.example.com/v1"
);

/** 生成部分提供商配置 */
const partialConfigArb: fc.Arbitrary<Partial<ProviderConfig>> = fc.record({
  apiKey: fc.option(apiKeyArb, { nil: undefined }),
  baseUrl: fc.option(baseUrlArb, { nil: undefined }),
  enabled: fc.option(fc.boolean(), { nil: undefined }),
  priority: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  timeout: fc.option(fc.integer({ min: 5000, max: 60000 }), { nil: undefined }),
});

/** 生成模型名称 */
const modelArb = fc.constantFrom("gpt-4o", "gpt-4-turbo", "claude-3.5-sonnet", "gemini-2.5-pro");

// =============================================================================
// Property 6: 多提供商路由正确性
// Validates: Requirements 2.4, 2.5, 2.6
// =============================================================================

describe("APIConfigManager Property Tests", () => {
  describe("Property 6: 多提供商路由正确性", () => {
    let manager: APIConfigManager;

    beforeEach(() => {
      manager = new APIConfigManager();
    });

    it("配置提供商后应能正确获取配置", () => {
      fc.assert(
        fc.property(providerArb, apiKeyArb, (provider, apiKey) => {
          manager.configureProvider(provider, { apiKey, enabled: true });

          const config = manager.getProviderConfig(provider);

          expect(config).toBeDefined();
          expect(config?.apiKey).toBe(apiKey);
          expect(config?.provider).toBe(provider);
        }),
        { numRuns: 50 }
      );
    });

    it("启用的提供商应按优先级排序", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              provider: providerArb,
              priority: fc.integer({ min: 1, max: 10 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          apiKeyArb,
          (configs, apiKey) => {
            // 配置多个提供商
            for (const { provider, priority } of configs) {
              manager.configureProvider(provider, {
                apiKey,
                enabled: true,
                priority,
              });
            }

            const enabled = manager.getEnabledProviders();

            // 应该按优先级排序
            for (let i = 1; i < enabled.length; i++) {
              expect(enabled[i].priority).toBeGreaterThanOrEqual(enabled[i - 1].priority);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("禁用提供商后不应出现在启用列表中", () => {
      fc.assert(
        fc.property(providerArb, apiKeyArb, (provider, apiKey) => {
          manager.configureProvider(provider, { apiKey, enabled: true });
          manager.disableProvider(provider);

          const enabled = manager.getEnabledProviders();
          const found = enabled.find((c) => c.provider === provider);

          expect(found).toBeUndefined();
        }),
        { numRuns: 50 }
      );
    });

    it("设置活动提供商应正确切换", () => {
      fc.assert(
        fc.property(providerArb, apiKeyArb, (provider, apiKey) => {
          manager.configureProvider(provider, { apiKey, enabled: true });
          manager.setActiveProvider(provider);

          expect(manager.getActiveProvider()).toBe(provider);
        }),
        { numRuns: 50 }
      );
    });

    it("未配置的提供商不能设为活动", () => {
      fc.assert(
        fc.property(providerArb, (provider) => {
          // 不配置 API 密钥
          manager.configureProvider(provider, { enabled: false });

          expect(() => manager.setActiveProvider(provider)).toThrow();
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 配置持久化属性测试
  // ===========================================================================

  describe("配置持久化属性测试", () => {
    it("导出后导入应保持配置一致（不含 API 密钥）", () => {
      fc.assert(
        fc.property(providerArb, apiKeyArb, modelArb, (provider, apiKey, defaultModel) => {
          const manager1 = new APIConfigManager();

          // 配置一个提供商
          manager1.configureProvider(provider, { apiKey, enabled: true });
          manager1.setDefaultModel(defaultModel);

          // 导出（注意：exportConfig 出于安全考虑不导出 apiKey）
          const exported = manager1.exportConfig();

          // 验证导出格式正确
          expect(exported.defaultModel).toBe(defaultModel);
          expect(exported.providers[provider].hasApiKey).toBe(true);
          expect(exported.providers[provider].enabled).toBe(true);

          // 导入到新管理器
          const manager2 = new APIConfigManager();
          manager2.importConfig(exported);

          // 验证非敏感配置一致
          expect(manager2.getDefaultModel()).toBe(defaultModel);

          const config = manager2.getProviderConfig(provider);
          // API 密钥不会通过 export/import 传递（安全设计）
          // 实际使用中，API 密钥通过 secureStorage 单独存储和加载
          expect(config?.enabled).toBe(true);
          expect(config?.provider).toBe(provider);
        }),
        { numRuns: 30 }
      );
    });
  });

  // ===========================================================================
  // 默认配置属性测试
  // ===========================================================================

  describe("默认配置属性测试", () => {
    it("所有支持的提供商应有默认配置", () => {
      const manager = new APIConfigManager();
      const providers = getSupportedProviders();

      for (const provider of providers) {
        const config = manager.getProviderConfig(provider);
        expect(config).toBeDefined();
        expect(config?.provider).toBe(provider);
        expect(config?.baseUrl).toBeDefined();
      }
    });

    it("每个提供商应有显示名称", () => {
      const providers = getSupportedProviders();

      for (const provider of providers) {
        const name = getProviderDisplayName(provider);
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it("reset 应恢复默认配置", () => {
      fc.assert(
        fc.property(providerArb, apiKeyArb, (provider, apiKey) => {
          const manager = new APIConfigManager();

          // 修改配置
          manager.configureProvider(provider, { apiKey, enabled: true });
          manager.setDefaultModel("custom-model");

          // 重置
          manager.reset();

          // 验证恢复默认
          expect(manager.getDefaultModel()).toBe("gpt-4o");
          expect(manager.getActiveProvider()).toBe("hiapi");

          const config = manager.getProviderConfig(provider);
          expect(config?.apiKey).toBe("");
        }),
        { numRuns: 30 }
      );
    });
  });

  // ===========================================================================
  // 模型配置属性测试
  // ===========================================================================

  describe("模型配置属性测试", () => {
    it("每个提供商应有支持的模型列表", () => {
      const manager = new APIConfigManager();
      const providers: APIProvider[] = ["hiapi", "openai", "anthropic", "google"];

      for (const provider of providers) {
        const models = manager.getProviderModels(provider);
        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
      }
    });

    it("设置默认模型应正确保存", () => {
      fc.assert(
        fc.property(modelArb, (model) => {
          const manager = new APIConfigManager();
          manager.setDefaultModel(model);

          expect(manager.getDefaultModel()).toBe(model);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // 工具函数属性测试
  // ===========================================================================

  describe("工具函数属性测试", () => {
    it("createAPIConfigManager 应创建有效的管理器", () => {
      const manager = createAPIConfigManager();

      expect(manager).toBeInstanceOf(APIConfigManager);
      expect(manager.getActiveProvider()).toBe("hiapi");
    });

    it("getSupportedProviders 应返回所有提供商", () => {
      const providers = getSupportedProviders();

      expect(providers).toContain("hiapi");
      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
      expect(providers).toContain("google");
      expect(providers).toContain("azure");
      expect(providers).toContain("custom");
    });
  });

  // ===========================================================================
  // 客户端管理属性测试
  // ===========================================================================

  describe("客户端管理属性测试", () => {
    it("配置 API 密钥后应创建客户端", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("hiapi", "openai") as fc.Arbitrary<APIProvider>,
          apiKeyArb,
          (provider, apiKey) => {
            const manager = new APIConfigManager();
            manager.configureProvider(provider, { apiKey, enabled: true });

            const client = manager.getClient(provider);
            expect(client).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it("禁用提供商后应移除客户端", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("hiapi", "openai") as fc.Arbitrary<APIProvider>,
          apiKeyArb,
          (provider, apiKey) => {
            const manager = new APIConfigManager();
            manager.configureProvider(provider, { apiKey, enabled: true });
            manager.disableProvider(provider);

            const client = manager.getClient(provider);
            expect(client).toBeUndefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it("活动客户端应与活动提供商匹配", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("hiapi", "openai") as fc.Arbitrary<APIProvider>,
          apiKeyArb,
          (provider, apiKey) => {
            const manager = new APIConfigManager();
            manager.configureProvider(provider, { apiKey, enabled: true });
            manager.setActiveProvider(provider);

            const activeClient = manager.getActiveClient();
            const providerClient = manager.getClient(provider);

            expect(activeClient).toBe(providerClient);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
