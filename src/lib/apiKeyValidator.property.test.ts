/**
 * API 密钥验证器属性测试
 *
 * **Property 8: API 密钥格式验证**
 * **Validates: Requirements 7.3**
 *
 * 对于任何 API 密钥输入，系统应该根据提供商类型验证格式：
 * - Claude: 以 `sk-ant-` 开头，总长度 100-200
 * - OpenAI: 以 `sk-` 开头（非 sk-ant-），总长度 40-100
 * - Gemini: 以 `AI` 开头，总长度 35-60
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAPIKey,
  detectProvider,
  getProviderDisplayName,
  quickValidateAPIKey,
  getSupportedProviders,
} from './apiKeyValidator';
import type { APIKeyProvider } from './secureStorage';

// 定义字符集
const alphanumericChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const alphanumericWithSpecialChars = alphanumericChars + '_-';

// 生成有效的 API 密钥（符合验证规则的长度要求）
// Claude: minLength=100, maxLength=200, prefix='sk-ant-' (7 chars)
const validClaudeKey = fc
  .stringOf(fc.constantFrom(...alphanumericWithSpecialChars.split('')), {
    minLength: 93, // 100 - 7 = 93
    maxLength: 150,
  })
  .map((s) => `sk-ant-${s}`);

// OpenAI: minLength=40, maxLength=100, prefix='sk-' (3 chars)
const validOpenAIKey = fc
  .stringOf(fc.constantFrom(...alphanumericChars.split('')), {
    minLength: 37, // 40 - 3 = 37
    maxLength: 60,
  })
  .map((s) => `sk-${s}`);

// Gemini: minLength=35, maxLength=60, prefix='AI' (2 chars)
const validGeminiKey = fc
  .stringOf(fc.constantFrom(...alphanumericWithSpecialChars.split('')), {
    minLength: 33, // 35 - 2 = 33
    maxLength: 50,
  })
  .map((s) => `AI${s}`);


describe('API Key Validator Property Tests', () => {
  describe('Property 8: API 密钥格式验证', () => {
    it('Claude 密钥应以 sk-ant- 开头', () => {
      fc.assert(
        fc.property(validClaudeKey, (key) => {
          const result = validateAPIKey(key, 'claude');
          expect(result.detectedProvider).toBe('claude');
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('OpenAI 密钥应以 sk- 开头（但不是 sk-ant-）', () => {
      fc.assert(
        fc.property(validOpenAIKey, (key) => {
          const result = validateAPIKey(key, 'openai');
          expect(result.detectedProvider).toBe('openai');
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Gemini 密钥应以 AI 开头', () => {
      fc.assert(
        fc.property(validGeminiKey, (key) => {
          const result = validateAPIKey(key, 'gemini');
          expect(result.detectedProvider).toBe('gemini');
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('不符合任何已知格式的密钥应返回 unknown', () => {
      const invalidPrefixes = ['abc-', 'xyz-', 'test-', 'key-', '123-'];

      fc.assert(
        fc.property(
          fc.constantFrom(...invalidPrefixes),
          fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 30, maxLength: 50 }),
          (prefix, suffix) => {
            const key = `${prefix}${suffix}`;
            const result = validateAPIKey(key);
            expect(result.detectedProvider).toBe('unknown');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('detectProvider 函数', () => {
    it('应正确检测 Claude 密钥', () => {
      fc.assert(
        fc.property(validClaudeKey, (key) => {
          expect(detectProvider(key)).toBe('claude');
        }),
        { numRuns: 50 }
      );
    });

    it('应正确检测 OpenAI 密钥', () => {
      fc.assert(
        fc.property(validOpenAIKey, (key) => {
          expect(detectProvider(key)).toBe('openai');
        }),
        { numRuns: 50 }
      );
    });

    it('应正确检测 Gemini 密钥', () => {
      fc.assert(
        fc.property(validGeminiKey, (key) => {
          expect(detectProvider(key)).toBe('gemini');
        }),
        { numRuns: 50 }
      );
    });

  });


  describe('验证结果结构', () => {
    it('验证结果应包含所有必要字段', () => {
      fc.assert(
        fc.property(fc.string(), (key) => {
          const result = validateAPIKey(key);

          expect(result).toHaveProperty('isValid');
          expect(result).toHaveProperty('detectedProvider');
          expect(result).toHaveProperty('errors');
          expect(result).toHaveProperty('warnings');

          expect(typeof result.isValid).toBe('boolean');
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.warnings)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('无效密钥应返回错误信息', () => {
      const invalidKeys = ['', ' ', 'short', 'invalid!@#$%'];

      fc.assert(
        fc.property(fc.constantFrom(...invalidKeys), (key) => {
          const result = validateAPIKey(key);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('quickValidateAPIKey 函数', () => {
    it('有效密钥应通过快速验证', () => {
      fc.assert(
        fc.property(
          fc.oneof(validClaudeKey, validOpenAIKey, validGeminiKey),
          (key) => {
            expect(quickValidateAPIKey(key)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('过短的密钥应不通过快速验证', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 19 }), (key) => {
          expect(quickValidateAPIKey(key)).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('包含非法字符的密钥应不通过快速验证', () => {
      // 测试在中间位置插入非法字符
      const invalidChars = ['!', '@', '#', '%', '^', '&', '*', '(', ')'];

      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 25, maxLength: 30 }),
          fc.constantFrom(...invalidChars),
          fc.integer({ min: 5, max: 15 }),
          (base, invalidChar, position) => {
            const key = base.slice(0, position) + invalidChar + base.slice(position);
            expect(quickValidateAPIKey(key)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('getProviderDisplayName 函数', () => {
    it('应为所有支持的提供商返回非空名称', () => {
      const providers: (APIKeyProvider | 'unknown')[] = [
        'claude',
        'openai',
        'gemini',
        'hiapi',
        'other',
        'unknown',
      ];

      providers.forEach((provider) => {
        const name = getProviderDisplayName(provider);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getSupportedProviders 函数', () => {
    it('应返回非空的提供商列表', () => {
      const providers = getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('应包含主要提供商', () => {
      const providers = getSupportedProviders();
      expect(providers).toContain('claude');
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
    });
  });

  describe('边界情况', () => {
    it('应正确处理 null 和 undefined', () => {
      expect(validateAPIKey(null as unknown as string).isValid).toBe(false);
      expect(validateAPIKey(undefined as unknown as string).isValid).toBe(false);
    });

    it('应正确处理空字符串', () => {
      const result = validateAPIKey('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应正确处理只有空格的字符串', () => {
      const result = validateAPIKey('   ');
      expect(result.isValid).toBe(false);
    });

    it('应自动去除首尾空格并添加警告', () => {
      fc.assert(
        fc.property(validClaudeKey, (key) => {
          const keyWithSpaces = `  ${key}  `;
          const result = validateAPIKey(keyWithSpaces, 'claude');
          expect(result.isValid).toBe(true);
          expect(result.warnings.some((w) => w.includes('空格'))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });
});
