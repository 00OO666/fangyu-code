/**
 * 智能会话续接 - Tauri 命令
 *
 * 提供创建继承会话的后端支持
 */

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub continued_from: String,
    pub continued_at: i64,
}

/**
 * 创建继承会话
 *
 * 创建一个新的会话，并将摘要注入为 system prompt
 */
#[command]
pub async fn create_continued_session(
    project_path: String,
    system_prompt: String,
    parent_session_id: String,
    metadata: SessionMetadata,
) -> Result<String, String> {
    use chrono::Utc;
    use uuid::Uuid;

    log::info!(
        "[create_continued_session] Creating new session from parent: {}",
        parent_session_id
    );

    // 1. 生成新会话 ID
    let new_session_id = Uuid::new_v4().to_string();

    log::info!("[create_continued_session] New session ID: {}", new_session_id);

    // 2. 创建会话记录（使用现有的数据库连接）
    // TODO: 这里需要调用现有的会话创建逻辑
    // 暂时返回会话 ID，实际应该写入数据库

    // 3. 保存 system prompt 到会话的第一条消息
    let session_dir = PathBuf::from(&project_path)
        .join(".claude")
        .join("sessions")
        .join(&new_session_id);

    if let Err(e) = std::fs::create_dir_all(&session_dir) {
        log::error!("[create_continued_session] Failed to create session dir: {}", e);
        return Err(format!("Failed to create session directory: {}", e));
    }

    // 保存摘要到文件
    let summary_file = session_dir.join("summary.md");
    if let Err(e) = std::fs::write(&summary_file, &system_prompt) {
        log::error!("[create_continued_session] Failed to write summary: {}", e);
        return Err(format!("Failed to write summary: {}", e));
    }

    // 保存元数据
    let metadata_file = session_dir.join("metadata.json");
    let metadata_json = serde_json::json!({
        "session_id": new_session_id,
        "parent_session_id": parent_session_id,
        "project_path": project_path,
        "created_at": Utc::now().to_rfc3339(),
        "continued_from": metadata.continued_from,
        "continued_at": metadata.continued_at,
    });

    if let Err(e) = std::fs::write(&metadata_file, serde_json::to_string_pretty(&metadata_json).unwrap()) {
        log::error!("[create_continued_session] Failed to write metadata: {}", e);
        return Err(format!("Failed to write metadata: {}", e));
    }

    log::info!("[create_continued_session] Session created successfully: {}", new_session_id);
    log::info!("[create_continued_session] Summary length: {} chars", system_prompt.len());

    Ok(new_session_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_continued_session() {
        let result = create_continued_session(
            "/tmp/test-project".to_string(),
            "Test summary".to_string(),
            "parent-session-id".to_string(),
            SessionMetadata {
                continued_from: "parent-session-id".to_string(),
                continued_at: 1234567890,
            },
        )
        .await;

        assert!(result.is_ok());
        let session_id = result.unwrap();
        assert!(!session_id.is_empty());
    }
}
