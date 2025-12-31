use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::paths::get_claude_dir;
use super::platform;

/// Represents a Hook file in the hooks directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookFileInfo {
    /// Hook file name (without extension)
    pub name: String,
    /// Full file path
    pub path: String,
    /// File extension (ps1, sh, py, etc.)
    pub extension: String,
    /// Description extracted from file comments
    pub description: Option<String>,
    /// Whether the hook is currently enabled in settings.json
    pub is_enabled: bool,
    /// The hook event type this file is configured for (if enabled)
    pub event_type: Option<String>,
}

#[tauri::command]
pub async fn get_hooks_config(
    scope: String,
    project_path: Option<String>,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Getting hooks config for scope: {}, project: {:?}",
        scope,
        project_path
    );

    let settings_path = match scope.as_str() {
        "user" => get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("settings.json"),
        "project" => {
            let path = project_path.ok_or("Project path required for project scope")?;
            PathBuf::from(path).join(".claude").join("settings.json")
        }
        "local" => {
            let path = project_path.ok_or("Project path required for local scope")?;
            PathBuf::from(path)
                .join(".claude")
                .join("settings.local.json")
        }
        _ => return Err("Invalid scope".to_string()),
    };

    log::info!("Settings file path: {:?}", settings_path);

    if !settings_path.exists() {
        log::info!(
            "Settings file does not exist at {:?}, returning empty hooks",
            settings_path
        );
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    log::debug!("Settings file content length: {} bytes", content.len());

    let settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?;

    let hooks = settings
        .get("hooks")
        .cloned()
        .unwrap_or(serde_json::json!({}));
    log::info!(
        "Returning hooks config: {}",
        serde_json::to_string_pretty(&hooks).unwrap_or_default()
    );

    Ok(hooks)
}

/// Updates hooks configuration in settings at specified scope
#[tauri::command]
pub async fn update_hooks_config(
    scope: String,
    hooks: serde_json::Value,
    project_path: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Updating hooks config for scope: {}, project: {:?}",
        scope,
        project_path
    );

    let settings_path = match scope.as_str() {
        "user" => get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("settings.json"),
        "project" => {
            let path = project_path.ok_or("Project path required for project scope")?;
            let claude_dir = PathBuf::from(path).join(".claude");
            fs::create_dir_all(&claude_dir)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            claude_dir.join("settings.json")
        }
        "local" => {
            let path = project_path.ok_or("Project path required for local scope")?;
            let claude_dir = PathBuf::from(path).join(".claude");
            fs::create_dir_all(&claude_dir)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            claude_dir.join("settings.local.json")
        }
        _ => return Err("Invalid scope".to_string()),
    };

    // Read existing settings or create new
    let mut settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?
    } else {
        serde_json::json!({})
    };

    // Update hooks section
    settings["hooks"] = hooks;

    // Write back with pretty formatting
    let json_string = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json_string)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok("Hooks configuration updated successfully".to_string())
}

/// Validates a hook command by dry-running it
#[tauri::command]
pub async fn validate_hook_command(command: String) -> Result<serde_json::Value, String> {
    log::info!("Validating hook command syntax");

    // Validate syntax without executing
    let mut cmd = std::process::Command::new("bash");
    cmd.arg("-n") // Syntax check only
        .arg("-c")
        .arg(&command);

    // Apply platform-specific no-window configuration
    platform::apply_no_window(&mut cmd);

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                Ok(serde_json::json!({
                    "valid": true,
                    "message": "Command syntax is valid"
                }))
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(serde_json::json!({
                    "valid": false,
                    "message": format!("Syntax error: {}", stderr)
                }))
            }
        }
        Err(e) => Err(format!("Failed to validate command: {}", e)),
    }
}

/// Extract description from hook file content
/// Looks for comments at the start of the file
fn extract_hook_description(content: &str) -> Option<String> {
    let first_lines: Vec<&str> = content.lines().take(10).collect();

    for line in first_lines {
        let trimmed = line.trim();
        // PowerShell comment
        if trimmed.starts_with('#') && !trimmed.starts_with("#!") {
            let desc = trimmed.trim_start_matches('#').trim();
            if !desc.is_empty() && !desc.starts_with("Requires") {
                return Some(desc.to_string());
            }
        }
        // Python/Bash comment
        if trimmed.starts_with("# ") {
            let desc = trimmed.trim_start_matches("# ").trim();
            if !desc.is_empty() {
                return Some(desc.to_string());
            }
        }
    }
    None
}

/// Extract description from Prompt Hook (.md) frontmatter
/// Returns the description field from YAML frontmatter
fn extract_md_description(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || !lines[0].trim().starts_with("---") {
        return None;
    }

    // Find end of frontmatter
    let end_idx = lines.iter().skip(1).position(|line| line.trim().starts_with("---"))?;

    // Parse frontmatter
    for line in &lines[1..=end_idx] {
        let trimmed = line.trim();
        if trimmed.starts_with("description:") {
            let desc = trimmed.trim_start_matches("description:").trim();
            return Some(desc.to_string());
        }
    }

    None
}

/// Check if Prompt Hook (.md) is disabled in frontmatter
/// Returns true if "disabled: true" is found
fn is_md_hook_disabled(content: &str) -> bool {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || !lines[0].trim().starts_with("---") {
        return false;
    }

    // Find end of frontmatter
    if let Some(end_idx) = lines.iter().skip(1).position(|line| line.trim().starts_with("---")) {
        // Check for disabled: true
        for line in &lines[1..=end_idx] {
            let trimmed = line.trim();
            if trimmed.starts_with("disabled:") {
                let value = trimmed.trim_start_matches("disabled:").trim();
                return value == "true";
            }
        }
    }

    false
}

/// Extract event type from Prompt Hook (.md) frontmatter
/// Returns the event field (SessionStart, PreToolUse, etc.)
fn extract_md_event_type(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || !lines[0].trim().starts_with("---") {
        return None;
    }

    // Find end of frontmatter
    let end_idx = lines.iter().skip(1).position(|line| line.trim().starts_with("---"))?;

    // Parse frontmatter
    for line in &lines[1..=end_idx] {
        let trimmed = line.trim();
        if trimmed.starts_with("event:") {
            let event = trimmed.trim_start_matches("event:").trim();
            return Some(event.to_string());
        }
    }

    None
}

/// Set disabled status in Prompt Hook (.md) frontmatter
/// Adds "disabled: true/false" or updates existing value
fn set_md_hook_disabled(content: &str, disabled: bool) -> Result<String, String> {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || !lines[0].trim().starts_with("---") {
        return Err("File does not have valid frontmatter".to_string());
    }

    // Find end of frontmatter
    let end_idx = lines.iter().skip(1).position(|line| line.trim().starts_with("---"))
        .ok_or("Could not find end of frontmatter")?;

    let mut new_lines: Vec<String> = Vec::new();
    let mut disabled_found = false;

    // Process frontmatter
    new_lines.push(lines[0].to_string()); // Opening ---

    for line in &lines[1..=end_idx] {
        let trimmed = line.trim();
        if trimmed.starts_with("disabled:") {
            // Update existing disabled field
            new_lines.push(format!("disabled: {}", disabled));
            disabled_found = true;
        } else {
            new_lines.push(line.to_string());
        }
    }

    // If disabled field not found, add it after the opening ---
    if !disabled_found {
        new_lines.insert(1, format!("disabled: {}", disabled));
    }

    // Add remaining lines (after frontmatter)
    for line in &lines[end_idx+1..] {
        new_lines.push(line.to_string());
    }

    Ok(new_lines.join("\n"))
}

/// List all hook files in the hooks directory
/// Scans ~/.claude/hooks/ for .ps1, .sh, .py files
#[tauri::command]
pub async fn list_hook_files() -> Result<Vec<HookFileInfo>, String> {
    log::info!("Listing hook files");

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let hooks_dir = claude_dir.join("hooks");

    if !hooks_dir.exists() {
        log::info!("Hooks directory does not exist, returning empty list");
        return Ok(vec![]);
    }

    // Get current hooks configuration to check enabled status
    let settings_path = claude_dir.join("settings.json");
    let enabled_hooks: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        let settings: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings: {}", e))?;
        settings.get("hooks").cloned().unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let mut hook_files = Vec::new();
    let valid_extensions = ["ps1", "sh", "py", "bat", "cmd", "md"]; // 添加 .md 支持

    for entry in WalkDir::new(&hooks_dir)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        // Check file extension
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        if !valid_extensions.contains(&extension) {
            continue;
        }

        // Skip disabled files (ending with .disabled)
        let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        if file_name.ends_with(".disabled") {
            continue;
        }

        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Read content to extract description and check enabled status
        let path_str = path.to_string_lossy().to_string();
        let (description, is_enabled, event_type) = if extension == "md" {
            // For Prompt Hook (.md files)
            if let Ok(content) = fs::read_to_string(path) {
                let desc = extract_md_description(&content);
                let disabled = is_md_hook_disabled(&content);
                // Extract event type from frontmatter
                let evt = extract_md_event_type(&content);
                (desc, !disabled, evt)
            } else {
                (None, false, None)
            }
        } else {
            // For Command Hook (.ps1, .sh, .py files)
            let desc = if let Ok(content) = fs::read_to_string(path) {
                extract_hook_description(&content)
            } else {
                None
            };
            let (enabled, evt) = check_hook_enabled_status(&enabled_hooks, &path_str);
            (desc, enabled, evt)
        };

        hook_files.push(HookFileInfo {
            name,
            path: path_str,
            extension: extension.to_string(),
            description,
            is_enabled,
            event_type,
        });
    }

    // Sort by name
    hook_files.sort_by(|a, b| a.name.cmp(&b.name));

    log::info!("Found {} hook files", hook_files.len());
    Ok(hook_files)
}

/// Check if a hook file is enabled in the settings
fn check_hook_enabled_status(hooks_config: &serde_json::Value, hook_path: &str) -> (bool, Option<String>) {
    // Normalize path for comparison
    let normalized_path = hook_path.replace('\\', "/").to_lowercase();

    // Check all event types
    let event_types = ["PreToolUse", "PostToolUse", "SessionStart", "Stop", "Notification"];

    for event_type in event_types {
        if let Some(event_hooks) = hooks_config.get(event_type) {
            if let Some(hooks_array) = event_hooks.as_array() {
                for hook in hooks_array {
                    // Check if this hook references our file
                    if let Some(command) = hook.get("command").and_then(|c| c.as_str()) {
                        let normalized_command = command.replace('\\', "/").to_lowercase();
                        if normalized_command.contains(&normalized_path) ||
                           normalized_path.contains(&normalized_command) {
                            return (true, Some(event_type.to_string()));
                        }
                    }
                }
            }
        }
    }

    (false, None)
}

/// Toggle a hook file on/off
/// For Command Hooks (.ps1, .sh, .py): adds/removes from settings.json hooks section
/// For Prompt Hooks (.md): modifies "disabled: true/false" in frontmatter
#[tauri::command]
pub async fn toggle_hook_file(
    hook_path: String,
    enabled: bool,
    event_type: String,
) -> Result<bool, String> {
    log::info!(
        "Toggling hook file: {} to enabled={} for event={}",
        hook_path,
        enabled,
        event_type
    );

    // Check if this is a Prompt Hook (.md file)
    let path_buf = PathBuf::from(&hook_path);
    let is_md_hook = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext == "md")
        .unwrap_or(false);

    if is_md_hook {
        // Handle Prompt Hook (.md file) - modify frontmatter
        log::info!("Toggling Prompt Hook (.md file)");

        let content = fs::read_to_string(&path_buf)
            .map_err(|e| format!("Failed to read hook file: {}", e))?;

        let new_content = set_md_hook_disabled(&content, !enabled)
            .map_err(|e| format!("Failed to update frontmatter: {}", e))?;

        fs::write(&path_buf, new_content)
            .map_err(|e| format!("Failed to write hook file: {}", e))?;

        log::info!("Prompt Hook frontmatter updated successfully");
        return Ok(true);
    }

    // Handle Command Hook (.ps1, .sh, .py files) - modify settings.json
    log::info!("Toggling Command Hook (.ps1/.sh/.py file)");

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.json");

    // Read existing settings
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings: {}", e))?
    } else {
        serde_json::json!({})
    };

    // Get or create hooks section
    if settings.get("hooks").is_none() {
        settings["hooks"] = serde_json::json!({});
    }

    let hooks = settings.get_mut("hooks").unwrap();

    // Normalize the hook path
    let normalized_path = hook_path.replace('\\', "/");

    if enabled {
        // Add hook to the specified event type
        let event_hooks = hooks
            .get_mut(&event_type)
            .and_then(|v| v.as_array_mut());

        let new_hook = serde_json::json!({
            "type": "command",
            "command": format!("powershell -ExecutionPolicy Bypass -File \"{}\"", normalized_path),
        });

        if let Some(arr) = event_hooks {
            // Check if already exists
            let exists = arr.iter().any(|h| {
                h.get("command")
                    .and_then(|c| c.as_str())
                    .map(|c| c.contains(&normalized_path))
                    .unwrap_or(false)
            });

            if !exists {
                arr.push(new_hook);
            }
        } else {
            hooks[&event_type] = serde_json::json!([new_hook]);
        }
    } else {
        // Remove hook from all event types
        let event_types = ["PreToolUse", "PostToolUse", "SessionStart", "Stop", "Notification"];

        for evt in event_types {
            if let Some(event_hooks) = hooks.get_mut(evt).and_then(|v| v.as_array_mut()) {
                event_hooks.retain(|h| {
                    !h.get("command")
                        .and_then(|c| c.as_str())
                        .map(|c| c.replace('\\', "/").contains(&normalized_path))
                        .unwrap_or(false)
                });
            }
        }
    }

    // Write back settings
    let json_string = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json_string)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    log::info!("Command Hook toggle completed successfully");
    Ok(true)
}

/// Get list of currently active hooks from settings
#[tauri::command]
pub async fn get_active_hooks() -> Result<serde_json::Value, String> {
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    let hooks = settings.get("hooks").cloned().unwrap_or(serde_json::json!({}));
    Ok(hooks)
}
