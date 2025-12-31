//! Gemini MCP 配置文件操作模块
//!
//! 负责读写 ~/.gemini/settings.json 中的 mcpServers 配置
//!
//! 特别注意：Gemini 使用特殊的配置格式：
//! - HTTP 类型使用 "httpUrl" 字段而不是 "url"
//! - 不使用 "type" 字段

use serde_json::{Map, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// 获取 Gemini 配置文件路径
fn user_config_path() -> PathBuf {
    let home_dir = dirs::home_dir().expect("Failed to get home directory");
    home_dir.join(".gemini").join("settings.json")
}

/// 读取 JSON 文件
fn read_json_value(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;

    let value: Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    Ok(value)
}

/// 原子写入 JSON 文件
fn write_json_value(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化 JSON 失败: {}", e))?;

    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, json.as_bytes())
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    fs::rename(&tmp_path, path)
        .map_err(|e| format!("重命名文件失败: {}", e))?;

    Ok(())
}

/// 读取 Gemini settings.json 中的 mcpServers 映射
///
/// 执行反向格式转换以保持与统一 MCP 结构的兼容性：
/// - httpUrl → url + type: "http"
/// - 仅有 url 字段 → 保持不变（SSE 类型）
/// - 仅有 command 字段 → 保持不变（stdio 类型）
pub fn read_mcp_servers_map() -> Result<HashMap<String, Value>, String> {
    let path = user_config_path();
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let root = read_json_value(&path)?;
    let mut servers: HashMap<String, Value> = root
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    // 反向格式转换：Gemini 特有格式 → 统一 MCP 格式
    for (_, spec) in servers.iter_mut() {
        if let Some(obj) = spec.as_object_mut() {
            // httpUrl → url + type: "http"
            if let Some(http_url) = obj.remove("httpUrl") {
                obj.insert("url".to_string(), http_url);
                obj.insert("type".to_string(), Value::String("http".to_string()));
            }
        }
    }

    Ok(servers)
}

/// 将给定的启用 MCP 服务器映射写入到 Gemini settings.json 的 mcpServers 字段
/// 仅覆盖 mcpServers，其他字段保持不变
pub fn set_mcp_servers_map(servers: &HashMap<String, Value>) -> Result<(), String> {
    let path = user_config_path();
    let mut root = read_json_value(&path)?;

    // 构建 mcpServers 对象
    let mut out: Map<String, Value> = Map::new();
    for (id, spec) in servers.iter() {
        let mut obj = if let Some(map) = spec.as_object() {
            map.clone()
        } else {
            return Err(format!("MCP 服务器 '{}' 不是对象", id));
        };

        // 提取 server 字段（如果存在）
        if let Some(server_val) = obj.remove("server") {
            let server_obj = server_val.as_object().cloned().ok_or_else(|| {
                format!("MCP 服务器 '{}' server 字段不是对象", id)
            })?;
            obj = server_obj;
        }

        // Gemini 格式转换：
        // - HTTP 使用 "httpUrl" 字段，SSE 使用 "url" 字段
        let transport_type = obj.get("type").and_then(|v| v.as_str());
        if transport_type == Some("http") {
            // HTTP streaming: 将 "url" 重命名为 "httpUrl"
            if let Some(url_value) = obj.remove("url") {
                obj.insert("httpUrl".to_string(), url_value);
            }
        }

        // 移除 UI 辅助字段和 type 字段（Gemini 不需要）
        obj.remove("type");
        obj.remove("enabled");
        obj.remove("source");
        obj.remove("id");
        obj.remove("name");
        obj.remove("description");
        obj.remove("tags");
        obj.remove("homepage");
        obj.remove("docs");
        obj.remove("disabled");  // 启用的服务器移除 disabled 字段

        out.insert(id.clone(), Value::Object(obj));
    }

    {
        let obj = root
            .as_object_mut()
            .ok_or_else(|| "配置文件根必须是对象".to_string())?;
        obj.insert("mcpServers".into(), Value::Object(out));
    }

    write_json_value(&path, &root)?;
    Ok(())
}
