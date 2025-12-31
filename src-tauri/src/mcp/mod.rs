//! MCP (Model Context Protocol) 服务器管理模块
//!
//! 本模块负责 MCP 服务器配置的验证、同步和导入导出。
//!
//! ## 模块结构
//!
//! - `validation` - 服务器配置验证
//! - `claude` - Claude MCP 同步和导入
//! - `codex` - Codex MCP 同步和导入
//! - `gemini` - Gemini MCP 同步和导入
//!
//! ## 应用类型
//!
//! 支持三种应用类型：
//! - Claude: ~/.claude.json
//! - Codex: ~/.codex/settings.toml
//! - Gemini: ~/.gemini/settings.json

mod claude;
mod codex;
mod gemini;
pub mod registry;
mod validation;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

// 重新导出公共 API
pub use claude::{
    import_from_claude, remove_server_from_claude, sync_servers_to_claude,
    sync_single_server_to_claude,
};
pub use codex::{
    import_from_codex, remove_server_from_codex, sync_servers_to_codex,
    sync_single_server_to_codex,
};
pub use gemini::{
    import_from_gemini, remove_server_from_gemini, sync_servers_to_gemini,
    sync_single_server_to_gemini,
};
pub use validation::{extract_server_spec, validate_server_spec};

/// 应用类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppType {
    Claude,
    Codex,
    Gemini,
}

impl AppType {
    pub fn as_str(&self) -> &str {
        match self {
            AppType::Claude => "claude",
            AppType::Codex => "codex",
            AppType::Gemini => "gemini",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "claude" => Ok(AppType::Claude),
            "codex" => Ok(AppType::Codex),
            "gemini" => Ok(AppType::Gemini),
            other => Err(format!("不支持的应用类型: '{}'", other)),
        }
    }
}

/// MCP 应用启用状态
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct McpApps {
    #[serde(default)]
    pub claude: bool,
    #[serde(default)]
    pub codex: bool,
    #[serde(default)]
    pub gemini: bool,
}

impl McpApps {
    /// 检查指定应用是否启用
    pub fn is_enabled_for(&self, app: &AppType) -> bool {
        match app {
            AppType::Claude => self.claude,
            AppType::Codex => self.codex,
            AppType::Gemini => self.gemini,
        }
    }

    /// 设置指定应用的启用状态
    pub fn set_enabled_for(&mut self, app: &AppType, enabled: bool) {
        match app {
            AppType::Claude => self.claude = enabled,
            AppType::Codex => self.codex = enabled,
            AppType::Gemini => self.gemini = enabled,
        }
    }

    /// 获取所有启用的应用列表
    pub fn enabled_apps(&self) -> Vec<AppType> {
        let mut apps = Vec::new();
        if self.claude {
            apps.push(AppType::Claude);
        }
        if self.codex {
            apps.push(AppType::Codex);
        }
        if self.gemini {
            apps.push(AppType::Gemini);
        }
        apps
    }

    /// 检查是否所有应用都未启用
    pub fn is_empty(&self) -> bool {
        !self.claude && !self.codex && !self.gemini
    }
}

/// MCP 服务器定义（统一结构）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub server: Value,
    pub apps: McpApps,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docs: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

/// 将单个 MCP 服务器同步到指定应用
pub fn sync_server_to_app(
    id: &str,
    server_spec: &Value,
    app: &AppType,
) -> Result<(), String> {
    match app {
        AppType::Claude => sync_single_server_to_claude(id, server_spec),
        AppType::Codex => sync_single_server_to_codex(id, server_spec),
        AppType::Gemini => sync_single_server_to_gemini(id, server_spec),
    }
}

/// 从指定应用移除 MCP 服务器
pub fn remove_server_from_app(id: &str, app: &AppType) -> Result<(), String> {
    match app {
        AppType::Claude => remove_server_from_claude(id),
        AppType::Codex => remove_server_from_codex(id),
        AppType::Gemini => remove_server_from_gemini(id),
    }
}

/// 将 MCP 服务器同步到所有启用的应用
pub fn sync_server_to_apps(server: &McpServer) -> Result<(), String> {
    for app in server.apps.enabled_apps() {
        sync_server_to_app(&server.id, &server.server, &app)?;
    }
    Ok(())
}

/// 从所有应用移除 MCP 服务器
pub fn remove_server_from_all_apps(server: &McpServer) -> Result<(), String> {
    for app in server.apps.enabled_apps() {
        remove_server_from_app(&server.id, &app)?;
    }
    Ok(())
}

/// 从指定应用导入 MCP 服务器
pub fn import_from_app(app: &AppType) -> Result<HashMap<String, Value>, String> {
    match app {
        AppType::Claude => import_from_claude(),
        AppType::Codex => import_from_codex(),
        AppType::Gemini => import_from_gemini(),
    }
}

/// 将多个服务器同步到指定应用
pub fn sync_servers_to_app(
    servers: &HashMap<String, Value>,
    app: &AppType,
) -> Result<(), String> {
    match app {
        AppType::Claude => sync_servers_to_claude(servers),
        AppType::Codex => sync_servers_to_codex(servers),
        AppType::Gemini => sync_servers_to_gemini(servers),
    }
}

/// 获取所有应用的 MCP 服务器统一视图（合并所有应用配置）
///
/// 返回格式：Record<serverId, McpServer>
/// 其中 McpServer.apps 字段标记了该服务器在哪些应用中启用
pub fn get_unified_servers() -> Result<HashMap<String, McpServer>, String> {
    log::info!("开始获取统一的 MCP 服务器视图");

    // 读取三个应用的配置
    let claude_servers = import_from_claude().unwrap_or_else(|e| {
        log::warn!("读取 Claude MCP 配置失败: {}", e);
        HashMap::new()
    });
    let codex_servers = import_from_codex().unwrap_or_else(|e| {
        log::warn!("读取 Codex MCP 配置失败: {}", e);
        HashMap::new()
    });
    let gemini_servers = import_from_gemini().unwrap_or_else(|e| {
        log::warn!("读取 Gemini MCP 配置失败: {}", e);
        HashMap::new()
    });

    log::info!(
        "配置读取完成 - Claude: {} 个, Codex: {} 个, Gemini: {} 个",
        claude_servers.len(),
        codex_servers.len(),
        gemini_servers.len()
    );

    // 合并所有服务器
    let mut unified: HashMap<String, McpServer> = HashMap::new();

    // 收集所有唯一的服务器 ID
    let mut all_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_ids.extend(claude_servers.keys().cloned());
    all_ids.extend(codex_servers.keys().cloned());
    all_ids.extend(gemini_servers.keys().cloned());

    // 为每个 ID 创建统一的服务器结构
    for id in all_ids {
        let claude_spec = claude_servers.get(&id);
        let codex_spec = codex_servers.get(&id);
        let gemini_spec = gemini_servers.get(&id);

        // 优先使用 Claude 的配置，其次 Codex，最后 Gemini
        let server_spec = claude_spec
            .or(codex_spec)
            .or(gemini_spec)
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new()));

        // 创建统一服务器
        unified.insert(
            id.clone(),
            McpServer {
                id: id.clone(),
                name: id.clone(),
                server: server_spec,
                apps: McpApps {
                    claude: claude_spec.is_some(),
                    codex: codex_spec.is_some(),
                    gemini: gemini_spec.is_some(),
                },
                description: None,
                homepage: None,
                docs: None,
                tags: Vec::new(),
            },
        );
    }

    Ok(unified)
}
