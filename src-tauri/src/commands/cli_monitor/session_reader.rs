//! 会话文件读取器
//!
//! 负责读取和解析 Claude Code CLI 的会话文件

use std::fs;
use std::path::{Path, PathBuf};
use log::{debug, warn};

use super::types::{SessionEntry, SessionInfo, SessionsIndex};
use super::utils::{extract_project_name, get_project_color};

/// 会话文件读取器
pub struct SessionReader {
    /// Claude 配置目录路径
    claude_dir: PathBuf,
}

impl SessionReader {
    /// 创建新的会话读取器
    ///
    /// # 返回
    /// - `Ok(SessionReader)`: 成功创建
    /// - `Err(String)`: 失败时返回错误信息
    pub fn new() -> Result<Self, String> {
        let home_dir = dirs::home_dir()
            .ok_or("Cannot find home directory")?;

        let claude_dir = home_dir.join(".claude").join("projects");

        if !claude_dir.exists() {
            return Err(format!(
                "Claude projects directory not found: {:?}",
                claude_dir
            ));
        }

        debug!("SessionReader initialized with claude_dir: {:?}", claude_dir);

        Ok(Self { claude_dir })
    }

    /// 扫描所有项目的会话
    ///
    /// # 返回
    /// - `Ok(Vec<SessionInfo>)`: 成功时返回会话列表
    /// - `Err(String)`: 失败时返回错误信息
    pub fn scan_all_sessions(&self) -> Result<Vec<SessionInfo>, String> {
        debug!("Scanning all sessions from: {:?}", self.claude_dir);

        let mut all_sessions = Vec::new();

        // 遍历所有项目目录
        let entries = fs::read_dir(&self.claude_dir)
            .map_err(|e| format!("Failed to read claude directory: {}", e))?;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    warn!("Failed to read directory entry: {}", e);
                    continue;
                }
            };

            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            // 读取该项目的会话
            match self.scan_project_sessions(&path) {
                Ok(sessions) => {
                    debug!("Found {} sessions in {:?}", sessions.len(), path);
                    all_sessions.extend(sessions);
                }
                Err(e) => {
                    warn!("Failed to scan project {:?}: {}", path, e);
                    // 继续处理其他项目
                }
            }
        }

        debug!("Total sessions found: {}", all_sessions.len());

        Ok(all_sessions)
    }

    /// 扫描单个项目的会话
    fn scan_project_sessions(&self, project_dir: &Path) -> Result<Vec<SessionInfo>, String> {
        let index_file = project_dir.join("sessions-index.json");

        if !index_file.exists() {
            return Ok(Vec::new());
        }

        // 读取 sessions-index.json
        let content = fs::read_to_string(&index_file)
            .map_err(|e| format!("Failed to read sessions-index.json: {}", e))?;

        // 解析 JSON
        let index: SessionsIndex = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse sessions-index.json: {}", e))?;

        // 转换为 SessionInfo
        let sessions: Vec<SessionInfo> = index
            .entries
            .into_iter()
            .map(|entry| self.convert_entry_to_session_info(entry))
            .collect();

        Ok(sessions)
    }

    /// 将 SessionEntry 转换为 SessionInfo
    fn convert_entry_to_session_info(&self, entry: SessionEntry) -> SessionInfo {
        let project_name = extract_project_name(&entry.project_path);
        let color = get_project_color(&project_name);

        SessionInfo {
            session_id: entry.session_id,
            project_path: entry.project_path,
            project_name,
            git_branch: entry.git_branch,
            summary: entry.summary,
            first_prompt: entry.first_prompt,
            message_count: entry.message_count,
            created: entry.created,
            modified: entry.modified,
            last_modified_timestamp: entry.file_mtime,
            is_active: false, // 稍后由 StateTracker 更新
            color,
            is_pinned: None,
            is_hidden: None,
            custom_label: None,
            last_messages: None,
        }
    }

    /// 读取单个会话的详细内容
    ///
    /// # 参数
    /// - `session_id`: 会话 ID
    ///
    /// # 返回
    /// - `Ok(SessionInfo)`: 成功时返回会话信息
    /// - `Err(String)`: 失败时返回错误信息
    pub fn get_session_detail(&self, session_id: &str) -> Result<SessionInfo, String> {
        // 扫描所有会话，找到匹配的
        let sessions = self.scan_all_sessions()?;

        sessions
            .into_iter()
            .find(|s| s.session_id == session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))
    }

    /// 获取 Claude 项目目录路径
    pub fn get_claude_dir(&self) -> &Path {
        &self.claude_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_reader_new() {
        // 这个测试依赖于实际的文件系统
        // 在 CI 环境中可能会失败
        match SessionReader::new() {
            Ok(reader) => {
                assert!(reader.get_claude_dir().exists());
            }
            Err(e) => {
                // 如果 .claude 目录不存在，这是预期的
                assert!(e.contains("not found"));
            }
        }
    }
}
