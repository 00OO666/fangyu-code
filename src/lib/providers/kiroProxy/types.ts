/**
 * Kiro Proxy Provider 类型定义
 * 
 * 将 Kiro Claude Proxy v2.0 的 tool_use 功能集成到 Fangyu Code
 */

// ============================================================
// Provider 配置
// ============================================================

export interface KiroProxyConfig {
  /** Kiro Token (从 ~/.aws/sso/cache/kiro-auth-token.json 读取) */
  token: string;
  /** 工作区根目录 */
  workspaceRoot: string;
  /** 最大循环迭代次数 (默认 20) */
  maxLoopIterations: number;
  /** 超时时间 (毫秒, 默认 300000 = 5分钟) */
  timeoutMs: number;
  /** 模型 ID */
  model: string;
}

// ============================================================
// 工具定义
// ============================================================

export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

// ============================================================
// 工具调用
// ============================================================

export interface ToolCall {
  /** 唯一 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  input: Record<string, unknown>;
}

export interface ToolResult {
  /** 是否成功 */
  success: boolean;
  /** 结果内容 */
  content: string;
  /** 错误信息 */
  error?: string;
}

// ============================================================
// 解析结果
// ============================================================

export interface ParseResult {
  /** 纯文本部分 */
  text: string;
  /** 工具调用列表 */
  toolCalls: ToolCall[];
  /** 是否包含工具调用 */
  hasToolCall: boolean;
}

// ============================================================
// 消息格式
// ============================================================

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ============================================================
// Agent 循环
// ============================================================

export interface AgentLoopConfig {
  maxIterations: number;
  timeoutMs: number;
}

export interface AgentLoopState {
  iteration: number;
  messages: Message[];
  toolResults: ToolResult[];
  startTime: number;
}

export type AgentLoopEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; result: ToolResult; toolCallId: string }
  | { type: 'done'; finalResponse: string }
  | { type: 'error'; error: Error };

// ============================================================
// 执行上下文
// ============================================================

export interface ExecutionContext {
  workspaceRoot: string;
  currentFile?: string;
  env: Record<string, string>;
}

// ============================================================
// 工具处理器
// ============================================================

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ExecutionContext
) => Promise<ToolResult>;

// ============================================================
// API 请求/响应
// ============================================================

export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  system?: string;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ChatChunk {
  type: 'content_block_delta' | 'content_block_start' | 'content_block_stop' | 'message_delta' | 'message_stop';
  index?: number;
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  content_block?: ContentBlock;
}

// ============================================================
// 错误响应
// ============================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
