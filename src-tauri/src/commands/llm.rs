/**
 * LLM 文本生成命令
 * 用于生成会话摘要、翻译等功能
 */

use serde_json::json;

#[tauri::command]
pub async fn generate_text_with_llm(
    prompt: String,
    model: String,
) -> Result<String, String> {
    // 获取 API 配置
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .or_else(|_| std::env::var("CLAUDE_API_KEY"))
        .map_err(|_| "API key not configured. Please set ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable.".to_string())?;

    let api_base = std::env::var("ANTHROPIC_BASE_URL")
        .or_else(|_| std::env::var("CLAUDE_BASE_URL"))
        .unwrap_or_else(|_| "https://api.anthropic.com".to_string());

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
    let url = format!("{}/v1/messages", api_base.trim_end_matches('/'));

    let request_body = json!({
        "model": model_name,
        "max_tokens": 4096,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    });

    // 发送请求
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要 API key 才能运行
    async fn test_generate_text() {
        let prompt = "Say hello in 5 words or less.".to_string();
        let model = "haiku".to_string();

        let result = generate_text_with_llm(prompt, model).await;
        assert!(result.is_ok());

        let text = result.unwrap();
        assert!(!text.is_empty());
        println!("Generated text: {}", text);
    }
}
