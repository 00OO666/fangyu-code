/**
 * 输出显示设置 Hook
 *
 * 管理消息显示的各种选项，让用户能够控制看到哪些内容
 * 解决问题：用户看不到完整的大模型输出（思考过程、系统消息等）
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * 输出显示设置接口
 */
export interface OutputDisplaySettings {
  /** 显示所有消息（包括系统消息、Warmup等） */
  showAllMessages: boolean;
  /** 显示思考过程（<thinking> 标签内容） */
  showThinkingProcess: boolean;
  /** 显示工具执行结果 */
  showToolResults: boolean;
  /** 显示系统消息（启动警告、MCP初始化等） */
  showSystemMessages: boolean;
  /** 显示 Warmup 消息 */
  showWarmupMessages: boolean;
  /** 显示自动继续消息 */
  showAutoContinueMessages: boolean;
  /** 显示调试信息 */
  showDebugInfo: boolean;
  /** 默认展开思考过程 */
  defaultExpandThinking: boolean;
}

const STORAGE_KEY = 'fangyu-output-display-settings';

/**
 * 默认设置 - 优化用户体验
 * 默认显示更多内容，让用户能看到完整的操作过程
 */
const DEFAULT_SETTINGS: OutputDisplaySettings = {
  showAllMessages: true,          // ✅ 显示所有消息（包括系统消息、Warmup等）
  showThinkingProcess: true,      // 默认显示思考过程
  showToolResults: true,          // 默认显示工具结果
  showSystemMessages: true,       // ✅ 显示系统消息
  showWarmupMessages: true,       // ✅ 显示 Warmup
  showAutoContinueMessages: true, // 🔧 FIX: 默认显示自动继续消息的输出
  showDebugInfo: false,           // 默认隐藏调试信息
  defaultExpandThinking: true,    // 默认展开思考过程
};

/**
 * 从 localStorage 加载设置
 */
function loadSettings(): OutputDisplaySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 合并默认值，确保新增的设置项有默认值
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    logger.warn('useOutputDisplaySettings', '[OutputDisplaySettings] Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * 保存设置到 localStorage
 */
function saveSettings(settings: OutputDisplaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.warn('useOutputDisplaySettings', '[OutputDisplaySettings] Failed to save settings:', error);
  }
}

/**
 * 输出显示设置 Hook
 *
 * @example
 * const { settings, updateSettings, resetSettings } = useOutputDisplaySettings();
 *
 * // 切换显示所有消息
 * updateSettings({ showAllMessages: true });
 *
 * // 重置为默认设置
 * resetSettings();
 */
export function useOutputDisplaySettings() {
  const [settings, setSettings] = useState<OutputDisplaySettings>(loadSettings);

  // 监听其他标签页的设置变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          setSettings({ ...DEFAULT_SETTINGS, ...newSettings });
        } catch {
          // 忽略解析错误
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * 更新设置
   */
  const updateSettings = useCallback((updates: Partial<OutputDisplaySettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  /**
   * 重置为默认设置
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  /**
   * 切换单个设置
   */
  const toggleSetting = useCallback((key: keyof OutputDisplaySettings) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: !prev[key] };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  /**
   * 计算消息过滤选项（供 useDisplayableMessages 使用）
   */
  const filterOptions = useMemo(() => ({
    hideWarmupMessages: !settings.showWarmupMessages && !settings.showAllMessages,
    hideStartupWarnings: !settings.showSystemMessages && !settings.showAllMessages,
    hideAutoContinueMessages: !settings.showAutoContinueMessages && !settings.showAllMessages,
    showAllToolResults: settings.showToolResults || settings.showAllMessages,
  }), [settings]);

  return {
    settings,
    updateSettings,
    resetSettings,
    toggleSetting,
    filterOptions,
    DEFAULT_SETTINGS,
  };
}

/**
 * 全局设置实例（用于非 React 环境）
 */
let globalSettings: OutputDisplaySettings | null = null;

export function getGlobalOutputDisplaySettings(): OutputDisplaySettings {
  if (!globalSettings) {
    globalSettings = loadSettings();
  }
  return globalSettings;
}

export function setGlobalOutputDisplaySettings(settings: Partial<OutputDisplaySettings>): void {
  globalSettings = { ...getGlobalOutputDisplaySettings(), ...settings };
  saveSettings(globalSettings);
}
