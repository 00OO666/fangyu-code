/**
 * parallel_agents.rs - 并行代理系统
 *
 * 功能:
 * - 多代理并行任务执行
 * - 任务分解和智能分配
 * - 代理间消息通信
 * - 任务依赖图管理
 * - 资源协调和冲突处理
 *
 * 来源: Claude Code Task Tool + Cursor Multi-Agent
 */

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Mutex;
use tauri::State;
use chrono::{DateTime, Utc};
use uuid::Uuid;

// ============================================================
// 类型定义
// ============================================================

/// 代理类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    /// 通用代理
    General,
    /// 代码生成代理
    Coder,
    /// 代码审查代理
    Reviewer,
    /// 测试代理
    Tester,
    /// 文档代理
    Documenter,
    /// 研究代理
    Researcher,
    /// 调试代理
    Debugger,
    /// 自定义代理
    Custom(String),
}

impl Default for AgentType {
    fn default() -> Self {
        AgentType::General
    }
}

/// 代理状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    /// 空闲
    Idle,
    /// 工作中
    Working,
    /// 等待依赖
    Waiting,
    /// 暂停
    Paused,
    /// 完成
    Completed,
    /// 失败
    Failed,
}

impl Default for AgentStatus {
    fn default() -> Self {
        AgentStatus::Idle
    }
}

/// 代理消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    /// 任务分配
    TaskAssignment,
    /// 任务结果
    TaskResult,
    /// 进度更新
    ProgressUpdate,
    /// 请求协助
    RequestHelp,
    /// 提供协助
    ProvideHelp,
    /// 资源锁定请求
    ResourceLock,
    /// 资源释放
    ResourceUnlock,
    /// 错误报告
    ErrorReport,
    /// 同步信号
    Sync,
}

/// 代理间消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: String,
    pub from_agent: String,
    pub to_agent: Option<String>, // None = broadcast
    pub message_type: MessageType,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

impl AgentMessage {
    pub fn new(from: &str, to: Option<&str>, msg_type: MessageType, payload: serde_json::Value) -> Self {
        AgentMessage {
            id: Uuid::new_v4().to_string(),
            from_agent: from.to_string(),
            to_agent: to.map(|s| s.to_string()),
            message_type: msg_type,
            payload,
            timestamp: Utc::now(),
        }
    }
}

/// 并行任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelTask {
    pub id: String,
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub agent_type: AgentType,
    pub dependencies: Vec<String>, // 依赖的任务ID
    pub priority: u32,
    pub status: AgentStatus,
    pub assigned_agent: Option<String>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub metadata: HashMap<String, String>,
}

impl ParallelTask {
    pub fn new(name: String, description: String, prompt: String) -> Self {
        ParallelTask {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            prompt,
            agent_type: AgentType::default(),
            dependencies: Vec::new(),
            priority: 0,
            status: AgentStatus::Idle,
            assigned_agent: None,
            result: None,
            error: None,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            metadata: HashMap::new(),
        }
    }

    pub fn with_agent_type(mut self, agent_type: AgentType) -> Self {
        self.agent_type = agent_type;
        self
    }

    pub fn with_dependencies(mut self, deps: Vec<String>) -> Self {
        self.dependencies = deps;
        self
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }

    pub fn is_ready(&self, completed_tasks: &HashSet<String>) -> bool {
        self.dependencies.iter().all(|dep| completed_tasks.contains(dep))
    }
}

/// 并行代理
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelAgent {
    pub id: String,
    pub name: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub completed_tasks: Vec<String>,
    pub message_queue: VecDeque<AgentMessage>,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
    pub capabilities: Vec<String>,
    pub metadata: HashMap<String, String>,
}

impl ParallelAgent {
    pub fn new(name: String, agent_type: AgentType) -> Self {
        ParallelAgent {
            id: Uuid::new_v4().to_string(),
            name,
            agent_type,
            status: AgentStatus::Idle,
            current_task: None,
            completed_tasks: Vec::new(),
            message_queue: VecDeque::new(),
            created_at: Utc::now(),
            last_active: Utc::now(),
            capabilities: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_capabilities(mut self, caps: Vec<String>) -> Self {
        self.capabilities = caps;
        self
    }

    pub fn is_available(&self) -> bool {
        matches!(self.status, AgentStatus::Idle)
    }

    #[allow(dead_code)]
    pub fn can_handle(&self, task: &ParallelTask) -> bool {
        if !self.is_available() {
            return false;
        }

        // 检查代理类型匹配
        match (&self.agent_type, &task.agent_type) {
            (AgentType::General, _) => true, // 通用代理可处理任何任务
            (a, b) if a == b => true,
            _ => false,
        }
    }
}

/// 并行任务组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelTaskGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub session_id: String,
    pub tasks: HashMap<String, ParallelTask>,
    pub agents: HashMap<String, ParallelAgent>,
    pub dependency_graph: HashMap<String, Vec<String>>, // task_id -> dependents
    pub message_bus: VecDeque<AgentMessage>,
    pub locked_resources: HashMap<String, String>, // resource -> agent_id
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: String,
}

impl ParallelTaskGroup {
    pub fn new(name: String, session_id: String) -> Self {
        ParallelTaskGroup {
            id: Uuid::new_v4().to_string(),
            name,
            description: None,
            session_id,
            tasks: HashMap::new(),
            agents: HashMap::new(),
            dependency_graph: HashMap::new(),
            message_bus: VecDeque::new(),
            locked_resources: HashMap::new(),
            created_at: Utc::now(),
            completed_at: None,
            status: "pending".to_string(),
        }
    }

    /// 添加任务
    pub fn add_task(&mut self, task: ParallelTask) {
        let task_id = task.id.clone();

        // 更新依赖图
        for dep in &task.dependencies {
            self.dependency_graph
                .entry(dep.clone())
                .or_insert_with(Vec::new)
                .push(task_id.clone());
        }

        self.tasks.insert(task_id, task);
    }

    /// 添加代理
    pub fn add_agent(&mut self, agent: ParallelAgent) {
        self.agents.insert(agent.id.clone(), agent);
    }

    /// 获取就绪任务
    pub fn get_ready_tasks(&self) -> Vec<&ParallelTask> {
        let completed: HashSet<String> = self.tasks.iter()
            .filter(|(_, t)| t.status == AgentStatus::Completed)
            .map(|(id, _)| id.clone())
            .collect();

        self.tasks.values()
            .filter(|t| t.status == AgentStatus::Idle && t.is_ready(&completed))
            .collect()
    }

    /// 获取可用代理
    pub fn get_available_agents(&self) -> Vec<&ParallelAgent> {
        self.agents.values()
            .filter(|a| a.is_available())
            .collect()
    }

    /// 分配任务给代理
    pub fn assign_task(&mut self, task_id: &str, agent_id: &str) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;
        let agent = self.agents.get_mut(agent_id)
            .ok_or_else(|| format!("代理不存在: {}", agent_id))?;

        if !agent.is_available() {
            return Err("代理正在工作中".to_string());
        }

        task.status = AgentStatus::Working;
        task.assigned_agent = Some(agent_id.to_string());
        task.started_at = Some(Utc::now());

        agent.status = AgentStatus::Working;
        agent.current_task = Some(task_id.to_string());
        agent.last_active = Utc::now();

        // 发送任务分配消息
        let msg = AgentMessage::new(
            "system",
            Some(agent_id),
            MessageType::TaskAssignment,
            serde_json::json!({
                "task_id": task_id,
                "task_name": task.name,
                "prompt": task.prompt
            }),
        );
        self.message_bus.push_back(msg);

        Ok(())
    }

    /// 完成任务
    pub fn complete_task(&mut self, task_id: &str, result: serde_json::Value) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        let agent_id = task.assigned_agent.clone()
            .ok_or_else(|| "任务未分配代理".to_string())?;

        task.status = AgentStatus::Completed;
        task.result = Some(result.clone());
        task.completed_at = Some(Utc::now());

        if let Some(agent) = self.agents.get_mut(&agent_id) {
            agent.status = AgentStatus::Idle;
            agent.current_task = None;
            agent.completed_tasks.push(task_id.to_string());
            agent.last_active = Utc::now();
        }

        // 发送任务结果消息
        let msg = AgentMessage::new(
            &agent_id,
            None, // broadcast
            MessageType::TaskResult,
            serde_json::json!({
                "task_id": task_id,
                "success": true,
                "result": result
            }),
        );
        self.message_bus.push_back(msg);

        // 检查是否所有任务完成
        self.check_completion();

        Ok(())
    }

    /// 任务失败
    pub fn fail_task(&mut self, task_id: &str, error: String) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        let agent_id = task.assigned_agent.clone();

        task.status = AgentStatus::Failed;
        task.error = Some(error.clone());
        task.completed_at = Some(Utc::now());

        if let Some(aid) = &agent_id {
            if let Some(agent) = self.agents.get_mut(aid) {
                agent.status = AgentStatus::Idle;
                agent.current_task = None;
                agent.last_active = Utc::now();
            }
        }

        // 发送错误消息
        let msg = AgentMessage::new(
            agent_id.as_deref().unwrap_or("system"),
            None,
            MessageType::ErrorReport,
            serde_json::json!({
                "task_id": task_id,
                "error": error
            }),
        );
        self.message_bus.push_back(msg);

        Ok(())
    }

    /// 锁定资源
    pub fn lock_resource(&mut self, resource: &str, agent_id: &str) -> Result<(), String> {
        if self.locked_resources.contains_key(resource) {
            return Err(format!("资源 {} 已被锁定", resource));
        }
        self.locked_resources.insert(resource.to_string(), agent_id.to_string());
        Ok(())
    }

    /// 释放资源
    pub fn unlock_resource(&mut self, resource: &str, agent_id: &str) -> Result<(), String> {
        if let Some(owner) = self.locked_resources.get(resource) {
            if owner != agent_id {
                return Err("只有锁定者才能释放资源".to_string());
            }
            self.locked_resources.remove(resource);
        }
        Ok(())
    }

    /// 发送代理消息
    pub fn send_message(&mut self, message: AgentMessage) {
        if let Some(to) = &message.to_agent {
            // 定向消息
            if let Some(agent) = self.agents.get_mut(to) {
                agent.message_queue.push_back(message);
            }
        } else {
            // 广播消息
            self.message_bus.push_back(message);
        }
    }

    /// 检查完成状态
    fn check_completion(&mut self) {
        let all_completed = self.tasks.values()
            .all(|t| matches!(t.status, AgentStatus::Completed | AgentStatus::Failed));

        if all_completed {
            self.status = "completed".to_string();
            self.completed_at = Some(Utc::now());
        } else if self.tasks.values().any(|t| t.status == AgentStatus::Working) {
            self.status = "running".to_string();
        }
    }

    /// 获取统计信息
    pub fn get_stats(&self) -> GroupStats {
        let mut stats = GroupStats::default();

        for task in self.tasks.values() {
            stats.total_tasks += 1;
            match task.status {
                AgentStatus::Idle => stats.pending_tasks += 1,
                AgentStatus::Working | AgentStatus::Waiting => stats.running_tasks += 1,
                AgentStatus::Completed => stats.completed_tasks += 1,
                AgentStatus::Failed => stats.failed_tasks += 1,
                _ => {}
            }
        }

        stats.total_agents = self.agents.len() as u32;
        stats.active_agents = self.agents.values()
            .filter(|a| a.status == AgentStatus::Working)
            .count() as u32;

        stats
    }
}

/// 任务组统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GroupStats {
    pub total_tasks: u32,
    pub pending_tasks: u32,
    pub running_tasks: u32,
    pub completed_tasks: u32,
    pub failed_tasks: u32,
    pub total_agents: u32,
    pub active_agents: u32,
}

// ============================================================
// 并行代理管理器
// ============================================================

pub struct ParallelAgentManager {
    groups: HashMap<String, ParallelTaskGroup>,
    session_groups: HashMap<String, Vec<String>>,
}

impl ParallelAgentManager {
    pub fn new() -> Self {
        ParallelAgentManager {
            groups: HashMap::new(),
            session_groups: HashMap::new(),
        }
    }

    /// 创建任务组
    pub fn create_group(&mut self, name: String, session_id: String) -> String {
        let group = ParallelTaskGroup::new(name, session_id.clone());
        let group_id = group.id.clone();

        self.session_groups
            .entry(session_id)
            .or_insert_with(Vec::new)
            .push(group_id.clone());

        self.groups.insert(group_id.clone(), group);
        group_id
    }

    /// 获取任务组
    pub fn get_group(&self, group_id: &str) -> Option<&ParallelTaskGroup> {
        self.groups.get(group_id)
    }

    /// 获取可变任务组
    pub fn get_group_mut(&mut self, group_id: &str) -> Option<&mut ParallelTaskGroup> {
        self.groups.get_mut(group_id)
    }

    /// 删除任务组
    pub fn delete_group(&mut self, group_id: &str) -> Result<(), String> {
        let group = self.groups.remove(group_id)
            .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

        if let Some(ids) = self.session_groups.get_mut(&group.session_id) {
            ids.retain(|id| id != group_id);
        }

        Ok(())
    }

    /// 获取会话的所有任务组
    pub fn get_session_groups(&self, session_id: &str) -> Vec<&ParallelTaskGroup> {
        self.session_groups
            .get(session_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.groups.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// 智能任务分配
    pub fn auto_assign_tasks(&mut self, group_id: &str) -> Result<Vec<(String, String)>, String> {
        let group = self.groups.get_mut(group_id)
            .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

        let ready_tasks: Vec<_> = group.get_ready_tasks()
            .iter()
            .map(|t| (t.id.clone(), t.agent_type.clone(), t.priority))
            .collect();

        let available_agents: Vec<_> = group.get_available_agents()
            .iter()
            .map(|a| (a.id.clone(), a.agent_type.clone()))
            .collect();

        let mut assignments = Vec::new();

        // 按优先级排序任务
        let mut sorted_tasks = ready_tasks;
        sorted_tasks.sort_by(|a, b| b.2.cmp(&a.2));

        for (task_id, task_type, _) in sorted_tasks {
            // 找到最匹配的代理
            let best_agent = available_agents.iter()
                .find(|(_, agent_type)| {
                    match (agent_type, &task_type) {
                        (AgentType::General, _) => true,
                        (a, b) if a == b => true,
                        _ => false,
                    }
                })
                .map(|(id, _)| id.clone());

            if let Some(agent_id) = best_agent {
                if let Ok(()) = group.assign_task(&task_id, &agent_id) {
                    assignments.push((task_id, agent_id));
                }
            }
        }

        Ok(assignments)
    }
}

// ============================================================
// 全局状态
// ============================================================

pub struct GlobalParallelAgentManager(pub Mutex<Option<ParallelAgentManager>>);

// ============================================================
// Tauri 命令
// ============================================================

#[tauri::command]
pub fn init_parallel_agent_manager(
    state: State<'_, GlobalParallelAgentManager>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(ParallelAgentManager::new());
    Ok(())
}

#[tauri::command]
pub fn create_parallel_group(
    state: State<'_, GlobalParallelAgentManager>,
    name: String,
    session_id: String,
    description: Option<String>,
) -> Result<ParallelTaskGroup, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group_id = manager.create_group(name, session_id);
    if let (Some(group), Some(desc)) = (manager.get_group_mut(&group_id), description) {
        group.description = Some(desc);
    }

    manager.get_group(&group_id)
        .cloned()
        .ok_or_else(|| "创建任务组失败".to_string())
}

#[tauri::command]
pub fn add_parallel_task(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    name: String,
    description: String,
    prompt: String,
    agent_type: Option<AgentType>,
    dependencies: Option<Vec<String>>,
    priority: Option<u32>,
) -> Result<ParallelTask, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    let mut task = ParallelTask::new(name, description, prompt);
    if let Some(at) = agent_type {
        task = task.with_agent_type(at);
    }
    if let Some(deps) = dependencies {
        task = task.with_dependencies(deps);
    }
    if let Some(p) = priority {
        task = task.with_priority(p);
    }

    let task_clone = task.clone();
    group.add_task(task);

    Ok(task_clone)
}

#[tauri::command]
pub fn add_parallel_agent(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    name: String,
    agent_type: Option<AgentType>,
    capabilities: Option<Vec<String>>,
) -> Result<ParallelAgent, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    let mut agent = ParallelAgent::new(name, agent_type.unwrap_or_default());
    if let Some(caps) = capabilities {
        agent = agent.with_capabilities(caps);
    }

    let agent_clone = agent.clone();
    group.add_agent(agent);

    Ok(agent_clone)
}

#[tauri::command]
pub fn start_parallel_group(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
) -> Result<Vec<(String, String)>, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    manager.auto_assign_tasks(&group_id)
}

#[tauri::command]
pub fn complete_parallel_task(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    task_id: String,
    result: serde_json::Value,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    group.complete_task(&task_id, result)
}

#[tauri::command]
pub fn fail_parallel_task(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    task_id: String,
    error: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    group.fail_task(&task_id, error)
}

#[tauri::command]
pub fn get_parallel_group(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
) -> Result<Option<ParallelTaskGroup>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("管理器未初始化")?;

    Ok(manager.get_group(&group_id).cloned())
}

#[tauri::command]
pub fn get_group_stats(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
) -> Result<GroupStats, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("管理器未初始化")?;

    let group = manager.get_group(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    Ok(group.get_stats())
}

#[tauri::command]
pub fn list_session_groups(
    state: State<'_, GlobalParallelAgentManager>,
    session_id: String,
) -> Result<Vec<ParallelTaskGroup>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref().ok_or("管理器未初始化")?;

    Ok(manager.get_session_groups(&session_id)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub fn delete_parallel_group(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    manager.delete_group(&group_id)
}

#[tauri::command]
pub fn send_agent_message(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    from_agent: String,
    to_agent: Option<String>,
    message_type: MessageType,
    payload: serde_json::Value,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    let message = AgentMessage::new(&from_agent, to_agent.as_deref(), message_type, payload);
    group.send_message(message);

    Ok(())
}

#[tauri::command]
pub fn lock_resource(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    resource: String,
    agent_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    group.lock_resource(&resource, &agent_id)
}

#[tauri::command]
pub fn unlock_resource(
    state: State<'_, GlobalParallelAgentManager>,
    group_id: String,
    resource: String,
    agent_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut().ok_or("管理器未初始化")?;

    let group = manager.get_group_mut(&group_id)
        .ok_or_else(|| format!("任务组不存在: {}", group_id))?;

    group.unlock_resource(&resource, &agent_id)
}
