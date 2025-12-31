//! Gemini CLI Session Management
//!
//! Handles Gemini CLI execution, streaming output, and process management.
//! Uses --output-format stream-json for real-time JSONL output.

use std::process::Stdio;

use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::OnceCell;
use tokio::time::{sleep, Duration};

use super::config::{build_gemini_env, load_gemini_config, read_session_detail};
use super::parser::{
    convert_raw_to_unified_message, convert_to_unified_message, parse_gemini_line,
    parse_gemini_line_flexible,
};
use super::types::{GeminiExecutionOptions, GeminiInstallStatus, GeminiProcessHandle, GeminiProcessState, GeminiSessionDetail, TokenUsage};
use crate::claude_binary::detect_binary_for_tool;
use crate::commands::claude::apply_no_window_async;
use crate::commands::wsl_utils;
use crate::process::JobObject;

// ============================================================================
// Slash Command Detection
// ============================================================================

/// Helper function to check if prompt is a slash command
/// Slash commands start with '/' and are typically short (like /help, /compact, /clear)
///
/// Gemini CLI supports slash commands in non-interactive mode since v0.1.59 (PR #8305)
/// - Custom commands from ~/.gemini/commands/*.toml
/// - Custom commands from <project>/.gemini/commands/*.toml
fn is_slash_command(prompt: &str) -> bool {
    let trimmed = prompt.trim();
    trimmed.starts_with('/') && !trimmed.contains('\n') && trimmed.len() < 256
}

/// 全局 Gemini 安装状态缓存
/// 避免重复创建 WSL 进程检测安装状态
static GEMINI_INSTALL_STATUS_CACHE: OnceCell<GeminiInstallStatus> = OnceCell::const_new();

fn token_usage_has_data(usage: &TokenUsage) -> bool {
    usage.prompt_token_count.unwrap_or(0) > 0
        || usage.candidates_token_count.unwrap_or(0) > 0
        || usage.total_token_count.unwrap_or(0) > 0
        || usage.cached_content_token_count.unwrap_or(0) > 0
        || usage.thoughts_token_count.unwrap_or(0) > 0
        || usage.tool_use_prompt_token_count.unwrap_or(0) > 0
}

fn extract_latest_token_usage(detail: &GeminiSessionDetail) -> Option<TokenUsage> {
    for msg in detail.messages.iter().rev() {
        // Prefer assistant-side entries in history files (type: "gemini")
        let msg_type = msg.get("type").and_then(|v| v.as_str());
        if msg_type != Some("gemini") {
            continue;
        }

        let candidates = [
            msg.get("tokens"),
            msg.get("usageMetadata"),
            msg.get("usage_metadata"),
            msg.get("usage"),
        ];

        for candidate in candidates.into_iter().flatten() {
            if let Ok(usage) = serde_json::from_value::<TokenUsage>(candidate.clone()) {
                if token_usage_has_data(&usage) {
                    return Some(usage);
                }
            }
        }
    }

    None
}

async fn try_load_latest_session_token_usage(
    project_path: &str,
    session_id: &str,
) -> Option<TokenUsage> {
    // The CLI may flush history slightly after emitting the final result event.
    // Retry a few times to maximize consistency between streaming and history loading.
    const MAX_ATTEMPTS: usize = 6;

    for attempt in 0..MAX_ATTEMPTS {
        let project_path = project_path.to_string();
        let session_id = session_id.to_string();

        let detail = tokio::task::spawn_blocking(move || read_session_detail(&project_path, &session_id).ok())
            .await
            .ok()
            .flatten();

        if let Some(detail) = detail {
            if let Some(usage) = extract_latest_token_usage(&detail) {
                return Some(usage);
            }
        }

        // Backoff (skip sleep after the last attempt)
        if attempt + 1 < MAX_ATTEMPTS {
            sleep(Duration::from_millis(150)).await;
        }
    }

    None
}

// ============================================================================
// Binary Detection
// ============================================================================

/// Find Gemini CLI binary path
pub fn find_gemini_binary() -> Result<String, String> {
    // 0. 统一的运行时检测（环境变量/注册表/常见路径/用户配置）
    let (_env, detected) = detect_binary_for_tool("gemini", "GEMINI_CLI_PATH", "gemini");
    if let Some(inst) = detected {
        if test_gemini_binary(&inst.path) {
            log::info!(
                "Found Gemini CLI via runtime detection ({}): {}",
                inst.source,
                inst.path
            );
            return Ok(inst.path);
        } else {
            log::warn!("Gemini CLI candidate not executable: {}", inst.path);
        }
    }

    // 1. Check environment variable
    if let Ok(path) = std::env::var("GEMINI_CLI_PATH") {
        if std::path::Path::new(&path).exists() {
            log::info!("Found Gemini CLI from GEMINI_CLI_PATH: {}", path);
            return Ok(path);
        }
    }

    // 2. Check common npm global paths
    #[cfg(target_os = "windows")]
    let npm_paths = vec![
        // npm global (Windows)
        dirs::data_dir()
            .map(|d| d.join("npm").join("gemini.cmd"))
            .unwrap_or_default(),
        dirs::data_dir()
            .map(|d| d.join("npm").join("gemini"))
            .unwrap_or_default(),
        // AppData/Roaming/npm
        std::env::var("APPDATA")
            .map(|d| std::path::PathBuf::from(d).join("npm").join("gemini.cmd"))
            .unwrap_or_default(),
    ];

    #[cfg(not(target_os = "windows"))]
    let npm_paths = vec![
        // npm global (Unix)
        std::path::PathBuf::from("/usr/local/bin/gemini"),
        std::path::PathBuf::from("/usr/bin/gemini"),
        dirs::home_dir()
            .map(|d| d.join(".npm-global").join("bin").join("gemini"))
            .unwrap_or_default(),
        dirs::home_dir()
            .map(|d| d.join(".local").join("bin").join("gemini"))
            .unwrap_or_default(),
        // Homebrew (macOS)
        std::path::PathBuf::from("/opt/homebrew/bin/gemini"),
    ];

    for path in npm_paths {
        if path.exists() {
            let path_str = path.to_string_lossy().to_string();
            log::info!("Found Gemini CLI at: {}", path_str);
            return Ok(path_str);
        }
    }

    // 3. Try using 'which' or 'where' command
    #[cfg(target_os = "windows")]
    let which_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let which_cmd = "which";

    let mut cmd = std::process::Command::new(which_cmd);
    cmd.arg("gemini");

    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);

            // On Windows, 'where' may return multiple lines. Prefer paths with executable extensions
            #[cfg(target_os = "windows")]
            {
                let executable_extensions = [".exe", ".cmd", ".bat", ".ps1"];

                // First pass: find paths with executable extensions
                for line in output_str.lines() {
                    let path = line.trim();
                    if path.is_empty() {
                        continue;
                    }
                    if !std::path::Path::new(path).exists() {
                        continue;
                    }
                    let has_exec_ext = executable_extensions
                        .iter()
                        .any(|ext| path.to_lowercase().ends_with(ext));
                    if has_exec_ext {
                        log::info!("Found Gemini CLI via {}: {}", which_cmd, path);
                        return Ok(path.to_string());
                    }
                }

                // Second pass: try adding extensions to paths without them
                for line in output_str.lines() {
                    let path = line.trim();
                    if path.is_empty() {
                        continue;
                    }
                    let path_buf = std::path::PathBuf::from(path);
                    if path_buf.extension().is_none() {
                        for ext in &executable_extensions {
                            let with_ext = format!("{}{}", path, ext);
                            if std::path::Path::new(&with_ext).exists() {
                                log::info!(
                                    "Found Gemini CLI via {} (resolved extension): {}",
                                    which_cmd,
                                    with_ext
                                );
                                return Ok(with_ext);
                            }
                        }
                    }
                }

                // Last resort: return first existing path
                for line in output_str.lines() {
                    let path = line.trim();
                    if !path.is_empty() && std::path::Path::new(path).exists() {
                        log::info!("Found Gemini CLI via {}: {}", which_cmd, path);
                        return Ok(path.to_string());
                    }
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                let path = output_str.trim().lines().next().unwrap_or("").to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    log::info!("Found Gemini CLI via {}: {}", which_cmd, path);
                    return Ok(path);
                }
            }
        }
    }

    // 4. Windows only: Check WSL for Gemini CLI
    #[cfg(target_os = "windows")]
    {
        let wsl_runtime = wsl_utils::get_gemini_wsl_runtime();
        if wsl_runtime.enabled {
            if let Some(ref wsl_path) = wsl_runtime.gemini_path_in_wsl {
                log::info!(
                    "Found Gemini CLI in WSL ({:?}): {}",
                    wsl_runtime.distro,
                    wsl_path
                );
                // Return a special marker to indicate WSL mode
                return Ok(format!("WSL:{}", wsl_path));
            }
        }
    }

    Err("Gemini CLI not found. Install with: npm install -g @google/gemini-cli".to_string())
}

/// Get Gemini CLI version
pub fn get_gemini_version(gemini_path: &str) -> Option<String> {
    // Check if this is a WSL path
    if gemini_path.starts_with("WSL:") {
        #[cfg(target_os = "windows")]
        {
            let wsl_runtime = wsl_utils::get_gemini_wsl_runtime();
            return wsl_utils::get_wsl_gemini_version(wsl_runtime.distro.as_deref());
        }
        #[cfg(not(target_os = "windows"))]
        {
            return None;
        }
    }

    let mut cmd = std::process::Command::new(gemini_path);
    cmd.arg("--version");

    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().ok()?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Some(version)
    } else {
        None
    }
}

fn test_gemini_binary(path: &str) -> bool {
    let mut cmd = std::process::Command::new(path);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

// ============================================================================
// Tauri Commands - Installation Check
// ============================================================================

/// Check if Gemini CLI is installed
/// 使用全局缓存避免重复检测，减少 WSL 进程创建
#[tauri::command]
pub async fn check_gemini_installed() -> Result<GeminiInstallStatus, String> {
    // 使用缓存避免重复检测
    let result = GEMINI_INSTALL_STATUS_CACHE
        .get_or_init(|| async {
            log::info!("[Gemini] Checking installation status (first time)...");
            do_check_gemini_installed()
        })
        .await;

    log::debug!("[Gemini] Returning cached install status: {:?}", result);
    Ok(result.clone())
}

/// 实际执行 Gemini 安装检测（内部函数）
fn do_check_gemini_installed() -> GeminiInstallStatus {
    match find_gemini_binary() {
        Ok(path) => {
            let is_wsl = path.starts_with("WSL:");
            let version = get_gemini_version(&path);

            // Format the version string with WSL indicator if applicable
            let display_version = if is_wsl {
                version.map(|v| format!("WSL: {}", v))
            } else {
                version
            };

            GeminiInstallStatus {
                installed: true,
                path: Some(path),
                version: display_version,
                error: None,
            }
        }
        Err(e) => GeminiInstallStatus {
            installed: false,
            path: None,
            version: None,
            error: Some(e),
        },
    }
}

// ============================================================================
// Tauri Commands - Session Execution
// ============================================================================

/// Execute Gemini CLI with streaming output
#[tauri::command]
pub async fn execute_gemini(
    options: GeminiExecutionOptions,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Avoid logging sensitive fields (prompt). Log only non-sensitive metadata.
    log::info!(
        "execute_gemini called: project_path={}, model={:?}, approval_mode={:?}, include_directories_count={}, session_id_present={}, debug={}, prompt_len={}",
        options.project_path,
        options.model,
        options.approval_mode,
        options
            .include_directories
            .as_ref()
            .map(|dirs| dirs.len())
            .unwrap_or(0),
        options.session_id.is_some(),
        options.debug,
        options.prompt.len()
    );

    // Find Gemini binary
    let gemini_path = find_gemini_binary()?;
    let is_wsl = gemini_path.starts_with("WSL:");

    // Load configuration
    let config = load_gemini_config().unwrap_or_default();

    // Build command arguments
    let mut args = vec!["--output-format".to_string(), "stream-json".to_string()];

    // Check if we're resuming a session
    // Note: Gemini CLI --resume accepts "latest" or index number (e.g. "5"), not UUID
    // For simplicity, we use "latest" when session_id is provided
    let is_resuming = options.session_id.is_some();
    if is_resuming {
        args.push("--resume".to_string());
        args.push("latest".to_string());
    }

    // Add model if specified (or use default from config)
    let model = options.model.as_ref().unwrap_or(&config.default_model);
    args.push("--model".to_string());
    args.push(model.clone());

    // Add approval mode
    let approval_mode = options
        .approval_mode
        .as_ref()
        .unwrap_or(&config.approval_mode);
    if approval_mode == "yolo" {
        args.push("--yolo".to_string());
    } else if approval_mode != "default" {
        args.push("--approval-mode".to_string());
        args.push(approval_mode.clone());
    }

    // Add include directories if specified
    if let Some(dirs) = &options.include_directories {
        if !dirs.is_empty() {
            args.push("--include-directories".to_string());
            // For WSL mode, convert Windows paths to WSL paths
            #[cfg(target_os = "windows")]
            let dirs_str = if is_wsl {
                let wsl_runtime = wsl_utils::get_gemini_wsl_runtime();
                dirs.iter()
                    .map(|d| {
                        wsl_utils::windows_to_wsl_path_with_distro(
                            d,
                            wsl_runtime.distro.as_deref(),
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(",")
            } else {
                dirs.join(",")
            };
            #[cfg(not(target_os = "windows"))]
            let dirs_str = dirs.join(",");
            args.push(dirs_str);
        }
    }

    // Add debug flag if enabled
    if options.debug {
        args.push("--debug".to_string());
    }

    // Note: Prompt will be passed via stdin to support multiline content
    // Command line arguments have length limits and special character issues on Windows

    // Build command based on execution mode (native or WSL)
    let cmd = if is_wsl {
        // WSL mode
        #[cfg(target_os = "windows")]
        {
            let wsl_runtime = wsl_utils::get_gemini_wsl_runtime();
            let gemini_program = gemini_path
                .strip_prefix("WSL:")
                .filter(|s| !s.is_empty())
                .unwrap_or("gemini");
            log::info!(
                "Gemini command (WSL): {} {:?} in distro {:?}",
                gemini_program,
                args,
                wsl_runtime.distro
            );

            let mut cmd = wsl_utils::build_wsl_command_async(
                gemini_program,
                &args,
                Some(&options.project_path),
                wsl_runtime.distro.as_deref(),
            );

            // Set environment variables from config
            // Note: Environment variables will be passed to WSL environment
            let env_vars = build_gemini_env(&config);
            for (key, value) in env_vars {
                cmd.env(&key, &value);
            }

            cmd
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err("WSL mode is only available on Windows".to_string());
        }
    } else {
        // Native mode
        log::info!("Gemini command: {} {:?}", gemini_path, args);

        let mut cmd = Command::new(&gemini_path);
        cmd.args(&args);
        cmd.current_dir(&options.project_path);

        // Set environment variables from config
        let env_vars = build_gemini_env(&config);
        for (key, value) in env_vars {
            cmd.env(&key, &value);
        }

        cmd
    };

    // Execute process with prompt via stdin
    execute_gemini_process(
        cmd,
        options.project_path,
        model.clone(),
        Some(options.prompt),
        app_handle,
    )
    .await
}

/// Cancel a running Gemini execution
#[tauri::command]
pub async fn cancel_gemini(
    session_id: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("cancel_gemini called for session: {:?}", session_id);

    let state: tauri::State<'_, GeminiProcessState> = app_handle.state();
    let mut processes = state.processes.lock().await;

    if let Some(sid) = session_id {
        // Cancel specific session
        if let Some(mut handle) = processes.remove(&sid) {
            // Kill the process - JobObject will automatically terminate all child processes when dropped
            handle
                .child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
            log::info!("Killed Gemini process for session: {} (PID: {})", sid, handle.pid);

            // JobObject is dropped here, killing all child processes (MCP servers, node.exe, etc.)
            drop(handle.job_object);

            // Emit cancellation event
            let _ = app_handle.emit(&format!("gemini-cancelled:{}", sid), true);
            let _ = app_handle.emit("gemini-cancelled", true);
        } else {
            log::warn!("No running process found for session: {}", sid);
        }
    } else {
        // Cancel all processes
        for (sid, mut handle) in processes.drain() {
            if let Err(e) = handle.child.kill().await {
                log::error!("Failed to kill process for session {}: {}", sid, e);
            } else {
                log::info!("Killed Gemini process for session: {} (PID: {})", sid, handle.pid);
            }
            // JobObject is dropped here, killing all child processes
            drop(handle.job_object);
        }
        let _ = app_handle.emit("gemini-cancelled", true);
    }

    Ok(())
}

// ============================================================================
// Process Execution
// ============================================================================

/// Execute a Gemini process and stream output to frontend
///
/// 🔥 斜杠命令支持：斜杠命令通过 -p 参数传递（触发命令解析），普通 prompt 通过 stdin 管道传递
/// 这样既支持斜杠命令，又避免操作系统命令行长度限制（Windows ~8KB, Linux/macOS ~128KB-2MB）
async fn execute_gemini_process(
    mut cmd: Command,
    project_path: String,
    model: String,
    prompt: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 🔥 关键修复：检测斜杠命令，通过 -p 参数传递以触发命令解析
    // Gemini CLI 在非交互模式下支持斜杠命令（自 v0.1.59 起，PR #8305）
    let use_p_flag = prompt
        .as_ref()
        .map(|p| is_slash_command(p))
        .unwrap_or(false);

    if use_p_flag {
        if let Some(ref prompt_text) = prompt {
            log::info!(
                "Detected slash command, using -p flag: {}",
                prompt_text.trim()
            );
            cmd.arg("-p");
            cmd.arg(prompt_text);
        }
    }

    // Setup stdio - use piped stdin to pass prompt (supports multiline content)
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Apply platform-specific no-window configuration
    apply_no_window_async(&mut cmd);

    // Spawn process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn gemini: {}", e))?;

    // 🔥 修复：只有非斜杠命令才通过 stdin 传递
    // 斜杠命令已经通过 -p 参数传递，避免重复
    if !use_p_flag {
        if let Some(prompt_text) = prompt {
            if let Some(mut stdin) = child.stdin.take() {
                use tokio::io::AsyncWriteExt;

                log::debug!("Writing prompt to stdin ({} bytes)", prompt_text.len());

                if let Err(e) = stdin.write_all(prompt_text.as_bytes()).await {
                    log::error!("Failed to write prompt to stdin: {}", e);
                    return Err(format!("Failed to write prompt to stdin: {}", e));
                }

                // Close stdin to signal end of input
                drop(stdin);
                log::debug!("Stdin closed successfully");
            } else {
                log::error!("Failed to get stdin handle");
                return Err("Failed to get stdin handle".to_string());
            }
        }
    } else {
        // 斜杠命令模式：关闭 stdin
        if let Some(stdin) = child.stdin.take() {
            drop(stdin);
            log::debug!("Stdin closed for slash command mode");
        }
    }

    // Extract stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Get process PID for proper cleanup (needed to kill child processes)
    let pid = child
        .id()
        .ok_or("Failed to get process ID - process may have already exited")?;
    log::info!("[Gemini] Spawned process with PID: {}", pid);

    // Windows robustness: assign the process to a Job Object so *all* descendants are cleaned up
    // even if Gemini CLI spawns detached node.exe processes (MCP servers).
    #[cfg(windows)]
    let job_object = match JobObject::create() {
        Ok(job) => match job.assign_process_by_pid(pid) {
            Ok(_) => {
                log::info!("[Gemini] Assigned PID {} to Job Object for cleanup", pid);
                Some(job)
            }
            Err(e) => {
                log::warn!("[Gemini] Failed to assign PID {} to Job Object: {}", pid, e);
                None
            }
        },
        Err(e) => {
            log::warn!("[Gemini] Failed to create Job Object: {}", e);
            None
        }
    };

    #[cfg(not(windows))]
    let job_object: Option<JobObject> = None;

    // Generate session ID
    let session_id = format!("gemini-{}", uuid::Uuid::new_v4());

    // Store process in state with PID and JobObject for proper cleanup
    let state: tauri::State<'_, GeminiProcessState> = app_handle.state();
    {
        let mut processes = state.processes.lock().await;
        let handle = GeminiProcessHandle {
            child,
            pid,
            job_object,
        };
        processes.insert(session_id.clone(), handle);

        let mut last_session = state.last_session_id.lock().await;
        *last_session = Some(session_id.clone());
    }

    // Emit session init event
    let init_payload = serde_json::json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": model,
        "project_path": project_path,
        "geminiMetadata": {
            "provider": "gemini",
            "eventType": "session_init"
        }
    });

    if let Err(e) = app_handle.emit("gemini-session-init", &init_payload) {
        log::error!("Failed to emit gemini-session-init: {}", e);
    }

    // Also emit as gemini-output for unified handling
    let init_line = serde_json::to_string(&init_payload).unwrap_or_default();
    let _ = app_handle.emit(&format!("gemini-output:{}", session_id), &init_line);
    let _ = app_handle.emit("gemini-output", &init_line);

    log::info!("Gemini session initialized with ID: {}", session_id);

    // 🔧 FIX: Use channels to track stdout/stderr closure for timeout detection
    let (stdout_done_tx, stdout_done_rx) = tokio::sync::oneshot::channel();
    let (stderr_done_tx, stderr_done_rx) = tokio::sync::oneshot::channel();

    // Clone handles for async tasks
    let app_handle_stdout = app_handle.clone();
    let app_handle_stderr = app_handle.clone();
    let app_handle_complete = app_handle.clone();
    let session_id_stdout = session_id.clone();
    let session_id_stderr = session_id.clone();
    let session_id_complete = session_id.clone();

    // Spawn task to read stdout (JSONL events)
    let model_for_messages = model.clone();
    let project_path_for_usage = project_path.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut real_cli_session_id_emitted = false;
        let mut real_cli_session_id: Option<String> = None;
        // Track tool calls to enrich tool_result payloads (e.g., read_file returning empty output)
        let mut tool_calls: std::collections::HashMap<String, (String, serde_json::Value)> =
            std::collections::HashMap::new();

        while let Ok(Some(line)) = reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            // Use trace level to avoid flooding logs in debug mode
            log::trace!("Gemini output: {}", line);

            // Try to parse and convert to unified format
            let mut unified_message = if let Ok(mut event) = parse_gemini_line(&line) {
                // 🔧 FIX: Check if this is an init event with real Gemini CLI session ID
                if !real_cli_session_id_emitted {
                    if let super::types::GeminiStreamEvent::Init {
                        session_id: Some(ref cli_session_id),
                        ..
                    } = event
                    {
                        real_cli_session_id = Some(cli_session_id.clone());
                        // Emit the real Gemini CLI session ID to frontend
                        log::info!("[Gemini] Detected real CLI session ID: {}", cli_session_id);
                        let cli_session_payload = serde_json::json!({
                            "backend_session_id": session_id_stdout,
                            "cli_session_id": cli_session_id,
                        });
                        if let Err(e) =
                            app_handle_stdout.emit("gemini-cli-session-id", &cli_session_payload)
                        {
                            log::error!("Failed to emit gemini-cli-session-id: {}", e);
                        }
                        real_cli_session_id_emitted = true;
                    }
                }

                // Ensure result events have usageMetadata (cache/thoughts/tool breakdown) when available in history.
                if let super::types::GeminiStreamEvent::Result {
                    usage_metadata, ..
                } = &mut event
                {
                    if usage_metadata.is_none() {
                        if let Some(ref cli_session_id) = real_cli_session_id {
                            if let Some(enriched) = try_load_latest_session_token_usage(
                                &project_path_for_usage,
                                cli_session_id,
                            )
                            .await
                            {
                                *usage_metadata = Some(enriched);
                            }
                        }
                    }
                }

                // Record tool_use params for later enrichment of tool_result
                if let super::types::GeminiStreamEvent::ToolUse {
                    tool_name,
                    tool_id,
                    parameters,
                    ..
                } = &event
                {
                    tool_calls.insert(tool_id.clone(), (tool_name.clone(), parameters.clone()));
                }

                // Enrich tool_result with inline file content if CLI returned empty output
                if let super::types::GeminiStreamEvent::ToolResult {
                    tool_id,
                    output,
                    status: _status,
                    ..
                } = &mut event
                {
                    if let Some((tool_name, params)) = tool_calls.get(tool_id).cloned() {
                        let is_read_tool = {
                            let name_lower = tool_name.to_lowercase();
                            name_lower == "read" || name_lower == "read_file"
                        };

                        let output_empty = output.is_null()
                            || output.as_str().map(|s| s.is_empty()).unwrap_or(false);

                        if is_read_tool && output_empty {
                            let file_path = params
                                .get("file_path")
                                .and_then(|v| v.as_str())
                                .or_else(|| params.get("path").and_then(|v| v.as_str()));

                            if let Some(path) = file_path {
                                match tokio::fs::read_to_string(path).await {
                                    Ok(content) => {
                                        // Wrap as functionResponse to align with frontend parser
                                        *output = serde_json::json!([{
                                            "functionResponse": {
                                                "id": tool_id,
                                                "name": tool_name,
                                                "response": { "output": content }
                                            }
                                        }]);
                                        log::info!("[Gemini] Filled empty tool_result output for {} from path {}", tool_id, path);
                                    }
                                    Err(err) => {
                                        log::warn!(
                                            "[Gemini] Failed to read file for tool_result {}: {}",
                                            tool_id,
                                            err
                                        );
                                        // Keep original empty output; frontend will handle gracefully
                                    }
                                }
                            } else {
                                log::warn!(
                                    "[Gemini] No file_path found for tool_result {}",
                                    tool_id
                                );
                            }
                        }

                        // Optionally add status-based log for visibility
                        if output_empty && !is_read_tool {
                            log::debug!(
                                "[Gemini] tool_result {} had empty output (tool: {})",
                                tool_id,
                                tool_name
                            );
                        }
                    } else {
                        // No prior tool_use recorded; keep original
                        log::debug!(
                            "[Gemini] tool_result {} without prior tool_use record",
                            tool_id
                        );
                    }
                }

                convert_to_unified_message(&event)
            } else if let Ok(raw) = parse_gemini_line_flexible(&line) {
                // 🔧 FIX: Also check raw JSON for init event with session_id
                if !real_cli_session_id_emitted {
                    if raw.get("type").and_then(|t| t.as_str()) == Some("init") {
                        if let Some(cli_session_id) = raw.get("session_id").and_then(|s| s.as_str())
                        {
                            real_cli_session_id = Some(cli_session_id.to_string());
                            log::info!(
                                "[Gemini] Detected real CLI session ID (raw): {}",
                                cli_session_id
                            );
                            let cli_session_payload = serde_json::json!({
                                "backend_session_id": session_id_stdout,
                                "cli_session_id": cli_session_id,
                            });
                            if let Err(e) = app_handle_stdout
                                .emit("gemini-cli-session-id", &cli_session_payload)
                            {
                                log::error!("Failed to emit gemini-cli-session-id: {}", e);
                            }
                            real_cli_session_id_emitted = true;
                        }
                    }
                }
                convert_raw_to_unified_message(&raw)
            } else {
                // Fallback: emit raw line as system message
                serde_json::json!({
                    "type": "system",
                    "subtype": "raw",
                    "content": line,
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "raw"
                    }
                })
            };

            // Ensure engine/model are present for consistent frontend cost/context calculations
            if let Some(obj) = unified_message.as_object_mut() {
                obj.entry("engine")
                    .or_insert_with(|| serde_json::Value::String("gemini".to_string()));

                let should_set_model = match obj.get("model") {
                    None => true,
                    Some(v) => v.is_null() || v.as_str().map(|s| s.trim().is_empty()).unwrap_or(false),
                };
                if should_set_model {
                    obj.insert(
                        "model".to_string(),
                        serde_json::Value::String(model_for_messages.clone()),
                    );
                }
            }

            let unified_line = serde_json::to_string(&unified_message).unwrap_or(line.clone());

            // Emit to session-specific channel
            if let Err(e) = app_handle_stdout.emit(
                &format!("gemini-output:{}", session_id_stdout),
                &unified_line,
            ) {
                log::error!("Failed to emit gemini-output (session): {}", e);
            }

            // Also emit to global channel
            if let Err(e) = app_handle_stdout.emit("gemini-output", &unified_line) {
                log::error!("Failed to emit gemini-output (global): {}", e);
            }
        }

        log::info!("[Gemini] Stdout closed for session: {}", session_id_stdout);
        // Signal that stdout is done (ignore send error if receiver dropped)
        let _ = stdout_done_tx.send(());
    });

    // Spawn task to read stderr
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                log::warn!("Gemini stderr: {}", line);

                // Emit stderr as error event
                let error_message = serde_json::json!({
                    "type": "system",
                    "subtype": "error",
                    "error": {
                        "message": line
                    },
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "stderr"
                    }
                });

                let error_line = serde_json::to_string(&error_message).unwrap_or(line.clone());

                let _ = app_handle_stderr
                    .emit(&format!("gemini-error:{}", session_id_stderr), &error_line);
                let _ = app_handle_stderr.emit("gemini-error", &error_line);
            }
        }

        log::info!("[Gemini] Stderr closed for session: {}", session_id_stderr);
        // Signal that stderr is done (ignore send error if receiver dropped)
        let _ = stderr_done_tx.send(());
    });

    // Spawn task to wait for process completion
    // 🔧 FIX: Add timeout mechanism - if stdout/stderr are closed but process doesn't exit within 30s, force completion
    let state_complete = app_handle.state::<GeminiProcessState>();
    let processes_complete = state_complete.processes.clone();

    tokio::spawn(async move {
        // Wait for both stdout and stderr to close
        let _ = tokio::join!(stdout_done_rx, stderr_done_rx);
        log::info!(
            "[Gemini] Both stdout and stderr closed for session: {}",
            session_id_complete
        );

        // After streams close, give process up to 30 seconds to exit gracefully
        let timeout_duration = tokio::time::Duration::from_secs(30);

        // Try to wait for process with timeout
        let wait_result = tokio::time::timeout(timeout_duration, async {
            let mut processes = processes_complete.lock().await;
            if let Some(mut handle) = processes.remove(&session_id_complete) {
                let result = handle.child.wait().await;
                // JobObject is dropped here when handle goes out of scope,
                // ensuring all child processes (MCP servers, node.exe, etc.) are terminated
                log::debug!("[Gemini] Process handle dropped, JobObject cleaning up child processes for PID: {}", handle.pid);
                result
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Process not found",
                ))
            }
        })
        .await;

        let (success, exit_code) = match wait_result {
            Ok(Ok(status)) => {
                let success = status.success();
                log::info!(
                    "[Gemini] Process exited with status: {} (success: {})",
                    status,
                    success
                );
                (success, status.code())
            }
            Ok(Err(e)) => {
                log::error!("[Gemini] Failed to wait for process: {}", e);
                (false, None)
            }
            Err(_) => {
                // Timeout occurred
                log::warn!(
                    "[Gemini] Process {} did not exit within {}s after streams closed, assuming hung - forcing completion",
                    session_id_complete,
                    timeout_duration.as_secs()
                );
                // Try to kill the hung process
                let mut processes = processes_complete.lock().await;
                if let Some(mut handle) = processes.remove(&session_id_complete) {
                    if let Err(e) = handle.child.kill().await {
                        log::error!("[Gemini] Failed to kill hung process: {}", e);
                    }
                    // JobObject is dropped here, killing all child processes
                    log::info!("[Gemini] Force-dropped JobObject for hung process PID: {}", handle.pid);
                }
                (false, None)
            }
        };

        // Emit completion event
        let complete_payload = serde_json::json!({
            "type": "result",
            "status": if success { "success" } else { "error" },
            "geminiMetadata": {
                "provider": "gemini",
                "eventType": "complete",
                "exitCode": exit_code
            }
        });

        let complete_line = serde_json::to_string(&complete_payload).unwrap_or_default();

        let _ = app_handle_complete.emit(
            &format!("gemini-output:{}", session_id_complete),
            &complete_line,
        );
        let _ = app_handle_complete.emit("gemini-output", &complete_line);

        let _ =
            app_handle_complete.emit(&format!("gemini-complete:{}", session_id_complete), success);
        let _ = app_handle_complete.emit("gemini-complete", success);
    });

    Ok(())
}
