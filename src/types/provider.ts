/**
 * 统一的代理商配置类型定义
 * 
 * 用于替代分散的 ProviderConfig、CodexProviderConfig、GeminiProviderConfig
 */

// 引擎类型
export type EngineType = 'claude' | 'codex' | 'gemini' | 'siliconflow' | 'kiro';

// 引擎显示名称映射
export const ENGINE_DISPLAY_NAMES: Record<EngineType, string> = {
    claude: 'Claude Code',
    codex: 'OpenAI Codex',
    gemini: 'Google Gemini',
    siliconflow: 'SiliconFlow',
    kiro: 'Kiro (Amazon Q)',
};

// 引擎图标映射（Lucide 图标名称）
export const ENGINE_ICONS: Record<EngineType, string> = {
    claude: 'Bot',
    codex: 'FileCode',
    gemini: 'Sparkles',
    siliconflow: 'Zap',
    kiro: 'Cloud',
};

// 代理商分类
export type ProviderCategory = 'official' | 'partner' | 'third-party' | 'custom';

// 连接测试结果
export interface ConnectionTestResult {
    success: boolean;
    timestamp: number;
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
    modelInfo?: {
        name: string;
        contextWindow?: number;
    };
}

// 统一的代理商配置接口
export interface UnifiedProviderConfig {
    // 基础信息
    id: string;                           // 唯一标识符
    name: string;                         // 显示名称
    engine: EngineType;                   // 引擎类型
    description?: string;                 // 描述

    // 认证信息 (加密存储)
    apiKey?: string;                      // 加密后的 API Key
    apiKeyIv?: string;                    // AES-GCM IV
    authToken?: string;                   // 加密后的 Auth Token (Claude 专用)
    authTokenIv?: string;                 // AES-GCM IV
    baseUrl?: string;                     // API 端点
    model?: string;                       // 默认模型

    // 元数据
    isOfficial?: boolean;                 // 是否官方
    isPartner?: boolean;                  // 是否合作伙伴
    category?: ProviderCategory;          // 分类
    websiteUrl?: string;                  // 官网链接
    sortOrder: number;                    // 排序顺序

    // 状态
    enabled: boolean;                     // 是否启用
    lastUsed?: number;                    // 最后使用时间戳
    lastTestResult?: ConnectionTestResult; // 最后测试结果

    // 引擎特定配置（JSON 字符串，用于存储引擎特有的配置）
    engineSpecificConfig?: string;

    // 自定义请求头
    customHeaders?: Record<string, string>;

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

// 存储键常量
export const PROVIDER_STORAGE_KEY = 'fangyu-unified-providers';
export const CURRENT_ENGINE_KEY = 'fangyu-current-engine';
export const CURRENT_PROVIDERS_KEY = 'fangyu-current-providers';
export const RUNTIME_CONFIG_KEY = 'fangyu-runtime-config';

// 存储版本（用于迁移）
export const PROVIDER_STORAGE_VERSION = 2;
export const ENCRYPTION_VERSION = 1;

// 运行环境模式
export type RuntimeMode = 'native' | 'wsl' | 'auto';

// 运行环境配置
export interface RuntimeConfig {
    wslEnabled: boolean;
    wslDistro: string | null;
    engineModes: Record<EngineType, RuntimeMode>;
    // Claude Code 环境变量
    claudeEnvVars?: ClaudeEnvVars;
}

// Claude Code 环境变量配置
export interface ClaudeEnvVars {
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_BASE_URL?: string;
    ANTHROPIC_AUTH_TOKEN?: string;
    ANTHROPIC_MODEL?: string;
    API_TIMEOUT_MS?: number;
    MAX_THINKING_TOKENS?: number;
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: boolean;
    CLAUDE_CODE_DISABLE_TELEMETRY?: boolean;
    CLAUDE_CODE_USE_BEDROCK?: boolean;
    CLAUDE_CODE_MAX_OUTPUT_TOKENS?: number;
}

// 默认运行环境配置
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
    wslEnabled: false,
    wslDistro: null,
    engineModes: {
        claude: 'auto',
        codex: 'auto',
        gemini: 'auto',
        siliconflow: 'native', // SiliconFlow 不需要 WSL
        kiro: 'native',        // Kiro 使用原生 API 调用
    },
};

// 迁移日志条目
export interface MigrationLogEntry {
    fromVersion: number;
    toVersion: number;
    timestamp: number;
    success: boolean;
    details?: string;
}

// 代理商存储结构
export interface ProviderStorage {
    version: number;
    encryptionVersion?: number;           // 加密版本
    providers: UnifiedProviderConfig[];
    currentEngine: EngineType;
    currentProviders: Record<EngineType, string | null>;
    migrationLog?: MigrationLogEntry[];   // 迁移日志
}

// 默认存储结构
export const DEFAULT_PROVIDER_STORAGE: ProviderStorage = {
    version: PROVIDER_STORAGE_VERSION,
    providers: [],
    currentEngine: 'claude',
    currentProviders: {
        claude: null,
        codex: null,
        gemini: null,
        siliconflow: null,
        kiro: null,
    },
};

// 导出配置格式
export interface ExportedConfig {
    version: number;
    exportedAt: number;
    exportedFrom?: string;                // 应用版本
    includesSensitiveData: boolean;
    sensitiveDataMode?: 'encrypted' | 'masked' | 'excluded';
    encryptionHint?: string;              // 加密提示
    providers: ExportedProvider[];
    currentEngine: EngineType;
    currentProviders: Record<EngineType, string | null>;
    runtimeConfig: RuntimeConfig;
}

// 导出的代理商配置
export interface ExportedProvider {
    id: string;
    name: string;
    engine: EngineType;
    baseUrl?: string;
    model?: string;
    isOfficial?: boolean;
    isPartner?: boolean;
    category?: ProviderCategory;
    sortOrder: number;
    enabled: boolean;
    // 敏感信息 (根据 sensitiveDataMode)
    apiKey?: string;
    apiKeyIv?: string;
    authToken?: string;
    authTokenIv?: string;
}

// 引擎状态
export type EngineConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

// 引擎状态信息
export interface EngineStatusInfo {
    engine: EngineType;
    installed: boolean;
    version?: string;
    connectionStatus: EngineConnectionStatus;
    currentProvider?: UnifiedProviderConfig;
    errorMessage?: string;
}

// 验证结果
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// 引擎切换事件
export interface EngineChangeEvent {
    engine: EngineType;
    providerId: string | null;
    previousEngine?: EngineType;
    previousProviderId?: string | null;
    timestamp: number;
}


// 表单字段类型
export type FormFieldType = 'text' | 'url' | 'secret' | 'select' | 'textarea';

// 表单字段配置
export interface FormFieldConfig {
    name: string;
    label: string;
    type: FormFieldType;
    required?: boolean;
    placeholder?: string;
    options?: { value: string; label: string }[];
    description?: string;
}

// 预设代理商
export interface PresetProvider {
    name: string;
    baseUrl: string;
    isOfficial?: boolean;
    isPartner?: boolean;
    description?: string;
}

// 引擎颜色映射
export const ENGINE_COLORS: Record<EngineType, string> = {
    claude: '#D97706',      // 琥珀色
    codex: '#059669',       // 翠绿色
    gemini: '#7C3AED',      // 紫罗兰
    siliconflow: '#2563EB', // 蓝色
    kiro: '#FF6B35',        // 橙红色 (Amazon Q 品牌色)
};

// 模型列表
export const CLAUDE_MODELS = [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
];

export const CODEX_MODELS = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const GEMINI_MODELS = [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
];

// Kiro (Amazon Q) 模型列表
export const KIRO_MODELS = [
    { value: '', label: 'Auto (自动选择)' },
    { value: 'claude-opus-4.5', label: 'Claude Opus 4.5 (最强大)' },
    { value: 'CLAUDE_SONNET_4_5_20250929_V1_0', label: 'Claude Sonnet 4.5 (平衡)' },
    { value: 'CLAUDE_SONNET_4_20250514_V1_0', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5 (最快)' },
];

// 预设代理商配置
export const PRESET_PROVIDERS: Record<EngineType, PresetProvider[]> = {
    claude: [
        { name: 'Anthropic 官方', baseUrl: 'https://api.anthropic.com', isOfficial: true },
        { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', isPartner: true },
    ],
    codex: [
        { name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', isOfficial: true },
        { name: 'Azure OpenAI', baseUrl: '', isPartner: true, description: '需要配置 Azure 端点' },
    ],
    gemini: [
        { name: 'Google AI Studio', baseUrl: 'https://generativelanguage.googleapis.com', isOfficial: true },
    ],
    siliconflow: [
        { name: 'SiliconFlow 官方', baseUrl: 'https://api.siliconflow.cn/v1', isOfficial: true },
    ],
    kiro: [
        { name: 'Kiro (Amazon Q)', baseUrl: 'https://q.us-east-1.amazonaws.com', isOfficial: true, description: '使用 Kiro SSO Token' },
    ],
};

// 表单字段配置
export const FORM_FIELDS: Record<EngineType, FormFieldConfig[]> = {
    claude: [
        { name: 'name', label: '名称', type: 'text', required: true, placeholder: '例如: Anthropic 官方' },
        { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.anthropic.com' },
        { name: 'apiKey', label: 'API Key', type: 'secret', required: true, placeholder: 'sk-ant-...' },
        { name: 'model', label: '默认模型', type: 'select', options: CLAUDE_MODELS },
    ],
    codex: [
        { name: 'name', label: '名称', type: 'text', required: true, placeholder: '例如: OpenAI 官方' },
        { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.openai.com/v1' },
        { name: 'apiKey', label: 'API Key', type: 'secret', required: true, placeholder: 'sk-...' },
        { name: 'model', label: '默认模型', type: 'select', options: CODEX_MODELS },
    ],
    gemini: [
        { name: 'name', label: '名称', type: 'text', required: true, placeholder: '例如: Google AI Studio' },
        { name: 'baseUrl', label: 'API 端点', type: 'url', placeholder: 'https://generativelanguage.googleapis.com' },
        { name: 'apiKey', label: 'API Key', type: 'secret', required: true, placeholder: 'AIza...' },
        { name: 'model', label: '默认模型', type: 'select', options: GEMINI_MODELS },
    ],
    siliconflow: [
        { name: 'name', label: '名称', type: 'text', required: true, placeholder: '例如: SiliconFlow 官方' },
        { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.siliconflow.cn/v1' },
        { name: 'apiKey', label: 'API Key', type: 'secret', required: true },
        { name: 'model', label: '默认模型', type: 'text', required: true, placeholder: '模型名称' },
    ],
    kiro: [
        { name: 'name', label: '名称', type: 'text', required: true, placeholder: '例如: Kiro (Amazon Q)' },
        { name: 'baseUrl', label: 'Token 路径', type: 'text', required: false, placeholder: '~/.aws/sso/cache/kiro-auth-token.json', description: '留空使用默认路径' },
        { name: 'model', label: '默认模型', type: 'select', options: KIRO_MODELS, description: 'Opus 4.5 仅 Builders ID 支持' },
    ],
};
