/**
 * API 密钥验证器
 * 实现各提供商的密钥格式验证
 *
 * _Requirements: 7.3_
 * **Property 8: API 密钥格式验证**
 * **Validates: Requirements 7.3**
 */

import type { APIKeyProvider } from "./secureStorage";

// =============================================================================
// 类型定义
// =============================================================================

/** API 密钥验证结果 */
export interface APIKeyValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 检测到的格式/提供商 */
  detectedProvider: APIKeyProvider | "unknown";
  /** 错误信息列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/** 验证规则 */
interface ValidationRule {
  /** 提供商 */
  provider: APIKeyProvider;
  /** 前缀模式 */
  prefixPattern: RegExp;
  /** 完整格式模式 */
  fullPattern: RegExp;
  /** 最小长度 */
  minLength: number;
  /** 最大长度 */
  maxLength: number;
  /** 描述 */
  description: string;
}

// =============================================================================
// 验证规则定义
// =============================================================================

const VALIDATION_RULES: ValidationRule[] = [
  {
    provider: "claude",
    prefixPattern: /^sk-ant-/,
    fullPattern: /^sk-ant-[a-zA-Z0-9_-]{90,}$/,
    minLength: 100,
    maxLength: 200,
    description: 'Claude API 密钥应以 "sk-ant-" 开头',
  },
  {
    provider: "openai",
    prefixPattern: /^sk-(?!ant-)/,
    fullPattern: /^sk-[a-zA-Z0-9]{32,}$/,
    minLength: 40,
    maxLength: 100,
    description: 'OpenAI API 密钥应以 "sk-" 开头（但不是 "sk-ant-"）',
  },
  {
    provider: "gemini",
    prefixPattern: /^AI[a-zA-Z0-9_-]/,
    fullPattern: /^AI[a-zA-Z0-9_-]{30,}$/,
    minLength: 35,
    maxLength: 60,
    description: 'Gemini API 密钥应以 "AI" 开头',
  },
  {
    provider: "hiapi",
    prefixPattern: /^hi-/,
    fullPattern: /^hi-[a-zA-Z0-9_-]{20,}$/,
    minLength: 25,
    maxLength: 100,
    description: 'HiAPI 密钥应以 "hi-" 开头',
  },
];

// =============================================================================
// 核心验证函数
// =============================================================================

/**
 * 验证 API 密钥格式
 *
 * @param key API 密钥
 * @param expectedProvider 期望的提供商（可选）
 * @returns 验证结果
 */
export function validateAPIKey(
  key: string,
  expectedProvider?: APIKeyProvider
): APIKeyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本检查
  if (!key || typeof key !== "string") {
    return {
      isValid: false,
      detectedProvider: "unknown",
      errors: ["API 密钥不能为空"],
      warnings: [],
    };
  }

  // 去除首尾空格
  const trimmedKey = key.trim();

  if (trimmedKey !== key) {
    warnings.push("API 密钥包含首尾空格，已自动去除");
  }

  if (trimmedKey.length === 0) {
    return {
      isValid: false,
      detectedProvider: "unknown",
      errors: ["API 密钥不能为空"],
      warnings,
    };
  }

  // 检测提供商
  const detectedProvider = detectProvider(trimmedKey);

  // 如果指定了期望的提供商，检查是否匹配
  if (expectedProvider && expectedProvider !== "other") {
    if (detectedProvider !== expectedProvider && detectedProvider !== "unknown") {
      warnings.push(
        `密钥格式看起来像 ${getProviderDisplayName(detectedProvider)}，但您选择的是 ${getProviderDisplayName(expectedProvider)}`
      );
    }
  }

  // 获取验证规则
  const rule = VALIDATION_RULES.find((r) => r.provider === (expectedProvider || detectedProvider));

  if (rule) {
    // 检查前缀
    if (!rule.prefixPattern.test(trimmedKey)) {
      errors.push(rule.description);
    }

    // 检查长度
    if (trimmedKey.length < rule.minLength) {
      errors.push(
        `密钥长度过短，${getProviderDisplayName(rule.provider)} 密钥至少需要 ${rule.minLength} 个字符`
      );
    } else if (trimmedKey.length > rule.maxLength) {
      errors.push(
        `密钥长度过长，${getProviderDisplayName(rule.provider)} 密钥最多 ${rule.maxLength} 个字符`
      );
    }

    // 检查完整格式
    if (errors.length === 0 && !rule.fullPattern.test(trimmedKey)) {
      warnings.push("密钥格式可能不正确，请确认是否完整复制");
    }
  } else if (expectedProvider !== "other") {
    // 未知格式的基本检查
    if (trimmedKey.length < 20) {
      errors.push("API 密钥长度过短");
    }

    // 检查是否包含非法字符
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
      errors.push("API 密钥包含非法字符");
    }
  }

  return {
    isValid: errors.length === 0,
    detectedProvider,
    errors,
    warnings,
  };
}

/**
 * 检测 API 密钥的提供商
 *
 * @param key API 密钥
 * @returns 检测到的提供商
 */
export function detectProvider(key: string): APIKeyProvider | "unknown" {
  if (!key) return "unknown";

  const trimmedKey = key.trim();

  for (const rule of VALIDATION_RULES) {
    if (rule.prefixPattern.test(trimmedKey)) {
      return rule.provider;
    }
  }

  return "unknown";
}

/**
 * 获取提供商的显示名称
 *
 * @param provider 提供商
 * @returns 显示名称
 */
export function getProviderDisplayName(provider: APIKeyProvider | "unknown"): string {
  const names: Record<APIKeyProvider | "unknown", string> = {
    claude: "Claude (Anthropic)",
    openai: "OpenAI",
    gemini: "Google Gemini",
    hiapi: "HiAPI",
    other: "其他",
    unknown: "未知",
  };

  return names[provider] || provider;
}

/**
 * 获取提供商的密钥格式说明
 *
 * @param provider 提供商
 * @returns 格式说明
 */
export function getProviderKeyFormat(provider: APIKeyProvider): string {
  const rule = VALIDATION_RULES.find((r) => r.provider === provider);

  if (rule) {
    return rule.description;
  }

  return "请输入有效的 API 密钥";
}

/**
 * 快速检查密钥是否可能有效（不进行完整验证）
 *
 * @param key API 密钥
 * @returns 是否可能有效
 */
export function quickValidateAPIKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;

  const trimmedKey = key.trim();

  // 基本长度检查
  if (trimmedKey.length < 20) return false;

  // 基本字符检查
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) return false;

  return true;
}

/**
 * 验证多个 API 密钥
 *
 * @param keys 密钥映射
 * @returns 验证结果映射
 */
export function validateMultipleAPIKeys(
  keys: Record<APIKeyProvider, string>
): Record<APIKeyProvider, APIKeyValidationResult> {
  const results: Record<string, APIKeyValidationResult> = {};

  for (const [provider, key] of Object.entries(keys)) {
    if (key) {
      results[provider] = validateAPIKey(key, provider as APIKeyProvider);
    }
  }

  return results as Record<APIKeyProvider, APIKeyValidationResult>;
}

/**
 * 获取所有支持的提供商
 *
 * @returns 提供商列表
 */
export function getSupportedProviders(): APIKeyProvider[] {
  return VALIDATION_RULES.map((r) => r.provider);
}
