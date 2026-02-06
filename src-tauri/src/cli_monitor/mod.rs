pub mod process_detector;
pub mod scanner;
pub mod types;
pub mod window_scanner;
pub mod window_focuser;
pub mod file_watcher;
pub mod content_reader;
pub mod input_injector;
pub mod process_communicator;

use process_detector::ProcessDetector;
use scanner::SessionScanner;
use file_watcher::FileSystemWatcher;
use content_reader::SessionContentReader;
use input_injector::InputInjector;
use process_communicator::ProcessCommunicator;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use types::{CliSession, ProcessInfo, ScanResult, WindowScanResult};

// 重新导出窗口扫描相关类型
pub use window_scanner::WindowScanner;
pub use window_focuser::WindowFocuser;
pub use file_watcher::{FileChangeEvent, FileChangeType};
pub use content_reader::{SessionContent, SessionMessage};
pub use process_communicator::ProcessOutput;

/// CLI 监控状态
pub struct CliMonitorState {
    scanner: Mutex<SessionScanner>,
    detector: Mutex<ProcessDetector>,
    window_scanner: Mutex<WindowScanner>,
    file_watcher: Mutex<FileSystemWatcher>,
    input_injector: Mutex<InputInjector>,
    process_communicator: Mutex<ProcessCommunicator>,
}

impl CliMonitorState {
    pub fn new() -> Self {
        Self {
            scanner: Mutex::new(SessionScanner::new()),
            detector: Mutex::new(ProcessDetector::new()),
            window_scanner: Mutex::new(WindowScanner::new()),
            file_watcher: Mutex::new(FileSystemWatcher::new()),
            input_injector: Mutex::new(InputInjector::new()),
            process_communicator: Mutex::new(ProcessCommunicator::new()),
        }
    }
}

fn claude_projects_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home_dir.join(".claude").join("projects"))
}

fn validate_working_dir(working_dir: &str) -> Result<PathBuf, String> {
    let claude_dir = claude_projects_dir()?;
    let claude_dir = std::fs::canonicalize(&claude_dir)
        .map_err(|e| format!("Failed to resolve Claude projects directory: {}", e))?;

    let working_path = std::fs::canonicalize(Path::new(working_dir))
        .map_err(|e| format!("Invalid working directory: {}", e))?;

    if !working_path.starts_with(&claude_dir) {
        return Err("Working directory must be under ~/.claude/projects".to_string());
    }

    Ok(working_path)
}

fn validate_command(command: &str) -> Result<(), String> {
    let file_name = Path::new(command)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid command")?
        .to_lowercase();
    if file_name != "claude" && file_name != "claude.exe" {
        return Err("Only the 'claude' command is allowed".to_string());
    }
    Ok(())
}

/// 扫描所有 CLI 会话
#[tauri::command]
pub fn scan_cli_sessions(state: tauri::State<CliMonitorState>) -> Result<ScanResult, String> {
    let scanner = state
        .scanner
        .lock()
        .map_err(|_| "Scanner lock poisoned".to_string())?;
    let mut sessions = scanner.scan_sessions()?;

    // 获取运行中的进程
    let mut detector = state
        .detector
        .lock()
        .map_err(|_| "Process detector lock poisoned".to_string())?;
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
    let mut detector = state
        .detector
        .lock()
        .map_err(|_| "Process detector lock poisoned".to_string())?;
    Ok(detector.get_running_processes())
}

/// 监听会话变化（前端轮询实现）
#[tauri::command]
pub fn watch_sessions(state: tauri::State<CliMonitorState>) -> Result<Vec<CliSession>, String> {
    let scanner = state
        .scanner
        .lock()
        .map_err(|_| "Scanner lock poisoned".to_string())?;
    scanner.scan_sessions()
}

/// 扫描所有 Claude CLI 窗口
#[tauri::command]
pub fn scan_windows(state: tauri::State<CliMonitorState>) -> Result<WindowScanResult, String> {
    let mut window_result = {
        let mut window_scanner = state
            .window_scanner
            .lock()
            .map_err(|_| "Window scanner lock poisoned".to_string())?;
        window_scanner.scan().map_err(|e| e.to_string())?
    };

    let sessions = {
        let scanner = state
            .scanner
            .lock()
            .map_err(|_| "Scanner lock poisoned".to_string())?;
        scanner.scan_sessions()?
    };

    let mut session_map: HashMap<String, Option<String>> = HashMap::new();
    let mut project_map: HashMap<String, (Option<String>, i64)> = HashMap::new();

    for session in sessions {
        session_map.insert(session.session_id.clone(), session.summary.clone());

        let entry = project_map
            .entry(session.project_path.clone())
            .or_insert((session.summary.clone(), session.modified));
        if session.modified > entry.1 {
            *entry = (session.summary.clone(), session.modified);
        }
    }

    for window in &mut window_result.windows {
        if let Some(session_id) = &window.session_id {
            if let Some(summary) = session_map.get(session_id) {
                window.session_summary = summary.clone();
            }
        }
        if window.session_summary.is_none() {
            if let Some(project_path) = &window.project_path {
                if let Some((summary, _)) = project_map.get(project_path) {
                    window.session_summary = summary.clone();
                }
            }
        }
    }

    Ok(window_result)
}

/// 聚焦指定窗口
#[tauri::command]
pub fn focus_window(hwnd: isize) -> Result<(), String> {
    WindowFocuser::focus_window(hwnd).map_err(|e| e.to_string())
}

/// 开始监控文件系统变化
#[tauri::command]
pub fn start_file_watching(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let mut file_watcher = state
        .file_watcher
        .lock()
        .map_err(|_| "File watcher lock poisoned".to_string())?;

    let claude_dir = claude_projects_dir()?;
    if !claude_dir.exists() {
        return Err("Claude projects directory not found".to_string());
    }

    file_watcher.start_watching(claude_dir)
}

/// 停止监控文件系统变化
#[tauri::command]
pub fn stop_file_watching(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let mut file_watcher = state
        .file_watcher
        .lock()
        .map_err(|_| "File watcher lock poisoned".to_string())?;
    file_watcher.stop_watching()
}

/// 获取文件变化事件
#[tauri::command]
pub fn get_file_events(state: tauri::State<CliMonitorState>) -> Result<Vec<FileChangeEvent>, String> {
    let file_watcher = state
        .file_watcher
        .lock()
        .map_err(|_| "File watcher lock poisoned".to_string())?;
    Ok(file_watcher.get_events())
}

/// 检查是否正在监控
#[tauri::command]
pub fn is_file_watching(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let file_watcher = state
        .file_watcher
        .lock()
        .map_err(|_| "File watcher lock poisoned".to_string())?;
    Ok(file_watcher.is_watching())
}

/// 读取会话内容
#[tauri::command]
pub fn read_session_content(session_id: String) -> Result<SessionContent, String> {
    SessionContentReader::read_session_content(&session_id)
}

/// 读取会话的最后 N 条消息
#[tauri::command]
pub fn read_last_messages(session_id: String, count: usize) -> Result<SessionContent, String> {
    SessionContentReader::read_last_messages(&session_id, count)
}

/// 获取会话摘要
#[tauri::command]
pub fn get_session_summary(session_id: String, max_chars: usize) -> Result<String, String> {
    SessionContentReader::get_session_summary(&session_id, max_chars)
}

/// 启动 Claude CLI 进程并准备输入注入
#[tauri::command]
pub fn start_input_injection(state: tauri::State<CliMonitorState>, working_dir: String) -> Result<(), String> {
    let injector = state
        .input_injector
        .lock()
        .map_err(|_| "Input injector lock poisoned".to_string())?;
    let working_dir = validate_working_dir(&working_dir)?;
    injector
        .start_process(&working_dir.to_string_lossy())
        .map_err(|e| e.to_string())
}

/// 注入输入到 Claude CLI 进程
#[tauri::command]
pub fn inject_input(state: tauri::State<CliMonitorState>, input: String) -> Result<(), String> {
    let injector = state
        .input_injector
        .lock()
        .map_err(|_| "Input injector lock poisoned".to_string())?;
    injector.inject_input(&input).map_err(|e| e.to_string())
}

/// 停止输入注入进程
#[tauri::command]
pub fn stop_input_injection(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let injector = state
        .input_injector
        .lock()
        .map_err(|_| "Input injector lock poisoned".to_string())?;
    injector.stop_process().map_err(|e| e.to_string())
}

/// 检查输入注入进程是否正在运行
#[tauri::command]
pub fn is_input_injection_running(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let injector = state
        .input_injector
        .lock()
        .map_err(|_| "Input injector lock poisoned".to_string())?;
    Ok(injector.is_running())
}

/// 启动外部进程通信
#[tauri::command]
pub fn start_process_communication(
    state: tauri::State<CliMonitorState>,
    command: String,
    args: Vec<String>,
    working_dir: String,
) -> Result<(), String> {
    validate_command(&command)?;
    let working_dir = validate_working_dir(&working_dir)?;

    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    communicator
        .start_process(&command, &args, &working_dir.to_string_lossy())
        .map_err(|e| e.to_string())
}

/// 发送输入到外部进程
#[tauri::command]
pub fn send_process_input(state: tauri::State<CliMonitorState>, input: String) -> Result<(), String> {
    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    communicator.send_input(&input).map_err(|e| e.to_string())
}

/// 获取外部进程输出
#[tauri::command]
pub fn get_process_output(state: tauri::State<CliMonitorState>) -> Result<Vec<ProcessOutput>, String> {
    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    Ok(communicator.get_output())
}

/// 清除外部进程输出缓冲区
#[tauri::command]
pub fn clear_process_output(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    communicator.clear_output();
    Ok(())
}

/// 停止外部进程通信
#[tauri::command]
pub fn stop_process_communication(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    communicator.stop_process().map_err(|e| e.to_string())
}

/// 检查外部进程是否正在运行
#[tauri::command]
pub fn is_process_communication_running(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let communicator = state
        .process_communicator
        .lock()
        .map_err(|_| "Process communicator lock poisoned".to_string())?;
    Ok(communicator.is_running())
}
