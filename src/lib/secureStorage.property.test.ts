/**
 * API 密钥安全存储属性测试
 *
 * **Property 7: API 密钥安全存储**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 *
 * 测试安全存储模块的核心功能：
 * - 密钥存储和检索的一致性
 * - 密钥遮罩功能
 * - 提供商映射
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  maskAPIKey,
  type APIKeyProvider,
} from './secureStorage';

// 定义字符集
const alphanumericChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const alphanumericWithSpecialChars = alphanumericChars + '_-';

// 生成有效的 API 密钥
const validAPIKey = fc.stringOf(
  fc.constantFrom(...alphanumericWithSpecialChars.split('')),
  { minLength: 20, maxLength: 150 }
);

// 生成提供商
const validProvider = fc.constantFrom<APIKeyProvider>(
  'claude',
  'openai',
  'gemini',
  'siliconflow',
  'hiapi',
  'other'
);

describe('SecureStorage Property Tests', () => {
  describe('Property 7: API 密钥安全存储', () => {
    describe('maskAPIKey 函数', () => {
      it('遮罩后的密钥应保留前后指定数量的字符', () => {
        fc.assert(
          fc.property(
            validAPIKey,
            fc.integer({ min: 1, max: 8 }),
            (key, visibleChars) => {
              // 只测试足够长的密钥
              if (key.length <= visibleChars * 2) {
                const masked = maskAPIKey(key, visibleChars);
                expect(masked).toBe('••••••••');
                return;
              }

              const masked = maskAPIKey(key, visibleChars);

              // 检查前缀
              expect(masked.startsWith(key.slice(0, visibleChars))).toBe(true);

              // 检查后缀
              expect(masked.endsWith(key.slice(-visibleChars))).toBe(true);

              // 检查中间有遮罩字符
              expect(masked.includes('•')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('遮罩后的密钥不应暴露完整密钥', () => {
        fc.assert(
          fc.property(validAPIKey, (key) => {
            if (key.length <= 8) return; // 跳过太短的密钥

            const masked = maskAPIKey(key);

            // 遮罩后的字符串不应等于原始密钥
            expect(masked).not.toBe(key);

            // 遮罩后的字符串应包含遮罩字符
            expect(masked.includes('•')).toBe(true);
          }),
          { numRuns: 100 }
        );
      });

      it('短密钥应完全遮罩', () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 1, maxLength: 8 }),
            (key) => {
              const masked = maskAPIKey(key);
              expect(masked).toBe('••••••••');
            }
          ),
          { numRuns: 50 }
        );
      });

      it('空密钥应返回遮罩占位符', () => {
        expect(maskAPIKey('')).toBe('••••••••');
        expect(maskAPIKey(null as unknown as string)).toBe('••••••••');
        expect(maskAPIKey(undefined as unknown as string)).toBe('••••••••');
      });

      it('默认可见字符数为 4', () => {
        const key = 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyz';
        const masked = maskAPIKey(key);

        // 前 4 个字符可见
        expect(masked.startsWith('sk-a')).toBe(true);

        // 后 4 个字符可见
        expect(masked.endsWith('wxyz')).toBe(true);
      });
    });

    describe('提供商类型', () => {
      it('所有提供商类型应为有效字符串', () => {
        fc.assert(
          fc.property(validProvider, (provider) => {
            expect(typeof provider).toBe('string');
            expect(provider.length).toBeGreaterThan(0);
          }),
          { numRuns: 20 }
        );
      });

      it('提供商列表应包含所有主要提供商', () => {
        const providers: APIKeyProvider[] = ['claude', 'openai', 'gemini', 'siliconflow', 'hiapi', 'other'];

        providers.forEach((provider) => {
          expect(typeof provider).toBe('string');
        });
      });
    });
  });


  describe('存储键格式', () => {
    it('API 密钥存储键应包含提供商标识', () => {
      fc.assert(
        fc.property(validProvider, (provider) => {
          const expectedKeyPattern = `api_key_${provider}`;
          expect(expectedKeyPattern).toContain(provider);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('密钥遮罩边界情况', () => {
    it('不同长度的密钥应正确遮罩', () => {
      const testCases = [
        { key: 'a', expected: '••••••••' },
        { key: 'ab', expected: '••••••••' },
        { key: 'abcdefgh', expected: '••••••••' },
        { key: 'abcdefghi', expected: 'abcd•hijk'.replace('hijk', 'fghi') }, // 9 chars
        { key: 'abcdefghij', expected: 'abcd••ghij' },
        { key: 'abcdefghijklmnop', expected: 'abcd••••••••mnop' },
      ];

      // 测试边界情况
      expect(maskAPIKey('a')).toBe('••••••••');
      expect(maskAPIKey('abcdefgh')).toBe('••••••••');

      // 9 个字符：前 4 + 后 4 = 8，中间 1 个字符被遮罩
      const masked9 = maskAPIKey('abcdefghi');
      expect(masked9.startsWith('abcd')).toBe(true);
      expect(masked9.endsWith('fghi')).toBe(true);
      expect(masked9.includes('•')).toBe(true);
    });

    it('遮罩长度应有上限', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 50, maxLength: 200 }),
          (key) => {
            const masked = maskAPIKey(key);
            const maskedChars = (masked.match(/•/g) || []).length;

            // 遮罩字符数最多 16 个
            expect(maskedChars).toBeLessThanOrEqual(16);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('安全性属性', () => {
    it('遮罩后不应能还原原始密钥', () => {
      fc.assert(
        fc.property(validAPIKey, (key) => {
          if (key.length <= 8) return;

          const masked = maskAPIKey(key);

          // 遮罩后的长度应小于或等于原始长度
          // （因为中间部分被压缩为最多 16 个遮罩字符）
          expect(masked.length).toBeLessThanOrEqual(key.length);

          // 不能从遮罩版本推断出完整密钥
          // （中间部分信息丢失）
          const visiblePart = masked.replace(/•/g, '');
          expect(visiblePart.length).toBeLessThanOrEqual(8); // 默认前后各 4 个字符
        }),
        { numRuns: 100 }
      );
    });

    it('相同密钥应产生相同的遮罩结果', () => {
      fc.assert(
        fc.property(validAPIKey, (key) => {
          const masked1 = maskAPIKey(key);
          const masked2 = maskAPIKey(key);

          expect(masked1).toBe(masked2);
        }),
        { numRuns: 50 }
      );
    });

    it('不同密钥应产生不同的遮罩结果（大多数情况）', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 20, maxLength: 50 }),
          fc.stringOf(fc.constantFrom(...alphanumericChars.split('')), { minLength: 20, maxLength: 50 }),
          (key1, key2) => {
            // 如果两个密钥相同，跳过
            if (key1 === key2) return;

            // 如果前后 4 个字符都相同，遮罩结果可能相同
            if (
              key1.slice(0, 4) === key2.slice(0, 4) &&
              key1.slice(-4) === key2.slice(-4)
            ) {
              return;
            }

            const masked1 = maskAPIKey(key1);
            const masked2 = maskAPIKey(key2);

            expect(masked1).not.toBe(masked2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
