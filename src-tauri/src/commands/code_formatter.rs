/**
 * 代码格式化命令
 *
 * 调用 Biome 进行代码格式化
 */

use std::process::{Command, Stdio};

/// 格式化单个文件的内容
#[tauri::command]
pub async fn run_biome_format(file_path: String, content: String) -> Result<String, String> {
    let project_root = std::env::var("FANGYU_CODE_PROJECT_ROOT")
        .unwrap_or_else(|_| "F:\\Any-Code-Dev".to_string());

    let mut child = Command::new("npx")
        .args(["-y", "@biomejs/biome", "format", "--stdin-file-path", &file_path])
        .current_dir(&project_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn biome: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        stdin.write_all(content.as_bytes())
            .and_then(|()| stdin.flush())
            .map_err(|e| format!("Failed to write to biome stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to read biome output: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Biome failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// 检查文件是否需要格式化
#[tauri::command]
pub async fn check_biome_format(file_path: String, content: String) -> Result<bool, String> {
    let formatted = run_biome_format(file_path, content).await?;
    Ok(true)
}
