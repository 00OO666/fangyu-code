// CLI 监控系统 - 窗口扫描器
// 使用 Windows API 枚举所有窗口并识别 Claude CLI 会话

#[cfg(windows)]
use winapi::um::winuser::{EnumWindows, GetWindowTextW, GetWindowThreadProcessId};
#[cfg(windows)]
use winapi::shared::windef::HWND;

#[cfg(windows)]
use crate::cli_monitor::process_detector::ProcessDetector;
use crate::cli_monitor::types::{WindowInfo, WindowScanResult};
use chrono::Utc;
use sysinfo::{System, Pid, ProcessRefreshKind, UpdateKind};
use std::sync::{Arc, Mutex};

/// 回调上下文
#[cfg(windows)]
struct CallbackContext {
    windows: Arc<Mutex<Vec<WindowInfo>>>,
    system_ptr: *const System,
}

#[cfg(windows)]
fn extract_project_path_from_cmd(cmd: &[std::ffi::OsString]) -> Option<String> {
    for (i, arg) in cmd.iter().enumerate() {
        let arg_str = arg.to_string_lossy();
        if arg_str.starts_with("--project=") || arg_str.starts_with("-p=") {
            return arg_str.split('=').nth(1).map(|s| s.to_string());
        }
        if arg_str == "--project" || arg_str == "-p" {
            if let Some(next_arg) = cmd.get(i + 1) {
                return Some(next_arg.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[cfg(windows)]
fn is_descendant_process(system: &System, mut pid: Pid, root: Pid) -> bool {
    let mut seen = std::collections::HashSet::new();
    loop {
        if pid == root {
            return true;
        }
        if !seen.insert(pid) {
            return false;
        }
        let Some(process) = system.process(pid) else {
            return false;
        };
        let Some(parent) = process.parent() else {
            return false;
        };
        pid = parent;
    }
}

#[cfg(windows)]
fn find_descendant_context(system: &System, root: Pid) -> (Option<String>, Option<String>) {
    let mut session_id = None;
    let mut project_path = None;

    for (pid, process) in system.processes() {
        if !is_descendant_process(system, *pid, root) {
            continue;
        }

        if session_id.is_none() {
            session_id = ProcessDetector::extract_session_id_from_cmd(process.cmd());
        }

        if project_path.is_none() {
            project_path = extract_project_path_from_cmd(process.cmd())
                .or_else(|| process.cwd().and_then(|p| p.to_str()).map(|s| s.to_string()));
        }

        if session_id.is_some() && project_path.is_some() {
            break;
        }
    }

    (session_id, project_path)
}

/// 窗口扫描器
pub struct WindowScanner {
    system: System,
}

impl WindowScanner {
    /// 创建新的窗口扫描器
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    /// 扫描所有 Claude CLI 窗口
    #[cfg(windows)]
    pub fn scan(&mut self) -> anyhow::Result<WindowScanResult> {
        // 刷新进程信息
        use sysinfo::ProcessesToUpdate;
        let refresh_kind = ProcessRefreshKind::new()
            .with_cmd(UpdateKind::Always)
            .with_cwd(UpdateKind::Always)
            .with_exe(UpdateKind::Always);
        self.system
            .refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);

        // 用于存储扫描结果的共享容器
        let windows = Arc::new(Mutex::new(Vec::new()));
        let system_ptr = &self.system as *const System;

        // 创建回调上下文
        let context = CallbackContext {
            windows: Arc::clone(&windows),
            system_ptr,
        };

        // 枚举所有窗口
        unsafe {
            EnumWindows(
                Some(enum_window_callback),
                &context as *const _ as isize,
            );
        }

        // 显式 drop context 以释放 Arc 引用
        drop(context);

        // 获取结果
        let windows = Arc::try_unwrap(windows)
            .map_err(|_| anyhow::anyhow!("Failed to unwrap Arc"))?
            .into_inner()
            .map_err(|_| anyhow::anyhow!("Failed to unwrap Mutex"))?;

        Ok(WindowScanResult::new(windows))
    }

    /// 扫描所有 Claude CLI 窗口（非 Windows 平台）
    #[cfg(not(windows))]
    pub fn scan(&mut self) -> anyhow::Result<WindowScanResult> {
        // 非 Windows 平台暂不支持
        Ok(WindowScanResult::empty())
    }
}

/// Windows 窗口枚举回调函数
#[cfg(windows)]
unsafe extern "system" fn enum_window_callback(
    hwnd: HWND,
    lparam: isize,
) -> i32 {
    // 获取回调上下文
    let context = &*(lparam as *const CallbackContext);
    let system = &*context.system_ptr;

    // 获取窗口标题
    let mut title_buffer = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);

    if title_len > 0 {
        let title = String::from_utf16_lossy(&title_buffer[..title_len as usize]);

        // 获取进程 ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        // 检查是否是 Claude CLI 窗口
        // 判断条件：标题包含 "claude" 或进程名为 "node.exe"
        let is_claude_cli = title.to_lowercase().contains("claude");

        if is_claude_cli && process_id > 0 {
            // 获取进程信息
            let pid = Pid::from_u32(process_id);
            let (exe_path, mut project_path, mut session_id) = if let Some(process) = system.process(pid) {
                let exe = process.exe().and_then(|p| p.to_str()).map(|s| s.to_string());

                // 从命令行参数推断项目路径
                let project = extract_project_path_from_cmd(process.cmd())
                    .or_else(|| process.cwd().and_then(|p| p.to_str()).map(|s| s.to_string()));

                let session_id = ProcessDetector::extract_session_id_from_cmd(process.cmd());

                (exe, project, session_id)
            } else {
                (None, None, None)
            };

            if session_id.is_none() || project_path.is_none() {
                let (desc_session_id, desc_project_path) =
                    find_descendant_context(system, pid);
                if session_id.is_none() {
                    session_id = desc_session_id;
                }
                if project_path.is_none() {
                    project_path = desc_project_path;
                }
            }

            // 创建窗口信息
            let window_info = WindowInfo {
                hwnd: hwnd as isize,
                title,
                process_id,
                exe_path,
                project_path,
                last_active: Utc::now(),
                session_id,
                session_summary: None,
            };

            // 添加到结果列表
            if let Ok(mut windows) = context.windows.lock() {
                windows.push(window_info);
            }
        }
    }

    1 // 继续枚举
}

impl Default for WindowScanner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_scanner_creation() {
        let scanner = WindowScanner::new();
        assert!(true, "WindowScanner should be created successfully");
    }

    #[test]
    #[cfg(windows)]
    fn test_window_scan_basic() {
        let mut scanner = WindowScanner::new();
        let result = scanner.scan();

        // 打印错误信息（如果有）
        if let Err(ref e) = result {
            eprintln!("Scan error: {}", e);
        }

        // 扫描应该成功（即使没有找到窗口）
        assert!(result.is_ok(), "Window scan should succeed: {:?}", result.err());

        if let Ok(scan_result) = result {
            // 验证结果结构
            assert_eq!(scan_result.windows.len(), scan_result.total_count);
            println!("Found {} windows", scan_result.total_count);

            // 打印找到的窗口信息（用于调试）
            for window in &scan_result.windows {
                println!("Window: {} (PID: {})", window.title, window.process_id);
                if let Some(exe) = &window.exe_path {
                    println!("  Exe: {}", exe);
                }
                if let Some(project) = &window.project_path {
                    println!("  Project: {}", project);
                }
            }
        }
    }

    #[test]
    #[cfg(not(windows))]
    fn test_window_scan_non_windows() {
        let mut scanner = WindowScanner::new();
        let result = scanner.scan();

        // 非 Windows 平台应该返回空结果
        assert!(result.is_ok());
        if let Ok(scan_result) = result {
            assert_eq!(scan_result.total_count, 0);
        }
    }
}
