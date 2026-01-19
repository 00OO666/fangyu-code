// Prevents additional console window on Windows, DO NOT REMOVE!!
// 在 debug 和 release 模式都隐藏控制台窗口
#![windows_subsystem = "windows"]

mod claude_binary;
mod commands;
mod lsp; // LSP 模块
mod process;
mod utils; // 新增：通用工具模块
mod memory_index; // 智能记忆导入功能

// MCP 多应用支持模块
mod mcp;
mod claude_mcp;
mod codex_mcp;
mod gemini_mcp;

use claude_binary::init_shell_environment;

use std::sync::{Arc, Mutex};

use commands::acemcp::{
    enhance_prompt_with_context, export_acemcp_sidecar, get_extracted_sidecar_path,
    load_acemcp_config, preindex_project, save_acemcp_config, test_acemcp_availability,
};
use commands::devtools::{open_devtools, close_devtools, is_devtools_open};
use commands::diagnostics::{run_diagnostics, fix_all_issues, fix_issue};
use commands::claude::{
    cancel_claude_execution, check_claude_version, clear_custom_claude_path, continue_claude_code,
    delete_project, delete_project_permanently, delete_session, delete_sessions_batch, delete_sessions_by_pattern,
    execute_claude_code, find_claude_md_files, get_available_tools, get_claude_execution_config,
    get_claude_path, get_claude_permission_config, get_claude_session_output, get_claude_settings,
    get_codex_system_prompt, get_hooks_config, get_active_hooks, get_permission_presets, get_project_sessions,
    get_system_prompt, list_directory_contents, list_hidden_projects, list_projects,
    list_hook_files, list_running_claude_sessions, load_session_history, open_new_session, read_claude_md_file,
    reset_claude_execution_config, restore_project, resume_claude_code, save_claude_md_file,
    save_claude_settings, save_codex_system_prompt, save_system_prompt, search_files,
    set_custom_claude_path, toggle_hook_file, update_claude_execution_config, update_claude_permission_config,
    update_hooks_config, update_thinking_mode, validate_hook_command, validate_permission_config,
    // Claude WSL mode configuration
    get_claude_wsl_mode_config, set_claude_wsl_mode_config,
    // 配置同步命令
    sync_claude_json_to_settings, sync_settings_to_claude_json, toggle_mcp_server_unified,
    get_mcp_sync_status, full_sync_mcp_configs,
    ClaudeProcessState,
};
use commands::mcp::{
    mcp_add, mcp_add_from_claude_desktop, mcp_add_json, mcp_export_config, mcp_get,
    mcp_get_server_status, mcp_list, mcp_read_project_config, mcp_remove,
    mcp_reset_project_choices, mcp_save_project_config, mcp_serve, mcp_test_connection,
    // 多应用 MCP 支持（新增）
    mcp_get_claude_status, mcp_upsert_server, mcp_delete_server, mcp_toggle_app,
    mcp_import_from_app, mcp_validate_command, mcp_read_claude_config, mcp_get_all_servers,
    mcp_get_unified_servers,
    // 多引擎独立隔离控制 API（新设计）
    mcp_get_engine_servers, mcp_upsert_engine_server, mcp_delete_engine_server,
    mcp_toggle_engine_server, mcp_get_engine_servers_with_status,
};
use commands::storage::{init_database, AgentDb};
use commands::chat_history::{
    delete_chat_session, get_chat_history_stats, get_recent_sessions,
    get_session_messages, init_chat_history_db, save_chat_message, search_chat_history,
    update_session_title, ChatHistoryDb,
};

use commands::clipboard::{read_from_clipboard, save_clipboard_image, write_to_clipboard};
use commands::config_manager::{
    backup_config, clean_old_cache, clean_project_cache, get_config_health, get_config_items,
    get_projects_cache, toggle_config_item,
};
use commands::prompt_tracker::{
    check_rewind_capabilities, get_prompt_list, get_unified_prompt_list, mark_prompt_completed,
    record_prompt_sent, revert_to_prompt,
};
use commands::provider::{
    add_provider_config, clear_provider_config, delete_provider_config,
    get_current_provider_config, get_provider_config, get_provider_presets, query_provider_usage,
    save_claude_env_vars, switch_provider_config, test_provider_connection, update_provider_config,
};
use commands::simple_git::{
    check_and_init_git, check_reset_safety, precise_revert_code,
    // Git Panel Commands
    git_status, git_log, git_diff, git_reset, git_revert_commit, git_restore,
    git_create_backup_branch, git_add, git_commit,
};
use commands::storage::{
    storage_analyze_query, storage_delete_row, storage_execute_sql, storage_get_performance_stats,
    storage_insert_row, storage_list_tables, storage_read_table, storage_reset_database,
    storage_update_row,
};
use commands::translator::{
    clear_translation_cache, detect_text_language, get_translation_cache_stats,
    get_translation_config, init_translation_service_command, translate, translate_batch,
    update_translation_config,
};
use commands::usage::{get_session_stats, get_usage_by_date_range, get_usage_stats};
use commands::window::{
    broadcast_to_session_windows, close_session_window, create_session_window, emit_to_window,
    focus_session_window, list_session_windows, set_titlebar_theme,
};
use commands::window_attention::{
    register_window, update_window_visibility, update_window_focus,
    delegate_task_to_active_window, report_delegated_task_completion,
    WindowRegistryState,
};

use memory_index::{detect_memory_keywords, import_memories};

use commands::codex::{
    add_codex_provider_config,
    cancel_codex,
    check_codex_availability,
    check_codex_rewind_capabilities,
    clear_codex_provider_config,
    clear_custom_codex_path,
    convert_claude_to_codex,
    convert_codex_to_claude,
    // Session conversion
    convert_session,
    delete_codex_provider_config,
    delete_codex_session,
    execute_codex,
    // Codex mode configuration
    get_codex_mode_config,
    get_codex_path,
    get_codex_prompt_list,
    // Codex provider management
    get_codex_provider_presets,
    // Codex usage statistics
    get_codex_usage_stats,
    get_current_codex_config,
    list_codex_sessions,
    load_codex_session_history,
    record_codex_prompt_completed,
    // Codex rewind commands
    record_codex_prompt_sent,
    resume_codex,
    resume_last_codex,
    revert_codex_to_prompt,
    set_codex_mode_config,
    set_custom_codex_path,
    switch_codex_provider,
    test_codex_provider_connection,
    update_codex_provider_config,
    update_codex_reasoning_level,
    validate_codex_path_cmd,
    CodexProcessState,
};
use commands::enhanced_hooks::{
    execute_pre_commit_review, test_hook_condition, trigger_hook_event,
};
use commands::extensions::{
    create_skill, create_subagent, list_agent_skills, list_custom_slash_commands,
    list_gemini_custom_slash_commands, list_plugins, list_subagents, open_agents_directory,
    open_commands_directory, open_plugins_directory, open_skills_directory, read_skill,
    read_subagent, toggle_skill,
};
use commands::file_operations::{open_directory_in_explorer, open_file_with_default_app};
use commands::gemini::{
    add_gemini_provider_config,
    cancel_gemini,
    check_gemini_installed,
    check_gemini_rewind_capabilities,
    clear_gemini_provider_config,
    delete_gemini_provider_config,
    delete_gemini_session,
    execute_gemini,
    get_current_gemini_provider_config,
    get_gemini_config,
    get_gemini_models,
    // Gemini Rewind commands
    get_gemini_prompt_list,
    // Gemini Provider commands
    get_gemini_provider_presets,
    get_gemini_session_detail,
    get_gemini_session_logs,
    get_gemini_system_prompt,
    // Gemini Usage Statistics
    get_gemini_usage_stats,
    // Gemini WSL commands
    get_gemini_wsl_mode_config,
    list_gemini_sessions,
    record_gemini_prompt_completed,
    record_gemini_prompt_sent,
    revert_gemini_to_prompt,
    save_gemini_system_prompt,
    set_gemini_wsl_mode_config,
    switch_gemini_provider,
    test_gemini_provider_connection,
    update_gemini_config,
    update_gemini_provider_config,
    GeminiProcessState,
};
// Kiro CLI Integration (第五引擎)
use commands::kiro::{
    check_kiro_cli_installed,
    check_kiro_cli_logged_in,
    get_kiro_cli_version,
    get_kiro_models,
    execute_kiro_chat,
    cancel_kiro_execution,
    open_kiro_login,
    KiroProcessState,
    // Kiro API 模式（直接调用 Amazon Q API）
    read_kiro_token,
    get_kiro_token_status,
    send_kiro_request,
    parse_kiro_sse_response,
    kiro_chat,
};
use commands::checkpoint_manager::{
    create_checkpoint, delete_checkpoint, delete_session_checkpoints, get_latest_checkpoint,
    init_checkpoint_manager, list_checkpoints, restore_checkpoint, GlobalCheckpointManager,
};
use commands::background_task_manager::{
    cancel_background_task, cleanup_completed_tasks, complete_background_task,
    create_background_task, delete_background_task, get_background_task, get_next_pending_task,
    get_task_stats, init_task_manager, list_background_tasks, pause_background_task,
    resume_background_task, retry_background_task, start_background_task, update_task_progress,
    GlobalTaskManager,
};
use commands::parallel_agents::{
    add_parallel_agent, add_parallel_task, complete_parallel_task, create_parallel_group,
    delete_parallel_group, fail_parallel_task, get_group_stats, get_parallel_group,
    init_parallel_agent_manager, list_session_groups, lock_resource, send_agent_message,
    start_parallel_group, unlock_resource, GlobalParallelAgentManager,
};
use commands::git_stats::{
    get_git_changed_files, get_git_diff_stats, get_git_file_at_commit, get_git_file_diff,
    get_session_code_changes,
};
use commands::smart_project::{
    create_project_claude_md, create_smart_project, generate_session_title, rename_smart_project,
};
use process::ProcessRegistryState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::Builder as WindowStatePlugin;

fn main() {
    // Initialize logger
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            // ⚠️ 窗口状态插件会保存所有窗口，需要在窗口创建时手动管理 session 窗口的状态
            WindowStatePlugin::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        )
        .setup(|app| {
            // Initialize shell environment for macOS GUI applications
            // This must be done early to ensure CLI tools (claude, codex, etc.) can be found
            init_shell_environment();

            // Initialize database for storage operations
            let conn = init_database(&app.handle()).expect("Failed to initialize database");
            app.manage(AgentDb(Mutex::new(conn)));

            // Initialize chat history database for semantic search
            let history_conn = init_chat_history_db(&app.handle()).expect("Failed to initialize chat history database");
            app.manage(ChatHistoryDb(Mutex::new(history_conn)));

            // Initialize process registry
            app.manage(ProcessRegistryState::default());

            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());

            // Initialize Codex process state
            app.manage(CodexProcessState::default());

            // Initialize Gemini process state
            app.manage(GeminiProcessState::default());

            // Initialize Kiro process state (第五引擎)
            app.manage(KiroProcessState::default());

            // Initialize Checkpoint Manager
            app.manage(GlobalCheckpointManager(Mutex::new(None)));

            // Initialize Background Task Manager
            app.manage(GlobalTaskManager(Mutex::new(None)));

            // Initialize Parallel Agent Manager
            app.manage(GlobalParallelAgentManager(Mutex::new(None)));

            // Initialize Window Registry for attention mechanism
            app.manage(WindowRegistryState(Mutex::new(
                commands::window_attention::WindowRegistry::new()
            )));

            // Initialize LSP Manager
            app.manage(commands::lsp::LSPManager::new());

            // Initialize auto-compact manager for context management
            let auto_compact_manager =
                Arc::new(commands::context_manager::AutoCompactManager::new());
            let app_handle_for_monitor = app.handle().clone();
            let manager_for_monitor = auto_compact_manager.clone();

            // Start monitoring in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = manager_for_monitor
                    .start_monitoring(app_handle_for_monitor)
                    .await
                {
                    log::error!("Failed to start auto-compact monitoring: {}", e);
                }
            });

            app.manage(commands::context_manager::AutoCompactState(
                auto_compact_manager,
            ));

            // Initialize translation service with saved configuration
            tauri::async_runtime::spawn(async move {
                commands::translator::init_translation_service_with_saved_config().await;
            });

            // 🔄 启动时同步 MCP 配置：从 .claude.json 同步到 settings.json
            // 确保 Fangyu Code UI 显示的配置与 Claude Code 实际使用的配置一致
            tauri::async_runtime::spawn(async move {
                match commands::claude::sync_claude_json_to_settings().await {
                    Ok(msg) => log::info!("✅ 配置同步成功: {}", msg),
                    Err(e) => log::warn!("⚠️ 配置同步失败（非致命）: {}", e),
                }
            });

            // 🔒 清理启动时被窗口状态插件意外恢复的 session 窗口
            // Window state plugin 会恢复上次关闭时的所有窗口，但 session 窗口应该是临时的
            let windows_to_cleanup: Vec<String> = app
                .webview_windows()
                .keys()
                .filter(|label| label.starts_with("session-window-"))
                .cloned()
                .collect();

            for label in windows_to_cleanup {
                if let Some(win) = app.get_webview_window(&label) {
                    log::warn!("[Startup] Closing restored session window: {}", label);
                    if let Err(e) = win.close() {
                        log::error!("[Startup] Failed to close session window {}: {}", label, e);
                    }
                }
            }

            // Fallback window show mechanism for macOS
            // In case frontend JS fails to execute window.show()
            if let Some(main_window) = app.get_webview_window("main") {
                let window_clone = main_window.clone();
                tauri::async_runtime::spawn(async move {
                    // Wait for frontend to potentially show the window first
                    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
                    // Show window as fallback (no-op if already visible)
                    if let Err(e) = window_clone.show() {
                        log::error!("Fallback: Failed to show main window: {}", e);
                    }
                    if let Err(e) = window_clone.set_focus() {
                        log::error!("Fallback: Failed to focus main window: {}", e);
                    }
                    log::info!("Fallback window show mechanism executed");
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle main window close - close all session windows
            if let WindowEvent::CloseRequested { .. } = event {
                let window_label = window.label();

                // If main window is closing, close all session windows
                if window_label == "main" {
                    log::info!("[Window] Main window closing, closing all session windows");

                    let app = window.app_handle();
                    let windows_to_close: Vec<String> = app
                        .webview_windows()
                        .keys()
                        .filter(|label| label.starts_with("session-window-"))
                        .cloned()
                        .collect();

                    for label in windows_to_close {
                        if let Some(win) = app.get_webview_window(&label) {
                            log::info!("[Window] Closing session window: {}", label);
                            if let Err(e) = win.close() {
                                log::error!(
                                    "[Window] Failed to close session window {}: {}",
                                    label,
                                    e
                                );
                            }
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Claude & Project Management
            list_projects,
            get_project_sessions,
            delete_session,
            delete_sessions_batch,
            delete_sessions_by_pattern,
            delete_project,
            restore_project,
            list_hidden_projects,
            delete_project_permanently,
            get_claude_settings,
            open_new_session,
            get_system_prompt,
            get_codex_system_prompt,
            check_claude_version,
            save_system_prompt,
            save_codex_system_prompt,
            save_claude_settings,
            update_thinking_mode,
            find_claude_md_files,
            read_claude_md_file,
            save_claude_md_file,
            load_session_history,
            execute_claude_code,
            continue_claude_code,
            resume_claude_code,
            cancel_claude_execution,
            list_running_claude_sessions,
            get_claude_session_output,
            list_directory_contents,
            search_files,
            get_hooks_config,
            update_hooks_config,
            validate_hook_command,
            list_hook_files,
            toggle_hook_file,
            get_active_hooks,
            // 配置同步命令
            sync_claude_json_to_settings,
            sync_settings_to_claude_json,
            toggle_mcp_server_unified,
            get_mcp_sync_status,
            full_sync_mcp_configs,
            // 权限管理命令
            get_claude_execution_config,
            update_claude_execution_config,
            reset_claude_execution_config,
            get_claude_permission_config,
            update_claude_permission_config,
            get_permission_presets,
            get_available_tools,
            validate_permission_config,
            set_custom_claude_path,
            get_claude_path,
            clear_custom_claude_path,
            // Claude WSL Mode Configuration
            get_claude_wsl_mode_config,
            set_claude_wsl_mode_config,
            // Acemcp Integration
            enhance_prompt_with_context,
            test_acemcp_availability,
            save_acemcp_config,
            load_acemcp_config,
            preindex_project,
            export_acemcp_sidecar,
            get_extracted_sidecar_path,
            // Enhanced Hooks Automation
            trigger_hook_event,
            test_hook_condition,
            execute_pre_commit_review,
            // Usage & Analytics (Simplified from opcode)
            get_usage_stats,
            get_usage_by_date_range,
            get_session_stats,
            // MCP (Model Context Protocol)
            mcp_add,
            mcp_list,
            mcp_get,
            mcp_remove,
            mcp_add_json,
            mcp_add_from_claude_desktop,
            mcp_serve,
            mcp_test_connection,
            mcp_reset_project_choices,
            mcp_get_server_status,
            mcp_export_config,
            mcp_read_project_config,
            mcp_save_project_config,
            // MCP 多应用支持（新增）
            mcp_get_claude_status,
            mcp_upsert_server,
            mcp_delete_server,
            mcp_toggle_app,
            mcp_import_from_app,
            mcp_validate_command,
            mcp_read_claude_config,
            mcp_get_all_servers,
            mcp_get_unified_servers,
            // 多引擎独立隔离控制 API
            mcp_get_engine_servers,
            mcp_upsert_engine_server,
            mcp_delete_engine_server,
            mcp_toggle_engine_server,
            mcp_get_engine_servers_with_status,
            // Storage Management
            storage_list_tables,
            storage_read_table,
            storage_update_row,
            storage_delete_row,
            storage_insert_row,
            storage_execute_sql,
            storage_reset_database,
            storage_get_performance_stats,
            storage_analyze_query,
            // Clipboard
            save_clipboard_image,
            write_to_clipboard,
            read_from_clipboard,
            // Provider Management
            get_provider_presets,
            get_current_provider_config,
            switch_provider_config,
            clear_provider_config,
            test_provider_connection,
            add_provider_config,
            update_provider_config,
            delete_provider_config,
            get_provider_config,
            query_provider_usage,
            save_claude_env_vars,
            // Translation
            translate,
            translate_batch,
            get_translation_config,
            update_translation_config,
            clear_translation_cache,
            get_translation_cache_stats,
            detect_text_language,
            init_translation_service_command,
            // LLM Text Generation (文本生成)
            commands::llm::generate_text_with_llm,
            // Auto-Compact Context Management
            commands::context_commands::init_auto_compact_manager,
            commands::context_commands::register_auto_compact_session,
            commands::context_commands::update_session_context,
            commands::context_commands::trigger_manual_compaction,
            commands::context_commands::execute_compact,
            commands::context_commands::get_auto_compact_config,
            commands::context_commands::update_auto_compact_config,
            commands::context_commands::get_session_context_stats,
            commands::context_commands::get_all_monitored_sessions,
            commands::context_commands::unregister_auto_compact_session,
            commands::context_commands::stop_auto_compact_monitoring,
            commands::context_commands::start_auto_compact_monitoring,
            commands::context_commands::get_auto_compact_status,
            // Prompt Revert System
            check_and_init_git,
            check_reset_safety,
            precise_revert_code,
            // Git Panel Commands
            git_status,
            git_log,
            git_diff,
            git_reset,
            git_revert_commit,
            git_restore,
            git_create_backup_branch,
            git_add,
            git_commit,
            record_prompt_sent,
            mark_prompt_completed,
            revert_to_prompt,
            get_prompt_list,
            get_unified_prompt_list,
            check_rewind_capabilities,
            // Checkpoint Management System
            init_checkpoint_manager,
            create_checkpoint,
            list_checkpoints,
            restore_checkpoint,
            delete_checkpoint,
            delete_session_checkpoints,
            get_latest_checkpoint,
            // Background Task Management System
            init_task_manager,
            create_background_task,
            start_background_task,
            pause_background_task,
            resume_background_task,
            cancel_background_task,
            complete_background_task,
            retry_background_task,
            update_task_progress,
            get_background_task,
            list_background_tasks,
            get_task_stats,
            delete_background_task,
            cleanup_completed_tasks,
            get_next_pending_task,
            // Parallel Agent System
            init_parallel_agent_manager,
            create_parallel_group,
            add_parallel_task,
            add_parallel_agent,
            start_parallel_group,
            complete_parallel_task,
            fail_parallel_task,
            get_parallel_group,
            get_group_stats,
            list_session_groups,
            delete_parallel_group,
            send_agent_message,
            lock_resource,
            unlock_resource,
            // Claude Extensions (Plugins, Subagents, Skills & Custom Commands)
            list_plugins,
            list_subagents,
            list_agent_skills,
            list_custom_slash_commands,
            list_gemini_custom_slash_commands,
            read_subagent,
            read_skill,
            create_subagent,
            create_skill,
            toggle_skill,
            open_plugins_directory,
            open_agents_directory,
            open_skills_directory,
            open_commands_directory,
            // File Operations
            open_directory_in_explorer,
            open_file_with_default_app,
            // Git Statistics
            get_git_diff_stats,
            get_session_code_changes,
            get_git_changed_files,
            get_git_file_diff,
            get_git_file_at_commit,
            // OpenAI Codex Integration
            execute_codex,
            resume_codex,
            resume_last_codex,
            cancel_codex,
            list_codex_sessions,
            delete_codex_session,
            load_codex_session_history,
            get_codex_prompt_list,
            check_codex_rewind_capabilities,
            check_codex_availability,
            // Codex Mode Configuration
            get_codex_mode_config,
            set_codex_mode_config,
            // Codex Rewind Commands
            record_codex_prompt_sent,
            record_codex_prompt_completed,
            revert_codex_to_prompt,
            // Codex custom path
            validate_codex_path_cmd,
            set_custom_codex_path,
            get_codex_path,
            clear_custom_codex_path,
            // Codex Provider Management
            get_codex_provider_presets,
            get_current_codex_config,
            switch_codex_provider,
            add_codex_provider_config,
            update_codex_provider_config,
            delete_codex_provider_config,
            clear_codex_provider_config,
            test_codex_provider_connection,
            update_codex_reasoning_level,
            // Codex Usage Statistics
            get_codex_usage_stats,
            // Session Conversion (Claude ↔ Codex)
            convert_session,
            convert_claude_to_codex,
            convert_codex_to_claude,
            // Window Management (Multi-window support)
            create_session_window,
            close_session_window,
            list_session_windows,
            focus_session_window,
            emit_to_window,
            broadcast_to_session_windows,
            set_titlebar_theme,
            // Window Attention Mechanism
            register_window,
            update_window_visibility,
            update_window_focus,
            delegate_task_to_active_window,
            report_delegated_task_completion,
            // Google Gemini CLI Integration
            execute_gemini,
            cancel_gemini,
            check_gemini_installed,
            get_gemini_config,
            update_gemini_config,
            get_gemini_models,
            // Gemini Session History
            get_gemini_session_logs,
            list_gemini_sessions,
            get_gemini_session_detail,
            delete_gemini_session,
            // Gemini System Prompt
            get_gemini_system_prompt,
            save_gemini_system_prompt,
            // Gemini Rewind Commands
            get_gemini_prompt_list,
            check_gemini_rewind_capabilities,
            record_gemini_prompt_sent,
            record_gemini_prompt_completed,
            revert_gemini_to_prompt,
            // Gemini Provider Commands
            get_gemini_provider_presets,
            get_current_gemini_provider_config,
            switch_gemini_provider,
            add_gemini_provider_config,
            update_gemini_provider_config,
            delete_gemini_provider_config,
            clear_gemini_provider_config,
            test_gemini_provider_connection,
            // Gemini WSL Commands
            get_gemini_wsl_mode_config,
            set_gemini_wsl_mode_config,
            // Gemini Usage Statistics
            get_gemini_usage_stats,
            // Smart Project Management (智能项目管理)
            create_smart_project,
            rename_smart_project,
            generate_session_title,
            create_project_claude_md,
            // Auto Update (自动更新)
            commands::auto_update::get_current_version,
            commands::auto_update::check_for_updates,
            commands::auto_update::restart_to_new_version,
            commands::auto_update::download_and_install_update,
            // Config Manager (配置管理中心)
            get_config_health,
            get_projects_cache,
            clean_project_cache,
            clean_old_cache,
            get_config_items,
            toggle_config_item,
            backup_config,
            // DevTools (开发者工具)
            open_devtools,
            close_devtools,
            is_devtools_open,
            // Diagnostics (诊断工具)
            run_diagnostics,
            fix_all_issues,
            fix_issue,
            // Memory Import System (智能记忆导入系统)
            detect_memory_keywords,
            import_memories,
            // Chat History Retrieval (聊天历史回溯 - 语义搜索)
            save_chat_message,
            search_chat_history,
            get_session_messages,
            get_recent_sessions,
            update_session_title,
            delete_chat_session,
            get_chat_history_stats,
            // Smart Session Continue (智能会话续接系统)
            commands::session_continue::create_continued_session,
            // LSP (Language Server Protocol) Integration
            commands::lsp::lsp_start,
            commands::lsp::lsp_shutdown,
            commands::lsp::lsp_hover,
            commands::lsp::lsp_definition,
            commands::lsp::lsp_references,
            commands::lsp::lsp_completion,
            commands::lsp::lsp_diagnostics,
            commands::lsp::lsp_rename,
            commands::lsp::scan_project_files,
            commands::lsp::lsp_get_status,
            commands::lsp::lsp_get_all_status,
            commands::lsp::lsp_restart,
            commands::lsp::lsp_get_server_info,
            // Docker Container Management (Docker 容器管理 - 沙箱环境)
            commands::docker::docker_check_availability,
            commands::docker::docker_create_container,
            commands::docker::docker_destroy_container,
            commands::docker::docker_exec_command,
            commands::docker::docker_container_status,
            commands::docker::docker_container_stats,
            // Kiro CLI Integration (第五引擎 - Kiro CLI)
            check_kiro_cli_installed,
            check_kiro_cli_logged_in,
            get_kiro_cli_version,
            get_kiro_models,
            execute_kiro_chat,
            cancel_kiro_execution,
            open_kiro_login,
            // Kiro API 模式（直接调用 Amazon Q API）
            read_kiro_token,
            get_kiro_token_status,
            send_kiro_request,
            parse_kiro_sse_response,
            kiro_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
