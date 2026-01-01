use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// 聊天历史数据库封装
pub struct ChatHistoryDb(pub Mutex<Connection>);

/// 初始化聊天历史数据库
pub fn init_chat_history_db(app: &AppHandle) -> SqliteResult<Connection> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

    let db_path = app_dir.join("chat_history.db");
    let conn = Connection::open(db_path)?;

    // ========== 性能优化 ==========
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "cache_size", 10000)?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.pragma_update(None, "mmap_size", 30000000000i64)?;

    log::info!("✅ Chat history SQLite WAL mode enabled");

    // ========== 表结构 ==========

    // 1. 会话表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            project_path TEXT,
            title TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // 2. 消息表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            tokens_input INTEGER DEFAULT 0,
            tokens_output INTEGER DEFAULT 0,
            model TEXT,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 3. FTS5 全文搜索虚拟表
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
            content,
            session_id UNINDEXED,
            role UNINDEXED,
            timestamp UNINDEXED,
            content='chat_messages',
            content_rowid='id'
        )",
        [],
    )?;

    // 4. 触发器：自动同步到 FTS5
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS chat_messages_ai AFTER INSERT ON chat_messages BEGIN
            INSERT INTO chat_messages_fts(rowid, content, session_id, role, timestamp)
            VALUES (new.id, new.content, new.session_id, new.role, new.timestamp);
        END",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS chat_messages_ad AFTER DELETE ON chat_messages BEGIN
            DELETE FROM chat_messages_fts WHERE rowid = old.id;
        END",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS chat_messages_au AFTER UPDATE ON chat_messages BEGIN
            UPDATE chat_messages_fts SET content = new.content WHERE rowid = old.id;
        END",
        [],
    )?;

    // 5. Embedding 表（Phase 2）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS message_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            embedding TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // ========== 索引优化 ==========

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp DESC)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_embeddings_message_id ON message_embeddings(message_id)",
        [],
    )?;

    log::info!("✅ Chat history database initialized with FTS5 support");

    Ok(conn)
}

// ========== 数据结构 ==========

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: i64,
    pub session_id: String,
    pub project_path: Option<String>,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub tokens_input: i64,
    pub tokens_output: i64,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub message: ChatMessage,
    pub session: ChatSession,
    pub relevance_score: f64,
}

// ========== Tauri 命令 ==========

/// 保存消息到历史记录
#[tauri::command]
pub async fn save_chat_message(
    db: State<'_, ChatHistoryDb>,
    session_id: String,
    role: String,
    content: String,
    tokens_input: Option<i64>,
    tokens_output: Option<i64>,
    model: Option<String>,
    project_path: Option<String>,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();

    // 1. 确保会话存在
    let session_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM chat_sessions WHERE session_id = ?",
            params![session_id],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .unwrap_or(false);

    if !session_exists {
        conn.execute(
            "INSERT INTO chat_sessions (session_id, project_path, created_at, updated_at)
             VALUES (?, ?, ?, ?)",
            params![session_id, project_path, now, now],
        )
        .map_err(|e| format!("Failed to create session: {}", e))?;
    } else {
        // 更新会话的 updated_at
        conn.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?",
            params![now, session_id],
        )
        .map_err(|e| format!("Failed to update session: {}", e))?;
    }

    // 2. 插入消息
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, timestamp, tokens_input, tokens_output, model)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            session_id,
            role,
            content,
            now,
            tokens_input.unwrap_or(0),
            tokens_output.unwrap_or(0),
            model
        ],
    )
    .map_err(|e| format!("Failed to save message: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// FTS5 全文搜索
#[tauri::command]
pub async fn search_chat_history(
    db: State<'_, ChatHistoryDb>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(20);

    // FTS5 查询
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                m.id, m.session_id, m.role, m.content, m.timestamp,
                m.tokens_input, m.tokens_output, m.model,
                s.id, s.project_path, s.title, s.created_at, s.updated_at,
                fts.rank
            FROM chat_messages_fts AS fts
            JOIN chat_messages AS m ON fts.rowid = m.id
            JOIN chat_sessions AS s ON m.session_id = s.session_id
            WHERE chat_messages_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        "#,
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![query, limit], |row| {
            Ok(SearchResult {
                message: ChatMessage {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    timestamp: row.get(4)?,
                    tokens_input: row.get(5)?,
                    tokens_output: row.get(6)?,
                    model: row.get(7)?,
                },
                session: ChatSession {
                    id: row.get(8)?,
                    session_id: row.get(1)?,
                    project_path: row.get(9)?,
                    title: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                },
                relevance_score: row.get::<_, f64>(13)?.abs(), // rank 是负数，取绝对值
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// 获取会话的所有消息
#[tauri::command]
pub async fn get_session_messages(
    db: State<'_, ChatHistoryDb>,
    session_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ChatMessage>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, timestamp, tokens_input, tokens_output, model
             FROM chat_messages
             WHERE session_id = ?
             ORDER BY timestamp ASC
             LIMIT ? OFFSET ?",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map(params![session_id, limit, offset], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_input: row.get(5)?,
                tokens_output: row.get(6)?,
                model: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(messages)
}

/// 获取最近的会话列表
#[tauri::command]
pub async fn get_recent_sessions(
    db: State<'_, ChatHistoryDb>,
    limit: Option<i64>,
) -> Result<Vec<ChatSession>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, project_path, title, created_at, updated_at
             FROM chat_sessions
             ORDER BY updated_at DESC
             LIMIT ?",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map(params![limit], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                session_id: row.get(1)?,
                project_path: row.get(2)?,
                title: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(sessions)
}

/// 更新会话标题
#[tauri::command]
pub async fn update_session_title(
    db: State<'_, ChatHistoryDb>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE session_id = ?",
        params![title, Utc::now().to_rfc3339(), session_id],
    )
    .map_err(|e| format!("Failed to update session title: {}", e))?;

    Ok(())
}

/// 删除会话及其所有消息
#[tauri::command]
pub async fn delete_chat_session(
    db: State<'_, ChatHistoryDb>,
    session_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM chat_sessions WHERE session_id = ?",
        params![session_id],
    )
    .map_err(|e| format!("Failed to delete session: {}", e))?;

    Ok(())
}

/// 获取历史统计信息
#[derive(Debug, Serialize)]
pub struct ChatHistoryStats {
    pub total_sessions: i64,
    pub total_messages: i64,
    pub total_tokens_input: i64,
    pub total_tokens_output: i64,
    pub database_size_mb: f64,
}

#[tauri::command]
pub async fn get_chat_history_stats(
    db: State<'_, ChatHistoryDb>,
) -> Result<ChatHistoryStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let total_sessions: i64 = conn
        .query_row("SELECT COUNT(*) FROM chat_sessions", [], |row| row.get(0))
        .unwrap_or(0);

    let total_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM chat_messages", [], |row| row.get(0))
        .unwrap_or(0);

    let (total_tokens_input, total_tokens_output): (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(tokens_input), 0), COALESCE(SUM(tokens_output), 0) FROM chat_messages",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((0, 0));

    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .unwrap_or(0);

    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |row| row.get(0))
        .unwrap_or(4096);

    let database_size_mb = (page_count * page_size) as f64 / (1024.0 * 1024.0);

    Ok(ChatHistoryStats {
        total_sessions,
        total_messages,
        total_tokens_input,
        total_tokens_output,
        database_size_mb,
    })
}
