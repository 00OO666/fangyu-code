/// Tauri commands for auto-compact context management
///
/// These commands integrate the AutoCompactManager with the frontend,
/// providing comprehensive context window management capabilities.
use crate::commands::context_manager::{
    AutoCompactConfig, AutoCompactManager, AutoCompactState, SessionContext,
};
use log::{error, info};
use tauri::{command, AppHandle, Emitter, Manager, State};

/// Initialize auto-compact manager with default settings
#[command]
pub async fn init_auto_compact_manager(app: AppHandle) -> Result<(), String> {
    info!("Initializing auto-compact manager");

    let manager = AutoCompactManager::new();
    manager.start_monitoring(app.clone()).await?;

    // Store in app state
    app.manage(AutoCompactState(std::sync::Arc::new(manager)));

    info!("Auto-compact manager initialized successfully");
    Ok(())
}

/// Register a Claude session for auto-compact monitoring
#[command]
pub async fn register_auto_compact_session(
    state: State<'_, AutoCompactState>,
    session_id: String,
    project_path: String,
    model: String,
) -> Result<(), String> {
    info!("Registering session {} for auto-compact", session_id);

    state.0.register_session(session_id, project_path, model)?;
    Ok(())
}

/// Update session token count and check for auto-compact trigger
#[command]
pub async fn update_session_context(
    state: State<'_, AutoCompactState>,
    app: AppHandle,
    session_id: String,
    token_count: usize,
) -> Result<bool, String> {
    let compaction_triggered = state
        .0
        .update_session_tokens(&session_id, token_count)
        .await?;

    if compaction_triggered {
        info!("Auto-compaction triggered for session {}", session_id);

        // Execute compaction in background
        let manager = state.0.clone();
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            if let Err(e) = manager.execute_compaction(app, &session_id_clone).await {
                // 🔧 Downgrade to warn - expected when feature is disabled
                log::warn!("Background auto-compaction skipped: {}", e);
            }
        });
    }

    Ok(compaction_triggered)
}

/// Manually trigger compaction for a session
#[command]
pub async fn trigger_manual_compaction(
    state: State<'_, AutoCompactState>,
    app: AppHandle,
    session_id: String,
    custom_instructions: Option<String>,
) -> Result<(), String> {
    info!("Manual compaction triggered for session {}", session_id);

    // Temporarily override custom instructions if provided
    if let Some(instructions) = custom_instructions {
        let mut config = state.0.get_config()?;
        config.custom_instructions = Some(instructions);
        state.0.update_config(config)?;
    }

    state.0.execute_compaction(app, &session_id).await?;
    Ok(())
}

/// Get auto-compact configuration
#[command]
pub async fn get_auto_compact_config(
    state: State<'_, AutoCompactState>,
) -> Result<AutoCompactConfig, String> {
    state.0.get_config()
}

/// Update auto-compact configuration
#[command]
pub async fn update_auto_compact_config(
    state: State<'_, AutoCompactState>,
    config: AutoCompactConfig,
) -> Result<(), String> {
    info!("Updating auto-compact configuration");
    state.0.update_config(config)?;
    Ok(())
}

/// Get session context statistics
#[command]
pub fn get_session_context_stats(
    state: State<'_, AutoCompactState>,
    session_id: String,
) -> Result<Option<SessionContext>, String> {
    state.0.get_session_stats(&session_id)
}

/// Get all monitored sessions
#[command]
pub fn get_all_monitored_sessions(
    state: State<'_, AutoCompactState>,
) -> Result<Vec<SessionContext>, String> {
    let sessions = {
        let sessions_guard = state.0.sessions.lock().map_err(|e| e.to_string())?;
        sessions_guard.values().cloned().collect()
    };

    Ok(sessions)
}

/// Unregister session from auto-compact monitoring
#[command]
pub async fn unregister_auto_compact_session(
    state: State<'_, AutoCompactState>,
    session_id: String,
) -> Result<(), String> {
    info!("Unregistering session {} from auto-compact", session_id);
    state.0.unregister_session(&session_id)?;
    Ok(())
}

/// Stop auto-compact monitoring
#[command]
pub async fn stop_auto_compact_monitoring(
    state: State<'_, AutoCompactState>,
) -> Result<(), String> {
    info!("Stopping auto-compact monitoring");
    state.0.stop_monitoring()?;
    Ok(())
}

/// Start auto-compact monitoring
#[command]
pub async fn start_auto_compact_monitoring(
    state: State<'_, AutoCompactState>,
    app: AppHandle,
) -> Result<(), String> {
    info!("Starting auto-compact monitoring");
    state.0.start_monitoring(app).await?;
    Ok(())
}

/// Get auto-compact status and statistics
#[command]
pub async fn get_auto_compact_status(
    state: State<'_, AutoCompactState>,
) -> Result<AutoCompactStatus, String> {
    let config = state.0.get_config()?;
    let is_monitoring = {
        let monitoring_guard = state.0.is_monitoring.lock().map_err(|e| e.to_string())?;
        *monitoring_guard
    };

    let sessions_count = {
        let sessions_guard = state.0.sessions.lock().map_err(|e| e.to_string())?;
        sessions_guard.len()
    };

    let total_compactions = {
        let sessions_guard = state.0.sessions.lock().map_err(|e| e.to_string())?;
        sessions_guard.values().map(|s| s.compaction_count).sum()
    };

    Ok(AutoCompactStatus {
        enabled: config.enabled,
        is_monitoring,
        sessions_count,
        total_compactions,
        max_context_tokens: config.max_context_tokens,
        compaction_threshold: config.compaction_threshold,
    })
}

/// Auto-compact status information for the UI
#[derive(serde::Serialize, serde::Deserialize)]
pub struct AutoCompactStatus {
    pub enabled: bool,
    pub is_monitoring: bool,
    pub sessions_count: usize,
    pub total_compactions: usize,
    pub max_context_tokens: usize,
    pub compaction_threshold: f64,
}

/// Result of a compact operation
#[derive(serde::Serialize, serde::Deserialize)]
pub struct CompactResult {
    pub success: bool,
    pub message: String,
    pub tokens_before: Option<usize>,
    pub tokens_after: Option<usize>,
}

/// Execute /compact command directly via Claude CLI
/// This is a direct Tauri command that can be called from the frontend
/// without going through the event system
#[command]
pub async fn execute_compact(
    app: AppHandle,
    session_id: String,
    project_path: String,
    instructions: Option<String>,
) -> Result<CompactResult, String> {
    info!("Executing /compact for session {} in {}", session_id, project_path);
    
    // Get current token count if available
    let tokens_before = if let Some(state) = app.try_state::<AutoCompactState>() {
        state.0.get_session_stats(&session_id)
            .ok()
            .flatten()
            .map(|s| s.current_tokens)
    } else {
        None
    };
    
    // Find Claude CLI
    let claude_path = crate::claude_binary::find_claude_binary(&app)?;
    info!("Found Claude CLI at: {}", claude_path);
    
    // Build compact command
    let compact_cmd = match &instructions {
        Some(inst) if !inst.is_empty() => format!("/compact {}", inst),
        _ => "/compact".to_string(),
    };
    
    info!("Executing compact command: {}", compact_cmd);
    
    // Create command with -p flag for slash command
    let mut cmd = tokio::process::Command::new(&claude_path);
    cmd.args(&["-p", &compact_cmd, "--output-format", "stream-json"])
        .current_dir(&project_path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    // Apply platform-specific no-window configuration
    crate::commands::claude::apply_no_window_async(&mut cmd);
    
    // Spawn process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn compact process: {}", e))?;
    
    let pid = child.id().unwrap_or(0);
    info!("Spawned compact process with PID: {}", pid);
    
    // Emit progress event
    let _ = app.emit("compact-progress", 10);
    
    // Read output
    use tokio::io::AsyncBufReadExt;
    
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    
    let stdout_reader = tokio::io::BufReader::new(stdout);
    let stderr_reader = tokio::io::BufReader::new(stderr);
    
    let mut stdout_lines = stdout_reader.lines();
    
    // Read stderr in background
    let stderr_task = tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        let mut output = String::new();
        while let Ok(Some(line)) = lines.next_line().await {
            output.push_str(&line);
            output.push('\n');
        }
        output
    });
    
    // Emit progress
    let _ = app.emit("compact-progress", 30);
    
    // Process stdout
    let mut result_message = String::new();
    let mut has_error = false;
    
    while let Ok(Some(line)) = stdout_lines.next_line().await {
        log::trace!("Compact stdout: {}", line);
        
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
            // Check for error
            if msg["type"] == "error" {
                let error_msg = msg["error"]["message"]
                    .as_str()
                    .unwrap_or("Unknown error");
                result_message = error_msg.to_string();
                has_error = true;
                break;
            }
            
            // Check for result
            if msg["type"] == "result" {
                if let Some(result_text) = msg["result"].as_str() {
                    result_message = result_text.to_string();
                }
            }
            
            // Check for assistant message (compact summary)
            if msg["type"] == "assistant" {
                if let Some(content) = msg["message"]["content"].as_array() {
                    for item in content {
                        if item["type"] == "text" {
                            if let Some(text) = item["text"].as_str() {
                                result_message = text.to_string();
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Emit progress
    let _ = app.emit("compact-progress", 70);
    
    // Wait for stderr
    let stderr_output = stderr_task.await.unwrap_or_default();
    
    // Wait for process
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for compact: {}", e))?;
    
    // Emit progress
    let _ = app.emit("compact-progress", 100);
    
    if !status.success() || has_error {
        let error = if !result_message.is_empty() {
            result_message
        } else if !stderr_output.is_empty() {
            stderr_output.trim().to_string()
        } else {
            format!("Compact failed with exit code: {:?}", status.code())
        };
        
        error!("Compact failed: {}", error);
        
        return Ok(CompactResult {
            success: false,
            message: error,
            tokens_before,
            tokens_after: None,
        });
    }
    
    info!("Compact completed successfully");
    
    // Estimate tokens after (rough estimate: 1/3 of original)
    let tokens_after = tokens_before.map(|t| t / 3);
    
    Ok(CompactResult {
        success: true,
        message: if result_message.is_empty() {
            "Compact completed successfully".to_string()
        } else {
            result_message
        },
        tokens_before,
        tokens_after,
    })
}
