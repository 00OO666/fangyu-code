use super::types::CliSession;
use std::fs;
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

        // 读取文件内容
        let content = fs::read_to_string(&session_file)
            .map_err(|e| format!("Failed to read session file: {}", e))?;

        // 解析 JSONL 格式
        let messages = Self::parse_jsonl(&content)?;
        let total_messages = messages.len();

        Ok(SessionContent {
            session_id: session_id.to_string(),
            messages,
            total_messages,
        })
    }

    /// 读取会话的最后 N 条消息
    pub fn read_last_messages(session_id: &str, count: usize) -> Result<SessionContent, String> {
        let mut content = Self::read_session_content(session_id)?;

        // 只保留最后 N 条消息
        if content.messages.len() > count {
            let start = content.messages.len() - count;
            content.messages = content.messages[start..].to_vec();
        }

        Ok(content)
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

    /// 解析 JSONL 格式
    fn parse_jsonl(content: &str) -> Result<Vec<SessionMessage>, String> {
        let mut messages = Vec::new();

        for (line_num, line) in content.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }

            // 解析 JSON 行
            match serde_json::from_str::<serde_json::Value>(line) {
                Ok(json) => {
                    // 提取消息信息
                    if let Some(role) = json.get("role").and_then(|v| v.as_str()) {
                        if let Some(content_array) = json.get("content").and_then(|v| v.as_array()) {
                            // 合并所有 content 块
                            let mut full_content = String::new();
                            for content_item in content_array {
                                if let Some(text) = content_item.get("text").and_then(|v| v.as_str()) {
                                    full_content.push_str(text);
                                }
                            }

                            // 提取时间戳（如果有）
                            let timestamp = json.get("timestamp")
                                .and_then(|v| v.as_i64());

                            messages.push(SessionMessage {
                                role: role.to_string(),
                                content: full_content,
                                timestamp,
                            });
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[SessionContentReader] Failed to parse line {}: {}", line_num + 1, e);
                    // 继续处理下一行，不中断整个解析过程
                }
            }
        }

        Ok(messages)
    }

    /// 获取会话摘要（前 N 个字符）
    pub fn get_session_summary(session_id: &str, max_chars: usize) -> Result<String, String> {
        let content = Self::read_session_content(session_id)?;

        if content.messages.is_empty() {
            return Ok(String::new());
        }

        // 获取第一条用户消息
        for message in &content.messages {
            if message.role == "user" {
                let summary = if message.content.len() > max_chars {
                    format!("{}...", &message.content[..max_chars])
                } else {
                    message.content.clone()
                };
                return Ok(summary);
            }
        }

        // 如果没有用户消息，返回第一条消息
        let first_message = &content.messages[0];
        let summary = if first_message.content.len() > max_chars {
            format!("{}...", &first_message.content[..max_chars])
        } else {
            first_message.content.clone()
        };

        Ok(summary)
    }
}
