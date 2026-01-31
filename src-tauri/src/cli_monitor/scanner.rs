use super::types::{CliSession, SessionMetadata, SessionsIndex};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// 会话扫描器
pub struct SessionScanner {
    /// 缓存的会话数据
    cache: Arc<Mutex<HashMap<String, CliSession>>>,
    /// 上次扫描时间
    last_scan: Arc<Mutex<Option<Instant>>>,
}

impl SessionScanner {
    /// 创建新的扫描器
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            last_scan: Arc::new(Mutex::new(None)),
        }
    }

    /// 扫描所有 CLI 会话
    pub fn scan_sessions(&self) -> Result<Vec<CliSession>, String> {
        // 防抖：如果距离上次扫描不到 5 秒，返回缓存
        {
            let last_scan = self.last_scan.lock().unwrap();
            if let Some(last_time) = *last_scan {
                if last_time.elapsed() < Duration::from_secs(5) {
                    let cache = self.cache.lock().unwrap();
                    return Ok(cache.values().cloned().collect());
                }
            }
        }

        // 获取 Claude 项目目录
        let claude_dir = Self::get_claude_projects_dir()?;
        if !claude_dir.exists() {
            return Ok(Vec::new());
        }

        let mut sessions = Vec::new();

        // 遍历所有项目目录
        for entry in WalkDir::new(&claude_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() && path.file_name().map_or(false, |n| n != "projects") {
                // 查找 sessions-index.json
                let sessions_index = path.join("sessions-index.json");
                if sessions_index.exists() {
                    if let Ok(project_sessions) = Self::read_sessions_index(&sessions_index, path) {
                        sessions.extend(project_sessions);
                    }
                }
            }
        }

        // 更新缓存
        {
            let mut cache = self.cache.lock().unwrap();
            cache.clear();
            for session in &sessions {
                cache.insert(session.session_id.clone(), session.clone());
            }
        }

        // 更新扫描时间
        {
            let mut last_scan = self.last_scan.lock().unwrap();
            *last_scan = Some(Instant::now());
        }

        Ok(sessions)
    }

    /// 读取 sessions-index.json 文件
    fn read_sessions_index(
        index_path: &Path,
        project_path: &Path,
    ) -> Result<Vec<CliSession>, String> {
        let content = fs::read_to_string(index_path)
            .map_err(|e| format!("Failed to read sessions-index.json: {}", e))?;

        let index: SessionsIndex = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse sessions-index.json: {}", e))?;

        let mut sessions = Vec::new();
        for meta in index.entries {
            // 解析ISO 8601时间字符串为时间戳
            let created = Self::parse_iso8601(&meta.created).unwrap_or(0);
            let modified = Self::parse_iso8601(&meta.modified).unwrap_or(0);

            sessions.push(CliSession {
                session_id: meta.session_id,
                project_path: meta.project_path,
                git_branch: meta.git_branch,
                summary: meta.summary,
                message_count: meta.message_count,
                created,
                modified,
                is_active: false, // 初始状态为非活跃，由进程检测器更新
            });
        }

        Ok(sessions)
    }

    /// 读取 Git 分支名称
    fn read_git_branch(project_path: &Path) -> Option<String> {
        let git_head = project_path.join(".git").join("HEAD");
        if git_head.exists() {
            if let Ok(content) = fs::read_to_string(git_head) {
                // 解析 ref: refs/heads/branch-name
                if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
                    return Some(branch.trim().to_string());
                }
            }
        }
        None
    }

    /// 解析ISO 8601时间字符串为Unix时间戳（秒）
    fn parse_iso8601(time_str: &str) -> Result<i64, String> {
        // 格式：2026-01-20T15:51:26.746Z
        // 简单的手动解析方法
        if time_str.len() < 19 {
            return Err("Invalid ISO 8601 format".to_string());
        }

        // 提取日期和时间部分
        let date_time = &time_str[..19]; // "2026-01-20T15:51:26"
        let parts: Vec<&str> = date_time.split('T').collect();
        if parts.len() != 2 {
            return Err("Invalid ISO 8601 format".to_string());
        }

        let date_parts: Vec<&str> = parts[0].split('-').collect();
        let time_parts: Vec<&str> = parts[1].split(':').collect();

        if date_parts.len() != 3 || time_parts.len() != 3 {
            return Err("Invalid ISO 8601 format".to_string());
        }

        let year: i32 = date_parts[0].parse().map_err(|_| "Invalid year")?;
        let month: u32 = date_parts[1].parse().map_err(|_| "Invalid month")?;
        let day: u32 = date_parts[2].parse().map_err(|_| "Invalid day")?;
        let hour: u32 = time_parts[0].parse().map_err(|_| "Invalid hour")?;
        let minute: u32 = time_parts[1].parse().map_err(|_| "Invalid minute")?;
        let second: u32 = time_parts[2].parse().map_err(|_| "Invalid second")?;

        // 计算Unix时间戳（简化版本，不考虑闰年等复杂情况）
        // 使用一个简单的公式
        let days_since_epoch = (year - 1970) * 365 + (year - 1969) / 4 - (year - 1901) / 100 + (year - 1601) / 400;
        let days_in_month = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let mut days = days_since_epoch as i64 + days_in_month[(month - 1) as usize] as i64 + (day - 1) as i64;

        // 闰年调整
        if month > 2 && ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
            days += 1;
        }

        let timestamp = days * 86400 + hour as i64 * 3600 + minute as i64 * 60 + second as i64;
        Ok(timestamp)
    }

    /// 获取 Claude 项目目录
    fn get_claude_projects_dir() -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        Ok(home_dir.join(".claude").join("projects"))
    }

    /// 获取缓存的会话
    pub fn get_cached_sessions(&self) -> Vec<CliSession> {
        let cache = self.cache.lock().unwrap();
        cache.values().cloned().collect()
    }

    /// 清除缓存
    pub fn clear_cache(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
        let mut last_scan = self.last_scan.lock().unwrap();
        *last_scan = None;
    }
}
