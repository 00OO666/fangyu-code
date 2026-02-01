//! CLI 监控模块的类型定义
//!
//! 定义了所有与 CLI 会话监控相关的数据结构和枚举类型

use serde::{Deserialize, Serialize};

/// 会话信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    /// 会话唯一标识符
    pub session_id: String,

    /// 项目路径
    pub project_path: String,

    /// 项目名称（从路径提取）
    pub project_name: String,

    /// Git 分支名称
    pub git_branch: String,

    /// 会话摘要
    pub summary: String,

    /// 第一条提示
    pub first_prompt: String,

    /// 消息数量
    pub message_count: u32,

    /// 创建时间（ISO 8601 格式）
    pub created: String,

    /// 最后修改时间（ISO 8601 格式）
    pub modified: String,

    /// 最后修改时间戳（用于排序和增量更新）
    pub last_modified_timestamp: u64,

    /// 是否活跃
    pub is_active: bool,

    /// 颜色编码（十六进制）
    pub color: String,

    /// 是否固定
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_pinned: Option<bool>,

    /// 是否隐藏
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_hidden: Option<bool>,

    /// 自定义标签
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_label: Option<String>,

    /// 最近的消息（用于预览）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_messages: Option<Vec<SessionMessage>>,
}

/// 会话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    /// 消息角色（user 或 assistant）
    pub role: String,

    /// 消息内容
    pub content: String,

    /// 时间戳
    pub timestamp: String,

    /// 工具调用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,

    /// 是否有错误
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_error: Option<bool>,
}

/// 工具调用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// 工具名称
    pub name: String,

    /// 工具参数
    pub arguments: serde_json::Value,

    /// 工具结果
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
}

/// 会话状态
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SessionStatus {
    /// 活跃（最近 5 分钟有更新）
    Active,

    /// 空闲（5-30 分钟没有更新）
    Idle,

    /// 不活跃（超过 30 分钟没有更新）
    Inactive,
}

/// 任务状态
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskStatus {
    /// 运行中
    Running,

    /// 等待用户输入
    Waiting,

    /// 已完成
    Completed,

    /// 错误
    Error,
}

/// sessions-index.json 的结构
#[derive(Debug, Deserialize)]
pub struct SessionsIndex {
    pub version: u32,
    pub entries: Vec<SessionEntry>,
}

/// sessions-index.json 中的单个会话条目
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    pub session_id: String,
    pub full_path: String,
    pub file_mtime: u64,
    pub first_prompt: String,
    pub summary: String,
    pub message_count: u32,
    pub created: String,
    pub modified: String,
    pub git_branch: String,
    pub project_path: String,
    pub is_sidechain: bool,
}

/// 会话事件类型
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SessionEvent {
    /// 会话已更新
    SessionUpdated { session_id: String },

    /// 会话已创建
    SessionCreated { session_id: String },

    /// 会话已删除
    SessionDeleted { session_id: String },
}
