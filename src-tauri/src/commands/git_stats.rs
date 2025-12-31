use serde::{Deserialize, Serialize};
use std::process::Command as StdCommand;

/// Git 代码变更统计
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffStats {
    /// 新增的行数
    pub lines_added: usize,
    /// 删除的行数
    pub lines_removed: usize,
    /// 修改的文件数
    pub files_changed: usize,
}

/// 获取两个 commit 之间的代码变更统计
#[tauri::command]
pub async fn get_git_diff_stats(
    project_path: String,
    from_commit: String,
    to_commit: Option<String>,
) -> Result<GitDiffStats, String> {
    let to_ref = to_commit.unwrap_or_else(|| "HEAD".to_string());

    // 使用 git diff --numstat 获取统计
    let mut cmd = StdCommand::new("git");
    cmd.current_dir(&project_path);
    cmd.args(&["diff", "--numstat", &from_commit, &to_ref]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // 解析 git diff --numstat 输出
    // 格式：<added>\t<removed>\t<filename>
    let mut lines_added = 0;
    let mut lines_removed = 0;
    let mut files_changed = 0;

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            files_changed += 1;

            // 解析新增行数
            if let Ok(added) = parts[0].parse::<usize>() {
                lines_added += added;
            }

            // 解析删除行数
            if let Ok(removed) = parts[1].parse::<usize>() {
                lines_removed += removed;
            }
        }
    }

    Ok(GitDiffStats {
        lines_added,
        lines_removed,
        files_changed,
    })
}

/// 获取当前会话的代码变更统计（从会话开始到现在）
#[tauri::command]
pub async fn get_session_code_changes(
    project_path: String,
    session_start_commit: String,
) -> Result<GitDiffStats, String> {
    get_git_diff_stats(project_path, session_start_commit, None).await
}

// ============================================================================
// File Change Tracking (for Code Rollback Preview)
// ============================================================================

/// File change information for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    /// File path relative to repository root
    pub path: String,
    /// Number of lines added
    pub added: usize,
    /// Number of lines removed
    pub removed: usize,
    /// Change type: "modified", "added", "deleted", "renamed"
    pub change_type: String,
    /// Old path (for renamed files)
    pub old_path: Option<String>,
}

/// Get list of changed files between two commits
#[tauri::command]
pub async fn get_git_changed_files(
    project_path: String,
    from_commit: String,
    to_commit: Option<String>,
) -> Result<Vec<FileChange>, String> {
    let to_ref = to_commit.unwrap_or_else(|| "HEAD".to_string());

    // Use git diff --numstat to get file changes
    let mut cmd = StdCommand::new("git");
    cmd.current_dir(&project_path);
    cmd.args(&["diff", "--numstat", "--find-renames", &from_commit, &to_ref]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    // Parse git diff --numstat output
    // Format: <added>\t<removed>\t<filename>
    // For renames: <added>\t<removed>\t<old_path> => <new_path>
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let added_str = parts[0];
            let removed_str = parts[1];
            let file_info = parts[2];

            // Parse added/removed counts (can be "-" for binary files)
            let added = added_str.parse::<usize>().unwrap_or(0);
            let removed = removed_str.parse::<usize>().unwrap_or(0);

            // Check for rename (format: "old_path => new_path")
            if file_info.contains(" => ") {
                let rename_parts: Vec<&str> = file_info.split(" => ").collect();
                if rename_parts.len() == 2 {
                    files.push(FileChange {
                        path: rename_parts[1].trim().to_string(),
                        added,
                        removed,
                        change_type: "renamed".to_string(),
                        old_path: Some(rename_parts[0].trim().to_string()),
                    });
                    continue;
                }
            }

            // Determine change type (added, deleted, or modified)
            let change_type = if added > 0 && removed == 0 {
                "added".to_string()
            } else if added == 0 && removed > 0 {
                "deleted".to_string()
            } else {
                "modified".to_string()
            };

            files.push(FileChange {
                path: file_info.trim().to_string(),
                added,
                removed,
                change_type,
                old_path: None,
            });
        }
    }

    Ok(files)
}

/// Get unified diff content for a specific file
#[tauri::command]
pub async fn get_git_file_diff(
    project_path: String,
    from_commit: String,
    to_commit: Option<String>,
    file_path: String,
) -> Result<String, String> {
    let to_ref = to_commit.unwrap_or_else(|| "HEAD".to_string());

    // Use git diff to get unified diff for specific file
    let mut cmd = StdCommand::new("git");
    cmd.current_dir(&project_path);
    cmd.args(&[
        "diff",
        &from_commit,
        &to_ref,
        "--",
        &file_path,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get file content at a specific commit
#[tauri::command]
pub async fn get_git_file_at_commit(
    project_path: String,
    commit: String,
    file_path: String,
) -> Result<String, String> {
    // Use git show to get file content at specific commit
    let mut cmd = StdCommand::new("git");
    cmd.current_dir(&project_path);
    cmd.args(&["show", &format!("{}:{}", commit, file_path)]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git show: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // File might not exist at this commit (newly added or deleted)
        if stderr.contains("does not exist") || stderr.contains("exists on disk, but not in") {
            return Ok(String::new());
        }
        return Err(format!("Git show failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
