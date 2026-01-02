/**
 * MCP 模块 - MCP Server 管理
 *
 * 包含：
 * - MCP 服务器 CRUD
 * - 多引擎独立隔离控制
 * - 配置导入导出
 * - 连接测试
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AddServerResult,
  ImportResult,
  MCPProjectConfig,
  MCPServer,
  MCPServerSpec,
  McpApps,
  McpServer,
  McpServerWithStatus,
  McpStatus,
  ServerStatus,
} from "../types";

// ============================================================================
// 基础 MCP 服务器操作
// ============================================================================

/**
 * 添加 MCP 服务器
 */
export async function mcpAdd(
  name: string,
  transport: string,
  command?: string,
  args: string[] = [],
  env: Record<string, string> = {},
  url?: string,
  scope: string = "local",
): Promise<AddServerResult> {
  try {
    return await invoke<AddServerResult>("mcp_add", {
      name,
      transport,
      command,
      args,
      env,
      url,
      scope,
    });
  } catch (error) {
    console.error("Failed to add MCP server:", error);
    throw error;
  }
}

/**
 * 列出所有配置的 MCP 服务器
 */
export async function mcpList(): Promise<MCPServer[]> {
  try {
    return await invoke<MCPServer[]>("mcp_list");
  } catch (error) {
    console.error("API: Failed to list MCP servers:", error);
    throw error;
  }
}

/**
 * 获取指定 MCP 服务器的详情
 */
export async function mcpGet(name: string): Promise<MCPServer> {
  try {
    return await invoke<MCPServer>("mcp_get", { name });
  } catch (error) {
    console.error("Failed to get MCP server:", error);
    throw error;
  }
}

/**
 * 移除 MCP 服务器
 */
export async function mcpRemove(name: string): Promise<string> {
  try {
    return await invoke<string>("mcp_remove", { name });
  } catch (error) {
    console.error("Failed to remove MCP server:", error);
    throw error;
  }
}

/**
 * 从 JSON 配置添加 MCP 服务器
 */
export async function mcpAddJson(
  name: string,
  jsonConfig: string,
  scope: string = "local",
): Promise<AddServerResult> {
  try {
    return await invoke<AddServerResult>("mcp_add_json", { name, jsonConfig, scope });
  } catch (error) {
    console.error("Failed to add MCP server from JSON:", error);
    throw error;
  }
}

/**
 * 从 Claude Desktop 导入 MCP 服务器
 */
export async function mcpAddFromClaudeDesktop(scope: string = "local"): Promise<ImportResult> {
  try {
    return await invoke<ImportResult>("mcp_add_from_claude_desktop", { scope });
  } catch (error) {
    console.error("Failed to import from Claude Desktop:", error);
    throw error;
  }
}

// ============================================================================
// MCP 服务器管理
// ============================================================================

/**
 * 启动 Claude Code 作为 MCP 服务器
 */
export async function mcpServe(): Promise<string> {
  try {
    return await invoke<string>("mcp_serve");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    throw error;
  }
}

/**
 * 测试 MCP 服务器连接
 */
export async function mcpTestConnection(name: string): Promise<string> {
  try {
    return await invoke<string>("mcp_test_connection", { name });
  } catch (error) {
    console.error("Failed to test MCP connection:", error);
    throw error;
  }
}

/**
 * 导出 MCP 服务器配置
 */
export async function mcpExportConfig(): Promise<string> {
  try {
    return await invoke<string>("mcp_export_config");
  } catch (error) {
    console.error("Failed to export MCP configuration:", error);
    throw error;
  }
}

/**
 * 重置项目范围服务器审批选择
 */
export async function mcpResetProjectChoices(): Promise<string> {
  try {
    return await invoke<string>("mcp_reset_project_choices");
  } catch (error) {
    console.error("Failed to reset project choices:", error);
    throw error;
  }
}

/**
 * 获取 MCP 服务器状态
 */
export async function mcpGetServerStatus(): Promise<Record<string, ServerStatus>> {
  try {
    return await invoke<Record<string, ServerStatus>>("mcp_get_server_status");
  } catch (error) {
    console.error("Failed to get server status:", error);
    throw error;
  }
}

// ============================================================================
// 项目配置
// ============================================================================

/**
 * 读取项目 .mcp.json 配置
 */
export async function mcpReadProjectConfig(projectPath: string): Promise<MCPProjectConfig> {
  try {
    return await invoke<MCPProjectConfig>("mcp_read_project_config", { projectPath });
  } catch (error) {
    console.error("Failed to read project MCP config:", error);
    throw error;
  }
}

/**
 * 保存项目 .mcp.json 配置
 */
export async function mcpSaveProjectConfig(
  projectPath: string,
  config: MCPProjectConfig,
): Promise<string> {
  try {
    return await invoke<string>("mcp_save_project_config", { projectPath, config });
  } catch (error) {
    console.error("Failed to save project MCP config:", error);
    throw error;
  }
}

// ============================================================================
// MCP 多应用支持方法
// ============================================================================

/**
 * 获取 Claude MCP 配置状态
 */
export async function mcpGetStatus(): Promise<McpStatus> {
  try {
    return await invoke<McpStatus>("mcp_get_claude_status");
  } catch (error) {
    console.error("Failed to get MCP status:", error);
    throw error;
  }
}

/**
 * 获取所有 MCP 服务器（从 Claude 配置）
 * @deprecated 使用 mcpGetUnifiedServers 获取真实的多应用状态
 */
export async function mcpGetAllServers(): Promise<Record<string, MCPServerSpec>> {
  try {
    return await invoke<Record<string, MCPServerSpec>>("mcp_get_all_servers");
  } catch (error) {
    console.error("Failed to get all MCP servers:", error);
    throw error;
  }
}

/**
 * 获取所有应用的 MCP 服务器统一视图
 * @deprecated 使用 mcpGetEngineServers 代替，按引擎独立管理
 */
export async function mcpGetUnifiedServers(): Promise<Record<string, McpServer>> {
  try {
    return await invoke<Record<string, McpServer>>("mcp_get_unified_servers");
  } catch (error) {
    console.error("Failed to get unified MCP servers:", error);
    throw error;
  }
}

// ============================================================================
// 多引擎独立隔离控制 API
// ============================================================================

/**
 * 获取指定引擎的 MCP 服务器列表
 */
export async function mcpGetEngineServers(
  engine: "claude" | "codex" | "gemini",
): Promise<Record<string, MCPServerSpec>> {
  try {
    return await invoke<Record<string, MCPServerSpec>>("mcp_get_engine_servers", {
      engine,
    });
  } catch (error) {
    console.error(`Failed to get ${engine} MCP servers:`, error);
    throw error;
  }
}

/**
 * 在指定引擎中添加或更新 MCP 服务器
 */
export async function mcpUpsertEngineServer(
  engine: "claude" | "codex" | "gemini",
  id: string,
  serverSpec: MCPServerSpec,
): Promise<string> {
  try {
    return await invoke<string>("mcp_upsert_engine_server", {
      engine,
      id,
      serverSpec,
    });
  } catch (error) {
    console.error(`Failed to upsert ${engine} MCP server:`, error);
    throw error;
  }
}

/**
 * 从指定引擎中删除 MCP 服务器
 */
export async function mcpDeleteEngineServer(
  engine: "claude" | "codex" | "gemini",
  id: string,
): Promise<string> {
  try {
    return await invoke<string>("mcp_delete_engine_server", {
      engine,
      id,
    });
  } catch (error) {
    console.error(`Failed to delete ${engine} MCP server:`, error);
    throw error;
  }
}

/**
 * 切换指定引擎中 MCP 服务器的启用状态
 */
export async function mcpToggleEngineServer(
  engine: "claude" | "codex" | "gemini",
  id: string,
  serverSpec: MCPServerSpec,
  enabled: boolean,
): Promise<string> {
  try {
    return await invoke<string>("mcp_toggle_engine_server", {
      engine,
      id,
      serverSpec,
      enabled,
    });
  } catch (error) {
    console.error(`Failed to toggle ${engine} MCP server:`, error);
    throw error;
  }
}

/**
 * 获取指定引擎的 MCP 服务器列表（包含禁用的服务器）
 */
export async function mcpGetEngineServersWithStatus(
  engine: "claude" | "codex" | "gemini",
): Promise<McpServerWithStatus[]> {
  try {
    return await invoke<McpServerWithStatus[]>("mcp_get_engine_servers_with_status", {
      engine,
    });
  } catch (error) {
    console.error(`Failed to get ${engine} MCP servers with status:`, error);
    throw error;
  }
}

/**
 * 添加或更新 MCP 服务器（支持多应用）
 */
export async function mcpUpsertServer(
  id: string,
  name: string,
  serverSpec: MCPServerSpec,
  apps: McpApps,
): Promise<string> {
  try {
    return await invoke<string>("mcp_upsert_server", {
      id,
      name,
      serverSpec,
      apps,
    });
  } catch (error) {
    console.error("Failed to upsert MCP server:", error);
    throw error;
  }
}

/**
 * 删除 MCP 服务器（从所有应用）
 */
export async function mcpDeleteServer(id: string, apps: McpApps): Promise<string> {
  try {
    return await invoke<string>("mcp_delete_server", { id, apps });
  } catch (error) {
    console.error("Failed to delete MCP server:", error);
    throw error;
  }
}

/**
 * 切换 MCP 服务器在指定应用的启用状态
 */
export async function mcpToggleApp(
  id: string,
  serverSpec: MCPServerSpec,
  app: string,
  enabled: boolean,
): Promise<string> {
  try {
    return await invoke<string>("mcp_toggle_app", {
      id,
      serverSpec,
      app,
      enabled,
    });
  } catch (error) {
    console.error("Failed to toggle MCP app:", error);
    throw error;
  }
}

/**
 * 从指定应用导入 MCP 服务器
 */
export async function mcpImportFromApp(app: string): Promise<string[]> {
  try {
    return await invoke<string[]>("mcp_import_from_app", { app });
  } catch (error) {
    console.error("Failed to import from app:", error);
    throw error;
  }
}

/**
 * 验证命令是否在 PATH 中可用
 */
export async function mcpValidateCommand(cmd: string): Promise<boolean> {
  try {
    return await invoke<boolean>("mcp_validate_command", { cmd });
  } catch (error) {
    console.error("Failed to validate command:", error);
    throw error;
  }
}

/**
 * 读取 Claude MCP 配置文本内容
 */
export async function mcpReadClaudeConfig(): Promise<string | null> {
  try {
    return await invoke<string | null>("mcp_read_claude_config");
  } catch (error) {
    console.error("Failed to read Claude MCP config:", error);
    throw error;
  }
}
