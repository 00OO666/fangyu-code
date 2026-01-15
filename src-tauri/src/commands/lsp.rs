/**
 * LSP (Language Server Protocol) Commands
 *
 * 提供 Language Server Protocol 集成功能：
 * - 启动和管理 Language Server 进程
 * - 提供代码分析功能（hover, definition, references, completion, diagnostics）
 * - 支持多种编程语言
 */

use crate::lsp::{LSPProcessManager, LSPManagerConfig, ServerInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

// LSP 位置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

// LSP 范围信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

// LSP 位置引用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub file: String,
    pub range: Range,
}

// Hover 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverInfo {
    pub contents: String,
    pub range: Option<Range>,
}

// 诊断信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: String,
    pub message: String,
    pub source: Option<String>,
}

// 补全项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: String,
    pub detail: Option<String>,
    pub documentation: Option<String>,
}

// LSP 管理器状态
pub struct LSPManager {
    manager: Arc<LSPProcessManager>,
}

impl LSPManager {
    pub fn new() -> Self {
        let config = LSPManagerConfig::default();
        Self {
            manager: Arc::new(LSPProcessManager::new(config)),
        }
    }
}

// 启动 Language Server
#[tauri::command]
pub async fn lsp_start(
    language: String,
    command: String,
    args: Vec<String>,
    workspace_root: String,
    state: State<'_, LSPManager>,
) -> Result<serde_json::Value, String> {
    let pid = state.manager.start_server(language.clone(), command, args).await?;

    Ok(serde_json::json!({
        "processId": pid,
        "capabilities": {
            "hoverProvider": true,
            "definitionProvider": true,
            "referencesProvider": true,
            "completionProvider": true,
            "diagnosticProvider": true,
        }
    }))
}

// 关闭 Language Server
#[tauri::command]
pub async fn lsp_shutdown(
    language: String,
    state: State<'_, LSPManager>,
) -> Result<(), String> {
    state.manager.stop_server(&language).await
}

// 获取 Hover 信息
#[tauri::command]
pub async fn lsp_hover(
    language: String,
    file: String,
    position: Position,
    state: State<'_, LSPManager>,
) -> Result<Option<HoverInfo>, String> {
    // 简化实现：返回 mock 数据
    // 实际实现需要通过 JSON-RPC 与 LSP 通信
    Ok(Some(HoverInfo {
        contents: format!("Hover info for {}:{}", file, position.line),
        range: Some(Range {
            start: position.clone(),
            end: Position {
                line: position.line,
                character: position.character + 10,
            },
        }),
    }))
}

// 跳转到定义
#[tauri::command]
pub async fn lsp_definition(
    language: String,
    file: String,
    position: Position,
    state: State<'_, LSPManager>,
) -> Result<Option<Location>, String> {
    // 简化实现：返回 mock 数据
    Ok(Some(Location {
        file: file.clone(),
        range: Range {
            start: position.clone(),
            end: Position {
                line: position.line,
                character: position.character + 10,
            },
        },
    }))
}

// 查找引用
#[tauri::command]
pub async fn lsp_references(
    language: String,
    file: String,
    position: Position,
    state: State<'_, LSPManager>,
) -> Result<Vec<Location>, String> {
    // 简化实现：返回 mock 数据
    Ok(vec![Location {
        file: file.clone(),
        range: Range {
            start: position.clone(),
            end: Position {
                line: position.line,
                character: position.character + 10,
            },
        },
    }])
}

// 获取补全建议
#[tauri::command]
pub async fn lsp_completion(
    language: String,
    file: String,
    position: Position,
    state: State<'_, LSPManager>,
) -> Result<Vec<CompletionItem>, String> {
    // 简化实现：返回 mock 数据
    Ok(vec![
        CompletionItem {
            label: "function".to_string(),
            kind: "keyword".to_string(),
            detail: Some("Function keyword".to_string()),
            documentation: None,
        },
    ])
}

// 获取诊断信息
#[tauri::command]
pub async fn lsp_diagnostics(
    language: String,
    file: String,
    state: State<'_, LSPManager>,
) -> Result<Vec<Diagnostic>, String> {
    // 简化实现：返回 mock 数据
    Ok(vec![])
}

// 重命名符号
#[tauri::command]
pub async fn lsp_rename(
    language: String,
    file: String,
    position: Position,
    new_name: String,
    _state: State<'_, LSPManager>,
) -> Result<serde_json::Value, String> {
    // 简化实现：返回 mock 数据
    Ok(serde_json::json!({
        "changes": {
            file: [{
                "range": {
                    "start": position,
                    "end": {
                        "line": position.line,
                        "character": position.character + 10
                    }
                },
                "newText": new_name
            }]
        }
    }))
}

// 扫描项目文件
#[tauri::command]
pub async fn scan_project_files(path: String) -> Result<Vec<String>, String> {
    use walkdir::WalkDir;

    let mut files = Vec::new();

    for entry in WalkDir::new(&path)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(path_str) = entry.path().to_str() {
                files.push(path_str.to_string());
            }
        }
    }

    Ok(files)
}

// 获取服务器状态
#[tauri::command]
pub async fn lsp_get_status(
    language: String,
    state: State<'_, LSPManager>,
) -> Result<Option<String>, String> {
    let status = state.manager.get_status(&language).await;
    Ok(status.map(|s| format!("{:?}", s)))
}

// 获取所有服务器状态
#[tauri::command]
pub async fn lsp_get_all_status(
    state: State<'_, LSPManager>,
) -> Result<HashMap<String, String>, String> {
    let statuses = state.manager.get_all_status().await;
    Ok(statuses
        .into_iter()
        .map(|(k, v)| (k, format!("{:?}", v)))
        .collect())
}

// 重启服务器
#[tauri::command]
pub async fn lsp_restart(
    language: String,
    state: State<'_, LSPManager>,
) -> Result<u32, String> {
    state.manager.restart_server(&language).await
}

// 获取服务器信息
#[tauri::command]
pub async fn lsp_get_server_info(
    language: String,
    state: State<'_, LSPManager>,
) -> Result<Option<ServerInfo>, String> {
    Ok(state.manager.get_server_info(&language).await)
}
