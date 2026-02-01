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
            file_watcher: Mutex::new(FileSystemWatcher::new().unwrap()),
            input_injector: Mutex::new(InputInjector::new()),
            process_communicator: Mutex::new(ProcessCommunicator::new()),
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

/// 开始监控文件系统变化
#[tauri::command]
pub fn start_file_watching(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let mut file_watcher = state.file_watcher.lock().unwrap();

    // 获取 Claude 项目目录
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
    let claude_dir = home_dir.join(".claude").join("projects");

    if !claude_dir.exists() {
        return Err("Claude projects directory not found".to_string());
    }

    file_watcher.start_watching(claude_dir)
}

/// 停止监控文件系统变化
#[tauri::command]
pub fn stop_file_watching(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let mut file_watcher = state.file_watcher.lock().unwrap();
    file_watcher.stop_watching()
}

/// 获取文件变化事件
#[tauri::command]
pub fn get_file_events(state: tauri::State<CliMonitorState>) -> Result<Vec<FileChangeEvent>, String> {
    let file_watcher = state.file_watcher.lock().unwrap();
    Ok(file_watcher.get_events())
}

/// 检查是否正在监控
#[tauri::command]
pub fn is_file_watching(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let file_watcher = state.file_watcher.lock().unwrap();
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
    let injector = state.input_injector.lock().unwrap();
    injector.start_process(&working_dir).map_err(|e| e.to_string())
}

/// 注入输入到 Claude CLI 进程
#[tauri::command]
pub fn inject_input(state: tauri::State<CliMonitorState>, input: String) -> Result<(), String> {
    let injector = state.input_injector.lock().unwrap();
    injector.inject_input(&input).map_err(|e| e.to_string())
}

/// 停止输入注入进程
#[tauri::command]
pub fn stop_input_injection(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let injector = state.input_injector.lock().unwrap();
    injector.stop_process().map_err(|e| e.to_string())
}

/// 检查输入注入进程是否正在运行
#[tauri::command]
pub fn is_input_injection_running(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let injector = state.input_injector.lock().unwrap();
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
    let communicator = state.process_communicator.lock().unwrap();
    communicator.start_process(&command, &args, &working_dir).map_err(|e| e.to_string())
}

/// 发送输入到外部进程
#[tauri::command]
pub fn send_process_input(state: tauri::State<CliMonitorState>, input: String) -> Result<(), String> {
    let communicator = state.process_communicator.lock().unwrap();
    communicator.send_input(&input).map_err(|e| e.to_string())
}

/// 获取外部进程输出
#[tauri::command]
pub fn get_process_output(state: tauri::State<CliMonitorState>) -> Result<Vec<ProcessOutput>, String> {
    let communicator = state.process_communicator.lock().unwrap();
    Ok(communicator.get_output())
}

/// 清除外部进程输出缓冲区
#[tauri::command]
pub fn clear_process_output(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let communicator = state.process_communicator.lock().unwrap();
    communicator.clear_output();
    Ok(())
}

/// 停止外部进程通信
#[tauri::command]
pub fn stop_process_communication(state: tauri::State<CliMonitorState>) -> Result<(), String> {
    let communicator = state.process_communicator.lock().unwrap();
    communicator.stop_process().map_err(|e| e.to_string())
}

/// 检查外部进程是否正在运行
#[tauri::command]
pub fn is_process_communication_running(state: tauri::State<CliMonitorState>) -> Result<bool, String> {
    let communicator = state.process_communicator.lock().unwrap();
    Ok(communicator.is_running())
}
