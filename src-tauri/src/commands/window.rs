use serde::{Deserialize, Serialize};
/**
 * Window Management Commands
 *
 * Provides commands for creating and managing independent session windows.
 * Supports detaching tabs into separate windows and cross-window communication.
 */
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Set Windows title bar color using DWM API
#[cfg(target_os = "windows")]
fn set_titlebar_color_for_window(window: &tauri::WebviewWindow, color: u32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR};

    if let Ok(hwnd) = window.hwnd() {
        let hwnd = HWND(hwnd.0);
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_CAPTION_COLOR,
                &color as *const u32 as *const _,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_titlebar_color_for_window(_window: &tauri::WebviewWindow, _color: u32) {
    // No-op for non-Windows platforms
}

/// Sets the title bar color for all windows based on the current theme
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `is_dark` - Whether dark theme is active
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn set_titlebar_theme(app: AppHandle, is_dark: bool) -> Result<(), String> {
    // Color values in COLORREF format (0x00BBGGRR)
    // Dark theme: Medium gray rgb(48, 48, 52) -> 0x00343030
    // Light theme: Near white rgb(250, 250, 252) -> 0x00FCFAFA
    let color: u32 = if is_dark {
        0x00343030 // Dark theme: medium gray
    } else {
        0x00FCFAFA // Light theme: near white
    };

    // Apply to all windows
    for (_label, window) in app.webview_windows() {
        set_titlebar_color_for_window(&window, color);
    }

    log::info!(
        "[Window] Title bar theme updated to {}",
        if is_dark { "dark" } else { "light" }
    );

    Ok(())
}

/// Parameters for creating a new session window
#[derive(Debug, Deserialize)]
pub struct CreateSessionWindowParams {
    /// Unique identifier for the tab being detached
    pub tab_id: String,
    /// Optional session ID (for existing sessions)
    pub session_id: Option<String>,
    /// Project path for the session
    pub project_path: Option<String>,
    /// Window title
    pub title: String,
    /// Execution engine: 'claude' | 'codex'
    pub engine: Option<String>,
}

/// Result of window creation
#[derive(Debug, Serialize)]
pub struct WindowCreationResult {
    /// The label/identifier of the created window
    pub window_label: String,
    /// Whether the window was successfully created
    pub success: bool,
}

/// Creates a new independent window for a session
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `params` - Window creation parameters
///
/// # Returns
/// * `Result<WindowCreationResult, String>` - The window label or an error message
#[tauri::command]
pub async fn create_session_window(
    app: AppHandle,
    params: CreateSessionWindowParams,
) -> Result<WindowCreationResult, String> {
    // Generate unique window label
    let window_label = format!("session-window-{}", params.tab_id);

    // Check if window already exists
    if app.get_webview_window(&window_label).is_some() {
        // Focus existing window instead of creating a new one
        if let Some(window) = app.get_webview_window(&window_label) {
            window
                .set_focus()
                .map_err(|e| format!("Failed to focus window: {}", e))?;
        }
        return Ok(WindowCreationResult {
            window_label,
            success: true,
        });
    }

    // Build URL with query parameters
    let mut url = String::from("/");
    let mut query_parts: Vec<String> = vec![
        format!("window=session"),
        format!("tab_id={}", params.tab_id),
    ];

    if let Some(ref session_id) = params.session_id {
        query_parts.push(format!("session_id={}", session_id));
    }

    if let Some(ref project_path) = params.project_path {
        // URL encode the project path
        let encoded_path = urlencoding::encode(project_path);
        query_parts.push(format!("project_path={}", encoded_path));
    }

    if let Some(ref engine) = params.engine {
        query_parts.push(format!("engine={}", engine));
    }

    url = format!("{}?{}", url, query_parts.join("&"));

    log::info!(
        "[Window] Creating session window: {} with URL: {}",
        window_label,
        url
    );

    // Create new window (frameless with custom title bar)
    let window = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title(&params.title)
        .inner_size(1000.0, 700.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .visible(true)
        .decorations(false) // Disable system title bar, use custom title bar in frontend
        .center()
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Focus the new window
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus new window: {}", e))?;

    log::info!(
        "[Window] Session window created successfully: {}",
        window_label
    );

    Ok(WindowCreationResult {
        window_label,
        success: true,
    })
}

/// Closes an independent session window
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `window_label` - The label of the window to close
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn close_session_window(app: AppHandle, window_label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
        log::info!("[Window] Session window closed: {}", window_label);
        Ok(())
    } else {
        Err(format!("Window not found: {}", window_label))
    }
}

/// Gets a list of all open session windows
///
/// # Arguments
/// * `app` - The Tauri app handle
///
/// # Returns
/// * `Result<Vec<String>, String>` - List of window labels
#[tauri::command]
pub async fn list_session_windows(app: AppHandle) -> Result<Vec<String>, String> {
    let windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("session-window-"))
        .cloned()
        .collect();

    Ok(windows)
}

/// Focuses a specific session window
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `window_label` - The label of the window to focus
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn focus_session_window(app: AppHandle, window_label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
        Ok(())
    } else {
        Err(format!("Window not found: {}", window_label))
    }
}

/// Emits an event to a specific window
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `window_label` - The target window label
/// * `event_name` - The event name
/// * `payload` - The event payload (JSON string)
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn emit_to_window(
    app: AppHandle,
    window_label: String,
    event_name: String,
    payload: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .emit(&event_name, payload)
            .map_err(|e| format!("Failed to emit event: {}", e))?;
        Ok(())
    } else {
        Err(format!("Window not found: {}", window_label))
    }
}

/// Broadcasts an event to all session windows
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `event_name` - The event name
/// * `payload` - The event payload (JSON string)
///
/// # Returns
/// * `Result<u32, String>` - Number of windows that received the event
#[tauri::command]
pub async fn broadcast_to_session_windows(
    app: AppHandle,
    event_name: String,
    payload: String,
) -> Result<u32, String> {
    let mut count = 0u32;

    for (label, window) in app.webview_windows() {
        if label.starts_with("session-window-") {
            if window.emit(&event_name, &payload).is_ok() {
                count += 1;
            }
        }
    }

    Ok(count)
}
