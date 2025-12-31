pub mod acemcp;
pub mod auto_update; // 自动更新系统
pub mod background_task_manager; // 后台任务系统 - Cursor/Windsurf风格
pub mod checkpoint_manager; // Checkpoint 检查点系统
pub mod config_manager; // 配置管理中心 - 全局管控配置
pub mod devtools; // 开发者工具 - F12 打开控制台
pub mod diagnostics; // 诊断工具 - 检查配置健全性、Token消耗优化
pub mod parallel_agents; // 并行代理系统 - Claude Code Task风格
pub mod claude;
pub mod clipboard;
pub mod codex; // OpenAI Codex integration
pub mod context_commands;
pub mod context_manager;
pub mod enhanced_hooks;
pub mod extensions;
pub mod file_operations;
pub mod gemini; // Google Gemini CLI integration
pub mod git_stats;
pub mod mcp;
pub mod permission_config;
pub mod prompt_tracker;
pub mod provider;
pub mod session_continue; // 智能会话续接 - 自动创建新会话并注入摘要
pub mod simple_git;
pub mod smart_project; // 智能项目管理 - 自动创建/命名项目
pub mod storage;
pub mod translator;
pub mod url_utils; // API URL 规范化工具
pub mod usage;
pub mod window; // 多窗口管理
pub mod wsl_utils; // WSL 兼容性工具
