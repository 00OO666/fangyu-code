//! Codex MCP 配置文件操作模块
//!
//! 负责读写 Codex 的 MCP 配置（~/.codex/config.toml，TOML 格式）
//!
//! 配置格式：
//! ```toml
//! [mcp_servers.server-name]
//! type = "stdio"
//! command = "node"
//! args = ["server.js"]
//! [mcp_servers.server-name.env]
//! KEY = "value"
//! ```

use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// 获取 Codex 配置文件路径
fn user_config_path() -> PathBuf {
    let home_dir = dirs::home_dir().expect("Failed to get home directory");
    home_dir.join(".codex").join("config.toml")
}

/// 读取 Codex MCP 服务器配置（从 TOML 转换为 JSON）
///
/// 支持两种格式（容错）：
/// - [mcp_servers.*] （正确格式）
/// - [mcp.servers.*] （旧格式）
pub fn read_mcp_servers_map() -> Result<HashMap<String, Value>, String> {
    let path = user_config_path();

    log::info!("尝试读取 Codex 配置文件: {}", path.display());

    if !path.exists() {
        log::info!("Codex 配置文件不存在: {}", path.display());
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取 Codex 配置文件失败: {}", e))?;

    if content.trim().is_empty() {
        log::info!("Codex 配置文件为空");
        return Ok(HashMap::new());
    }

    let root: toml::Table = toml::from_str(&content)
        .map_err(|e| format!("解析 Codex config.toml 失败: {}", e))?;

    let mut result = HashMap::new();

    // 处理 [mcp_servers] 表（正确格式）
    if let Some(mcp_servers) = root.get("mcp_servers").and_then(|v| v.as_table()) {
        for (id, entry_val) in mcp_servers.iter() {
            if let Some(server) = toml_server_to_json(id, entry_val) {
                result.insert(id.clone(), server);
            }
        }
    }

    // 处理 [mcp.servers] 表（旧格式，容错）
    if let Some(mcp_val) = root.get("mcp") {
        if let Some(mcp_tbl) = mcp_val.as_table() {
            if let Some(servers_tbl) = mcp_tbl.get("servers").and_then(|v| v.as_table()) {
                for (id, entry_val) in servers_tbl.iter() {
                    if !result.contains_key(id) {
                        // 只添加不重复的
                        if let Some(server) = toml_server_to_json(id, entry_val) {
                            result.insert(id.clone(), server);
                        }
                    }
                }
            }
        }
    }

    log::info!("从 Codex 配置读取到 {} 个服务器", result.len());
    Ok(result)
}

/// 将 TOML 服务器条目转换为 JSON
fn toml_server_to_json(id: &str, entry_val: &toml::Value) -> Option<Value> {
    let entry_tbl = entry_val.as_table()?;

    let typ = entry_tbl
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio");

    let mut spec = serde_json::Map::new();
    spec.insert("type".into(), json!(typ));

    match typ {
        "stdio" => {
            // command
            if let Some(cmd) = entry_tbl.get("command").and_then(|v| v.as_str()) {
                spec.insert("command".into(), json!(cmd));
            }
            // args
            if let Some(args) = entry_tbl.get("args").and_then(|v| v.as_array()) {
                let arr: Vec<_> = args
                    .iter()
                    .filter_map(|x| x.as_str())
                    .map(|s| json!(s))
                    .collect();
                if !arr.is_empty() {
                    spec.insert("args".into(), Value::Array(arr));
                }
            }
            // env
            if let Some(env_tbl) = entry_tbl.get("env").and_then(|v| v.as_table()) {
                let mut env_json = serde_json::Map::new();
                for (k, v) in env_tbl.iter() {
                    if let Some(sv) = v.as_str() {
                        env_json.insert(k.clone(), json!(sv));
                    }
                }
                if !env_json.is_empty() {
                    spec.insert("env".into(), Value::Object(env_json));
                }
            }
            // cwd
            if let Some(cwd) = entry_tbl.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.trim().is_empty() {
                    spec.insert("cwd".into(), json!(cwd));
                }
            }
        }
        "http" | "sse" => {
            // url
            if let Some(url) = entry_tbl.get("url").and_then(|v| v.as_str()) {
                spec.insert("url".into(), json!(url));
            }
            // headers
            let headers_tbl = entry_tbl
                .get("http_headers")
                .and_then(|v| v.as_table())
                .or_else(|| entry_tbl.get("headers").and_then(|v| v.as_table()));

            if let Some(headers_tbl) = headers_tbl {
                let mut headers_json = serde_json::Map::new();
                for (k, v) in headers_tbl.iter() {
                    if let Some(sv) = v.as_str() {
                        headers_json.insert(k.clone(), json!(sv));
                    }
                }
                if !headers_json.is_empty() {
                    spec.insert("headers".into(), Value::Object(headers_json));
                }
            }
        }
        _ => {
            log::warn!("跳过未知类型 '{}' 的 Codex MCP 项 '{}'", typ, id);
            return None;
        }
    }

    Some(Value::Object(spec))
}

/// 写入 Codex MCP 服务器配置（从 JSON 转换为 TOML）
pub fn set_mcp_servers_map(servers: &HashMap<String, Value>) -> Result<(), String> {
    use toml_edit::{DocumentMut, Item, Table};

    let path = user_config_path();

    log::info!("写入 Codex 配置文件: {}", path.display());

    // 读取现有配置（保留其他字段）
    let mut doc = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取 Codex 配置失败: {}", e))?;
        content
            .parse::<DocumentMut>()
            .map_err(|e| format!("解析 Codex config.toml 失败: {}", e))?
    } else {
        DocumentMut::new()
    };

    // 清理可能存在的错误格式 [mcp.servers]
    if let Some(mcp_item) = doc.get_mut("mcp") {
        if let Some(tbl) = mcp_item.as_table_like_mut() {
            if tbl.contains_key("servers") {
                log::warn!("检测到错误的 MCP 格式 [mcp.servers]，正在清理");
                tbl.remove("servers");
            }
        }
    }

    // 构建 [mcp_servers] 表
    if servers.is_empty() {
        // 无服务器：移除 mcp_servers 表
        doc.as_table_mut().remove("mcp_servers");
    } else {
        let mut servers_tbl = Table::new();

        for (id, spec) in servers.iter() {
            match json_server_to_toml_table(spec) {
                Ok(table) => {
                    servers_tbl[&id[..]] = Item::Table(table);
                }
                Err(err) => {
                    log::error!("跳过无效的 MCP 服务器 '{}': {}", id, err);
                }
            }
        }

        doc["mcp_servers"] = Item::Table(servers_tbl);
    }

    // 写回文件
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    fs::write(&path, doc.to_string()).map_err(|e| format!("写入 Codex 配置失败: {}", e))?;

    log::info!("Codex 配置写入成功");
    Ok(())
}

/// 将 JSON MCP 服务器规范转换为 TOML Table
fn json_server_to_toml_table(spec: &Value) -> Result<toml_edit::Table, String> {
    use toml_edit::{Array, Item, Table};

    let mut t = Table::new();
    let typ = spec.get("type").and_then(|v| v.as_str()).unwrap_or("stdio");
    t["type"] = toml_edit::value(typ);

    match typ {
        "stdio" => {
            let cmd = spec.get("command").and_then(|v| v.as_str()).unwrap_or("");
            t["command"] = toml_edit::value(cmd);

            if let Some(args) = spec.get("args").and_then(|v| v.as_array()) {
                let mut arr_v = Array::default();
                for a in args.iter().filter_map(|x| x.as_str()) {
                    arr_v.push(a);
                }
                if !arr_v.is_empty() {
                    t["args"] = Item::Value(toml_edit::Value::Array(arr_v));
                }
            }

            if let Some(cwd) = spec.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.trim().is_empty() {
                    t["cwd"] = toml_edit::value(cwd);
                }
            }

            if let Some(env) = spec.get("env").and_then(|v| v.as_object()) {
                let mut env_tbl = Table::new();
                for (k, v) in env.iter() {
                    if let Some(s) = v.as_str() {
                        env_tbl[&k[..]] = toml_edit::value(s);
                    }
                }
                if !env_tbl.is_empty() {
                    t["env"] = Item::Table(env_tbl);
                }
            }
        }
        "http" | "sse" => {
            let url = spec.get("url").and_then(|v| v.as_str()).unwrap_or("");
            t["url"] = toml_edit::value(url);

            if let Some(headers) = spec.get("headers").and_then(|v| v.as_object()) {
                let mut h_tbl = Table::new();
                for (k, v) in headers.iter() {
                    if let Some(s) = v.as_str() {
                        h_tbl[&k[..]] = toml_edit::value(s);
                    }
                }
                if !h_tbl.is_empty() {
                    t["http_headers"] = Item::Table(h_tbl);
                }
            }
        }
        _ => {
            return Err(format!("不支持的服务器类型: {}", typ));
        }
    }

    Ok(t)
}
