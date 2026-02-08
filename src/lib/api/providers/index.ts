/**
 * Providers 模块 - Claude Provider 配置管理
 *
 * 包含：
 * - Provider 预设管理
 * - Provider 配置 CRUD
 * - Provider 连接测试
 * - API Key 用量查询
 */

import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import type { ApiKeyUsage, CurrentProviderConfig, ProviderConfig } from "../types";

// ============================================================================
// Provider 预设和当前配置
// ============================================================================

/**
 * 获取预设 Provider 配置列表
 */
export async function getProviderPresets(): Promise<ProviderConfig[]> {
  try {
    return await invoke<ProviderConfig[]>("get_provider_presets");
  } catch (error) {
    logger.error("index", "Failed to get provider presets:", error);
    throw error;
  }
}

/**
 * 获取当前 Provider 配置（从环境变量）
 */
export async function getCurrentProviderConfig(): Promise<CurrentProviderConfig> {
  try {
    return await invoke<CurrentProviderConfig>("get_current_provider_config");
  } catch (error) {
    logger.error("index", "Failed to get current provider config:", error);
    throw error;
  }
}

// ============================================================================
// Provider 配置切换
// ============================================================================

/**
 * 切换到新的 Provider 配置
 */
export async function switchProviderConfig(config: ProviderConfig): Promise<string> {
  try {
    return await invoke<string>("switch_provider_config", { config });
  } catch (error) {
    logger.error("index", "Failed to switch provider config:", error);
    throw error;
  }
}

/**
 * 清除所有 Provider 环境变量
 */
export async function clearProviderConfig(): Promise<string> {
  try {
    return await invoke<string>("clear_provider_config");
  } catch (error) {
    logger.error("index", "Failed to clear provider config:", error);
    throw error;
  }
}

// ============================================================================
// Provider 配置 CRUD
// ============================================================================

/**
 * 获取单个 Provider 配置
 */
export async function getProviderConfig(id: string): Promise<ProviderConfig> {
  try {
    return await invoke<ProviderConfig>("get_provider_config", { id });
  } catch (error) {
    logger.error("index", "Failed to get provider config:", error);
    throw error;
  }
}

/**
 * 添加新的 Provider 配置
 */
export async function addProviderConfig(config: Omit<ProviderConfig, "id">): Promise<string> {
  // Generate ID from name
  const id = config.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const fullConfig: ProviderConfig = {
    ...config,
    id,
  };

  try {
    return await invoke<string>("add_provider_config", { config: fullConfig });
  } catch (error) {
    logger.error("index", "Failed to add provider config:", error);
    throw error;
  }
}

/**
 * 更新现有 Provider 配置
 */
export async function updateProviderConfig(config: ProviderConfig): Promise<string> {
  try {
    return await invoke<string>("update_provider_config", { config });
  } catch (error) {
    logger.error("index", "Failed to update provider config:", error);
    throw error;
  }
}

/**
 * 删除 Provider 配置
 */
export async function deleteProviderConfig(id: string): Promise<string> {
  try {
    return await invoke<string>("delete_provider_config", { id });
  } catch (error) {
    logger.error("index", "Failed to delete provider config:", error);
    throw error;
  }
}

// ============================================================================
// Provider 测试和用量查询
// ============================================================================

/**
 * 测试 Provider 连接
 */
export async function testProviderConnection(baseUrl: string): Promise<string> {
  try {
    return await invoke<string>("test_provider_connection", { baseUrl });
  } catch (error) {
    logger.error("index", "Failed to test provider connection:", error);
    throw error;
  }
}

/**
 * 查询 API Key 用量/余额
 */
export async function queryProviderUsage(baseUrl: string, apiKey: string): Promise<ApiKeyUsage> {
  try {
    return await invoke<ApiKeyUsage>("query_provider_usage", { baseUrl, apiKey });
  } catch (error) {
    logger.error("index", "Failed to query provider usage:", error);
    throw error;
  }
}
