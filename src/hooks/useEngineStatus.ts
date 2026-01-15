/**
 * 全局引擎状态缓存 Hook
 *
 * 避免多个组件重复检测引擎安装状态，使用全局缓存确保只检测一次
 * 包含模式配置，避免进入历史会话页面时重复触发 WSL 检测
 * 
 * v2: 添加 30 秒缓存过期机制和错误消息生成
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EngineType } from "@/types/provider";

// 缓存过期时间（毫秒）
const CACHE_TTL = 30 * 1000; // 30 秒

// 模式配置类型
export interface CodexModeConfig {
  mode: "auto" | "native" | "wsl";
  wslDistro: string | null;
  actualMode: "native" | "wsl";
  nativeAvailable: boolean;
  wslAvailable: boolean;
  availableDistros: string[];
  isWindows: boolean;
}

export interface GeminiWslModeConfig {
  mode: "auto" | "native" | "wsl";
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
}

// 引擎状态类型
export type EngineStatusType = 'ready' | 'not_installed' | 'error' | 'checking';

// 单个引擎的状态信息
export interface SingleEngineStatus {
  installed: boolean;
  version?: string;
  status: EngineStatusType;
  errorMessage?: string;
}

export interface EngineStatusInfo {
  claude: {
    installed: boolean;
    version?: string;
    wslModeConfig?: ClaudeWslModeConfig;
    status?: EngineStatusType;
    errorMessage?: string;
  };
  codex: {
    available: boolean;
    version?: string;
    modeConfig?: CodexModeConfig;
    status?: EngineStatusType;
    errorMessage?: string;
  };
  gemini: {
    installed: boolean;
    version?: string;
    wslModeConfig?: GeminiWslModeConfig;
    status?: EngineStatusType;
    errorMessage?: string;
  };
  // 缓存元数据
  _meta?: {
    cachedAt: number;
    expiresAt: number;
  };
}

// 全局缓存
let globalEngineStatus: EngineStatusInfo | null = null;
let loadPromise: Promise<EngineStatusInfo> | null = null;
let cacheTimestamp: number = 0;
const listeners = new Set<(status: EngineStatusInfo) => void>();

// 通知所有监听者
const notifyListeners = (status: EngineStatusInfo) => {
  listeners.forEach((listener) => listener(status));
};

// 检查缓存是否过期
const isCacheExpired = (): boolean => {
  if (!globalEngineStatus || !cacheTimestamp) return true;
  return Date.now() - cacheTimestamp > CACHE_TTL;
};

/**
 * 生成引擎错误消息
 */
export const generateEngineErrorMessage = (
  engine: EngineType,
  error?: Error | string
): string => {
  const errorStr = error instanceof Error ? error.message : error;

  const messages: Record<EngineType, string> = {
    claude: errorStr || 'Claude Code CLI 未安装或不可用。请运行 npm install -g @anthropic-ai/claude-code 安装。',
    codex: errorStr || 'OpenAI Codex CLI 未安装或不可用。请确保已正确配置 OpenAI API。',
    gemini: errorStr || 'Google Gemini CLI 未安装或不可用。请运行 npm install -g @anthropic-ai/gemini-cli 安装。',
    siliconflow: errorStr || 'SiliconFlow API 配置错误。请检查 API Key 是否正确。',
  };

  return messages[engine];
};

/**
 * 获取引擎状态类型
 */
export const getEngineStatusType = (
  installed: boolean,
  error?: string
): EngineStatusType => {
  if (error) return 'error';
  return installed ? 'ready' : 'not_installed';
};

// 加载引擎状态
const loadEngineStatus = async (forceRefresh = false): Promise<EngineStatusInfo> => {
  // 如果有缓存且未过期且不是强制刷新，直接返回
  if (globalEngineStatus && !isCacheExpired() && !forceRefresh) {
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

      const claudeInstalled = claudeResult.status === "fulfilled" ? claudeResult.value.is_installed : false;
      const codexAvailable = codexResult.status === "fulfilled" ? codexResult.value.available : false;
      const geminiInstalled = geminiResult.status === "fulfilled" ? geminiResult.value.installed : false;

      const claudeError = claudeResult.status === "rejected" ? String(claudeResult.reason) : undefined;
      const codexError = codexResult.status === "rejected" ? String(codexResult.reason) : undefined;
      const geminiError = geminiResult.status === "rejected" ? String(geminiResult.reason) : undefined;

      const now = Date.now();
      const status: EngineStatusInfo = {
        claude: {
          installed: claudeInstalled,
          version: claudeResult.status === "fulfilled" ? claudeResult.value.version : undefined,
          wslModeConfig:
            claudeWslModeResult.status === "fulfilled" ? claudeWslModeResult.value : undefined,
          status: getEngineStatusType(claudeInstalled, claudeError),
          errorMessage: claudeError ? generateEngineErrorMessage('claude', claudeError) : undefined,
        },
        codex: {
          available: codexAvailable,
          version: codexResult.status === "fulfilled" ? codexResult.value.version : undefined,
          modeConfig: codexModeResult.status === "fulfilled" ? codexModeResult.value : undefined,
          status: getEngineStatusType(codexAvailable, codexError),
          errorMessage: codexError ? generateEngineErrorMessage('codex', codexError) : undefined,
        },
        gemini: {
          installed: geminiInstalled,
          version: geminiResult.status === "fulfilled" ? geminiResult.value.version : undefined,
          wslModeConfig:
            geminiWslModeResult.status === "fulfilled" ? geminiWslModeResult.value : undefined,
          status: getEngineStatusType(geminiInstalled, geminiError),
          errorMessage: geminiError ? generateEngineErrorMessage('gemini', geminiError) : undefined,
        },
        _meta: {
          cachedAt: now,
          expiresAt: now + CACHE_TTL,
        },
      };

      globalEngineStatus = status;
      cacheTimestamp = now;
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
  cacheTimestamp = 0;
  return loadEngineStatus(true);
};

// 获取当前缓存的状态（不触发加载）
export const getCachedEngineStatus = (): EngineStatusInfo | null => {
  return globalEngineStatus;
};

// 检查缓存是否有效
export const isCacheValid = (): boolean => {
  return !isCacheExpired();
};

/**
 * useEngineStatus Hook
 *
 * 使用全局缓存的引擎状态，避免重复检测
 * 支持 30 秒缓存过期自动刷新
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

    // 如果没有缓存或缓存过期，触发加载
    if (!globalEngineStatus || isCacheExpired()) {
      loadEngineStatus().then((newStatus) => {
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

  // 获取指定引擎的状态
  const getEngineStatus = useCallback((engine: EngineType): SingleEngineStatus => {
    if (!status) {
      return { installed: false, status: 'checking' };
    }

    switch (engine) {
      case 'claude':
        return {
          installed: status.claude.installed,
          version: status.claude.version,
          status: status.claude.status || (status.claude.installed ? 'ready' : 'not_installed'),
          errorMessage: status.claude.errorMessage,
        };
      case 'codex':
        return {
          installed: status.codex.available,
          version: status.codex.version,
          status: status.codex.status || (status.codex.available ? 'ready' : 'not_installed'),
          errorMessage: status.codex.errorMessage,
        };
      case 'gemini':
        return {
          installed: status.gemini.installed,
          version: status.gemini.version,
          status: status.gemini.status || (status.gemini.installed ? 'ready' : 'not_installed'),
          errorMessage: status.gemini.errorMessage,
        };
      case 'siliconflow':
        // SiliconFlow 是 API 服务，始终可用
        return {
          installed: true,
          version: 'API',
          status: 'ready',
        };
      default:
        return { installed: false, status: 'not_installed' };
    }
  }, [status]);

  return {
    status,
    loading,
    refresh,
    getEngineStatus,
    isCacheValid: isCacheValid(),
    // 便捷访问器
    claudeInstalled: status?.claude.installed ?? false,
    claudeVersion: status?.claude.version,
    claudeWslModeConfig: status?.claude.wslModeConfig,
    claudeStatus: status?.claude.status,
    claudeError: status?.claude.errorMessage,
    codexAvailable: status?.codex.available ?? false,
    codexVersion: status?.codex.version,
    codexModeConfig: status?.codex.modeConfig,
    codexStatus: status?.codex.status,
    codexError: status?.codex.errorMessage,
    geminiInstalled: status?.gemini.installed ?? false,
    geminiVersion: status?.gemini.version,
    geminiWslModeConfig: status?.gemini.wslModeConfig,
    geminiStatus: status?.gemini.status,
    geminiError: status?.gemini.errorMessage,
  };
};
