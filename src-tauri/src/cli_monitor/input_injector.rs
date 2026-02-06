use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use anyhow::{Context, Result};

/// 输入注入器
/// 用于向 Claude CLI 进程注入输入
pub struct InputInjector {
    /// 进程句柄
    process: Arc<Mutex<Option<Child>>>,
}

impl InputInjector {
    /// 创建新的输入注入器
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    /// 启动 Claude CLI 进程
    pub fn start_process(&self, working_dir: &str) -> Result<()> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Input injector lock poisoned"))?;

        // 如果已经有进程在运行，先停止
        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        // 启动新进程
        let child = Command::new("claude")
            .current_dir(working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start Claude CLI process")?;

        *process = Some(child);
        log::info!("[InputInjector] Started Claude CLI process in: {}", working_dir);

        Ok(())
    }

    /// 注入输入到进程
    pub fn inject_input(&self, input: &str) -> Result<()> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Input injector lock poisoned"))?;

        if let Some(child) = process.as_mut() {
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.as_bytes())
                    .context("Failed to write to stdin")?;
                stdin.write_all(b"\n")
                    .context("Failed to write newline")?;
                stdin.flush()
                    .context("Failed to flush stdin")?;

                log::info!("[InputInjector] Injected input: {}", input);
                Ok(())
            } else {
                Err(anyhow::anyhow!("Process stdin not available"))
            }
        } else {
            Err(anyhow::anyhow!("No process running"))
        }
    }

    /// 停止进程
    pub fn stop_process(&self) -> Result<()> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Input injector lock poisoned"))?;

        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
            log::info!("[InputInjector] Stopped Claude CLI process");
            Ok(())
        } else {
            Err(anyhow::anyhow!("No process running"))
        }
    }

    /// 检查进程是否正在运行
    pub fn is_running(&self) -> bool {
        match self.process.lock() {
            Ok(guard) => guard.is_some(),
            Err(poison) => poison.into_inner().is_some(),
        }
    }

    /// 读取进程输出
    pub fn read_output(&self) -> Result<String> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Input injector lock poisoned"))?;

        if process.is_some() {
            Err(anyhow::anyhow!(
                "Output capture is disabled for InputInjector"
            ))
        } else {
            Err(anyhow::anyhow!("No process running"))
        }
    }
}

impl Default for InputInjector {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for InputInjector {
    fn drop(&mut self) {
        let _ = self.stop_process();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_injector_creation() {
        let injector = InputInjector::new();
        assert!(!injector.is_running());
    }
}
