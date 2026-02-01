// CLI 监控系统 - 窗口聚焦器
// 使用 Windows API 将指定窗口置于前台

#[cfg(windows)]
use winapi::um::winuser::{SetForegroundWindow, ShowWindow, IsWindow, SW_RESTORE};
#[cfg(windows)]
use winapi::shared::windef::HWND;

/// 窗口聚焦器
pub struct WindowFocuser;

impl WindowFocuser {
    /// 聚焦指定窗口
    #[cfg(windows)]
    pub fn focus_window(hwnd: isize) -> anyhow::Result<()> {
        unsafe {
            let hwnd = hwnd as HWND;

            // 检查窗口是否存在
            if IsWindow(hwnd) == 0 {
                log::error!("[WindowFocuser] Window does not exist: hwnd={}", hwnd as isize);
                return Err(anyhow::anyhow!("Window does not exist"));
            }

            log::info!("[WindowFocuser] Focusing window: hwnd={}", hwnd as isize);

            // 先恢复窗口（如果最小化）
            ShowWindow(hwnd, SW_RESTORE);

            // 将窗口置于前台
            let result = SetForegroundWindow(hwnd);

            if result == 0 {
                log::error!("[WindowFocuser] Failed to set foreground window: hwnd={}", hwnd as isize);
                return Err(anyhow::anyhow!("Failed to set foreground window. This may be due to insufficient permissions or the window being in a different security context."));
            }

            log::info!("[WindowFocuser] Successfully focused window: hwnd={}", hwnd as isize);
        }

        Ok(())
    }

    /// 聚焦指定窗口（非 Windows 平台）
    #[cfg(not(windows))]
    pub fn focus_window(_hwnd: isize) -> anyhow::Result<()> {
        // 非 Windows 平台暂不支持
        log::warn!("[WindowFocuser] Window focusing is not supported on this platform");
        Err(anyhow::anyhow!("Window focusing is not supported on this platform"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_focuser_creation() {
        let _focuser = WindowFocuser;
        assert!(true, "WindowFocuser should be created successfully");
    }

    #[test]
    #[cfg(windows)]
    fn test_focus_window_invalid_hwnd() {
        // 测试无效的窗口句柄
        let result = WindowFocuser::focus_window(0);
        assert!(result.is_err(), "Should fail for invalid window handle");
    }

    #[test]
    #[cfg(not(windows))]
    fn test_focus_window_non_windows() {
        // 测试非 Windows 平台
        let result = WindowFocuser::focus_window(12345);
        assert!(result.is_err(), "Should fail on non-Windows platform");
    }
}

