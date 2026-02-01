use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// 进程输出事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOutput {
    pub output_type: String, // "stdout" or "stderr"
    pub content: String,
    pub timestamp: i64,
}

/// 外部进程通信器
pub struct ProcessCommunicator {
    /// 进程句柄
    process: Arc<Mutex<Option<Child>>>,
    /// 输出缓冲区
    output_buffer: Arc<Mutex<Vec<ProcessOutput>>>,
    /// 是否正在运行
    is_running: Arc<Mutex<bool>>,
}

impl ProcessCommunicator {
    /// 创建新的进程通信器
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            output_buffer: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// 启动进程
    pub fn start_process(&self, command: &str, args: &[String], working_dir: &str) -> Result<()> {
        // 停止现有进程
        self.stop_process()?;

        // 启动新进程
        let mut child = Command::new(command)
            .args(args)
            .current_dir(working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start process")?;

        // 获取 stdout 和 stderr
        let stdout = child.stdout.take().context("Failed to get stdout")?;
        let stderr = child.stderr.take().context("Failed to get stderr")?;

        // 存储进程句柄
        {
            let mut process = self.process.lock().unwrap();
            *process = Some(child);
        }

        // 设置运行状态
        {
            let mut is_running = self.is_running.lock().unwrap();
            *is_running = true;
        }

        // 启动输出读取线程
        self.start_output_reader(stdout, "stdout");
        self.start_output_reader(stderr, "stderr");

        log::info!("[ProcessCommunicator] Started process: {} {:?}", command, args);
        Ok(())
    }

    /// 启动输出读取线程
    fn start_output_reader<R: std::io::Read + Send + 'static>(&self, reader: R, output_type: &str) {
        let output_buffer = Arc::clone(&self.output_buffer);
        let output_type = output_type.to_string();
        let is_running = Arc::clone(&self.is_running);

        thread::spawn(move || {
            let buf_reader = BufReader::new(reader);
            for line in buf_reader.lines() {
                // 检查是否还在运行
                {
                    let running = is_running.lock().unwrap();
                    if !*running {
                        break;
                    }
                }

                if let Ok(content) = line {
                    let output = ProcessOutput {
                        output_type: output_type.clone(),
                        content,
                        timestamp: chrono::Utc::now().timestamp(),
                    };

                    let mut buffer = output_buffer.lock().unwrap();
                    buffer.push(output);

                    // 限制缓冲区大小（最多保留 1000 条）
                    if buffer.len() > 1000 {
                        buffer.remove(0);
                    }
                }
            }
        });
    }

    /// 发送输入到进程
    pub fn send_input(&self, input: &str) -> Result<()> {
        let mut process = self.process.lock().unwrap();

        if let Some(child) = process.as_mut() {
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.as_bytes())
                    .context("Failed to write to stdin")?;
                stdin.write_all(b"\n")
                    .context("Failed to write newline")?;
                stdin.flush()
                    .context("Failed to flush stdin")?;

                log::info!("[ProcessCommunicator] Sent input: {}", input);
                Ok(())
            } else {
                Err(anyhow::anyhow!("Process stdin not available"))
            }
        } else {
            Err(anyhow::anyhow!("No process running"))
        }
    }

    /// 获取输出
    pub fn get_output(&self) -> Vec<ProcessOutput> {
        let buffer = self.output_buffer.lock().unwrap();
        buffer.clone()
    }

    /// 清除输出缓冲区
    pub fn clear_output(&self) {
        let mut buffer = self.output_buffer.lock().unwrap();
        buffer.clear();
    }

    /// 停止进程
    pub fn stop_process(&self) -> Result<()> {
        // 设置运行状态为 false
        {
            let mut is_running = self.is_running.lock().unwrap();
            *is_running = false;
        }

        let mut process = self.process.lock().unwrap();

        if let Some(mut child) = process.take() {
            child.kill().context("Failed to kill process")?;
            child.wait().context("Failed to wait for process")?;
            log::info!("[ProcessCommunicator] Stopped process");
            Ok(())
        } else {
            Ok(())
        }
    }

    /// 检查进程是否正在运行
    pub fn is_running(&self) -> bool {
        let is_running = self.is_running.lock().unwrap();
        *is_running
    }
}

impl Default for ProcessCommunicator {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for ProcessCommunicator {
    fn drop(&mut self) {
        let _ = self.stop_process();
    }
}
