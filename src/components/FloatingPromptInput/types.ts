import { ReactNode } from "react";

/**
 * Model type definition
 */
export type ModelType = "sonnet" | "opus" | "sonnet1m" | "custom";

/**
 * Thinking mode type definition
 * Simplified to on/off (conforming to official Claude Code standard)
 */
export type ThinkingMode = "off" | "on";

/**
 * Model configuration
 */
export interface ModelConfig {
  id: ModelType;
  name: string;
  description: string;
  icon: ReactNode;
}

/**
 * Thinking mode configuration
 */
export interface ThinkingModeConfig {
  id: ThinkingMode;
  name: string;
  description: string;
  level: number; // 0-5 for visual indicator
  tokens?: number; // Maximum thinking tokens (undefined = no extended thinking)
}

/**
 * Image attachment interface
 */
export interface ImageAttachment {
  id: string;
  filePath: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Execution engine configuration (re-export from ExecutionEngineSelector)
 */
export type ExecutionEngineConfig = import('@/components/ExecutionEngineSelector').ExecutionEngineConfig;

/**
 * Floating prompt input props
 */
export interface FloatingPromptInputProps {
  /**
   * Callback when prompt is sent - includes maxThinkingTokens separately
   * 🔧 FIX: 支持异步回调，等待完成后再清空输入框，防止消息丢失
   * 🆕 forceImmediate: 强制立即发送（插队模式），绕过队列检查
   */
  onSend: (prompt: string, model: ModelType, maxThinkingTokens?: number, forceImmediate?: boolean) => void | Promise<void>;
  /**
   * Whether the input is loading
   */
  isLoading?: boolean;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Default model to select
   */
  defaultModel?: ModelType;
  /**
   * Model from session (for restoring model selection on page reload)
   */
  sessionModel?: string;
  /**
   * Project path for file picker
   */
  projectPath?: string;
  /**
   * 🆕 Session ID (for history-aware context search)
   */
  sessionId?: string;
  /**
   * 🆕 Project ID (for history-aware context search)
   */
  projectId?: string;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when cancel is clicked (only during loading)
   */
  onCancel?: () => void;
  /**
   * Optional function to get conversation context for prompt enhancement
   */
  getConversationContext?: () => string[];
  /**
   * 🆕 Complete message list (for dual API context extraction)
   */
  messages?: import("@/types/claude").ClaudeStreamMessage[];
  /**
   * Whether Plan Mode is enabled
   */
  isPlanMode?: boolean;
  /**
   * Callback when Plan Mode is toggled
   */
  onTogglePlanMode?: () => void;
  /**
   * Session cost for display (formatted string like "$0.05")
   */
  sessionCost?: string;
  /**
   * Detailed session statistics (optional)
   */
  sessionStats?: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    durationSeconds: number;
    apiDurationSeconds: number;
  };
  /**
   * Whether there are messages (to show cost display)
   */
  hasMessages?: boolean;
  /**
   * 🆕 Complete session information (for export)
   */
  session?: import("@/lib/api").Session;
  /**
   * ?? Codex rate limits (for live badge updates)
   */
  codexRateLimits?: import("@/types/codex").CodexRateLimits | null;
  /**
   * 🆕 Execution engine configuration (optional, for Codex integration)
   */
  executionEngineConfig?: ExecutionEngineConfig;
  /**
   * 🆕 Callback when execution engine config changes
   */
  onExecutionEngineConfigChange?: (config: ExecutionEngineConfig) => void;
  /**
   * 🆕 Callback when Canvas button is clicked
   */
  onOpenCanvas?: () => void;
  /**
   * 🆕 是否检测到可预览代码
   */
  hasPreviewableCode?: boolean;
  /**
   * 🆕 代码来源
   */
  codeSource?: 'markdown' | 'tool_use';
  /**
   * 🆕 Callback when Usage Dashboard is toggled
   */
  onToggleUsageDashboard?: () => void;
  /**
   * 🆕 Whether Usage Dashboard is visible
   */
  showUsageDashboard?: boolean;
  /**
   * 🆕 Callback when MCP Quick Config button is clicked
   */
  onToggleMCPConfig?: () => void;
  /**
   * 🆕 后台压缩状态（Invisible UX）
   */
  compactStatus?: import('@/hooks/useBackgroundCompact').CompactStatus;
  /**
   * 🆕 是否正在后台压缩
   */
  isCompacting?: boolean;
  /**
   * 🆕 压缩进度（0-100）
   */
  compactProgress?: number;
  /**
   * 🆕 增量消息数量（压缩期间捕获的新消息）
   */
  deltaMessagesCount?: number;
}

/**
 * Floating prompt input ref interface
 */
export interface FloatingPromptInputRef {
  addImage: (imagePath: string) => void;
  setPrompt: (text: string) => void;
}
