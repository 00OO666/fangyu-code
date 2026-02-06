use std::process::{Child, Command, Stdio};
use std::collections::VecDeque;
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
    output_buffer: Arc<Mutex<VecDeque<ProcessOutput>>>,
    /// 是否正在运行
    is_running: Arc<Mutex<bool>>,
}

impl ProcessCommunicator {
    /// 创建新的进程通信器
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            output_buffer: Arc::new(Mutex::new(VecDeque::new())),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// 启动进程
    pub fn start_process(&self, command: &str, args: &[String], working_dir: &str) -> Result<()> {
        // 停止现有进程
        self.stop_process()?;
        self.clear_output();

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
        let process_handle = {
            let mut process = self
                .process
                .lock()
                .map_err(|_| anyhow::anyhow!("Process communicator lock poisoned"))?;
            *process = Some(child);
            Arc::clone(&self.process)
        };

        // 设置运行状态
        {
            let mut is_running = self
                .is_running
                .lock()
                .map_err(|_| anyhow::anyhow!("Process communicator lock poisoned"))?;
            *is_running = true;
        }

        // 启动输出读取线程
        self.start_output_reader(stdout, "stdout");
        self.start_output_reader(stderr, "stderr");

        // 启动进程状态监控线程
        self.start_process_watcher(process_handle);

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
                    let running = match is_running.lock() {
                        Ok(guard) => guard,
                        Err(poison) => poison.into_inner(),
                    };
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

                    let mut buffer = match output_buffer.lock() {
                        Ok(guard) => guard,
                        Err(poison) => poison.into_inner(),
                    };
                    buffer.push_back(output);

                    // 限制缓冲区大小（最多保留 1000 条）
                    if buffer.len() > 1000 {
                        buffer.pop_front();
                    }
                }
            }
        });
    }

    /// 启动进程状态监控线程
    fn start_process_watcher(&self, process: Arc<Mutex<Option<Child>>>) {
        let is_running = Arc::clone(&self.is_running);
        thread::spawn(move || loop {
            {
                let running = match is_running.lock() {
                    Ok(guard) => guard,
                    Err(poison) => poison.into_inner(),
                };
                if !*running {
                    break;
                }
            }

            let exited = {
                let mut process = match process.lock() {
                    Ok(guard) => guard,
                    Err(poison) => poison.into_inner(),
                };
                if let Some(child) = process.as_mut() {
                    match child.try_wait() {
                        Ok(Some(_status)) => true,
                        Ok(None) => false,
                        Err(_) => true,
                    }
                } else {
                    true
                }
            };

            if exited {
                if let Ok(mut running) = is_running.lock() {
                    *running = false;
                }
                break;
            }

            thread::sleep(std::time::Duration::from_millis(500));
        });
    }

    /// 发送输入到进程
    pub fn send_input(&self, input: &str) -> Result<()> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Process communicator lock poisoned"))?;

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
        let buffer = match self.output_buffer.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        buffer.iter().cloned().collect()
    }

    /// 清除输出缓冲区
    pub fn clear_output(&self) {
        let mut buffer = match self.output_buffer.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        buffer.clear();
    }

    /// 停止进程
    pub fn stop_process(&self) -> Result<()> {
        // 设置运行状态为 false
        {
            if let Ok(mut is_running) = self.is_running.lock() {
                *is_running = false;
            }
        }

        let mut process = self
            .process
            .lock()
            .map_err(|_| anyhow::anyhow!("Process communicator lock poisoned"))?;

        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
            log::info!("[ProcessCommunicator] Stopped process");
            Ok(())
        } else {
            Ok(())
        }
    }

    /// 检查进程是否正在运行
    pub fn is_running(&self) -> bool {
        match self.is_running.lock() {
            Ok(guard) => *guard,
            Err(poison) => *poison.into_inner(),
        }
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
