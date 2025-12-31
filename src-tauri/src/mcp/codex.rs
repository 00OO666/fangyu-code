//! Codex MCP 同步和导入模块

use serde_json::Value;
use std::collections::HashMap;

/// 将单个 MCP 服务器同步到 Codex 配置
pub fn sync_single_server_to_codex(id: &str, server_spec: &Value) -> Result<(), String> {
    let current = crate::codex_mcp::read_mcp_servers_map()?;
    let mut updated = current;
    updated.insert(id.to_string(), server_spec.clone());
    crate::codex_mcp::set_mcp_servers_map(&updated)
}

/// 从 Codex 配置中移除单个 MCP 服务器
pub fn remove_server_from_codex(id: &str) -> Result<(), String> {
    let mut current = crate::codex_mcp::read_mcp_servers_map()?;
    current.remove(id);
    crate::codex_mcp::set_mcp_servers_map(&current)
}

/// 从 Codex 导入 MCP 服务器
pub fn import_from_codex() -> Result<HashMap<String, Value>, String> {
    crate::codex_mcp::read_mcp_servers_map()
}

/// 将多个服务器同步到 Codex
pub fn sync_servers_to_codex(servers: &HashMap<String, Value>) -> Result<(), String> {
    crate::codex_mcp::set_mcp_servers_map(servers)
}
