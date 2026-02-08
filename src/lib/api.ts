import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import { codexProviderPresets } from "@/config/codexProviderPresets";
import { HooksManager } from "@/lib/hooksManager";
import type { HooksConfiguration } from "@/types/hooks";
import type {
  HookEventContext,
  HookExecutionResult,
  BackgroundTaskType,
  TaskPriority,
  TaskProgress,
  TaskResult,
  AgentType,
  AgentMessageType,
  AgentMessagePayload,
} from "@/types/api-extended";

// Import cache utilities
import { isCacheValid, SESSION_CACHE } from "./api/cache";
// Import git module utilities
import * as GitModule from "./api/git";
// Import MCP module utilities
import * as McpModule from "./api/mcp";
// Import providers module utilities
import * as ProvidersModule from "./api/providers";
// Import session module utilities
import * as SessionModule from "./api/session";

// Import storage module utilities
import * as StorageModule from "./api/storage";

// Import translation module utilities
import * as TranslationModule from "./api/translation";
// Import usage module utilities
import * as UsageModule from "./api/usage";

// Re-export types for backward compatibility
export type {
  AddServerResult,
  ApiBaseUrlUsage,
  ApiKeyUsage,
  AutoCompactConfig,
  AutoCompactStatus,
  Checkpoint,
  CheckpointFile,
  CheckpointType,
  ClaudeExecutionConfig,
  ClaudeMdFile,
  ClaudePermissionConfig,
  ClaudeSettings,
  ClaudeVersionStatus,
  CodexProviderConfig,
  CompactionStrategy,
  ConversionResult,
  ConversionSource,
  CurrentCodexConfig,
  CurrentGeminiProviderConfig,
  CurrentProviderConfig,
  DailyUsage,
  FileEntry,
  GeminiProviderConfig,
  GitFileChange,
  ImportResult,
  ImportServerResult,
  MCPProjectConfig,
  MCPServer,
  MCPServerConfig,
  MCPServerSpec,
  McpApps,
  McpServer,
  McpServerWithStatus,
  McpStatus,
  ModelUsage,
  ProcessInfo,
  ProcessType,
  Project,
  ProjectUsage,
  PromptRecord,
  ProviderConfig,
  ResetSafetyInfo,
  RewindCapabilities,
  RewindMode,
  SavedImageResult,
  ServerStatus,
  Session,
  SessionCacheTokens,
  SessionContext,
  SessionStatus,
  SmartProjectResult,
  ToolCallInfo,
  TranslationCacheStats,
  TranslationConfig,
  UsageEntry,
  UsageOverview,
  UsageStats,
} from "./api/types";

export { OutputFormat, PermissionMode } from "./api/types";

// Import types locally for use in api object
import type {
  AutoCompactConfig,
  AutoCompactStatus,
  Checkpoint,
  CheckpointType,
  ClaudeExecutionConfig,
  ClaudeMdFile,
  ClaudeSettings,
  ClaudeVersionStatus,
  CodexProviderConfig,
  ConversionResult,
  CurrentCodexConfig,
  CurrentGeminiProviderConfig,
  FileEntry,
  GeminiProviderConfig,
  MCPServerSpec,
  PromptRecord,
  RewindCapabilities,
  RewindMode,
  SavedImageResult,
  Session,
  SessionContext,
  SmartProjectResult,
} from "./api/types";

/**
 * API client for interacting with the Rust backend
 */
export const api = {
  /**
   * Lists all projects in the ~/.claude/projects directory
   * @returns Promise resolving to an array of projects
   */
  listProjects: SessionModule.listProjects,

  /**
   * Retrieves sessions for a specific project (both Claude and Codex)
   * @param projectId - The ID of the project to retrieve sessions for
   * @param projectPath - Optional project path to filter Codex sessions (if not provided, tries to infer from Claude sessions)
   * @returns Promise resolving to an array of sessions
   */
  async getProjectSessions(projectId: string, projectPath?: string): Promise<Session[]> {
    try {
      // Get Claude sessions
      const claudeSessions = await invoke<Session[]>("get_project_sessions", { projectId });

      // Get Codex sessions and filter by project path
      const codexSessions = await this.listCodexSessions();

      const targetPath = projectPath || claudeSessions[0]?.project_path;

      // Normalize paths for comparison (handle Windows backslashes and case insensitivity)
      const normalize = (p: string) =>
        p ? p.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase() : "";
      const targetPathNorm = normalize(targetPath || "");

      const filteredCodexSessions: Session[] = codexSessions
        .filter((cs) => {
          // If we don't have a target path, we can't filter, so return no Codex sessions
          if (!targetPathNorm) return false;

          const csPathNorm = normalize(cs.projectPath);
          const match = csPathNorm === targetPathNorm;

          return match;
        })
        .map((cs) => ({
          id: cs.id,
          project_id: projectId,
          project_path: cs.projectPath,
          created_at: cs.createdAt,
          model: cs.model || "gpt-5.1-codex-max",
          engine: "codex" as const,
          // 🆕 Use actual first message from JSONL file
          first_message: cs.firstMessage || `Codex Session`,
          last_message_timestamp: cs.lastMessageTimestamp,
        }));

      // Merge and sort by creation time
      const allSessions = [
        ...claudeSessions.map((s) => ({ ...s, engine: "claude" as const })),
        ...filteredCodexSessions,
      ];
      allSessions.sort((a, b) => b.created_at - a.created_at);

      return allSessions;
    } catch (error) {
      logger.error("api", "Failed to get project sessions:", error);
      throw error;
    }
  },

  /**
   * Deletes a session and all its associated data
   * @param sessionId - The session ID to delete
   * @param projectId - The project ID this session belongs to
   * @returns Promise resolving to success message
   */
  deleteSession: SessionModule.deleteSession,

  /**
   * Deletes multiple sessions in batch
   * @param sessionIds - Array of session IDs to delete
   * @param projectId - The project ID these sessions belong to
   * @returns Promise resolving to success message
   */
  deleteSessionsBatch: SessionModule.deleteSessionsBatch,

  /**
   * Deletes sessions matching a pattern (e.g., "/compact")
   * @param projectId - The project ID
   * @param pattern - The pattern to match against session first_message or ID
   * @returns Promise resolving to delete result with counts
   */
  deleteSessionsByPattern: SessionModule.deleteSessionsByPattern,

  /**
   * Removes a project from the project list (without deleting files)
   * @param projectId - The ID of the project to remove from list
   * @returns Promise resolving to success message
   */
  deleteProject: SessionModule.deleteProject,

  /**
   * Restores a hidden project back to the project list
   * @param projectId - The ID of the project to restore
   * @returns Promise resolving to success message
   */
  restoreProject: SessionModule.restoreProject,

  /**
   * Lists all hidden projects
   * @returns Promise resolving to array of hidden project IDs
   */
  listHiddenProjects: SessionModule.listHiddenProjects,

  /**
   * Permanently delete a project and all its files
   * @param projectId - The project ID to permanently delete
   * @returns Promise resolving to success message
   */
  deleteProjectPermanently: SessionModule.deleteProjectPermanently,

  /**
   * Reads the Claude settings file
   * @returns Promise resolving to the settings object
   */
  async getClaudeSettings(): Promise<ClaudeSettings> {
    try {
      // Due to #[serde(flatten)] in Rust, the result is directly the settings object
      return await invoke<ClaudeSettings>("get_claude_settings");
    } catch (error) {
      logger.error("api", "Failed to get Claude settings:", error);
      throw error;
    }
  },

  /**
   * Opens a new Claude Code session
   * @param path - Optional path to open the session in
   * @returns Promise resolving when the session is opened
   */
  async openNewSession(path?: string): Promise<string> {
    try {
      return await invoke<string>("open_new_session", { path });
    } catch (error) {
      logger.error("api", "Failed to open new session:", error);
      throw error;
    }
  },

  /**
   * Reads the CLAUDE.md system prompt file
   * @returns Promise resolving to the system prompt content
   */
  async getSystemPrompt(): Promise<string> {
    try {
      return await invoke<string>("get_system_prompt");
    } catch (error) {
      logger.error("api", "Failed to get system prompt:", error);
      throw error;
    }
  },

  /**
   * Checks if Claude Code is installed and gets its version
   * @returns Promise resolving to the version status
   */
  async checkClaudeVersion(): Promise<ClaudeVersionStatus> {
    try {
      return await invoke<ClaudeVersionStatus>("check_claude_version");
    } catch (error) {
      logger.error("api", "Failed to check Claude version:", error);
      throw error;
    }
  },

  /**
   * Saves the CLAUDE.md system prompt file
   * @param content - The new content for the system prompt
   * @returns Promise resolving when the file is saved
   */
  async saveSystemPrompt(content: string): Promise<string> {
    try {
      return await invoke<string>("save_system_prompt", { content });
    } catch (error) {
      logger.error("api", "Failed to save system prompt:", error);
      throw error;
    }
  },

  /**
   * Reads the AGENTS.md system prompt file from Codex directory
   * @returns Promise resolving to the Codex system prompt content
   */
  async getCodexSystemPrompt(): Promise<string> {
    try {
      return await invoke<string>("get_codex_system_prompt");
    } catch (error) {
      logger.error("api", "Failed to get Codex system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves the AGENTS.md system prompt file to Codex directory
   * @param content - The new content for the Codex system prompt
   * @returns Promise resolving when the file is saved
   */
  async saveCodexSystemPrompt(content: string): Promise<string> {
    try {
      return await invoke<string>("save_codex_system_prompt", { content });
    } catch (error) {
      logger.error("api", "Failed to save Codex system prompt:", error);
      throw error;
    }
  },

  /**
   * Reads the GEMINI.md system prompt file from Gemini directory
   * @returns Promise resolving to the content of GEMINI.md
   */
  async getGeminiSystemPrompt(): Promise<string> {
    try {
      return await invoke<string>("get_gemini_system_prompt");
    } catch (error) {
      logger.error("api", "Failed to get Gemini system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves the GEMINI.md system prompt file to Gemini directory
   * @param content - The new content for the Gemini system prompt
   * @returns Promise resolving when the file is saved
   */
  async saveGeminiSystemPrompt(content: string): Promise<string> {
    try {
      return await invoke<string>("save_gemini_system_prompt", { content });
    } catch (error) {
      logger.error("api", "Failed to save Gemini system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves the Claude settings file
   * @param settings - The settings object to save
   * @returns Promise resolving when the settings are saved
   */
  async saveClaudeSettings(settings: ClaudeSettings): Promise<string> {
    try {
      return await invoke<string>("save_claude_settings", { settings });
    } catch (error) {
      logger.error("api", "Failed to save Claude settings:", error);
      throw error;
    }
  },

  /**
   * Updates the thinking mode by modifying MAX_THINKING_TOKENS in settings.json
   * @param enabled - Whether to enable thinking mode
   * @param tokens - Optional token limit (defaults to 10000)
   * @returns Promise resolving when the settings are updated
   */
  async updateThinkingMode(enabled: boolean, tokens?: number): Promise<string> {
    try {
      return await invoke<string>("update_thinking_mode", { enabled, tokens });
    } catch (error) {
      logger.error("api", "Failed to update thinking mode:", error);
      throw error;
    }
  },

  /**
   * Get Claude execution configuration
   * @returns Promise resolving to the current execution config
   */
  async getClaudeExecutionConfig(): Promise<ClaudeExecutionConfig> {
    try {
      return await invoke<ClaudeExecutionConfig>("get_claude_execution_config");
    } catch (error) {
      logger.error("api", "Failed to get Claude execution config:", error);
      throw error;
    }
  },

  /**
   * Update Claude execution configuration
   * @param config - The new execution configuration
   * @returns Promise resolving when the config is saved
   */
  async updateClaudeExecutionConfig(config: ClaudeExecutionConfig): Promise<void> {
    try {
      return await invoke<void>("update_claude_execution_config", { config });
    } catch (error) {
      logger.error("api", "Failed to update Claude execution config:", error);
      throw error;
    }
  },

  /**
   * Finds all CLAUDE.md files in a project directory
   * @param projectPath - The absolute path to the project
   * @returns Promise resolving to an array of CLAUDE.md files
   */
  async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    try {
      return await invoke<ClaudeMdFile[]>("find_claude_md_files", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to find CLAUDE.md files:", error);
      throw error;
    }
  },

  /**
   * Reads a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @returns Promise resolving to the file content
   */
  async readClaudeMdFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_claude_md_file", { filePath });
    } catch (error) {
      logger.error("api", "Failed to read CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Saves a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @param content - The new content for the file
   * @returns Promise resolving when the file is saved
   */
  async saveClaudeMdFile(filePath: string, content: string): Promise<string> {
    try {
      return await invoke<string>("save_claude_md_file", { filePath, content });
    } catch (error) {
      logger.error("api", "Failed to save CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Loads the JSONL history for a specific session (Claude or Codex)
   */
  loadSessionHistory: SessionModule.loadSessionHistory,

  /**
   * 🆕 Loads Codex session history from JSONL file
   */
  loadCodexSessionHistory: SessionModule.loadCodexSessionHistory,

  /**
   * Executes a new interactive Claude Code session with streaming output
   * @param planMode - Enable Plan Mode for read-only research and planning
   * @param tabId - Unique identifier for the tab, used to filter global events
   */
  async executeClaudeCode(
    projectPath: string,
    prompt: string,
    model: string,
    planMode?: boolean,
    maxThinkingTokens?: number,
    tabId?: string
  ): Promise<void> {
    return invoke("execute_claude_code", {
      projectPath,
      prompt,
      model,
      planMode,
      maxThinkingTokens,
      tabId,
    });
  },

  /**
   * Continues an existing Claude Code conversation with streaming output
   * @param planMode - Enable Plan Mode for read-only research and planning
   * @param tabId - Unique identifier for the tab, used to filter global events
   */
  async continueClaudeCode(
    projectPath: string,
    prompt: string,
    model: string,
    planMode?: boolean,
    maxThinkingTokens?: number,
    tabId?: string
  ): Promise<void> {
    return invoke("continue_claude_code", {
      projectPath,
      prompt,
      model,
      planMode,
      maxThinkingTokens,
      tabId,
    });
  },

  /**
   * Resumes an existing Claude Code session by ID with streaming output
   * @param planMode - Enable Plan Mode for read-only research and planning
   * @param tabId - Unique identifier for the tab, used to filter global events
   */
  async resumeClaudeCode(
    projectPath: string,
    sessionId: string,
    prompt: string,
    model: string,
    planMode?: boolean,
    maxThinkingTokens?: number,
    tabId?: string
  ): Promise<void> {
    return invoke("resume_claude_code", {
      projectPath,
      sessionId,
      prompt,
      model,
      planMode,
      maxThinkingTokens,
      tabId,
    });
  },

  /**
   * Cancels the currently running Claude Code execution
   * @param sessionId - Optional session ID to cancel a specific session
   */
  async cancelClaudeExecution(sessionId?: string): Promise<void> {
    return invoke("cancel_claude_execution", { sessionId });
  },

  /**
   * Lists all currently running Claude sessions
   * @returns Promise resolving to list of running Claude sessions
   */
  async listRunningClaudeSessions(): Promise<any[]> {
    return invoke("list_running_claude_sessions");
  },

  /**
   * Gets live output from a Claude session
   * @param sessionId - The session ID to get output for
   * @returns Promise resolving to the current live output
   */
  async getClaudeSessionOutput(sessionId: string): Promise<string> {
    return invoke("get_claude_session_output", { sessionId });
  },

  /**
   * Lists files and directories in a given path
   */
  async listDirectoryContents(directoryPath: string): Promise<FileEntry[]> {
    return invoke("list_directory_contents", { directoryPath });
  },

  /**
   * Searches for files and directories matching a pattern
   */
  async searchFiles(basePath: string, query: string): Promise<FileEntry[]> {
    return invoke("search_files", { basePath, query });
  },

  // ============================================================================
  // USAGE STATISTICS (delegated to UsageModule)
  // ============================================================================

  /** Gets overall usage statistics */
  getUsageStats: UsageModule.getUsageStats,

  /** Gets usage statistics filtered by date range */
  getUsageByDateRange: UsageModule.getUsageByDateRange,

  /** Gets usage statistics grouped by session */
  getSessionStats: UsageModule.getSessionStats,

  /** Gets cache tokens for a specific session */
  getSessionCacheTokens: UsageModule.getSessionCacheTokens,

  /** Gets Codex usage statistics */
  getCodexUsageStats: UsageModule.getCodexUsageStats,

  /** Gets Gemini usage statistics */
  getGeminiUsageStats: UsageModule.getGeminiUsageStats,

  // ============================================================================
  // MCP SERVER OPERATIONS (delegated to McpModule)
  // ============================================================================

  /** Adds a new MCP server */
  mcpAdd: McpModule.mcpAdd,

  /** Lists all configured MCP servers */
  mcpList: McpModule.mcpList,

  /** Gets details for a specific MCP server */
  mcpGet: McpModule.mcpGet,

  /** Removes an MCP server */
  mcpRemove: McpModule.mcpRemove,

  /** Adds an MCP server from JSON configuration */
  mcpAddJson: McpModule.mcpAddJson,

  /** Imports MCP servers from Claude Desktop */
  mcpAddFromClaudeDesktop: McpModule.mcpAddFromClaudeDesktop,

  /** Starts Claude Code as an MCP server */
  mcpServe: McpModule.mcpServe,

  /** Tests connection to an MCP server */
  mcpTestConnection: McpModule.mcpTestConnection,

  /** Exports MCP server configuration from .claude.json */
  mcpExportConfig: McpModule.mcpExportConfig,

  /** Resets project-scoped server approval choices */
  mcpResetProjectChoices: McpModule.mcpResetProjectChoices,

  /** Gets the status of MCP servers */
  mcpGetServerStatus: McpModule.mcpGetServerStatus,

  /** Reads .mcp.json from the current project */
  mcpReadProjectConfig: McpModule.mcpReadProjectConfig,

  /** Saves .mcp.json to the current project */
  mcpSaveProjectConfig: McpModule.mcpSaveProjectConfig,

  // ============================================================================
  // MCP 多应用支持方法 (delegated to McpModule)
  // ============================================================================

  /** 获取 Claude MCP 配置状态 */
  mcpGetStatus: McpModule.mcpGetStatus,

  /** @deprecated 使用 mcpGetUnifiedServers 获取真实的多应用状态 */
  mcpGetAllServers: McpModule.mcpGetAllServers,

  /** @deprecated 使用 mcpGetEngineServers 代替，按引擎独立管理 */
  mcpGetUnifiedServers: McpModule.mcpGetUnifiedServers,

  // ============================================================================
  // 多引擎独立隔离控制 API (delegated to McpModule)
  // ============================================================================

  /** 获取指定引擎的 MCP 服务器列表 */
  mcpGetEngineServers: McpModule.mcpGetEngineServers,

  /** 在指定引擎中添加或更新 MCP 服务器 */
  mcpUpsertEngineServer: McpModule.mcpUpsertEngineServer,

  /** 从指定引擎中删除 MCP 服务器 */
  mcpDeleteEngineServer: McpModule.mcpDeleteEngineServer,

  /** 切换指定引擎中 MCP 服务器的启用状态 */
  mcpToggleEngineServer: McpModule.mcpToggleEngineServer,

  /** 获取指定引擎的 MCP 服务器列表（包含禁用的服务器） */
  mcpGetEngineServersWithStatus: McpModule.mcpGetEngineServersWithStatus,

  /** 添加或更新 MCP 服务器（支持多应用） */
  mcpUpsertServer: McpModule.mcpUpsertServer,

  /** 删除 MCP 服务器（从所有应用） */
  mcpDeleteServer: McpModule.mcpDeleteServer,

  /** 切换 MCP 服务器在指定应用的启用状态 */
  mcpToggleApp: McpModule.mcpToggleApp,

  /** 从指定应用导入 MCP 服务器 */
  mcpImportFromApp: McpModule.mcpImportFromApp,

  /** 验证命令是否在 PATH 中可用 */
  mcpValidateCommand: McpModule.mcpValidateCommand,

  /** 读取 Claude MCP 配置文本内容 */
  mcpReadClaudeConfig: McpModule.mcpReadClaudeConfig,

  /**
   * Get the stored Claude binary path from settings
   * @returns Promise resolving to the path if set, null otherwise
   */
  async getClaudeBinaryPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_claude_binary_path");
    } catch (error) {
      logger.error("api", "Failed to get Claude binary path:", error);
      throw error;
    }
  },

  /**
   * Set the Claude binary path in settings
   * @param path - The absolute path to the Claude binary
   * @returns Promise resolving when the path is saved
   */
  async setClaudeBinaryPath(path: string): Promise<void> {
    try {
      return await invoke<void>("set_claude_binary_path", { path });
    } catch (error) {
      logger.error("api", "Failed to set Claude binary path:", error);
      throw error;
    }
  },

  // ============================================================================
  // STORAGE API (delegated to StorageModule)
  // ============================================================================

  /** Lists all tables in the SQLite database */
  storageListTables: StorageModule.storageListTables,

  /** Reads table data with pagination */
  storageReadTable: StorageModule.storageReadTable,

  /** Updates a row in a table */
  storageUpdateRow: StorageModule.storageUpdateRow,

  /** Deletes a row from a table */
  storageDeleteRow: StorageModule.storageDeleteRow,

  /** Inserts a new row into a table */
  storageInsertRow: StorageModule.storageInsertRow,

  /** Executes a raw SQL query */
  storageExecuteSql: StorageModule.storageExecuteSql,

  /** Resets the entire database */
  storageResetDatabase: StorageModule.storageResetDatabase,

  /**
   * Get hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to the hooks configuration
   */
  async getHooksConfig(
    scope: "user" | "project" | "local",
    projectPath?: string
  ): Promise<HooksConfiguration> {
    try {
      return await invoke<HooksConfiguration>("get_hooks_config", { scope, projectPath });
    } catch (error) {
      logger.error("api", "Failed to get hooks config:", error);
      throw error;
    }
  },

  /**
   * Update hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param hooks - The hooks configuration to save
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to success message
   */
  async updateHooksConfig(
    scope: "user" | "project" | "local",
    hooks: HooksConfiguration,
    projectPath?: string
  ): Promise<string> {
    try {
      return await invoke<string>("update_hooks_config", { scope, projectPath, hooks });
    } catch (error) {
      logger.error("api", "Failed to update hooks config:", error);
      throw error;
    }
  },

  /**
   * Validate a hook command syntax
   * @param command - The shell command to validate
   * @returns Promise resolving to validation result
   */
  async validateHookCommand(command: string): Promise<{ valid: boolean; message: string }> {
    try {
      return await invoke<{ valid: boolean; message: string }>("validate_hook_command", {
        command,
      });
    } catch (error) {
      logger.error("api", "Failed to validate hook command:", error);
      throw error;
    }
  },

  /**
   * Get merged hooks configuration (respecting priority)
   * @param projectPath - The project path
   * @returns Promise resolving to merged hooks configuration
   */
  async getMergedHooksConfig(projectPath: string): Promise<HooksConfiguration> {
    try {
      const [userHooks, projectHooks, localHooks] = await Promise.all([
        this.getHooksConfig("user"),
        this.getHooksConfig("project", projectPath),
        this.getHooksConfig("local", projectPath),
      ]);

      return HooksManager.mergeConfigs(userHooks, projectHooks, localHooks);
    } catch (error) {
      logger.error("api", "Failed to get merged hooks config:", error);
      throw error;
    }
  },

  // ============================================================================
  // Hook File Management (Toggle Hooks On/Off)
  // ============================================================================

  /**
   * List all hook files in the hooks directory
   * @returns Promise resolving to array of hook file information
   */
  async listHookFiles(): Promise<
    {
      name: string;
      path: string;
      extension: string;
      description?: string;
      isEnabled: boolean;
      eventType?: string;
    }[]
  > {
    try {
      return await invoke("list_hook_files");
    } catch (error) {
      logger.error("api", "Failed to list hook files:", error);
      throw error;
    }
  },

  /**
   * Toggle a hook file on/off
   * @param hookPath - Full path to the hook file
   * @param enabled - Whether to enable or disable the hook
   * @param eventType - The event type to attach the hook to (PreToolUse, PostToolUse, SessionStart, Stop)
   * @returns Promise resolving to success status
   */
  async toggleHookFile(hookPath: string, enabled: boolean, eventType: string): Promise<boolean> {
    try {
      return await invoke("toggle_hook_file", { hookPath, enabled, eventType });
    } catch (error) {
      logger.error("api", "Failed to toggle hook file:", error);
      throw error;
    }
  },

  /**
   * Get currently active hooks from settings
   * @returns Promise resolving to active hooks configuration
   */
  async getActiveHooks(): Promise<any> {
    try {
      return await invoke("get_active_hooks");
    } catch (error) {
      logger.error("api", "Failed to get active hooks:", error);
      throw error;
    }
  },

  // ============================================================================
  // Configuration Sync (MCP & Hooks)
  // ============================================================================

  /**
   * 从 .claude.json 同步 MCP 配置到 settings.json
   * 用于启动时同步，确保 UI 显示与实际配置一致
   * @returns Promise resolving to sync result message
   */
  async syncClaudeJsonToSettings(): Promise<string> {
    try {
      return await invoke("sync_claude_json_to_settings");
    } catch (error) {
      logger.error("api", "Failed to sync claude.json to settings:", error);
      throw error;
    }
  },

  /**
   * 从 settings.json 同步 MCP 配置到 .claude.json
   * 用于在 UI 中修改配置后，同步到 Claude Code 实际使用的配置
   * @returns Promise resolving to sync result message
   */
  async syncSettingsToClaudeJson(): Promise<string> {
    try {
      return await invoke("sync_settings_to_claude_json");
    } catch (error) {
      logger.error("api", "Failed to sync settings to claude.json:", error);
      throw error;
    }
  },

  /**
   * 统一切换 MCP 服务器状态（同时更新两个配置文件）
   * @param serverId - MCP 服务器 ID
   * @param enabled - 是否启用
   * @returns Promise resolving to result message
   */
  async toggleMcpServerUnified(serverId: string, enabled: boolean): Promise<string> {
    try {
      return await invoke("toggle_mcp_server_unified", { serverId, enabled });
    } catch (error) {
      logger.error("api", "Failed to toggle MCP server:", error);
      throw error;
    }
  },

  /**
   * 获取 MCP 配置同步状态
   * @returns Promise resolving to sync status
   */
  async getMcpSyncStatus(): Promise<{
    settingsPath: string;
    claudeJsonPath: string;
    settingsMcpCount: number;
    claudeJsonMcpCount: number;
    isSynced: boolean;
    recommendation: string;
  }> {
    try {
      return await invoke("get_mcp_sync_status");
    } catch (error) {
      logger.error("api", "Failed to get MCP sync status:", error);
      throw error;
    }
  },

  /**
   * 完全同步两个配置文件的 mcpServers
   * @returns Promise resolving to sync result message
   */
  async fullSyncMcpConfigs(): Promise<string> {
    try {
      return await invoke("full_sync_mcp_configs");
    } catch (error) {
      logger.error("api", "Failed to full sync MCP configs:", error);
      throw error;
    }
  },

  /**
   * Set custom Claude CLI path
   * @param customPath - Path to custom Claude CLI executable
   * @returns Promise resolving when path is set successfully
   */
  async setCustomClaudePath(customPath: string): Promise<void> {
    try {
      return await invoke<void>("set_custom_claude_path", { customPath });
    } catch (error) {
      logger.error("api", "Failed to set custom Claude path:", error);
      throw error;
    }
  },

  /**
   * Get current Claude CLI path (custom or auto-detected)
   * @returns Promise resolving to current Claude CLI path
   */
  async getClaudePath(): Promise<string> {
    try {
      return await invoke<string>("get_claude_path");
    } catch (error) {
      logger.error("api", "Failed to get Claude path:", error);
      throw error;
    }
  },

  /**
   * Clear custom Claude CLI path and revert to auto-detection
   * @returns Promise resolving when custom path is cleared
   */
  async clearCustomClaudePath(): Promise<void> {
    try {
      return await invoke<void>("clear_custom_claude_path");
    } catch (error) {
      logger.error("api", "Failed to clear custom Claude path:", error);
      throw error;
    }
  },

  // Clipboard API methods

  /**
   * Saves clipboard image data to a temporary file
   * @param base64Data - Base64 encoded image data
   * @param format - Optional image format
   * @returns Promise resolving to saved image result
   */
  async saveClipboardImage(base64Data: string, format?: string): Promise<SavedImageResult> {
    try {
      return await invoke<SavedImageResult>("save_clipboard_image", { base64Data, format });
    } catch (error) {
      logger.error("api", "Failed to save clipboard image:", error);
      throw error;
    }
  },

  // Provider Management API methods (delegated to ProvidersModule)

  /** Gets the list of preset provider configurations */
  getProviderPresets: ProvidersModule.getProviderPresets,

  /** Gets the current provider configuration from environment variables */
  getCurrentProviderConfig: ProvidersModule.getCurrentProviderConfig,

  /** Switches to a new provider configuration */
  switchProviderConfig: ProvidersModule.switchProviderConfig,

  /** Clears all provider-related environment variables */
  clearProviderConfig: ProvidersModule.clearProviderConfig,

  /** Tests connection to a provider endpoint */
  testProviderConnection: ProvidersModule.testProviderConnection,

  /** Adds a new provider configuration */
  addProviderConfig: ProvidersModule.addProviderConfig,

  /** Updates an existing provider configuration */
  updateProviderConfig: ProvidersModule.updateProviderConfig,

  /** Deletes a provider configuration by ID */
  deleteProviderConfig: ProvidersModule.deleteProviderConfig,

  /** Gets a single provider configuration by ID */
  getProviderConfig: ProvidersModule.getProviderConfig,

  /** Queries API Key usage/balance from the provider */
  queryProviderUsage: ProvidersModule.queryProviderUsage,

  // ============================================================================
  // ACEMCP INTEGRATION
  // ============================================================================

  /**
   * Enhances a prompt by adding project context from acemcp semantic search
   * 🆕 v2: 支持历史上下文感知和多轮搜索
   *
   * @param prompt - The original prompt to enhance
   * @param projectPath - Path to the project directory
   * @param sessionId - 🆕 Optional session ID for history-aware search
   * @param projectId - 🆕 Optional project ID for history-aware search
   * @param maxContextLength - Maximum length of context to include (default: 3000)
   * @param enableMultiRound - 🆕 Enable multi-round search for better coverage (default: true)
   * @returns Promise resolving to enhancement result
   */
  async enhancePromptWithContext(
    prompt: string,
    projectPath: string,
    sessionId?: string,
    projectId?: string,
    maxContextLength?: number,
    enableMultiRound?: boolean
  ): Promise<{
    originalPrompt: string;
    enhancedPrompt: string;
    contextCount: number;
    acemcpUsed: boolean;
    error?: string;
  }> {
    try {
      return await invoke("enhance_prompt_with_context", {
        prompt,
        projectPath,
        sessionId,
        projectId,
        maxContextLength,
        enableMultiRound,
      });
    } catch (error) {
      logger.error("api", "Failed to enhance prompt with context:", error);
      throw error;
    }
  },

  /**
   * Tests if acemcp is available and can be used
   * @returns Promise resolving to true if acemcp is available
   */
  async testAcemcpAvailability(): Promise<boolean> {
    try {
      return await invoke<boolean>("test_acemcp_availability");
    } catch (error) {
      logger.error("api", "Failed to test acemcp availability:", error);
      return false;
    }
  },

  /**
   * Saves acemcp configuration to ~/.acemcp/settings.toml
   */
  async saveAcemcpConfig(
    baseUrl: string,
    token: string,
    batchSize?: number,
    maxLinesPerBlob?: number
  ): Promise<void> {
    try {
      return await invoke("save_acemcp_config", {
        baseUrl,
        token,
        batchSize,
        maxLinesPerBlob,
      });
    } catch (error) {
      logger.error("api", "Failed to save acemcp config:", error);
      throw error;
    }
  },

  /**
   * Loads acemcp configuration from ~/.acemcp/settings.toml
   */
  async loadAcemcpConfig(): Promise<{
    baseUrl: string;
    token: string;
    batchSize?: number;
    maxLinesPerBlob?: number;
  }> {
    try {
      return await invoke("load_acemcp_config");
    } catch (error) {
      logger.error("api", "Failed to load acemcp config:", error);
      // 返回默认配置
      return {
        baseUrl: "",
        token: "",
        batchSize: 10,
        maxLinesPerBlob: 800,
      };
    }
  },

  /**
   * Pre-indexes a project in background (non-blocking)
   * Automatically triggered when user selects a project
   */
  async preindexProject(projectPath: string): Promise<void> {
    try {
      // 后台执行，不等待结果
      invoke("preindex_project", { projectPath }).catch((error) => {
        logger.warn("api", "Background pre-indexing failed:", error);
      });
    } catch (error) {
      logger.warn("api", "Failed to start pre-indexing:", error);
    }
  },

  /**
   * Exports the embedded acemcp sidecar to a specified path
   * For CLI configuration
   */
  async exportAcemcpSidecar(targetPath: string): Promise<string> {
    try {
      return await invoke<string>("export_acemcp_sidecar", { targetPath });
    } catch (error) {
      logger.error("api", "Failed to export sidecar:", error);
      throw error;
    }
  },

  /**
   * Gets the path of extracted sidecar in temp directory (if exists)
   */
  async getExtractedSidecarPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_extracted_sidecar_path");
    } catch (error) {
      logger.error("api", "Failed to get extracted sidecar path:", error);
      return null;
    }
  },

  // ============================================================================
  // TRANSLATION API (delegated to TranslationModule)
  // ============================================================================

  /** Translates text using the translation service */
  translateText: TranslationModule.translateText,

  /** Translates multiple texts in batch */
  translateBatch: TranslationModule.translateBatch,

  /** Gets the current translation configuration */
  getTranslationConfig: TranslationModule.getTranslationConfig,

  /** Updates the translation configuration */
  updateTranslationConfig: TranslationModule.updateTranslationConfig,

  /** Clears the translation cache */
  clearTranslationCache: TranslationModule.clearTranslationCache,

  /** Gets translation cache statistics */
  getTranslationCacheStats: TranslationModule.getTranslationCacheStats,

  /** Detects the language of the given text */
  detectTextLanguage: TranslationModule.detectTextLanguage,

  /** Initializes the translation service */
  initTranslationService: TranslationModule.initTranslationService,

  // Auto-Compact Context Management API methods

  /**
   * Initializes the auto-compact manager
   * @returns Promise resolving when manager is initialized
   */
  async initAutoCompactManager(): Promise<void> {
    try {
      return await invoke<void>("init_auto_compact_manager");
    } catch (error) {
      logger.error("api", "Failed to initialize auto-compact manager:", error);
      throw error;
    }
  },

  /**
   * Registers a Claude session for auto-compact monitoring
   * @param sessionId - The session ID to register
   * @param projectPath - The project path
   * @param model - The model being used
   * @returns Promise resolving when session is registered
   */
  async registerAutoCompactSession(
    sessionId: string,
    projectPath: string,
    model: string
  ): Promise<void> {
    try {
      return await invoke<void>("register_auto_compact_session", { sessionId, projectPath, model });
    } catch (error) {
      logger.error("api", "Failed to register auto-compact session:", error);
      throw error;
    }
  },

  /**
   * Updates session token count and checks for auto-compact trigger
   * @param sessionId - The session ID
   * @param tokenCount - Current token count
   * @returns Promise resolving to whether compaction was triggered
   */
  async updateSessionContext(sessionId: string, tokenCount: number): Promise<boolean> {
    try {
      return await invoke<boolean>("update_session_context", { sessionId, tokenCount });
    } catch (error) {
      logger.error("api", "Failed to update session context:", error);
      throw error;
    }
  },

  /**
   * Manually triggers compaction for a session
   * @param sessionId - The session ID
   * @param customInstructions - Optional custom compaction instructions
   * @returns Promise resolving when compaction is complete
   */
  async triggerManualCompaction(sessionId: string, customInstructions?: string): Promise<void> {
    try {
      return await invoke<void>("trigger_manual_compaction", { sessionId, customInstructions });
    } catch (error) {
      logger.error("api", "Failed to trigger manual compaction:", error);
      throw error;
    }
  },

  /**
   * Gets the current auto-compact configuration
   * @returns Promise resolving to the configuration
   */
  async getAutoCompactConfig(): Promise<AutoCompactConfig> {
    try {
      return await invoke<AutoCompactConfig>("get_auto_compact_config");
    } catch (error) {
      logger.error("api", "Failed to get auto-compact config:", error);
      throw error;
    }
  },

  /**
   * Updates the auto-compact configuration
   * @param config - The new configuration
   * @returns Promise resolving when configuration is updated
   */
  async updateAutoCompactConfig(config: AutoCompactConfig): Promise<void> {
    try {
      return await invoke<void>("update_auto_compact_config", { config });
    } catch (error) {
      logger.error("api", "Failed to update auto-compact config:", error);
      throw error;
    }
  },

  /**
   * Gets session context statistics
   * @param sessionId - The session ID
   * @returns Promise resolving to session context information
   */
  async getSessionContextStats(sessionId: string): Promise<SessionContext | null> {
    try {
      return await invoke<SessionContext | null>("get_session_context_stats", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to get session context stats:", error);
      throw error;
    }
  },

  /**
   * Gets all monitored sessions
   * @returns Promise resolving to array of session contexts
   */
  async getAllMonitoredSessions(): Promise<SessionContext[]> {
    try {
      return await invoke<SessionContext[]>("get_all_monitored_sessions");
    } catch (error) {
      logger.error("api", "Failed to get monitored sessions:", error);
      throw error;
    }
  },

  /**
   * Unregisters session from auto-compact monitoring
   * @param sessionId - The session ID to unregister
   * @returns Promise resolving when session is unregistered
   */
  async unregisterAutoCompactSession(sessionId: string): Promise<void> {
    try {
      return await invoke<void>("unregister_auto_compact_session", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to unregister auto-compact session:", error);
      throw error;
    }
  },

  /**
   * Stops auto-compact monitoring
   * @returns Promise resolving when monitoring is stopped
   */
  async stopAutoCompactMonitoring(): Promise<void> {
    try {
      return await invoke<void>("stop_auto_compact_monitoring");
    } catch (error) {
      logger.error("api", "Failed to stop auto-compact monitoring:", error);
      throw error;
    }
  },

  /**
   * Starts auto-compact monitoring
   * @returns Promise resolving when monitoring is started
   */
  async startAutoCompactMonitoring(): Promise<void> {
    try {
      return await invoke<void>("start_auto_compact_monitoring");
    } catch (error) {
      logger.error("api", "Failed to start auto-compact monitoring:", error);
      throw error;
    }
  },

  /**
   * Gets auto-compact status and statistics
   * @returns Promise resolving to status information
   */
  async getAutoCompactStatus(): Promise<AutoCompactStatus> {
    try {
      return await invoke<AutoCompactStatus>("get_auto_compact_status");
    } catch (error) {
      logger.error("api", "Failed to get auto-compact status:", error);
      throw error;
    }
  },

  /**
   * Gets active sessions information
   * @returns Promise resolving to array of active session info
   */
  async getActiveSessions(): Promise<any[]> {
    try {
      return await invoke("get_active_sessions");
    } catch (error) {
      logger.error("api", "Failed to get active sessions:", error);
      throw error;
    }
  },

  // Subagent Management & Specialization API methods

  // Enhanced Hooks Automation API methods

  /**
   * Triggers a hook event with context
   * @param event - The hook event name
   * @param context - The hook execution context
   * @returns Promise resolving to hook chain execution result
   */
  async triggerHookEvent(event: string, context: HookEventContext): Promise<HookExecutionResult> {
    try {
      return await invoke<HookExecutionResult>("trigger_hook_event", { event, context });
    } catch (error) {
      logger.error("api", "Failed to trigger hook event:", error);
      throw error;
    }
  },

  /**
   * Tests a hook condition expression
   * @param condition - The condition expression to test
   * @param context - The hook context for evaluation
   * @returns Promise resolving to whether condition is true
   */
  async testHookCondition(condition: string, context: HookEventContext): Promise<boolean> {
    try {
      return await invoke<boolean>("test_hook_condition", { condition, context });
    } catch (error) {
      logger.error("api", "Failed to test hook condition:", error);
      throw error;
    }
  },

  /**
   * Executes pre-commit code review hook with intelligent decision making
   * @param projectPath - The project path to review
   * @param config - Optional configuration for the review hook
   * @returns Promise resolving to commit decision
   */
  async executePreCommitReview(
    projectPath: string,
    config?: import("@/types/enhanced-hooks").PreCommitCodeReviewConfig
  ): Promise<import("@/types/enhanced-hooks").CommitDecision> {
    try {
      return await invoke<import("@/types/enhanced-hooks").CommitDecision>(
        "execute_pre_commit_review",
        {
          projectPath,
          config,
        }
      );
    } catch (error) {
      logger.error("api", "Failed to execute pre-commit review:", error);
      throw error;
    }
  },

  // ==================== Checkpoint API Methods ====================

  /**
  /**
   * Tracks a batch of messages for a session for checkpointing
   */
  async trackSessionMessages(
    sessionId: string,
    projectId: string,
    projectPath: string,
    messages: string[]
  ): Promise<void> {
    try {
      return await invoke<void>("track_session_messages", {
        sessionId,
        projectId,
        projectPath,
        messages,
      });
    } catch (error) {
      logger.error("api", "Failed to track session messages:", error);
      throw error;
    }
  },

  // ==================== Prompt Revert System ====================

  /** Check and initialize Git repository */
  checkAndInitGit: GitModule.checkAndInitGit,

  /** Check if a git reset operation is safe */
  checkResetSafety: GitModule.checkResetSafety,

  /**
   * Record a prompt being sent
   */
  async recordPromptSent(
    sessionId: string,
    projectId: string,
    projectPath: string,
    promptText: string
  ): Promise<number> {
    try {
      return await invoke<number>("record_prompt_sent", {
        sessionId,
        projectId,
        projectPath,
        promptText,
      });
    } catch (error) {
      logger.error("api", "Failed to record prompt:", error);
      throw error;
    }
  },

  /**
   * Mark a prompt as completed
   */
  async markPromptCompleted(
    sessionId: string,
    projectId: string,
    projectPath: string,
    promptIndex: number,
    promptText?: string
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        sessionId,
        projectId,
        projectPath,
        promptIndex,
      };
      if (promptText !== undefined) {
        payload.promptText = promptText;
      }
      return await invoke<void>("mark_prompt_completed", {
        ...payload,
      });
    } catch (error) {
      logger.error("api", "Failed to mark prompt completed:", error);
      throw error;
    }
  },

  /**
   * Revert to a specific prompt with support for different rewind modes
   */
  async revertToPrompt(
    sessionId: string,
    projectId: string,
    projectPath: string,
    promptIndex: number,
    mode: RewindMode = "both"
  ): Promise<string> {
    try {
      return await invoke<string>("revert_to_prompt", {
        sessionId,
        projectId,
        projectPath,
        promptIndex,
        mode,
      });
    } catch (error) {
      logger.error("api", "Failed to revert to prompt:", error);
      throw error;
    }
  },

  /**
   * Get list of all prompts for a session
   * Extracts all prompts from .jsonl (single source of truth)
   */
  async getPromptList(sessionId: string, projectId: string): Promise<PromptRecord[]> {
    try {
      return await invoke<PromptRecord[]>("get_prompt_list", {
        sessionId,
        projectId,
      });
    } catch (error) {
      logger.error("api", "Failed to get prompt list:", error);
      return [];
    }
  },

  /**
   * Get unified prompt list with git records enriched from .git-records.json
   * Combines .jsonl prompts (all messages) with git records (hash-based mapping)
   * This includes both project interface prompts (with git records) and CLI prompts (without git records)
   */
  async getUnifiedPromptList(sessionId: string, projectId: string): Promise<PromptRecord[]> {
    try {
      return await invoke<PromptRecord[]>("get_unified_prompt_list", {
        sessionId,
        projectId,
      });
    } catch (error) {
      logger.error("api", "Failed to get unified prompt list:", error);
      return [];
    }
  },

  /**
   * Check rewind capabilities for a specific prompt
   * Determines whether a prompt can be reverted fully (conversation + code) or partially (conversation only)
   */
  async checkRewindCapabilities(
    sessionId: string,
    projectId: string,
    promptIndex: number
  ): Promise<RewindCapabilities> {
    try {
      return await invoke<RewindCapabilities>("check_rewind_capabilities", {
        sessionId,
        projectId,
        promptIndex,
      });
    } catch (error) {
      logger.error("api", "Failed to check rewind capabilities:", error);
      throw error;
    }
  },

  // ==================== Claude Extensions (Plugins, Subagents & Skills) ====================

  /**
   * List all installed plugins
   */
  async listPlugins(projectPath?: string): Promise<any[]> {
    try {
      return await invoke<any[]>("list_plugins", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to list plugins:", error);
      return [];
    }
  },

  /**
   * Open plugins directory
   */
  async openPluginsDirectory(projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("open_plugins_directory", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to open plugins directory:", error);
      throw error;
    }
  },

  /**
   * List all subagents
   */
  async listSubagents(projectPath?: string): Promise<any[]> {
    try {
      return await invoke<any[]>("list_subagents", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to list subagents:", error);
      return [];
    }
  },

  /**
   * List all agent skills
   */
  async listAgentSkills(projectPath?: string): Promise<any[]> {
    try {
      return await invoke<any[]>("list_agent_skills", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to list agent skills:", error);
      return [];
    }
  },

  /**
   * Read a subagent file
   */
  async readSubagent(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_subagent", { filePath });
    } catch (error) {
      logger.error("api", "Failed to read subagent:", error);
      throw error;
    }
  },

  /**
   * Read a skill file
   */
  async readSkill(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_skill", { filePath });
    } catch (error) {
      logger.error("api", "Failed to read skill:", error);
      throw error;
    }
  },

  /**
   * Open agents directory in file explorer
   */
  async openAgentsDirectory(projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("open_agents_directory", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to open agents directory:", error);
      throw error;
    }
  },

  /**
   * Open skills directory in file explorer
   */
  async openSkillsDirectory(projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("open_skills_directory", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to open skills directory:", error);
      throw error;
    }
  },

  /**
   * Create a new subagent
   * @param name - Agent name (alphanumeric, hyphens, underscores only)
   * @param description - Short description of the agent
   * @param content - Agent system prompt content
   * @param scope - "project" or "user"
   * @param projectPath - Required for project scope
   */
  async createSubagent(
    name: string,
    description: string,
    content: string,
    scope: "project" | "user",
    projectPath?: string
  ): Promise<{ name: string; path: string; scope: string; description: string; content: string }> {
    try {
      return await invoke("create_subagent", { name, description, content, scope, projectPath });
    } catch (error) {
      logger.error("api", "Failed to create subagent:", error);
      throw error;
    }
  },

  /**
   * Create a new Agent Skill
   * @param name - Skill name (alphanumeric, hyphens, underscores only)
   * @param description - Short description of what this skill does
   * @param content - Skill instructions content
   * @param scope - "project" or "user"
   * @param projectPath - Required for project scope
   */
  async createSkill(
    name: string,
    description: string,
    content: string,
    scope: "project" | "user",
    projectPath?: string
  ): Promise<{ name: string; path: string; scope: string; description: string; content: string }> {
    try {
      return await invoke("create_skill", { name, description, content, scope, projectPath });
    } catch (error) {
      logger.error("api", "Failed to create skill:", error);
      throw error;
    }
  },

  /**
   * Toggle skill enabled/disabled state
   * @param skillName - The skill name (with or without _disabled_ prefix)
   * @param scope - "project" or "user"
   * @param enabled - true to enable, false to disable
   * @param projectPath - Required for project scope
   */
  async toggleSkill(
    skillName: string,
    scope: "project" | "user",
    enabled: boolean,
    projectPath?: string
  ): Promise<boolean> {
    try {
      return await invoke("toggle_skill", { skillName, scope, enabled, projectPath });
    } catch (error) {
      logger.error("api", "Failed to toggle skill:", error);
      throw error;
    }
  },

  /**
   * Open a directory in system file explorer (cross-platform)
   */
  async openDirectoryInExplorer(directoryPath: string): Promise<void> {
    try {
      return await invoke<void>("open_directory_in_explorer", { directoryPath });
    } catch (error) {
      logger.error("api", "Failed to open directory in explorer:", error);
      throw error;
    }
  },

  /**
   * Open a file with system default application (cross-platform)
   */
  async openFileWithDefaultApp(filePath: string): Promise<void> {
    try {
      return await invoke<void>("open_file_with_default_app", { filePath });
    } catch (error) {
      logger.error("api", "Failed to open file with default app:", error);
      throw error;
    }
  },

  // ============================================================================
  // GIT STATISTICS (delegated to GitModule)
  // ============================================================================

  /** Get Git diff statistics between commits */
  getGitDiffStats: GitModule.getGitDiffStats,

  /** Get code changes for current session */
  getSessionCodeChanges: GitModule.getSessionCodeChanges,

  /** Get list of changed files between two commits */
  getGitChangedFiles: GitModule.getGitChangedFiles,

  /** Get unified diff content for a specific file */
  getGitFileDiff: GitModule.getGitFileDiff,

  /** Get file content at a specific commit */
  getGitFileAtCommit: GitModule.getGitFileAtCommit,

  // ==================== OpenAI Codex Integration ====================

  /**
   * Executes a Codex task in non-interactive mode with streaming output
   * @param options - Codex execution options
   * @returns Promise resolving when execution starts (events are streamed via event listeners)
   */
  async executeCodex(options: import("@/types/codex").CodexExecutionOptions): Promise<void> {
    try {
      return await invoke("execute_codex", { options });
    } catch (error) {
      logger.error("api", "Failed to execute Codex:", error);
      throw error;
    }
  },

  /**
   * Resumes a previous Codex session
   * @param sessionId - The session ID to resume
   * @param options - Codex execution options (prompt, mode, etc.)
   * @returns Promise resolving when execution starts
   */
  async resumeCodex(
    sessionId: string,
    options: Omit<import("@/types/codex").CodexExecutionOptions, "sessionId">
  ): Promise<void> {
    try {
      return await invoke("resume_codex", { sessionId, options });
    } catch (error) {
      logger.error("api", "Failed to resume Codex session:", error);
      throw error;
    }
  },

  /**
   * Resumes the last Codex session
   * @param options - Codex execution options
   * @returns Promise resolving when execution starts
   */
  async resumeLastCodex(
    options: Omit<import("@/types/codex").CodexExecutionOptions, "resumeLast">
  ): Promise<void> {
    try {
      return await invoke("resume_last_codex", { options });
    } catch (error) {
      logger.error("api", "Failed to resume last Codex session:", error);
      throw error;
    }
  },

  /**
   * Cancels a running Codex execution
   * @param sessionId - Optional session ID to cancel a specific session
   * @returns Promise resolving when cancellation is complete
   */
  async cancelCodex(sessionId?: string): Promise<void> {
    try {
      return await invoke("cancel_codex", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to cancel Codex execution:", error);
      throw error;
    }
  },

  /**
   * Gets a list of all Codex sessions (with caching)
   * @param forceRefresh - Force refresh the cache
   * @returns Promise resolving to array of Codex sessions
   */
  async listCodexSessions(forceRefresh?: boolean): Promise<import("@/types/codex").CodexSession[]> {
    try {
      // Check cache first
      if (!forceRefresh && isCacheValid(SESSION_CACHE.codexSessions)) {
        logger.debug("api", "[api] Using cached Codex sessions");
        return SESSION_CACHE.codexSessions.data;
      }

      // Load from backend
      logger.debug("api", "[api] Loading Codex sessions from backend...");
      const sessions = await invoke<import("@/types/codex").CodexSession[]>("list_codex_sessions");

      // Update cache
      SESSION_CACHE.codexSessions = {
        data: sessions,
        timestamp: Date.now(),
      };

      return sessions;
    } catch (error) {
      logger.error("api", "Failed to list Codex sessions:", error);
      throw error;
    }
  },

  /**
   * Invalidates the Codex sessions cache
   * Call this after creating/deleting a Codex session
   */
  invalidateCodexSessionsCache() {
    SESSION_CACHE.codexSessions = undefined;
    logger.debug("api", "[api] Codex sessions cache invalidated");
  },

  /**
   * Deletes a Codex session
   * @param sessionId - The session ID to delete
   * @returns Promise resolving to success message
   */
  async deleteCodexSession(sessionId: string): Promise<string> {
    try {
      const result = await invoke<string>("delete_codex_session", { sessionId });
      // Invalidate cache after deletion
      this.invalidateCodexSessionsCache();
      return result;
    } catch (error) {
      logger.error("api", "Failed to delete Codex session:", error);
      throw error;
    }
  },

  /**
   * Checks if Codex is available and properly configured
   * @returns Promise resolving to availability status
   */
  async checkCodexAvailability(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      return await invoke("check_codex_availability");
    } catch (error) {
      logger.error("api", "Failed to check Codex availability:", error);
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  // ============================================================================
  // Codex Mode Configuration (WSL Support)
  // ============================================================================

  /**
   * Gets Codex mode configuration
   * @returns Promise resolving to mode configuration info
   */
  async getCodexModeConfig(): Promise<{
    mode: "auto" | "native" | "wsl";
    wslDistro: string | null;
    actualMode: "native" | "wsl";
    nativeAvailable: boolean;
    wslAvailable: boolean;
    availableDistros: string[];
    isWindows: boolean;
  }> {
    try {
      return await invoke("get_codex_mode_config");
    } catch (error) {
      logger.error("api", "Failed to get Codex mode config:", error);
      throw error;
    }
  },

  /**
   * Sets Codex mode configuration
   * @param mode - The mode to set: 'auto', 'native', or 'wsl'
   * @param wslDistro - Optional WSL distro name
   * @param customCodexPath - Optional custom Codex path
   * @returns Promise resolving to success message
   */
  async setCodexModeConfig(
    mode: "auto" | "native" | "wsl",
    wslDistro?: string | null,
    customCodexPath?: string | null
  ): Promise<string> {
    try {
      return await invoke<string>("set_codex_mode_config", {
        mode,
        wslDistro: wslDistro || null,
        customCodexPath: customCodexPath || null,
      });
    } catch (error) {
      logger.error("api", "Failed to set Codex mode config:", error);
      throw error;
    }
  },

  // ============================================================================
  // Gemini WSL Mode Configuration
  // ============================================================================

  /**
   * Gets Gemini WSL mode configuration
   * @returns Promise resolving to Gemini WSL mode configuration info
   */
  async getGeminiWslModeConfig(): Promise<{
    mode: "auto" | "native" | "wsl";
    wslDistro: string | null;
    wslAvailable: boolean;
    availableDistros: string[];
    wslEnabled: boolean;
    wslGeminiPath: string | null;
    wslGeminiVersion: string | null;
    nativeAvailable: boolean;
    isWindows: boolean;
  }> {
    try {
      return await invoke("get_gemini_wsl_mode_config");
    } catch (error) {
      logger.error("api", "Failed to get Gemini WSL mode config:", error);
      throw error;
    }
  },

  /**
   * Sets Gemini WSL mode configuration
   * @param mode - The mode to set: 'auto', 'native', or 'wsl'
   * @param wslDistro - Optional WSL distro name
   * @returns Promise resolving when config is saved
   */
  async setGeminiWslModeConfig(
    mode: "auto" | "native" | "wsl",
    wslDistro?: string | null
  ): Promise<void> {
    try {
      await invoke("set_gemini_wsl_mode_config", {
        mode,
        wslDistro: wslDistro || null,
      });
    } catch (error) {
      logger.error("api", "Failed to set Gemini WSL mode config:", error);
      throw error;
    }
  },

  // ============================================================================
  // Claude WSL Mode Configuration
  // ============================================================================

  /**
   * Gets Claude WSL mode configuration
   * @returns Promise resolving to Claude WSL mode configuration info
   */
  async getClaudeWslModeConfig(): Promise<{
    mode: "auto" | "native" | "wsl";
    wslDistro: string | null;
    wslAvailable: boolean;
    availableDistros: string[];
    wslEnabled: boolean;
    wslClaudePath: string | null;
    wslClaudeVersion: string | null;
    nativeAvailable: boolean;
    actualMode: "native" | "wsl";
    isWindows: boolean;
  }> {
    try {
      return await invoke("get_claude_wsl_mode_config");
    } catch (error) {
      logger.error("api", "Failed to get Claude WSL mode config:", error);
      throw error;
    }
  },

  /**
   * Sets Claude WSL mode configuration
   * @param mode - The mode to set: 'auto', 'native', or 'wsl'
   * @param wslDistro - Optional WSL distro name
   * @returns Promise resolving to success message
   */
  async setClaudeWslModeConfig(
    mode: "auto" | "native" | "wsl",
    wslDistro?: string | null
  ): Promise<string> {
    try {
      return await invoke("set_claude_wsl_mode_config", {
        mode,
        wslDistro: wslDistro || null,
      });
    } catch (error) {
      logger.error("api", "Failed to set Claude WSL mode config:", error);
      throw error;
    }
  },

  /**
   * Get current Codex CLI path（优先自定义，其次自动检测）
   */
  async getCodexPath(): Promise<string> {
    try {
      return await invoke<string>("get_codex_path");
    } catch (error) {
      logger.error("api", "Failed to get Codex path:", error);
      throw error;
    }
  },

  /**
   * Sets custom Codex CLI path
   * @param path - Path to custom Codex CLI executable (null to clear)
   * @returns Promise resolving to success message
   */
  async setCodexCustomPath(path: string | null): Promise<void> {
    try {
      const normalizedPath = path?.trim() ?? "";

      if (normalizedPath) {
        await invoke<void>("set_custom_codex_path", { customPath: normalizedPath });
      } else {
        await invoke<void>("clear_custom_codex_path");
      }
    } catch (error) {
      logger.error("api", "Failed to set custom Codex path:", error);
      throw error;
    }
  },

  /**
   * Validates a Codex path
   * @param path - Path to validate
   * @returns Promise resolving to whether the path is valid
   */
  async validateCodexPath(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>("validate_codex_path_cmd", { path: path.trim() });
    } catch (error) {
      logger.error("api", "Failed to validate Codex path:", error);
      return false;
    }
  },

  /**
   * Scans for all possible Codex installation paths
   * @returns Promise resolving to array of found paths
   */
  async scanCodexPaths(): Promise<string[]> {
    try {
      return await invoke<string[]>("scan_codex_paths");
    } catch (error) {
      logger.error("api", "Failed to scan Codex paths:", error);
      return [];
    }
  },

  // ============================================================================
  // Codex Rewind Commands
  // ============================================================================

  /**
   * Records a Codex prompt being sent (called before execution)
   * @param sessionId - The Codex session ID
   * @param projectPath - The project path
   * @param promptText - The prompt text
   * @returns Promise resolving to the prompt index
   */
  async recordCodexPromptSent(
    sessionId: string,
    projectPath: string,
    promptText: string
  ): Promise<number> {
    try {
      return await invoke<number>("record_codex_prompt_sent", {
        sessionId,
        projectPath,
        promptText,
      });
    } catch (error) {
      logger.error("api", "Failed to record Codex prompt sent:", error);
      throw error;
    }
  },

  /**
   * Records a Codex prompt completion (called after AI response)
   * @param sessionId - The Codex session ID
   * @param projectPath - The project path
   * @param promptIndex - The prompt index to complete
   */
  async recordCodexPromptCompleted(
    sessionId: string,
    projectPath: string,
    promptIndex: number,
    promptText?: string
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        sessionId,
        projectPath,
        promptIndex,
      };
      if (promptText !== undefined) {
        payload.promptText = promptText;
      }
      await invoke("record_codex_prompt_completed", {
        ...payload,
      });
    } catch (error) {
      logger.error("api", "Failed to record Codex prompt completed:", error);
      throw error;
    }
  },

  /**
   * Gets Codex prompt list for a session (used by revert picker)
   */
  async getCodexPromptList(sessionId: string): Promise<PromptRecord[]> {
    try {
      return await invoke<PromptRecord[]>("get_codex_prompt_list", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to get Codex prompt list:", error);
      return [];
    }
  },

  /**
   * Checks rewind capabilities for a Codex prompt
   * @param sessionId - Codex session ID
   * @param promptIndex - Prompt index to check
   */
  async checkCodexRewindCapabilities(
    sessionId: string,
    promptIndex: number
  ): Promise<RewindCapabilities> {
    try {
      return await invoke<RewindCapabilities>("check_codex_rewind_capabilities", {
        sessionId,
        promptIndex,
      });
    } catch (error) {
      logger.error("api", "Failed to check Codex rewind capabilities:", error);
      // Fallback to conversation-only to keep UI functional
      return {
        conversation: true,
        code: false,
        both: false,
        warning: "无法获取 Codex 撤回能力，只能删除对话记录。",
        source: "cli",
      };
    }
  },

  /**
   * Reverts a Codex session to a specific prompt
   * @param sessionId - The Codex session ID
   * @param projectPath - The project path
   * @param promptIndex - The prompt index to revert to
   * @param mode - The rewind mode (conversation_only, code_only, or both)
   * @returns Promise resolving to the prompt text (for restoring to input)
   */
  async revertCodexToPrompt(
    sessionId: string,
    projectPath: string,
    promptIndex: number,
    mode: RewindMode = "both"
  ): Promise<string> {
    try {
      return await invoke<string>("revert_codex_to_prompt", {
        sessionId,
        projectPath,
        promptIndex,
        mode,
      });
    } catch (error) {
      logger.error("api", "Failed to revert Codex to prompt:", error);
      throw error;
    }
  },

  // ============================================================================
  // Gemini Rewind Commands
  // ============================================================================

  /**
   * Records a Gemini prompt being sent (called before execution)
   * @param sessionId - The Gemini session ID
   * @param projectPath - The project path
   * @param promptText - The prompt text
   * @returns Promise resolving to the prompt index
   */
  async recordGeminiPromptSent(
    sessionId: string,
    projectPath: string,
    promptText: string
  ): Promise<number> {
    try {
      return await invoke<number>("record_gemini_prompt_sent", {
        sessionId,
        projectPath,
        promptText,
      });
    } catch (error) {
      logger.error("api", "Failed to record Gemini prompt sent:", error);
      throw error;
    }
  },

  /**
   * Records a Gemini prompt completion (called after AI response)
   * @param sessionId - The Gemini session ID
   * @param projectPath - The project path
   * @param promptIndex - The prompt index to complete
   */
  async recordGeminiPromptCompleted(
    sessionId: string,
    projectPath: string,
    promptIndex: number,
    promptText?: string
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        sessionId,
        projectPath,
        promptIndex,
      };
      if (promptText !== undefined) {
        payload.promptText = promptText;
      }
      await invoke("record_gemini_prompt_completed", {
        ...payload,
      });
    } catch (error) {
      logger.error("api", "Failed to record Gemini prompt completed:", error);
      throw error;
    }
  },

  /**
   * Gets Gemini prompt list for a session (used by revert picker)
   */
  async getGeminiPromptList(sessionId: string, projectPath: string): Promise<PromptRecord[]> {
    try {
      return await invoke<PromptRecord[]>("get_gemini_prompt_list", { sessionId, projectPath });
    } catch (error) {
      logger.error("api", "Failed to get Gemini prompt list:", error);
      return [];
    }
  },

  /**
   * Checks rewind capabilities for a Gemini prompt
   * @param sessionId - Gemini session ID
   * @param projectPath - The project path
   * @param promptIndex - Prompt index to check
   */
  async checkGeminiRewindCapabilities(
    sessionId: string,
    projectPath: string,
    promptIndex: number
  ): Promise<RewindCapabilities> {
    try {
      return await invoke<RewindCapabilities>("check_gemini_rewind_capabilities", {
        sessionId,
        projectPath,
        promptIndex,
      });
    } catch (error) {
      logger.error("api", "Failed to check Gemini rewind capabilities:", error);
      // Fallback to conversation-only to keep UI functional
      return {
        conversation: true,
        code: false,
        both: false,
        warning: "无法获取 Gemini 撤回能力，只能删除对话记录。",
        source: "project",
      };
    }
  },

  /**
   * Reverts a Gemini session to a specific prompt
   * @param sessionId - The Gemini session ID
   * @param projectPath - The project path
   * @param promptIndex - The prompt index to revert to
   * @param mode - The rewind mode (conversation_only, code_only, or both)
   * @returns Promise resolving to success message
   */
  async revertGeminiToPrompt(
    sessionId: string,
    projectPath: string,
    promptIndex: number,
    mode: RewindMode = "both"
  ): Promise<string> {
    try {
      return await invoke<string>("revert_gemini_to_prompt", {
        sessionId,
        projectPath,
        promptIndex,
        mode,
      });
    } catch (error) {
      logger.error("api", "Failed to revert Gemini to prompt:", error);
      throw error;
    }
  },

  // ============================================================================
  // CODEX PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * Gets the list of Codex provider presets
   * @returns Promise resolving to array of Codex provider configurations
   */
  async getCodexProviderPresets(): Promise<CodexProviderConfig[]> {
    try {
      return await invoke<CodexProviderConfig[]>("get_codex_provider_presets");
    } catch (error) {
      logger.error("api", "Failed to get Codex provider presets:", error);
      throw error;
    }
  },

  /**
   * Gets the current Codex provider configuration from ~/.codex directory
   * @returns Promise resolving to current Codex configuration
   */
  async getCurrentCodexConfig(): Promise<CurrentCodexConfig> {
    try {
      return await invoke<CurrentCodexConfig>("get_current_codex_config");
    } catch (error) {
      logger.error("api", "Failed to get current Codex config:", error);
      throw error;
    }
  },

  /**
   * Switches to a Codex provider configuration
   * Writes auth.json and config.toml to ~/.codex directory
   * @param config - The Codex provider configuration to switch to
   * @returns Promise resolving to success message
   */
  async switchCodexProvider(config: CodexProviderConfig): Promise<string> {
    try {
      return await invoke<string>("switch_codex_provider", { config });
    } catch (error) {
      logger.error("api", "Failed to switch Codex provider:", error);
      throw error;
    }
  },

  /**
   * Adds a new Codex provider configuration
   * @param config - The Codex provider configuration to add
   * @returns Promise resolving to success message
   */
  async addCodexProviderConfig(config: Omit<CodexProviderConfig, "id">): Promise<string> {
    // Generate base ID from name
    const baseId = config.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if ID conflicts with built-in presets
    const builtInIds = codexProviderPresets.map((p) => p.id);

    // Get existing custom configurations to check for conflicts
    let existingConfigs: CodexProviderConfig[] = [];
    try {
      existingConfigs = await this.getCodexProviderPresets();
    } catch (error) {
      logger.warn("api", "Failed to load existing Codex configs:", error);
    }
    const existingIds = existingConfigs.map((c) => c.id);

    // Generate unique ID by adding suffix if needed
    let id = baseId;
    let suffix = 1;
    while (builtInIds.includes(id) || existingIds.includes(id)) {
      id = `${baseId}-${suffix}`;
      suffix++;
    }

    const fullConfig: CodexProviderConfig = {
      ...config,
      id,
      createdAt: Date.now(),
    };

    try {
      return await invoke<string>("add_codex_provider_config", { config: fullConfig });
    } catch (error) {
      logger.error("api", "Failed to add Codex provider config:", error);
      throw error;
    }
  },

  /**
   * Updates an existing Codex provider configuration
   * @param config - The Codex provider configuration to update (with id)
   * @returns Promise resolving to success message
   */
  async updateCodexProviderConfig(config: CodexProviderConfig): Promise<string> {
    try {
      return await invoke<string>("update_codex_provider_config", { config });
    } catch (error) {
      logger.error("api", "Failed to update Codex provider config:", error);
      throw error;
    }
  },

  /**
   * Deletes a Codex provider configuration by ID
   * @param id - The ID of the Codex provider configuration to delete
   * @returns Promise resolving to success message
   */
  async deleteCodexProviderConfig(id: string): Promise<string> {
    try {
      return await invoke<string>("delete_codex_provider_config", { id });
    } catch (error) {
      logger.error("api", "Failed to delete Codex provider config:", error);
      throw error;
    }
  },

  /**
   * Clears Codex provider configuration (resets to official)
   * Removes auth.json and config.toml from ~/.codex directory
   * @returns Promise resolving to success message
   */
  async clearCodexProviderConfig(): Promise<string> {
    try {
      return await invoke<string>("clear_codex_provider_config");
    } catch (error) {
      logger.error("api", "Failed to clear Codex provider config:", error);
      throw error;
    }
  },

  /**
   * Tests Codex provider connection
   * @param baseUrl - The base URL to test
   * @param apiKey - The API key to use for testing
   * @returns Promise resolving to test result message
   */
  async testCodexProviderConnection(baseUrl: string, apiKey?: string): Promise<string> {
    try {
      return await invoke<string>("test_codex_provider_connection", { baseUrl, apiKey });
    } catch (error) {
      logger.error("api", "Failed to test Codex provider connection:", error);
      throw error;
    }
  },

  /**
   * Updates Codex reasoning effort level in config.toml
   * @param level - The reasoning level: 'low', 'medium', 'high', or 'xhigh'
   * @returns Promise resolving to success message
   */
  async updateCodexReasoningLevel(level: "low" | "medium" | "high" | "xhigh"): Promise<string> {
    try {
      return await invoke<string>("update_codex_reasoning_level", { level });
    } catch (error) {
      logger.error("api", "Failed to update Codex reasoning level:", error);
      throw error;
    }
  },

  // ============================================================================
  // GEMINI PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * Gets the list of Gemini provider presets
   * @returns Promise resolving to array of Gemini provider configurations
   */
  async getGeminiProviderPresets(): Promise<GeminiProviderConfig[]> {
    try {
      return await invoke<GeminiProviderConfig[]>("get_gemini_provider_presets");
    } catch (error) {
      logger.error("api", "Failed to get Gemini provider presets:", error);
      throw error;
    }
  },

  /**
   * Gets the current Gemini provider configuration from ~/.gemini directory
   * @returns Promise resolving to current Gemini configuration
   */
  async getCurrentGeminiProviderConfig(): Promise<CurrentGeminiProviderConfig> {
    try {
      return await invoke<CurrentGeminiProviderConfig>("get_current_gemini_provider_config");
    } catch (error) {
      logger.error("api", "Failed to get current Gemini provider config:", error);
      throw error;
    }
  },

  /**
   * Switches to a Gemini provider configuration
   * Writes env to ~/.gemini/.env and updates settings.json
   * @param config - The Gemini provider configuration to switch to
   * @returns Promise resolving to success message
   */
  async switchGeminiProvider(config: GeminiProviderConfig): Promise<string> {
    try {
      return await invoke<string>("switch_gemini_provider", { config });
    } catch (error) {
      logger.error("api", "Failed to switch Gemini provider:", error);
      throw error;
    }
  },

  /**
   * Adds a new Gemini provider configuration
   * @param config - The Gemini provider configuration to add
   * @returns Promise resolving to success message
   */
  async addGeminiProviderConfig(config: Omit<GeminiProviderConfig, "id">): Promise<string> {
    // Generate ID from name
    const id = config.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const fullConfig: GeminiProviderConfig = {
      ...config,
      id,
      createdAt: Date.now(),
    };

    try {
      return await invoke<string>("add_gemini_provider_config", { config: fullConfig });
    } catch (error) {
      logger.error("api", "Failed to add Gemini provider config:", error);
      throw error;
    }
  },

  /**
   * Updates an existing Gemini provider configuration
   * @param config - The Gemini provider configuration to update (with id)
   * @returns Promise resolving to success message
   */
  async updateGeminiProviderConfig(config: GeminiProviderConfig): Promise<string> {
    try {
      return await invoke<string>("update_gemini_provider_config", { config });
    } catch (error) {
      logger.error("api", "Failed to update Gemini provider config:", error);
      throw error;
    }
  },

  /**
   * Deletes a Gemini provider configuration by ID
   * @param id - The ID of the Gemini provider configuration to delete
   * @returns Promise resolving to success message
   */
  async deleteGeminiProviderConfig(id: string): Promise<string> {
    try {
      return await invoke<string>("delete_gemini_provider_config", { id });
    } catch (error) {
      logger.error("api", "Failed to delete Gemini provider config:", error);
      throw error;
    }
  },

  /**
   * Clears Gemini provider configuration (resets to official OAuth)
   * Clears .env and sets auth type to oauth-personal
   * @returns Promise resolving to success message
   */
  async clearGeminiProviderConfig(): Promise<string> {
    try {
      return await invoke<string>("clear_gemini_provider_config");
    } catch (error) {
      logger.error("api", "Failed to clear Gemini provider config:", error);
      throw error;
    }
  },

  /**
   * Tests Gemini provider connection
   * @param baseUrl - The base URL to test
   * @param apiKey - The API key to use for testing
   * @returns Promise resolving to test result message
   */
  async testGeminiProviderConnection(baseUrl: string, apiKey?: string): Promise<string> {
    try {
      return await invoke<string>("test_gemini_provider_connection", { baseUrl, apiKey });
    } catch (error) {
      logger.error("api", "Failed to test Gemini provider connection:", error);
      throw error;
    }
  },

  // ============================================================================
  // Session Conversion (Claude ↔ Codex)
  // ============================================================================

  /**
   * Convert a session between Claude and Codex formats
   * @param sessionId - The source session ID
   * @param targetEngine - The target engine ('claude' | 'codex')
   * @param projectId - The project ID (directory name)
   * @param projectPath - The project path
   * @returns Promise resolving to conversion result
   */
  async convertSession(
    sessionId: string,
    targetEngine: "claude" | "codex",
    projectId: string,
    projectPath: string
  ): Promise<ConversionResult> {
    try {
      return await invoke<ConversionResult>("convert_session", {
        sessionId,
        targetEngine,
        projectId,
        projectPath,
      });
    } catch (error) {
      logger.error("api", "Failed to convert session:", error);
      throw error;
    }
  },

  /**
   * Convert a Claude session to Codex format
   * @param sessionId - The Claude session ID (UUID format)
   * @param projectId - The project ID (directory name)
   * @param projectPath - The project path
   * @returns Promise resolving to conversion result
   */
  async convertClaudeToCodex(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<ConversionResult> {
    try {
      return await invoke<ConversionResult>("convert_claude_to_codex", {
        sessionId,
        projectId,
        projectPath,
      });
    } catch (error) {
      logger.error("api", "Failed to convert Claude to Codex:", error);
      throw error;
    }
  },

  /**
   * Convert a Codex session to Claude format
   * @param sessionId - The Codex session ID (rollout-* format)
   * @param projectId - The project ID (directory name)
   * @param projectPath - The project path
   * @returns Promise resolving to conversion result
   */
  async convertCodexToClaude(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<ConversionResult> {
    try {
      return await invoke<ConversionResult>("convert_codex_to_claude", {
        sessionId,
        projectId,
        projectPath,
      });
    } catch (error) {
      logger.error("api", "Failed to convert Codex to Claude:", error);
      throw error;
    }
  },

  // ==================== Google Gemini CLI Integration ====================

  /**
   * Executes a Gemini CLI session with streaming output
   * @param options - Gemini execution options
   * @returns Promise resolving when execution starts (events are streamed via event listeners)
   */
  async executeGemini(options: import("@/types/gemini").GeminiExecutionOptions): Promise<void> {
    try {
      return await invoke("execute_gemini", { options });
    } catch (error) {
      logger.error("api", "Failed to execute Gemini:", error);
      throw error;
    }
  },

  /**
   * Cancels a running Gemini execution
   * @param sessionId - Optional session ID to cancel (cancels all if not provided)
   */
  async cancelGemini(sessionId?: string): Promise<void> {
    try {
      await invoke("cancel_gemini", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to cancel Gemini:", error);
      throw error;
    }
  },

  /**
   * Checks if Gemini CLI is installed
   * @returns Promise resolving to installation status
   */
  async checkGeminiInstalled(): Promise<import("@/types/gemini").GeminiInstallStatus> {
    try {
      return await invoke("check_gemini_installed");
    } catch (error) {
      logger.error("api", "Failed to check Gemini installation:", error);
      return {
        installed: false,
        error: String(error),
      };
    }
  },

  /**
   * Gets Gemini CLI configuration
   * @returns Promise resolving to Gemini configuration
   */
  async getGeminiConfig(): Promise<import("@/types/gemini").GeminiConfig> {
    try {
      return await invoke("get_gemini_config");
    } catch (error) {
      logger.error("api", "Failed to get Gemini config:", error);
      throw error;
    }
  },

  /**
   * Updates Gemini CLI configuration
   * @param config - New configuration to apply
   */
  async updateGeminiConfig(config: import("@/types/gemini").GeminiConfig): Promise<void> {
    try {
      await invoke("update_gemini_config", { config });
    } catch (error) {
      logger.error("api", "Failed to update Gemini config:", error);
      throw error;
    }
  },

  /**
   * Gets available Gemini models
   * @returns Promise resolving to array of model information
   */
  async getGeminiModels(): Promise<import("@/types/gemini").GeminiModelInfo[]> {
    try {
      return await invoke("get_gemini_models");
    } catch (error) {
      logger.error("api", "Failed to get Gemini models:", error);
      throw error;
    }
  },

  // ============================================================================
  // Gemini Session History
  // ============================================================================

  /**
   * Gets session logs for a project (from logs.json)
   * @param projectPath - Project path to get session logs for
   * @returns Promise resolving to array of session logs
   */
  async getGeminiSessionLogs(
    projectPath: string
  ): Promise<import("@/types/gemini").GeminiSessionLog[]> {
    try {
      return await invoke("get_gemini_session_logs", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to get Gemini session logs:", error);
      throw error;
    }
  },

  /**
   * Lists all sessions for a project (from chats/ directory)
   * @param projectPath - Project path to list sessions for
   * @returns Promise resolving to array of session info
   */
  async listGeminiSessions(
    projectPath: string
  ): Promise<import("@/types/gemini").GeminiSessionInfo[]> {
    try {
      return await invoke("list_gemini_sessions", { projectPath });
    } catch (error) {
      logger.error("api", "Failed to list Gemini sessions:", error);
      throw error;
    }
  },

  /**
   * Gets detailed session information
   * @param projectPath - Project path
   * @param sessionId - Session ID to get details for
   * @returns Promise resolving to complete session detail
   */
  async getGeminiSessionDetail(
    projectPath: string,
    sessionId: string
  ): Promise<import("@/types/gemini").GeminiSessionDetail> {
    try {
      return await invoke("get_gemini_session_detail", { projectPath, sessionId });
    } catch (error) {
      logger.error("api", "Failed to get Gemini session detail:", error);
      throw error;
    }
  },

  /**
   * Delete a Gemini session
   * @param projectPath - Project path
   * @param sessionId - Session ID to delete
   */
  async deleteGeminiSession(projectPath: string, sessionId: string): Promise<void> {
    try {
      await invoke("delete_gemini_session", { projectPath, sessionId });
    } catch (error) {
      logger.error("api", "Failed to delete Gemini session:", error);
      throw error;
    }
  },

  // ============================================================================
  // Smart Project Management (智能项目管理)
  // ============================================================================

  /**
   * Creates a new smart project folder
   * @param sessionTitle - The title to use for the project folder name
   * @returns Promise resolving to the created project info
   */
  async createSmartProject(sessionTitle: string): Promise<SmartProjectResult> {
    try {
      return await invoke<SmartProjectResult>("create_smart_project", { sessionTitle });
    } catch (error) {
      logger.error("api", "Failed to create smart project:", error);
      throw error;
    }
  },

  /**
   * Renames an existing smart project folder
   * @param oldPath - The current project path
   * @param newTitle - The new title for the project
   * @returns Promise resolving to the renamed project info
   */
  async renameSmartProject(oldPath: string, newTitle: string): Promise<SmartProjectResult> {
    try {
      return await invoke<SmartProjectResult>("rename_smart_project", { oldPath, newTitle });
    } catch (error) {
      logger.error("api", "Failed to rename smart project:", error);
      throw error;
    }
  },

  /**
   * Generates a session title from the first user message
   * @param firstMessage - The first user message content
   * @returns Promise resolving to generated session title
   */
  async generateSessionTitle(firstMessage: string): Promise<string> {
    try {
      return await invoke<string>("generate_session_title", { firstMessage });
    } catch (error) {
      logger.error("api", "Failed to generate session title:", error);
      throw error;
    }
  },

  /**
   * Creates a project-level CLAUDE.md file
   * @param projectPath - The project directory path
   * @param sessionTitle - The session title to include in the README
   * @returns Promise resolving to the path of created CLAUDE.md
   */
  async createProjectClaudeMd(projectPath: string, sessionTitle: string): Promise<string> {
    try {
      return await invoke<string>("create_project_claude_md", { projectPath, sessionTitle });
    } catch (error) {
      logger.error("api", "Failed to create project CLAUDE.md:", error);
      throw error;
    }
  },

  // ==================== Checkpoint Management ====================

  /**
   * Initialize the checkpoint manager
   * @param storagePath - Root path for storing checkpoints
   */
  async initCheckpointManager(storagePath: string): Promise<void> {
    try {
      await invoke("init_checkpoint_manager", { storagePath });
    } catch (error) {
      logger.error("api", "Failed to initialize checkpoint manager:", error);
      throw error;
    }
  },

  /**
   * Create a checkpoint for the current session
   * @param sessionId - The session ID
   * @param projectPath - The project directory path
   * @param checkpointType - Type of checkpoint: 'auto', 'manual', or 'tool_call'
   * @param name - Optional checkpoint name
   * @param description - Optional checkpoint description
   * @returns Promise resolving to the created Checkpoint
   */
  async createCheckpoint(
    sessionId: string,
    projectPath: string,
    checkpointType: CheckpointType = "auto",
    name?: string,
    description?: string
  ): Promise<Checkpoint> {
    try {
      return await invoke<Checkpoint>("create_checkpoint", {
        sessionId,
        projectPath,
        checkpointType,
        name,
        description,
      });
    } catch (error) {
      logger.error("api", "Failed to create checkpoint:", error);
      throw error;
    }
  },

  /**
   * List all checkpoints for a session
   * @param sessionId - The session ID
   * @returns Promise resolving to array of Checkpoints
   */
  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    try {
      return await invoke<Checkpoint[]>("list_checkpoints", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to list checkpoints:", error);
      throw error;
    }
  },

  /**
   * Restore a checkpoint
   * @param sessionId - The session ID
   * @param checkpointId - The checkpoint ID to restore
   * @param projectPath - The project directory path
   * @returns Promise resolving to array of restored file paths
   */
  async restoreCheckpoint(
    sessionId: string,
    checkpointId: string,
    projectPath: string
  ): Promise<string[]> {
    try {
      return await invoke<string[]>("restore_checkpoint", {
        sessionId,
        checkpointId,
        projectPath,
      });
    } catch (error) {
      logger.error("api", "Failed to restore checkpoint:", error);
      throw error;
    }
  },

  /**
   * Delete a checkpoint
   * @param sessionId - The session ID
   * @param checkpointId - The checkpoint ID to delete
   */
  async deleteCheckpoint(sessionId: string, checkpointId: string): Promise<void> {
    try {
      await invoke("delete_checkpoint", { sessionId, checkpointId });
    } catch (error) {
      logger.error("api", "Failed to delete checkpoint:", error);
      throw error;
    }
  },

  /**
   * Delete all checkpoints for a session
   * @param sessionId - The session ID
   */
  async deleteSessionCheckpoints(sessionId: string): Promise<void> {
    try {
      await invoke("delete_session_checkpoints", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to delete session checkpoints:", error);
      throw error;
    }
  },

  /**
   * Get the latest checkpoint for a session
   * @param sessionId - The session ID
   * @returns Promise resolving to the latest Checkpoint or null
   */
  async getLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    try {
      return await invoke<Checkpoint | null>("get_latest_checkpoint", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to get latest checkpoint:", error);
      throw error;
    }
  },

  // ============================================================
  // Background Task Management
  // ============================================================

  /**
   * Initialize the background task manager
   * @param maxConcurrent - Maximum number of concurrent tasks (optional)
   */
  async initTaskManager(maxConcurrent?: number): Promise<void> {
    try {
      await invoke("init_task_manager", { maxConcurrent });
    } catch (error) {
      logger.error("api", "Failed to initialize task manager:", error);
      throw error;
    }
  },

  /**
   * Create a new background task
   */
  async createBackgroundTask(
    name: string,
    taskType: BackgroundTaskType,
    description?: string,
    priority?: TaskPriority,
    sessionId?: string,
    tags?: string[]
  ): Promise<string> {
    try {
      return await invoke("create_background_task", {
        name,
        taskType,
        description,
        priority,
        sessionId,
        tags,
      });
    } catch (error) {
      logger.error("api", "Failed to create background task:", error);
      throw error;
    }
  },

  /**
   * Start a background task
   */
  async startBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("start_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to start background task:", error);
      throw error;
    }
  },

  /**
   * Pause a running background task
   */
  async pauseBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("pause_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to pause background task:", error);
      throw error;
    }
  },

  /**
   * Resume a paused background task
   */
  async resumeBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("resume_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to resume background task:", error);
      throw error;
    }
  },

  /**
   * Cancel a background task
   */
  async cancelBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("cancel_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to cancel background task:", error);
      throw error;
    }
  },

  /**
   * Complete a background task
   */
  async completeBackgroundTask(taskId: string, result: TaskResult): Promise<void> {
    try {
      await invoke("complete_background_task", { taskId, result });
    } catch (error) {
      logger.error("api", "Failed to complete background task:", error);
      throw error;
    }
  },

  /**
   * Retry a failed background task
   */
  async retryBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("retry_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to retry background task:", error);
      throw error;
    }
  },

  /**
   * Update task progress
   */
  async updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void> {
    try {
      await invoke("update_task_progress", { taskId, progress });
    } catch (error) {
      logger.error("api", "Failed to update task progress:", error);
      throw error;
    }
  },

  /**
   * Get a specific background task
   */
  async getBackgroundTask(taskId: string): Promise<any | null> {
    try {
      return await invoke("get_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to get background task:", error);
      throw error;
    }
  },

  /**
   * List background tasks
   */
  async listBackgroundTasks(sessionId?: string, activeOnly?: boolean): Promise<any[]> {
    try {
      return await invoke("list_background_tasks", { sessionId, activeOnly });
    } catch (error) {
      logger.error("api", "Failed to list background tasks:", error);
      throw error;
    }
  },

  /**
   * Get task statistics
   */
  async getTaskStats(): Promise<any> {
    try {
      return await invoke("get_task_stats");
    } catch (error) {
      logger.error("api", "Failed to get task stats:", error);
      throw error;
    }
  },

  /**
   * Delete a background task
   */
  async deleteBackgroundTask(taskId: string): Promise<void> {
    try {
      await invoke("delete_background_task", { taskId });
    } catch (error) {
      logger.error("api", "Failed to delete background task:", error);
      throw error;
    }
  },

  /**
   * Cleanup completed tasks
   */
  async cleanupCompletedTasks(olderThanHours?: number): Promise<void> {
    try {
      await invoke("cleanup_completed_tasks", { olderThanHours });
    } catch (error) {
      logger.error("api", "Failed to cleanup completed tasks:", error);
      throw error;
    }
  },

  /**
   * Get next pending task
   */
  async getNextPendingTask(): Promise<string | null> {
    try {
      return await invoke("get_next_pending_task");
    } catch (error) {
      logger.error("api", "Failed to get next pending task:", error);
      throw error;
    }
  },

  // ============================================================
  // Parallel Agent System
  // ============================================================

  /**
   * Initialize parallel agent manager
   */
  async initParallelAgentManager(): Promise<void> {
    try {
      await invoke("init_parallel_agent_manager");
    } catch (error) {
      logger.error("api", "Failed to initialize parallel agent manager:", error);
      throw error;
    }
  },

  /**
   * Create a parallel task group
   */
  async createParallelGroup(name: string, sessionId: string, description?: string): Promise<any> {
    try {
      return await invoke("create_parallel_group", { name, sessionId, description });
    } catch (error) {
      logger.error("api", "Failed to create parallel group:", error);
      throw error;
    }
  },

  /**
   * Add a task to parallel group
   */
  async addParallelTask(
    groupId: string,
    name: string,
    description: string,
    prompt: string,
    agentType?: AgentType,
    dependencies?: string[],
    priority?: number
  ): Promise<string> {
    try {
      return await invoke("add_parallel_task", {
        groupId,
        name,
        description,
        prompt,
        agentType,
        dependencies,
        priority,
      });
    } catch (error) {
      logger.error("api", "Failed to add parallel task:", error);
      throw error;
    }
  },

  /**
   * Add an agent to parallel group
   */
  async addParallelAgent(
    groupId: string,
    name: string,
    agentType?: AgentType,
    capabilities?: string[]
  ): Promise<string> {
    try {
      return await invoke("add_parallel_agent", { groupId, name, agentType, capabilities });
    } catch (error) {
      logger.error("api", "Failed to add parallel agent:", error);
      throw error;
    }
  },

  /**
   * Start parallel group
   */
  async startParallelGroup(groupId: string): Promise<Array<[string, string]>> {
    try {
      return await invoke("start_parallel_group", { groupId });
    } catch (error) {
      logger.error("api", "Failed to start parallel group:", error);
      throw error;
    }
  },

  /**
   * Complete a parallel task
   */
  async completeParallelTask(groupId: string, taskId: string, result: TaskResult): Promise<void> {
    try {
      await invoke("complete_parallel_task", { groupId, taskId, result });
    } catch (error) {
      logger.error("api", "Failed to complete parallel task:", error);
      throw error;
    }
  },

  /**
   * Fail a parallel task
   */
  async failParallelTask(groupId: string, taskId: string, error: string): Promise<void> {
    try {
      await invoke("fail_parallel_task", { groupId, taskId, error });
    } catch (error) {
      logger.error("api", "Failed to fail parallel task:", error);
      throw error;
    }
  },

  /**
   * Get parallel group
   */
  async getParallelGroup(groupId: string): Promise<any> {
    try {
      return await invoke("get_parallel_group", { groupId });
    } catch (error) {
      logger.error("api", "Failed to get parallel group:", error);
      throw error;
    }
  },

  /**
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<any> {
    try {
      return await invoke("get_group_stats", { groupId });
    } catch (error) {
      logger.error("api", "Failed to get group stats:", error);
      throw error;
    }
  },

  /**
   * List session groups
   */
  async listSessionGroups(sessionId: string): Promise<any[]> {
    try {
      return await invoke("list_session_groups", { sessionId });
    } catch (error) {
      logger.error("api", "Failed to list session groups:", error);
      throw error;
    }
  },

  /**
   * Delete parallel group
   */
  async deleteParallelGroup(groupId: string): Promise<void> {
    try {
      await invoke("delete_parallel_group", { groupId });
    } catch (error) {
      logger.error("api", "Failed to delete parallel group:", error);
      throw error;
    }
  },

  /**
   * Send agent message
   */
  async sendAgentMessage(
    groupId: string,
    fromAgent: string,
    toAgent: string | null,
    messageType: AgentMessageType,
    payload: AgentMessagePayload
  ): Promise<void> {
    try {
      await invoke("send_agent_message", { groupId, fromAgent, toAgent, messageType, payload });
    } catch (error) {
      logger.error("api", "Failed to send agent message:", error);
      throw error;
    }
  },

  /**
   * Lock resource
   */
  async lockResource(groupId: string, resource: string, agentId: string): Promise<void> {
    try {
      await invoke("lock_resource", { groupId, resource, agentId });
    } catch (error) {
      logger.error("api", "Failed to lock resource:", error);
      throw error;
    }
  },

  /**
   * Unlock resource
   */
  async unlockResource(groupId: string, resource: string, agentId: string): Promise<void> {
    try {
      await invoke("unlock_resource", { groupId, resource, agentId });
    } catch (error) {
      logger.error("api", "Failed to unlock resource:", error);
      throw error;
    }
  },

  // ==================== DevTools (开发者工具) ====================

  /**
   * 打开开发者工具（F12）
   */
  async openDevtools(): Promise<void> {
    try {
      await invoke("open_devtools");
    } catch (error) {
      logger.error("api", "Failed to open devtools:", error);
      throw error;
    }
  },

  /**
   * 关闭开发者工具
   */
  async closeDevtools(): Promise<void> {
    try {
      await invoke("close_devtools");
    } catch (error) {
      logger.error("api", "Failed to close devtools:", error);
      throw error;
    }
  },

  /**
   * 检查开发者工具是否打开
   */
  async isDevtoolsOpen(): Promise<boolean> {
    try {
      return await invoke<boolean>("is_devtools_open");
    } catch (error) {
      logger.error("api", "Failed to check devtools status:", error);
      return false;
    }
  },

  // ==================== LLM Text Generation (文本生成) ====================

  /**
   * 使用 LLM 生成文本（用于摘要、翻译等）
   * @param prompt 提示词
   * @param model 模型类型 ("haiku" | "sonnet" | "opus")
   * @param apiKey 可选的 API Key（不传则从配置读取）
   * @param apiBase 可选的 API Base URL
   * @returns 生成的文本
   */
  async generateTextWithLLM(
    prompt: string,
    model: "haiku" | "sonnet" | "opus" = "haiku",
    apiKey?: string,
    apiBase?: string
  ): Promise<string> {
    try {
      // 如果没有传入 apiKey，尝试从 provider config 获取
      let effectiveApiKey = apiKey;
      if (!effectiveApiKey) {
        try {
          const providerConfig = await ProvidersModule.getCurrentProviderConfig();
          effectiveApiKey = providerConfig.anthropic_api_key || providerConfig.anthropic_auth_token;
        } catch {
          // 忽略错误，让后端从 settings.json 读取
        }
      }

      return await invoke<string>("generate_text_with_llm", {
        prompt,
        model,
        apiKey: effectiveApiKey || null,
        apiBase: apiBase || null,
      });
    } catch (error) {
      logger.error("api", "Failed to generate text with LLM:", error);
      throw error;
    }
  },
};
