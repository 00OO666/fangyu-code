// CLI 监控系统 - 窗口聚焦器
// 使用 Windows API 将指定窗口置于前台

#[cfg(windows)]
use winapi::um::winuser::{SetForegroundWindow, ShowWindow, SW_RESTORE};
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

            // 先恢复窗口（如果最小化）
            ShowWindow(hwnd, SW_RESTORE);

            // 将窗口置于前台
            let result = SetForegroundWindow(hwnd);

            if result == 0 {
                return Err(anyhow::anyhow!("Failed to set foreground window"));
            }
        }

        Ok(())
    }

    /// 聚焦指定窗口（非 Windows 平台）
    #[cfg(not(windows))]
    pub fn focus_window(_hwnd: isize) -> anyhow::Result<()> {
        // 非 Windows 平台暂不支持
        Err(anyhow::anyhow!("Window focusing is not supported on this platform"))
    }
}
