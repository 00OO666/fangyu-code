/**
 * 全局引擎状态缓存 Hook
 *
 * 避免多个组件重复检测引擎安装状态，使用全局缓存确保只检测一次
 * 包含模式配置，避免进入历史会话页面时重复触发 WSL 检测
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// 模式配置类型
export interface CodexModeConfig {
  mode: 'auto' | 'native' | 'wsl';
  wslDistro: string | null;
  actualMode: 'native' | 'wsl';
  nativeAvailable: boolean;
  wslAvailable: boolean;
  availableDistros: string[];
  isWindows: boolean;
}

export interface GeminiWslModeConfig {
  mode: 'auto' | 'native' | 'wsl';
  wslDistro: string | null;
  wslAvailable: boolean;
  availableDistros: string[];
  wslEnabled: boolean;
  wslGeminiPath: string | null;
  wslGeminiVersion: string | null;
  nativeAvailable: boolean;
  isWindows: boolean;
}

export interface ClaudeWslModeConfig {
  mode: 'auto' | 'native' | 'wsl';
  wslDistro: string | null;
  wslAvailable: boolean;
  availableDistros: string[];
  wslEnabled: boolean;
  wslClaudePath: string | null;
  wslClaudeVersion: string | null;
  nativeAvailable: boolean;
  actualMode: 'native' | 'wsl';
  isWindows: boolean;
}

export interface EngineStatusInfo {
  claude: {
    installed: boolean;
    version?: string;
    wslModeConfig?: ClaudeWslModeConfig;
  };
  codex: {
    available: boolean;
    version?: string;
    modeConfig?: CodexModeConfig;
  };
  gemini: {
    installed: boolean;
    version?: string;
    wslModeConfig?: GeminiWslModeConfig;
  };
}

// 全局缓存
let globalEngineStatus: EngineStatusInfo | null = null;
let loadPromise: Promise<EngineStatusInfo> | null = null;
const listeners = new Set<(status: EngineStatusInfo) => void>();

// 通知所有监听者
const notifyListeners = (status: EngineStatusInfo) => {
  listeners.forEach(listener => listener(status));
};

// 加载引擎状态
const loadEngineStatus = async (): Promise<EngineStatusInfo> => {
  // 如果已有缓存，直接返回
  if (globalEngineStatus) {
    return globalEngineStatus;
  }

  // 如果正在加载，等待加载完成
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // 并行检测所有引擎和模式配置
      const [
        claudeResult,
        codexResult,
        geminiResult,
        codexModeResult,
        geminiWslModeResult,
        claudeWslModeResult,
      ] = await Promise.allSettled([
        api.checkClaudeVersion(),
        api.checkCodexAvailability(),
        api.checkGeminiInstalled(),
        api.getCodexModeConfig?.() ?? Promise.resolve(null),
        api.getGeminiWslModeConfig?.() ?? Promise.resolve(null),
        api.getClaudeWslModeConfig?.() ?? Promise.resolve(null),
      ]);

      const status: EngineStatusInfo = {
        claude: {
          installed: claudeResult.status === 'fulfilled' ? claudeResult.value.is_installed : false,
          version: claudeResult.status === 'fulfilled' ? claudeResult.value.version : undefined,
          wslModeConfig: claudeWslModeResult.status === 'fulfilled' ? claudeWslModeResult.value : undefined,
        },
        codex: {
          available: codexResult.status === 'fulfilled' ? codexResult.value.available : false,
          version: codexResult.status === 'fulfilled' ? codexResult.value.version : undefined,
          modeConfig: codexModeResult.status === 'fulfilled' ? codexModeResult.value : undefined,
        },
        gemini: {
          installed: geminiResult.status === 'fulfilled' ? geminiResult.value.installed : false,
          version: geminiResult.status === 'fulfilled' ? geminiResult.value.version : undefined,
          wslModeConfig: geminiWslModeResult.status === 'fulfilled' ? geminiWslModeResult.value : undefined,
        },
      };

      globalEngineStatus = status;
      notifyListeners(status);
      return status;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
};

// 强制刷新缓存
export const refreshEngineStatus = async (): Promise<EngineStatusInfo> => {
  globalEngineStatus = null;
  loadPromise = null;
  return loadEngineStatus();
};

// 获取当前缓存的状态（不触发加载）
export const getCachedEngineStatus = (): EngineStatusInfo | null => {
  return globalEngineStatus;
};

/**
 * useEngineStatus Hook
 *
 * 使用全局缓存的引擎状态，避免重复检测
 */
export const useEngineStatus = () => {
  const [status, setStatus] = useState<EngineStatusInfo | null>(globalEngineStatus);
  const [loading, setLoading] = useState(!globalEngineStatus);

  useEffect(() => {
    // 订阅状态变化
    const listener = (newStatus: EngineStatusInfo) => {
      setStatus(newStatus);
      setLoading(false);
    };
    listeners.add(listener);

    // 如果没有缓存，触发加载
    if (!globalEngineStatus) {
      loadEngineStatus().then(newStatus => {
        setStatus(newStatus);
        setLoading(false);
      });
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const newStatus = await refreshEngineStatus();
    setStatus(newStatus);
    setLoading(false);
    return newStatus;
  }, []);

  return {
    status,
    loading,
    refresh,
    // 便捷访问器
    claudeInstalled: status?.claude.installed ?? false,
    claudeVersion: status?.claude.version,
    claudeWslModeConfig: status?.claude.wslModeConfig,
    codexAvailable: status?.codex.available ?? false,
    codexVersion: status?.codex.version,
    codexModeConfig: status?.codex.modeConfig,
    geminiInstalled: status?.gemini.installed ?? false,
    geminiVersion: status?.gemini.version,
    geminiWslModeConfig: status?.gemini.wslModeConfig,
  };
};
