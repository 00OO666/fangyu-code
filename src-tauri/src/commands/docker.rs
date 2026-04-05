//! Docker 命令模块
//!
//! 提供 Docker 容器管理功能，用于沙箱环境。
//!
//! 功能：
//! - 检查 Docker 可用性
//! - 创建/销毁容器
//! - 在容器中执行命令

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Docker 可用性检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct DockerAvailability {
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// 容器创建结果
#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerCreateResult {
    pub container_id: String,
}

/// 命令执行结果
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// 卷挂载配置
#[derive(Debug, Deserialize)]
pub struct VolumeMount {
    pub host_path: String,
    pub container_path: String,
    pub mode: String,
}

/// 检查 Docker 是否可用
#[command]
pub async fn docker_check_availability() -> Result<DockerAvailability, String> {
    let output = Command::new("docker")
        .args(["version", "--format", "{{.Server.Version}}"])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                Ok(DockerAvailability {
                    available: true,
                    version: Some(version),
                    error: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
                Ok(DockerAvailability {
                    available: false,
                    version: None,
                    error: Some(error),
                })
            }
        }
        Err(e) => Ok(DockerAvailability {
            available: false,
            version: None,
            error: Some(format!("Failed to execute docker command: {}", e)),
        }),
    }
}

/// 创建 Docker 容器
#[command]
pub async fn docker_create_container(
    name: String,
    image: String,
    memory_limit: String,
    cpu_limit: f64,
    workspace_dir: String,
    env_vars: std::collections::HashMap<String, String>,
    volumes: Vec<VolumeMount>,
    exposed_ports: Vec<u16>,
    network_mode: String,
) -> Result<ContainerCreateResult, String> {
    let mut args = vec![
        "run".to_string(),
        "-d".to_string(),
        "--rm".to_string(),
        format!("--name={}", name),
        format!("--memory={}", memory_limit),
        format!("--cpus={}", cpu_limit),
        format!("-w={}", workspace_dir),
        format!("--network={}", network_mode),
    ];

    // 添加环境变量
    for (key, value) in env_vars {
        args.push(format!("-e={}={}", key, value));
    }

    // 添加卷挂载
    for volume in volumes {
        args.push(format!(
            "-v={}:{}:{}",
            volume.host_path, volume.container_path, volume.mode
        ));
    }

    // 添加端口映射
    for port in exposed_ports {
        args.push(format!("-p={}:{}", port, port));
    }

    // 添加镜像
    args.push(image);

    // 保持容器运行
    args.push("tail".to_string());
    args.push("-f".to_string());
    args.push("/dev/null".to_string());

    let output = Command::new("docker")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute docker run: {}", e))?;

    if output.status.success() {
        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(ContainerCreateResult { container_id })
    } else {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Failed to create container: {}", error))
    }
}

/// 销毁 Docker 容器
#[command]
pub async fn docker_destroy_container(container_id: String) -> Result<(), String> {
    // 先停止容器
    let stop_output = Command::new("docker")
        .args(["stop", &container_id])
        .output()
        .map_err(|e| format!("Failed to stop container: {}", e))?;

    if !stop_output.status.success() {
        // 容器可能已经停止，尝试强制删除
        let rm_output = Command::new("docker")
            .args(["rm", "-f", &container_id])
            .output()
            .map_err(|e| format!("Failed to remove container: {}", e))?;

        if !rm_output.status.success() {
            let error = String::from_utf8_lossy(&rm_output.stderr).trim().to_string();
            return Err(format!("Failed to remove container: {}", error));
        }
    }

    Ok(())
}

/// 在容器中执行命令
#[command]
pub async fn docker_exec_command(
    container_id: String,
    command: String,
    cwd: String,
    _timeout: u64,
) -> Result<CommandExecResult, String> {
    let output = Command::new("docker")
        .args([
            "exec",
            "-w",
            &cwd,
            &container_id,
            "/bin/sh",
            "-c",
            &command,
        ])
        .output()
        .map_err(|e| format!("Failed to execute command in container: {}", e))?;

    Ok(CommandExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// 获取容器状态
#[command]
pub async fn docker_container_status(container_id: String) -> Result<String, String> {
    let output = Command::new("docker")
        .args([
            "inspect",
            "--format",
            "{{.State.Status}}",
            &container_id,
        ])
        .output()
        .map_err(|e| format!("Failed to get container status: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Container not found".to_string())
    }
}

/// 获取容器资源使用情况
#[command]
pub async fn docker_container_stats(container_id: String) -> Result<String, String> {
    let output = Command::new("docker")
        .args([
            "stats",
            "--no-stream",
            "--format",
            "{{json .}}",
            &container_id,
        ])
        .output()
        .map_err(|e| format!("Failed to get container stats: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Failed to get stats: {}", error))
    }
}
