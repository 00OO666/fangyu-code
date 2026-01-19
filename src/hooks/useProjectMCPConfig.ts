/**
 * useProjectMCPConfig Hook
 *
 * 管理项目级别的 MCP 配置 (.mcp.json)
 * 支持读取、保存、切换项目级 MCP 服务器开关
 */

import { useCallback, useEffect, useState } from "react";
import { api, type MCPProjectConfig, type MCPServerSpec } from "@/lib/api";

export type MCPConfigScope = "global" | "project";

interface UseProjectMCPConfigOptions {
  /**
   * 当前项目路径
   */
  projectPath?: string;
  /**
   * 引擎类型
   */
  engine: "claude" | "codex" | "gemini" | "siliconflow" | "kiro";
  /**
   * 配置作用域（全局 vs 项目）
   */
  scope: MCPConfigScope;
}

interface UseProjectMCPConfigReturn {
  /**
   * 项目级配置
   */
  projectConfig: MCPProjectConfig | null;
  /**
   * 是否正在加载
   */
  loading: boolean;
  /**
   * 错误信息
   */
  error: string | null;
  /**
   * 重新加载项目配置
   */
  reloadProjectConfig: () => Promise<void>;
  /**
   * 保存项目配置
   */
  saveProjectConfig: (config: MCPProjectConfig) => Promise<void>;
  /**
   * 切换项目级 MCP 服务器开关
   */
  toggleProjectServer: (serverId: string, spec: MCPServerSpec, enabled: boolean) => Promise<void>;
  /**
   * 检查服务器在项目配置中是否启用
   */
  isServerEnabledInProject: (serverId: string) => boolean;
}

/**
 * Hook for managing project-level MCP configuration
 */
export function useProjectMCPConfig(
  options: UseProjectMCPConfigOptions,
): UseProjectMCPConfigReturn {
  const { projectPath, engine: _engine, scope } = options;

  const [projectConfig, setProjectConfig] = useState<MCPProjectConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载项目配置
   */
  const loadProjectConfig = useCallback(async () => {
    if (scope !== "project" || !projectPath) {
      setProjectConfig(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const config = await api.mcpReadProjectConfig(projectPath);
      setProjectConfig(config);
    } catch (err) {
      // 如果文件不存在，创建空配置
      if (err instanceof Error && err.message.includes("not found")) {
        console.log("[useProjectMCPConfig] No .mcp.json found, initializing empty config");
        setProjectConfig({ mcpServers: {} });
        setError(null);
      } else {
        console.error("[useProjectMCPConfig] Failed to load project config:", err);
        setError(err instanceof Error ? err.message : "加载项目配置失败");
      }
    } finally {
      setLoading(false);
    }
  }, [projectPath, scope]);

  /**
   * 保存项目配置
   */
  const saveProjectConfig = useCallback(
    async (config: MCPProjectConfig) => {
      if (!projectPath) {
        throw new Error("No project path specified");
      }

      try {
        setLoading(true);
        setError(null);
        await api.mcpSaveProjectConfig(projectPath, config);
        setProjectConfig(config);
        console.log("[useProjectMCPConfig] Project config saved:", config);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "保存项目配置失败";
        setError(errorMsg);
        console.error("[useProjectMCPConfig] Failed to save project config:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectPath],
  );

  /**
   * 切换项目级 MCP 服务器开关
   */
  const toggleProjectServer = useCallback(
    async (serverId: string, spec: MCPServerSpec, enabled: boolean) => {
      if (!projectPath) {
        throw new Error("No project path specified");
      }

      const currentConfig = projectConfig || { mcpServers: {} };
      const newConfig: MCPProjectConfig = {
        ...currentConfig,
        mcpServers: {
          ...currentConfig.mcpServers,
        },
      };

      if (enabled) {
        // 启用：添加到项目配置
        newConfig.mcpServers[serverId] = spec;
        console.log(`[useProjectMCPConfig] Enabling server in project: ${serverId}`);
      } else {
        // 禁用：从项目配置中移除
        delete newConfig.mcpServers[serverId];
        console.log(`[useProjectMCPConfig] Disabling server in project: ${serverId}`);
      }

      await saveProjectConfig(newConfig);
    },
    [projectPath, projectConfig, saveProjectConfig],
  );

  /**
   * 检查服务器在项目配置中是否启用
   */
  const isServerEnabledInProject = useCallback(
    (serverId: string): boolean => {
      if (!projectConfig) return false;
      return serverId in projectConfig.mcpServers;
    },
    [projectConfig],
  );

  // 加载项目配置
  useEffect(() => {
    loadProjectConfig();
  }, [loadProjectConfig]);

  return {
    projectConfig,
    loading,
    error,
    reloadProjectConfig: loadProjectConfig,
    saveProjectConfig,
    toggleProjectServer,
    isServerEnabledInProject,
  };
}
