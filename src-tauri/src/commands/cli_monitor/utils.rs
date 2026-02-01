//! CLI 监控模块的工具函数

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// 项目颜色列表（12种颜色）
const PROJECT_COLORS: [&str; 12] = [
    "#FF6B6B", // 珊瑚红
    "#4ECDC4", // 青绿色
    "#45B7D1", // 天蓝色
    "#FFA07A", // 浅橙色
    "#98D8C8", // 薄荷绿
    "#F7DC6F", // 柠檬黄
    "#BB8FCE", // 淡紫色
    "#85C1E2", // 浅蓝色
    "#F8B739", // 金黄色
    "#52B788", // 森林绿
    "#E76F51", // 橙红色
    "#2A9D8F", // 深青色
];

/// 从路径中提取项目名称
///
/// # 示例
/// ```
/// let name = extract_project_name("F:\\Fangyu-Code-Dev");
/// assert_eq!(name, "Fangyu-Code-Dev");
/// ```
pub fn extract_project_name(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

/// 根据项目名称生成颜色
///
/// 使用简单的哈希算法确保同一个项目总是得到相同的颜色
pub fn get_project_color(project_name: &str) -> String {
    let hash = project_name
        .chars()
        .fold(0u32, |acc, c| acc.wrapping_add(c as u32).wrapping_mul(31));

    let index = (hash as usize) % PROJECT_COLORS.len();
    PROJECT_COLORS[index].to_string()
}

/// 获取文件的修改时间戳（秒）
pub fn get_file_mtime(path: &Path) -> Result<u64, std::io::Error> {
    let metadata = std::fs::metadata(path)?;
    let modified = metadata.modified()?;
    let duration = modified.duration_since(UNIX_EPOCH)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

    Ok(duration.as_secs())
}

/// 获取当前时间戳（秒）
pub fn get_current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// 检查文件是否在指定时间内被修改过
///
/// # 参数
/// - `file_mtime`: 文件的修改时间戳
/// - `seconds`: 时间范围（秒）
///
/// # 返回
/// 如果文件在指定时间内被修改过，返回 true
pub fn is_recently_modified(file_mtime: u64, seconds: u64) -> bool {
    let current = get_current_timestamp();
    current.saturating_sub(file_mtime) < seconds
}

/// 验证路径是否在允许的目录内
///
/// 防止路径遍历攻击
pub fn validate_path(path: &Path, allowed_dir: &Path) -> Result<(), String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    let allowed_canonical = allowed_dir
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize allowed dir: {}", e))?;

    if !canonical.starts_with(&allowed_canonical) {
        return Err(format!(
            "Path {:?} is outside allowed directory {:?}",
            canonical, allowed_canonical
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_project_name() {
        assert_eq!(extract_project_name("F:\\Fangyu-Code-Dev"), "Fangyu-Code-Dev");
        assert_eq!(extract_project_name("/home/user/project"), "project");
        assert_eq!(extract_project_name(""), "Unknown");
    }

    #[test]
    fn test_get_project_color() {
        let color1 = get_project_color("Fangyu-Code-Dev");
        let color2 = get_project_color("Fangyu-Code-Dev");
        assert_eq!(color1, color2); // 同一个项目应该得到相同的颜色

        let color3 = get_project_color("Another-Project");
        // 不同项目可能得到不同颜色（但不保证）
        assert!(color3.starts_with('#'));
    }

    #[test]
    fn test_is_recently_modified() {
        let current = get_current_timestamp();

        // 1 秒前修改
        assert!(is_recently_modified(current - 1, 5));

        // 10 秒前修改
        assert!(!is_recently_modified(current - 10, 5));

        // 刚刚修改
        assert!(is_recently_modified(current, 5));
    }
}
