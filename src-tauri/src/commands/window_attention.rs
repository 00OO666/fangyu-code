/**
 * Window Attention Manager - Rust Backend
 *
 * 功能:
 * - 维护窗口注册表
 * - 跟踪活跃窗口
 * - 任务委托路由
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub window_id: String,
    pub is_visible: bool,
    pub is_focused: bool,
    pub last_heartbeat: i64,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegatedTask {
    pub task_id: String,
    pub source_window_id: String,
    pub target_window_id: Option<String>,
    pub task_type: String,
    pub task_data: serde_json::Value,
    pub priority: String,
}

pub struct WindowRegistry {
    windows: HashMap<String, WindowInfo>,
    active_window: Option<String>,
}

impl WindowRegistry {
    pub fn new() -> Self {
        WindowRegistry {
            windows: HashMap::new(),
            active_window: None,
        }
    }

    pub fn register_window(&mut self, info: WindowInfo) {
        self.windows.insert(info.window_id.clone(), info);
    }

    pub fn update_window_visibility(&mut self, window_id: &str, is_visible: bool) {
        if let Some(window) = self.windows.get_mut(window_id) {
            window.is_visible = is_visible;
            window.last_heartbeat = chrono::Utc::now().timestamp_millis();
        }
    }

    pub fn update_window_focus(&mut self, window_id: &str, is_focused: bool) {
        if let Some(window) = self.windows.get_mut(window_id) {
            window.is_focused = is_focused;
            if is_focused {
                self.active_window = Some(window_id.to_string());
            }
        }
    }

    pub fn get_active_window(&self) -> Option<&WindowInfo> {
        self.active_window
            .as_ref()
            .and_then(|id| self.windows.get(id))
    }

    pub fn get_most_active_window(&self) -> Option<&WindowInfo> {
        if let Some(active) = self.get_active_window() {
            if active.is_focused {
                return Some(active);
            }
        }

        self.windows
            .values()
            .filter(|w| w.is_visible)
            .max_by_key(|w| w.last_heartbeat)
    }
}

pub struct WindowRegistryState(pub Mutex<WindowRegistry>);

#[tauri::command]
pub fn register_window(
    state: State<'_, WindowRegistryState>,
    window_id: String,
    session_id: Option<String>,
) -> Result<(), String> {
    let mut registry = state.0.lock().map_err(|e| e.to_string())?;

    registry.register_window(WindowInfo {
        window_id,
        is_visible: true,
        is_focused: false,
        last_heartbeat: chrono::Utc::now().timestamp_millis(),
        session_id,
    });

    Ok(())
}

#[tauri::command]
pub fn update_window_visibility(
    state: State<'_, WindowRegistryState>,
    window_id: String,
    is_visible: bool,
) -> Result<(), String> {
    let mut registry = state.0.lock().map_err(|e| e.to_string())?;
    registry.update_window_visibility(&window_id, is_visible);
    Ok(())
}

#[tauri::command]
pub fn update_window_focus(
    state: State<'_, WindowRegistryState>,
    window_id: String,
    is_focused: bool,
) -> Result<(), String> {
    let mut registry = state.0.lock().map_err(|e| e.to_string())?;
    registry.update_window_focus(&window_id, is_focused);
    Ok(())
}

#[tauri::command]
pub async fn delegate_task_to_active_window(
    app: AppHandle,
    state: State<'_, WindowRegistryState>,
    task: DelegatedTask,
) -> Result<(), String> {
    let registry = state.0.lock().map_err(|e| e.to_string())?;

    let target_window = registry
        .get_most_active_window()
        .ok_or("No active window found")?;

    let target_window_id = target_window.window_id.clone();
    drop(registry);

    let mut task_with_target = task;
    task_with_target.target_window_id = Some(target_window_id.clone());

    let task_id = task_with_target.task_id.clone();

    app.emit_to(&target_window_id, "task-delegated", task_with_target)
        .map_err(|e| format!("Failed to emit task: {}", e))?;

    log::info!(
        "[WindowAttention] Task {} delegated to window {}",
        task_id,
        target_window_id
    );

    Ok(())
}

#[tauri::command]
pub async fn report_delegated_task_completion(
    app: AppHandle,
    task_id: String,
    result: serde_json::Value,
) -> Result<(), String> {
    app.emit("task-completed", serde_json::json!({
        "task_id": task_id,
        "result": result,
    }))
    .map_err(|e| format!("Failed to emit completion: {}", e))?;

    log::info!("[WindowAttention] Task {} completion reported", task_id);
    Ok(())
}
