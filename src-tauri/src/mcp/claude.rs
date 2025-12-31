//! Claude MCP 同步和导入模块

use serde_json::Value;
use std::collections::HashMap;

use super::validation::validate_server_spec;

/// 将单个 MCP 服务器同步到 Claude live 配置
pub fn sync_single_server_to_claude(id: &str, server_spec: &Value) -> Result<(), String> {
    // 读取现有的 MCP 配置
    let current = crate::claude_mcp::read_mcp_servers_map()?;

    // 创建新的 HashMap，包含现有的所有服务器 + 当前要同步的服务器
    let mut updated = current;
    updated.insert(id.to_string(), server_spec.clone());

    // 写回
    crate::claude_mcp::set_mcp_servers_map(&updated)
}

/// 从 Claude 配置中移除单个 MCP 服务器
/// 🔧 FIX: 修复配置不一致问题 - 直接从 ~/.claude.json 的 mcpServers 中移除
/// 之前的实现错误地操作 settings.json，导致 UI 显示禁用但实际仍在运行
pub fn remove_server_from_claude(id: &str) -> Result<(), String> {
    log::info!("🔧 FIX: 从 ~/.claude.json 移除 MCP 服务器: {}", id);

    // 读取当前的 MCP 配置（来自 ~/.claude.json）
    let mut current = crate::claude_mcp::read_mcp_servers_map()?;

    // 从配置中移除指定服务器
    if current.remove(id).is_some() {
        log::info!("✅ 成功从配置中移除 MCP '{}'", id);

        // 写回到 ~/.claude.json
        crate::claude_mcp::set_mcp_servers_map(&current)?;
        log::info!("✅ 已更新 ~/.claude.json，MCP '{}' 已彻底禁用", id);
    } else {
        log::warn!("⚠️  MCP '{}' 不在配置中", id);
    }

    Ok(())
}

/// 从 ~/.claude.json 导入 mcpServers
pub fn import_from_claude() -> Result<HashMap<String, Value>, String> {
    // 直接使用 claude_mcp 模块的读取函数（更可靠）
    let servers = crate::claude_mcp::read_mcp_servers_map()?;

    log::info!("从 Claude 读取到 {} 个 MCP 服务器", servers.len());

    // 不进行严格验证，保持原始数据
    // 验证会在同步时进行
    Ok(servers)
}

/// 将多个服务器同步到 Claude
pub fn sync_servers_to_claude(servers: &HashMap<String, Value>) -> Result<(), String> {
    crate::claude_mcp::set_mcp_servers_map(servers)
}
