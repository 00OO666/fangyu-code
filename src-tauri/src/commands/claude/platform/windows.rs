//! Windows-specific platform implementations

use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

fn find_node_executable(cmd_dir: &Path) -> Option<PathBuf> {
    // 1) Local node.exe next to the .cmd wrapper (npm sometimes bundles it)
    let local_node = cmd_dir.join("node.exe");
    if local_node.exists() {
        return Some(local_node);
    }

    // 2) Common system installs / managers (best-effort; keep cheap and deterministic)
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(programfiles) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(programfiles).join("nodejs").join("node.exe"));
    }

    if let Ok(programfiles_x86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(programfiles_x86).join("nodejs").join("node.exe"));
    }

    if let Ok(nvm_symlink) = std::env::var("NVM_SYMLINK") {
        candidates.push(PathBuf::from(nvm_symlink).join("node.exe"));
    }

    if let Ok(volta_home) = std::env::var("VOLTA_HOME") {
        candidates.push(PathBuf::from(volta_home).join("bin").join("node.exe"));
    }

    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(
            PathBuf::from(localappdata)
                .join("Programs")
                .join("nodejs")
                .join("node.exe"),
        );
    }

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn extract_script_path_from_wrapper(content: &str, cmd_dir: &Path) -> Option<PathBuf> {
    // Supports npm-style wrappers that reference the target script via:
    // - "%~dp0\...\script.js"
    // - "%dp0%\...\script.js" (where dp0 is set to %~dp0 earlier)
    // and also wrappers that execute via an intermediate variable like "%_prog%".

    for line in content.lines() {
        let line_lc = line.to_ascii_lowercase();
        if !line_lc.contains(".js") {
            continue;
        }

        // Extract quoted segments: "..." "..." ...
        let mut rest = line;
        while let Some(start) = rest.find('"') {
            let after_start = &rest[start + 1..];
            let Some(end) = after_start.find('"') else {
                break;
            };
            let token = &after_start[..end];
            rest = &after_start[end + 1..];

            let token_lc = token.to_ascii_lowercase();
            if !token_lc.contains(".js") {
                continue;
            }

            // If the token is already an absolute path, accept it.
            let token_path = Path::new(token);
            if token_path.is_absolute() && token_path.exists() {
                return Some(token_path.to_path_buf());
            }

            // Resolve %~dp0 / %dp0% prefixes to the wrapper directory.
            let rel = if token_lc.starts_with("%~dp0") {
                &token[5..]
            } else if token_lc.starts_with("%dp0%") {
                &token[5..]
            } else {
                continue;
            };

            let rel = rel.trim_start_matches(['\\', '/']);
            if rel.is_empty() {
                continue;
            }

            let candidate = cmd_dir.join(rel);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

/// Resolve a .cmd wrapper file to its actual Node.js script path
///
/// Windows npm installations often create .cmd wrapper files that execute Node.js scripts.
/// This function parses the .cmd file to extract the actual script path.
///
/// # Arguments
/// * `cmd_path` - Path to the .cmd wrapper file
///
/// # Returns
/// * `Some((node_executable, script_path))` if successfully resolved
/// * `None` if resolution failed
///
/// # Example
/// ```ignore
/// let result = resolve_cmd_wrapper("C:/Program Files/nodejs/claude.cmd");
/// // Returns: Some(("node", "C:/Program Files/nodejs/node_modules/@anthropic/claude/bin/claude.js"))
/// ```
pub fn resolve_cmd_wrapper(cmd_path: &str) -> Option<(String, String)> {
    log::debug!("Attempting to resolve .cmd wrapper: {}", cmd_path);

    let cmd_dir = Path::new(cmd_path).parent()?;

    // Read the .cmd file content
    let content = fs::read_to_string(cmd_path).ok()?;

    let script_path = extract_script_path_from_wrapper(&content, cmd_dir)?;
    let node_path = find_node_executable(cmd_dir)
        .unwrap_or_else(|| PathBuf::from("node"))
        .to_string_lossy()
        .to_string();
    let script_path = script_path.to_string_lossy().to_string();

    log::debug!(
        "Resolved .cmd wrapper to node executable: {}, script: {}",
        node_path,
        script_path
    );
    Some((node_path, script_path))
}

/// Kill a process tree on Windows using taskkill
///
/// Uses the Windows taskkill command with /T flag to terminate
/// a process and all its child processes.
///
/// # Arguments
/// * `pid` - Process ID to kill
///
/// # Returns
/// * `Ok(())` if the process was successfully killed
/// * `Err(String)` with error description if the operation failed
pub fn kill_process_tree_impl(pid: u32) -> Result<(), String> {
    log::info!("Attempting to kill process tree for PID {} on Windows", pid);

    let mut cmd = Command::new("taskkill");
    cmd.args(["/F", "/T", "/PID", &pid.to_string()]);

    // Hide the console window
    cmd.creation_flags(super::CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(output) if output.status.success() => {
            log::info!("Successfully killed process tree for PID {}", pid);
            Ok(())
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let error_msg = format!("Failed to kill process tree: {}", stderr);
            log::error!("{}", error_msg);
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!("Failed to execute taskkill: {}", e);
            log::error!("{}", error_msg);
            Err(error_msg)
        }
    }
}

/// Setup Windows-specific environment variables for a command
///
/// Configures PATH and other necessary environment variables to ensure
/// Node.js and npm packages can be found.
#[allow(dead_code)]
pub fn setup_command_environment(cmd: &mut Command, program_path: &str) {
    // Add NVM support if the program is in an NVM directory
    if program_path.contains("\\.nvm\\versions\\node\\") {
        if let Some(node_bin_dir) = Path::new(program_path).parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_bin_str = node_bin_dir.to_string_lossy();
            if !current_path.contains(&node_bin_str.as_ref()) {
                let new_path = format!("{};{}", node_bin_str, current_path);
                cmd.env("PATH", new_path);
            }
        }
    }

    // Add common npm paths to PATH
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let npm_path = Path::new(&appdata).join("npm");
        if let Some(npm_str) = npm_path.to_str() {
            if let Ok(current_path) = std::env::var("PATH") {
                if !current_path.contains(npm_str) {
                    let new_path = format!("{};{}", current_path, npm_str);
                    cmd.env("PATH", new_path);
                }
            }
        }
    }
}

/// Setup Windows-specific environment variables for a tokio command
///
#[allow(dead_code)]
/// Async version for use with tokio::process::Command
pub fn setup_command_environment_async(cmd: &mut tokio::process::Command, _program_path: &str) {
    log::error!("[PATH Setup] ⚠️ CRITICAL: Starting Windows PATH environment setup");

    let mut paths_to_add = Vec::new();
    let current_path = std::env::var("PATH").unwrap_or_default();
    log::info!("[PATH Setup] Current PATH length: {} chars", current_path.len());

    // 0. Ensure Windows system directories are on PATH.
    //
    // Claude Code CLI (Node) internally invokes `cmd.exe` with `where.exe` on Windows.
    // `cmd.exe` only searches PATH for external commands; if `%SystemRoot%\\System32`
    // is missing, it fails with:
    //   'where.exe' is not recognized as an internal or external command
    let system_root = std::env::var("SystemRoot")
        .or_else(|_| std::env::var("WINDIR"))
        .unwrap_or_else(|_| "C:\\Windows".to_string());

    let win_dir = PathBuf::from(system_root);
    let system32 = win_dir.join("System32");
    let wbem = system32.join("Wbem");
    let powershell = system32.join("WindowsPowerShell").join("v1.0");

    for p in [&system32, &wbem, &powershell, &win_dir] {
        if p.exists() {
            let p_str = p.to_string_lossy().to_string();
            log::info!("[PATH Setup] Ensuring system path: {:?}", p);
            paths_to_add.push(p_str);
        }
    }

    // 1. Add NVM paths (check common NVM locations)
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let nvm_current = PathBuf::from(&userprofile).join(".nvm").join("current");
        if nvm_current.exists() {
            log::info!("[PATH Setup] Found NVM path: {:?}", nvm_current);
            paths_to_add.push(nvm_current.to_string_lossy().to_string());
        }
    }

    // 2. Add npm global paths
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let npm_path = Path::new(&appdata).join("npm");
        if npm_path.exists() {
            log::info!("[PATH Setup] Found npm path: {:?}", npm_path);
            paths_to_add.push(npm_path.to_string_lossy().to_string());
        }
    }

    // 3. Add common Node.js installation paths
    if let Ok(programfiles) = std::env::var("ProgramFiles") {
        let nodejs_path = PathBuf::from(&programfiles).join("nodejs");
        log::info!("[PATH Setup] Checking Node.js path: {:?}, exists: {}", nodejs_path, nodejs_path.exists());
        if nodejs_path.exists() {
            log::info!("[PATH Setup] ✓ Found Node.js installation path: {:?}", nodejs_path);
            paths_to_add.push(nodejs_path.to_string_lossy().to_string());
        }
    }

    // 4. Add user-local npm paths
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let npm_global = PathBuf::from(&userprofile).join(".npm-global").join("bin");
        if npm_global.exists() {
            log::info!("[PATH Setup] Found npm-global path: {:?}", npm_global);
            paths_to_add.push(npm_global.to_string_lossy().to_string());
        }
    }

    // 5. Add Volta paths
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let volta_bin = PathBuf::from(&userprofile).join(".volta").join("bin");
        if volta_bin.exists() {
            log::info!("[PATH Setup] Found Volta path: {:?}", volta_bin);
            paths_to_add.push(volta_bin.to_string_lossy().to_string());
        }
    }

    // Build new PATH with all discovered paths
    if !paths_to_add.is_empty() {
        log::info!("[PATH Setup] Adding {} paths to PATH", paths_to_add.len());
        let mut new_path = String::new();
        for path in &paths_to_add {
            if !current_path.contains(path) {
                if !new_path.is_empty() {
                    new_path.push(';');
                }
                new_path.push_str(path);
            }
        }
        if !new_path.is_empty() {
            new_path.push(';');
            new_path.push_str(&current_path);
        } else {
            new_path = current_path;
        }

        log::error!("[PATH Setup] ⚠️ CRITICAL: Updated PATH (new length: {} chars)", new_path.len());
        log::error!("[PATH Setup] ⚠️ CRITICAL: First 200 chars of new PATH: {}", &new_path.chars().take(200).collect::<String>());
        cmd.env("PATH", new_path);
    } else {
        log::warn!("[PATH Setup] ⚠️ No Node.js paths found to add!");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_resolve_cmd_wrapper_invalid_path() {
        let result = resolve_cmd_wrapper("nonexistent.cmd");
        assert!(result.is_none());
    }

    #[test]
    fn test_resolve_cmd_wrapper_dp0_and_prog_variable_style() {
        let temp = tempfile::tempdir().expect("tempdir");
        let bin_dir = temp.path().join("npm-global");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        // Make resolution deterministic: provide a local node.exe next to the wrapper.
        std::fs::write(bin_dir.join("node.exe"), b"").expect("write node.exe");

        let script_path = bin_dir
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("cli.js");
        std::fs::create_dir_all(script_path.parent().expect("parent"))
            .expect("create script dir");
        std::fs::write(&script_path, b"console.log('ok');").expect("write script");

        let cmd_path = bin_dir.join("claude.cmd");
        let mut f = std::fs::File::create(&cmd_path).expect("create cmd");
        writeln!(
            f,
            "@ECHO off\r\n\
GOTO start\r\n\
:find_dp0\r\n\
SET dp0=%~dp0\r\n\
EXIT /b\r\n\
:start\r\n\
SETLOCAL\r\n\
CALL :find_dp0\r\n\
\r\n\
IF EXIST \"%dp0%\\node.exe\" (\r\n\
  SET \"_prog=%dp0%\\node.exe\"\r\n\
) ELSE (\r\n\
  SET \"_prog=node\"\r\n\
)\r\n\
\r\n\
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & \"%_prog%\"  \"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js\" %*\r\n"
        )
        .expect("write cmd");
        drop(f);

        let (node, script) =
            resolve_cmd_wrapper(cmd_path.to_str().expect("cmd path")).expect("resolve");
        assert_eq!(PathBuf::from(node), bin_dir.join("node.exe"));
        assert_eq!(PathBuf::from(script), script_path);
    }
}
