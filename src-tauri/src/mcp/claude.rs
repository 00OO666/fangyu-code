//! Claude MCP 同步和导入模块

use serde_json::Value;
use std::collections::HashMap;


/// 将单个 MCP 服务器同步到 Claude live 配置
pub fn sync_single_server_to_claude(id: &str, server_spec: &Value) -> Result<(), String> {
    crate::claude_mcp::upsert_mcp_server(id, server_spec.clone()).map(|_| ())
}

/// 从 Claude 配置中移除单个 MCP 服务器
/// 🔧 FIX: 修复配置不一致问题 - 直接从 ~/.claude.json 的 mcpServers 中移除
/// 之前的实现错误地操作 settings.json，导致 UI 显示禁用但实际仍在运行
pub fn remove_server_from_claude(id: &str) -> Result<(), String> {
    log::info!("🔧 FIX: 从 ~/.claude.json 移除 MCP 服务器: {}", id);

    if crate::claude_mcp::delete_mcp_server(id)? {
        log::info!("✅ 成功从配置中移除 MCP '{}'", id);
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
#[allow(dead_code)]
pub fn sync_servers_to_claude(servers: &HashMap<String, Value>) -> Result<(), String> {
    crate::claude_mcp::set_mcp_servers_map(servers)
}
