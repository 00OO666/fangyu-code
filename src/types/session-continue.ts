/**
 * 智能会话续接类型定义
 *
 * @author Claude Opus 4.5
 * @version 1.0.0
 */

/**
 * 会话续接配置
 */
export interface SessionContinueConfig {
  /** 当前会话 ID */
  sessionId?: string;
  /** 项目路径 */
  projectPath?: string;
  /** 触发阈值（默认 0.75 = 75%） */
  threshold?: number;
  /** 自动切换还是询问用户（默认 true） */
  autoSwitch?: boolean;
  /** 摘要中保留的最近消息数（默认 10） */
  recentMessagesCount?: number;
  /** 是否保留旧会话（默认 true） */
  keepOldSession?: boolean;
  /** 摘要详细程度 */
  summaryVerbosity?: 'concise' | 'detailed';
  /** 上下文使用率（0-1） */
  contextUsage?: number;
}

/**
 * 会话摘要
 */
export interface SessionSummary {
  /** 原会话 ID */
  sessionId: string;
  /** 项目信息 */
  project: {
    path: string;
    name: string;
    techStack?: string[];
  };
  /** TodoList 状态 */
  todoList?: {
    completed: TaskSummary[];
    inProgress: TaskSummary[];
    pending: TaskSummary[];
  };
  /** 修改文件列表 */
  modifiedFiles: FileSummary[];
  /** 关键决策 */
  keyDecisions: string[];
  /** 最近重要消息 */
  recentMessages: MessageSummary[];
  /** 生成时间 */
  generatedAt: number;
  /** 摘要文本（Markdown 格式） */
  summaryText: string;
}

/**
 * 任务摘要
 */
export interface TaskSummary {
  id: string;
  content: string;
  status: 'completed' | 'in_progress' | 'pending';
  progress?: number;
}

/**
 * 文件摘要
 */
export interface FileSummary {
  path: string;
  operation: 'created' | 'modified' | 'deleted';
  description: string;
}

/**
 * 消息摘要
 */
export interface MessageSummary {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  important: boolean;
}

/**
 * 会话续接状态
 */
export type SessionContinueStatus =
  | 'idle'           // 空闲
  | 'generating'     // 生成摘要中
  | 'ready'          // 准备就绪
  | 'creating'       // 创建新会话中
  | 'switching'      // 切换中
  | 'completed'      // 完成
  | 'error';         // 错误

/**
 * Hook 返回值
 */
export interface UseSmartSessionContinueReturn {
  /** 当前状态 */
  status: SessionContinueStatus;
  /** 是否应该续接 */
  shouldContinue: boolean;
  /** 生成的摘要 */
  summary: SessionSummary | null;
  /** 新会话 ID */
  newSessionId: string | null;
  /** 执行续接 */
  continueTo: () => Promise<void>;
  /** 取消续接 */
  cancel: () => void;
  /** 手动触发生成摘要 */
  generateSummary: () => Promise<void>;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: string | null;
}
