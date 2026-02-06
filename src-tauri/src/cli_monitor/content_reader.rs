use super::types::CliSession;
use std::collections::VecDeque;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

/// 会话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<i64>,
}

/// 会话内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContent {
    pub session_id: String,
    pub messages: Vec<SessionMessage>,
    pub total_messages: usize,
}

/// 会话内容读取器
pub struct SessionContentReader;

impl SessionContentReader {
    /// 读取会话内容
    pub fn read_session_content(session_id: &str) -> Result<SessionContent, String> {
        // 获取会话文件路径
        let session_file = Self::find_session_file(session_id)?;

        let file = fs::File::open(&session_file)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);

        let mut messages = Vec::new();
        for (line_num, line) in reader.lines().enumerate() {
            let line = line.map_err(|e| format!("Failed to read session file: {}", e))?;
            if let Some(message) = Self::parse_json_line(&line, line_num + 1) {
                messages.push(message);
            }
        }

        let total_messages = messages.len();

        Ok(SessionContent {
            session_id: session_id.to_string(),
            messages,
            total_messages,
        })
    }

    /// 读取会话的最后 N 条消息
    pub fn read_last_messages(session_id: &str, count: usize) -> Result<SessionContent, String> {
        let session_file = Self::find_session_file(session_id)?;
        let file = fs::File::open(&session_file)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);

        let mut buffer: VecDeque<SessionMessage> = VecDeque::with_capacity(count);
        let mut total_messages = 0usize;

        for (line_num, line) in reader.lines().enumerate() {
            let line = line.map_err(|e| format!("Failed to read session file: {}", e))?;
            if let Some(message) = Self::parse_json_line(&line, line_num + 1) {
                total_messages += 1;
                if count > 0 {
                    if buffer.len() == count {
                        buffer.pop_front();
                    }
                    buffer.push_back(message);
                }
            }
        }

        Ok(SessionContent {
            session_id: session_id.to_string(),
            messages: buffer.into_iter().collect(),
            total_messages,
        })
    }

    /// 查找会话文件
    fn find_session_file(session_id: &str) -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        let claude_dir = home_dir.join(".claude").join("projects");

        if !claude_dir.exists() {
            return Err("Claude projects directory not found".to_string());
        }

        // 遍历所有项目目录查找会话文件
        for entry in walkdir::WalkDir::new(&claude_dir)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name() {
                    let file_name_str = file_name.to_string_lossy();
                    if file_name_str.starts_with(session_id) && file_name_str.ends_with(".jsonl") {
                        return Ok(path.to_path_buf());
                    }
                }
            }
        }

        Err(format!("Session file not found for session_id: {}", session_id))
    }

    /// 解析 JSONL 单行
    fn parse_json_line(line: &str, line_num: usize) -> Option<SessionMessage> {
        if line.trim().is_empty() {
            return None;
        }

        match serde_json::from_str::<serde_json::Value>(line) {
            Ok(json) => {
                if let Some(role) = json.get("role").and_then(|v| v.as_str()) {
                    if let Some(content_array) = json.get("content").and_then(|v| v.as_array()) {
                        let mut full_content = String::new();
                        for content_item in content_array {
                            if let Some(text) = content_item.get("text").and_then(|v| v.as_str()) {
                                full_content.push_str(text);
                            }
                        }

                        let timestamp = json.get("timestamp").and_then(|v| v.as_i64());

                        return Some(SessionMessage {
                            role: role.to_string(),
                            content: full_content,
                            timestamp,
                        });
                    }
                }
                None
            }
            Err(e) => {
                log::warn!(
                    "[SessionContentReader] Failed to parse line {}: {}",
                    line_num,
                    e
                );
                None
            }
        }
    }

    /// 获取会话摘要（前 N 个字符）
    pub fn get_session_summary(session_id: &str, max_chars: usize) -> Result<String, String> {
        let session_file = Self::find_session_file(session_id)?;
        let file = fs::File::open(&session_file)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);

        let mut first_message: Option<SessionMessage> = None;

        for (line_num, line) in reader.lines().enumerate() {
            let line = line.map_err(|e| format!("Failed to read session file: {}", e))?;
            if let Some(message) = Self::parse_json_line(&line, line_num + 1) {
                if first_message.is_none() {
                    first_message = Some(message.clone());
                }

                if message.role == "user" {
                    let summary = if message.content.chars().count() > max_chars {
                        format!("{}...", Self::truncate_text(&message.content, max_chars))
                    } else {
                        message.content
                    };
                    return Ok(summary);
                }
            }
        }

        if let Some(message) = first_message {
            let summary = if message.content.chars().count() > max_chars {
                format!("{}...", Self::truncate_text(&message.content, max_chars))
            } else {
                message.content
            };
            return Ok(summary);
        }

        Ok(String::new())
    }

    fn truncate_text(text: &str, max_chars: usize) -> String {
        text.chars().take(max_chars).collect()
    }
}
