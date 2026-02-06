use super::types::ProcessInfo;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use std::ffi::OsStr;

/// 进程检测器
pub struct ProcessDetector {
    system: System,
}

impl ProcessDetector {
    /// 创建新的进程检测器
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    /// 获取所有运行中的进程
    pub fn get_running_processes(&mut self) -> Vec<ProcessInfo> {
        let refresh_kind = ProcessRefreshKind::new().with_cmd(UpdateKind::Always);
        self.system
            .refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);

        let claude_processes = self.find_claude_code_processes();
        claude_processes
    }

    /// 查找 Claude Code CLI 进程
    fn find_claude_code_processes(&self) -> Vec<ProcessInfo> {
        let mut processes = Vec::new();

        for (pid, process) in self.system.processes() {
            let name = process.name();
            let cmd = process.cmd();

            // 检查是否是 Claude Code CLI 进程
            // 通常命令行包含 "claude" 和会话相关参数
            if Self::is_claude_code_process(name, cmd) {
                let session_id = Self::extract_session_id(cmd);

                processes.push(ProcessInfo {
                    pid: pid.as_u32(),
                    name: name.to_string_lossy().to_string(),
                    cmd: cmd.iter().map(|s| s.to_string_lossy().to_string()).collect(),
                    session_id,
                });
            }
        }

        processes
    }

    /// 判断是否是 Claude Code CLI 进程
    fn is_claude_code_process(name: &OsStr, cmd: &[std::ffi::OsString]) -> bool {
        // 检查进程名称
        let name_lower = name.to_string_lossy().to_lowercase();
        if name_lower.contains("claude") || name_lower.contains("node") {
            // 检查命令行参数
            let cmd_str = cmd.iter()
                .map(|s| s.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ")
                .to_lowercase();
            if cmd_str.contains("claude") && (cmd_str.contains("session") || cmd_str.contains("project")) {
                return true;
            }
        }
        false
    }

    /// 从命令行参数中提取会话 ID
    fn extract_session_id(cmd: &[std::ffi::OsString]) -> Option<String> {
        // 查找包含会话 ID 的参数
        // 常见格式：
        // - --session-id=xxx / --session-id xxx
        // - --session xxx
        // - --resume xxx / --resume=xxx
        for (i, arg) in cmd.iter().enumerate() {
            let arg_str = arg.to_string_lossy();
            if arg_str.starts_with("--session-id=") {
                if let Some(id) = arg_str.strip_prefix("--session-id=") {
                    return Some(id.to_string());
                }
            } else if arg_str.starts_with("--resume=") {
                if let Some(id) = arg_str.strip_prefix("--resume=") {
                    return Some(id.to_string());
                }
            } else if arg_str == "--session" || arg_str == "--session-id" {
                if let Some(next_arg) = cmd.get(i + 1) {
                    return Some(next_arg.to_string_lossy().to_string());
                }
            } else if arg_str == "--resume" {
                if let Some(next_arg) = cmd.get(i + 1) {
                    return Some(next_arg.to_string_lossy().to_string());
                }
            }
        }
        None
    }

    /// 获取指定进程的信息
    pub fn get_process_info(&mut self, pid: u32) -> Option<ProcessInfo> {
        let refresh_kind = ProcessRefreshKind::new().with_cmd(UpdateKind::Always);
        self.system
            .refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);

        if let Some(process) = self.system.process(sysinfo::Pid::from_u32(pid)) {
            let cmd = process.cmd();
            let session_id = Self::extract_session_id(cmd);

            return Some(ProcessInfo {
                pid,
                name: process.name().to_string_lossy().to_string(),
                cmd: cmd.iter().map(|s| s.to_string_lossy().to_string()).collect(),
                session_id,
            });
        }

        None
    }

    /// 从命令行参数中提取会话 ID（供其他模块复用）
    pub fn extract_session_id_from_cmd(cmd: &[std::ffi::OsString]) -> Option<String> {
        Self::extract_session_id(cmd)
    }
}
