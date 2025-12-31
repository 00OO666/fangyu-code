//! 配置文件双向同步模块
//!
//! 解决 ~/.claude/settings.json 和 ~/.claude.json 配置不一致的问题
//!
//! ## 文件职责
//! - `~/.claude.json`: Claude Code CLI 实际读取的配置（mcpServers）
//! - `~/.claude/settings.json`: Fangyu Code UI 管理的配置（包含 UI 状态、hooks 等）
//!
//! ## 同步策略
//! 1. 启动时：从 .claude.json 同步到 settings.json（以实际生效的为准）
//! 2. UI 操作时：同时写入两个文件（保持一致）

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

use super::paths::get_claude_dir;

/// 获取 settings.json 路径
fn get_settings_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    Ok(claude_dir.join("settings.json"))
}

/// 获取 .claude.json 路径（Claude Code 实际配置）
fn get_claude_json_path() -> PathBuf {
    dirs::home_dir()
        .expect("Failed to get home directory")
        .join(".claude.json")
}

/// 读取 JSON 文件
fn read_json(path: &PathBuf) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))
}

/// 写入 JSON 文件
fn write_json(path: &PathBuf, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化 JSON 失败: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("写入文件失败: {}", e))
}

/// 从 .claude.json 同步 MCP 配置到 settings.json
///
/// 用于启动时同步，确保 Fangyu Code UI 显示的状态与实际一致
#[tauri::command]
pub async fn sync_claude_json_to_settings() -> Result<String, String> {
    log::info!("🔄 同步 .claude.json → settings.json");

    let settings_path = get_settings_path()?;
    let claude_json_path = get_claude_json_path();

    // 读取 .claude.json
    let claude_json = read_json(&claude_json_path)?;
    let claude_mcp = claude_json.get("mcpServers")
        .cloned()
        .unwrap_or(json!({}));

    // 读取 settings.json
    let mut settings = read_json(&settings_path)?;

    // 更新 settings.json 的 mcpServers
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("mcpServers".to_string(), claude_mcp.clone());
    }

    // 写入 settings.json
    write_json(&settings_path, &settings)?;

    let server_count = claude_mcp.as_object().map(|m| m.len()).unwrap_or(0);
    log::info!("✅ 同步完成: {} 个 MCP 服务器", server_count);
    Ok(format!("已同步 {} 个 MCP 服务器配置", server_count))
}

/// 从 settings.json 同步 MCP 配置到 .claude.json
///
/// 用于在 Fangyu Code 中修改配置后，同步到 Claude Code 实际使用的配置
#[tauri::command]
pub async fn sync_settings_to_claude_json() -> Result<String, String> {
    log::info!("🔄 同步 settings.json → .claude.json");

    let settings_path = get_settings_path()?;
    let claude_json_path = get_claude_json_path();

    // 读取 settings.json
    let settings = read_json(&settings_path)?;
    let settings_mcp = settings.get("mcpServers")
        .cloned()
        .unwrap_or(json!({}));

    // 读取 .claude.json
    let mut claude_json = read_json(&claude_json_path)?;

    // 更新 .claude.json 的 mcpServers
    if let Some(obj) = claude_json.as_object_mut() {
        obj.insert("mcpServers".to_string(), settings_mcp.clone());
    }

    // 写入 .claude.json
    write_json(&claude_json_path, &claude_json)?;

    let server_count = settings_mcp.as_object().map(|m| m.len()).unwrap_or(0);
    log::info!("✅ 同步完成: {} 个 MCP 服务器", server_count);
    Ok(format!("已同步 {} 个 MCP 服务器配置到 Claude Code", server_count))
}

/// 统一切换 MCP 服务器状态（同时更新两个配置文件）
///
/// # 参数
/// - `server_id`: MCP 服务器 ID
/// - `enabled`: 是否启用
///
/// # 工作流程
/// 1. 读取两个配置文件
/// 2. 如果启用：确保两个文件都有该服务器配置（disabled: false 或移除 disabled）
/// 3. 如果禁用：在两个文件中设置 disabled: true
/// 4. 同时写入两个文件
#[tauri::command]
pub async fn toggle_mcp_server_unified(
    #[allow(non_snake_case)]
    serverId: String,
    enabled: bool,
) -> Result<String, String> {
    let server_id = serverId;
    log::info!("🔄 切换 MCP 服务器: {} → {}", server_id, if enabled { "启用" } else { "禁用" });

    let settings_path = get_settings_path()?;
    let claude_json_path = get_claude_json_path();

    // 读取两个配置文件
    let mut settings = read_json(&settings_path)?;
    let mut claude_json = read_json(&claude_json_path)?;

    // 确保 mcpServers 对象存在
    if settings.get("mcpServers").is_none() {
        if let Some(obj) = settings.as_object_mut() {
            obj.insert("mcpServers".to_string(), json!({}));
        }
    }
    if claude_json.get("mcpServers").is_none() {
        if let Some(obj) = claude_json.as_object_mut() {
            obj.insert("mcpServers".to_string(), json!({}));
        }
    }

    // 获取服务器配置（优先从 claude.json，其次从 settings.json）
    let server_config = claude_json
        .get("mcpServers")
        .and_then(|m| m.get(&server_id))
        .cloned()
        .or_else(|| {
            settings.get("mcpServers")
                .and_then(|m| m.get(&server_id))
                .cloned()
        });

    if server_config.is_none() && enabled {
        return Err(format!("找不到 MCP 服务器配置: {}", server_id));
    }

    // 更新 settings.json
    if let Some(mcp_servers) = settings.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        if enabled {
            // 启用：确保存在配置，移除 disabled 字段
            if let Some(config) = server_config.clone() {
                let mut config_obj = config.as_object().cloned().unwrap_or_default();
                config_obj.remove("disabled");
                mcp_servers.insert(server_id.clone(), Value::Object(config_obj));
            }
        } else {
            // 禁用：设置 disabled: true
            if let Some(config) = mcp_servers.get_mut(&server_id) {
                if let Some(obj) = config.as_object_mut() {
                    obj.insert("disabled".to_string(), json!(true));
                }
            } else if let Some(config) = server_config.clone() {
                let mut config_obj = config.as_object().cloned().unwrap_or_default();
                config_obj.insert("disabled".to_string(), json!(true));
                mcp_servers.insert(server_id.clone(), Value::Object(config_obj));
            }
        }
    }

    // 更新 .claude.json
    if let Some(mcp_servers) = claude_json.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        if enabled {
            // 启用：确保存在配置，移除 disabled 字段
            if let Some(config) = server_config.clone() {
                let mut config_obj = config.as_object().cloned().unwrap_or_default();
                config_obj.remove("disabled");
                mcp_servers.insert(server_id.clone(), Value::Object(config_obj));
            }
        } else {
            // 禁用：设置 disabled: true
            if let Some(config) = mcp_servers.get_mut(&server_id) {
                if let Some(obj) = config.as_object_mut() {
                    obj.insert("disabled".to_string(), json!(true));
                }
            } else if let Some(config) = server_config {
                let mut config_obj = config.as_object().cloned().unwrap_or_default();
                config_obj.insert("disabled".to_string(), json!(true));
                mcp_servers.insert(server_id.clone(), Value::Object(config_obj));
            }
        }
    }

    // 写入两个配置文件
    write_json(&settings_path, &settings)?;
    write_json(&claude_json_path, &claude_json)?;

    let action = if enabled { "已启用" } else { "已禁用" };
    log::info!("✅ MCP 服务器 {} {}", server_id, action);
    Ok(format!("MCP 服务器 '{}' {}", server_id, action))
}

/// 获取 MCP 配置同步状态
///
/// 检查 settings.json 和 .claude.json 的 mcpServers 是否一致
#[tauri::command]
pub async fn get_mcp_sync_status() -> Result<Value, String> {
    let settings_path = get_settings_path()?;
    let claude_json_path = get_claude_json_path();

    let settings = read_json(&settings_path)?;
    let claude_json = read_json(&claude_json_path)?;

    let settings_mcp = settings.get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|m| m.len())
        .unwrap_or(0);

    let claude_mcp = claude_json.get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|m| m.len())
        .unwrap_or(0);

    let is_synced = settings.get("mcpServers") == claude_json.get("mcpServers");

    Ok(json!({
        "settingsPath": settings_path.to_string_lossy(),
        "claudeJsonPath": claude_json_path.to_string_lossy(),
        "settingsMcpCount": settings_mcp,
        "claudeJsonMcpCount": claude_mcp,
        "isSynced": is_synced,
        "recommendation": if !is_synced {
            "建议运行同步命令以保持配置一致"
        } else {
            "配置已同步"
        }
    }))
}

/// 完全同步两个配置文件的 mcpServers
///
/// 策略：合并两个文件的配置，以最新的为准
#[tauri::command]
pub async fn full_sync_mcp_configs() -> Result<String, String> {
    log::info!("🔄 完全同步 MCP 配置...");

    let settings_path = get_settings_path()?;
    let claude_json_path = get_claude_json_path();

    let mut settings = read_json(&settings_path)?;
    let claude_json = read_json(&claude_json_path)?;

    // 合并 mcpServers：以 .claude.json 为主（实际生效的配置）
    let claude_mcp = claude_json.get("mcpServers")
        .cloned()
        .unwrap_or(json!({}));

    // 更新 settings.json
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("mcpServers".to_string(), claude_mcp.clone());
    }

    // 写入 settings.json
    write_json(&settings_path, &settings)?;

    let server_count = claude_mcp.as_object().map(|m| m.len()).unwrap_or(0);
    log::info!("✅ 完全同步完成: {} 个 MCP 服务器", server_count);
    Ok(format!("配置同步完成，共 {} 个 MCP 服务器", server_count))
}
