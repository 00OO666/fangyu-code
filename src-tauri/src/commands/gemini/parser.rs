//! Gemini CLI JSONL Event Parser
//!
//! Parses stream-json output from Gemini CLI and converts events
//! to the unified ClaudeStreamMessage format for frontend rendering.

use serde_json::{json, Value};

use super::types::{GeminiStats, GeminiStreamEvent, TokenUsage};

// ============================================================================
// Event Parsing
// ============================================================================

/// Parse a single line of JSONL output from Gemini CLI
pub fn parse_gemini_line(line: &str) -> Result<GeminiStreamEvent, String> {
    // Skip empty lines
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Err("Empty line".to_string());
    }

    // First parse as raw JSON
    let value: Value = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse JSON: {} - line: {}", e, trimmed))?;

    // Then convert to GeminiStreamEvent using our custom parser
    GeminiStreamEvent::from_json(&value)
        .ok_or_else(|| format!("Unknown event type in line: {}", trimmed))
}

/// Try to parse a line, returning the raw JSON if structured parsing fails
pub fn parse_gemini_line_flexible(line: &str) -> Result<Value, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Err("Empty line".to_string());
    }

    serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse JSON: {} - line: {}", e, trimmed))
}

// ============================================================================
// Event Conversion to Unified Format
// ============================================================================

/// Convert a Gemini stream event to the unified ClaudeStreamMessage format
/// This allows the frontend to render Gemini output using existing components
pub fn convert_to_unified_message(event: &GeminiStreamEvent) -> Value {
    match event {
        GeminiStreamEvent::Init {
            session_id,
            model,
            timestamp,
        } => {
            json!({
                "type": "system",
                "subtype": "init",
                "session_id": session_id,
                "model": model,
                "timestamp": timestamp,
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "init"
                }
            })
        }

        GeminiStreamEvent::Message {
            role,
            content,
            delta,
            timestamp,
        } => {
            let msg_type = if role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            json!({
                "type": msg_type,
                "message": {
                    "content": [{
                        "type": "text",
                        "text": content
                    }],
                    "role": role
                },
                "timestamp": timestamp,
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "message",
                    "delta": delta
                }
            })
        }

        GeminiStreamEvent::ToolUse {
            tool_name,
            tool_id,
            parameters,
            timestamp,
        } => {
            json!({
                "type": "assistant",
                "message": {
                    "content": [{
                        "type": "tool_use",
                        "id": tool_id,
                        "name": tool_name,
                        "input": parameters
                    }],
                    "role": "assistant"
                },
                "timestamp": timestamp,
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "tool_use",
                    "toolName": tool_name,
                    "toolId": tool_id
                }
            })
        }

        GeminiStreamEvent::ToolResult {
            tool_id,
            status,
            output,
            timestamp,
        } => {
            let output_value = if output.is_null() {
                Value::Null
            } else {
                output.clone()
            };

            json!({
                "type": "user",
                "message": {
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": output_value,
                        "is_error": status != "success"
                    }],
                    "role": "user"
                },
                "timestamp": timestamp,
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "tool_result",
                    "toolId": tool_id,
                    "status": status
                }
            })
        }

        GeminiStreamEvent::Error {
            error_type,
            message,
            code,
        } => {
            json!({
                "type": "system",
                "subtype": "error",
                "error": {
                    "type": error_type,
                    "message": message,
                    "code": code
                },
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "error"
                }
            })
        }

        GeminiStreamEvent::Result {
            status,
            stats,
            usage_metadata,
            timestamp,
        } => {
            let usage = build_unified_usage(stats.as_ref(), usage_metadata.as_ref());

            json!({
                "type": "result",
                "subtype": "success",
                "status": status,
                "timestamp": timestamp,
                "usage": usage,
                "geminiMetadata": {
                    "provider": "gemini",
                    "eventType": "result",
                    "stats": stats,
                    "usageMetadata": usage_metadata,
                    "durationMs": stats.as_ref().and_then(|s| s.duration_ms),
                    "toolCalls": stats.as_ref().and_then(|s| s.tool_calls)
                }
            })
        }
    }
}

/// Convert raw JSON (when structured parsing fails) to a generic message
pub fn convert_raw_to_unified_message(raw: &Value) -> Value {
    // Check if it has a "type" field we recognize
    if let Some(event_type) = raw.get("type").and_then(|t| t.as_str()) {
        match event_type {
            "init" => {
                return json!({
                    "type": "system",
                    "subtype": "init",
                    "session_id": raw.get("session_id"),
                    "model": raw.get("model"),
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "init",
                        "raw": raw
                    }
                });
            }
            "message" => {
                let role = raw
                    .get("role")
                    .and_then(|r| r.as_str())
                    .unwrap_or("assistant");
                let content = raw.get("content").and_then(|c| c.as_str()).unwrap_or("");
                return json!({
                    "type": if role == "assistant" { "assistant" } else { "user" },
                    "message": {
                        "content": [{
                            "type": "text",
                            "text": content
                        }],
                        "role": role
                    },
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "message",
                        "raw": raw
                    }
                });
            }
            "tool_use" => {
                let tool_name = raw.get("tool_name").and_then(|t| t.as_str()).unwrap_or("");
                let tool_id = raw.get("tool_id").and_then(|t| t.as_str()).unwrap_or("");
                let parameters = raw.get("parameters").cloned().unwrap_or(json!({}));
                return json!({
                    "type": "assistant",
                    "message": {
                        "content": [{
                            "type": "tool_use",
                            "id": tool_id,
                            "name": tool_name,
                            "input": parameters
                        }],
                        "role": "assistant"
                    },
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "tool_use",
                        "toolName": tool_name,
                        "toolId": tool_id,
                        "raw": raw
                    }
                });
            }
            "tool_result" => {
                let tool_id = raw.get("tool_id").and_then(|t| t.as_str()).unwrap_or("");
                let status = raw
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown");
                // output 保留原始结构，兼容 functionResponse 等复杂结果
                let output = raw
                    .get("output")
                    .cloned()
                    .or_else(|| raw.get("response").cloned())
                    .unwrap_or(Value::Null);
                return json!({
                    "type": "user",
                    "message": {
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": output,
                            "is_error": status != "success"
                        }],
                        "role": "user"
                    },
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "tool_result",
                        "toolId": tool_id,
                        "status": status,
                        "raw": raw
                    }
                });
            }
            "result" => {
                let stats = raw
                    .get("stats")
                    .and_then(|v| serde_json::from_value::<GeminiStats>(v.clone()).ok());

                let usage_metadata = raw
                    .get("usageMetadata")
                    .or_else(|| raw.get("usage_metadata"))
                    .or_else(|| raw.get("usage"))
                    .or_else(|| raw.get("tokens"))
                    .and_then(|v| serde_json::from_value::<TokenUsage>(v.clone()).ok());

                let usage = build_unified_usage(stats.as_ref(), usage_metadata.as_ref());

                return json!({
                    "type": "result",
                    "subtype": "success",
                    "status": raw.get("status"),
                    "timestamp": raw.get("timestamp"),
                    "usage": usage,
                    "geminiMetadata": {
                        "provider": "gemini",
                        "eventType": "result",
                        "stats": stats,
                        "usageMetadata": usage_metadata,
                        "raw": raw
                    }
                });
            }
            _ => {}
        }
    }

    // Fallback: detect function calling structures even without standard type field
    if let Some(func_call) = raw.get("functionCall").or_else(|| raw.get("function_call")) {
        let tool_name = func_call.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let tool_id = func_call
            .get("id")
            .or_else(|| raw.get("callId"))
            .or_else(|| raw.get("call_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let args = func_call
            .get("args")
            .or_else(|| func_call.get("arguments"))
            .or_else(|| func_call.get("parameters"))
            .cloned()
            .unwrap_or(json!({}));

        return json!({
            "type": "assistant",
            "message": {
                "content": [{
                    "type": "tool_use",
                    "id": tool_id,
                    "name": tool_name,
                    "input": args
                }],
                "role": "assistant"
            },
            "geminiMetadata": {
                "provider": "gemini",
                "eventType": "tool_use",
                "toolName": tool_name,
                "toolId": tool_id,
                "raw": raw
            }
        });
    }

    if let Some(func_resp) = raw
        .get("functionResponse")
        .or_else(|| raw.get("function_response"))
    {
        let tool_id = func_resp
            .get("id")
            .or_else(|| raw.get("callId"))
            .or_else(|| raw.get("call_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let tool_name = func_resp.get("name").and_then(|n| n.as_str()).unwrap_or("");

        // 保留完整 functionResponse 结构，前端解析 output 后再渲染
        let wrapped_content = Value::Array(vec![json!({ "functionResponse": func_resp })]);

        return json!({
            "type": "user",
            "message": {
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": wrapped_content,
                    "is_error": false
                }],
                "role": "user"
            },
            "geminiMetadata": {
                "provider": "gemini",
                "eventType": "tool_result",
                "toolName": tool_name,
                "toolId": tool_id,
                "raw": raw
            }
        });
    }

    // Fallback: wrap as a system message with raw data
    json!({
        "type": "system",
        "subtype": "raw",
        "geminiMetadata": {
            "provider": "gemini",
            "eventType": "unknown",
            "raw": raw
        }
    })
}

// ============================================================================
// Usage Extraction
// ============================================================================

/// Extract usage information from a Gemini result event
pub fn extract_usage(event: &GeminiStreamEvent) -> Option<(u64, u64)> {
    if let GeminiStreamEvent::Result {
        stats: Some(stats),
        usage_metadata,
        ..
    } = event
    {
        if let Some(usage) = build_unified_usage(Some(stats), usage_metadata.as_ref()) {
            let input = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            Some((input, output))
        } else {
            let input = stats.input_tokens.unwrap_or(0);
            let output = stats.output_tokens.unwrap_or(0);
            Some((input, output))
        }
    } else {
        None
    }
}

fn build_unified_usage(stats: Option<&GeminiStats>, usage_metadata: Option<&TokenUsage>) -> Option<Value> {
    // Prefer usageMetadata when present: it can contain cached/thoughts/tool token breakdowns.
    if let Some(meta) = usage_metadata {
        let prompt = meta.prompt_token_count.unwrap_or(0);
        let candidates = meta.candidates_token_count.unwrap_or(0);
        let thoughts = meta.thoughts_token_count.unwrap_or(0);
        let tool = meta.tool_use_prompt_token_count.unwrap_or(0);
        let cached = meta.cached_content_token_count.unwrap_or(0);

        let input_tokens = prompt.saturating_add(tool);
        let output_tokens = candidates.saturating_add(thoughts);

        if input_tokens > 0 || output_tokens > 0 || cached > 0 {
            let mut obj = serde_json::Map::new();
            obj.insert("input_tokens".to_string(), json!(input_tokens));
            obj.insert("output_tokens".to_string(), json!(output_tokens));
            if cached > 0 {
                // Use the Codex-compatible name so frontend can reuse normalization logic:
                // normalizeRawUsage() will treat cached_input_tokens as a subset of input_tokens.
                obj.insert("cached_input_tokens".to_string(), json!(cached));
            }
            return Some(Value::Object(obj));
        }
    }

    stats.map(|s| {
        json!({
            "input_tokens": s.input_tokens.unwrap_or(0),
            "output_tokens": s.output_tokens.unwrap_or(0)
        })
    })
}

/// Extract session ID from an init event
pub fn extract_session_id(event: &GeminiStreamEvent) -> Option<String> {
    if let GeminiStreamEvent::Init {
        session_id: Some(id),
        ..
    } = event
    {
        Some(id.clone())
    } else {
        None
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_init_event() {
        let line = r#"{"type":"init","timestamp":"2025-01-01T00:00:00.000Z","session_id":"abc123","model":"gemini-2.5-pro"}"#;
        let event = parse_gemini_line(line).unwrap();

        if let GeminiStreamEvent::Init {
            session_id, model, ..
        } = event
        {
            assert_eq!(session_id, Some("abc123".to_string()));
            assert_eq!(model, Some("gemini-2.5-pro".to_string()));
        } else {
            panic!("Expected Init event");
        }
    }

    #[test]
    fn test_parse_message_event() {
        let line = r#"{"type":"message","role":"assistant","content":"Hello!","delta":true,"timestamp":"2025-01-01T00:00:01.000Z"}"#;
        let event = parse_gemini_line(line).unwrap();

        if let GeminiStreamEvent::Message {
            role,
            content,
            delta,
            ..
        } = event
        {
            assert_eq!(role, "assistant");
            assert_eq!(content, "Hello!");
            assert!(delta);
        } else {
            panic!("Expected Message event");
        }
    }

    #[test]
    fn test_convert_to_unified() {
        let event = GeminiStreamEvent::Message {
            role: "assistant".to_string(),
            content: "Test message".to_string(),
            delta: false,
            timestamp: None,
        };

        let unified = convert_to_unified_message(&event);
        assert_eq!(unified["type"], "assistant");
        assert_eq!(unified["geminiMetadata"]["provider"], "gemini");
    }
}
