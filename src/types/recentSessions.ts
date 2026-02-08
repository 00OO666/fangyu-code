/**
 * Session snapshot used by recent sessions management.
 */
export interface SessionSnapshot {
  /**
   * Unique session id.
   */
  id: string;
  /**
   * Project path associated with this session.
   */
  projectPath: string;
  /**
   * Engine/model used in this session.
   */
  engine: 'claude' | 'codex' | 'gemini';
  /**
   * Display title of the session.
   */
  title: string;
  /**
   * Last activity timestamp (Unix milliseconds).
   */
  timestamp: number;
  /**
   * Total message count in this session.
   */
  messageCount: number;
  /**
   * Preview text of the latest message.
   */
  lastMessage: string;
  /**
   * Optional icon for the engine.
   */
  icon?: string;
}

/**
 * State shape for recent sessions.
 */
export interface RecentSessionsState {
  /**
   * Recent session snapshots sorted by recency.
   */
  sessions: SessionSnapshot[];
  /**
   * Currently active session id.
   */
  currentSessionId: string | null;
  /**
   * Maximum number of sessions to keep.
   */
  limit: number;
}
