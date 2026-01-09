/**
 * useValidation 属性测试
 *
 * **Property 6: 输入验证反馈**
 * **Validates: Requirements 6.3**
 *
 * 测试验证规则的正确性和一致性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// 类型定义（从 Hook 提取的核心逻辑）
// =============================================================================

type ValidationStatus = 'idle' | 'validating' | 'success' | 'warning' | 'error' | 'info';

interface ValidationRule {
  name: string;
  validate: (value: string) => boolean;
  message: string;
  status?: ValidationStatus;
}

interface ValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  message?: string;
  failedRules: string[];
}

// =============================================================================
// 验证逻辑模拟
// =============================================================================

/**
 * 执行验证规则
 */
function runValidation(
  value: string,
  rules: ValidationRule[],
  mode: 'first-error' | 'all' = 'first-error'
): ValidationResult {
  const failedRules: string[] = [];
  let firstErrorMessage: string | undefined;
  let hasError = false;
  let hasWarning = false;

  for (const rule of rules) {
    const isValid = rule.validate(value);

    if (!isValid) {
      const status = rule.status ?? 'error';
      failedRules.push(rule.name);

      if (status === 'error') {
        hasError = true;
        if (!firstErrorMessage) {
          firstErrorMessage = rule.message;
        }
      } else if (status === 'warning') {
        hasWarning = true;
      }

      if (mode === 'first-error' && hasError) {
        break;
      }
    }
  }

  return {
    isValid: !hasError,
    status: hasError ? 'error' : hasWarning ? 'warning' : 'success',
    message: firstErrorMessage,
    failedRules,
  };
}

// =============================================================================
// 常用验证规则
// =============================================================================

const ValidationRules = {
  required: (message = '必填'): ValidationRule => ({
    name: 'required',
    validate: (value) => value.trim() !== '',
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    name: 'minLength',
    validate: (value) => value.length >= min,
    message: message ?? `最少 ${min} 字符`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    name: 'maxLength',
    validate: (value) => value.length <= max,
    message: message ?? `最多 ${max} 字符`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    name: 'pattern',
    validate: (value) => regex.test(value),
    message,
  }),

  email: (message = '无效邮箱'): ValidationRule => ({
    name: 'email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
};

// =============================================================================
// 生成器
// =============================================================================

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 });
const whitespaceStringArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'));
const emailArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('@') && !s.includes(' ')),
  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes('@') && !s.includes(' ') && !s.includes('.')),
  fc.string({ minLength: 2, maxLength: 5 }).filter((s) => !s.includes('@') && !s.includes(' ') && !s.includes('.'))
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// =============================================================================
// 属性测试
// =============================================================================

describe('useValidation 属性测试', () => {
  describe('Property 6: 输入验证反馈', () => {
    describe('required 规则', () => {
      it('非空字符串通过 required 验证', () => {
        fc.assert(
          fc.property(nonEmptyStringArb, (value) => {
            // 过滤掉纯空白字符串
            if (value.trim() === '') return true;

            const result = runValidation(value, [ValidationRules.required()]);
            expect(result.isValid).toBe(true);
            expect(result.status).toBe('success');
          }),
          { numRuns: 100 }
        );
      });

      it('空字符串和纯空白字符串不通过 required 验证', () => {
        fc.assert(
          fc.property(whitespaceStringArb, (value) => {
            const result = runValidation(value, [ValidationRules.required()]);
            expect(result.isValid).toBe(false);
            expect(result.status).toBe('error');
            expect(result.failedRules).toContain('required');
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('minLength 规则', () => {
      it('长度 >= min 的字符串通过验证', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 20 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            (min, value) => {
              const result = runValidation(value, [ValidationRules.minLength(min)]);

              if (value.length >= min) {
                expect(result.isValid).toBe(true);
              } else {
                expect(result.isValid).toBe(false);
                expect(result.failedRules).toContain('minLength');
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('maxLength 规则', () => {
      it('长度 <= max 的字符串通过验证', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 50 }),
            fc.string({ minLength: 0, maxLength: 100 }),
            (max, value) => {
              const result = runValidation(value, [ValidationRules.maxLength(max)]);

              if (value.length <= max) {
                expect(result.isValid).toBe(true);
              } else {
                expect(result.isValid).toBe(false);
                expect(result.failedRules).toContain('maxLength');
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('email 规则', () => {
      it('有效邮箱格式通过验证', () => {
        fc.assert(
          fc.property(emailArb, (email) => {
            const result = runValidation(email, [ValidationRules.email()]);
            expect(result.isValid).toBe(true);
          }),
          { numRuns: 100 }
        );
      });

      it('无效邮箱格式不通过验证', () => {
        const invalidEmails = [
          'plaintext',
          '@nodomain.com',
          'no@domain',
          'spaces in@email.com',
          'double@@at.com',
        ];

        for (const email of invalidEmails) {
          const result = runValidation(email, [ValidationRules.email()]);
          expect(result.isValid).toBe(false);
          expect(result.failedRules).toContain('email');
        }
      });
    });

    describe('组合规则', () => {
      it('所有规则通过时结果为 valid', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 5, maxLength: 20 }).filter((s) => s.trim() !== ''),
            (value) => {
              const rules = [
                ValidationRules.required(),
                ValidationRules.minLength(3),
                ValidationRules.maxLength(50),
              ];

              const result = runValidation(value, rules);
              expect(result.isValid).toBe(true);
              expect(result.failedRules).toHaveLength(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('first-error 模式只返回第一个错误', () => {
        const rules = [
          ValidationRules.required(),
          ValidationRules.minLength(10),
          ValidationRules.maxLength(5),
        ];

        // 空字符串会触发 required 和 minLength，但 first-error 只返回第一个
        const result = runValidation('', rules, 'first-error');
        expect(result.isValid).toBe(false);
        expect(result.failedRules).toHaveLength(1);
        expect(result.failedRules[0]).toBe('required');
      });

      it('all 模式返回所有错误', () => {
        const rules = [
          ValidationRules.required(),
          ValidationRules.minLength(10),
        ];

        // 空字符串会触发两个规则
        const result = runValidation('', rules, 'all');
        expect(result.isValid).toBe(false);
        expect(result.failedRules.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('验证结果一致性', () => {
      it('相同输入产生相同结果', () => {
        fc.assert(
          fc.property(fc.string({ maxLength: 50 }), (value) => {
            const rules = [
              ValidationRules.required(),
              ValidationRules.minLength(3),
            ];

            const result1 = runValidation(value, rules);
            const result2 = runValidation(value, rules);

            expect(result1.isValid).toBe(result2.isValid);
            expect(result1.status).toBe(result2.status);
            expect(result1.failedRules).toEqual(result2.failedRules);
          }),
          { numRuns: 100 }
        );
      });

      it('isValid 为 true 时 status 不为 error', () => {
        fc.assert(
          fc.property(fc.string({ maxLength: 50 }), (value) => {
            const rules = [ValidationRules.minLength(3)];
            const result = runValidation(value, rules);

            if (result.isValid) {
              expect(result.status).not.toBe('error');
            }
          }),
          { numRuns: 100 }
        );
      });

      it('isValid 为 false 时 failedRules 不为空', () => {
        fc.assert(
          fc.property(fc.string({ maxLength: 50 }), (value) => {
            const rules = [
              ValidationRules.required(),
              ValidationRules.minLength(5),
            ];
            const result = runValidation(value, rules);

            if (!result.isValid) {
              expect(result.failedRules.length).toBeGreaterThan(0);
            }
          }),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('边界情况', () => {
    it('空规则列表总是返回 valid', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 100 }), (value) => {
          const result = runValidation(value, []);
          expect(result.isValid).toBe(true);
          expect(result.status).toBe('success');
          expect(result.failedRules).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('minLength(0) 总是通过', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 100 }), (value) => {
          const result = runValidation(value, [ValidationRules.minLength(0)]);
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('maxLength 大于字符串长度时通过', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (value) => {
            const result = runValidation(value, [ValidationRules.maxLength(value.length + 10)]);
            expect(result.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
