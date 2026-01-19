/**
 * Kiro API 集成 - 类型定义
 * 
 * 基于 Amazon Q Developer / CodeWhisperer API 逆向工程
 * 日期: 2026-01-16
 */

// ==================== Token 相关 ====================

/**
 * Kiro SSO Token 结构
 * 存储位置: ~/.aws/sso/cache/kiro-auth-token.json
 */
export interface KiroToken {
  accessToken: string;
  expiresAt: string;      // ISO 8601 格式，如 "2026-01-16T01:47:43.813472600+00:00"
  region: string;         // AWS 区域，如 "us-east-1"
  profileArn?: string;    // IAM Identity Center 才有此字段
}

/**
 * Token 状态信息
 */
export interface KiroTokenStatus {
  isValid: boolean;
  expiresIn: number;      // 剩余秒数
  region: string;
  accountType: KiroAccountType;
}

/**
 * Kiro 账户类型
 */
export type KiroAccountType = 'builders-id' | 'iam-identity-center';

// ==================== 模型相关 ====================

/**
 * Kiro 模型信息
 */
export interface KiroModel {
  id: string;                                    // CodeWhisperer modelId
  name: string;                                  // 显示名称
  description: string;                           // 描述
  maxOutputTokens: number;                       // 最大输出 Token
  supportedBy: KiroAccountType[];                // 支持的账户类型
}

/**
 * CodeWhisperer 模型 ID 常量
 */
export const KIRO_MODEL_IDS = {
  OPUS_45: 'claude-opus-4.5',
  SONNET_45: 'CLAUDE_SONNET_4_5_20250929_V1_0',
  SONNET_4: 'CLAUDE_SONNET_4_20250514_V1_0',
  HAIKU_45: 'claude-haiku-4.5',
} as const;

/**
 * 预定义的 Kiro 模型列表
 */
export const KIRO_MODELS: KiroModel[] = [
  {
    id: KIRO_MODEL_IDS.OPUS_45,
    name: 'Claude Opus 4.5',
    description: '最强大，推理能力最强',
    maxOutputTokens: 16384,
    supportedBy: ['builders-id'],
  },
  {
    id: KIRO_MODEL_IDS.SONNET_45,
    name: 'Claude Sonnet 4.5',
    description: '平衡性能和速度',
    maxOutputTokens: 16384,
    supportedBy: ['builders-id', 'iam-identity-center'],
  },
  {
    id: KIRO_MODEL_IDS.SONNET_4,
    name: 'Claude Sonnet 4',
    description: '上一代 Sonnet',
    maxOutputTokens: 16384,
    supportedBy: ['builders-id', 'iam-identity-center'],
  },
  {
    id: KIRO_MODEL_IDS.HAIKU_45,
    name: 'Claude Haiku 4.5',
    description: '最快速，适合简单任务',
    maxOutputTokens: 8192,
    supportedBy: ['builders-id', 'iam-identity-center'],
  },
];

// ==================== 聊天相关 ====================

/**
 * 聊天消息
 */
export interface KiroChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 聊天选项
 */
export interface KiroChatOptions {
  modelId?: string;
  conversationId?: string;
  history?: KiroChatMessage[];
  onChunk?: (chunk: string) => void;  // 流式回调
}

/**
 * 聊天响应
 */
export interface KiroChatResponse {
  content: string;
  conversationId: string;
  modelUsed?: string;
}

// ==================== 配置相关 ====================

/**
 * Kiro 引擎配置
 */
export interface KiroEngineConfig {
  tokenPath?: string;     // Token 文件路径，默认 ~/.aws/sso/cache/kiro-auth-token.json
  modelId?: string;       // 默认模型 ID
  region?: string;        // 覆盖 Token 中的 region（可选）
}

/**
 * Kiro 代理商配置（用于 UnifiedProviderConfig）
 */
export interface KiroProviderConfig {
  tokenPath: string;
  modelId: string;
  region?: string;
}

// ==================== API 请求/响应 ====================

/**
 * API 请求体中的用户消息
 */
export interface KiroUserInputMessage {
  content: string;
  origin: 'AI_EDITOR';
  modelId?: string;
}

/**
 * API 请求体中的会话状态
 */
export interface KiroConversationState {
  chatTriggerType: 'MANUAL';
  conversationId: string;
  currentMessage: {
    userInputMessage: KiroUserInputMessage;
  };
  history?: Array<{
    userInputMessage?: { content: string };
    assistantResponseMessage?: { content: string };
  }>;
}

/**
 * API 请求体
 */
export interface KiroApiRequestBody {
  conversationState: KiroConversationState;
  profileArn?: string;
}

/**
 * API 请求头
 */
export interface KiroApiHeaders {
  'Content-Type': 'application/json';
  'Authorization': string;
  'User-Agent': string;
  'Accept': 'application/json';
  'x-amzn-kiro-agent-mode': 'vibe';
}

// ==================== 验证结果 ====================

/**
 * 配置验证结果
 */
export interface KiroValidationResult {
  valid: boolean;
  error?: string;
  tokenStatus?: KiroTokenStatus;
}

// ==================== 常量 ====================

/**
 * 默认 Token 文件路径
 */
export const DEFAULT_KIRO_TOKEN_PATH = '~/.aws/sso/cache/kiro-auth-token.json';

/**
 * API 端点模板
 */
export const KIRO_API_ENDPOINT_TEMPLATE = 'https://q.{region}.amazonaws.com/generateAssistantResponse';

/**
 * 默认 User-Agent
 */
export const KIRO_USER_AGENT = 'KiroIDE 0.7.5';

/**
 * 重试配置
 */
export const KIRO_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
};
