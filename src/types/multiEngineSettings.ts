/**
 * Multi-Engine Settings Types
 * 
 * 多引擎设置系统的类型定义
 * 支持 Claude Code、OpenAI Codex、Google Gemini 三种引擎的独立配置
 */

// =============================================================================
// 引擎类型
// =============================================================================

/** 支持的执行引擎类型 */
export type EngineType = 'claude-code' | 'codex' | 'gemini';

/** 引擎信息 */
export interface EngineInfo {
    id: EngineType;
    name: string;
    shortName: string;
    description: string;
    color: string;
}

/** 所有引擎信息 */
export const ENGINE_INFO: Record<EngineType, EngineInfo> = {
    'claude-code': {
        id: 'claude-code',
        name: 'Claude Code',
        shortName: 'Claude',
        description: 'Anthropic Claude AI 编程助手',
        color: '#D97706', // amber
    },
    'codex': {
        id: 'codex',
        name: 'OpenAI Codex',
        shortName: 'Codex',
        description: 'OpenAI GPT 系列编程助手',
        color: '#10B981', // emerald
    },
    'gemini': {
        id: 'gemini',
        name: 'Google Gemini',
        shortName: 'Gemini',
        description: 'Google Gemini AI 编程助手',
        color: '#3B82F6', // blue
    },
};

// =============================================================================
// 引擎配置
// =============================================================================

/** 权限规则 */
export interface PermissionRules {
    allow: string[];
    deny: string[];
}

/** 钩子配置 */
export interface HookConfig {
    id: string;
    name: string;
    event: string;
    action: string;
    enabled: boolean;
}

/** 单个引擎的设置 */
export interface EngineSettings {
    /** 权限规则 */
    permissions: PermissionRules;
    /** 环境变量 */
    env: Record<string, string>;
    /** 钩子配置 */
    hooks: HookConfig[];
}

// =============================================================================
// 多引擎设置存储
// =============================================================================

/** 通用设置（不区分引擎） */
export interface GeneralSettings {
    language: string;
    theme: string;
    showSystemInitialization: boolean;
    showAllToolResults: boolean;
    verbose: boolean;
    hideAutoContinueMessages: boolean;
    hideStartupWarnings: boolean;
}

/** 多引擎设置存储格式 */
export interface MultiEngineSettingsStore {
    /** 版本号，用于迁移 */
    version: 2;
    /** 当前活动引擎 */
    activeEngine: EngineType;
    /** 各引擎的独立配置 */
    engines: Record<EngineType, EngineSettings>;
    /** 通用设置 */
    general: GeneralSettings;
    /** 最后更新时间 */
    lastUpdated: number;
}

// =============================================================================
// 默认配置
// =============================================================================

/** Claude Code 默认环境变量 */
export const CLAUDE_CODE_DEFAULT_ENV: Record<string, string> = {
    'ANTHROPIC_API_KEY': '',
    'ANTHROPIC_BASE_URL': '',
    'MAX_THINKING_TOKENS': '31999',
    'API_TIMEOUT_MS': '600000',
};

/** Codex 默认环境变量 */
export const CODEX_DEFAULT_ENV: Record<string, string> = {
    'OPENAI_API_KEY': '',
    'OPENAI_BASE_URL': '',
};

/** Gemini 默认环境变量 */
export const GEMINI_DEFAULT_ENV: Record<string, string> = {
    'GOOGLE_API_KEY': '',
    'GOOGLE_BASE_URL': '',
};

/** Claude Code 默认权限 */
export const CLAUDE_CODE_DEFAULT_PERMISSIONS: PermissionRules = {
    allow: [
        'Bash(npm:*)',
        'Bash(git:*)',
        'Bash(node:*)',
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'WebFetch',
        'WebSearch',
    ],
    deny: [],
};

/** Codex 默认权限 */
export const CODEX_DEFAULT_PERMISSIONS: PermissionRules = {
    allow: [
        'Bash(npm:*)',
        'Bash(node:*)',
        'Read',
        'Write',
        'Edit',
    ],
    deny: [],
};

/** Gemini 默认权限 */
export const GEMINI_DEFAULT_PERMISSIONS: PermissionRules = {
    allow: [
        'Read',
        'Write',
        'Edit',
    ],
    deny: [],
};

/** 默认引擎设置 */
export const DEFAULT_ENGINE_SETTINGS: Record<EngineType, EngineSettings> = {
    'claude-code': {
        permissions: CLAUDE_CODE_DEFAULT_PERMISSIONS,
        env: CLAUDE_CODE_DEFAULT_ENV,
        hooks: [],
    },
    'codex': {
        permissions: CODEX_DEFAULT_PERMISSIONS,
        env: CODEX_DEFAULT_ENV,
        hooks: [],
    },
    'gemini': {
        permissions: GEMINI_DEFAULT_PERMISSIONS,
        env: GEMINI_DEFAULT_ENV,
        hooks: [],
    },
};

/** 默认通用设置 */
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    language: 'Chinese',
    theme: 'system',
    showSystemInitialization: true,
    showAllToolResults: true,
    verbose: false,
    hideAutoContinueMessages: false,
    hideStartupWarnings: false,
};

/** 深拷贝引擎设置 */
function deepCopyEngineSettings(settings: EngineSettings): EngineSettings {
    return {
        permissions: {
            allow: [...settings.permissions.allow],
            deny: [...settings.permissions.deny],
        },
        env: { ...settings.env },
        hooks: [...settings.hooks],
    };
}

/** 创建默认的多引擎设置 */
export function createDefaultMultiEngineSettings(): MultiEngineSettingsStore {
    return {
        version: 2,
        activeEngine: 'claude-code',
        engines: {
            'claude-code': deepCopyEngineSettings(DEFAULT_ENGINE_SETTINGS['claude-code']),
            'codex': deepCopyEngineSettings(DEFAULT_ENGINE_SETTINGS['codex']),
            'gemini': deepCopyEngineSettings(DEFAULT_ENGINE_SETTINGS['gemini']),
        },
        general: { ...DEFAULT_GENERAL_SETTINGS },
        lastUpdated: Date.now(),
    };
}

// =============================================================================
// 旧版设置格式（用于迁移）
// =============================================================================

/** 旧版 Claude 设置格式 */
export interface LegacyClaudeSettings {
    permissions?: {
        allow?: string[];
        deny?: string[];
    };
    env?: Record<string, string>;
    hooks?: any;
    language?: string;
    showSystemInitialization?: boolean;
    showAllToolResults?: boolean;
    verbose?: boolean;
    hideAutoContinueMessages?: boolean;
    hideStartupWarnings?: boolean;
    model?: string;
    permissionMode?: string;
}

/** 检查是否为旧版设置格式 */
export function isLegacySettings(settings: any): settings is LegacyClaudeSettings {
    return settings && typeof settings === 'object' && !('version' in settings);
}

/** 检查是否为新版多引擎设置格式 */
export function isMultiEngineSettings(settings: any): settings is MultiEngineSettingsStore {
    return settings && typeof settings === 'object' && settings.version === 2;
}
