//! Super AI Agent Desktop - Tauri 命令接口
//! 
//! 提供文件操作、Shell 执行、进程管理的 Tauri 命令
//! Requirements: 8.1, 8.2, 8.5

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::command;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};

// =============================================================================
// 类型定义
// =============================================================================

/// 操作风险级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// 操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    FileCreate,
    FileModify,
    FileDelete,
    CommandExecute,
    GitCommit,
    GitPush,
    InstallPackage,
    ConfigChange,
    NetworkRequest,
}

/// 文件操作结果
#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub path: String,
    pub error: Option<String>,
    pub content: Option<String>,
}

/// 命令执行结果
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

/// 进程信息
#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: u32,
    pub command: String,
    pub status: String,
    pub started_at: u64,
}

/// 安全验证结果
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityValidation {
    pub valid: bool,
    pub risk_level: RiskLevel,
    pub warnings: Vec<String>,
    pub blocked_reason: Option<String>,
}


// =============================================================================
// 文件操作命令
// =============================================================================

/// 读取文件内容
/// Requirements: 8.1
#[command]
pub async fn super_agent_read_file(path: String) -> Result<FileOperationResult, String> {
    let path_buf = PathBuf::from(&path);
    
    // 安全检查
    if !is_path_safe(&path_buf) {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some("Path is outside workspace or contains unsafe patterns".to_string()),
            content: None,
        });
    }
    
    match tokio::fs::read_to_string(&path_buf).await {
        Ok(content) => Ok(FileOperationResult {
            success: true,
            path,
            error: None,
            content: Some(content),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            path,
            error: Some(e.to_string()),
            content: None,
        }),
    }
}

/// 写入文件内容
/// Requirements: 8.1
#[command]
pub async fn super_agent_write_file(path: String, content: String) -> Result<FileOperationResult, String> {
    let path_buf = PathBuf::from(&path);
    
    // 安全检查
    if !is_path_safe(&path_buf) {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some("Path is outside workspace or contains unsafe patterns".to_string()),
            content: None,
        });
    }
    
    // 确保父目录存在
    if let Some(parent) = path_buf.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return Ok(FileOperationResult {
                success: false,
                path,
                error: Some(format!("Failed to create parent directory: {}", e)),
                content: None,
            });
        }
    }
    
    match tokio::fs::write(&path_buf, &content).await {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            path,
            error: None,
            content: Some(content),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            path,
            error: Some(e.to_string()),
            content: None,
        }),
    }
}

/// 删除文件
/// Requirements: 8.1
#[command]
pub async fn super_agent_delete_file(path: String) -> Result<FileOperationResult, String> {
    let path_buf = PathBuf::from(&path);
    
    // 安全检查
    if !is_path_safe(&path_buf) {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some("Path is outside workspace or contains unsafe patterns".to_string()),
            content: None,
        });
    }
    
    match tokio::fs::remove_file(&path_buf).await {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            path,
            error: None,
            content: None,
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            path,
            error: Some(e.to_string()),
            content: None,
        }),
    }
}

/// 字符串替换（精确替换）
/// Requirements: 8.1
#[command]
pub async fn super_agent_str_replace(
    path: String,
    old_str: String,
    new_str: String,
) -> Result<FileOperationResult, String> {
    let path_buf = PathBuf::from(&path);
    
    // 安全检查
    if !is_path_safe(&path_buf) {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some("Path is outside workspace or contains unsafe patterns".to_string()),
            content: None,
        });
    }
    
    // 读取文件
    let content = match tokio::fs::read_to_string(&path_buf).await {
        Ok(c) => c,
        Err(e) => {
            return Ok(FileOperationResult {
                success: false,
                path,
                error: Some(format!("Failed to read file: {}", e)),
                content: None,
            });
        }
    };
    
    // 检查唯一匹配
    let matches: Vec<_> = content.match_indices(&old_str).collect();
    if matches.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some("Old string not found in file".to_string()),
            content: None,
        });
    }
    if matches.len() > 1 {
        return Ok(FileOperationResult {
            success: false,
            path,
            error: Some(format!("Old string found {} times, must be unique", matches.len())),
            content: None,
        });
    }
    
    // 执行替换
    let new_content = content.replacen(&old_str, &new_str, 1);
    
    match tokio::fs::write(&path_buf, &new_content).await {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            path,
            error: None,
            content: Some(new_content),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            path,
            error: Some(e.to_string()),
            content: None,
        }),
    }
}


// =============================================================================
// Shell 执行命令
// =============================================================================

/// 执行 Shell 命令
/// Requirements: 8.2
#[command]
pub async fn super_agent_execute_command(
    command: String,
    cwd: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<CommandResult, String> {
    let start = std::time::Instant::now();
    
    // 安全检查
    let validation = validate_command(&command);
    if !validation.valid {
        return Ok(CommandResult {
            success: false,
            stdout: String::new(),
            stderr: validation.blocked_reason.unwrap_or_else(|| "Command blocked".to_string()),
            exit_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }
    
    // 构建命令
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", &command]);
        c
    };
    
    // 设置工作目录
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    // 执行命令
    let timeout = timeout_ms.unwrap_or(30000);
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(timeout),
        cmd.output(),
    ).await;
    
    match result {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            
            Ok(CommandResult {
                success: output.status.success(),
                stdout,
                stderr,
                exit_code: output.status.code(),
                duration_ms: start.elapsed().as_millis() as u64,
            })
        }
        Ok(Err(e)) => Ok(CommandResult {
            success: false,
            stdout: String::new(),
            stderr: e.to_string(),
            exit_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
        }),
        Err(_) => Ok(CommandResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Command timed out after {}ms", timeout),
            exit_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
        }),
    }
}

/// 检查命令是否为长时间运行命令
/// Requirements: 8.2
#[command]
pub fn super_agent_is_long_running(command: String) -> bool {
    let long_running_patterns = [
        "npm run dev",
        "npm start",
        "yarn dev",
        "yarn start",
        "pnpm dev",
        "pnpm start",
        "webpack --watch",
        "vite",
        "next dev",
        "nuxt dev",
        "python manage.py runserver",
        "flask run",
        "cargo watch",
        "nodemon",
        "jest --watch",
        "vitest --watch",
    ];
    
    let cmd_lower = command.to_lowercase();
    long_running_patterns.iter().any(|p| cmd_lower.contains(p))
}


// =============================================================================
// 安全验证
// =============================================================================

/// 验证命令安全性
/// Requirements: 8.5
#[command]
pub fn super_agent_validate_command(command: String) -> SecurityValidation {
    validate_command(&command)
}

/// 验证路径安全性
/// Requirements: 8.5
#[command]
pub fn super_agent_validate_path(path: String) -> SecurityValidation {
    let path_buf = PathBuf::from(&path);
    
    let mut warnings = Vec::new();
    let mut risk_level = RiskLevel::Low;
    
    // 检查路径遍历
    let path_str = path.to_lowercase();
    if path_str.contains("..") {
        return SecurityValidation {
            valid: false,
            risk_level: RiskLevel::Critical,
            warnings: vec!["Path traversal detected".to_string()],
            blocked_reason: Some("Path contains '..' which could escape workspace".to_string()),
        };
    }
    
    // 检查敏感路径
    let sensitive_patterns = [
        "/etc/", "/var/", "/usr/", "/bin/", "/sbin/",
        "c:\\windows", "c:\\program files",
        ".ssh", ".gnupg", ".aws", ".azure",
    ];
    
    for pattern in sensitive_patterns {
        if path_str.contains(pattern) {
            risk_level = RiskLevel::High;
            warnings.push(format!("Path contains sensitive location: {}", pattern));
        }
    }
    
    // 检查配置文件
    let config_patterns = [".env", "config", "secret", "credential", "password"];
    for pattern in config_patterns {
        if path_str.contains(pattern) {
            if risk_level != RiskLevel::High {
                risk_level = RiskLevel::Medium;
            }
            warnings.push(format!("Path may contain sensitive data: {}", pattern));
        }
    }
    
    SecurityValidation {
        valid: true,
        risk_level,
        warnings,
        blocked_reason: None,
    }
}

/// 评估操作风险
/// Requirements: 8.5
#[command]
pub fn super_agent_assess_risk(
    operation_type: OperationType,
    details: Option<HashMap<String, String>>,
) -> RiskLevel {
    let base_risk = match operation_type {
        OperationType::FileCreate => RiskLevel::Low,
        OperationType::FileModify => RiskLevel::Medium,
        OperationType::FileDelete => RiskLevel::High,
        OperationType::CommandExecute => RiskLevel::High,
        OperationType::GitCommit => RiskLevel::Medium,
        OperationType::GitPush => RiskLevel::High,
        OperationType::InstallPackage => RiskLevel::Medium,
        OperationType::ConfigChange => RiskLevel::High,
        OperationType::NetworkRequest => RiskLevel::Low,
    };
    
    // 根据详情调整风险级别
    if let Some(details) = details {
        if let Some(command) = details.get("command") {
            let validation = validate_command(command);
            if validation.risk_level == RiskLevel::Critical {
                return RiskLevel::Critical;
            }
        }
        
        if let Some(path) = details.get("path") {
            let path_lower = path.to_lowercase();
            if path_lower.contains(".env") || path_lower.contains("secret") {
                return RiskLevel::High;
            }
        }
    }
    
    base_risk
}


// =============================================================================
// 辅助函数
// =============================================================================

/// 检查路径是否安全
fn is_path_safe(path: &PathBuf) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    // 检查路径遍历
    if path_str.contains("..") {
        return false;
    }
    
    // 检查系统目录
    let blocked_paths = [
        "/etc/", "/var/", "/usr/", "/bin/", "/sbin/", "/boot/", "/root/",
        "c:\\windows", "c:\\program files", "c:\\programdata",
    ];
    
    for blocked in blocked_paths {
        if path_str.starts_with(blocked) {
            return false;
        }
    }
    
    true
}

/// 验证命令安全性
fn validate_command(command: &str) -> SecurityValidation {
    let cmd_lower = command.to_lowercase();
    let mut warnings = Vec::new();
    let mut risk_level = RiskLevel::Medium;
    
    // 危险命令模式
    let critical_patterns = [
        ("rm -rf", "Recursive force delete"),
        ("rm -fr", "Recursive force delete"),
        ("del /s /q", "Recursive quiet delete"),
        ("format ", "Disk format"),
        ("mkfs", "Filesystem format"),
        ("dd if=", "Direct disk write"),
        ("drop database", "Database drop"),
        ("truncate table", "Table truncate"),
        (":(){:|:&};:", "Fork bomb"),
        ("chmod 777", "Insecure permissions"),
        ("curl | sh", "Remote code execution"),
        ("wget | sh", "Remote code execution"),
        ("curl | bash", "Remote code execution"),
        ("wget | bash", "Remote code execution"),
    ];
    
    for (pattern, description) in critical_patterns {
        if cmd_lower.contains(pattern) {
            return SecurityValidation {
                valid: false,
                risk_level: RiskLevel::Critical,
                warnings: vec![description.to_string()],
                blocked_reason: Some(format!("Dangerous command pattern detected: {}", pattern)),
            };
        }
    }
    
    // 高风险命令模式
    let high_risk_patterns = [
        ("sudo", "Elevated privileges"),
        ("su ", "Switch user"),
        ("git push --force", "Force push"),
        ("git reset --hard", "Hard reset"),
        ("npm publish", "Package publish"),
        ("yarn publish", "Package publish"),
        ("docker rm", "Container removal"),
        ("kubectl delete", "Kubernetes deletion"),
    ];
    
    for (pattern, description) in high_risk_patterns {
        if cmd_lower.contains(pattern) {
            risk_level = RiskLevel::High;
            warnings.push(description.to_string());
        }
    }
    
    // 中等风险命令模式
    let medium_risk_patterns = [
        ("npm install", "Package installation"),
        ("yarn add", "Package installation"),
        ("pip install", "Package installation"),
        ("cargo install", "Package installation"),
        ("git commit", "Git commit"),
        ("docker build", "Docker build"),
    ];
    
    for (pattern, description) in medium_risk_patterns {
        if cmd_lower.contains(pattern) && risk_level != RiskLevel::High {
            risk_level = RiskLevel::Medium;
            warnings.push(description.to_string());
        }
    }
    
    SecurityValidation {
        valid: true,
        risk_level,
        warnings,
        blocked_reason: None,
    }
}

/// 脱敏敏感信息
#[command]
pub fn super_agent_redact_sensitive(text: String) -> String {
    let mut result = text;
    
    // API Keys - 使用 (?:...) 避免字符类中的引号问题
    let api_key_pattern = regex::Regex::new(r#"(?i)(api[_-]?key|apikey|api_secret)[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?"#).unwrap();
    result = api_key_pattern.replace_all(&result, "$1=[REDACTED]").to_string();
    
    // Bearer tokens
    let bearer_pattern = regex::Regex::new(r"(?i)bearer\s+[a-zA-Z0-9_.-]+").unwrap();
    result = bearer_pattern.replace_all(&result, "Bearer [REDACTED]").to_string();
    
    // Passwords
    let password_pattern = regex::Regex::new(r#"(?i)(password|passwd|pwd)[=:]\s*['"]?[^'"\s]+['"]?"#).unwrap();
    result = password_pattern.replace_all(&result, "$1=[REDACTED]").to_string();
    
    // AWS keys
    let aws_pattern = regex::Regex::new(r"(?i)(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}").unwrap();
    result = aws_pattern.replace_all(&result, "[AWS_KEY_REDACTED]").to_string();
    
    // Private keys
    let private_key_pattern = regex::Regex::new(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----").unwrap();
    result = private_key_pattern.replace_all(&result, "[PRIVATE_KEY_REDACTED]").to_string();
    
    result
}
