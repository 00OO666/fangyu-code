/**
 * LSP Module - Language Server Protocol 集成
 *
 * 提供完整的 LSP 支持，包括：
 * - 进程管理
 * - 协议通信
 * - 命令接口
 */

pub mod manager;

pub use manager::{LSPProcessManager, LSPManagerConfig, ServerInfo};
