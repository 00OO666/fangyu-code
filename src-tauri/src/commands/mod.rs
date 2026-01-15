pub mod acemcp;
pub mod auto_update; // 自动更新系统
pub mod background_task_manager; // 后台任务系统 - Cursor/Windsurf风格
pub mod chat_history; // 聊天历史回溯 - 语义搜索历史对话
pub mod checkpoint_manager; // Checkpoint 检查点系统
pub mod config_manager; // 配置管理中心 - 全局管控配置
pub mod devtools; // 开发者工具 - F12 打开控制台
pub mod diagnostics; // 诊断工具 - 检查配置健全性、Token消耗优化
pub mod docker; // Docker 容器管理 - 沙箱环境
pub mod parallel_agents; // 并行代理系统 - Claude Code Task风格
pub mod path_validator; // 🔒 路径验证器 - 防止路径遍历攻击
pub mod claude;
pub mod kiro; // Kiro CLI 集成 - 第五引擎
pub mod clipboard;
pub mod codex; // OpenAI Codex integration
pub mod context_commands;
pub mod context_manager;
pub mod enhanced_hooks;
pub mod extensions;
pub mod file_operations;
pub mod gemini; // Google Gemini CLI integration
pub mod git_stats;
pub mod llm; // LLM 文本生成 - 用于摘要、翻译等
pub mod lsp; // Language Server Protocol 集成
pub mod mcp;
pub mod permission_config;
pub mod prompt_tracker;
pub mod provider;
pub mod secure_storage; // 安全存储 - API 密钥加密存储
pub mod session_continue; // 智能会话续接 - 自动创建新会话并注入摘要
pub mod simple_git;
pub mod smart_project; // 智能项目管理 - 自动创建/命名项目
pub mod storage;
pub mod super_agent; // Super AI Agent Desktop - 统一 Agent 系统
pub mod translator;
pub mod url_utils; // API URL 规范化工具
pub mod usage;
pub mod window; // 多窗口管理
pub mod window_attention; // 窗口注意力机制 - 后台窗口保活
pub mod wsl_utils; // WSL 兼容性工具
