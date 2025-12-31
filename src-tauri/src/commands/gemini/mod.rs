//! Gemini CLI Integration Module
//!
//! This module provides integration with Google's Gemini CLI,
//! enabling AI-powered code assistance using Gemini models.
//!
//! ## Features
//!
//! - **Session Management**: Execute, cancel, and track Gemini sessions
//! - **Streaming Output**: Real-time JSONL event streaming via stream-json format
//! - **Unified Messages**: Converts Gemini events to ClaudeStreamMessage format
//! - **Multi-Auth Support**: Google OAuth, API Key, and Vertex AI authentication

pub mod config;
pub mod git_ops;
pub mod parser;
pub mod provider;
pub mod session;
pub mod types;
pub mod usage;

// Re-export process state for main.rs
pub use types::GeminiProcessState;

// Re-export Tauri commands
pub use config::{
    delete_gemini_session,
    get_gemini_config,
    get_gemini_models,
    get_gemini_session_detail,
    // Session history commands
    get_gemini_session_logs,
    // System prompt commands
    get_gemini_system_prompt,
    // WSL configuration commands
    get_gemini_wsl_mode_config,
    list_gemini_sessions,
    save_gemini_system_prompt,
    set_gemini_wsl_mode_config,
    update_gemini_config,
};
pub use session::{cancel_gemini, check_gemini_installed, execute_gemini};

// Re-export Gemini Rewind commands
pub use git_ops::{
    check_gemini_rewind_capabilities, get_gemini_prompt_list, record_gemini_prompt_completed,
    record_gemini_prompt_sent, revert_gemini_to_prompt,
};

// Re-export Gemini Provider commands
pub use provider::{
    add_gemini_provider_config, clear_gemini_provider_config, delete_gemini_provider_config,
    get_current_gemini_provider_config, get_gemini_provider_presets, switch_gemini_provider,
    test_gemini_provider_connection, update_gemini_provider_config,
};

// Re-export Gemini Usage Statistics commands
pub use usage::get_gemini_usage_stats;

// Usage types
#[allow(unused_imports)]
pub use usage::{GeminiDailyUsage, GeminiModelUsage, GeminiProjectUsage, GeminiSessionUsage, GeminiUsageStats};
