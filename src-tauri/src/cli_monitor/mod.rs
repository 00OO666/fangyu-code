pub mod process_detector;
pub mod scanner;
pub mod types;
pub mod window_scanner;
pub mod window_focuser;

use process_detector::ProcessDetector;
use scanner::SessionScanner;
use std::sync::Mutex;
use types::{CliSession, ProcessInfo, ScanResult, WindowScanResult};

// 重新导出窗口扫描相关类型
pub use window_scanner::WindowScanner;
pub use window_focuser::WindowFocuser;

/// CLI 监控状态
pub struct CliMonitorState {
    scanner: Mutex<SessionScanner>,
    detector: Mutex<ProcessDetector>,
    window_scanner: Mutex<WindowScanner>,
}

impl CliMonitorState {
    pub fn new() -> Self {
        Self {
            scanner: Mutex::new(SessionScanner::new()),
            detector: Mutex::new(ProcessDetector::new()),
            window_scanner: Mutex::new(WindowScanner::new()),
        }
    }
}

/// 扫描所有 CLI 会话
#[tauri::command]
pub fn scan_cli_sessions(state: tauri::State<CliMonitorState>) -> Result<ScanResult, String> {
    let scanner = state.scanner.lock().unwrap();
    let mut sessions = scanner.scan_sessions()?;

    // 获取运行中的进程
    let mut detector = state.detector.lock().unwrap();
    let processes = detector.get_running_processes();

    // 更新会话的活跃状态
    let active_session_ids: std::collections::HashSet<String> = processes
        .iter()
        .filter_map(|p| p.session_id.clone())
        .collect();

    for session in &mut sessions {
        session.is_active = active_session_ids.contains(&session.session_id);
    }

    Ok(ScanResult {
        sessions,
        scanned_at: chrono::Utc::now().timestamp(),
    })
}

/// 获取运行中的进程列表
#[tauri::command]
pub fn get_running_processes(state: tauri::State<CliMonitorState>) -> Result<Vec<ProcessInfo>, String> {
    let mut detector = state.detector.lock().unwrap();
    Ok(detector.get_running_processes())
}

/// 监听会话变化（前端轮询实现）
#[tauri::command]
pub fn watch_sessions(state: tauri::State<CliMonitorState>) -> Result<Vec<CliSession>, String> {
    let scanner = state.scanner.lock().unwrap();
    scanner.scan_sessions()
}

/// 扫描所有 Claude CLI 窗口
#[tauri::command]
pub fn scan_windows(state: tauri::State<CliMonitorState>) -> Result<WindowScanResult, String> {
    let mut window_scanner = state.window_scanner.lock().unwrap();
    window_scanner.scan().map_err(|e| e.to_string())
}

/// 聚焦指定窗口
#[tauri::command]
pub fn focus_window(hwnd: isize) -> Result<(), String> {
    WindowFocuser::focus_window(hwnd).map_err(|e| e.to_string())
}
