/**
 * OpenAI Codex Integration - Backend Commands
 *
 * This module provides Tauri commands for executing Codex tasks,
 * managing sessions, and handling configuration.
 *
 * Module Structure:
 * - session.rs: Session lifecycle management (execute, resume, cancel, list, delete)
 * - git_ops.rs: Git operations for rewind functionality (records, truncate, revert)
 * - config.rs: Configuration management (availability, paths, mode, providers)
 */
pub mod config;
pub mod git_ops;
pub mod session;
pub mod session_converter;
pub mod usage;

// ============================================================================
// Re-export Types (allow unused for API compatibility)
// ============================================================================

// Session types
#[allow(unused_imports)]
pub use session::{CodexExecutionMode, CodexExecutionOptions, CodexProcessState, CodexSession};

// Git operations types
#[allow(unused_imports)]
pub use git_ops::{CodexGitRecords, CodexPromptGitRecord, CodexPromptRecord, PromptRecord};

// Config types
#[allow(unused_imports)]
pub use config::{CodexAvailability, CodexModeInfo, CodexProviderConfig, CurrentCodexConfig};

// Session converter types
#[allow(unused_imports)]
pub use session_converter::{ConversionResult, ConversionSource};

// ============================================================================
// Re-export Tauri Commands - Session Management
// ============================================================================

pub use session::{
    cancel_codex, delete_codex_session, execute_codex, list_codex_sessions,
    load_codex_session_history, resume_codex, resume_last_codex,
};

// ============================================================================
// Re-export Tauri Commands - Git Operations / Rewind
// ============================================================================

pub use git_ops::{
    check_codex_rewind_capabilities, get_codex_prompt_list, record_codex_prompt_completed,
    record_codex_prompt_sent, revert_codex_to_prompt,
};

// ============================================================================
// Re-export Tauri Commands - Configuration
// ============================================================================

pub use config::{
    check_codex_availability, clear_custom_codex_path, get_codex_mode_config, get_codex_path,
    set_codex_mode_config, set_custom_codex_path, validate_codex_path_cmd,
};

// ============================================================================
// Re-export Tauri Commands - Provider Management
// ============================================================================

pub use config::{
    add_codex_provider_config, clear_codex_provider_config, delete_codex_provider_config,
    get_codex_provider_presets, get_current_codex_config, switch_codex_provider,
    test_codex_provider_connection, update_codex_provider_config, update_codex_reasoning_level,
};

// ============================================================================
// Re-export Tauri Commands - Session Conversion
// ============================================================================

pub use session_converter::{convert_claude_to_codex, convert_codex_to_claude, convert_session};

// ============================================================================
// Re-export Helper Functions (for internal use by submodules)
// ============================================================================

#[allow(unused_imports)]
pub use config::{get_codex_command_candidates, get_codex_sessions_dir};

#[allow(unused_imports)]
pub use session::{find_session_file, parse_codex_session_file};

#[allow(unused_imports)]
pub use git_ops::{
    extract_codex_prompts, get_codex_git_records_dir, load_codex_git_records,
    save_codex_git_records, truncate_codex_git_records, truncate_codex_session_to_prompt,
};

// ============================================================================
// Re-export Tauri Commands - Usage Statistics
// ============================================================================

pub use usage::get_codex_usage_stats;

// Usage types
#[allow(unused_imports)]
pub use usage::{CodexDailyUsage, CodexModelUsage, CodexProjectUsage, CodexSessionUsage, CodexUsageStats};
