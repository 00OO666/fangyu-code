//! Smart Project Management Module
//!
//! Provides intelligent project creation, naming, and management features.

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// 安全获取本地时间字符串
/// 某些 Windows 时区配置下 chrono::Local::now() 可能会 panic
/// 这个函数提供 fallback 机制
fn safe_local_time() -> String {
    // 尝试使用 Local::now()
    std::panic::catch_unwind(|| {
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
    })
    .unwrap_or_else(|_| {
        // fallback: 使用 UTC 时间
        log::warn!("[SmartProject] Local::now() panicked, using UTC time");
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
    })
}

/// Base directory for all smart projects
const SMART_PROJECTS_DIR: &str = "F:\\Claude-Projects";

/// Result of creating a smart project
#[derive(Debug, Serialize, Deserialize)]
pub struct SmartProjectResult {
    pub success: bool,
    pub project_path: String,
    pub project_name: String,
    pub error: Option<String>,
}

/// Generates a clean folder name from a session title
fn sanitize_folder_name(title: &str) -> String {
    title
        .chars()
        .map(|c| match c {
            // Replace invalid Windows filename characters
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            '\n' | '\r' => ' ',
            // Keep everything else
            _ => c,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .chars()
        .take(100) // Limit to 100 characters
        .collect()
}

/// Generates a session title from the first message
/// Uses a simple extraction: takes first line or first 50 characters
fn generate_title_from_message(message: &str) -> String {
    let cleaned = message.trim();

    // Take first line if it exists and is reasonable length
    if let Some(first_line) = cleaned.lines().next() {
        if !first_line.is_empty() && first_line.len() <= 80 {
            return first_line.to_string();
        }
    }

    // Otherwise take first 50 characters (按字符截断，支持中文)
    let char_count = cleaned.chars().count();
    if char_count <= 50 {
        cleaned.to_string()
    } else {
        format!("{}...", cleaned.chars().take(50).collect::<String>())
    }
}

/// Creates a new smart project folder
///
/// # Arguments
/// * `session_title` - The title to use for the project folder name
///
/// # Returns
/// * `SmartProjectResult` with the created project path
#[tauri::command]
pub async fn create_smart_project(session_title: String) -> Result<SmartProjectResult, String> {
    log::info!("[SmartProject] Creating project with title: {}", session_title);

    // Sanitize the title to create a valid folder name
    let folder_name = sanitize_folder_name(&session_title);

    if folder_name.is_empty() {
        return Ok(SmartProjectResult {
            success: false,
            project_path: String::new(),
            project_name: String::new(),
            error: Some("Invalid session title: cannot create empty folder name".to_string()),
        });
    }

    // Create the base projects directory if it doesn't exist
    let base_dir = PathBuf::from(SMART_PROJECTS_DIR);
    if !base_dir.exists() {
        log::info!("[SmartProject] Base directory does not exist, creating: {:?}", base_dir);
        if let Err(e) = fs::create_dir_all(&base_dir) {
            log::error!("[SmartProject] Failed to create base directory: {}", e);
            return Ok(SmartProjectResult {
                success: false,
                project_path: String::new(),
                project_name: String::new(),
                error: Some(format!("无法创建基础目录 {}: {}. 请检查磁盘权限和可用空间。", SMART_PROJECTS_DIR, e)),
            });
        }
        log::info!("[SmartProject] Created base directory: {}", SMART_PROJECTS_DIR);
    }

    // Create the project folder
    let project_path = base_dir.join(&folder_name);

    // Handle name conflicts by appending number
    let mut final_path = project_path.clone();
    let mut counter = 1;

    while final_path.exists() {
        let numbered_name = format!("{} ({})", folder_name, counter);
        final_path = base_dir.join(&numbered_name);
        counter += 1;

        if counter > 100 {
            return Ok(SmartProjectResult {
                success: false,
                project_path: String::new(),
                project_name: String::new(),
                error: Some("Too many projects with similar names".to_string()),
            });
        }
    }

    // Create the directory
    if let Err(e) = fs::create_dir_all(&final_path) {
        log::error!("[SmartProject] Failed to create project directory {:?}: {}", final_path, e);
        return Ok(SmartProjectResult {
            success: false,
            project_path: String::new(),
            project_name: String::new(),
            error: Some(format!("无法创建项目目录: {}. 请检查磁盘权限和可用空间。", e)),
        });
    }

    let final_name = final_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&folder_name)
        .to_string();

    log::info!("[SmartProject] Created project: {}", final_path.display());

    Ok(SmartProjectResult {
        success: true,
        project_path: final_path.to_string_lossy().to_string(),
        project_name: final_name,
        error: None,
    })
}

/// Renames an existing smart project folder
///
/// # Arguments
/// * `old_path` - The current project path
/// * `new_title` - The new title for the project
///
/// # Returns
/// * `SmartProjectResult` with the new project path
#[tauri::command]
pub async fn rename_smart_project(
    old_path: String,
    new_title: String,
) -> Result<SmartProjectResult, String> {
    log::info!("[SmartProject] Renaming project: {} -> {}", old_path, new_title);

    let old_path_buf = PathBuf::from(&old_path);

    if !old_path_buf.exists() {
        return Ok(SmartProjectResult {
            success: false,
            project_path: old_path.clone(),
            project_name: String::new(),
            error: Some("Project path does not exist".to_string()),
        });
    }

    // Sanitize the new title
    let new_folder_name = sanitize_folder_name(&new_title);

    if new_folder_name.is_empty() {
        return Ok(SmartProjectResult {
            success: false,
            project_path: old_path.clone(),
            project_name: String::new(),
            error: Some("Invalid new title: cannot create empty folder name".to_string()),
        });
    }

    // Get the parent directory
    let parent_dir = old_path_buf
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;

    // Create new path
    let mut new_path = parent_dir.join(&new_folder_name);

    // Handle name conflicts
    let mut counter = 1;
    while new_path.exists() && new_path != old_path_buf {
        let numbered_name = format!("{} ({})", new_folder_name, counter);
        new_path = parent_dir.join(&numbered_name);
        counter += 1;

        if counter > 100 {
            return Ok(SmartProjectResult {
                success: false,
                project_path: old_path.clone(),
                project_name: String::new(),
                error: Some("Too many projects with similar names".to_string()),
            });
        }
    }

    // If new path is same as old, no need to rename
    if new_path == old_path_buf {
        let current_name = old_path_buf
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        return Ok(SmartProjectResult {
            success: true,
            project_path: old_path.clone(),
            project_name: current_name,
            error: None,
        });
    }

    // Perform the rename
    fs::rename(&old_path_buf, &new_path)
        .map_err(|e| format!("Failed to rename project directory: {}", e))?;

    let final_name = new_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&new_folder_name)
        .to_string();

    log::info!("[SmartProject] Renamed project to: {}", new_path.display());

    Ok(SmartProjectResult {
        success: true,
        project_path: new_path.to_string_lossy().to_string(),
        project_name: final_name,
        error: None,
    })
}

/// Generates a session title from the first user message
///
/// # Arguments
/// * `first_message` - The first user message content
///
/// # Returns
/// * Generated session title
#[tauri::command]
pub async fn generate_session_title(first_message: String) -> Result<String, String> {
    log::info!("[SmartProject] Generating title from message (length: {})", first_message.len());

    let title = generate_title_from_message(&first_message);

    log::info!("[SmartProject] Generated title: {}", title);

    Ok(title)
}

/// Creates a project-level CLAUDE.md file
///
/// # Arguments
/// * `project_path` - The project directory path
/// * `session_title` - The session title to include in the README
///
/// # Returns
/// * Path to the created CLAUDE.md file
#[tauri::command]
pub async fn create_project_claude_md(
    project_path: String,
    session_title: String,
) -> Result<String, String> {
    log::info!("[SmartProject] Creating CLAUDE.md for: {}", project_path);

    let project_path_buf = PathBuf::from(&project_path);

    // 确保目录存在（如果不存在则创建）
    if !project_path_buf.exists() {
        log::info!("[SmartProject] Project path does not exist, creating: {:?}", project_path_buf);
        fs::create_dir_all(&project_path_buf)
            .map_err(|e| format!("Failed to create project directory: {}", e))?;
    }

    let claude_md_path = project_path_buf.join("CLAUDE.md");

    // Create a minimal project-level CLAUDE.md
    let content = format!(
r#"# {}

> **项目类型**: Fangyu Code 智能会话
> **创建时间**: {}
> **工作目录**: `{}`

---

## 项目说明

本项目由 Fangyu Code 自动创建，用于隔离会话上下文，降低 Token 消耗。

### 配置继承

- 全局配置: `C:\Users\666\.claude\CLAUDE.md`
- 本地配置: 本文件（优先级更高）

### 工作原则

1. 所有工作文件在当前目录内创建
2. 禁止在其他目录创建临时文件
3. 独立的项目上下文，不污染全局配置

---

**🔧 Auto-generated by Fangyu Code**
"#,
        session_title,
        safe_local_time(),
        project_path
    );

    fs::write(&claude_md_path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    log::info!("[SmartProject] Created CLAUDE.md: {}", claude_md_path.display());

    Ok(claude_md_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_folder_name() {
        assert_eq!(sanitize_folder_name("Hello World"), "Hello World");
        assert_eq!(sanitize_folder_name("Test<>Project"), "Test--Project");
        assert_eq!(sanitize_folder_name("Path/To\\File"), "Path-To-File");
        assert_eq!(sanitize_folder_name("   Extra  Spaces   "), "Extra Spaces");
    }

    #[test]
    fn test_generate_title_from_message() {
        assert_eq!(
            generate_title_from_message("Create a new project"),
            "Create a new project"
        );
        assert_eq!(
            generate_title_from_message("This is a very long message that exceeds the fifty character limit for titles"),
            "This is a very long message that exceeds the fi..."
        );
        assert_eq!(
            generate_title_from_message("First line\nSecond line\nThird line"),
            "First line"
        );
    }
}
