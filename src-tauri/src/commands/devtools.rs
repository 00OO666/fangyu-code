use tauri::Manager;

/// 打开开发者工具 (F12)
#[tauri::command]
pub fn open_devtools(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        webview_window.open_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        // 生产模式也允许打开（用于调试）
        webview_window.open_devtools();
        Ok(())
    }
}

/// 关闭开发者工具
#[tauri::command]
pub fn close_devtools(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    webview_window.close_devtools();
    Ok(())
}

/// 检查开发者工具是否打开
#[tauri::command]
pub fn is_devtools_open(webview_window: tauri::WebviewWindow) -> Result<bool, String> {
    Ok(webview_window.is_devtools_open())
}
