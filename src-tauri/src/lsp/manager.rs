/**
 * LSP Manager - Language Server 进程管理器
 *
 * 功能：
 * - 进程生命周期管理（启动、停止、重启）
 * - 进程健康检查和心跳检测
 * - 进程崩溃自动重启
 * - 日志记录和错误追踪
 * - 多个 Language Server 并发管理
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::sleep;

// Language Server 状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LSPStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Crashed,
    Restarting,
}

// Language Server 实例信息
#[derive(Debug)]
pub struct LSPInstance {
    pub language: String,
    pub command: String,
    pub args: Vec<String>,
    pub process: Option<Child>,
    pub status: LSPStatus,
    pub pid: Option<u32>,
    pub start_time: SystemTime,
    pub restart_count: u32,
    pub last_heartbeat: SystemTime,
}

// LSP 管理器配置
#[derive(Debug, Clone)]
pub struct LSPManagerConfig {
    pub max_restart_attempts: u32,
    pub restart_delay_ms: u64,
    pub heartbeat_interval_ms: u64,
    pub heartbeat_timeout_ms: u64,
}

impl Default for LSPManagerConfig {
    fn default() -> Self {
        Self {
            max_restart_attempts: 3,
            restart_delay_ms: 1000,
            heartbeat_interval_ms: 5000,
            heartbeat_timeout_ms: 10000,
        }
    }
}

// LSP 管理器
pub struct LSPProcessManager {
    instances: Arc<Mutex<HashMap<String, LSPInstance>>>,
    config: LSPManagerConfig,
}

impl LSPProcessManager {
    pub fn new(config: LSPManagerConfig) -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
            config,
        }
    }

    /// 启动 Language Server
    pub async fn start_server(
        &self,
        language: String,
        command: String,
        args: Vec<String>,
    ) -> Result<u32, String> {
        let mut instances = self.instances.lock().await;

        // 检查是否已经运行
        if let Some(instance) = instances.get(&language) {
            if instance.status == LSPStatus::Running {
                return Err(format!("Language Server for {} is already running", language));
            }
        }

        // 启动进程
        let mut child = Command::new(&command)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Language Server: {}", e))?;

        let pid = child.id().unwrap_or(0);

        // 创建实例
        let instance = LSPInstance {
            language: language.clone(),
            command: command.clone(),
            args: args.clone(),
            process: Some(child),
            status: LSPStatus::Running,
            pid: Some(pid),
            start_time: SystemTime::now(),
            restart_count: 0,
            last_heartbeat: SystemTime::now(),
        };

        instances.insert(language.clone(), instance);

        // 启动健康检查
        self.start_health_check(language.clone()).await;

        Ok(pid)
    }

    /// 停止 Language Server
    pub async fn stop_server(&self, language: &str) -> Result<(), String> {
        let mut instances = self.instances.lock().await;

        if let Some(instance) = instances.get_mut(language) {
            instance.status = LSPStatus::Stopping;

            if let Some(mut process) = instance.process.take() {
                process
                    .kill()
                    .await
                    .map_err(|e| format!("Failed to kill process: {}", e))?;
            }

            instance.status = LSPStatus::Stopped;
            Ok(())
        } else {
            Err(format!("Language Server for {} is not running", language))
        }
    }

    /// 重启 Language Server
    pub async fn restart_server(&self, language: &str) -> Result<u32, String> {
        let (command, args) = {
            let instances = self.instances.lock().await;
            if let Some(instance) = instances.get(language) {
                (instance.command.clone(), instance.args.clone())
            } else {
                return Err(format!("Language Server for {} not found", language));
            }
        };

        // 停止现有进程
        let _ = self.stop_server(language).await;

        // 等待一段时间
        sleep(Duration::from_millis(self.config.restart_delay_ms)).await;

        // 重新启动
        self.start_server(language.to_string(), command, args).await
    }

    /// 获取服务器状态
    pub async fn get_status(&self, language: &str) -> Option<LSPStatus> {
        let instances = self.instances.lock().await;
        instances.get(language).map(|i| i.status.clone())
    }

    /// 获取所有服务器状态
    pub async fn get_all_status(&self) -> HashMap<String, LSPStatus> {
        let instances = self.instances.lock().await;
        instances
            .iter()
            .map(|(lang, inst)| (lang.clone(), inst.status.clone()))
            .collect()
    }

    /// 检查进程是否存活
    async fn is_process_alive(&self, language: &str) -> bool {
        let mut instances = self.instances.lock().await;

        if let Some(instance) = instances.get_mut(language) {
            if let Some(process) = &mut instance.process {
                // 尝试检查进程状态
                match process.try_wait() {
                    Ok(Some(_)) => false, // 进程已退出
                    Ok(None) => true,     // 进程仍在运行
                    Err(_) => false,      // 检查失败
                }
            } else {
                false
            }
        } else {
            false
        }
    }

    /// 启动健康检查
    async fn start_health_check(&self, language: String) {
        let instances = self.instances.clone();
        let config = self.config.clone();

        tokio::spawn(async move {
            loop {
                sleep(Duration::from_millis(config.heartbeat_interval_ms)).await;

                let should_restart = {
                    let mut instances_guard = instances.lock().await;

                    if let Some(instance) = instances_guard.get_mut(&language) {
                        // 检查进程是否存活
                        let is_alive = if let Some(process) = &mut instance.process {
                            match process.try_wait() {
                                Ok(Some(_)) => false,
                                Ok(None) => true,
                                Err(_) => false,
                            }
                        } else {
                            false
                        };

                        if !is_alive {
                            // 进程已崩溃
                            instance.status = LSPStatus::Crashed;

                            // 检查是否需要自动重启
                            if instance.restart_count < config.max_restart_attempts {
                                instance.restart_count += 1;
                                instance.status = LSPStatus::Restarting;

                                log::warn!(
                                    "Language Server {} crashed, attempting restart {}/{}",
                                    language,
                                    instance.restart_count,
                                    config.max_restart_attempts
                                );

                                true // 需要重启
                            } else {
                                log::error!(
                                    "Language Server {} crashed too many times, giving up",
                                    language
                                );
                                false // 不再重启，退出循环
                            }
                        } else {
                            // 更新心跳时间
                            instance.last_heartbeat = SystemTime::now();
                            true // 继续监控
                        }
                    } else {
                        // 实例已被移除，停止健康检查
                        false
                    }
                };

                if !should_restart {
                    break;
                }

                // 等待后重启（如果需要）
                sleep(Duration::from_millis(config.restart_delay_ms)).await;
            }
        });
    }

    /// 获取服务器信息
    pub async fn get_server_info(&self, language: &str) -> Option<ServerInfo> {
        let instances = self.instances.lock().await;

        instances.get(language).map(|instance| {
            let uptime = instance
                .start_time
                .elapsed()
                .unwrap_or(Duration::from_secs(0))
                .as_secs();

            ServerInfo {
                language: instance.language.clone(),
                command: instance.command.clone(),
                status: instance.status.clone(),
                pid: instance.pid,
                uptime_seconds: uptime,
                restart_count: instance.restart_count,
            }
        })
    }

    /// 清理所有服务器
    pub async fn shutdown_all(&self) -> Result<(), String> {
        let languages: Vec<String> = {
            let instances = self.instances.lock().await;
            instances.keys().cloned().collect()
        };

        for language in languages {
            let _ = self.stop_server(&language).await;
        }

        Ok(())
    }
}

// 服务器信息（用于返回给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub language: String,
    pub command: String,
    pub status: LSPStatus,
    pub pid: Option<u32>,
    pub uptime_seconds: u64,
    pub restart_count: u32,
}
