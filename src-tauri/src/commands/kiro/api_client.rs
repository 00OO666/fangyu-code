//! Kiro API 客户端
//! 
//! 直接调用 Amazon Q Developer API（CodeWhisperer）
//! 基于逆向工程研究实现

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;
use reqwest::Client;
use regex::Regex;

/// Kiro Token 结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiroToken {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    pub region: String,
    #[serde(rename = "profileArn")]
    pub profile_arn: Option<String>,
}

/// Token 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiroTokenStatus {
    pub valid: bool,
    pub expires_in: i64,
    pub region: String,
    pub account_type: String,
    pub masked_token: String,
}

/// API 请求结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiroApiResponse {
    pub success: bool,
    pub content: String,
    pub conversation_id: String,
    pub error: Option<String>,
}

/// 展开 ~ 为用户目录
fn expand_home_dir(path: &str) -> PathBuf {
    if path.starts_with("~") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// 遮蔽 Token（安全显示）
fn mask_token(token: &str) -> String {
    if token.len() <= 10 {
        return "***".to_string();
    }
    format!("{}...[MASKED]", &token[..10])
}

/// 读取 Kiro Token 文件
#[command]
pub async fn read_kiro_token(path: String) -> Result<String, String> {
    let expanded_path = expand_home_dir(&path);
    
    if !expanded_path.exists() {
        return Err(format!("Token 文件不存在: {}", expanded_path.display()));
    }
    
    fs::read_to_string(&expanded_path)
        .map_err(|e| format!("无法读取 Token 文件 {}: {}", expanded_path.display(), e))
}

/// 获取 Token 状态
#[command]
pub async fn get_kiro_token_status(path: String) -> Result<KiroTokenStatus, String> {
    let content = read_kiro_token(path).await?;
    let token: KiroToken = serde_json::from_str(&content)
        .map_err(|e| format!("Token 格式无效: {}", e))?;
    
    // 解析过期时间
    let expires_at = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map_err(|e| format!("无法解析过期时间: {}", e))?;
    
    let now = chrono::Utc::now();
    let expires_in = (expires_at.timestamp() - now.timestamp()).max(0);
    let valid = expires_in > 0;
    
    let account_type = if token.profile_arn.is_some() {
        "iam-identity-center"
    } else {
        "builders-id"
    };
    
    Ok(KiroTokenStatus {
        valid,
        expires_in,
        region: token.region,
        account_type: account_type.to_string(),
        masked_token: mask_token(&token.access_token),
    })
}

/// 发送 Kiro API 请求
#[command]
pub async fn send_kiro_request(
    endpoint: String,
    access_token: String,
    body: String,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    
    log::info!("[Kiro API] 发送请求到: {}", endpoint);
    log::debug!("[Kiro API] Token: {}", mask_token(&access_token));
    
    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "KiroIDE 0.7.5")
        .header("Accept", "application/json")
        .header("x-amzn-kiro-agent-mode", "vibe")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    let text = response.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    if !status.is_success() {
        log::error!("[Kiro API] HTTP {}: {}", status.as_u16(), &text[..500.min(text.len())]);
        return Err(format!("HTTP {}: {}", status.as_u16(), &text[..500.min(text.len())]));
    }
    
    log::info!("[Kiro API] 请求成功，响应长度: {} bytes", text.len());
    Ok(text)
}

/// 解析 SSE 响应，提取内容
#[command]
pub fn parse_kiro_sse_response(response: String) -> Result<String, String> {
    let re = Regex::new(r#""content"\s*:\s*"([^"]*)""#)
        .map_err(|e| format!("正则表达式错误: {}", e))?;
    
    let mut contents: Vec<String> = Vec::new();
    
    for cap in re.captures_iter(&response) {
        if let Some(content) = cap.get(1) {
            let mut decoded = content.as_str().to_string();
            // 解码转义字符
            decoded = decoded.replace("\\n", "\n");
            decoded = decoded.replace("\\t", "\t");
            decoded = decoded.replace("\\\"", "\"");
            decoded = decoded.replace("\\\\", "\\");
            
            if !decoded.is_empty() {
                contents.push(decoded);
            }
        }
    }
    
    if contents.is_empty() {
        log::warn!("[Kiro API] SSE 响应中未找到内容");
        return Ok(String::new());
    }
    
    Ok(contents.join(""))
}

/// 完整的 Kiro 聊天请求（组合 Token 读取、请求发送、响应解析）
#[command]
pub async fn kiro_chat(
    token_path: String,
    message: String,
    model_id: Option<String>,
    conversation_id: Option<String>,
) -> Result<KiroApiResponse, String> {
    // 1. 读取 Token
    let token_content = read_kiro_token(token_path).await?;
    let token: KiroToken = serde_json::from_str(&token_content)
        .map_err(|e| format!("Token 格式无效: {}", e))?;
    
    // 2. 检查 Token 是否过期
    let expires_at = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map_err(|e| format!("无法解析过期时间: {}", e))?;
    
    if expires_at < chrono::Utc::now() {
        return Err("Token 已过期，请重新登录 Kiro IDE".to_string());
    }
    
    // 3. 构建端点
    let endpoint = format!(
        "https://q.{}.amazonaws.com/generateAssistantResponse",
        token.region
    );
    
    // 4. 生成会话 ID
    let conv_id = conversation_id.unwrap_or_else(|| {
        format!("conv-{}-{}", 
            chrono::Utc::now().timestamp_millis(),
            uuid::Uuid::new_v4().to_string()[..9].to_string()
        )
    });
    
    // 5. 构建请求体
    let mut user_input = serde_json::json!({
        "content": message,
        "origin": "AI_EDITOR"
    });
    
    if let Some(ref mid) = model_id {
        if !mid.is_empty() {
            user_input["modelId"] = serde_json::json!(mid);
        }
    }
    
    let mut body = serde_json::json!({
        "conversationState": {
            "chatTriggerType": "MANUAL",
            "conversationId": conv_id,
            "currentMessage": {
                "userInputMessage": user_input
            }
        }
    });
    
    if let Some(ref profile_arn) = token.profile_arn {
        body["profileArn"] = serde_json::json!(profile_arn);
    }
    
    let body_str = serde_json::to_string(&body)
        .map_err(|e| format!("序列化请求体失败: {}", e))?;
    
    // 6. 发送请求
    let response = send_kiro_request(endpoint, token.access_token, body_str).await?;
    
    // 7. 解析响应
    let content = parse_kiro_sse_response(response)?;
    
    Ok(KiroApiResponse {
        success: true,
        content,
        conversation_id: conv_id,
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mask_token() {
        assert_eq!(mask_token("short"), "***");
        assert_eq!(mask_token("1234567890abcdef"), "1234567890...[MASKED]");
    }
    
    #[test]
    fn test_expand_home_dir() {
        let path = "~/.aws/sso/cache/kiro-auth-token.json";
        let expanded = expand_home_dir(path);
        assert!(!expanded.to_string_lossy().starts_with("~"));
    }
    
    #[test]
    fn test_parse_sse_response() {
        let response = r#"
            :event-type {"headers":{":event-type":{"type":"string","value":"assistantResponseEvent"}}}
            {"content":"Hello"}
            :event-type {"headers":{":event-type":{"type":"string","value":"assistantResponseEvent"}}}
            {"content":" World"}
        "#;
        
        let result = parse_kiro_sse_response(response.to_string()).unwrap();
        assert_eq!(result, "Hello World");
    }
}
