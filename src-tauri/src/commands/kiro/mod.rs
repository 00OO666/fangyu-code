//! Kiro 集成模块
//! 
//! 支持两种模式：
//! 1. Kiro CLI - 通过 WSL 调用（Windows），使用 OAuth 认证
//! 2. Kiro API - 直接调用 Amazon Q Developer API（推荐）
//! 
//! 特点：
//! - 无需 API Key（使用 OAuth / SSO Token）
//! - 支持 Claude Opus/Sonnet/Haiku 模型
//! - 流式输出支持

pub mod cli_runner;
pub mod api_client;

// CLI 模式导出
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

// API 模式导出
pub use api_client::{
    read_kiro_token,
    get_kiro_token_status,
    send_kiro_request,
    parse_kiro_sse_response,
    kiro_chat,
    KiroToken,
    KiroTokenStatus,
    KiroApiResponse,
};
