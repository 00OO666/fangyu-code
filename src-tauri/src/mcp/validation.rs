//! MCP 服务器配置验证模块

use serde_json::Value;

/// 验证服务器规范
pub fn validate_server_spec(spec: &Value) -> Result<(), String> {
    if !spec.is_object() {
        return Err("MCP 服务器定义必须为 JSON 对象".into());
    }

    let obj = spec.as_object().unwrap();

    // 验证传输类型
    let t_opt = obj.get("type").and_then(|x| x.as_str());
    let is_stdio = t_opt.map(|t| t == "stdio").unwrap_or(true);
    let is_http = t_opt.map(|t| t == "http").unwrap_or(false);
    let is_sse = t_opt.map(|t| t == "sse").unwrap_or(false);

    if !(is_stdio || is_http || is_sse) {
        return Err("传输类型必须是 'stdio'、'http' 或 'sse'".into());
    }

    // stdio 类型必须有 command
    if is_stdio {
        let cmd = obj.get("command").and_then(|x| x.as_str()).unwrap_or("");
        if cmd.is_empty() {
            return Err("stdio 类型的 MCP 服务器缺少 command 字段".into());
        }
    }

    // http/sse 类型必须有 url
    if is_http || is_sse {
        let url = obj.get("url").and_then(|x| x.as_str()).unwrap_or("");
        if url.is_empty() {
            return Err(format!(
                "{} 类型的 MCP 服务器缺少 url 字段",
                if is_http { "http" } else { "sse" }
            ));
        }
    }

    Ok(())
}

/// 提取服务器规范（移除 UI 辅助字段）
pub fn extract_server_spec(entry: &Value) -> Result<Value, String> {
    let mut spec = entry.clone();

    // 如果有 server 字段，提取出来
    if let Some(server_val) = spec.get("server") {
        spec = server_val.clone();
    }

    // 移除 UI 辅助字段
    if let Some(obj) = spec.as_object_mut() {
        obj.remove("enabled");
        obj.remove("source");
        obj.remove("id");
        obj.remove("name");
        obj.remove("description");
        obj.remove("tags");
        obj.remove("homepage");
        obj.remove("docs");
    }

    // 验证提取后的规范
    validate_server_spec(&spec)?;

    Ok(spec)
}
