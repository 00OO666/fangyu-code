/// Tauri commands for auto-compact context management
///
/// These commands integrate the AutoCompactManager with the frontend,
/// providing comprehensive context window management capabilities.
use crate::commands::context_manager::{
    AutoCompactConfig, AutoCompactManager, AutoCompactState, SessionContext,
};
use log::{error, info};
use tauri::{command, AppHandle, Manager, State};

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
                error!("Background auto-compaction failed: {}", e);
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
