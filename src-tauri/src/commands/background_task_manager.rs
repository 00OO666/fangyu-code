/**
 * background_task_manager.rs - 后台任务管理系统
 *
 * 功能:
 * - 后台任务队列管理
 * - 任务优先级调度
 * - 任务暂停/恢复/取消
 * - 任务进度追踪
 * - 任务完成通知
 *
 * 来源: Cursor Composer + Windsurf Background Tasks
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use chrono::{DateTime, Utc};
use uuid::Uuid;

// ============================================================
// 类型定义
// ============================================================

/// 任务优先级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Normal,
    High,
    Critical,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Normal
    }
}

/// 任务状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    /// 排队中
    Pending,
    /// 运行中
    Running,
    /// 已暂停
    Paused,
    /// 已完成
    Completed,
    /// 失败
    Failed,
    /// 已取消
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Pending
    }
}

/// 任务类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    /// Shell 命令执行
    ShellCommand {
        command: String,
        working_dir: Option<String>,
    },
    /// AI 对话/生成
    AiGeneration {
        prompt: String,
        engine: String,
        model: Option<String>,
    },
    /// 文件操作
    FileOperation {
        operation: String,  // copy, move, delete, etc.
        paths: Vec<String>,
    },
    /// 代码分析
    CodeAnalysis {
        project_path: String,
        analysis_type: String,
    },
    /// 自定义任务
    Custom {
        task_name: String,
        payload: serde_json::Value,
    },
}

/// 任务进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProgress {
    /// 当前步骤
    pub current_step: u32,
    /// 总步骤数
    pub total_steps: u32,
    /// 完成百分比 (0-100)
    pub percentage: f32,
    /// 当前步骤描述
    pub message: String,
    /// 已处理项目数
    pub processed_items: Option<u32>,
    /// 总项目数
    pub total_items: Option<u32>,
}

impl Default for TaskProgress {
    fn default() -> Self {
        TaskProgress {
            current_step: 0,
            total_steps: 1,
            percentage: 0.0,
            message: "等待开始...".to_string(),
            processed_items: None,
            total_items: None,
        }
    }
}

/// 任务执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    /// 是否成功
    pub success: bool,
    /// 结果数据
    pub data: Option<serde_json::Value>,
    /// 输出内容
    pub output: Option<String>,
    /// 错误信息
    pub error: Option<String>,
    /// 执行耗时(毫秒)
    pub duration_ms: u64,
}

/// 后台任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTask {
    /// 任务ID
    pub id: String,
    /// 任务名称
    pub name: String,
    /// 任务描述
    pub description: Option<String>,
    /// 任务类型
    pub task_type: TaskType,
    /// 优先级
    pub priority: TaskPriority,
    /// 状态
    pub status: TaskStatus,
    /// 进度
    pub progress: TaskProgress,
    /// 执行结果
    pub result: Option<TaskResult>,
    /// 关联会话ID
    pub session_id: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 开始时间
    pub started_at: Option<DateTime<Utc>>,
    /// 完成时间
    pub completed_at: Option<DateTime<Utc>>,
    /// 重试次数
    pub retry_count: u32,
    /// 最大重试次数
    pub max_retries: u32,
    /// 标签
    pub tags: Vec<String>,
}

impl BackgroundTask {
    pub fn new(name: String, task_type: TaskType) -> Self {
        BackgroundTask {
            id: Uuid::new_v4().to_string(),
            name,
            description: None,
            task_type,
            priority: TaskPriority::default(),
            status: TaskStatus::default(),
            progress: TaskProgress::default(),
            result: None,
            session_id: None,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            tags: Vec::new(),
        }
    }

    /// 设置描述
    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    /// 设置优先级
    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    /// 设置会话ID
    pub fn with_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    /// 设置标签
    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    /// 设置最大重试次数
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// 是否可以重试
    pub fn can_retry(&self) -> bool {
        self.retry_count < self.max_retries && self.status == TaskStatus::Failed
    }

    /// 是否终态
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            TaskStatus::Completed | TaskStatus::Failed | TaskStatus::Cancelled
        )
    }
}

// ============================================================
// 任务管理器
// ============================================================

/// 后台任务管理器
pub struct BackgroundTaskManager {
    /// 任务存储
    tasks: HashMap<String, BackgroundTask>,
    /// 会话任务索引
    session_tasks: HashMap<String, Vec<String>>,
    /// 任务队列（按优先级排序的任务ID）
    queue: Vec<String>,
    /// 当前运行中的任务数
    running_count: u32,
    /// 最大并发任务数
    max_concurrent: u32,
}

impl BackgroundTaskManager {
    pub fn new() -> Self {
        BackgroundTaskManager {
            tasks: HashMap::new(),
            session_tasks: HashMap::new(),
            queue: Vec::new(),
            running_count: 0,
            max_concurrent: 3,
        }
    }

    /// 设置最大并发数
    pub fn set_max_concurrent(&mut self, max: u32) {
        self.max_concurrent = max;
    }

    /// 添加任务
    pub fn add_task(&mut self, task: BackgroundTask) -> String {
        let task_id = task.id.clone();

        // 添加到会话索引
        if let Some(session_id) = &task.session_id {
            self.session_tasks
                .entry(session_id.clone())
                .or_insert_with(Vec::new)
                .push(task_id.clone());
        }

        // 插入队列（按优先级）
        self.insert_to_queue(&task_id, &task.priority);

        // 存储任务
        self.tasks.insert(task_id.clone(), task);

        task_id
    }

    /// 按优先级插入队列
    fn insert_to_queue(&mut self, task_id: &str, priority: &TaskPriority) {
        // 找到合适的位置插入
        let pos = self.queue.iter().position(|id| {
            if let Some(t) = self.tasks.get(id) {
                t.priority < *priority
            } else {
                true
            }
        });

        match pos {
            Some(i) => self.queue.insert(i, task_id.to_string()),
            None => self.queue.push(task_id.to_string()),
        }
    }

    /// 获取下一个待执行任务
    pub fn get_next_pending(&mut self) -> Option<String> {
        if self.running_count >= self.max_concurrent {
            return None;
        }

        // 找到第一个待执行的任务
        let task_id = self.queue.iter().find(|id| {
            if let Some(task) = self.tasks.get(*id) {
                task.status == TaskStatus::Pending
            } else {
                false
            }
        })?.clone();

        Some(task_id)
    }

    /// 开始任务
    pub fn start_task(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.status != TaskStatus::Pending {
            return Err("只能启动待执行状态的任务".to_string());
        }

        task.status = TaskStatus::Running;
        task.started_at = Some(Utc::now());
        task.progress.message = "执行中...".to_string();
        self.running_count += 1;

        Ok(())
    }

    /// 更新任务进度
    pub fn update_progress(&mut self, task_id: &str, progress: TaskProgress) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.status != TaskStatus::Running {
            return Err("只能更新运行中任务的进度".to_string());
        }

        task.progress = progress;
        Ok(())
    }

    /// 暂停任务
    pub fn pause_task(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.status != TaskStatus::Running {
            return Err("只能暂停运行中的任务".to_string());
        }

        task.status = TaskStatus::Paused;
        task.progress.message = "已暂停".to_string();
        self.running_count -= 1;

        Ok(())
    }

    /// 恢复任务
    pub fn resume_task(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.status != TaskStatus::Paused {
            return Err("只能恢复已暂停的任务".to_string());
        }

        if self.running_count >= self.max_concurrent {
            return Err("已达到最大并发数，请等待其他任务完成".to_string());
        }

        task.status = TaskStatus::Running;
        task.progress.message = "继续执行...".to_string();
        self.running_count += 1;

        Ok(())
    }

    /// 取消任务
    pub fn cancel_task(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.is_terminal() {
            return Err("任务已结束，无法取消".to_string());
        }

        let was_running = task.status == TaskStatus::Running;
        task.status = TaskStatus::Cancelled;
        task.completed_at = Some(Utc::now());
        task.progress.message = "已取消".to_string();

        if was_running {
            self.running_count -= 1;
        }

        // 从队列移除
        self.queue.retain(|id| id != task_id);

        Ok(())
    }

    /// 完成任务
    pub fn complete_task(&mut self, task_id: &str, result: TaskResult) -> Result<(), String> {
        let task = self.tasks.get_mut(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        if task.status != TaskStatus::Running {
            return Err("只能完成运行中的任务".to_string());
        }

        task.status = if result.success {
            TaskStatus::Completed
        } else {
            TaskStatus::Failed
        };
        task.completed_at = Some(Utc::now());
        task.progress.percentage = if result.success { 100.0 } else { task.progress.percentage };
        task.progress.message = if result.success {
            "已完成".to_string()
        } else {
            result.error.clone().unwrap_or_else(|| "执行失败".to_string())
        };
        task.result = Some(result);
        self.running_count -= 1;

        // 从队列移除
        self.queue.retain(|id| id != task_id);

        Ok(())
    }

    /// 重试任务
    pub fn retry_task(&mut self, task_id: &str) -> Result<(), String> {
        // 先获取优先级，避免借用冲突
        let priority = {
            let task = self.tasks.get_mut(task_id)
                .ok_or_else(|| format!("任务不存在: {}", task_id))?;

            if !task.can_retry() {
                return Err("任务无法重试".to_string());
            }

            task.retry_count += 1;
            task.status = TaskStatus::Pending;
            task.progress = TaskProgress::default();
            task.result = None;

            task.priority.clone()
        };

        // 重新加入队列
        self.insert_to_queue(task_id, &priority);

        Ok(())
    }

    /// 获取任务
    pub fn get_task(&self, task_id: &str) -> Option<&BackgroundTask> {
        self.tasks.get(task_id)
    }

    /// 获取所有任务
    pub fn get_all_tasks(&self) -> Vec<&BackgroundTask> {
        self.tasks.values().collect()
    }

    /// 获取会话任务
    pub fn get_session_tasks(&self, session_id: &str) -> Vec<&BackgroundTask> {
        self.session_tasks
            .get(session_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.tasks.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// 获取活跃任务（运行中或排队中）
    pub fn get_active_tasks(&self) -> Vec<&BackgroundTask> {
        self.tasks.values()
            .filter(|t| matches!(t.status, TaskStatus::Running | TaskStatus::Pending | TaskStatus::Paused))
            .collect()
    }

    /// 获取任务统计
    pub fn get_stats(&self) -> TaskStats {
        let mut stats = TaskStats::default();

        for task in self.tasks.values() {
            stats.total += 1;
            match task.status {
                TaskStatus::Pending => stats.pending += 1,
                TaskStatus::Running => stats.running += 1,
                TaskStatus::Paused => stats.paused += 1,
                TaskStatus::Completed => stats.completed += 1,
                TaskStatus::Failed => stats.failed += 1,
                TaskStatus::Cancelled => stats.cancelled += 1,
            }
        }

        stats
    }

    /// 清理已完成的任务
    pub fn cleanup_completed(&mut self, older_than_hours: u32) {
        let cutoff = Utc::now() - chrono::Duration::hours(older_than_hours as i64);

        let to_remove: Vec<String> = self.tasks.iter()
            .filter(|(_, task)| {
                task.is_terminal() && task.completed_at
                    .map(|t| t < cutoff)
                    .unwrap_or(false)
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in to_remove {
            if let Some(task) = self.tasks.remove(&id) {
                // 从会话索引移除
                if let Some(session_id) = &task.session_id {
                    if let Some(ids) = self.session_tasks.get_mut(session_id) {
                        ids.retain(|i| i != &id);
                    }
                }
            }
        }
    }

    /// 删除任务
    pub fn delete_task(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.tasks.remove(task_id)
            .ok_or_else(|| format!("任务不存在: {}", task_id))?;

        // 从队列移除
        self.queue.retain(|id| id != task_id);

        // 从会话索引移除
        if let Some(session_id) = &task.session_id {
            if let Some(ids) = self.session_tasks.get_mut(session_id) {
                ids.retain(|i| i != task_id);
            }
        }

        // 更新运行计数
        if task.status == TaskStatus::Running {
            self.running_count -= 1;
        }

        Ok(())
    }
}

/// 任务统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskStats {
    pub total: u32,
    pub pending: u32,
    pub running: u32,
    pub paused: u32,
    pub completed: u32,
    pub failed: u32,
    pub cancelled: u32,
}

// ============================================================
// 全局状态
// ============================================================

pub struct GlobalTaskManager(pub Mutex<Option<BackgroundTaskManager>>);

// ============================================================
// Tauri 命令
// ============================================================

/// 初始化任务管理器
#[tauri::command]
pub fn init_task_manager(
    state: State<'_, GlobalTaskManager>,
    max_concurrent: Option<u32>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let mut manager = BackgroundTaskManager::new();

    if let Some(max) = max_concurrent {
        manager.set_max_concurrent(max);
    }

    *guard = Some(manager);
    Ok(())
}

/// 创建任务
#[tauri::command]
pub fn create_background_task(
    state: State<'_, GlobalTaskManager>,
    name: String,
    task_type: TaskType,
    description: Option<String>,
    priority: Option<TaskPriority>,
    session_id: Option<String>,
    tags: Option<Vec<String>>,
    max_retries: Option<u32>,
) -> Result<BackgroundTask, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    let mut task = BackgroundTask::new(name, task_type);

    if let Some(desc) = description {
        task = task.with_description(desc);
    }
    if let Some(p) = priority {
        task = task.with_priority(p);
    }
    if let Some(sid) = session_id {
        task = task.with_session(sid);
    }
    if let Some(t) = tags {
        task = task.with_tags(t);
    }
    if let Some(max) = max_retries {
        task = task.with_max_retries(max);
    }

    let task_clone = task.clone();
    manager.add_task(task);

    Ok(task_clone)
}

/// 开始任务
#[tauri::command]
pub fn start_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.start_task(&task_id)
}

/// 更新任务进度
#[tauri::command]
pub fn update_task_progress(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
    progress: TaskProgress,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.update_progress(&task_id, progress)
}

/// 暂停任务
#[tauri::command]
pub fn pause_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.pause_task(&task_id)
}

/// 恢复任务
#[tauri::command]
pub fn resume_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.resume_task(&task_id)
}

/// 取消任务
#[tauri::command]
pub fn cancel_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.cancel_task(&task_id)
}

/// 完成任务
#[tauri::command]
pub fn complete_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
    result: TaskResult,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.complete_task(&task_id, result)
}

/// 重试任务
#[tauri::command]
pub fn retry_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.retry_task(&task_id)
}

/// 获取任务
#[tauri::command]
pub fn get_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<Option<BackgroundTask>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref()
        .ok_or("任务管理器未初始化")?;

    Ok(manager.get_task(&task_id).cloned())
}

/// 获取所有任务
#[tauri::command]
pub fn list_background_tasks(
    state: State<'_, GlobalTaskManager>,
    session_id: Option<String>,
    active_only: Option<bool>,
) -> Result<Vec<BackgroundTask>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref()
        .ok_or("任务管理器未初始化")?;

    let tasks = if let Some(sid) = session_id {
        manager.get_session_tasks(&sid)
            .into_iter()
            .cloned()
            .collect()
    } else if active_only.unwrap_or(false) {
        manager.get_active_tasks()
            .into_iter()
            .cloned()
            .collect()
    } else {
        manager.get_all_tasks()
            .into_iter()
            .cloned()
            .collect()
    };

    Ok(tasks)
}

/// 获取任务统计
#[tauri::command]
pub fn get_task_stats(
    state: State<'_, GlobalTaskManager>,
) -> Result<TaskStats, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_ref()
        .ok_or("任务管理器未初始化")?;

    Ok(manager.get_stats())
}

/// 删除任务
#[tauri::command]
pub fn delete_background_task(
    state: State<'_, GlobalTaskManager>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.delete_task(&task_id)
}

/// 清理已完成任务
#[tauri::command]
pub fn cleanup_completed_tasks(
    state: State<'_, GlobalTaskManager>,
    older_than_hours: Option<u32>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    manager.cleanup_completed(older_than_hours.unwrap_or(24));
    Ok(())
}

/// 获取下一个待执行任务
#[tauri::command]
pub fn get_next_pending_task(
    state: State<'_, GlobalTaskManager>,
) -> Result<Option<String>, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let manager = guard.as_mut()
        .ok_or("任务管理器未初始化")?;

    Ok(manager.get_next_pending())
}
