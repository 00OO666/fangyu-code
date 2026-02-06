use super::types::{CliSession, SessionsIndex};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// 扫描器内部状态（避免多锁死锁）
struct ScannerState {
    cache: HashMap<String, CliSession>,
    last_scan: Option<Instant>,
}

/// 会话扫描器
pub struct SessionScanner {
    /// 扫描器状态（缓存 + 上次扫描时间）
    state: Arc<Mutex<ScannerState>>,
}

impl SessionScanner {
    /// 创建新的扫描器
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(ScannerState {
                cache: HashMap::new(),
                last_scan: None,
            })),
        }
    }

    /// 扫描所有 CLI 会话
    pub fn scan_sessions(&self) -> Result<Vec<CliSession>, String> {
        // 防抖：如果距离上次扫描不到 5 秒，返回缓存
        {
            let state = self
                .state
                .lock()
                .map_err(|_| "Scanner state lock poisoned".to_string())?;
            if let Some(last_time) = state.last_scan {
                if last_time.elapsed() < Duration::from_secs(5) {
                    return Ok(state.cache.values().cloned().collect());
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
            let mut state = self
                .state
                .lock()
                .map_err(|_| "Scanner state lock poisoned".to_string())?;
            state.cache.clear();
            for session in &sessions {
                state.cache.insert(session.session_id.clone(), session.clone());
            }
            state.last_scan = Some(Instant::now());
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
            let created = match Self::parse_iso8601(&meta.created) {
                Ok(ts) => ts,
                Err(e) => {
                    log::warn!(
                        "[SessionScanner] Invalid created timestamp for {}: {}",
                        meta.session_id,
                        e
                    );
                    0
                }
            };
            let modified = match Self::parse_iso8601(&meta.modified) {
                Ok(ts) => ts,
                Err(e) => {
                    log::warn!(
                        "[SessionScanner] Invalid modified timestamp for {}: {}",
                        meta.session_id,
                        e
                    );
                    0
                }
            };

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
        chrono::DateTime::parse_from_rfc3339(time_str)
            .map(|dt| dt.timestamp())
            .map_err(|e| format!("Invalid ISO 8601 format: {}", e))
    }

    /// 获取 Claude 项目目录
    fn get_claude_projects_dir() -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        Ok(home_dir.join(".claude").join("projects"))
    }

    /// 获取缓存的会话
    pub fn get_cached_sessions(&self) -> Vec<CliSession> {
        let state = match self.state.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        state.cache.values().cloned().collect()
    }

    /// 清除缓存
    pub fn clear_cache(&self) {
        let mut state = match self.state.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        state.cache.clear();
        state.last_scan = None;
    }
}
