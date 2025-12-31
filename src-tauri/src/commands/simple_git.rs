use log;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Check if a directory is a Git repository
pub fn is_git_repo(project_path: &str) -> bool {
    Path::new(project_path).join(".git").exists()
}

/// Ensure Git repository exists, initialize if needed
pub fn ensure_git_repo(project_path: &str) -> Result<(), String> {
    // Check if .git exists
    let has_git_dir = is_git_repo(project_path);

    // Check if has commits (HEAD exists)
    let has_commits = has_git_dir && git_current_commit(project_path).is_ok();

    if has_commits {
        log::debug!("Git repository ready at: {}", project_path);
        return Ok(());
    }

    // Need to initialize or create first commit
    if !has_git_dir {
        log::info!("Initializing Git repository at: {}", project_path);

        let mut cmd = Command::new("git");
        cmd.args(["init"]);
        cmd.current_dir(project_path);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let init_output = cmd
            .output()
            .map_err(|e| format!("Failed to init git: {}", e))?;

        if !init_output.status.success() {
            return Err(format!(
                "Git init failed: {}",
                String::from_utf8_lossy(&init_output.stderr)
            ));
        }
    } else {
        log::info!("Git repository exists but has no commits, creating initial commit");
    }

    // Configure Git user if not set (needed for commits)
    let mut config_name = Command::new("git");
    config_name.args(["config", "user.name", "Claude Workbench"]);
    config_name.current_dir(project_path);
    #[cfg(target_os = "windows")]
    config_name.creation_flags(0x08000000);
    let _ = config_name.output();

    let mut config_email = Command::new("git");
    config_email.args(["config", "user.email", "ai@claude.workbench"]);
    config_email.current_dir(project_path);
    #[cfg(target_os = "windows")]
    config_email.creation_flags(0x08000000);
    let _ = config_email.output();

    // CRITICAL: Add all existing files first to preserve user code!
    log::info!("Adding all existing files to git staging area...");
    let mut add_cmd = Command::new("git");
    add_cmd.args(["add", "-A"]);
    add_cmd.current_dir(project_path);
    #[cfg(target_os = "windows")]
    add_cmd.creation_flags(0x08000000);

    let add_output = add_cmd
        .output()
        .map_err(|e| format!("Failed to add files: {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        log::warn!("Git add warning: {}", stderr);
        // Continue anyway, might just be no files to add
    }

    // Create initial commit with all current files
    // Use --allow-empty as fallback in case there are no files
    let mut commit_cmd = Command::new("git");
    commit_cmd.args([
        "commit",
        "--allow-empty",
        "-m",
        "[Claude Workbench] Initial commit - preserving existing code",
    ]);
    commit_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    commit_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let commit_output = commit_cmd
        .output()
        .map_err(|e| format!("Failed to create initial commit: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        log::error!("Git commit failed: {}", stderr);
        return Err(format!("Failed to create initial commit: {}", stderr));
    }

    log::info!("Git repository initialized successfully with initial commit (all existing files preserved)");
    Ok(())
}

/// Get current HEAD commit hash
pub fn git_current_commit(project_path: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(["rev-parse", "HEAD"]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get current commit: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git rev-parse failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let commit = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in commit hash: {}", e))?
        .trim()
        .to_string();

    Ok(commit)
}

/// Commit all changes with a message
/// Returns: Ok(true) if committed, Ok(false) if no changes, Err if failed
pub fn git_commit_changes(project_path: &str, message: &str) -> Result<bool, String> {
    // Stage all changes
    let mut add_cmd = Command::new("git");
    add_cmd.args(["add", "-A"]);
    add_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    add_cmd.creation_flags(0x08000000);

    let add_output = add_cmd
        .output()
        .map_err(|e| format!("Failed to git add: {}", e))?;

    if !add_output.status.success() {
        return Err(format!(
            "Git add failed: {}",
            String::from_utf8_lossy(&add_output.stderr)
        ));
    }

    // Commit changes (always create a commit, even if empty)
    let mut commit_cmd = Command::new("git");
    commit_cmd.args(["commit", "--allow-empty", "-m", message]);
    commit_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    commit_cmd.creation_flags(0x08000000);

    let commit_output = commit_cmd
        .output()
        .map_err(|e| format!("Failed to git commit: {}", e))?;

    if !commit_output.status.success() {
        return Err(format!(
            "Git commit failed: {}",
            String::from_utf8_lossy(&commit_output.stderr)
        ));
    }

    log::info!("Committed changes: {}", message);
    Ok(true)
}

/// Check if two commits have different tree contents
/// Returns Ok(true) if there are changes, Ok(false) if trees are identical
pub fn git_has_changes_between_commits(
    project_path: &str,
    commit_before: &str,
    commit_after: &str,
) -> Result<bool, String> {
    let mut diff_cmd = Command::new("git");
    diff_cmd.args(["diff", "--quiet", commit_before, commit_after]);
    diff_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    diff_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let diff_output = diff_cmd
        .output()
        .map_err(|e| format!("Failed to diff commits: {}", e))?;

    if diff_output.status.success() {
        return Ok(false);
    }

    if diff_output.status.code() == Some(1) {
        return Ok(true);
    }

    Err(format!(
        "Git diff failed: {}",
        String::from_utf8_lossy(&diff_output.stderr)
    ))
}

/// Reset repository to a specific commit
/// ⚠️ DEPRECATED: Use git_revert_range for precise rollback instead
/// This function will lose all commits after the target commit!
pub fn git_reset_hard(project_path: &str, commit: &str) -> Result<(), String> {
    log::info!("Resetting repository to commit: {}", commit);

    let mut cmd = Command::new("git");
    cmd.args(["reset", "--hard", commit]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to reset: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git reset failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    log::info!("Successfully reset to commit: {}", commit);
    Ok(())
}

// ============================================================================
// Precise Revert (精准撤回 - 只撤销指定范围的提交，保留其他更改)
// ============================================================================

/// Result of a precise revert operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevertResult {
    /// Whether the revert was successful
    pub success: bool,
    /// Number of commits reverted
    pub commits_reverted: usize,
    /// The new commit hash after revert (if a revert commit was created)
    pub new_commit: Option<String>,
    /// Message describing what happened
    pub message: String,
    /// Whether there were conflicts that need manual resolution
    pub has_conflicts: bool,
}

/// Precisely revert a range of commits with automatic retry on lock conflicts
///
/// This function wraps git_revert_range with retry logic to handle Git lock conflicts
/// (e.g., index.lock, refs.lock) that can occur during rapid consecutive operations.
///
/// Parameters:
/// - max_retries: Maximum number of retry attempts (recommended: 3)
/// - Retry delays: 100ms, 200ms, 300ms (exponential backoff)
///
/// Returns:
/// - Ok(RevertResult) if successful (either immediately or after retries)
/// - Err(String) if all retries are exhausted or non-lock errors occur
pub fn git_revert_range_with_retry(
    project_path: &str,
    commit_before: &str,
    commit_after: &str,
    message: &str,
    max_retries: u32,
) -> Result<RevertResult, String> {
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        match git_revert_range(project_path, commit_before, commit_after, message) {
            Ok(result) => {
                if attempt > 0 {
                    log::info!(
                        "[Retry Success] Git revert succeeded on attempt {}/{}",
                        attempt + 1,
                        max_retries
                    );
                }
                return Ok(result);
            }
            Err(e) => {
                last_error = e.clone();

                // Check if it's a lock-related error
                let is_lock_error = e.contains("index.lock")
                    || e.contains("Unable to create")
                    || e.contains("Another git process")
                    || e.contains("refs.lock")
                    || e.contains("locked");

                if is_lock_error && attempt < max_retries - 1 {
                    // Exponential backoff: 100ms, 200ms, 300ms
                    let wait_ms = 100 * (attempt as u64 + 1);
                    log::warn!(
                        "[Retry {}/{}] Git lock detected, waiting {}ms before retry. Error: {}",
                        attempt + 1,
                        max_retries,
                        wait_ms,
                        e.lines().next().unwrap_or("unknown")
                    );
                    std::thread::sleep(std::time::Duration::from_millis(wait_ms));
                    continue;
                }

                // Non-lock error or retries exhausted
                if is_lock_error && attempt == max_retries - 1 {
                    log::error!(
                        "[Retry Failed] Git lock persists after {} attempts",
                        max_retries
                    );
                }

                return Err(e);
            }
        }
    }

    Err(format!(
        "Git revert 在 {} 次重试后仍失败: {}",
        max_retries,
        last_error
    ))
}

/// Precisely revert a range of commits (commit_before..commit_after)
/// This ONLY undoes changes from the specified range, preserving all other commits
///
/// Unlike git_reset_hard which loses all commits after the target,
/// this creates a new revert commit that only undoes the specific changes.
///
/// Example:
///   History: A -> B -> C -> D -> E (HEAD)
///   If we want to revert changes from B..C (prompt #1):
///   - git_reset_hard("B") would lose C, D, E
///   - git_revert_range("B", "C") creates: A -> B -> C -> D -> E -> R (HEAD)
///     where R only undoes changes between B and C, keeping D and E intact
///
/// Note: For better reliability in rapid consecutive operations, consider using
/// git_revert_range_with_retry instead.
pub fn git_revert_range(
    project_path: &str,
    commit_before: &str,
    commit_after: &str,
    message: &str,
) -> Result<RevertResult, String> {
    log::info!(
        "[Precise Revert] Reverting range {}..{} in {}",
        &commit_before[..8.min(commit_before.len())],
        &commit_after[..8.min(commit_after.len())],
        project_path
    );

    // Check if commit_before and commit_after are the same (no changes to revert)
    if commit_before == commit_after {
        log::info!("[Precise Revert] No changes to revert (same commit)");
        return Ok(RevertResult {
            success: true,
            commits_reverted: 0,
            new_commit: None,
            message: "没有代码更改需要撤回".to_string(),
            has_conflicts: false,
        });
    }

    // Count commits in range
    let commit_count = git_commit_count_between(project_path, commit_before, commit_after)
        .unwrap_or(1);

    log::info!(
        "[Precise Revert] Found {} commits in range to revert",
        commit_count
    );

    // Try to revert the range
    // Using --no-commit to stage all reverts, then commit once
    // Using --no-merges to skip merge commits (they require -m parameter which is ambiguous)
    let mut revert_cmd = Command::new("git");
    revert_cmd.args([
        "revert",
        "--no-commit",
        "--no-merges", // Skip merge commits to avoid "commit is a merge but no -m option" error
        &format!("{}..{}", commit_before, commit_after),
    ]);
    revert_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    revert_cmd.creation_flags(0x08000000);

    let revert_output = revert_cmd
        .output()
        .map_err(|e| format!("Failed to execute git revert: {}", e))?;

    // Check for conflicts
    if !revert_output.status.success() {
        let stderr = String::from_utf8_lossy(&revert_output.stderr);

        // Check if it's a conflict error
        if stderr.contains("conflict") || stderr.contains("CONFLICT") {
            log::warn!("[Precise Revert] Conflicts detected, attempting to abort");

            // Abort the revert
            let mut abort_cmd = Command::new("git");
            abort_cmd.args(["revert", "--abort"]);
            abort_cmd.current_dir(project_path);
            #[cfg(target_os = "windows")]
            abort_cmd.creation_flags(0x08000000);
            let _ = abort_cmd.output();

            return Ok(RevertResult {
                success: false,
                commits_reverted: 0,
                new_commit: None,
                message: format!(
                    "撤回时发生冲突，无法自动完成。建议手动处理或使用'仅删除对话'模式。\n详情: {}",
                    stderr.lines().take(3).collect::<Vec<_>>().join("\n")
                ),
                has_conflicts: true,
            });
        }

        // Other error
        return Err(format!("Git revert failed: {}", stderr));
    }

    // Check if there are staged changes to commit
    let mut status_cmd = Command::new("git");
    status_cmd.args(["status", "--porcelain"]);
    status_cmd.current_dir(project_path);
    #[cfg(target_os = "windows")]
    status_cmd.creation_flags(0x08000000);

    let status_output = status_cmd
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;

    let has_changes = !String::from_utf8_lossy(&status_output.stdout)
        .trim()
        .is_empty();

    if !has_changes {
        log::info!("[Precise Revert] No changes after revert (already at target state)");
        return Ok(RevertResult {
            success: true,
            commits_reverted: commit_count,
            new_commit: None,
            message: "代码已经处于目标状态，无需更改".to_string(),
            has_conflicts: false,
        });
    }

    // Commit the reverted changes
    let mut commit_cmd = Command::new("git");
    commit_cmd.args(["commit", "-m", message]);
    commit_cmd.current_dir(project_path);
    #[cfg(target_os = "windows")]
    commit_cmd.creation_flags(0x08000000);

    let commit_output = commit_cmd
        .output()
        .map_err(|e| format!("Failed to commit revert: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        return Err(format!("Failed to commit revert: {}", stderr));
    }

    // Get the new commit hash
    let new_commit = git_current_commit(project_path).ok();

    log::info!(
        "[Precise Revert] Successfully reverted {} commits, new commit: {:?}",
        commit_count,
        new_commit.as_ref().map(|c| &c[..8.min(c.len())])
    );

    Ok(RevertResult {
        success: true,
        commits_reverted: commit_count,
        new_commit,
        message: format!("成功撤回 {} 个提交的代码更改", commit_count),
        has_conflicts: false,
    })
}

/// Tauri command wrapper for precise revert
#[tauri::command]
pub fn precise_revert_code(
    project_path: String,
    commit_before: String,
    commit_after: String,
    prompt_index: usize,
) -> Result<RevertResult, String> {
    let message = format!(
        "[Revert] 撤回提示词 #{} 的代码更改 ({}..{})",
        prompt_index,
        &commit_before[..8.min(commit_before.len())],
        &commit_after[..8.min(commit_after.len())]
    );

    git_revert_range(&project_path, &commit_before, &commit_after, &message)
}

/// Save uncommitted changes to stash
pub fn git_stash_save(project_path: &str, message: &str) -> Result<(), String> {
    // Check if there are uncommitted changes
    let mut status_cmd = Command::new("git");
    status_cmd.args(["status", "--porcelain"]);
    status_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    status_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let status_output = status_cmd
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;

    if status_output.stdout.is_empty() {
        log::debug!("No uncommitted changes to stash");
        return Ok(()); // No changes to stash
    }

    log::info!("Stashing uncommitted changes: {}", message);

    let mut stash_cmd = Command::new("git");
    stash_cmd.args(["stash", "save", "-u", message]);
    stash_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    stash_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = stash_cmd
        .output()
        .map_err(|e| format!("Failed to stash: {}", e))?;

    if !output.status.success() {
        log::warn!(
            "Git stash warning: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    Ok(())
}

/// Tauri command: Check and initialize Git repository
#[tauri::command]
pub fn check_and_init_git(project_path: String) -> Result<bool, String> {
    let was_not_initialized = !is_git_repo(&project_path);

    // Always call ensure_git_repo - it will check for commits too
    ensure_git_repo(&project_path)?;

    Ok(was_not_initialized)
}

// ============================================================================
// Reset Safety Check (防止撤回到错误的版本)
// ============================================================================

use serde::{Deserialize, Serialize};

/// Information about the safety of a git reset operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetSafetyInfo {
    /// Number of commits that will be lost
    pub commits_to_lose: usize,
    /// Whether there are commits from other engines (Claude/Codex/Gemini)
    pub has_other_engine_commits: bool,
    /// Whether there are user manual commits
    pub has_user_commits: bool,
    /// List of commit summaries that will be lost
    pub commits_summary: Vec<String>,
    /// Whether it's safe to proceed without warning
    pub safe_to_proceed: bool,
    /// Warning message if not safe
    pub warning: Option<String>,
}

/// Count commits between two references
pub fn git_commit_count_between(
    project_path: &str,
    from_commit: &str,
    to_commit: &str,
) -> Result<usize, String> {
    let mut cmd = Command::new("git");
    cmd.args(["rev-list", "--count", &format!("{}..{}", from_commit, to_commit)]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to count commits: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git rev-list failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let count_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    count_str
        .parse::<usize>()
        .map_err(|e| format!("Failed to parse commit count: {}", e))
}

/// Get commit messages between two references
pub fn git_log_between(
    project_path: &str,
    from_commit: &str,
    to_commit: &str,
) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("git");
    cmd.args([
        "log",
        "--oneline",
        "--format=%s",
        &format!("{}..{}", from_commit, to_commit),
    ]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get git log: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git log failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let log_str = String::from_utf8_lossy(&output.stdout);
    let messages: Vec<String> = log_str
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    Ok(messages)
}

/// Check if a reset operation is safe
/// This prevents accidentally reverting to a much older version when
/// multiple engines or user manual commits are involved
#[tauri::command]
pub fn check_reset_safety(
    project_path: String,
    target_commit: String,
    current_engine: String,
) -> Result<ResetSafetyInfo, String> {
    log::info!(
        "[Reset Safety] Checking safety for reset to {} (engine: {})",
        &target_commit[..8.min(target_commit.len())],
        current_engine
    );

    let current_head = git_current_commit(&project_path)?;

    // If target is same as HEAD, it's safe
    if current_head == target_commit {
        return Ok(ResetSafetyInfo {
            commits_to_lose: 0,
            has_other_engine_commits: false,
            has_user_commits: false,
            commits_summary: vec![],
            safe_to_proceed: true,
            warning: None,
        });
    }

    // Count commits between target and HEAD
    let commits_to_lose = git_commit_count_between(&project_path, &target_commit, &current_head)?;

    // Get commit messages to analyze
    let commits_summary = git_log_between(&project_path, &target_commit, &current_head)?;

    // Analyze commits for other engines and user commits
    let mut has_other_engine_commits = false;
    let mut has_user_commits = false;
    let mut other_engine_count = 0;
    let mut user_commit_count = 0;

    for msg in &commits_summary {
        let msg_lower = msg.to_lowercase();

        // Check for other engine commits
        let is_claude = msg.contains("[Claude") || msg.contains("[Claude Code]");
        let is_codex = msg.contains("[Codex]");
        let is_gemini = msg.contains("[Gemini]");
        let is_workbench = msg.contains("[Claude Workbench]");

        let is_current_engine = match current_engine.as_str() {
            "claude" => is_claude || is_workbench,
            "codex" => is_codex,
            "gemini" => is_gemini,
            _ => false,
        };

        let is_any_engine = is_claude || is_codex || is_gemini || is_workbench;

        if is_any_engine && !is_current_engine {
            has_other_engine_commits = true;
            other_engine_count += 1;
        }

        // Check for user commits (no engine marker)
        if !is_any_engine && !msg_lower.contains("merge") {
            has_user_commits = true;
            user_commit_count += 1;
        }
    }

    // Determine if safe to proceed
    let safe_to_proceed = !has_other_engine_commits && !has_user_commits && commits_to_lose <= 5;

    // Generate warning message
    let warning = if !safe_to_proceed {
        let mut warnings = vec![];

        if has_other_engine_commits {
            warnings.push(format!(
                "检测到 {} 个来自其他引擎的提交将被丢失",
                other_engine_count
            ));
        }

        if has_user_commits {
            warnings.push(format!(
                "检测到 {} 个用户手动提交将被丢失",
                user_commit_count
            ));
        }

        if commits_to_lose > 5 && !has_other_engine_commits && !has_user_commits {
            warnings.push(format!(
                "将丢失 {} 个提交，这可能会回滚较多代码更改",
                commits_to_lose
            ));
        }

        Some(warnings.join("；"))
    } else {
        None
    };

    log::info!(
        "[Reset Safety] Result: commits_to_lose={}, other_engine={}, user_commits={}, safe={}",
        commits_to_lose,
        has_other_engine_commits,
        has_user_commits,
        safe_to_proceed
    );

    Ok(ResetSafetyInfo {
        commits_to_lose,
        has_other_engine_commits,
        has_user_commits,
        commits_summary: commits_summary.into_iter().take(10).collect(), // Limit to 10 for display
        safe_to_proceed,
        warning,
    })
}

