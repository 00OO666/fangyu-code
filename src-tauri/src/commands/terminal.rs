/**
 * Terminal Commands
 * 提供终端功能的Tauri命令
 */

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

pub struct TerminalManager {
    sessions: Arc<Mutex<Vec<String>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[tauri::command]
pub async fn terminal_execute(
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    _state: State<'_, TerminalManager>,
) -> Result<TerminalOutput, String> {
    let mut cmd = Command::new(command);
    cmd.args(&args);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let output = cmd.output().map_err(|e| e.to_string())?;

    Ok(TerminalOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

#[tauri::command]
pub async fn terminal_create_session(
    _state: State<'_, TerminalManager>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    Ok(session_id)
}

#[tauri::command]
pub async fn terminal_close_session(
    _session_id: String,
    _state: State<'_, TerminalManager>,
) -> Result<(), String> {
    Ok(())
}
