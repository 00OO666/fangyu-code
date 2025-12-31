use log::{debug, error, info, warn};
/// 增强型Hooks自动化系统
///
/// 这个模块实现了事件驱动的自动化工作流系统，包括：
/// - 新的hooks事件类型（on-context-compact, on-agent-switch等）
/// - Hooks链式执行和条件触发
/// - 与现有组件深度集成（AutoCompactManager等）
/// - 错误处理和回滚机制
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

/// 扩展的Hook事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "PascalCase")]
pub enum HookEvent {
    // 现有事件
    PreToolUse,
    PostToolUse,
    Notification,
    Stop,
    SubagentStop,

    // 新增事件
    OnContextCompact, // 上下文压缩时触发
    OnAgentSwitch,    // 切换子代理时触发
    OnFileChange,     // 文件修改时触发
    OnSessionStart,   // 会话开始时触发
    OnSessionEnd,     // 会话结束时触发
    OnTabSwitch,      // 切换标签页时触发
}

impl HookEvent {
    pub fn as_str(&self) -> &str {
        match self {
            HookEvent::PreToolUse => "PreToolUse",
            HookEvent::PostToolUse => "PostToolUse",
            HookEvent::Notification => "Notification",
            HookEvent::Stop => "Stop",
            HookEvent::SubagentStop => "SubagentStop",
            HookEvent::OnContextCompact => "OnContextCompact",
            HookEvent::OnAgentSwitch => "OnAgentSwitch",
            HookEvent::OnFileChange => "OnFileChange",
            HookEvent::OnSessionStart => "OnSessionStart",
            HookEvent::OnSessionEnd => "OnSessionEnd",
            HookEvent::OnTabSwitch => "OnTabSwitch",
        }
    }
}

/// Hook执行上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookContext {
    pub event: String,
    pub session_id: String,
    pub project_path: String,
    pub data: serde_json::Value, // 事件特定数据
}

/// Hook执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookExecutionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub hook_command: String,
}

/// Hook链执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookChainResult {
    pub event: String,
    pub total_hooks: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<HookExecutionResult>,
    pub should_continue: bool, // 是否应该继续后续操作
}

/// 条件触发配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalTrigger {
    pub condition: String, // 条件表达式
    pub enabled: bool,
    pub priority: Option<i32>, // 执行优先级
}

/// 增强型Hook定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedHook {
    pub command: String,
    pub timeout: Option<u64>,
    pub retry: Option<u32>,
    pub condition: Option<ConditionalTrigger>,
    pub on_success: Option<Vec<String>>, // 成功后执行的命令
    pub on_failure: Option<Vec<String>>, // 失败后执行的命令
}

/// Hook执行器
pub struct HookExecutor {
    app: AppHandle,
}

impl HookExecutor {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 执行单个hook
    pub async fn execute_hook(
        &self,
        hook: &EnhancedHook,
        context: &HookContext,
    ) -> Result<HookExecutionResult, String> {
        let start_time = std::time::Instant::now();

        // 检查条件是否满足
        if let Some(condition) = &hook.condition {
            if condition.enabled && !self.evaluate_condition(&condition.condition, context)? {
                debug!("Hook condition not met, skipping execution");
                return Ok(HookExecutionResult {
                    success: true,
                    output: "Skipped: condition not met".to_string(),
                    error: None,
                    execution_time_ms: 0,
                    hook_command: hook.command.clone(),
                });
            }
        }

        // 准备执行环境
        let context_json = serde_json::to_string(context).map_err(|e| e.to_string())?;

        // 执行命令
        let mut retry_count = 0;
        let max_retries = hook.retry.unwrap_or(0);

        loop {
            let mut cmd = Command::new("bash");
            cmd.arg("-c")
                .arg(&hook.command)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .env("HOOK_CONTEXT", &context_json)
                .env("HOOK_EVENT", &context.event)
                .env("SESSION_ID", &context.session_id)
                .env("PROJECT_PATH", &context.project_path);

            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }

            // 设置超时
            let timeout_duration = tokio::time::Duration::from_secs(hook.timeout.unwrap_or(30));

            // 生成进程并设置超时
            let child = cmd
                .spawn()
                .map_err(|e| format!("Failed to spawn hook process: {}", e))?;

            let result = tokio::time::timeout(timeout_duration, child.wait_with_output())
                .await
                .map_err(|_| "Hook execution timeout".to_string())?
                .map_err(|e| format!("Hook execution failed: {}", e))?;

            let execution_time = start_time.elapsed().as_millis() as u64;

            if result.status.success() {
                let output = String::from_utf8_lossy(&result.stdout).to_string();

                // 执行成功后的钩子
                if let Some(on_success_commands) = &hook.on_success {
                    for cmd in on_success_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            } else {
                // 失败处理
                let error_output = String::from_utf8_lossy(&result.stderr).to_string();

                if retry_count < max_retries {
                    warn!(
                        "Hook failed, retrying ({}/{})",
                        retry_count + 1,
                        max_retries
                    );
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    continue;
                }

                // 执行失败后的钩子
                if let Some(on_failure_commands) = &hook.on_failure {
                    for cmd in on_failure_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(error_output),
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            }
        }
    }

    /// 执行Hook链
    pub async fn execute_hook_chain(
        &self,
        event: HookEvent,
        context: HookContext,
        hooks: Vec<EnhancedHook>,
    ) -> Result<HookChainResult, String> {
        info!(
            "Executing hook chain for event: {:?}, {} hooks",
            event,
            hooks.len()
        );

        let mut results = Vec::new();
        let mut successful = 0;
        let mut failed = 0;
        let mut should_continue = true;

        for (idx, hook) in hooks.iter().enumerate() {
            debug!(
                "Executing hook {}/{}: {}",
                idx + 1,
                hooks.len(),
                hook.command
            );

            match self.execute_hook(hook, &context).await {
                Ok(result) => {
                    if result.success {
                        successful += 1;
                    } else {
                        failed += 1;
                        // 如果是PreToolUse事件且hook失败，则阻止后续操作
                        if matches!(event, HookEvent::PreToolUse) {
                            should_continue = false;
                            warn!("PreToolUse hook failed, blocking operation");
                        }
                    }
                    results.push(result);
                }
                Err(e) => {
                    error!("Hook execution error: {}", e);
                    failed += 1;
                    results.push(HookExecutionResult {
                        success: false,
                        output: String::new(),
                        error: Some(e),
                        execution_time_ms: 0,
                        hook_command: hook.command.clone(),
                    });
                }
            }
        }

        // 发送执行结果事件
        let _ = self.app.emit(
            &format!("hook-chain-complete:{}", context.session_id),
            &results,
        );

        Ok(HookChainResult {
            event: event.as_str().to_string(),
            total_hooks: hooks.len(),
            successful,
            failed,
            results,
            should_continue,
        })
    }

    /// 执行简单命令（用于on_success和on_failure）
    async fn execute_simple_command(
        &self,
        command: &str,
        context: &HookContext,
    ) -> Result<(), String> {
        let mut cmd = Command::new("bash");
        cmd.arg("-c")
            .arg(command)
            .env("SESSION_ID", &context.session_id)
            .env("PROJECT_PATH", &context.project_path);

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }

        let _ = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn command: {}", e))?
            .wait()
            .await;

        Ok(())
    }

    /// 评估条件表达式
    fn evaluate_condition(&self, condition: &str, context: &HookContext) -> Result<bool, String> {
        // 简单的条件评估实现
        // 支持的格式：
        // - "session_id == 'xyz'"
        // - "data.tokens > 100000"
        // - "event == 'OnContextCompact'"

        // 这里使用简单的字符串匹配，未来可以集成更强大的表达式引擎
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").collect();
            if parts.len() == 2 {
                let left = parts[0].trim();
                let right = parts[1].trim().trim_matches(|c| c == '\'' || c == '"');

                match left {
                    "event" => Ok(context.event == right),
                    "session_id" => Ok(context.session_id == right),
                    _ => Ok(false),
                }
            } else {
                Ok(false)
            }
        } else {
            // 默认返回true
            Ok(true)
        }
    }
}

// ============ Hook事件触发器 ============

/// Hook管理器 - 管理hooks的注册和触发，保留用于未来扩展
#[allow(dead_code)]
pub struct HookManager {
    executor: Arc<HookExecutor>,
    registered_hooks: Arc<Mutex<HashMap<String, Vec<EnhancedHook>>>>,
}

#[allow(dead_code)]
impl HookManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            executor: Arc::new(HookExecutor::new(app)),
            registered_hooks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 注册Hook
    pub fn register_hooks(&self, event: HookEvent, hooks: Vec<EnhancedHook>) {
        let mut registered = self.registered_hooks.lock().unwrap();
        registered.insert(event.as_str().to_string(), hooks);
    }

    /// 触发Hook事件
    pub async fn trigger(
        &self,
        event: HookEvent,
        context: HookContext,
    ) -> Result<HookChainResult, String> {
        let hooks = {
            let registered = self.registered_hooks.lock().unwrap();
            registered.get(event.as_str()).cloned().unwrap_or_default()
        };

        if hooks.is_empty() {
            debug!("No hooks registered for event: {:?}", event);
            return Ok(HookChainResult {
                event: event.as_str().to_string(),
                total_hooks: 0,
                successful: 0,
                failed: 0,
                results: vec![],
                should_continue: true,
            });
        }

        self.executor
            .execute_hook_chain(event, context, hooks)
            .await
    }
}

// ============ Tauri Commands ============

/// 触发Hook事件
#[tauri::command]
pub async fn trigger_hook_event(
    app: AppHandle,
    event: String,
    context: HookContext,
) -> Result<HookChainResult, String> {
    let event_enum = match event.as_str() {
        "OnContextCompact" => HookEvent::OnContextCompact,
        "OnAgentSwitch" => HookEvent::OnAgentSwitch,
        "OnFileChange" => HookEvent::OnFileChange,
        "OnSessionStart" => HookEvent::OnSessionStart,
        "OnSessionEnd" => HookEvent::OnSessionEnd,
        "OnTabSwitch" => HookEvent::OnTabSwitch,
        _ => return Err(format!("Unknown hook event: {}", event)),
    };

    // 从配置中加载hooks
    let hooks_config = crate::commands::claude::get_hooks_config(
        "project".to_string(),
        Some(context.project_path.clone()),
    )
    .await?;

    let hooks_array = hooks_config
        .get(&event)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<EnhancedHook>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default();

    let executor = HookExecutor::new(app);
    executor
        .execute_hook_chain(event_enum, context, hooks_array)
        .await
}

/// 测试Hook条件
#[tauri::command]
pub async fn test_hook_condition(
    app: tauri::AppHandle,
    condition: String,
    context: HookContext,
) -> Result<bool, String> {
    let executor = HookExecutor::new(app);
    executor.evaluate_condition(&condition, &context)
}

// ============ 智能化自动化场景实现 ============

/// 提交前代码审查Hook配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreCommitCodeReviewConfig {
    pub enabled: bool,
    pub quality_threshold: f64,        // 最低质量分数阈值 (0.0-10.0)
    pub block_critical_issues: bool,   // 是否阻止严重问题
    pub block_major_issues: bool,      // 是否阻止重要问题
    pub review_scope: String,          // "security", "performance", "all"
    pub exclude_patterns: Vec<String>, // 排除的文件模式
    pub max_files_to_review: usize,    // 最大审查文件数量
    pub show_suggestions: bool,        // 是否显示改进建议
}

impl Default for PreCommitCodeReviewConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            quality_threshold: 6.0,
            block_critical_issues: true,
            block_major_issues: false,
            review_scope: "all".to_string(),
            exclude_patterns: vec![
                "node_modules/**".to_string(),
                "dist/**".to_string(),
                "build/**".to_string(),
                "target/**".to_string(),
                "*.min.js".to_string(),
                "*.bundle.js".to_string(),
                ".git/**".to_string(),
            ],
            max_files_to_review: 20,
            show_suggestions: true,
        }
    }
}

/// 提交前代码审查Hook - 智能化自动化场景的具体实现
#[allow(dead_code)]
pub struct PreCommitCodeReviewHook {
    config: PreCommitCodeReviewConfig,
    _app: AppHandle, // 保留用于未来扩展，如通知用户等
}

#[allow(dead_code)]
impl PreCommitCodeReviewHook {
    pub fn new(app: AppHandle, config: PreCommitCodeReviewConfig) -> Self {
        Self { config, _app: app }
    }

    /// 执行提交前代码审查 (Disabled - agent functionality removed)
    pub async fn execute(&self, _project_path: &str) -> Result<CommitDecision, String> {
        // Agent functionality removed - always allow commits
        Ok(CommitDecision::Allow {
            message: "代码审查功能已禁用 (Agent functionality removed)".to_string(),
            suggestions: vec![],
        })
    }
}

/// 提交决策结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommitDecision {
    Allow {
        message: String,
        suggestions: Vec<String>,
    },
    Block {
        reason: String,
        details: String, // Changed from CodeReviewResult - agent functionality removed
        suggestions: Vec<String>,
    },
}

/// 执行提交前代码审查Hook (Disabled - agent functionality removed)
#[tauri::command]
pub async fn execute_pre_commit_review(
    _app: tauri::AppHandle,
    _project_path: String,
    _config: Option<PreCommitCodeReviewConfig>,
) -> Result<CommitDecision, String> {
    // Agent functionality has been removed - return allow decision
    Ok(CommitDecision::Allow {
        message: "代码审查功能已禁用 (Agent functionality removed)".to_string(),
        suggestions: vec![],
    })
}
