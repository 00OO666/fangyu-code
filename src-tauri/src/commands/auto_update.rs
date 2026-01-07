/**
 * 自动更新系统
 *
 * 功能：
 * 1. 检测开发目录的新构建
 * 2. 比较版本号
 * 3. 一键重启到新版本
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub current_version: String,
    pub current_build_time: Option<String>,
    pub latest_version: String,
    pub latest_build_time: Option<String>,
    pub update_available: bool,
    pub dev_build_path: Option<String>,
}

/// 获取当前应用版本
#[tauri::command]
pub fn get_current_version(app: AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

/// 检查是否有可用更新
#[tauri::command]
pub fn check_for_updates(app: AppHandle) -> Result<VersionInfo, String> {
    let current_version = app.package_info().version.to_string();

    // 获取当前运行的 exe 路径和构建时间
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("无法获取当前 exe 路径: {}", e))?;

    let current_build_time = get_file_modified_time(&current_exe);

    // 检测开发目录的最新构建
    let dev_build_path = PathBuf::from("F:\\Fangyu-Code-Dev\\src-tauri\\target\\debug\\fangyu-code.exe");

    if !dev_build_path.exists() {
        return Ok(VersionInfo {
            current_version: current_version.clone(),
            current_build_time,
            latest_version: current_version,
            latest_build_time: None,
            update_available: false,
            dev_build_path: None,
        });
    }

    let latest_build_time = get_file_modified_time(&dev_build_path);

    // 读取开发版本号（从 Cargo.toml 或 tauri.conf.json）
    let latest_version = get_dev_version()
        .unwrap_or_else(|_| current_version.clone());

    // 比较构建时间判断是否有更新
    let update_available = is_newer_build(&current_build_time, &latest_build_time);

    Ok(VersionInfo {
        current_version,
        current_build_time,
        latest_version,
        latest_build_time,
        update_available,
        dev_build_path: Some(dev_build_path.to_string_lossy().to_string()),
    })
}

/// 重启到新版本
#[tauri::command]
pub async fn restart_to_new_version(app: AppHandle) -> Result<(), String> {
    let dev_build_path = "F:\\Fangyu-Code-Dev\\src-tauri\\target\\debug\\fangyu-code.exe";

    if !PathBuf::from(dev_build_path).exists() {
        return Err("开发构建不存在".to_string());
    }

    // 创建/更新桌面快捷方式
    #[cfg(target_os = "windows")]
    {
        if let Err(e) = create_desktop_shortcut(dev_build_path) {
            log::warn!("创建桌面快捷方式失败: {}", e);
            // 不中断更新流程
        }
    }

    // 启动新版本
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("cmd")
            .args(&["/C", "start", "", dev_build_path])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| format!("无法启动新版本: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(dev_build_path)
            .spawn()
            .map_err(|e| format!("无法启动新版本: {}", e))?;
    }

    // 延迟退出当前进程
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    app.exit(0);

    Ok(())
}

/// 创建桌面快捷方式（Windows）
#[cfg(target_os = "windows")]
fn create_desktop_shortcut(target_path: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // 使用 PowerShell 获取真实的桌面路径（支持重定向到 E:\Desktop）
    let desktop_path_output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-WindowStyle", "Hidden",
            "-Command",
            "[Environment]::GetFolderPath('Desktop')",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("无法获取桌面路径: {}", e))?;

    let desktop_path = String::from_utf8_lossy(&desktop_path_output.stdout)
        .trim()
        .to_string();

    if desktop_path.is_empty() {
        return Err("桌面路径为空".to_string());
    }

    // 快捷方式路径
    let shortcut_path = PathBuf::from(&desktop_path).join("Fangyu Code.lnk");

    // 使用 PowerShell 创建快捷方式
    let ps_script = format!(
        r#"$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut("{}"); $Shortcut.TargetPath = "{}"; $Shortcut.WorkingDirectory = "{}"; $Shortcut.Description = "Fangyu Code v1.2.0 (Dev)"; $Shortcut.Save()"#,
        shortcut_path.to_string_lossy(),
        target_path,
        PathBuf::from(target_path)
            .parent()
            .unwrap_or(&PathBuf::from("F:\\Fangyu-Code-Dev\\src-tauri\\target\\debug"))
            .to_string_lossy()
    );

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("PowerShell 执行失败: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "创建快捷方式失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    log::info!("桌面快捷方式已更新: {}", shortcut_path.display());
    Ok(())
}

/// 获取文件修改时间
fn get_file_modified_time(path: &PathBuf) -> Option<String> {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .map(|time| {
            let datetime: chrono::DateTime<chrono::Local> = time.into();
            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
        })
}

/// 比较构建时间
fn is_newer_build(current: &Option<String>, latest: &Option<String>) -> bool {
    match (current, latest) {
        (Some(curr), Some(lat)) => lat > curr,
        (None, Some(_)) => true,
        _ => false,
    }
}

/// 获取开发版本号
fn get_dev_version() -> Result<String, String> {
    // 从 tauri.conf.json 读取版本号
    let config_path = PathBuf::from("F:\\Fangyu-Code-Dev\\src-tauri\\tauri.conf.json");

    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }

    let content = fs::read_to_string(config_path)
        .map_err(|e| format!("无法读取配置文件: {}", e))?;

    // 简单解析版本号（正则匹配）
    if let Some(version_line) = content.lines().find(|line| line.contains("\"version\"")) {
        if let Some(version) = version_line.split('"').nth(3) {
            return Ok(version.to_string());
        }
    }

    Err("无法解析版本号".to_string())
}

/// 下载并应用更新（预留接口，用于将来的远程更新）
#[tauri::command]
pub async fn download_and_install_update(
    _update_url: String,
    _app: AppHandle,
) -> Result<(), String> {
    // TODO: 实现远程更新下载
    // 1. 下载更新包
    // 2. 验证签名
    // 3. 解压并替换文件
    // 4. 重启应用

    Err("远程更新功能尚未实现，请使用本地更新".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_build(
            &Some("2025-12-27 10:00:00".to_string()),
            &Some("2025-12-28 10:00:00".to_string())
        ));

        assert!(!is_newer_build(
            &Some("2025-12-28 10:00:00".to_string()),
            &Some("2025-12-27 10:00:00".to_string())
        ));
    }
}
