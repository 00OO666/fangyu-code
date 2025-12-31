//! MCP 服务器注册表模块
//!
//! 提供独立的主配置存储，用于持久化所有 MCP 服务器的元数据（包括禁用状态）。
//! 这解决了禁用工具后刷新页面导致工具消失的问题。
//!
//! ## 存储位置
//! - Windows: %USERPROFILE%\.claude-workbench\mcp-registry.json
//! - macOS/Linux: ~/.claude-workbench/mcp-registry.json
//!
//! ## 数据结构
//! ```json
//! {
//!   "servers": {
//!     "server-id": {
//!       "id": "server-id",
//!       "name": "Server Name",
//!       "server": { ... },  // 服务器配置
//!       "enabled": true     // 启用状态
//!     }
//!   }
//! }
//! ```

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// 注册表中的服务器条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryEntry {
    /// 服务器 ID
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 服务器配置（完整的 spec）
    pub server: Value,
    /// 是否启用
    pub enabled: bool,
}

/// MCP 服务器注册表
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpRegistry {
    /// 服务器映射：id -> RegistryEntry
    #[serde(default)]
    pub servers: HashMap<String, RegistryEntry>,
}

/// 获取注册表文件路径
fn registry_path() -> PathBuf {
    let home_dir = dirs::home_dir().expect("Failed to get home directory");
    home_dir.join(".claude-workbench").join("mcp-registry.json")
}

/// 确保注册表目录存在
fn ensure_registry_dir() -> Result<(), String> {
    let path = registry_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建注册表目录失败: {}", e))?;
    }
    Ok(())
}

/// 读取注册表
pub fn read_registry() -> Result<McpRegistry, String> {
    let path = registry_path();

    if !path.exists() {
        return Ok(McpRegistry::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取注册表失败: {}", e))?;

    if content.trim().is_empty() {
        return Ok(McpRegistry::default());
    }

    serde_json::from_str(&content)
        .map_err(|e| format!("解析注册表失败: {}", e))
}

/// 写入注册表
pub fn write_registry(registry: &McpRegistry) -> Result<(), String> {
    ensure_registry_dir()?;

    let path = registry_path();
    let content = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("序列化注册表失败: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("写入注册表失败: {}", e))?;

    log::info!("注册表已保存到: {}", path.display());
    Ok(())
}

/// 获取指定引擎的所有服务器（包括禁用的）
///
/// 返回格式：Vec<(id, spec, enabled)>
///
/// **自动同步机制**：如果发现引擎配置中有新 MCP 不在注册表中，自动添加到注册表
pub fn get_engine_servers_with_status(engine: &str) -> Result<Vec<(String, Value, bool)>, String> {
    let mut registry = read_registry()?;

    // 从引擎配置文件读取当前启用的服务器
    let app_type = super::AppType::from_str(engine)?;
    let enabled_servers = super::import_from_app(&app_type).unwrap_or_default();

    let mut result: Vec<(String, Value, bool)> = Vec::new();
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut registry_updated = false;

    // 首先添加注册表中的所有服务器
    for (id, entry) in registry.servers.iter() {
        // 检查是否在引擎配置中启用
        let is_enabled = enabled_servers.contains_key(id);

        // 使用引擎配置中的 spec（如果存在），否则使用注册表中的
        let spec = enabled_servers.get(id).cloned().unwrap_or_else(|| entry.server.clone());

        result.push((id.clone(), spec, is_enabled));
        seen_ids.insert(id.clone());
    }

    // 添加引擎配置中存在但注册表中不存在的服务器
    // 🆕 并自动同步到注册表（一劳永逸解决手动添加 MCP 后不显示的问题）
    for (id, spec) in enabled_servers.iter() {
        if !seen_ids.contains(id) {
            // 推断服务器名称（优先使用 spec 中的 name 字段，否则使用 id）
            let name = spec.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(id)
                .to_string();

            // 自动添加到注册表
            registry.servers.insert(id.clone(), RegistryEntry {
                id: id.clone(),
                name: name.clone(),
                server: spec.clone(),
                enabled: true, // 引擎配置中存在即为启用
            });
            registry_updated = true;

            log::info!("🔄 自动同步: 将新 MCP '{}' 添加到注册表 (引擎: {})", id, engine);

            result.push((id.clone(), spec.clone(), true));
        }
    }

    // 如果注册表有更新，保存到磁盘
    if registry_updated {
        write_registry(&registry)?;
        log::info!("✅ 注册表已自动更新并保存");
    }

    Ok(result)
}

/// 添加或更新服务器到注册表
pub fn upsert_server(id: &str, name: &str, server: &Value, enabled: bool) -> Result<(), String> {
    let mut registry = read_registry()?;

    registry.servers.insert(id.to_string(), RegistryEntry {
        id: id.to_string(),
        name: name.to_string(),
        server: server.clone(),
        enabled,
    });

    write_registry(&registry)?;
    log::info!("服务器 '{}' 已添加到注册表", id);
    Ok(())
}

/// 从注册表中删除服务器
pub fn remove_server(id: &str) -> Result<(), String> {
    let mut registry = read_registry()?;

    if registry.servers.remove(id).is_some() {
        write_registry(&registry)?;
        log::info!("服务器 '{}' 已从注册表中删除", id);
    }

    Ok(())
}

/// 更新服务器的启用状态
pub fn set_server_enabled(id: &str, enabled: bool) -> Result<(), String> {
    let mut registry = read_registry()?;

    if let Some(entry) = registry.servers.get_mut(id) {
        entry.enabled = enabled;
        write_registry(&registry)?;
        log::info!("服务器 '{}' 启用状态已更新为: {}", id, enabled);
    }

    Ok(())
}

/// 获取服务器的注册表条目
pub fn get_server(id: &str) -> Result<Option<RegistryEntry>, String> {
    let registry = read_registry()?;
    Ok(registry.servers.get(id).cloned())
}

/// 同步注册表与引擎配置
///
/// 将注册表中启用的服务器同步到引擎配置文件
pub fn sync_registry_to_engine(engine: &str) -> Result<(), String> {
    let registry = read_registry()?;
    let app_type = super::AppType::from_str(engine)?;

    // 收集所有启用的服务器
    let enabled_servers: HashMap<String, Value> = registry.servers
        .iter()
        .filter(|(_, entry)| entry.enabled)
        .map(|(id, entry)| (id.clone(), entry.server.clone()))
        .collect();

    // 同步到引擎配置
    super::sync_servers_to_app(&enabled_servers, &app_type)?;

    log::info!("已将 {} 个启用的服务器同步到 {} 引擎", enabled_servers.len(), engine);
    Ok(())
}
