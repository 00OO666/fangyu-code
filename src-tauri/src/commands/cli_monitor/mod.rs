//! CLI 监控模块
//!
//! 提供 Claude Code CLI 会话的监控和管理功能
//!
//! # 主要功能
//! - 扫描和检测正在运行的 CLI 会话
//! - 实时监控会话文件变化
//! - 追踪会话状态和任务状态
//! - 缓存会话数据以提升性能
//!
//! # 示例
//! ```rust
//! use cli_monitor::SessionReader;
//!
//! let reader = SessionReader::new()?;
//! let sessions = reader.scan_all_sessions()?;
//! ```

// 声明子模块
mod process_scanner;
mod session_reader;
pub mod types;
mod utils;

// 导出公共 API
pub use process_scanner::ProcessScanner;
pub use session_reader::SessionReader;
pub use types::{SessionInfo, SessionStatus};

// Tauri Commands
use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::debug;

/// CLI 监控管理器状态
pub struct CLIMonitorState {
    session_reader: Arc<RwLock<SessionReader>>,
    process_scanner: Arc<RwLock<ProcessScanner>>,
}

impl CLIMonitorState {
    /// 创建新的 CLI 监控状态
    pub fn new() -> Result<Self, String> {
        let session_reader = SessionReader::new()?;
        let process_scanner = ProcessScanner::new();

        Ok(Self {
            session_reader: Arc::new(RwLock::new(session_reader)),
            process_scanner: Arc::new(RwLock::new(process_scanner)),
        })
    }
}

/// 扫描所有 CLI 会话
///
/// # 返回
/// - `Ok(Vec<SessionInfo>)`: 成功时返回会话列表
/// - `Err(String)`: 失败时返回错误信息
#[tauri::command]
pub async fn cli_monitor_scan_sessions(
    state: State<'_, CLIMonitorState>,
) -> Result<Vec<SessionInfo>, String> {
    debug!("Tauri command: cli_monitor_scan_sessions");

    let reader = state.session_reader.read().await;
    let mut sessions = reader.scan_all_sessions()?;

    // 获取正在运行的进程
    let scanner = state.process_scanner.read().await;
    let has_running_processes = scanner.has_running_processes();

    debug!("Has running Claude processes: {}", has_running_processes);

    // 根据进程状态和文件修改时间判断活跃会话
    for session in &mut sessions {
        // 如果最近 5 分钟内有更新，标记为活跃
        let is_recently_modified = utils::is_recently_modified(
            session.last_modified_timestamp,
            300, // 5 分钟
        );

        session.is_active = is_recently_modified || has_running_processes;
    }

    // 按最后修改时间排序（最新的在前面）
    sessions.sort_by(|a, b| {
        b.last_modified_timestamp.cmp(&a.last_modified_timestamp)
    });

    debug!("Returning {} sessions", sessions.len());

    Ok(sessions)
}

/// 获取单个会话的详细信息
///
/// # 参数
/// - `session_id`: 会话 ID
///
/// # 返回
/// - `Ok(SessionInfo)`: 成功时返回会话信息
/// - `Err(String)`: 失败时返回错误信息
#[tauri::command]
pub async fn cli_monitor_get_session_detail(
    session_id: String,
    state: State<'_, CLIMonitorState>,
) -> Result<SessionInfo, String> {
    debug!("Tauri command: cli_monitor_get_session_detail({})", session_id);

    let reader = state.session_reader.read().await;
    reader.get_session_detail(&session_id)
}

/// 获取会话状态
///
/// # 参数
/// - `session_id`: 会话 ID
///
/// # 返回
/// - `Ok(SessionStatus)`: 成功时返回会话状态
/// - `Err(String)`: 失败时返回错误信息
#[tauri::command]
pub async fn cli_monitor_get_session_status(
    session_id: String,
    state: State<'_, CLIMonitorState>,
) -> Result<SessionStatus, String> {
    debug!("Tauri command: cli_monitor_get_session_status({})", session_id);

    let reader = state.session_reader.read().await;
    let session = reader.get_session_detail(&session_id)?;

    let current_timestamp = utils::get_current_timestamp();
    let elapsed = current_timestamp.saturating_sub(session.last_modified_timestamp);

    // 根据时间判断状态
    let status = if elapsed < 300 {
        SessionStatus::Active
    } else if elapsed < 1800 {
        SessionStatus::Idle
    } else {
        SessionStatus::Inactive
    };

    Ok(status)
}

/// 搜索会话
///
/// # 参数
/// - `query`: 搜索关键词
///
/// # 返回
/// - `Ok(Vec<SessionInfo>)`: 成功时返回匹配的会话列表
/// - `Err(String)`: 失败时返回错误信息
#[tauri::command]
pub async fn cli_monitor_search_sessions(
    query: String,
    state: State<'_, CLIMonitorState>,
) -> Result<Vec<SessionInfo>, String> {
    debug!("Tauri command: cli_monitor_search_sessions({})", query);

    let sessions = cli_monitor_scan_sessions(state).await?;

    let query_lower = query.to_lowercase();

    let filtered: Vec<SessionInfo> = sessions
        .into_iter()
        .filter(|s| {
            s.project_name.to_lowercase().contains(&query_lower)
                || s.git_branch.to_lowercase().contains(&query_lower)
                || s.summary.to_lowercase().contains(&query_lower)
        })
        .collect();

    debug!("Found {} matching sessions", filtered.len());

    Ok(filtered)
}

/// 获取正在运行的进程数量
///
/// # 返回
/// - `Ok(usize)`: 成功时返回进程数量
/// - `Err(String)`: 失败时返回错误信息
#[tauri::command]
pub async fn cli_monitor_get_process_count(
    state: State<'_, CLIMonitorState>,
) -> Result<usize, String> {
    debug!("Tauri command: cli_monitor_get_process_count");

    let scanner = state.process_scanner.read().await;
    let count = scanner.get_process_count();

    debug!("Found {} Claude processes", count);

    Ok(count)
}
