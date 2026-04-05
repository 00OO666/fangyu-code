//! Kiro CLI Runner
//! 
//! 通过 WSL 调用 Kiro CLI 执行 AI 对话
//! 支持流式输出和模型选择

use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;
use tokio::sync::Mutex;
use std::process::Stdio;

/// Kiro 进程状态
#[allow(dead_code)]
pub struct KiroProcessState {
    pub current_process: Arc<Mutex<Option<tokio::process::Child>>>,
    pub last_spawned_pid: Arc<Mutex<Option<u32>>>,
}

impl Default for KiroProcessState {
    fn default() -> Self {
        Self {
            current_process: Arc::new(Mutex::new(None)),
            last_spawned_pid: Arc::new(Mutex::new(None)),
        }
    }
}

/// Kiro 支持的模型
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KiroModel {
    pub id: String,
    pub name: String,
    pub multiplier: f32,
    pub description: String,
}

/// 获取 Kiro 支持的模型列表
#[tauri::command]
pub async fn get_kiro_models() -> Result<Vec<KiroModel>, String> {
    Ok(vec![
        KiroModel {
            id: "auto".to_string(),
            name: "Auto".to_string(),
            multiplier: 1.0,
            description: "自动选择最佳模型".to_string(),
        },
        KiroModel {
            id: "claude-opus-4.5".to_string(),
            name: "Claude Opus 4.5".to_string(),
            multiplier: 2.2,
            description: "最强大的模型，适合复杂推理".to_string(),
        },
        KiroModel {
            id: "claude-sonnet-4.5".to_string(),
            name: "Claude Sonnet 4.5".to_string(),
            multiplier: 1.3,
            description: "平衡性能和成本".to_string(),
        },
        KiroModel {
            id: "claude-sonnet-4".to_string(),
            name: "Claude Sonnet 4".to_string(),
            multiplier: 1.3,
            description: "混合推理模型".to_string(),
        },
        KiroModel {
            id: "claude-haiku-4.5".to_string(),
            name: "Claude Haiku 4.5".to_string(),
            multiplier: 0.4,
            description: "快速响应，适合简单任务".to_string(),
        },
    ])
}

/// 检查 Kiro CLI 是否已安装
#[tauri::command]
pub async fn check_kiro_cli_installed() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        // 在 Windows 上通过 WSL 检查
        let output = Command::new("wsl")
            .args(["-d", "Ubuntu", "-e", "bash", "-lc", "which kiro-cli"])
            .output()
            .await
            .map_err(|e| format!("Failed to check Kiro CLI: {}", e))?;
        
        Ok(output.status.success() && !output.stdout.is_empty())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // 在 Linux/macOS 上直接检查
        let output = Command::new("which")
            .arg("kiro-cli")
            .output()
            .await
            .map_err(|e| format!("Failed to check Kiro CLI: {}", e))?;
        
        Ok(output.status.success())
    }
}

/// 检查 Kiro CLI 登录状态
#[tauri::command]
pub async fn check_kiro_cli_logged_in() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wsl")
            .args(["-d", "Ubuntu", "-e", "bash", "-lc", "kiro-cli whoami 2>/dev/null"])
            .output()
            .await
            .map_err(|e| format!("Failed to check Kiro login status: {}", e))?;
        
        // 如果命令成功且有输出，说明已登录
        Ok(output.status.success() && !output.stdout.is_empty())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("kiro-cli")
            .args(["whoami"])
            .output()
            .await
            .map_err(|e| format!("Failed to check Kiro login status: {}", e))?;
        
        Ok(output.status.success() && !output.stdout.is_empty())
    }
}

/// 获取 Kiro CLI 版本
#[tauri::command]
pub async fn get_kiro_cli_version() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wsl")
            .args(["-d", "Ubuntu", "-e", "bash", "-lc", "kiro-cli --version"])
            .output()
            .await
            .map_err(|e| format!("Failed to get Kiro CLI version: {}", e))?;
        
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("Kiro CLI not found".to_string())
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("kiro-cli")
            .args(["--version"])
            .output()
            .await
            .map_err(|e| format!("Failed to get Kiro CLI version: {}", e))?;
        
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("Kiro CLI not found".to_string())
        }
    }
}


/// 执行 Kiro CLI 对话（流式输出）
#[tauri::command]
pub async fn execute_kiro_chat(
    app: AppHandle,
    prompt: String,
    model: Option<String>,
    project_path: Option<String>,
    tab_id: Option<String>,
) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    
    log::info!(
        "Starting Kiro CLI chat with model: {:?}, project: {:?}",
        model,
        project_path
    );
    
    // 构建命令
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut cmd = Command::new("wsl");
        
        // 构建 kiro-cli 命令
        let mut kiro_cmd = "kiro-cli chat".to_string();
        
        // 添加模型参数
        if let Some(ref m) = model {
            if m != "auto" {
                kiro_cmd.push_str(&format!(" --model {}", m));
            }
        }
        
        // 添加非交互模式标志（如果支持）
        // kiro_cmd.push_str(" --no-interactive");
        
        cmd.args(["-d", "Ubuntu", "-e", "bash", "-lc", &kiro_cmd]);
        cmd
    };
    
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut cmd = Command::new("kiro-cli");
        cmd.arg("chat");
        
        if let Some(ref m) = model {
            if m != "auto" {
                cmd.args(["--model", m]);
            }
        }
        
        cmd
    };
    
    // 设置工作目录
    if let Some(ref path) = project_path {
        #[cfg(not(target_os = "windows"))]
        {
            cmd.current_dir(path);
        }
        // Windows WSL 需要转换路径
        #[cfg(target_os = "windows")]
        {
            log::info!("Project path (Windows): {}", path);
            // WSL 路径转换在 bash 命令中处理
        }
    }
    
    // 配置 stdio
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    // 隐藏 Windows 控制台窗口
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    // 启动进程
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Kiro CLI: {}", e))?;
    
    let pid = child.id().unwrap_or(0);
    log::info!("Spawned Kiro CLI process with PID: {}", pid);
    
    // 发送 prompt 到 stdin
    if let Some(mut stdin) = child.stdin.take() {
        let prompt_clone = prompt.clone();
        tokio::spawn(async move {
            if let Err(e) = stdin.write_all(prompt_clone.as_bytes()).await {
                log::error!("Failed to write prompt to Kiro stdin: {}", e);
                return;
            }
            if let Err(e) = stdin.write_all(b"\n").await {
                log::error!("Failed to write newline to Kiro stdin: {}", e);
                return;
            }
            if let Err(e) = stdin.shutdown().await {
                log::warn!("Failed to shutdown Kiro stdin: {}", e);
            }
            log::info!("Successfully sent prompt to Kiro CLI");
        });
    }
    
    // 获取 stdout 和 stderr
    let stdout = child.stdout.take().ok_or("Failed to get Kiro stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get Kiro stderr")?;
    
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    // 处理 stdout
    let app_handle = app.clone();
    let tab_id_stdout = tab_id.clone();
    let stdout_task = tokio::spawn(async move {
        let mut lines = stdout_reader.lines();
        let mut full_response = String::new();
        
        while let Ok(Some(line)) = lines.next_line().await {
            log::trace!("Kiro stdout: {}", line);
            full_response.push_str(&line);
            full_response.push('\n');
            
            // 发送到前端
            let payload = serde_json::json!({
                "tab_id": tab_id_stdout,
                "type": "text",
                "content": line,
            });
            let _ = app_handle.emit("kiro-output", &payload);
        }
        
        full_response
    });
    
    // 处理 stderr
    let app_handle_stderr = app.clone();
    let tab_id_stderr = tab_id.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        
        while let Ok(Some(line)) = lines.next_line().await {
            log::error!("Kiro stderr: {}", line);
            
            let payload = serde_json::json!({
                "tab_id": tab_id_stderr,
                "type": "error",
                "content": line,
            });
            let _ = app_handle_stderr.emit("kiro-error", &payload);
        }
    });
    
    // 等待进程完成
    let app_handle_wait = app.clone();
    let tab_id_complete = tab_id;
    tokio::spawn(async move {
        let _ = stdout_task.await;
        let _ = stderr_task.await;
        
        match child.wait().await {
            Ok(status) => {
                log::info!("Kiro CLI process exited with status: {}", status);
                
                let payload = serde_json::json!({
                    "tab_id": tab_id_complete,
                    "success": status.success(),
                });
                let _ = app_handle_wait.emit("kiro-complete", &payload);
            }
            Err(e) => {
                log::error!("Failed to wait for Kiro CLI process: {}", e);
                
                let payload = serde_json::json!({
                    "tab_id": tab_id_complete,
                    "success": false,
                    "error": e.to_string(),
                });
                let _ = app_handle_wait.emit("kiro-complete", &payload);
            }
        }
    });
    
    Ok(())
}

/// 取消 Kiro CLI 执行
#[tauri::command]
pub async fn cancel_kiro_execution(
    app: AppHandle,
    tab_id: Option<String>,
) -> Result<(), String> {
    log::info!("Cancelling Kiro CLI execution for tab: {:?}", tab_id);
    
    // 发送取消事件
    let payload = serde_json::json!({
        "tab_id": tab_id,
        "cancelled": true,
    });
    let _ = app.emit("kiro-cancelled", &payload);
    
    // TODO: 实现进程终止逻辑（需要跟踪进程）
    
    Ok(())
}

/// 打开 Kiro CLI 登录（在终端中）
#[tauri::command]
pub async fn open_kiro_login() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // 在 Windows 上打开 WSL 终端执行登录
        let _output = Command::new("cmd")
            .args(["/c", "start", "wsl", "-d", "Ubuntu", "-e", "bash", "-lc", "kiro-cli login"])
            .spawn()
            .map_err(|e| format!("Failed to open Kiro login: {}", e))?;
        
        Ok("已在新终端窗口中打开 Kiro CLI 登录，请在浏览器中完成认证".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .args(["-a", "Terminal", "--args", "kiro-cli", "login"])
            .spawn()
            .map_err(|e| format!("Failed to open Kiro login: {}", e))?;
        
        Ok("已在新终端窗口中打开 Kiro CLI 登录".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        // 尝试常见的终端模拟器
        let terminals = ["gnome-terminal", "konsole", "xterm", "x-terminal-emulator"];
        
        for terminal in terminals {
            if Command::new("which")
                .arg(terminal)
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                let _ = Command::new(terminal)
                    .args(["--", "kiro-cli", "login"])
                    .spawn();
                return Ok(format!("已在 {} 中打开 Kiro CLI 登录", terminal));
            }
        }
        
        Err("未找到可用的终端模拟器".to_string())
    }
}
