//! 进程扫描器
//!
//! 负责检测正在运行的 Claude Code CLI 进程

use std::process::Command;
use log::{debug, warn};

/// 进程扫描器
pub struct ProcessScanner;

impl ProcessScanner {
    /// 创建新的进程扫描器
    pub fn new() -> Self {
        Self
    }

    /// 扫描正在运行的 Claude Code CLI 进程
    ///
    /// # 返回
    /// 返回正在运行的 claude 进程的 PID 列表
    pub fn scan_claude_processes(&self) -> Vec<u32> {
        debug!("Scanning for Claude Code CLI processes");

        #[cfg(target_os = "windows")]
        {
            self.scan_windows_processes()
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.scan_unix_processes()
        }
    }

    /// Windows 平台的进程扫描
    #[cfg(target_os = "windows")]
    fn scan_windows_processes(&self) -> Vec<u32> {
        // 使用 tasklist 命令查找 claude 进程
        let output = match Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq claude.exe", "/FO", "CSV", "/NH"])
            .output()
        {
            Ok(output) => output,
            Err(e) => {
                warn!("Failed to execute tasklist: {}", e);
                return Vec::new();
            }
        };

        if !output.status.success() {
            warn!("tasklist command failed");
            return Vec::new();
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut pids = Vec::new();

        // 解析 CSV 输出
        // 格式: "claude.exe","1234","Console","1","12,345 K"
        for line in stdout.lines() {
            if line.contains("claude.exe") {
                // 提取 PID（第二个字段）
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let pid_str = parts[1].trim_matches('"');
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        pids.push(pid);
                    }
                }
            }
        }

        debug!("Found {} Claude processes", pids.len());
        pids
    }

    /// Unix/Linux/macOS 平台的进程扫描
    #[cfg(not(target_os = "windows"))]
    fn scan_unix_processes(&self) -> Vec<u32> {
        // 使用 ps 命令查找 claude 进程
        let output = match Command::new("ps")
            .args(&["-A", "-o", "pid,comm"])
            .output()
        {
            Ok(output) => output,
            Err(e) => {
                warn!("Failed to execute ps: {}", e);
                return Vec::new();
            }
        };

        if !output.status.success() {
            warn!("ps command failed");
            return Vec::new();
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut pids = Vec::new();

        // 解析输出
        for line in stdout.lines() {
            if line.contains("claude") {
                // 提取 PID（第一个字段）
                let parts: Vec<&str> = line.split_whitespace().collect();
                if !parts.is_empty() {
                    if let Ok(pid) = parts[0].parse::<u32>() {
                        pids.push(pid);
                    }
                }
            }
        }

        debug!("Found {} Claude processes", pids.len());
        pids
    }

    /// 检查是否有 Claude 进程正在运行
    pub fn has_running_processes(&self) -> bool {
        !self.scan_claude_processes().is_empty()
    }

    /// 获取正在运行的进程数量
    pub fn get_process_count(&self) -> usize {
        self.scan_claude_processes().len()
    }
}

impl Default for ProcessScanner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_scanner_new() {
        let scanner = ProcessScanner::new();
        // 基本的创建测试
        let _count = scanner.get_process_count();
    }

    #[test]
    fn test_has_running_processes() {
        let scanner = ProcessScanner::new();
        // 这个测试结果取决于是否有 Claude 进程在运行
        let _has_processes = scanner.has_running_processes();
    }
}
