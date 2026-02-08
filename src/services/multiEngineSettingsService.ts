/**
 * Multi-Engine Settings Service
 *
 * 多引擎设置存储服务
 * 管理 Claude Code、Codex、Gemini 三种引擎的独立配置
 */

import { logger } from "@/lib/logger";
import {
  EngineType,
  EngineSettings,
  MultiEngineSettingsStore,
  GeneralSettings,
  LegacyClaudeSettings,
  DEFAULT_ENGINE_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  createDefaultMultiEngineSettings,
  isLegacySettings,
  isMultiEngineSettings,
} from "../types/multiEngineSettings";

// =============================================================================
// 存储键
// =============================================================================

const STORAGE_KEY = "fangyu-multi-engine-settings";
const LEGACY_STORAGE_KEY = "fangyu-claude-settings";

// =============================================================================
// 服务类
// =============================================================================

class MultiEngineSettingsService {
  private settings: MultiEngineSettingsStore;
  private listeners: Set<(settings: MultiEngineSettingsStore) => void> = new Set();

  constructor() {
    this.settings = createDefaultMultiEngineSettings();
  }

  // ===========================================================================
  // 加载和保存
  // ===========================================================================

  /**
   * 从本地存储加载设置
   */
  async load(): Promise<MultiEngineSettingsStore> {
    try {
      // 尝试加载新格式
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isMultiEngineSettings(parsed)) {
          this.settings = parsed;
          return this.settings;
        }
      }

      // 尝试加载旧格式并迁移
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (isLegacySettings(parsed)) {
          this.settings = this.migrateFromLegacy(parsed);
          await this.save(); // 保存迁移后的设置
          return this.settings;
        }
      }

      // 使用默认设置
      this.settings = createDefaultMultiEngineSettings();
      return this.settings;
    } catch (error) {
      logger.error(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Failed to load settings:",
        error
      );
      this.settings = createDefaultMultiEngineSettings();
      return this.settings;
    }
  }

  /**
   * 保存设置到本地存储
   */
  async save(): Promise<void> {
    try {
      this.settings.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (error) {
      logger.error(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Failed to save settings:",
        error
      );
      throw error;
    }
  }

  // ===========================================================================
  // 引擎配置操作
  // ===========================================================================

  /**
   * 获取当前活动引擎
   */
  getActiveEngine(): EngineType {
    return this.settings.activeEngine;
  }

  /**
   * 设置当前活动引擎
   */
  setActiveEngine(engine: EngineType): void {
    this.settings.activeEngine = engine;
  }

  /**
   * 获取指定引擎的设置
   */
  getEngineSettings(engine: EngineType): EngineSettings {
    return this.settings.engines[engine] || DEFAULT_ENGINE_SETTINGS[engine];
  }

  /**
   * 更新指定引擎的设置
   */
  updateEngineSettings(engine: EngineType, settings: Partial<EngineSettings>): void {
    this.settings.engines[engine] = {
      ...this.settings.engines[engine],
      ...settings,
    };
  }

  /**
   * 获取指定引擎的权限规则
   */
  getEnginePermissions(engine: EngineType): { allow: string[]; deny: string[] } {
    return (
      this.settings.engines[engine]?.permissions || DEFAULT_ENGINE_SETTINGS[engine].permissions
    );
  }

  /**
   * 更新指定引擎的权限规则
   */
  updateEnginePermissions(
    engine: EngineType,
    permissions: { allow: string[]; deny: string[] }
  ): void {
    if (!this.settings.engines[engine]) {
      this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
    }
    this.settings.engines[engine].permissions = permissions;
  }

  /**
   * 获取指定引擎的环境变量
   */
  getEngineEnv(engine: EngineType): Record<string, string> {
    return this.settings.engines[engine]?.env || DEFAULT_ENGINE_SETTINGS[engine].env;
  }

  /**
   * 更新指定引擎的环境变量
   */
  updateEngineEnv(engine: EngineType, env: Record<string, string>): void {
    if (!this.settings.engines[engine]) {
      this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
    }
    this.settings.engines[engine].env = env;
  }

  /**
   * 获取指定引擎的钩子配置
   */
  getEngineHooks(engine: EngineType): any[] {
    return this.settings.engines[engine]?.hooks || [];
  }

  /**
   * 更新指定引擎的钩子配置
   */
  updateEngineHooks(engine: EngineType, hooks: any[]): void {
    if (!this.settings.engines[engine]) {
      this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
    }
    this.settings.engines[engine].hooks = hooks;
  }

  // ===========================================================================
  // 通用设置操作
  // ===========================================================================

  /**
   * 获取通用设置
   */
  getGeneralSettings(): GeneralSettings {
    return this.settings.general || DEFAULT_GENERAL_SETTINGS;
  }

  /**
   * 更新通用设置
   */
  updateGeneralSettings(settings: Partial<GeneralSettings>): void {
    this.settings.general = {
      ...this.settings.general,
      ...settings,
    };
  }

  // ===========================================================================
  // 完整设置操作
  // ===========================================================================

  /**
   * 获取完整设置
   */
  getSettings(): MultiEngineSettingsStore {
    return this.settings;
  }

  /**
   * 重置为默认设置
   */
  reset(): void {
    this.settings = createDefaultMultiEngineSettings();
  }

  /**
   * 重置指定引擎为默认设置
   */
  resetEngine(engine: EngineType): void {
    this.settings.engines[engine] = { ...DEFAULT_ENGINE_SETTINGS[engine] };
  }

  // ===========================================================================
  // 迁移
  // ===========================================================================

  /**
   * 从旧版设置迁移到新版多引擎设置
   */
  migrateFromLegacy(legacy: LegacyClaudeSettings): MultiEngineSettingsStore {
    const newSettings = createDefaultMultiEngineSettings();

    try {
      // 迁移 Claude Code 设置
      if (legacy.permissions) {
        newSettings.engines["claude"].permissions = {
          allow: Array.isArray(legacy.permissions.allow) ? legacy.permissions.allow : [],
          deny: Array.isArray(legacy.permissions.deny) ? legacy.permissions.deny : [],
        };
      }

      if (legacy.env && typeof legacy.env === "object") {
        newSettings.engines["claude"].env = {
          ...DEFAULT_ENGINE_SETTINGS["claude"].env,
          ...legacy.env,
        };
      }

      if (legacy.hooks) {
        newSettings.engines["claude"].hooks = Array.isArray(legacy.hooks) ? legacy.hooks : [];
      }

      // 迁移通用设置
      if (legacy.language && typeof legacy.language === "string") {
        newSettings.general.language = legacy.language;
      }
      if (typeof legacy.showSystemInitialization === "boolean") {
        newSettings.general.showSystemInitialization = legacy.showSystemInitialization;
      }
      if (typeof legacy.showAllToolResults === "boolean") {
        newSettings.general.showAllToolResults = legacy.showAllToolResults;
      }
      if (typeof legacy.verbose === "boolean") {
        newSettings.general.verbose = legacy.verbose;
      }
      if (typeof legacy.hideAutoContinueMessages === "boolean") {
        newSettings.general.hideAutoContinueMessages = legacy.hideAutoContinueMessages;
      }
      if (typeof legacy.hideStartupWarnings === "boolean") {
        newSettings.general.hideStartupWarnings = legacy.hideStartupWarnings;
      }

      logger.debug(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Successfully migrated legacy settings"
      );
    } catch (error) {
      logger.error(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Migration error, using defaults:",
        error
      );
      this.backupLegacySettings(legacy);
    }

    return newSettings;
  }

  /**
   * 备份旧版设置
   */
  private backupLegacySettings(legacy: LegacyClaudeSettings): void {
    try {
      const backupKey = `${LEGACY_STORAGE_KEY}-backup-${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(legacy));
      logger.debug(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Legacy settings backed up to:",
        backupKey
      );
    } catch (error) {
      logger.error(
        "multiEngineSettingsService",
        "[MultiEngineSettingsService] Failed to backup legacy settings:",
        error
      );
    }
  }

  /**
   * 检查是否需要迁移
   */
  needsMigration(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return !isMultiEngineSettings(parsed);
      } catch {
        return true;
      }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    return !!legacy;
  }

  // ===========================================================================
  // 监听器
  // ===========================================================================

  /**
   * 添加设置变更监听器
   */
  subscribe(listener: (settings: MultiEngineSettingsStore) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}

// =============================================================================
// 单例导出
// =============================================================================

export const multiEngineSettingsService = new MultiEngineSettingsService();

export default multiEngineSettingsService;
