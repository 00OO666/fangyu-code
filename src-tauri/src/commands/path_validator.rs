//! 路径验证模块 - 防止路径遍历攻击
//! 
//! 提供路径规范化和白名单验证功能，确保 IPC 命令只能访问允许的目录。

use std::path::{Path, PathBuf};
use std::env;

/// 路径验证错误类型
#[derive(Debug, Clone)]
pub enum PathValidationError {
    /// 路径包含非法字符或模式
    InvalidPath(String),
    /// 路径遍历尝试（如 ../）
    PathTraversal(String),
    /// 路径不在允许的目录范围内
    NotInAllowedScope(String),
    /// 路径不存在
    PathNotFound(String),
}

impl std::fmt::Display for PathValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PathValidationError::InvalidPath(msg) => write!(f, "无效路径: {}", msg),
            PathValidationError::PathTraversal(msg) => write!(f, "路径遍历被阻止: {}", msg),
            PathValidationError::NotInAllowedScope(msg) => write!(f, "路径不在允许范围内: {}", msg),
            PathValidationError::PathNotFound(msg) => write!(f, "路径不存在: {}", msg),
        }
    }
}

impl std::error::Error for PathValidationError {}

/// 路径验证器
pub struct PathValidator {
    /// 允许访问的目录白名单
    allowed_directories: Vec<PathBuf>,
}

impl PathValidator {
    /// 创建新的路径验证器
    pub fn new() -> Self {
        let mut allowed_directories = Vec::new();
        
        // 添加用户主目录
        if let Some(home) = dirs::home_dir() {
            allowed_directories.push(home);
        }
        
        // 添加用户文档目录
        if let Some(docs) = dirs::document_dir() {
            allowed_directories.push(docs);
        }
        
        // 添加用户桌面目录
        if let Some(desktop) = dirs::desktop_dir() {
            allowed_directories.push(desktop);
        }
        
        // 添加用户下载目录
        if let Some(downloads) = dirs::download_dir() {
            allowed_directories.push(downloads);
        }
        
        // 添加临时目录
        allowed_directories.push(env::temp_dir());
        
        Self { allowed_directories }
    }
    
    /// 添加额外的允许目录
    pub fn add_allowed_directory(&mut self, path: PathBuf) {
        if !self.allowed_directories.contains(&path) {
            self.allowed_directories.push(path);
        }
    }
    
    /// 规范化路径（解析 .., ., 符号链接等）
    pub fn normalize_path(&self, path: &str) -> Result<PathBuf, PathValidationError> {
        let path = Path::new(path);
        
        // 检查是否包含明显的路径遍历模式
        let path_str = path.to_string_lossy();
        if path_str.contains("..") {
            // 进一步检查是否是真正的路径遍历
            for component in path.components() {
                if let std::path::Component::ParentDir = component {
                    return Err(PathValidationError::PathTraversal(
                        "路径包含 '..' 组件".to_string()
                    ));
                }
            }
        }
        
        // 尝试规范化路径
        match path.canonicalize() {
            Ok(canonical) => Ok(canonical),
            Err(_) => {
                // 如果路径不存在，尝试规范化父目录
                if let Some(parent) = path.parent() {
                    if let Ok(canonical_parent) = parent.canonicalize() {
                        if let Some(file_name) = path.file_name() {
                            return Ok(canonical_parent.join(file_name));
                        }
                    }
                }
                // 返回原始路径（转换为绝对路径）
                if path.is_absolute() {
                    Ok(path.to_path_buf())
                } else {
                    Ok(env::current_dir()
                        .unwrap_or_default()
                        .join(path))
                }
            }
        }
    }
    
    /// 验证路径是否在允许的目录范围内
    pub fn validate_path(&self, path: &str) -> Result<PathBuf, PathValidationError> {
        let normalized = self.normalize_path(path)?;
        
        // 检查路径是否在任何允许的目录下
        for allowed_dir in &self.allowed_directories {
            if let Ok(canonical_allowed) = allowed_dir.canonicalize() {
                if normalized.starts_with(&canonical_allowed) {
                    return Ok(normalized);
                }
            }
            // 也检查未规范化的路径（处理符号链接等情况）
            if normalized.starts_with(allowed_dir) {
                return Ok(normalized);
            }
        }
        
        Err(PathValidationError::NotInAllowedScope(
            format!("路径 '{}' 不在允许的目录范围内", normalized.display())
        ))
    }
    
    /// 验证路径是否存在
    pub fn validate_exists(&self, path: &str) -> Result<PathBuf, PathValidationError> {
        let validated = self.validate_path(path)?;
        
        if validated.exists() {
            Ok(validated)
        } else {
            Err(PathValidationError::PathNotFound(
                format!("路径 '{}' 不存在", validated.display())
            ))
        }
    }
    
    /// 验证目录路径
    pub fn validate_directory(&self, path: &str) -> Result<PathBuf, PathValidationError> {
        let validated = self.validate_exists(path)?;
        
        if validated.is_dir() {
            Ok(validated)
        } else {
            Err(PathValidationError::InvalidPath(
                format!("'{}' 不是目录", validated.display())
            ))
        }
    }
    
    /// 验证文件路径
    pub fn validate_file(&self, path: &str) -> Result<PathBuf, PathValidationError> {
        let validated = self.validate_exists(path)?;
        
        if validated.is_file() {
            Ok(validated)
        } else {
            Err(PathValidationError::InvalidPath(
                format!("'{}' 不是文件", validated.display())
            ))
        }
    }
}

impl Default for PathValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// 全局路径验证器实例（线程安全）
lazy_static::lazy_static! {
    pub static ref GLOBAL_PATH_VALIDATOR: PathValidator = PathValidator::new();
}

/// 快捷函数：验证并规范化路径
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    GLOBAL_PATH_VALIDATOR
        .validate_path(path)
        .map_err(|e| e.to_string())
}

/// 快捷函数：验证目录路径
pub fn validate_directory(path: &str) -> Result<PathBuf, String> {
    GLOBAL_PATH_VALIDATOR
        .validate_directory(path)
        .map_err(|e| e.to_string())
}

/// 快捷函数：验证文件路径
pub fn validate_file(path: &str) -> Result<PathBuf, String> {
    GLOBAL_PATH_VALIDATOR
        .validate_file(path)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_path_traversal_detection() {
        let validator = PathValidator::new();
        
        // 应该拒绝路径遍历
        assert!(validator.normalize_path("../../../etc/passwd").is_err());
        assert!(validator.normalize_path("/home/user/../../../etc/passwd").is_err());
    }
    
    #[test]
    fn test_allowed_directories() {
        let validator = PathValidator::new();
        
        // 用户主目录应该被允许
        if let Some(home) = dirs::home_dir() {
            let test_path = home.join("test.txt");
            assert!(validator.validate_path(test_path.to_str().unwrap()).is_ok());
        }
    }
}
