//! 配置管理中心 - 全局管控 Claude Code 配置
//!
//! 功能：
//! - 配置健康度诊断
//! - 项目缓存管理（查看、清理）
//! - 配置项开关（真实添加/移除配置代码）
//! - Skills 管理
//! - Hooks 管理

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

/// 配置健康度报告
#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigHealthReport {
    pub score: u32,
    pub claude_md_size: u64,
    pub claude_md_tokens: u64,
    pub projects_cache_size: u64,
    pub projects_cache_size_formatted: String,
    pub session_files_count: u64,
    pub large_session_files: u64,
    pub active_skills: u32,
    pub disabled_skills: u32,
    pub active_mcps: u32,
    pub issues: Vec<ConfigIssue>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigIssue {
    pub level: String, // "critical", "warning", "info"
    pub title: String,
    pub description: String,
    pub fix_action: Option<String>,
}

/// 项目缓存信息
#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCacheInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub size_formatted: String,
    pub session_count: u32,
    pub last_modified: u64,
}

/// 可配置项
#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigItem {
    pub id: String,
    pub name: String,
    pub category: String, // "mcp", "skill", "hook", "setting"
    pub enabled: bool,
    pub description: String,
    pub config_path: String,
    pub size: Option<u64>,
}

/// 获取 Claude 配置目录
fn get_claude_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".claude"))
        .ok_or_else(|| "无法获取用户目录".to_string())
}

/// 获取目录大小（递归）
fn get_dir_size(path: &PathBuf) -> u64 {
    let mut size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                size += get_dir_size(&path);
            } else if let Ok(meta) = fs::metadata(&path) {
                size += meta.len();
            }
        }
    }
    size
}

/// 格式化文件大小
fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1}GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1}MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1}KB", bytes as f64 / KB as f64)
    } else {
        format!("{}B", bytes)
    }
}

/// 统计目录中的文件数量
fn count_files(path: &PathBuf, extension: Option<&str>) -> u64 {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_files(&path, extension);
            } else if let Some(ext) = extension {
                if path.extension().map(|e| e == ext).unwrap_or(false) {
                    count += 1;
                }
            } else {
                count += 1;
            }
        }
    }
    count
}

/// 统计大文件数量（超过指定大小）
fn count_large_files(path: &PathBuf, min_size: u64, extension: Option<&str>) -> u64 {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_large_files(&path, min_size, extension);
            } else {
                let matches_ext = extension
                    .map(|ext| path.extension().map(|e| e == ext).unwrap_or(false))
                    .unwrap_or(true);

                if matches_ext {
                    if let Ok(meta) = fs::metadata(&path) {
                        if meta.len() >= min_size {
                            count += 1;
                        }
                    }
                }
            }
        }
    }
    count
}

/// 获取配置健康度报告
#[command]
pub async fn get_config_health() -> Result<ConfigHealthReport, String> {
    let claude_dir = get_claude_dir()?;
    let mut issues = Vec::new();
    let mut suggestions = Vec::new();
    let mut score: i32 = 100;

    // 1. 检查 CLAUDE.md 大小
    let claude_md_path = claude_dir.join("CLAUDE.md");
    let claude_md_size = fs::metadata(&claude_md_path)
        .map(|m| m.len())
        .unwrap_or(0);
    let claude_md_tokens = claude_md_size / 4; // 粗略估算

    if claude_md_size > 15360 {
        score -= 30;
        issues.push(ConfigIssue {
            level: "critical".to_string(),
            title: "CLAUDE.md 过大".to_string(),
            description: format!(
                "当前 {}，超过 15KB 会严重消耗 Token",
                format_size(claude_md_size)
            ),
            fix_action: Some("compress_claude_md".to_string()),
        });
    } else if claude_md_size > 5120 {
        score -= 10;
        issues.push(ConfigIssue {
            level: "warning".to_string(),
            title: "CLAUDE.md 偏大".to_string(),
            description: format!("当前 {}，建议保持在 5KB 以下", format_size(claude_md_size)),
            fix_action: None,
        });
    }

    // 2. 检查 projects 缓存
    let projects_dir = claude_dir.join("projects");
    let projects_cache_size = get_dir_size(&projects_dir);
    let session_files_count = count_files(&projects_dir, Some("jsonl"));
    let large_session_files = count_large_files(&projects_dir, 1024 * 1024, Some("jsonl")); // > 1MB

    if large_session_files > 5 {
        score -= 25;
        issues.push(ConfigIssue {
            level: "critical".to_string(),
            title: "超大会话文件过多".to_string(),
            description: format!(
                "发现 {} 个超过 1MB 的会话文件，严重影响性能",
                large_session_files
            ),
            fix_action: Some("clean_large_sessions".to_string()),
        });
        suggestions.push("清理 30 天前的会话文件".to_string());
    } else if large_session_files > 0 {
        score -= 10;
        issues.push(ConfigIssue {
            level: "warning".to_string(),
            title: "存在超大会话文件".to_string(),
            description: format!("发现 {} 个超过 1MB 的会话文件", large_session_files),
            fix_action: Some("clean_large_sessions".to_string()),
        });
    }

    if projects_cache_size > 100 * 1024 * 1024 {
        // > 100MB
        score -= 20;
        issues.push(ConfigIssue {
            level: "critical".to_string(),
            title: "项目缓存过大".to_string(),
            description: format!("缓存总大小 {}，建议清理", format_size(projects_cache_size)),
            fix_action: Some("clean_old_cache".to_string()),
        });
    }

    // 3. 统计 Skills
    let skills_dir = claude_dir.join("skills");
    let mut active_skills: u32 = 0;
    let mut disabled_skills: u32 = 0;

    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if entry.path().is_dir() {
                if name.starts_with("_disabled_") {
                    disabled_skills += 1;
                } else if name != "." && name != ".." {
                    active_skills += 1;
                }
            }
        }
    }

    if active_skills > 10 {
        score -= 15;
        issues.push(ConfigIssue {
            level: "warning".to_string(),
            title: "活跃 Skills 过多".to_string(),
            description: format!("当前有 {} 个活跃 Skills，建议保持在 10 个以下", active_skills),
            fix_action: None,
        });
    }

    // 4. 统计 MCP（从 ~/.claude.json）
    let mut active_mcps: u32 = 0;
    let claude_json_path = dirs::home_dir()
        .map(|h| h.join(".claude.json"))
        .ok_or_else(|| "无法获取用户目录".to_string())?;

    if let Ok(content) = fs::read_to_string(&claude_json_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
                active_mcps = servers.len() as u32;
            }
        }
    }

    // 确保分数不低于 0
    let final_score = score.max(0) as u32;

    // 添加通用建议
    if issues.is_empty() {
        suggestions.push("配置状态良好，继续保持！".to_string());
    } else {
        suggestions.push("定期运行配置诊断，保持系统健康".to_string());
    }

    Ok(ConfigHealthReport {
        score: final_score,
        claude_md_size,
        claude_md_tokens,
        projects_cache_size,
        projects_cache_size_formatted: format_size(projects_cache_size),
        session_files_count,
        large_session_files,
        active_skills,
        disabled_skills,
        active_mcps,
        issues,
        suggestions,
    })
}

/// 获取所有项目缓存信息
#[command]
pub async fn get_projects_cache() -> Result<Vec<ProjectCacheInfo>, String> {
    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");
    let mut caches = Vec::new();

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                let size = get_dir_size(&path);
                let session_count = count_files(&path, Some("jsonl")) as u32;

                let last_modified = fs::metadata(&path)
                    .and_then(|m| m.modified())
                    .map(|t| {
                        t.duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0)
                    })
                    .unwrap_or(0);

                caches.push(ProjectCacheInfo {
                    path: path.to_string_lossy().to_string(),
                    name,
                    size,
                    size_formatted: format_size(size),
                    session_count,
                    last_modified,
                });
            }
        }
    }

    // 按大小降序排序
    caches.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(caches)
}

/// 清理指定项目的缓存
#[command]
pub async fn clean_project_cache(project_name: String) -> Result<u64, String> {
    let claude_dir = get_claude_dir()?;
    let project_dir = claude_dir.join("projects").join(&project_name);

    if !project_dir.exists() {
        return Err(format!("项目缓存不存在: {}", project_name));
    }

    let size_before = get_dir_size(&project_dir);

    // 删除所有 .jsonl 文件
    if let Ok(entries) = fs::read_dir(&project_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let size_after = get_dir_size(&project_dir);
    let freed = size_before - size_after;

    log::info!(
        "✅ 清理项目缓存 '{}': 释放 {}",
        project_name,
        format_size(freed)
    );

    Ok(freed)
}

/// 清理所有旧缓存（指定天数前的）
#[command]
pub async fn clean_old_cache(days: u32) -> Result<CleanupResult, String> {
    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");

    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        - (days as u64 * 24 * 60 * 60);

    let mut files_deleted = 0u64;
    let mut bytes_freed = 0u64;

    fn clean_dir(
        dir: &PathBuf,
        cutoff: u64,
        files_deleted: &mut u64,
        bytes_freed: &mut u64,
    ) -> std::io::Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                clean_dir(&path, cutoff, files_deleted, bytes_freed)?;
            } else if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                if let Ok(meta) = fs::metadata(&path) {
                    let modified = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    if modified < cutoff {
                        let size = meta.len();
                        if fs::remove_file(&path).is_ok() {
                            *files_deleted += 1;
                            *bytes_freed += size;
                        }
                    }
                }
            }
        }
        Ok(())
    }

    let _ = clean_dir(&projects_dir, cutoff, &mut files_deleted, &mut bytes_freed);

    log::info!(
        "✅ 清理 {} 天前的缓存: 删除 {} 个文件，释放 {}",
        days,
        files_deleted,
        format_size(bytes_freed)
    );

    Ok(CleanupResult {
        files_deleted,
        bytes_freed,
        bytes_freed_formatted: format_size(bytes_freed),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupResult {
    pub files_deleted: u64,
    pub bytes_freed: u64,
    pub bytes_freed_formatted: String,
}

/// 获取所有可配置项（Skills）
#[command]
pub async fn get_config_items() -> Result<Vec<ConfigItem>, String> {
    let claude_dir = get_claude_dir()?;
    let mut items = Vec::new();

    // 1. 获取 Skills
    let skills_dir = claude_dir.join("skills");
    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();

                // 跳过特殊目录
                if name == "." || name == ".." {
                    continue;
                }

                let is_disabled = name.starts_with("_disabled_");
                let display_name = if is_disabled {
                    name.trim_start_matches("_disabled_").to_string()
                } else {
                    name.clone()
                };

                // 读取 SKILL.md 获取描述
                let skill_md = path.join("SKILL.md");
                let description = if skill_md.exists() {
                    fs::read_to_string(&skill_md)
                        .ok()
                        .and_then(|content| {
                            // 尝试从 YAML frontmatter 提取 description
                            content
                                .lines()
                                .find(|line| line.starts_with("description:"))
                                .map(|line| {
                                    line.trim_start_matches("description:")
                                        .trim()
                                        .trim_matches('"')
                                        .to_string()
                                })
                        })
                        .unwrap_or_else(|| "无描述".to_string())
                } else {
                    "无描述".to_string()
                };

                let size = get_dir_size(&path);

                items.push(ConfigItem {
                    id: name.clone(),
                    name: display_name,
                    category: "skill".to_string(),
                    enabled: !is_disabled,
                    description: description.chars().take(100).collect(),
                    config_path: path.to_string_lossy().to_string(),
                    size: Some(size),
                });
            }
        }
    }

    // 2. 获取 Hooks
    let hooks_dir = claude_dir.join("hooks");
    if let Ok(entries) = fs::read_dir(&hooks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_file() && (name.ends_with(".sh") || name.ends_with(".ps1")) {
                let is_disabled = name.starts_with("_disabled_");
                let display_name = if is_disabled {
                    name.trim_start_matches("_disabled_").to_string()
                } else {
                    name.clone()
                };

                let size = fs::metadata(&path).map(|m| m.len()).ok();

                items.push(ConfigItem {
                    id: name.clone(),
                    name: display_name,
                    category: "hook".to_string(),
                    enabled: !is_disabled,
                    description: "Hook 脚本".to_string(),
                    config_path: path.to_string_lossy().to_string(),
                    size,
                });
            }
        }
    }

    // 按类别和名称排序
    items.sort_by(|a, b| {
        a.category
            .cmp(&b.category)
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(items)
}

/// 开启/关闭配置项（真实添加/移除）
#[command]
pub async fn toggle_config_item(
    id: String,
    category: String,
    enabled: bool,
) -> Result<bool, String> {
    let claude_dir = get_claude_dir()?;

    match category.as_str() {
        "skill" => {
            let skills_dir = claude_dir.join("skills");

            // 确定当前路径和目标路径
            let (current_name, target_name) = if enabled {
                // 开启：从 _disabled_xxx 改为 xxx
                let disabled_name = if id.starts_with("_disabled_") {
                    id.clone()
                } else {
                    format!("_disabled_{}", id)
                };
                let enabled_name = disabled_name.trim_start_matches("_disabled_").to_string();
                (disabled_name, enabled_name)
            } else {
                // 关闭：从 xxx 改为 _disabled_xxx
                let enabled_name = id.trim_start_matches("_disabled_").to_string();
                let disabled_name = format!("_disabled_{}", enabled_name);
                (enabled_name, disabled_name)
            };

            let current_path = skills_dir.join(&current_name);
            let target_path = skills_dir.join(&target_name);

            if !current_path.exists() {
                return Err(format!("Skill 不存在: {}", current_name));
            }

            if target_path.exists() {
                return Err(format!("目标路径已存在: {}", target_name));
            }

            fs::rename(&current_path, &target_path).map_err(|e| format!("重命名失败: {}", e))?;

            log::info!(
                "✅ Skill '{}' 已{}",
                target_name,
                if enabled { "启用" } else { "禁用" }
            );

            Ok(enabled)
        }
        "hook" => {
            let hooks_dir = claude_dir.join("hooks");

            let (current_name, target_name) = if enabled {
                let disabled_name = if id.starts_with("_disabled_") {
                    id.clone()
                } else {
                    format!("_disabled_{}", id)
                };
                let enabled_name = disabled_name.trim_start_matches("_disabled_").to_string();
                (disabled_name, enabled_name)
            } else {
                let enabled_name = id.trim_start_matches("_disabled_").to_string();
                let disabled_name = format!("_disabled_{}", enabled_name);
                (enabled_name, disabled_name)
            };

            let current_path = hooks_dir.join(&current_name);
            let target_path = hooks_dir.join(&target_name);

            if !current_path.exists() {
                return Err(format!("Hook 不存在: {}", current_name));
            }

            fs::rename(&current_path, &target_path).map_err(|e| format!("重命名失败: {}", e))?;

            log::info!(
                "✅ Hook '{}' 已{}",
                target_name,
                if enabled { "启用" } else { "禁用" }
            );

            Ok(enabled)
        }
        "mcp" => {
            // MCP 的开关已经在 mcp.rs 中实现了
            // 这里调用现有的逻辑
            if enabled {
                // 需要服务器配置才能启用，这里只返回错误提示
                Err("启用 MCP 需要提供服务器配置，请使用 MCP 管理页面".to_string())
            } else {
                // 禁用：从 ~/.claude.json 移除
                crate::mcp::remove_server_from_claude(&id)?;
                log::info!("✅ MCP '{}' 已从配置中移除", id);
                Ok(false)
            }
        }
        _ => Err(format!("不支持的配置类别: {}", category)),
    }
}

/// 备份当前配置
#[command]
pub async fn backup_config() -> Result<String, String> {
    let claude_dir = get_claude_dir()?;
    let backup_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户目录".to_string())?
        .join("claude-backups");

    // 创建备份目录
    fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    // 生成备份文件名
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("claude_backup_{}", timestamp);
    let backup_path = backup_dir.join(&backup_name);

    // 复制配置目录
    fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            if src_path.is_dir() {
                // 跳过 projects 目录（太大）
                if entry.file_name() == "projects" {
                    continue;
                }
                copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }
        Ok(())
    }

    copy_dir_recursive(&claude_dir, &backup_path)
        .map_err(|e| format!("备份失败: {}", e))?;

    // 同时备份 ~/.claude.json
    let claude_json = dirs::home_dir()
        .ok_or_else(|| "无法获取用户目录".to_string())?
        .join(".claude.json");

    if claude_json.exists() {
        let backup_json = backup_path.join("claude.json");
        fs::copy(&claude_json, &backup_json).map_err(|e| format!("备份 claude.json 失败: {}", e))?;
    }

    log::info!("✅ 配置已备份到: {}", backup_path.display());

    Ok(backup_path.to_string_lossy().to_string())
}
