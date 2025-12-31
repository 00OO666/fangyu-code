//! Fangyu Code 诊断模块
//!
//! 提供全面的配置诊断、Token 消耗分析、一键修复功能

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

/// 诊断问题严重程度
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// 严重错误，必须修复
    Error,
    /// 警告，建议修复
    Warning,
    /// 信息提示
    Info,
}

/// 单个诊断问题
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticIssue {
    /// 问题 ID
    pub id: String,
    /// 问题分类
    pub category: String,
    /// 严重程度
    pub severity: Severity,
    /// 问题标题
    pub title: String,
    /// 问题详情
    pub description: String,
    /// 是否可自动修复
    pub auto_fixable: bool,
    /// 修复建议
    pub fix_suggestion: Option<String>,
}

/// Token 消耗分析项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenCostItem {
    /// 配置项名称
    pub name: String,
    /// 预估消耗 Token 数
    pub tokens: u32,
    /// 状态：enabled, disabled, warning
    pub status: String,
    /// 建议
    pub suggestion: Option<String>,
}

/// 完整诊断报告
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    /// 报告生成时间
    pub generated_at: String,
    /// 诊断版本
    pub version: String,
    /// 总体健康状态: healthy, warning, critical
    pub health_status: String,
    /// 发现的问题列表
    pub issues: Vec<DiagnosticIssue>,
    /// Token 消耗分析
    pub token_analysis: Vec<TokenCostItem>,
    /// 总 Token 消耗预估
    pub total_token_cost: u32,
    /// Claude Code 版本
    pub claude_version: Option<String>,
    /// 配置文件状态
    pub config_status: ConfigStatus,
}

/// 配置文件状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigStatus {
    /// settings.json 是否存在
    pub settings_exists: bool,
    /// .claude.json 是否存在
    pub claude_json_exists: bool,
    /// MCP 配置是否同步
    pub mcp_synced: bool,
    /// Hook 配置是否同步
    pub hooks_synced: bool,
    /// CLAUDE.md 行数
    pub claude_md_lines: u32,
}

/// 修复结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixResult {
    /// 是否成功
    pub success: bool,
    /// 修复的问题数
    pub fixed_count: u32,
    /// 失败的问题数
    pub failed_count: u32,
    /// 详细消息
    pub messages: Vec<String>,
}

/// 获取配置目录路径
fn get_config_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Failed to get home directory")
        .join(".claude")
}

/// 获取 .claude.json 路径
fn get_claude_json_path() -> PathBuf {
    dirs::home_dir()
        .expect("Failed to get home directory")
        .join(".claude.json")
}

/// 读取 JSON 文件
fn read_json_file(path: &PathBuf) -> Option<Value> {
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

/// 运行完整诊断
#[tauri::command]
pub async fn run_diagnostics() -> Result<DiagnosticReport, String> {
    log::info!("🔍 开始运行 Fangyu Code 诊断...");

    let mut issues: Vec<DiagnosticIssue> = Vec::new();
    let mut token_analysis: Vec<TokenCostItem> = Vec::new();
    let mut total_tokens: u32 = 500; // 基础消耗

    let config_dir = get_config_dir();
    let settings_path = config_dir.join("settings.json");
    let claude_json_path = get_claude_json_path();
    let claude_md_path = config_dir.join("CLAUDE.md");

    // 读取配置文件
    let settings = read_json_file(&settings_path);
    let claude_json = read_json_file(&claude_json_path);

    // ========== 1. 配置文件同步检查 ==========
    let settings_mcp = settings
        .as_ref()
        .and_then(|v| v.get("mcpServers"))
        .and_then(|v| v.as_object())
        .map(|m| m.len())
        .unwrap_or(0);

    let claude_json_mcp = claude_json
        .as_ref()
        .and_then(|v| v.get("mcpServers"))
        .and_then(|v| v.as_object())
        .map(|m| m.len())
        .unwrap_or(0);

    let mcp_synced = settings_mcp == claude_json_mcp;

    if !mcp_synced {
        issues.push(DiagnosticIssue {
            id: "mcp_not_synced".to_string(),
            category: "配置同步".to_string(),
            severity: Severity::Error,
            title: "MCP 配置不同步".to_string(),
            description: format!(
                "settings.json 有 {} 个 MCP，.claude.json 有 {} 个 MCP。\n\
                这会导致 Fangyu Code UI 显示的状态与 Claude Code 实际配置不符。\n\
                点击【一键修复】按钮可自动同步配置。",
                settings_mcp, claude_json_mcp
            ),
            auto_fixable: true,
            fix_suggestion: Some("使用一键修复功能同步配置，或重启 Fangyu Code 自动同步".to_string()),
        });
    }

    // ========== 2. MCP Token 消耗检查 ==========
    if claude_json_mcp > 0 {
        // 每个 MCP 约 500-2000 tokens
        let mcp_tokens = claude_json_mcp as u32 * 1000;
        total_tokens += mcp_tokens;

        token_analysis.push(TokenCostItem {
            name: format!("MCP 服务器 ({}个)", claude_json_mcp),
            tokens: mcp_tokens,
            status: if claude_json_mcp > 3 { "warning" } else { "enabled" }.to_string(),
            suggestion: if claude_json_mcp > 3 {
                Some("建议按需启用 MCP，而不是全部开启".to_string())
            } else {
                None
            },
        });

        if claude_json_mcp > 3 {
            issues.push(DiagnosticIssue {
                id: "too_many_mcps".to_string(),
                category: "Token 消耗".to_string(),
                severity: Severity::Warning,
                title: format!("MCP 数量过多 ({}个)", claude_json_mcp),
                description: format!(
                    "当前有 {} 个 MCP 服务器在运行，每个消耗约 1000 tokens。\n\
                    建议禁用不常用的 MCP，需要时用 @mcp-name 按需启用。",
                    claude_json_mcp
                ),
                auto_fixable: false,
                fix_suggestion: Some("在 Fangyu Code 设置中禁用不常用的 MCP".to_string()),
            });
        }
    } else {
        token_analysis.push(TokenCostItem {
            name: "MCP 服务器".to_string(),
            tokens: 0,
            status: "disabled".to_string(),
            suggestion: None,
        });
    }

    // ========== 3. Hook 检查 ==========
    let hooks_dir = config_dir.join("hooks");
    let mut active_prompt_hooks = 0;
    let mut active_command_hooks = 0;

    if hooks_dir.exists() {
        if let Ok(entries) = fs::read_dir(&hooks_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();

                // 跳过禁用的文件
                if file_name.ends_with(".disabled") {
                    continue;
                }

                if file_name.ends_with(".md") {
                    // 检查 Prompt Hook 是否在 frontmatter 中被禁用
                    if let Ok(content) = fs::read_to_string(&path) {
                        if !content.contains("disabled: true") {
                            active_prompt_hooks += 1;
                        }
                    }
                } else if file_name.ends_with(".ps1")
                    || file_name.ends_with(".sh")
                    || file_name.ends_with(".py")
                {
                    active_command_hooks += 1;
                }
            }
        }
    }

    // Prompt Hook 消耗
    if active_prompt_hooks > 0 {
        let hook_tokens = active_prompt_hooks * 650;
        total_tokens += hook_tokens;

        token_analysis.push(TokenCostItem {
            name: format!("Prompt Hook ({}个)", active_prompt_hooks),
            tokens: hook_tokens,
            status: "warning".to_string(),
            suggestion: Some("Prompt Hook 每次对话都会消耗 ~650 tokens".to_string()),
        });

        issues.push(DiagnosticIssue {
            id: "prompt_hooks_active".to_string(),
            category: "Token 消耗".to_string(),
            severity: Severity::Warning,
            title: format!("有 {} 个 Prompt Hook 在运行", active_prompt_hooks),
            description: format!(
                "Prompt Hook 使用 Sonnet 模型评估，每个每次对话消耗约 650 tokens。\n\
                当前每对话额外消耗: {} tokens",
                hook_tokens
            ),
            auto_fixable: true,
            fix_suggestion: Some("在 Hook 文件 frontmatter 中添加 disabled: true".to_string()),
        });
    }

    // Command Hook（不消耗 token，但可能影响性能）
    if active_command_hooks > 0 {
        token_analysis.push(TokenCostItem {
            name: format!("Command Hook ({}个)", active_command_hooks),
            tokens: 0,
            status: "info".to_string(),
            suggestion: Some("Command Hook 不消耗 token，但可能影响性能".to_string()),
        });
    }

    // ========== 4. settings.json 中的 Hook 配置检查 ==========
    let settings_hooks = settings
        .as_ref()
        .and_then(|v| v.get("hooks"))
        .and_then(|v| v.as_object());

    if let Some(hooks) = settings_hooks {
        if !hooks.is_empty() {
            let hook_count: usize = hooks.values().filter_map(|v| v.as_array()).map(|a| a.len()).sum();

            if hook_count > 0 {
                issues.push(DiagnosticIssue {
                    id: "settings_hooks_configured".to_string(),
                    category: "配置".to_string(),
                    severity: Severity::Info,
                    title: format!("settings.json 中配置了 {} 个 Hook", hook_count),
                    description: "这些 Hook 会在对应事件触发时执行脚本".to_string(),
                    auto_fixable: false,
                    fix_suggestion: None,
                });
            }
        }
    }

    // ========== 5. CLAUDE.md 大小检查 ==========
    let claude_md_lines = if claude_md_path.exists() {
        fs::read_to_string(&claude_md_path)
            .map(|content| content.lines().count() as u32)
            .unwrap_or(0)
    } else {
        0
    };

    let claude_md_tokens = (claude_md_lines as f32 * 3.5) as u32; // 约 3.5 tokens/行
    total_tokens += claude_md_tokens;

    token_analysis.push(TokenCostItem {
        name: format!("CLAUDE.md ({} 行)", claude_md_lines),
        tokens: claude_md_tokens,
        status: if claude_md_lines > 200 { "warning" } else { "enabled" }.to_string(),
        suggestion: if claude_md_lines > 200 {
            Some("建议拆分到 memory 文件中按需加载".to_string())
        } else {
            None
        },
    });

    if claude_md_lines > 200 {
        issues.push(DiagnosticIssue {
            id: "claude_md_too_large".to_string(),
            category: "Token 消耗".to_string(),
            severity: Severity::Warning,
            title: format!("CLAUDE.md 过大 ({} 行)", claude_md_lines),
            description: format!(
                "全局 CLAUDE.md 有 {} 行，每次对话消耗约 {} tokens。\n\
                建议将项目特定配置拆分到 ~/.claude/memory/ 目录下按需加载。",
                claude_md_lines, claude_md_tokens
            ),
            auto_fixable: false,
            fix_suggestion: Some("将不常用的配置移到 memory 文件中".to_string()),
        });
    }

    // ========== 6. 默认模型检查 ==========
    let default_model = settings
        .as_ref()
        .and_then(|v| v.get("model"))
        .and_then(|v| v.as_str())
        .unwrap_or("sonnet");

    if default_model == "opus" {
        issues.push(DiagnosticIssue {
            id: "opus_as_default".to_string(),
            category: "成本优化".to_string(),
            severity: Severity::Info,
            title: "默认模型为 Opus".to_string(),
            description: "Opus 是最强大但也最贵的模型（约为 Sonnet 的 5 倍）。\n\
                日常开发任务使用 Sonnet 通常已经足够。".to_string(),
            auto_fixable: false,
            fix_suggestion: Some("可在 Fangyu Code 设置中将默认模型改为 Sonnet".to_string()),
        });
    }

    // ========== 7. Claude Code CLI 检查 ==========
    let claude_version = check_claude_cli_version();

    if claude_version.is_none() {
        issues.push(DiagnosticIssue {
            id: "claude_cli_not_found".to_string(),
            category: "环境".to_string(),
            severity: Severity::Error,
            title: "Claude Code CLI 未找到".to_string(),
            description: "无法执行 claude --version 命令。\n\
                请确保 Claude Code 已正确安装并添加到 PATH。".to_string(),
            auto_fixable: false,
            fix_suggestion: Some("运行 npm install -g @anthropic-ai/claude-code".to_string()),
        });
    }

    // ========== 8. 基础 Token 消耗 ==========
    token_analysis.insert(0, TokenCostItem {
        name: "基础系统消耗".to_string(),
        tokens: 500,
        status: "enabled".to_string(),
        suggestion: None,
    });

    // 生成报告
    let health_status = if issues.iter().any(|i| i.severity == Severity::Error) {
        "critical"
    } else if issues.iter().any(|i| i.severity == Severity::Warning) {
        "warning"
    } else {
        "healthy"
    };

    let report = DiagnosticReport {
        generated_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        version: "1.0.0".to_string(),
        health_status: health_status.to_string(),
        issues,
        token_analysis,
        total_token_cost: total_tokens,
        claude_version,
        config_status: ConfigStatus {
            settings_exists: settings.is_some(),
            claude_json_exists: claude_json.is_some(),
            mcp_synced,
            hooks_synced: true, // TODO: 实现 Hook 同步检查
            claude_md_lines,
        },
    };

    log::info!("✅ 诊断完成，发现 {} 个问题", report.issues.len());
    Ok(report)
}

/// 检查 Claude CLI 版本
fn check_claude_cli_version() -> Option<String> {
    use std::process::Command;

    #[cfg(windows)]
    let output = Command::new("cmd")
        .args(["/C", "claude --version"])
        .output()
        .ok()?;

    #[cfg(not(windows))]
    let output = Command::new("sh")
        .args(["-c", "claude --version"])
        .output()
        .ok()?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Some(version)
    } else {
        None
    }
}

/// 一键修复所有可自动修复的问题
#[tauri::command]
pub async fn fix_all_issues() -> Result<FixResult, String> {
    log::info!("🔧 开始一键修复...");

    let mut fixed_count = 0;
    let mut failed_count = 0;
    let mut messages: Vec<String> = Vec::new();

    let config_dir = get_config_dir();

    // ========== 修复 1: 同步 MCP 配置 ==========
    // 使用统一的配置同步 API，以 .claude.json（实际生效的配置）为准
    match crate::commands::claude::sync_claude_json_to_settings().await {
        Ok(msg) => {
            fixed_count += 1;
            messages.push(format!("✅ {}", msg));
        }
        Err(e) => {
            failed_count += 1;
            messages.push(format!("❌ 同步 MCP 配置失败: {}", e));
        }
    }

    // ========== 修复 2: 禁用 Prompt Hook ==========
    let hooks_dir = config_dir.join("hooks");
    if hooks_dir.exists() {
        if let Ok(entries) = fs::read_dir(&hooks_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

                if file_name.ends_with(".md") && !file_name.ends_with(".disabled") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        // 如果没有 disabled: true，添加它
                        if !content.contains("disabled: true") && content.starts_with("---") {
                            // 在 frontmatter 中添加 disabled: true
                            let new_content = content.replacen("---\n", "---\ndisabled: true\n", 1);

                            if content != new_content {
                                match fs::write(&path, new_content) {
                                    Ok(_) => {
                                        fixed_count += 1;
                                        messages.push(format!("✅ 已禁用 Prompt Hook: {}", file_name));
                                    }
                                    Err(e) => {
                                        failed_count += 1;
                                        messages.push(format!("❌ 禁用 {} 失败: {}", file_name, e));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ========== 修复 3: 清理 settings.json 中的无效 Hook 配置 ==========
    if let Some(mut settings_val) = settings {
        let mut modified = false;

        if let Some(obj) = settings_val.as_object_mut() {
            if let Some(hooks) = obj.get_mut("hooks") {
                if let Some(hooks_obj) = hooks.as_object_mut() {
                    // 检查配置的 Hook 脚本是否存在
                    let hooks_to_remove: Vec<String> = hooks_obj
                        .iter()
                        .filter_map(|(event, arr)| {
                            if let Some(arr) = arr.as_array() {
                                for hook in arr {
                                    if let Some(cmd) = hook.get("command").and_then(|c| c.as_str()) {
                                        // 检查脚本文件是否存在
                                        if cmd.contains(".ps1") || cmd.contains(".sh") {
                                            let script_path = cmd
                                                .split('"')
                                                .find(|s| s.ends_with(".ps1") || s.ends_with(".sh"));

                                            if let Some(path) = script_path {
                                                let path = PathBuf::from(path.replace("C:/", "C:\\"));
                                                if !path.exists() {
                                                    return Some(event.clone());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            None
                        })
                        .collect();

                    for event in hooks_to_remove {
                        hooks_obj.remove(&event);
                        modified = true;
                        messages.push(format!("✅ 已移除无效的 {} Hook 配置", event));
                    }
                }
            }
        }

        if modified {
            match fs::write(&settings_path, serde_json::to_string_pretty(&settings_val).unwrap()) {
                Ok(_) => {
                    fixed_count += 1;
                }
                Err(e) => {
                    failed_count += 1;
                    messages.push(format!("❌ 更新 settings.json 失败: {}", e));
                }
            }
        }
    }

    log::info!("🔧 修复完成: {} 成功, {} 失败", fixed_count, failed_count);

    Ok(FixResult {
        success: failed_count == 0,
        fixed_count,
        failed_count,
        messages,
    })
}

/// 修复单个问题
#[tauri::command]
pub async fn fix_issue(issue_id: String) -> Result<FixResult, String> {
    log::info!("🔧 修复问题: {}", issue_id);

    match issue_id.as_str() {
        "mcp_not_synced" => {
            // 使用统一的配置同步 API
            match crate::commands::claude::sync_claude_json_to_settings().await {
                Ok(msg) => {
                    Ok(FixResult {
                        success: true,
                        fixed_count: 1,
                        failed_count: 0,
                        messages: vec![format!("✅ {}", msg)],
                    })
                }
                Err(e) => {
                    Err(format!("同步配置失败: {}", e))
                }
            }
        }

        "prompt_hooks_active" => {
            // 禁用所有 Prompt Hook
            let hooks_dir = get_config_dir().join("hooks");
            let mut fixed = 0;
            let mut messages = Vec::new();

            if let Ok(entries) = fs::read_dir(&hooks_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "md").unwrap_or(false) {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if !content.contains("disabled: true") && content.starts_with("---") {
                                let new_content = content.replacen("---\n", "---\ndisabled: true\n", 1);
                                if fs::write(&path, new_content).is_ok() {
                                    fixed += 1;
                                    messages.push(format!("✅ 已禁用: {}", path.file_name().unwrap_or_default().to_string_lossy()));
                                }
                            }
                        }
                    }
                }
            }

            Ok(FixResult {
                success: true,
                fixed_count: fixed,
                failed_count: 0,
                messages,
            })
        }

        _ => Err(format!("不支持修复问题: {}", issue_id)),
    }
}
