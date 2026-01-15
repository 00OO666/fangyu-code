/**
 * LLM 文本生成命令
 * 用于生成会话摘要、翻译等功能
 */

use serde_json::json;

#[tauri::command]
pub async fn generate_text_with_llm(
    prompt: String,
    model: String,
    api_key: Option<String>,
    api_base: Option<String>,
) -> Result<String, String> {
    // 获取 API 配置（优先使用传入的参数，其次环境变量，最后从 settings.json 读取）
    log::info!("[LLM] Received api_key param: {:?}", api_key.as_ref().map(|k| format!("{}...", &k[..8.min(k.len())])));
    log::info!("[LLM] Received api_base param: {:?}", api_base);
    
    let api_key = api_key
        .filter(|k| !k.is_empty())
        .or_else(|| {
            let key = std::env::var("ANTHROPIC_API_KEY").ok();
            log::info!("[LLM] From env ANTHROPIC_API_KEY: {:?}", key.as_ref().map(|k| format!("{}...", &k[..8.min(k.len())])));
            key
        })
        .or_else(|| {
            let key = std::env::var("CLAUDE_API_KEY").ok();
            log::info!("[LLM] From env CLAUDE_API_KEY: {:?}", key.as_ref().map(|k| format!("{}...", &k[..8.min(k.len())])));
            key
        })
        .or_else(|| {
            let key = read_api_key_from_settings();
            log::info!("[LLM] From settings.json: {:?}", key.as_ref().map(|k| format!("{}...", &k[..8.min(k.len())])));
            key
        })
        .ok_or_else(|| "API key not configured. Please configure Claude API Key in settings.".to_string())?;

    let api_base = api_base
        .filter(|b| !b.is_empty())
        .or_else(|| {
            let base = std::env::var("ANTHROPIC_BASE_URL").ok();
            log::info!("[LLM] From env ANTHROPIC_BASE_URL: {:?}", base);
            base
        })
        .or_else(|| {
            let base = std::env::var("CLAUDE_BASE_URL").ok();
            log::info!("[LLM] From env CLAUDE_BASE_URL: {:?}", base);
            base
        })
        .or_else(|| {
            let base = read_api_base_from_settings();
            log::info!("[LLM] From settings.json BASE_URL: {:?}", base);
            base
        })
        .unwrap_or_else(|| "https://api.anthropic.com".to_string());
    
    log::info!("[LLM] Final api_key: {}...", &api_key[..8.min(api_key.len())]);
    log::info!("[LLM] Final api_base: {}", api_base);

    // 映射模型名称
    let model_name = match model.as_str() {
        "haiku" => "claude-3-5-haiku-20241022",
        "sonnet" => "claude-3-5-sonnet-20241022",
        "opus" => "claude-opus-4-20250514",
        _ => model.as_str(),
    };

    log::info!("Generating text with model: {}", model_name);

    // 构建请求
    let client = reqwest::Client::new();
    
    // 规范化 URL：确保格式为 baseURL/v1/messages
    let mut api_base = api_base.trim_end_matches('/').to_string();
    if !api_base.ends_with("/v1") {
        api_base = format!("{}/v1", api_base);
    }
    let url = format!("{}/messages", api_base);
    
    log::info!("API endpoint: {}", url);

    let request_body = json!({
        "model": model_name,
        "max_tokens": 4096,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    });

    // 发送请求 - 使用 x-api-key header（与主聊天一致）
    let response = client
        .post(&url)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send API request: {}", e))?;

    // 检查响应状态
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API request failed with status {}: {}", status, error_text));
    }

    // 解析响应
    let response_data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // 提取文本内容
    let text = response_data["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("No text content in API response")?
        .to_string();

    log::info!("Generated text length: {} characters", text.len());

    Ok(text)
}

/// 从 ~/.claude/settings.json 读取 API Key
fn read_api_key_from_settings() -> Option<String> {
    let home = dirs::home_dir()?;
    let settings_path = home.join(".claude").join("settings.json");
    
    if !settings_path.exists() {
        return None;
    }
    
    let content = std::fs::read_to_string(&settings_path).ok()?;
    let settings: serde_json::Value = serde_json::from_str(&content).ok()?;
    
    // 尝试从 env.ANTHROPIC_API_KEY 读取
    settings.get("env")
        .and_then(|env| env.get("ANTHROPIC_API_KEY"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 从 ~/.claude/settings.json 读取 API Base URL
fn read_api_base_from_settings() -> Option<String> {
    let home = dirs::home_dir()?;
    let settings_path = home.join(".claude").join("settings.json");
    
    if !settings_path.exists() {
        return None;
    }
    
    let content = std::fs::read_to_string(&settings_path).ok()?;
    let settings: serde_json::Value = serde_json::from_str(&content).ok()?;
    
    // 尝试从 env.ANTHROPIC_BASE_URL 读取
    settings.get("env")
        .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要 API key 才能运行
    async fn test_generate_text() {
        let prompt = "Say hello in 5 words or less.".to_string();
        let model = "haiku".to_string();

        let result = generate_text_with_llm(prompt, model, None, None).await;
        assert!(result.is_ok());

        let text = result.unwrap();
        assert!(!text.is_empty());
        println!("Generated text: {}", text);
    }
}
