use anyhow::Result;
use rusqlite::{params, types::ValueRef, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as JsonValue};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// Database wrapper for storage operations
pub struct AgentDb(pub Mutex<Connection>);

/// Initialize the database
pub fn init_database(app: &AppHandle) -> SqliteResult<Connection> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

    let db_path = app_dir.join("agents.db");
    let conn = Connection::open(db_path)?;

    // ========== 🚀 性能优化：启用 WAL 模式和优化参数 ==========
    // PRAGMA 语句会返回结果，需要使用 pragma_update 或 query_row
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "cache_size", 10000)?; // 10MB 缓存
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.pragma_update(None, "mmap_size", 30000000000i64)?; // 30GB memory-mapped I/O

    log::info!("✅ SQLite WAL mode enabled with performance optimizations");

    // Create usage_entries table for token usage tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS usage_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cache_creation_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            cost REAL DEFAULT 0.0,
            project_path TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // ========== 🚀 性能优化：添加数据库索引 ==========

    // 1. 会话查询索引（最常用的查询模式）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_session_id
         ON usage_entries(session_id)",
        [],
    )?;

    // 2. 时间范围查询索引（按时间排序和过滤）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_timestamp
         ON usage_entries(timestamp DESC)",
        [],
    )?;

    // 3. 项目路径索引（跨会话统计）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_project_path
         ON usage_entries(project_path)",
        [],
    )?;

    // 4. 复合索引：模型 + 时间（按模型统计成本趋势）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_model_timestamp
         ON usage_entries(model, timestamp DESC)",
        [],
    )?;

    // 5. 复合索引：项目 + 会话（项目级详细统计）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_project_session
         ON usage_entries(project_path, session_id)",
        [],
    )?;

    // 6. 成本查询索引（用于成本排序和统计）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_usage_cost
         ON usage_entries(cost DESC)",
        [],
    )?;

    log::info!("✅ Database indexes created successfully (6 indexes)");

    Ok(conn)
}

/// Represents metadata about a database table
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableInfo {
    pub name: String,
    pub row_count: i64,
    pub columns: Vec<ColumnInfo>,
}

/// Represents metadata about a table column
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnInfo {
    pub cid: i32,
    pub name: String,
    pub type_name: String,
    pub notnull: bool,
    pub dflt_value: Option<String>,
    pub pk: bool,
}

/// Represents a page of table data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableData {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Map<String, JsonValue>>,
    pub total_rows: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

/// SQL query result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<JsonValue>>,
    pub rows_affected: Option<i64>,
    pub last_insert_rowid: Option<i64>,
}

/// List all tables in the database
#[tauri::command]
pub async fn storage_list_tables(db: State<'_, AgentDb>) -> Result<Vec<TableInfo>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Query for all tables
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map_err(|e| e.to_string())?;

    let table_names: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    let mut tables = Vec::new();

    for table_name in table_names {
        // Get row count
        let row_count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {}", table_name), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);

        // Get column information
        let mut pragma_stmt = conn
            .prepare(&format!("PRAGMA table_info({})", table_name))
            .map_err(|e| e.to_string())?;

        let columns: Vec<ColumnInfo> = pragma_stmt
            .query_map([], |row| {
                Ok(ColumnInfo {
                    cid: row.get(0)?,
                    name: row.get(1)?,
                    type_name: row.get(2)?,
                    notnull: row.get::<_, i32>(3)? != 0,
                    dflt_value: row.get(4)?,
                    pk: row.get::<_, i32>(5)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<SqliteResult<Vec<_>>>()
            .map_err(|e| e.to_string())?;

        tables.push(TableInfo {
            name: table_name,
            row_count,
            columns,
        });
    }

    Ok(tables)
}

/// Read table data with pagination
#[tauri::command]
#[allow(non_snake_case)]
pub async fn storage_read_table(
    db: State<'_, AgentDb>,
    tableName: String,
    page: i64,
    pageSize: i64,
    searchQuery: Option<String>,
) -> Result<TableData, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate table name to prevent SQL injection
    if !is_valid_table_name(&conn, &tableName)? {
        return Err("Invalid table name".to_string());
    }

    // Get column information
    let mut pragma_stmt = conn
        .prepare(&format!("PRAGMA table_info({})", tableName))
        .map_err(|e| e.to_string())?;

    let columns: Vec<ColumnInfo> = pragma_stmt
        .query_map([], |row| {
            Ok(ColumnInfo {
                cid: row.get(0)?,
                name: row.get(1)?,
                type_name: row.get(2)?,
                notnull: row.get::<_, i32>(3)? != 0,
                dflt_value: row.get(4)?,
                pk: row.get::<_, i32>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    drop(pragma_stmt);

    // Build query with optional search
    // 🚀 性能优化：优化 LIKE 查询，避免前置通配符 '%xxx%' 的全表扫描
    let (query, count_query) = if let Some(search) = &searchQuery {
        // Create search conditions for all text columns
        let search_conditions: Vec<String> = columns
            .iter()
            .filter(|col| col.type_name.contains("TEXT") || col.type_name.contains("VARCHAR"))
            .map(|col| {
                let escaped_search = search.replace("'", "''");
                // 优先使用后缀通配符 'xxx%'，可以利用索引
                // 如果用户明确输入了通配符，则保留原样
                if escaped_search.contains('%') || escaped_search.contains('_') {
                    format!("{} LIKE '{}'", col.name, escaped_search)
                } else {
                    // 检查是否是精确匹配查询
                    if escaped_search.len() > 3 {
                        // 使用 >= 和 < 范围查询代替 LIKE（更快）
                        format!(
                            "({0} >= '{1}' AND {0} < '{1}z' OR {0} LIKE '%{1}%')",
                            col.name, escaped_search
                        )
                    } else {
                        // 短查询使用传统 LIKE
                        format!("{} LIKE '%{}%'", col.name, escaped_search)
                    }
                }
            })
            .collect();

        if search_conditions.is_empty() {
            (
                format!("SELECT * FROM {} LIMIT ? OFFSET ?", tableName),
                format!("SELECT COUNT(*) FROM {}", tableName),
            )
        } else {
            let where_clause = search_conditions.join(" OR ");
            (
                format!(
                    "SELECT * FROM {} WHERE {} LIMIT ? OFFSET ?",
                    tableName, where_clause
                ),
                format!("SELECT COUNT(*) FROM {} WHERE {}", tableName, where_clause),
            )
        }
    } else {
        (
            format!("SELECT * FROM {} LIMIT ? OFFSET ?", tableName),
            format!("SELECT COUNT(*) FROM {}", tableName),
        )
    };

    // Get total row count
    let total_rows: i64 = conn
        .query_row(&count_query, [], |row| row.get(0))
        .unwrap_or(0);

    // Calculate pagination
    let offset = (page - 1) * pageSize;
    let total_pages = (total_rows as f64 / pageSize as f64).ceil() as i64;

    // Query data
    let mut data_stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let rows: Vec<Map<String, JsonValue>> = data_stmt
        .query_map(params![pageSize, offset], |row| {
            let mut row_map = Map::new();

            for (idx, col) in columns.iter().enumerate() {
                let value = match row.get_ref(idx)? {
                    ValueRef::Null => JsonValue::Null,
                    ValueRef::Integer(i) => JsonValue::Number(serde_json::Number::from(i)),
                    ValueRef::Real(f) => {
                        if let Some(n) = serde_json::Number::from_f64(f) {
                            JsonValue::Number(n)
                        } else {
                            JsonValue::String(f.to_string())
                        }
                    }
                    ValueRef::Text(s) => JsonValue::String(String::from_utf8_lossy(s).to_string()),
                    ValueRef::Blob(b) => JsonValue::String(base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        b,
                    )),
                };
                row_map.insert(col.name.clone(), value);
            }

            Ok(row_map)
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(TableData {
        table_name: tableName,
        columns,
        rows,
        total_rows,
        page,
        page_size: pageSize,
        total_pages,
    })
}

/// Update a row in a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn storage_update_row(
    db: State<'_, AgentDb>,
    tableName: String,
    primaryKeyValues: HashMap<String, JsonValue>,
    updates: HashMap<String, JsonValue>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate table name
    if !is_valid_table_name(&conn, &tableName)? {
        return Err("Invalid table name".to_string());
    }

    // Build UPDATE query
    let set_clauses: Vec<String> = updates
        .keys()
        .enumerate()
        .map(|(idx, key)| format!("{} = ?{}", key, idx + 1))
        .collect();

    let where_clauses: Vec<String> = primaryKeyValues
        .keys()
        .enumerate()
        .map(|(idx, key)| format!("{} = ?{}", key, idx + updates.len() + 1))
        .collect();

    let query = format!(
        "UPDATE {} SET {} WHERE {}",
        tableName,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );

    // Prepare parameters
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Add update values
    for value in updates.values() {
        params.push(json_to_sql_value(value)?);
    }

    // Add where clause values
    for value in primaryKeyValues.values() {
        params.push(json_to_sql_value(value)?);
    }

    // Execute update
    conn.execute(
        &query,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| format!("Failed to update row: {}", e))?;

    Ok(())
}

/// Delete a row from a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn storage_delete_row(
    db: State<'_, AgentDb>,
    tableName: String,
    primaryKeyValues: HashMap<String, JsonValue>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate table name
    if !is_valid_table_name(&conn, &tableName)? {
        return Err("Invalid table name".to_string());
    }

    // Build DELETE query
    let where_clauses: Vec<String> = primaryKeyValues
        .keys()
        .enumerate()
        .map(|(idx, key)| format!("{} = ?{}", key, idx + 1))
        .collect();

    let query = format!(
        "DELETE FROM {} WHERE {}",
        tableName,
        where_clauses.join(" AND ")
    );

    // Prepare parameters
    let params: Vec<Box<dyn rusqlite::ToSql>> = primaryKeyValues
        .values()
        .map(json_to_sql_value)
        .collect::<Result<Vec<_>, _>>()?;

    // Execute delete
    conn.execute(
        &query,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| format!("Failed to delete row: {}", e))?;

    Ok(())
}

/// Insert a new row into a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn storage_insert_row(
    db: State<'_, AgentDb>,
    tableName: String,
    values: HashMap<String, JsonValue>,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate table name
    if !is_valid_table_name(&conn, &tableName)? {
        return Err("Invalid table name".to_string());
    }

    // Build INSERT query
    let columns: Vec<&String> = values.keys().collect();
    let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("?{}", i)).collect();

    let query = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        tableName,
        columns
            .iter()
            .map(|c| c.as_str())
            .collect::<Vec<_>>()
            .join(", "),
        placeholders.join(", ")
    );

    // Prepare parameters
    let params: Vec<Box<dyn rusqlite::ToSql>> = values
        .values()
        .map(json_to_sql_value)
        .collect::<Result<Vec<_>, _>>()?;

    // Execute insert
    conn.execute(
        &query,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| format!("Failed to insert row: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Execute a raw SQL query
#[tauri::command]
pub async fn storage_execute_sql(
    db: State<'_, AgentDb>,
    query: String,
) -> Result<QueryResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check if it's a SELECT query
    let is_select = query.trim().to_uppercase().starts_with("SELECT");

    if is_select {
        // Handle SELECT queries
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let column_count = stmt.column_count();

        // Get column names
        let columns: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();

        // Execute query and collect results
        let rows: Vec<Vec<JsonValue>> = stmt
            .query_map([], |row| {
                let mut row_values = Vec::new();
                for i in 0..column_count {
                    let value = match row.get_ref(i)? {
                        ValueRef::Null => JsonValue::Null,
                        ValueRef::Integer(n) => JsonValue::Number(serde_json::Number::from(n)),
                        ValueRef::Real(f) => {
                            if let Some(n) = serde_json::Number::from_f64(f) {
                                JsonValue::Number(n)
                            } else {
                                JsonValue::String(f.to_string())
                            }
                        }
                        ValueRef::Text(s) => {
                            JsonValue::String(String::from_utf8_lossy(s).to_string())
                        }
                        ValueRef::Blob(b) => JsonValue::String(base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            b,
                        )),
                    };
                    row_values.push(value);
                }
                Ok(row_values)
            })
            .map_err(|e| e.to_string())?
            .collect::<SqliteResult<Vec<_>>>()
            .map_err(|e| e.to_string())?;

        Ok(QueryResult {
            columns,
            rows,
            rows_affected: None,
            last_insert_rowid: None,
        })
    } else {
        // Handle non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
        let rows_affected = conn.execute(&query, []).map_err(|e| e.to_string())?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: Some(rows_affected as i64),
            last_insert_rowid: Some(conn.last_insert_rowid()),
        })
    }
}

/// Reset the entire database (with confirmation)
#[tauri::command]
pub async fn storage_reset_database(app: AppHandle) -> Result<(), String> {
    {
        // Drop all existing tables within a scoped block
        let db_state = app.state::<AgentDb>();
        let conn = db_state.0.lock().map_err(|e| e.to_string())?;

        // Disable foreign key constraints temporarily to allow dropping tables
        conn.execute("PRAGMA foreign_keys = OFF", [])
            .map_err(|e| format!("Failed to disable foreign keys: {}", e))?;

        // Drop tables - order doesn't matter with foreign keys disabled
        conn.execute("DROP TABLE IF EXISTS agent_runs", [])
            .map_err(|e| format!("Failed to drop agent_runs table: {}", e))?;
        conn.execute("DROP TABLE IF EXISTS agents", [])
            .map_err(|e| format!("Failed to drop agents table: {}", e))?;
        conn.execute("DROP TABLE IF EXISTS app_settings", [])
            .map_err(|e| format!("Failed to drop app_settings table: {}", e))?;

        // Re-enable foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| format!("Failed to re-enable foreign keys: {}", e))?;

        // Connection is automatically dropped at end of scope
    }

    // Re-initialize the database which will recreate all tables empty
    let new_conn = init_database(&app).map_err(|e| format!("Failed to reset database: {}", e))?;

    // Update the managed state with the new connection
    {
        let db_state = app.state::<AgentDb>();
        let mut conn_guard = db_state.0.lock().map_err(|e| e.to_string())?;
        *conn_guard = new_conn;
    }

    // Run VACUUM to optimize the database
    {
        let db_state = app.state::<AgentDb>();
        let conn = db_state.0.lock().map_err(|e| e.to_string())?;
        conn.execute("VACUUM", []).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Helper function to validate table name exists
fn is_valid_table_name(conn: &Connection, table_name: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            params![table_name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Helper function to convert JSON value to SQL value
fn json_to_sql_value(value: &JsonValue) -> Result<Box<dyn rusqlite::ToSql>, String> {
    match value {
        JsonValue::Null => Ok(Box::new(rusqlite::types::Null)),
        JsonValue::Bool(b) => Ok(Box::new(*b)),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(Box::new(i))
            } else if let Some(f) = n.as_f64() {
                Ok(Box::new(f))
            } else {
                Err("Invalid number value".to_string())
            }
        }
        JsonValue::String(s) => Ok(Box::new(s.clone())),
        _ => Err("Unsupported value type".to_string()),
    }
}

// ========== 🚀 性能监控命令 ==========

/// Database performance statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_tables: i64,
    pub total_indexes: i64,
    pub database_size_mb: f64,
    pub wal_enabled: bool,
    pub cache_size_mb: f64,
    pub page_count: i64,
    pub page_size: i64,
    pub usage_entries_count: i64,
    pub indexes: Vec<IndexInfo>,
}

/// Index information
#[derive(Debug, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub table_name: String,
    pub columns: String,
}

/// Get database performance statistics
#[tauri::command]
pub async fn storage_get_performance_stats(
    db: State<'_, AgentDb>,
) -> Result<DatabaseStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get total tables
    let total_tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Get total indexes
    let total_indexes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Get page count and size
    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .unwrap_or(0);

    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |row| row.get(0))
        .unwrap_or(4096);

    // Calculate database size
    let database_size_mb = (page_count * page_size) as f64 / (1024.0 * 1024.0);

    // Check if WAL is enabled
    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .unwrap_or_else(|_| "unknown".to_string());
    let wal_enabled = journal_mode.to_uppercase() == "WAL";

    // Get cache size
    let cache_size: i64 = conn
        .query_row("PRAGMA cache_size", [], |row| row.get(0))
        .unwrap_or(0);
    let cache_size_mb = (cache_size.abs() * page_size) as f64 / (1024.0 * 1024.0);

    // Get usage entries count
    let usage_entries_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usage_entries", [], |row| row.get(0))
        .unwrap_or(0);

    // Get index information
    let mut stmt = conn
        .prepare(
            "SELECT name, tbl_name FROM sqlite_master
             WHERE type='index' AND name NOT LIKE 'sqlite_%'
             ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let indexes: Vec<IndexInfo> = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let table_name: String = row.get(1)?;

            // Get index columns
            let columns = conn
                .query_row(&format!("PRAGMA index_info({})", name), [], |row| {
                    row.get::<_, String>(2)
                })
                .unwrap_or_else(|_| "unknown".to_string());

            Ok(IndexInfo {
                name,
                table_name,
                columns,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(DatabaseStats {
        total_tables,
        total_indexes,
        database_size_mb,
        wal_enabled,
        cache_size_mb,
        page_count,
        page_size,
        usage_entries_count,
        indexes,
    })
}

/// Analyze query performance
#[tauri::command]
pub async fn storage_analyze_query(
    db: State<'_, AgentDb>,
    query: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Use EXPLAIN QUERY PLAN to analyze query
    let analyze_query = format!("EXPLAIN QUERY PLAN {}", query);

    let mut stmt = conn.prepare(&analyze_query).map_err(|e| e.to_string())?;

    let mut result = String::new();
    let rows = stmt
        .query_map([], |row| {
            let detail: String = row.get(3)?;
            Ok(detail)
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let detail = row.map_err(|e| e.to_string())?;
        result.push_str(&detail);
        result.push('\n');
    }

    Ok(result)
}
