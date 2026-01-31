/**
 * CLI 监控模块类型定义
 * 对应 Rust 后端的 cli_monitor 模块
 */

/**
 * CLI 会话信息
 */
export interface CliSession {
  /** 会话 ID */
  session_id: string;
  /** 项目路径 */
  project_path: string;
  /** Git 分支名称 */
  git_branch: string | null;
  /** 会话摘要 */
  summary: string;
  /** 消息数量 */
  message_count: number;
  /** 创建时间戳（秒） */
  created: number;
  /** 修改时间戳（秒） */
  modified: number;
  /** 是否活跃（进程正在运行） */
  is_active: boolean;
}

/**
 * 会话元数据（从 sessions-index.json 读取）
 */
export interface SessionMetadata {
  /** 会话 ID */
  session_id: string;
  /** 会话摘要 */
  summary: string;
  /** 消息数量 */
  message_count: number;
  /** 创建时间戳 */
  created: number;
  /** 修改时间戳 */
  modified: number;
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  /** 进程 ID */
  pid: number;
  /** 进程名称 */
  name: string;
  /** 命令行参数 */
  cmd: string[];
  /** 会话 ID（如果是 Claude Code CLI 进程） */
  session_id: string | null;
}

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 所有会话列表 */
  sessions: CliSession[];
  /** 扫描时间戳 */
  scanned_at: number;
}

/**
 * 网格视图配置
 */
export interface GridViewConfig {
  /** 行数 */
  rows: number;
  /** 列数 */
  cols: number;
  /** 显示模式 */
  mode: 'compact' | 'comfortable' | 'spacious';
}

/**
 * 会话过滤器
 */
export interface SessionFilter {
  /** 搜索关键词 */
  keyword?: string;
  /** 只显示活跃会话 */
  activeOnly?: boolean;
  /** 项目路径过滤 */
  projectPath?: string;
  /** Git 分支过滤 */
  gitBranch?: string;
}

/**
 * 会话排序选项
 */
export type SessionSortBy = 'modified' | 'created' | 'message_count' | 'project_path';

/**
 * 排序方向
 */
export type SortDirection = 'asc' | 'desc';

/**
 * 视图模式
 */
export type ViewMode = 'normal' | 'cli-monitor';

/**
 * 会话颜色标识
 */
export interface SessionColor {
  /** 会话 ID */
  session_id: string;
  /** 颜色代码（Tailwind 颜色类名） */
  color: string;
}

/**
 * 窗口信息
 */
export interface WindowInfo {
  /** 窗口句柄（Windows HWND） */
  hwnd: number;
  /** 窗口标题 */
  title: string;
  /** 进程 ID */
  process_id: number;
  /** 可执行文件路径 */
  exe_path: string | null;
  /** 项目路径（从 exe_path 推断） */
  project_path: string | null;
  /** 最后活动时间 */
  last_active: string;
}

/**
 * 窗口扫描结果
 */
export interface WindowScanResult {
  /** 扫描到的窗口列表 */
  windows: WindowInfo[];
  /** 扫描时间 */
  scan_time: string;
  /** 总数量 */
  total_count: number;
}
