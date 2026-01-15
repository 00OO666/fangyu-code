use std::process::Command as StdCommand;
use super::path_validator::validate_directory;

/// Open a directory in the system file explorer (cross-platform)
/// 
/// 安全性: 使用路径验证防止路径遍历攻击
#[tauri::command]
pub async fn open_directory_in_explorer(directory_path: String) -> Result<(), String> {
    // 🔒 安全验证: 规范化路径并检查是否在允许范围内
    let validated_path = validate_directory(&directory_path)?;
    let path_str = validated_path.to_string_lossy().to_string();
    
    log::info!("打开目录: {}", path_str);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = StdCommand::new("explorer");
        cmd.arg(&path_str);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

/// Open a file with the system's default application (cross-platform)
/// 
/// 安全性: 使用路径验证防止路径遍历攻击
#[tauri::command]
pub async fn open_file_with_default_app(file_path: String) -> Result<(), String> {
    use super::path_validator::validate_file;
    
    // 🔒 安全验证: 规范化路径并检查是否在允许范围内
    let validated_path = validate_file(&file_path)?;
    let path_str = validated_path.to_string_lossy().to_string();
    
    log::info!("打开文件: {}", path_str);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Use 'start' command through cmd to open file with default app
        let mut cmd = StdCommand::new("cmd");
        cmd.args(&["/C", "start", "", &path_str]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}
