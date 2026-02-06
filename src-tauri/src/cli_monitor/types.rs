// CLI 监控系统 - 数据结构定义
// 用于窗口扫描和会话管理

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ============ 原有类型定义（会话扫描） ============

/// CLI 会话信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliSession {
    pub session_id: String,
    pub project_path: String,
    pub git_branch: Option<String>,
    pub summary: Option<String>,
    pub message_count: u32,
    pub created: i64,
    pub modified: i64,
    pub is_active: bool,
}

/// 会话元数据（从 sessions-index.json 读取）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMetadata {
    pub session_id: String,
    pub project_path: String,
    pub git_branch: Option<String>,
    pub summary: Option<String>,
    pub message_count: u32,
    pub created: String,  // ISO 8601 格式
    pub modified: String, // ISO 8601 格式
}

/// 会话索引
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionsIndex {
    pub version: u32,
    pub entries: Vec<SessionMetadata>,
}

/// 进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cmd: Vec<String>,
    pub session_id: Option<String>,
}

/// 扫描结果（会话扫描）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub sessions: Vec<CliSession>,
    pub scanned_at: i64,
}

// ============ 新类型定义（窗口扫描） ============

/// 窗口信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    /// 窗口句柄（Windows HWND）
    pub hwnd: isize,

    /// 窗口标题
    pub title: String,

    /// 进程 ID
    pub process_id: u32,

    /// 可执行文件路径
    pub exe_path: Option<String>,

    /// 项目路径（从 exe_path 推断）
    pub project_path: Option<String>,

    /// 最后活动时间
    pub last_active: DateTime<Utc>,

    /// 会话 ID（从进程命令行提取）
    pub session_id: Option<String>,

    /// 会话摘要（来自 sessions-index.json）
    pub session_summary: Option<String>,
}

/// 窗口扫描结果结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowScanResult {
    /// 扫描到的窗口列表
    pub windows: Vec<WindowInfo>,

    /// 扫描时间
    pub scan_time: DateTime<Utc>,

    /// 总数量
    pub total_count: usize,
}

impl WindowScanResult {
    /// 创建新的扫描结果
    pub fn new(windows: Vec<WindowInfo>) -> Self {
        let total_count = windows.len();
        Self {
            windows,
            scan_time: Utc::now(),
            total_count,
        }
    }

    /// 创建空的扫描结果
    pub fn empty() -> Self {
        Self {
            windows: Vec::new(),
            scan_time: Utc::now(),
            total_count: 0,
        }
    }
}
