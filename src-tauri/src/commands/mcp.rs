//! MCP (Model Context Protocol) 命令模块
//!
//! ## 废弃警告
//!
//! 以下命令依赖 Claude Code CLI 文本解析，已被新的直接文件操作方式替代：
//!
//! ❌ 废弃命令（保留以兼容旧前端，后续可删除）：
//! - mcp_add - 使用 mcp_upsert_server 代替
//! - mcp_list - 使用 mcp_get_all_servers 代替
//! - mcp_get - 使用 mcp_get_all_servers 代替
//! - mcp_remove - 使用 mcp_delete_server 代替
//! - mcp_add_json - 使用 mcp_upsert_server 代替
//! - mcp_add_from_claude_desktop - 使用 mcp_import_from_app("claude") 代替
//! - mcp_export_config - 使用 mcp_read_claude_config 代替
//!
//! ✅ 保留的命令：
//! - mcp_serve - 启动 MCP 服务器
//! - mcp_test_connection - 测试连接
//! - mcp_get_server_status - 获取状态
//! - mcp_reset_project_choices - 重置项目选择
//! - mcp_read_project_config - 读取项目配置
//! - mcp_save_project_config - 保存项目配置
//!
//! ✨ 新增多应用支持命令（第 765-890 行）：
//! - mcp_get_claude_status
//! - mcp_get_all_servers
//! - mcp_upsert_server
//! - mcp_delete_server
//! - mcp_toggle_app
//! - mcp_import_from_app
//! - mcp_validate_command
//! - mcp_read_claude_config

use anyhow::{Context, Result};
use dirs;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

/// Helper function to create a std::process::Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> Command {
    crate::claude_binary::create_command_with_env(program)
}

/// Finds the full path to the claude binary
/// This is necessary because Windows apps may have limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String> {
    crate::claude_binary::find_claude_binary(app_handle).map_err(|e| anyhow::anyhow!(e))
}

/// Represents an MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServer {
    /// Server name/identifier
    pub name: String,
    /// Transport type: "stdio" or "sse"
    pub transport: String,
    /// Command to execute (for stdio)
    pub command: Option<String>,
    /// Command arguments (for stdio)
    pub args: Vec<String>,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// URL endpoint (for SSE)
    pub url: Option<String>,
    /// Configuration scope: "local", "project", or "user"
    pub scope: String,
    /// Whether the server is currently active
    pub is_active: bool,
    /// Server status
    pub status: ServerStatus,
}

/// Server status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    /// Whether the server is running
    pub running: bool,
    /// Last error message if any
    pub error: Option<String>,
    /// Last checked timestamp
    pub last_checked: Option<u64>,
}

/// MCP configuration for project scope (.mcp.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPProjectConfig {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: HashMap<String, MCPServerConfig>,
}

/// Individual server configuration in .mcp.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Result of adding a server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddServerResult {
    pub success: bool,
    pub message: String,
    pub server_name: Option<String>,
}

/// Import result for multiple servers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: u32,
    pub failed_count: u32,
    pub servers: Vec<ImportServerResult>,
}

/// Result for individual server import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportServerResult {
    pub name: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Executes a claude mcp command
fn execute_claude_mcp_command(app_handle: &AppHandle, args: Vec<&str>) -> Result<String> {
    info!("Executing claude mcp command with args: {:?}", args);

    let claude_path = find_claude_binary(app_handle)?;
    let mut cmd = create_command_with_env(&claude_path);
    cmd.arg("mcp");
    for arg in args {
        cmd.arg(arg);
    }

    // Add CREATE_NO_WINDOW flag on Windows to prevent terminal window popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().context("Failed to execute claude command")?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(anyhow::anyhow!("Command failed: {}", stderr))
    }
}

/// Adds a new MCP server
#[tauri::command]
pub async fn mcp_add(
    app: AppHandle,
    name: String,
    transport: String,
    command: Option<String>,
    args: Vec<String>,
    env: HashMap<String, String>,
    url: Option<String>,
    scope: String,
) -> Result<AddServerResult, String> {
    info!("Adding MCP server: {} with transport: {}", name, transport);

    // Prepare owned strings for environment variables
    let env_args: Vec<String> = env
        .iter()
        .map(|(key, value)| format!("{}={}", key, value))
        .collect();

    let mut cmd_args = vec!["add"];

    // Add scope flag
    cmd_args.push("-s");
    cmd_args.push(&scope);

    // Add transport flag for SSE
    if transport == "sse" {
        cmd_args.push("--transport");
        cmd_args.push("sse");
    }

    // Add environment variables
    for (i, _) in env.iter().enumerate() {
        cmd_args.push("-e");
        cmd_args.push(&env_args[i]);
    }

    // Add name
    cmd_args.push(&name);

    // Add command/URL based on transport
    if transport == "stdio" {
        if let Some(cmd) = &command {
            // Add "--" separator before command to prevent argument parsing issues
            if !args.is_empty() || cmd.contains('-') {
                cmd_args.push("--");
            }
            cmd_args.push(cmd);
            // Add arguments
            for arg in &args {
                cmd_args.push(arg);
            }
        } else {
            return Ok(AddServerResult {
                success: false,
                message: "Command is required for stdio transport".to_string(),
                server_name: None,
            });
        }
    } else if transport == "sse" {
        if let Some(url_str) = &url {
            cmd_args.push(url_str);
        } else {
            return Ok(AddServerResult {
                success: false,
                message: "URL is required for SSE transport".to_string(),
                server_name: None,
            });
        }
    }

    match execute_claude_mcp_command(&app, cmd_args) {
        Ok(output) => {
            info!("Successfully added MCP server: {}", name);
            Ok(AddServerResult {
                success: true,
                message: output.trim().to_string(),
                server_name: Some(name),
            })
        }
        Err(e) => {
            error!("Failed to add MCP server: {}", e);
            Ok(AddServerResult {
                success: false,
                message: e.to_string(),
                server_name: None,
            })
        }
    }
}

/// Lists all configured MCP servers
#[tauri::command]
pub async fn mcp_list(app: AppHandle) -> Result<Vec<MCPServer>, String> {
    info!("Listing MCP servers");

    match execute_claude_mcp_command(&app, vec!["list"]) {
        Ok(output) => {
            info!("Raw output from 'claude mcp list': {:?}", output);
            let trimmed = output.trim();
            info!("Trimmed output: {:?}", trimmed);

            // Check if no servers are configured
            if trimmed.contains("No MCP servers configured") || trimmed.is_empty() {
                info!("No servers found - empty or 'No MCP servers' message");
                return Ok(vec![]);
            }

            // Parse the text output, handling multi-line commands
            let mut servers = Vec::new();
            let lines: Vec<&str> = trimmed.lines().collect();
            info!("Total lines in output: {}", lines.len());
            for (idx, line) in lines.iter().enumerate() {
                info!("Line {}: {:?}", idx, line);
            }

            let mut i = 0;

            while i < lines.len() {
                let line = lines[i];
                info!("Processing line {}: {:?}", i, line);

                // Check if this line starts a new server entry
                if let Some(colon_pos) = line.find(':') {
                    info!("Found colon at position {} in line: {:?}", colon_pos, line);
                    // Make sure this is a server name line (not part of a path)
                    // Server names typically don't contain '/' or '\'
                    let potential_name = line[..colon_pos].trim();
                    info!("Potential server name: {:?}", potential_name);

                    if !potential_name.contains('/') && !potential_name.contains('\\') {
                        info!("Valid server name detected: {:?}", potential_name);
                        let name = potential_name.to_string();
                        let mut command_parts = vec![line[colon_pos + 1..].trim().to_string()];
                        info!("Initial command part: {:?}", command_parts[0]);

                        // Check if command continues on next lines
                        i += 1;
                        while i < lines.len() {
                            let next_line = lines[i];
                            info!("Checking next line {} for continuation: {:?}", i, next_line);

                            // If the next line starts with a server name pattern, break
                            if next_line.contains(':') {
                                let potential_next_name =
                                    next_line.split(':').next().unwrap_or("").trim();
                                info!(
                                    "Found colon in next line, potential name: {:?}",
                                    potential_next_name
                                );
                                if !potential_next_name.is_empty()
                                    && !potential_next_name.contains('/')
                                    && !potential_next_name.contains('\\')
                                {
                                    info!("Next line is a new server, breaking");
                                    break;
                                }
                            }
                            // Otherwise, this line is a continuation of the command
                            info!("Line {} is a continuation", i);
                            command_parts.push(next_line.trim().to_string());
                            i += 1;
                        }

                        // Join all command parts
                        let full_command = command_parts.join(" ");
                        info!("Full command for server '{}': {:?}", name, full_command);

                        // For now, we'll create a basic server entry
                        servers.push(MCPServer {
                            name: name.clone(),
                            transport: "stdio".to_string(), // Default assumption
                            command: Some(full_command),
                            args: vec![],
                            env: HashMap::new(),
                            url: None,
                            scope: "local".to_string(), // Default assumption
                            is_active: false,
                            status: ServerStatus {
                                running: false,
                                error: None,
                                last_checked: None,
                            },
                        });
                        info!("Added server: {:?}", name);

                        continue;
                    } else {
                        info!("Skipping line - name contains path separators");
                    }
                } else {
                    info!("No colon found in line {}", i);
                }

                i += 1;
            }

            info!("Found {} MCP servers total", servers.len());
            for (idx, server) in servers.iter().enumerate() {
                info!(
                    "Server {}: name='{}', command={:?}",
                    idx, server.name, server.command
                );
            }
            Ok(servers)
        }
        Err(e) => {
            error!("Failed to list MCP servers: {}", e);
            Err(e.to_string())
        }
    }
}

/// Gets details for a specific MCP server
#[tauri::command]
pub async fn mcp_get(app: AppHandle, name: String) -> Result<MCPServer, String> {
    info!("Getting MCP server details for: {}", name);

    match execute_claude_mcp_command(&app, vec!["get", &name]) {
        Ok(output) => {
            // Parse the structured text output
            let mut scope = "local".to_string();
            let mut transport = "stdio".to_string();
            let mut command = None;
            let mut args = vec![];
            let env = HashMap::new();
            let mut url = None;

            for line in output.lines() {
                let line = line.trim();

                if line.starts_with("Scope:") {
                    let scope_part = line.replace("Scope:", "").trim().to_string();
                    if scope_part.to_lowercase().contains("local") {
                        scope = "local".to_string();
                    } else if scope_part.to_lowercase().contains("project") {
                        scope = "project".to_string();
                    } else if scope_part.to_lowercase().contains("user")
                        || scope_part.to_lowercase().contains("global")
                    {
                        scope = "user".to_string();
                    }
                } else if line.starts_with("Type:") {
                    transport = line.replace("Type:", "").trim().to_string();
                } else if line.starts_with("Command:") {
                    command = Some(line.replace("Command:", "").trim().to_string());
                } else if line.starts_with("Args:") {
                    let args_str = line.replace("Args:", "").trim().to_string();
                    if !args_str.is_empty() {
                        args = args_str.split_whitespace().map(|s| s.to_string()).collect();
                    }
                } else if line.starts_with("URL:") {
                    url = Some(line.replace("URL:", "").trim().to_string());
                } else if line.starts_with("Environment:") {
                    // TODO: Parse environment variables if they're listed
                    // For now, we'll leave it empty
                }
            }

            Ok(MCPServer {
                name,
                transport,
                command,
                args,
                env,
                url,
                scope,
                is_active: false,
                status: ServerStatus {
                    running: false,
                    error: None,
                    last_checked: None,
                },
            })
        }
        Err(e) => {
            error!("Failed to get MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Removes an MCP server
#[tauri::command]
pub async fn mcp_remove(app: AppHandle, name: String) -> Result<String, String> {
    info!("Removing MCP server: {}", name);

    match execute_claude_mcp_command(&app, vec!["remove", &name]) {
        Ok(output) => {
            info!("Successfully removed MCP server: {}", name);
            Ok(output.trim().to_string())
        }
        Err(e) => {
            error!("Failed to remove MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Adds an MCP server from JSON configuration
#[tauri::command]
pub async fn mcp_add_json(
    app: AppHandle,
    name: String,
    json_config: String,
    scope: String,
) -> Result<AddServerResult, String> {
    info!(
        "Adding MCP server from JSON: {} with scope: {}",
        name, scope
    );

    // Build command args
    let mut cmd_args = vec!["add-json", &name, &json_config];

    // Add scope flag
    let scope_flag = "-s";
    cmd_args.push(scope_flag);
    cmd_args.push(&scope);

    match execute_claude_mcp_command(&app, cmd_args) {
        Ok(output) => {
            info!("Successfully added MCP server from JSON: {}", name);
            Ok(AddServerResult {
                success: true,
                message: output.trim().to_string(),
                server_name: Some(name),
            })
        }
        Err(e) => {
            error!("Failed to add MCP server from JSON: {}", e);
            Ok(AddServerResult {
                success: false,
                message: e.to_string(),
                server_name: None,
            })
        }
    }
}

/// Imports MCP servers from Claude Desktop
#[tauri::command]
pub async fn mcp_add_from_claude_desktop(
    app: AppHandle,
    scope: String,
) -> Result<ImportResult, String> {
    info!(
        "Importing MCP servers from Claude Desktop with scope: {}",
        scope
    );

    // ⚡ 正确修复：所有平台的 Claude Code CLI 配置都在同一位置
    // Windows, macOS, Linux 都使用 ~/.claude/ 目录
    let home_dir = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;

    // ⚡ 正确路径：Claude MCP 配置固定为 ~/.claude.json（所有平台统一）
    // 注意：~/.claude/settings.json 是 Claude Code CLI 的主配置文件，而 MCP 配置在 ~/.claude.json
    let config_path = home_dir.join(".claude.json");

    if !config_path.exists() {
        return Err(
            "Claude MCP configuration not found. Please make sure Claude Code is installed and configured.\n\
             Expected: ~/.claude.json".to_string()
        );
    }

    // Read and parse the config file
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read Claude Desktop config: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse Claude Desktop config: {}", e))?;

    // Extract MCP servers
    let mcp_servers = config
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "No MCP servers found in Claude Desktop config".to_string())?;

    let mut imported_count = 0;
    let mut failed_count = 0;
    let mut server_results = Vec::new();

    // Import each server using add-json
    for (name, server_config) in mcp_servers {
        info!("Importing server: {}", name);

        // Convert Claude Desktop format to add-json format
        let mut json_config = serde_json::Map::new();

        // All Claude Desktop servers are stdio type
        json_config.insert(
            "type".to_string(),
            serde_json::Value::String("stdio".to_string()),
        );

        // Add command
        if let Some(command) = server_config.get("command").and_then(|v| v.as_str()) {
            json_config.insert(
                "command".to_string(),
                serde_json::Value::String(command.to_string()),
            );
        } else {
            failed_count += 1;
            server_results.push(ImportServerResult {
                name: name.clone(),
                success: false,
                error: Some("Missing command field".to_string()),
            });
            continue;
        }

        // Add args if present
        if let Some(args) = server_config.get("args").and_then(|v| v.as_array()) {
            json_config.insert("args".to_string(), args.clone().into());
        } else {
            json_config.insert("args".to_string(), serde_json::Value::Array(vec![]));
        }

        // Add env if present
        if let Some(env) = server_config.get("env").and_then(|v| v.as_object()) {
            json_config.insert("env".to_string(), env.clone().into());
        } else {
            json_config.insert(
                "env".to_string(),
                serde_json::Value::Object(serde_json::Map::new()),
            );
        }

        // Convert to JSON string
        let json_str = serde_json::to_string(&json_config)
            .map_err(|e| format!("Failed to serialize config for {}: {}", name, e))?;

        // Call add-json command
        match mcp_add_json(app.clone(), name.clone(), json_str, scope.clone()).await {
            Ok(result) => {
                if result.success {
                    imported_count += 1;
                    server_results.push(ImportServerResult {
                        name: name.clone(),
                        success: true,
                        error: None,
                    });
                    info!("Successfully imported server: {}", name);
                } else {
                    failed_count += 1;
                    let error_msg = result.message.clone();
                    server_results.push(ImportServerResult {
                        name: name.clone(),
                        success: false,
                        error: Some(result.message),
                    });
                    error!("Failed to import server {}: {}", name, error_msg);
                }
            }
            Err(e) => {
                failed_count += 1;
                let error_msg = e.clone();
                server_results.push(ImportServerResult {
                    name: name.clone(),
                    success: false,
                    error: Some(e),
                });
                error!("Error importing server {}: {}", name, error_msg);
            }
        }
    }

    info!(
        "Import complete: {} imported, {} failed",
        imported_count, failed_count
    );

    Ok(ImportResult {
        imported_count,
        failed_count,
        servers: server_results,
    })
}

/// Starts Claude Code as an MCP server
#[tauri::command]
pub async fn mcp_serve(app: AppHandle) -> Result<String, String> {
    info!("Starting Claude Code as MCP server");

    // Start the server in a separate process
    let claude_path = match find_claude_binary(&app) {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to find claude binary: {}", e);
            return Err(e.to_string());
        }
    };

    let mut cmd = create_command_with_env(&claude_path);
    cmd.arg("mcp").arg("serve");

    match cmd.spawn() {
        Ok(_) => {
            info!("Successfully started Claude Code MCP server");
            Ok("Claude Code MCP server started".to_string())
        }
        Err(e) => {
            error!("Failed to start MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Tests connection to an MCP server
#[tauri::command]
pub async fn mcp_test_connection(app: AppHandle, name: String) -> Result<String, String> {
    info!("Testing connection to MCP server: {}", name);

    // For now, we'll use the get command to test if the server exists
    match execute_claude_mcp_command(&app, vec!["get", &name]) {
        Ok(_) => Ok(format!("Connection to {} successful", name)),
        Err(e) => Err(e.to_string()),
    }
}

/// Resets project-scoped server approval choices
#[tauri::command]
pub async fn mcp_reset_project_choices(app: AppHandle) -> Result<String, String> {
    info!("Resetting MCP project choices");

    match execute_claude_mcp_command(&app, vec!["reset-project-choices"]) {
        Ok(output) => {
            info!("Successfully reset MCP project choices");
            Ok(output.trim().to_string())
        }
        Err(e) => {
            error!("Failed to reset project choices: {}", e);
            Err(e.to_string())
        }
    }
}

/// Gets the status of MCP servers
#[tauri::command]
pub async fn mcp_get_server_status() -> Result<HashMap<String, ServerStatus>, String> {
    info!("Getting MCP server status");

    // TODO: Implement actual status checking
    // For now, return empty status
    Ok(HashMap::new())
}

/// Exports MCP server configuration from .claude.json
#[tauri::command]
pub async fn mcp_export_config() -> Result<String, String> {
    info!("Exporting MCP server configuration from .claude.json");

    // Get the .claude.json path from home directory
    let home_dir = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;

    let claude_config_path = home_dir.join(".claude.json");

    if !claude_config_path.exists() {
        return Err("未找到 .claude.json 配置文件".to_string());
    }

    // Read the .claude.json file
    let config_content = fs::read_to_string(&claude_config_path)
        .map_err(|e| format!("读取 .claude.json 文件失败: {}", e))?;

    // Parse as JSON
    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("解析 .claude.json 文件失败: {}", e))?;

    // Extract mcpServers section
    let mcp_servers = config
        .get("mcpServers")
        .ok_or_else(|| "在 .claude.json 中未找到 mcpServers 配置".to_string())?;

    // Create export format matching Claude Desktop format
    let export_data = serde_json::json!({
        "mcpServers": mcp_servers
    });

    // Convert to pretty JSON string
    let export_json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("序列化导出数据失败: {}", e))?;

    info!("Successfully exported MCP configuration");
    Ok(export_json)
}

/// Reads .mcp.json from the current project
#[tauri::command]
pub async fn mcp_read_project_config(project_path: String) -> Result<MCPProjectConfig, String> {
    info!("Reading .mcp.json from project: {}", project_path);

    let mcp_json_path = PathBuf::from(&project_path).join(".mcp.json");

    if !mcp_json_path.exists() {
        return Ok(MCPProjectConfig {
            mcp_servers: HashMap::new(),
        });
    }

    match fs::read_to_string(&mcp_json_path) {
        Ok(content) => match serde_json::from_str::<MCPProjectConfig>(&content) {
            Ok(config) => Ok(config),
            Err(e) => {
                error!("Failed to parse .mcp.json: {}", e);
                Err(format!("Failed to parse .mcp.json: {}", e))
            }
        },
        Err(e) => {
            error!("Failed to read .mcp.json: {}", e);
            Err(format!("Failed to read .mcp.json: {}", e))
        }
    }
}

/// Saves .mcp.json to the current project
#[tauri::command]
pub async fn mcp_save_project_config(
    project_path: String,
    config: MCPProjectConfig,
) -> Result<String, String> {
    info!("Saving .mcp.json to project: {}", project_path);

    let mcp_json_path = PathBuf::from(&project_path).join(".mcp.json");

    let json_content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&mcp_json_path, json_content)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))?;

    Ok("Project MCP configuration saved".to_string())
}

// ============================================================================
// 多应用 MCP 支持命令（新增）
// ============================================================================

use crate::mcp::{AppType, McpApps, McpServer};

/// 获取 Claude MCP 配置状态
#[tauri::command]
pub async fn mcp_get_claude_status() -> Result<crate::claude_mcp::McpStatus, String> {
    crate::claude_mcp::get_mcp_status()
}

/// 添加或更新 MCP 服务器（支持多应用）
#[tauri::command]
pub async fn mcp_upsert_server(
    id: String,
    name: String,
    server_spec: serde_json::Value,
    apps: McpApps,
) -> Result<String, String> {
    info!("Upserting MCP server: {} for apps: {:?}", id, apps);

    // 验证服务器规范
    crate::mcp::validate_server_spec(&server_spec)?;

    // 创建服务器结构
    let server = McpServer {
        id: id.clone(),
        name,
        server: server_spec,
        apps,
        description: None,
        homepage: None,
        docs: None,
        tags: Vec::new(),
    };

    // 同步到所有启用的应用
    crate::mcp::sync_server_to_apps(&server)?;

    Ok(format!("MCP 服务器 '{}' 已成功配置", id))
}

/// 删除 MCP 服务器（从所有应用）
#[tauri::command]
pub async fn mcp_delete_server(id: String, apps: McpApps) -> Result<String, String> {
    info!("Deleting MCP server: {} from apps: {:?}", id, apps);

    // 创建服务器结构用于删除
    let server = McpServer {
        id: id.clone(),
        name: id.clone(),
        server: serde_json::json!({}),
        apps,
        description: None,
        homepage: None,
        docs: None,
        tags: Vec::new(),
    };

    // 从所有启用的应用中移除
    crate::mcp::remove_server_from_all_apps(&server)?;

    Ok(format!("MCP 服务器 '{}' 已成功删除", id))
}

/// 切换 MCP 服务器在指定应用的启用状态
#[tauri::command]
pub async fn mcp_toggle_app(
    id: String,
    server_spec: serde_json::Value,
    app: String,
    enabled: bool,
) -> Result<String, String> {
    info!(
        "Toggling MCP server '{}' for app '{}': {}",
        id, app, enabled
    );

    let app_type = AppType::from_str(&app)?;

    if enabled {
        // 启用：同步到应用
        crate::mcp::sync_server_to_app(&id, &server_spec, &app_type)?;
    } else {
        // 禁用：从应用移除
        crate::mcp::remove_server_from_app(&id, &app_type)?;
    }

    Ok(format!(
        "MCP 服务器 '{}' 在 {} 中已{}",
        id,
        app,
        if enabled { "启用" } else { "禁用" }
    ))
}

/// 从指定应用导入 MCP 服务器
#[tauri::command]
pub async fn mcp_import_from_app(app: String) -> Result<Vec<String>, String> {
    info!("Importing MCP servers from app: {}", app);

    let app_type = AppType::from_str(&app)?;
    let servers = crate::mcp::import_from_app(&app_type)?;

    let server_ids: Vec<String> = servers.keys().cloned().collect();
    Ok(server_ids)
}

/// 验证命令是否在 PATH 中可用
#[tauri::command]
pub async fn mcp_validate_command(cmd: String) -> Result<bool, String> {
    crate::claude_mcp::validate_command_in_path(&cmd)
}

/// 读取 Claude MCP 配置文本内容
#[tauri::command]
pub async fn mcp_read_claude_config() -> Result<Option<String>, String> {
    crate::claude_mcp::read_mcp_json()
}

/// 获取所有 MCP 服务器（从 Claude 配置）
/// @deprecated 使用 mcp_get_unified_servers 获取真实的多应用状态
#[tauri::command]
pub async fn mcp_get_all_servers() -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    crate::claude_mcp::read_mcp_servers_map()
}

/// 获取所有应用的 MCP 服务器统一视图
///
/// 返回合并后的服务器列表，每个服务器的 apps 字段标记了它在哪些应用中真正启用
/// @deprecated 使用分引擎的API代替（mcp_get_engine_servers）
#[tauri::command]
pub async fn mcp_get_unified_servers() -> Result<std::collections::HashMap<String, McpServer>, String> {
    info!("Getting unified MCP servers from all apps");
    crate::mcp::get_unified_servers()
}

// ============================================================================
// 多引擎独立隔离控制 API（新设计）
// ============================================================================

/// 获取指定引擎的 MCP 服务器列表
///
/// # 参数
/// - `engine`: 引擎名称（"claude" | "codex" | "gemini"）
///
/// # 返回
/// - Ok(HashMap<String, Value>): 该引擎的 MCP 服务器映射
#[tauri::command]
pub async fn mcp_get_engine_servers(
    engine: String,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    info!("获取 {} 引擎的 MCP 服务器列表", engine);

    let app_type = crate::mcp::AppType::from_str(&engine)?;
    crate::mcp::import_from_app(&app_type)
}

/// 在指定引擎中添加或更新 MCP 服务器
///
/// # 参数
/// - `engine`: 引擎名称（"claude" | "codex" | "gemini"）
/// - `id`: 服务器 ID
/// - `server_spec`: 服务器规范（JSON）
#[tauri::command]
pub async fn mcp_upsert_engine_server(
    engine: String,
    id: String,
    server_spec: serde_json::Value,
) -> Result<String, String> {
    info!("在 {} 引擎中添加/更新 MCP 服务器: {}", engine, id);

    // 验证服务器规范
    crate::mcp::validate_server_spec(&server_spec)?;

    // 保存到注册表（启用状态）
    crate::mcp::registry::upsert_server(&id, &id, &server_spec, true)?;

    // 同步到引擎配置文件
    let app_type = crate::mcp::AppType::from_str(&engine)?;
    crate::mcp::sync_server_to_app(&id, &server_spec, &app_type)?;

    Ok(format!("成功在 {} 引擎中配置 MCP 服务器 '{}'", engine, id))
}

/// 从指定引擎中删除 MCP 服务器（永久删除，同时从注册表中移除）
///
/// # 参数
/// - `engine`: 引擎名称（"claude" | "codex" | "gemini"）
/// - `id`: 服务器 ID
#[tauri::command]
pub async fn mcp_delete_engine_server(engine: String, id: String) -> Result<String, String> {
    info!("从 {} 引擎中删除 MCP 服务器: {}", engine, id);

    // 从引擎配置文件中删除
    let app_type = crate::mcp::AppType::from_str(&engine)?;
    crate::mcp::remove_server_from_app(&id, &app_type)?;

    // 从注册表中删除（永久删除）
    crate::mcp::registry::remove_server(&id)?;

    Ok(format!(
        "成功从 {} 引擎中删除 MCP 服务器 '{}'",
        engine, id
    ))
}

/// 切换指定引擎中 MCP 服务器的启用状态
///
/// # 参数
/// - `engine`: 引擎名称（"claude" | "codex" | "gemini"）
/// - `id`: 服务器 ID
/// - `server_spec`: 服务器规范（JSON）
/// - `enabled`: 启用状态
///
/// # 说明
/// - 当 enabled=true 时，将服务器添加到引擎配置文件
/// - 当 enabled=false 时，从引擎配置文件中移除服务器（但保留在注册表中）
#[tauri::command]
pub async fn mcp_toggle_engine_server(
    engine: String,
    id: String,
    server_spec: serde_json::Value,
    enabled: bool,
) -> Result<String, String> {
    info!(
        "切换 {} 引擎中 MCP 服务器 '{}' 的状态: {}",
        engine, id, enabled
    );

    let app_type = crate::mcp::AppType::from_str(&engine)?;

    // 始终将服务器保存到注册表（确保禁用后不会丢失）
    crate::mcp::registry::upsert_server(&id, &id, &server_spec, enabled)?;

    if enabled {
        // 启用：添加到配置文件
        crate::mcp::validate_server_spec(&server_spec)?;
        crate::mcp::sync_server_to_app(&id, &server_spec, &app_type)?;
        Ok(format!(
            "已在 {} 引擎中启用 MCP 服务器 '{}'",
            engine, id
        ))
    } else {
        // 禁用：从配置文件中移除（但保留在注册表中）
        crate::mcp::remove_server_from_app(&id, &app_type)?;
        Ok(format!(
            "已在 {} 引擎中禁用 MCP 服务器 '{}'",
            engine, id
        ))
    }
}

/// 带启用状态的 MCP 服务器条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerWithStatus {
    /// 服务器 ID
    pub id: String,
    /// 服务器配置
    pub spec: serde_json::Value,
    /// 是否启用
    pub enabled: bool,
}

/// 获取指定引擎的 MCP 服务器列表（包含禁用的服务器）
///
/// # 参数
/// - `engine`: 引擎名称（"claude" | "codex" | "gemini"）
///
/// # 返回
/// - Ok(Vec<McpServerWithStatus>): 该引擎的 MCP 服务器列表（包含启用状态）
#[tauri::command]
pub async fn mcp_get_engine_servers_with_status(
    engine: String,
) -> Result<Vec<McpServerWithStatus>, String> {
    info!("获取 {} 引擎的 MCP 服务器列表（含状态）", engine);

    let servers = crate::mcp::registry::get_engine_servers_with_status(&engine)?;

    Ok(servers
        .into_iter()
        .map(|(id, spec, enabled)| McpServerWithStatus { id, spec, enabled })
        .collect())
}
