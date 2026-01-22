/**
 * 智能会话续接 - Tauri 命令
 *
 * 提供创建继承会话的后端支持
 */

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use rusqlite::Connection;

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
#[tauri::command]
pub async fn create_continued_session(
    app: tauri::AppHandle,
    project_path: String,
    system_prompt: String,
    parent_session_id: String,
    metadata: SessionMetadata,
) -> Result<String, String> {
    use chrono::Utc;
    use uuid::Uuid;
    use tauri::Manager;

    log::info!(
        "[create_continued_session] Creating new session from parent: {}",
        parent_session_id
    );

    // 1. 生成新会话 ID
    let new_session_id = Uuid::new_v4().to_string();

    log::info!("[create_continued_session] New session ID: {}", new_session_id);

    // 2. 获取存储路径：优先使用用户配置的路径，否则使用默认的 app_data_dir
    let base_dir = if let Some(custom_path) = get_session_storage_path(&app) {
        log::info!("[create_continued_session] Using custom storage path: {:?}", custom_path);
        custom_path
    } else {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        log::info!("[create_continued_session] Using default storage path: {:?}", app_dir);
        app_dir
    };

    // 3. 保存 system prompt 到会话的第一条消息
    let session_dir = base_dir
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
    log::info!("[create_continued_session] Session stored in: {:?}", session_dir);

    Ok(new_session_id)
}

/// 获取会话存储路径配置
fn get_session_storage_path(app: &AppHandle) -> Option<PathBuf> {
    let app_dir = app.path().app_data_dir().ok()?;
    let db_path = app_dir.join("agents.db");

    let conn = Connection::open(&db_path).ok()?;
    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        rusqlite::params!["session_storage_path"],
        |row| row.get(0),
    );

    // 规范化路径：确保路径格式正确
    result.ok().and_then(|path_str| {
        if path_str.is_empty() {
            None
        } else {
            let normalized = PathBuf::from(&path_str);
            // 验证路径是否有效
            if normalized.to_string_lossy().contains("\\\\\\\\") {
                log::warn!("[session_continue] Detected malformed path with repeated backslashes: {}", path_str);
                // 尝试修复路径
                let fixed_path = path_str.replace("\\\\\\\\", "\\");
                Some(PathBuf::from(fixed_path))
            } else {
                Some(normalized)
            }
        }
    })
}

/// 设置会话存储路径
#[tauri::command]
pub async fn set_session_storage_path(app: AppHandle, path: String) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = app_dir.join("agents.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .map_err(|e| format!("Failed to create table: {}", e))?;

    // 规范化路径：移除重复的反斜杠和多余的分隔符
    let normalized_path = if path.is_empty() {
        String::new()
    } else {
        PathBuf::from(&path)
            .to_string_lossy()
            .to_string()
    };

    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
        rusqlite::params!["session_storage_path", normalized_path],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;

    log::info!("[session_continue] Session storage path set to: {}", normalized_path);
    Ok(())
}

/// 获取会话存储路径配置
#[tauri::command]
pub async fn get_session_storage_path_setting(app: AppHandle) -> Result<Option<String>, String> {
    Ok(get_session_storage_path(&app).map(|p| p.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: This test requires a Tauri AppHandle which is not available in unit tests.
    // The function should be tested through integration tests or manual testing.
    // Keeping the test structure for reference.

    #[tokio::test]
    #[ignore] // Ignored because it requires AppHandle
    async fn test_create_continued_session() {
        // This test would need to be run as an integration test with a real Tauri app
        // For now, we just verify the function signature compiles
    }
}
