mod cli_runner;
mod config;
mod config_sync;
mod file_ops;
mod hooks;
mod models;
mod paths;
mod platform;
mod project_store;
mod session_history;

pub use models::*;
pub use paths::*;
// Export platform utilities for process window hiding
pub use self::cli_runner::{
    cancel_claude_execution, continue_claude_code, execute_claude_code, get_claude_session_output,
    list_running_claude_sessions, resume_claude_code, ClaudeProcessState,
};
pub use self::config::{
    check_claude_version, clear_custom_claude_path, find_claude_md_files, get_available_tools,
    get_claude_execution_config, get_claude_path, get_claude_permission_config,
    get_claude_settings, get_codex_system_prompt, get_permission_presets, get_system_prompt,
    // Claude WSL mode configuration
    get_claude_wsl_mode_config, set_claude_wsl_mode_config,
    open_new_session, read_claude_md_file, reset_claude_execution_config, save_claude_md_file,
    save_claude_settings, save_codex_system_prompt, save_system_prompt, set_custom_claude_path,
    update_claude_execution_config, update_claude_permission_config, update_thinking_mode,
    validate_permission_config,
};
pub use self::hooks::{
    get_active_hooks, get_hooks_config, list_hook_files, toggle_hook_file, update_hooks_config,
    validate_hook_command,
};
pub use self::config_sync::{
    sync_claude_json_to_settings, sync_settings_to_claude_json, toggle_mcp_server_unified,
    get_mcp_sync_status, full_sync_mcp_configs,
};
use self::project_store::ProjectStore;
pub use file_ops::{list_directory_contents, search_files};
pub use platform::{apply_no_window_async, kill_process_tree};
// Agent functionality removed

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    let store = ProjectStore::new()?;
    store.list_projects()
}

/// Gets sessions for a specific project
#[tauri::command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<Session>, String> {
    let store = ProjectStore::new()?;
    store.get_project_sessions(&project_id)
}

/// Deletes a session and all its associated data
#[tauri::command]
pub async fn delete_session(session_id: String, project_id: String) -> Result<String, String> {
    let store = ProjectStore::new()?;
    let session_deleted = store.delete_session(&project_id, &session_id)?;

    if session_deleted {
        Ok(format!("Successfully deleted session: {}", session_id))
    } else {
        Ok(format!(
            "Session {} was already missing; associated metadata cleaned up",
            session_id
        ))
    }
}

/// Deletes multiple sessions in batch
#[tauri::command]
pub async fn delete_sessions_batch(
    session_ids: Vec<String>,
    project_id: String,
) -> Result<String, String> {
    let store = ProjectStore::new()?;
    let outcome = store.delete_sessions_batch(&project_id, &session_ids);

    if outcome.failed_count > 0 {
        Err(format!(
            "Batch delete completed with errors: {} deleted, {} failed. Errors: {}",
            outcome.deleted_count,
            outcome.failed_count,
            outcome.errors.join("; ")
        ))
    } else {
        Ok(format!(
            "Successfully deleted {} sessions",
            outcome.deleted_count
        ))
    }
}

/// Deletes sessions matching a pattern (e.g., sessions with first_message containing "/compact")
/// Returns the number of deleted sessions
#[tauri::command]
pub async fn delete_sessions_by_pattern(
    project_id: String,
    pattern: String,
) -> Result<DeleteByPatternResult, String> {
    log::info!("Deleting sessions matching pattern '{}' in project {}", pattern, project_id);
    
    let store = ProjectStore::new()?;
    
    // Get all sessions for the project
    let sessions = store.get_project_sessions(&project_id)?;
    
    // Find sessions matching the pattern
    let matching_session_ids: Vec<String> = sessions
        .iter()
        .filter(|s| {
            // Match against first_message
            if let Some(ref msg) = s.first_message {
                if msg.contains(&pattern) {
                    return true;
                }
            }
            // Also match against session ID
            if s.id.contains(&pattern) {
                return true;
            }
            false
        })
        .map(|s| s.id.clone())
        .collect();
    
    let matched_count = matching_session_ids.len();
    
    if matching_session_ids.is_empty() {
        log::info!("No sessions found matching pattern '{}'", pattern);
        return Ok(DeleteByPatternResult {
            matched_count: 0,
            deleted_count: 0,
            failed_count: 0,
            errors: vec![],
        });
    }
    
    log::info!("Found {} sessions matching pattern '{}', deleting...", matched_count, pattern);
    
    // Delete matching sessions
    let outcome = store.delete_sessions_batch(&project_id, &matching_session_ids);
    
    log::info!(
        "Pattern delete completed: {} matched, {} deleted, {} failed",
        matched_count,
        outcome.deleted_count,
        outcome.failed_count
    );
    
    Ok(DeleteByPatternResult {
        matched_count,
        deleted_count: outcome.deleted_count,
        failed_count: outcome.failed_count,
        errors: outcome.errors,
    })
}

/// Result of delete by pattern operation
#[derive(serde::Serialize, serde::Deserialize)]
pub struct DeleteByPatternResult {
    pub matched_count: usize,
    pub deleted_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

/// Removes a project from the project list (without deleting files)
#[tauri::command]
pub async fn delete_project(project_id: String) -> Result<String, String> {
    let store = ProjectStore::new()?;
    let newly_hidden = store.hide_project(&project_id)?;

    let result_msg = if newly_hidden {
        format!(
            "Project '{}' has been removed from the list (files are preserved)",
            project_id
        )
    } else {
        format!(
            "Project '{}' was already hidden (files are preserved)",
            project_id
        )
    };

    log::info!("{}", result_msg);
    Ok(result_msg)
}

/// Restores a project to the project list
#[tauri::command]
pub async fn restore_project(project_id: String) -> Result<String, String> {
    let store = ProjectStore::new()?;
    store.restore_project(&project_id)?;

    let result_msg = format!("Project '{}' has been restored to the list", project_id);
    log::info!("{}", result_msg);
    Ok(result_msg)
}

/// Permanently delete a project from the file system with intelligent directory detection
#[tauri::command]
pub async fn delete_project_permanently(project_id: String) -> Result<String, String> {
    let store = ProjectStore::new()?;
    let actual_project_id = store.delete_project_permanently(&project_id)?;

    let result_msg = if actual_project_id != project_id {
        format!(
            "项目 '{}' (实际目录: '{}') 已永久删除",
            project_id, actual_project_id
        )
    } else {
        format!("项目 '{}' 已永久删除", project_id)
    };

    log::info!("{}", result_msg);
    Ok(result_msg)
}

/// Lists all hidden projects with intelligent directory existence check
#[tauri::command]
pub async fn list_hidden_projects() -> Result<Vec<String>, String> {
    let store = ProjectStore::new()?;
    store.list_hidden_projects()
}

/// Reads the Claude settings file

/// Loads the JSONL history for a specific session
#[tauri::command]
pub async fn load_session_history(
    session_id: String,
    project_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    session_history::load_session_history(&session_id, &project_id)
}
