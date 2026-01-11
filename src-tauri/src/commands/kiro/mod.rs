//! Kiro CLI 集成模块
//! 
//! 将 Kiro CLI 作为第五引擎集成到 Fangyu Code
//! Kiro CLI 通过 WSL 调用，使用 OAuth 认证（Builder ID）
//! 
//! 特点：
//! - 无需 API Key（使用 OAuth）
//! - 支持 Claude Opus/Sonnet/Haiku 模型
//! - 通过 WSL 调用（Windows）
//! - 流式输出支持

pub mod cli_runner;

pub use cli_runner::{
    check_kiro_cli_installed,
    check_kiro_cli_logged_in,
    get_kiro_cli_version,
    get_kiro_models,
    execute_kiro_chat,
    cancel_kiro_execution,
    open_kiro_login,
    KiroProcessState,
};
