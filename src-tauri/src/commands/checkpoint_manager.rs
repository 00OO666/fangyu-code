// Checkpoint 检查点管理系统
// 功能: 自动保存代码状态，支持快速回滚
// 来源: 借鉴 Claude Code CLI + Cursor

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};

/// 检查点类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointType {
    /// 自动检查点（在代码修改前自动创建）
    Auto,
    /// 手动检查点（用户主动创建）
    Manual,
    /// 工具调用前检查点
    ToolCall,
}

/// 检查点元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// 检查点ID（时间戳）
    pub id: String,
    /// 检查点名称
    pub name: Option<String>,
    /// 检查点描述
    pub description: Option<String>,
    /// 检查点类型
    pub checkpoint_type: CheckpointType,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 会话ID
    pub session_id: String,
    /// 保存的文件列表
    pub files: Vec<CheckpointFile>,
    /// 工具调用信息（如果是 ToolCall 类型）
    pub tool_info: Option<ToolCallInfo>,
}

/// 保存的文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointFile {
    /// 文件相对路径
    pub path: String,
    /// 文件内容的哈希值
    pub content_hash: String,
    /// 文件大小（字节）
    pub size: u64,
}

/// 工具调用信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    /// 工具名称
    pub tool_name: String,
    /// 工具参数
    pub tool_args: HashMap<String, String>,
}

/// 检查点管理器
pub struct CheckpointManager {
    /// 检查点存储根目录
    storage_root: PathBuf,
}

impl CheckpointManager {
    /// 创建检查点管理器
    pub fn new(storage_root: PathBuf) -> Result<Self> {
        // 确保存储目录存在
        fs::create_dir_all(&storage_root)
            .context("Failed to create checkpoint storage directory")?;

        Ok(Self { storage_root })
    }

    /// 为会话创建检查点
    pub fn create_checkpoint(
        &self,
        session_id: &str,
        project_path: &Path,
        checkpoint_type: CheckpointType,
        name: Option<String>,
        description: Option<String>,
        tool_info: Option<ToolCallInfo>,
    ) -> Result<Checkpoint> {
        let checkpoint_id = format!("{}", Utc::now().timestamp_millis());
        let checkpoint_dir = self.get_checkpoint_dir(session_id, &checkpoint_id);

        // 创建检查点目录
        fs::create_dir_all(&checkpoint_dir)?;

        // 扫描项目目录，保存所有文件
        let files = self.save_project_files(project_path, &checkpoint_dir)?;

        let checkpoint = Checkpoint {
            id: checkpoint_id.clone(),
            name,
            description,
            checkpoint_type,
            created_at: Utc::now(),
            session_id: session_id.to_string(),
            files,
            tool_info,
        };

        // 保存元数据
        self.save_checkpoint_metadata(&checkpoint)?;

        Ok(checkpoint)
    }

    /// 列出会话的所有检查点
    pub fn list_checkpoints(&self, session_id: &str) -> Result<Vec<Checkpoint>> {
        let session_dir = self.storage_root.join(session_id);

        if !session_dir.exists() {
            return Ok(Vec::new());
        }

        let mut checkpoints = Vec::new();

        for entry in fs::read_dir(&session_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let metadata_file = path.join("metadata.json");
                if metadata_file.exists() {
                    if let Ok(content) = fs::read_to_string(&metadata_file) {
                        if let Ok(checkpoint) = serde_json::from_str::<Checkpoint>(&content) {
                            checkpoints.push(checkpoint);
                        }
                    }
                }
            }
        }

        // 按创建时间排序（最新的在前）
        checkpoints.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(checkpoints)
    }

    /// 恢复到指定检查点
    pub fn restore_checkpoint(
        &self,
        session_id: &str,
        checkpoint_id: &str,
        project_path: &Path,
    ) -> Result<Vec<String>> {
        let checkpoint = self.get_checkpoint(session_id, checkpoint_id)?;
        let checkpoint_dir = self.get_checkpoint_dir(session_id, checkpoint_id);

        let mut restored_files = Vec::new();

        // 恢复所有文件
        for file_info in &checkpoint.files {
            let src_path = checkpoint_dir.join(&file_info.path);
            let dest_path = project_path.join(&file_info.path);

            // 确保目标目录存在
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // 复制文件
            fs::copy(&src_path, &dest_path)
                .with_context(|| format!("Failed to restore file: {}", file_info.path))?;

            restored_files.push(file_info.path.clone());
        }

        Ok(restored_files)
    }

    /// 删除检查点
    pub fn delete_checkpoint(&self, session_id: &str, checkpoint_id: &str) -> Result<()> {
        let checkpoint_dir = self.get_checkpoint_dir(session_id, checkpoint_id);

        if checkpoint_dir.exists() {
            fs::remove_dir_all(&checkpoint_dir)
                .context("Failed to delete checkpoint")?;
        }

        Ok(())
    }

    /// 删除会话的所有检查点
    pub fn delete_session_checkpoints(&self, session_id: &str) -> Result<()> {
        let session_dir = self.storage_root.join(session_id);

        if session_dir.exists() {
            fs::remove_dir_all(&session_dir)
                .context("Failed to delete session checkpoints")?;
        }

        Ok(())
    }

    /// 获取最新的检查点
    pub fn get_latest_checkpoint(&self, session_id: &str) -> Result<Option<Checkpoint>> {
        let checkpoints = self.list_checkpoints(session_id)?;
        Ok(checkpoints.first().cloned())
    }

    /// 计算文件内容哈希
    fn calculate_hash(content: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(content);
        format!("{:x}", hasher.finalize())
    }

    /// 保存项目文件
    fn save_project_files(
        &self,
        project_path: &Path,
        checkpoint_dir: &Path,
    ) -> Result<Vec<CheckpointFile>> {
        let mut files = Vec::new();

        // 排除的目录和文件
        let excluded_dirs = vec![
            "node_modules",
            ".git",
            "target",
            "dist",
            "build",
            ".next",
            ".cache",
        ];

        // 递归扫描项目目录
        self.scan_directory(project_path, project_path, checkpoint_dir, &excluded_dirs, &mut files)?;

        Ok(files)
    }

    /// 递归扫描目录
    fn scan_directory(
        &self,
        base_path: &Path,
        current_path: &Path,
        checkpoint_dir: &Path,
        excluded_dirs: &[&str],
        files: &mut Vec<CheckpointFile>,
    ) -> Result<()> {
        if !current_path.is_dir() {
            return Ok(());
        }

        for entry in fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();

            // 跳过排除的目录
            if path.is_dir() && excluded_dirs.contains(&file_name_str.as_ref()) {
                continue;
            }

            if path.is_file() {
                // 读取文件内容
                if let Ok(content) = fs::read(&path) {
                    let relative_path = path.strip_prefix(base_path)
                        .unwrap()
                        .to_string_lossy()
                        .to_string();

                    let content_hash = Self::calculate_hash(&content);

                    // 保存文件到检查点目录
                    let dest_path = checkpoint_dir.join(&relative_path);
                    if let Some(parent) = dest_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::write(&dest_path, &content)?;

                    files.push(CheckpointFile {
                        path: relative_path,
                        content_hash,
                        size: content.len() as u64,
                    });
                }
            } else if path.is_dir() {
                // 递归扫描子目录
                self.scan_directory(base_path, &path, checkpoint_dir, excluded_dirs, files)?;
            }
        }

        Ok(())
    }

    /// 获取检查点目录
    fn get_checkpoint_dir(&self, session_id: &str, checkpoint_id: &str) -> PathBuf {
        self.storage_root.join(session_id).join(checkpoint_id)
    }

    /// 保存检查点元数据
    fn save_checkpoint_metadata(&self, checkpoint: &Checkpoint) -> Result<()> {
        let checkpoint_dir = self.get_checkpoint_dir(&checkpoint.session_id, &checkpoint.id);
        let metadata_file = checkpoint_dir.join("metadata.json");

        let json = serde_json::to_string_pretty(checkpoint)?;
        fs::write(&metadata_file, json)?;

        Ok(())
    }

    /// 获取检查点
    fn get_checkpoint(&self, session_id: &str, checkpoint_id: &str) -> Result<Checkpoint> {
        let checkpoint_dir = self.get_checkpoint_dir(session_id, checkpoint_id);
        let metadata_file = checkpoint_dir.join("metadata.json");

        let content = fs::read_to_string(&metadata_file)
            .context("Failed to read checkpoint metadata")?;

        let checkpoint = serde_json::from_str(&content)
            .context("Failed to parse checkpoint metadata")?;

        Ok(checkpoint)
    }
}

// ========== Tauri 命令 ==========

use tauri::State;
use std::sync::Mutex;

/// 全局检查点管理器
pub struct GlobalCheckpointManager(pub Mutex<Option<CheckpointManager>>);

/// 初始化检查点管理器
#[tauri::command]
pub fn init_checkpoint_manager(
    storage_path: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<(), String> {
    let checkpoint_manager = CheckpointManager::new(PathBuf::from(storage_path))
        .map_err(|e| e.to_string())?;

    *manager.0.lock().unwrap() = Some(checkpoint_manager);

    Ok(())
}

/// 创建检查点
#[tauri::command]
pub fn create_checkpoint(
    session_id: String,
    project_path: String,
    checkpoint_type: String,
    name: Option<String>,
    description: Option<String>,
    manager: State<GlobalCheckpointManager>,
) -> Result<Checkpoint, String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    let checkpoint_type = match checkpoint_type.as_str() {
        "auto" => CheckpointType::Auto,
        "manual" => CheckpointType::Manual,
        "tool_call" => CheckpointType::ToolCall,
        _ => return Err("Invalid checkpoint type".to_string()),
    };

    checkpoint_manager
        .create_checkpoint(
            &session_id,
            Path::new(&project_path),
            checkpoint_type,
            name,
            description,
            None,
        )
        .map_err(|e| e.to_string())
}

/// 列出检查点
#[tauri::command]
pub fn list_checkpoints(
    session_id: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<Vec<Checkpoint>, String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    checkpoint_manager
        .list_checkpoints(&session_id)
        .map_err(|e| e.to_string())
}

/// 恢复检查点
#[tauri::command]
pub fn restore_checkpoint(
    session_id: String,
    checkpoint_id: String,
    project_path: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<Vec<String>, String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    checkpoint_manager
        .restore_checkpoint(&session_id, &checkpoint_id, Path::new(&project_path))
        .map_err(|e| e.to_string())
}

/// 删除检查点
#[tauri::command]
pub fn delete_checkpoint(
    session_id: String,
    checkpoint_id: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<(), String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    checkpoint_manager
        .delete_checkpoint(&session_id, &checkpoint_id)
        .map_err(|e| e.to_string())
}

/// 删除会话的所有检查点
#[tauri::command]
pub fn delete_session_checkpoints(
    session_id: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<(), String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    checkpoint_manager
        .delete_session_checkpoints(&session_id)
        .map_err(|e| e.to_string())
}

/// 获取最新检查点
#[tauri::command]
pub fn get_latest_checkpoint(
    session_id: String,
    manager: State<GlobalCheckpointManager>,
) -> Result<Option<Checkpoint>, String> {
    let guard = manager.0.lock().unwrap();
    let checkpoint_manager = guard.as_ref().ok_or("Checkpoint manager not initialized")?;

    checkpoint_manager
        .get_latest_checkpoint(&session_id)
        .map_err(|e| e.to_string())
}
