/**
 * useValidation - 输入验证 Hook
 *
 * 实现实时验证逻辑，支持防抖验证
 * 提供同步和异步验证支持
 *
 * _Requirements: 6.3_
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ValidationStatus, ValidationMessage } from '@/components/common/ValidationFeedback';

// =============================================================================
// 类型定义
// =============================================================================

/** 验证规则 */
export interface ValidationRule<T = string> {
  /** 规则名称 */
  name: string;
  /** 验证函数，返回 true 表示通过 */
  validate: (value: T) => boolean | Promise<boolean>;
  /** 验证失败时的消息 */
  message: string;
  /** 验证失败时的状态，默认 error */
  status?: ValidationStatus;
}

/** 验证结果 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 验证状态 */
  status: ValidationStatus;
  /** 验证消息 */
  message?: string;
  /** 所有验证消息 */
  messages: ValidationMessage[];
  /** 失败的规则名称 */
  failedRules: string[];
}

/** Hook 配置选项 */
export interface UseValidationOptions<T = string> {
  /** 验证规则列表 */
  rules: ValidationRule<T>[];
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 是否在首次输入前验证 */
  validateOnMount?: boolean;
  /** 是否在值变化时自动验证 */
  validateOnChange?: boolean;
  /** 验证模式：first-error 只显示第一个错误，all 显示所有错误 */
  mode?: 'first-error' | 'all';
  /** 初始值 */
  initialValue?: T;
}

/** Hook 返回值 */
export interface UseValidationReturn<T = string> {
  /** 当前值 */
  value: T;
  /** 设置值 */
  setValue: (value: T) => void;
  /** 验证结果 */
  result: ValidationResult;
  /** 是否正在验证 */
  isValidating: boolean;
  /** 是否已触摸（用户已交互） */
  isTouched: boolean;
  /** 是否已修改 */
  isDirty: boolean;
  /** 手动触发验证 */
  validate: () => Promise<ValidationResult>;
  /** 重置状态 */
  reset: (newValue?: T) => void;
  /** 标记为已触摸 */
  touch: () => void;
  /** 清除验证结果 */
  clearValidation: () => void;
}

// =============================================================================
// 辅助函数
// =============================================================================

const initialResult: ValidationResult = {
  isValid: true,
  status: 'idle',
  message: undefined,
  messages: [],
  failedRules: [],
};

// =============================================================================
// Hook 实现
// =============================================================================

export function useValidation<T = string>(
  options: UseValidationOptions<T>
): UseValidationReturn<T> {
  const {
    rules,
    debounceMs = 300,
    validateOnMount = false,
    validateOnChange = true,
    mode = 'first-error',
    initialValue = '' as unknown as T,
  } = options;

  const [value, setValueState] = useState<T>(initialValue);
  const [result, setResult] = useState<ValidationResult>(initialResult);
  const [isValidating, setIsValidating] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const validationIdRef = useRef(0);
  const initialValueRef = useRef(initialValue);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 执行验证
  const runValidation = useCallback(
    async (valueToValidate: T): Promise<ValidationResult> => {
      const validationId = ++validationIdRef.current;
      setIsValidating(true);
      setResult((prev) => ({ ...prev, status: 'validating' }));

      const messages: ValidationMessage[] = [];
      const failedRules: string[] = [];

      try {
        for (const rule of rules) {
          // 检查是否被新的验证取代
          if (validationId !== validationIdRef.current) {
            return result;
          }

          const isValid = await Promise.resolve(rule.validate(valueToValidate));

          if (!isValid) {
            const status = rule.status ?? 'error';
            messages.push({
              message: rule.message,
              status,
            });
            failedRules.push(rule.name);

            // first-error 模式下，遇到第一个错误就停止
            if (mode === 'first-error') {
              break;
            }
          }
        }

        // 检查是否被新的验证取代
        if (validationId !== validationIdRef.current) {
          return result;
        }

        const hasErrors = messages.some((m) => m.status === 'error');
        const hasWarnings = messages.some((m) => m.status === 'warning');

        const newResult: ValidationResult = {
          isValid: !hasErrors,
          status: hasErrors ? 'error' : hasWarnings ? 'warning' : messages.length > 0 ? 'info' : 'success',
          message: messages[0]?.message,
          messages,
          failedRules,
        };

        setResult(newResult);
        return newResult;
      } finally {
        if (validationId === validationIdRef.current) {
          setIsValidating(false);
        }
      }
    },
    [rules, mode, result]
  );

  // 防抖验证
  const debouncedValidate = useCallback(
    (valueToValidate: T) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        runValidation(valueToValidate);
      }, debounceMs);
    },
    [runValidation, debounceMs]
  );

  // 设置值
  const setValue = useCallback(
    (newValue: T) => {
      setValueState(newValue);
      setIsDirty(newValue !== initialValueRef.current);

      if (validateOnChange && isTouched) {
        debouncedValidate(newValue);
      }
    },
    [validateOnChange, isTouched, debouncedValidate]
  );

  // 手动验证
  const validate = useCallback(async (): Promise<ValidationResult> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    return runValidation(value);
  }, [runValidation, value]);

  // 重置
  const reset = useCallback(
    (newValue?: T) => {
      const resetValue = newValue ?? initialValueRef.current;
      setValueState(resetValue);
      setResult(initialResult);
      setIsValidating(false);
      setIsTouched(false);
      setIsDirty(false);
      validationIdRef.current++;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    []
  );

  // 标记为已触摸
  const touch = useCallback(() => {
    if (!isTouched) {
      setIsTouched(true);
      if (validateOnChange) {
        debouncedValidate(value);
      }
    }
  }, [isTouched, validateOnChange, debouncedValidate, value]);

  // 清除验证结果
  const clearValidation = useCallback(() => {
    setResult(initialResult);
    validationIdRef.current++;
  }, []);

  // 初始验证
  useEffect(() => {
    if (validateOnMount) {
      runValidation(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      value,
      setValue,
      result,
      isValidating,
      isTouched,
      isDirty,
      validate,
      reset,
      touch,
      clearValidation,
    }),
    [value, setValue, result, isValidating, isTouched, isDirty, validate, reset, touch, clearValidation]
  );
}

// =============================================================================
// 常用验证规则工厂
// =============================================================================

export const ValidationRules = {
  /** 必填 */
  required: (message = '此字段为必填项'): ValidationRule => ({
    name: 'required',
    validate: (value) => value !== undefined && value !== null && value.toString().trim() !== '',
    message,
  }),

  /** 最小长度 */
  minLength: (min: number, message?: string): ValidationRule => ({
    name: 'minLength',
    validate: (value) => value.toString().length >= min,
    message: message ?? `最少需要 ${min} 个字符`,
  }),

  /** 最大长度 */
  maxLength: (max: number, message?: string): ValidationRule => ({
    name: 'maxLength',
    validate: (value) => value.toString().length <= max,
    message: message ?? `最多允许 ${max} 个字符`,
  }),

  /** 正则匹配 */
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    name: 'pattern',
    validate: (value) => regex.test(value.toString()),
    message,
  }),

  /** 邮箱格式 */
  email: (message = '请输入有效的邮箱地址'): ValidationRule => ({
    name: 'email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toString()),
    message,
  }),

  /** URL 格式 */
  url: (message = '请输入有效的 URL'): ValidationRule => ({
    name: 'url',
    validate: (value) => {
      try {
        new URL(value.toString());
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  /** 数字范围 */
  range: (min: number, max: number, message?: string): ValidationRule<number> => ({
    name: 'range',
    validate: (value) => value >= min && value <= max,
    message: message ?? `值必须在 ${min} 到 ${max} 之间`,
  }),

  /** 自定义验证 */
  custom: <T = string>(
    name: string,
    validate: (value: T) => boolean | Promise<boolean>,
    message: string,
    status?: ValidationStatus
  ): ValidationRule<T> => ({
    name,
    validate,
    message,
    status,
  }),
};

export default useValidation;
