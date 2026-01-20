/**
 * usePluginLoader - 插件加载器和生命周期管理 Hook
 *
 * 功能:
 * - 发现和加载插件
 * - 管理插件生命周期（激活/停用）
 * - 处理插件依赖
 * - 沙箱执行环境
 * - 权限检查
 *
 * 来源: VSCode Extension Host + Zed Plugin System
 */

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivationEvent,
  Disposable,
  Logger,
  PluginAPI,
  PluginContext,
  PluginManifest,
  PluginPermission,
  PluginState,
  StateStorage,
} from "@/types/plugins";

// ============================================================
// 类型定义
// ============================================================

export interface PluginLoaderConfig {
  /** 插件目录路径 */
  pluginsDir: string;
  /** 是否自动激活插件 */
  autoActivate: boolean;
  /** 激活超时时间（毫秒） */
  activationTimeout: number;
  /** 是否启用沙箱 */
  sandbox: boolean;
  /** 允许的最大插件数 */
  maxPlugins: number;
  /** 全局禁用的插件ID */
  disabledPlugins: string[];
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: PluginState;
  error?: string;
}

export interface PluginActivationResult {
  success: boolean;
  activationTime?: number;
  error?: string;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: PluginLoaderConfig = {
  pluginsDir: ".fangyu/plugins",
  autoActivate: true,
  activationTimeout: 10000, // 10秒
  sandbox: true,
  maxPlugins: 50,
  disabledPlugins: [],
};

// ============================================================
// 辅助函数
// ============================================================

// 创建状态存储
function createStateStorage(storageKey: string): StateStorage {
  const storage: Map<string, any> = new Map();
  const prefix = `fangyu-plugin-${storageKey}`;

  // 从 localStorage 恢复
  try {
    const saved = localStorage.getItem(prefix);
    if (saved) {
      const data = JSON.parse(saved);
      Object.entries(data).forEach(([k, v]) => storage.set(k, v));
    }
  } catch {
    // 忽略恢复错误
  }

  const save = () => {
    try {
      const data: Record<string, any> = {};
      storage.forEach((v, k) => (data[k] = v));
      localStorage.setItem(prefix, JSON.stringify(data));
    } catch {
      // 忽略保存错误
    }
  };

  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      const value = storage.get(key);
      return value !== undefined ? value : defaultValue;
    },
    async update(key: string, value: any): Promise<void> {
      if (value === undefined) {
        storage.delete(key);
      } else {
        storage.set(key, value);
      }
      save();
    },
    keys(): readonly string[] {
      return Array.from(storage.keys());
    },
  };
}

// 创建日志器
function createLogger(pluginId: string): Logger {
  const prefix = `[Plugin:${pluginId}]`;

  return {
    trace: (message: string, ...args: any[]) => console.trace(prefix, message, ...args),
    debug: (message: string, ...args: any[]) => logger.debug('usePluginLoader', prefix, message, ...args),
    info: (message: string, ...args: any[]) => console.info(prefix, message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn('usePluginLoader', prefix, message, ...args),
    error: (message: string | Error, ...args: any[]) => logger.error('usePluginLoader', prefix, message, ...args),
  };
}

// 创建占位符 API（实际实现需要更多集成）
function createPluginAPI(_pluginId: string, _permissions: PluginPermission[]): PluginAPI {
  return {
    commands: {
      registerCommand: (command, _callback) => {
        logger.debug('usePluginLoader', `[Plugin API] Register command: ${command}`);
        return { dispose: () => logger.debug('usePluginLoader', `[Plugin API] Unregister command: ${command}`) };
      },
      executeCommand: async (command, ...args) => {
        logger.debug('usePluginLoader', `[Plugin API] Execute command: ${command}`, args);
        return undefined as any;
      },
      getCommands: async () => [],
    },
    editor: {
      getActiveEditor: () => undefined,
      getAllEditors: () => [],
      openFile: async () => {
        throw new Error("Not implemented");
      },
      onDidChangeActiveEditor: () => ({ dispose: () => {} }),
    },
    workspace: {
      getRootPath: () => undefined,
      getWorkspaceFolders: () => [],
      findFiles: async () => [],
      getConfiguration: () => ({
        get: <T>(_section: string, defaultValue?: T): T | undefined => defaultValue,
        has: () => false,
        update: async () => {},
      }),
      onDidChangeTextDocument: () => ({ dispose: () => {} }),
    },
    ai: {
      prompt: async () => ({ content: "" }),
      streamPrompt: async () => ({ content: "" }),
      registerTool: () => ({ dispose: () => {} }),
      useTool: async () => ({}),
    },
    window: {
      showInformationMessage: async (message) => {
        logger.debug('usePluginLoader', "[Info]", message);
        return undefined;
      },
      showWarningMessage: async (message) => {
        logger.warn('usePluginLoader', "[Warn]", message);
        return undefined;
      },
      showErrorMessage: async (message) => {
        logger.error('usePluginLoader', "[Error]", message);
        return undefined;
      },
      showInputBox: async () => undefined,
      showQuickPick: async () => undefined,
      createOutputChannel: (name) => ({
        name,
        append: (value) => logger.debug('usePluginLoader', `[${name}]`, value),
        appendLine: (value) => logger.debug('usePluginLoader', `[${name}]`, value),
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
      }),
      createStatusBarItem: () => ({
        text: "",
        alignment: "left" as const,
        priority: 0,
        show: () => {},
        hide: () => {},
        dispose: () => {},
      }),
    },
    fs: {
      readFile: async () => new Uint8Array(),
      writeFile: async () => {},
      readDirectory: async () => [],
      createDirectory: async () => {},
      delete: async () => {},
      rename: async () => {},
      exists: async () => false,
      stat: async () => ({ type: "file", ctime: 0, mtime: 0, size: 0 }),
    },
  };
}

// ============================================================
// Hook
// ============================================================

interface UsePluginLoaderOptions {
  /** 初始配置 */
  initialConfig?: Partial<PluginLoaderConfig>;
  /** 工作区路径 */
  workspacePath?: string;
  /** 插件激活回调 */
  onPluginActivated?: (plugin: PluginState) => void;
  /** 插件停用回调 */
  onPluginDeactivated?: (plugin: PluginState) => void;
  /** 插件错误回调 */
  onPluginError?: (plugin: PluginState, error: Error) => void;
}

export function usePluginLoader(options: UsePluginLoaderOptions = {}) {
  const { initialConfig, workspacePath, onPluginActivated, onPluginDeactivated, onPluginError } =
    options;

  // 配置状态
  const [config, setConfig] = useState<PluginLoaderConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 插件状态
  const [plugins, setPlugins] = useState<Map<string, PluginState>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // 事件订阅
  const activationListeners = useRef<Map<string, Set<string>>>(new Map());

  // 更新配置
  const updateConfig = useCallback((updates: Partial<PluginLoaderConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * 解析插件清单
   */
  const parseManifest = useCallback(
    async (manifestPath: string): Promise<PluginManifest | null> => {
      try {
        // 模拟读取清单文件
        // 实际实现需要调用 Tauri 文件系统 API
        logger.debug('usePluginLoader', `[PluginLoader] Parsing manifest: ${manifestPath}`);

        // TODO: 实现实际的文件读取
        // const content = await readFile(manifestPath);
        // return JSON.parse(content);

        return null;
      } catch (error) {
        logger.error('usePluginLoader', `[PluginLoader] Failed to parse manifest: ${manifestPath}`, error);
        return null;
      }
    },
    [],
  );

  /**
   * 验证插件清单
   */
  const validateManifest = useCallback((manifest: PluginManifest): string[] => {
    const errors: string[] = [];

    if (!manifest.id) errors.push("Missing plugin ID");
    if (!manifest.name) errors.push("Missing plugin name");
    if (!manifest.version) errors.push("Missing plugin version");
    if (!manifest.activationEvents || manifest.activationEvents.length === 0) {
      errors.push("Missing activation events");
    }

    // 验证版本格式
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push(`Invalid version format: ${manifest.version}`);
    }

    return errors;
  }, []);

  /**
   * 检查权限
   */
  const checkPermissions = useCallback(
    (
      required: PluginPermission[],
      granted: PluginPermission[],
    ): { allowed: boolean; missing: PluginPermission[] } => {
      const missing = required.filter((p) => !granted.includes(p));
      return {
        allowed: missing.length === 0,
        missing,
      };
    },
    [],
  );

  /**
   * 创建插件上下文
   */
  const createPluginContext = useCallback(
    (manifest: PluginManifest, pluginPath: string): PluginContext => {
      const subscriptions: Disposable[] = [];
      const logger = createLogger(manifest.id);
      const api = createPluginAPI(manifest.id, manifest.permissions || []);

      return {
        subscriptions,
        globalState: createStateStorage(`${manifest.id}-global`),
        workspaceState: createStateStorage(`${manifest.id}-workspace`),
        extensionPath: pluginPath,
        extensionUri: `file://${pluginPath}`,
        environmentVariableCollection: {
          persistent: false,
          replace: () => {},
          append: () => {},
          prepend: () => {},
          get: () => undefined,
          delete: () => {},
          clear: () => {},
        },
        logger,
        api,
      };
    },
    [],
  );

  /**
   * 加载单个插件
   */
  const loadPlugin = useCallback(
    async (pluginPath: string): Promise<PluginLoadResult> => {
      const startTime = Date.now();

      try {
        // 解析清单
        const manifestPath = `${pluginPath}/package.json`;
        const manifest = await parseManifest(manifestPath);

        if (!manifest) {
          return { success: false, error: "Failed to parse plugin manifest" };
        }

        // 验证清单
        const errors = validateManifest(manifest);
        if (errors.length > 0) {
          return { success: false, error: `Manifest validation failed: ${errors.join(", ")}` };
        }

        // 检查是否已禁用
        if (config.disabledPlugins.includes(manifest.id)) {
          return { success: false, error: "Plugin is disabled" };
        }

        // 检查是否已加载
        if (plugins.has(manifest.id)) {
          return { success: false, error: "Plugin already loaded" };
        }

        // 检查插件数量限制
        if (plugins.size >= config.maxPlugins) {
          return { success: false, error: `Maximum plugin limit (${config.maxPlugins}) reached` };
        }

        // 创建插件状态
        const pluginState: PluginState = {
          id: manifest.id,
          manifest,
          path: pluginPath,
          enabled: true,
          activated: false,
          loadTime: Date.now() - startTime,
        };

        // 更新状态
        setPlugins((prev) => {
          const newMap = new Map(prev);
          newMap.set(manifest.id, pluginState);
          return newMap;
        });

        // 注册激活事件监听
        manifest.activationEvents.forEach((event) => {
          if (!activationListeners.current.has(event)) {
            activationListeners.current.set(event, new Set());
          }
          activationListeners.current.get(event)!.add(manifest.id);
        });

        return { success: true, plugin: pluginState };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [config.disabledPlugins, config.maxPlugins, parseManifest, plugins, validateManifest],
  );

  /**
   * 激活插件
   */
  const activatePlugin = useCallback(
    async (pluginId: string): Promise<PluginActivationResult> => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState) {
        return { success: false, error: "Plugin not found" };
      }

      if (pluginState.activated) {
        return { success: true, activationTime: pluginState.activationTime };
      }

      if (!pluginState.enabled) {
        return { success: false, error: "Plugin is disabled" };
      }

      const startTime = Date.now();

      try {
        // 创建上下文
        const context = createPluginContext(pluginState.manifest, pluginState.path);

        // 加载插件模块（模拟）
        // 实际实现需要动态导入插件代码
        logger.debug('usePluginLoader', `[PluginLoader] Activating plugin: ${pluginId}`);

        // TODO: 实现实际的插件加载和执行
        // const pluginModule = await import(pluginState.path);
        // const plugin: Plugin = pluginModule.default || pluginModule;
        // await plugin.activate(context);

        const activationTime = Date.now() - startTime;

        // 更新状态
        setPlugins((prev) => {
          const newMap = new Map(prev);
          const updated: PluginState = {
            ...pluginState,
            activated: true,
            activationTime,
            context,
            // instance: plugin,
          };
          newMap.set(pluginId, updated);
          return newMap;
        });

        onPluginActivated?.(pluginState);

        return { success: true, activationTime };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // 更新错误状态
        setPlugins((prev) => {
          const newMap = new Map(prev);
          newMap.set(pluginId, {
            ...pluginState,
            error: errorMessage,
          });
          return newMap;
        });

        onPluginError?.(pluginState, error instanceof Error ? error : new Error(errorMessage));

        return { success: false, error: errorMessage };
      }
    },
    [createPluginContext, onPluginActivated, onPluginError, plugins],
  );

  /**
   * 停用插件
   */
  const deactivatePlugin = useCallback(
    async (pluginId: string): Promise<boolean> => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState || !pluginState.activated) {
        return false;
      }

      try {
        // 调用插件的 deactivate 方法
        if (pluginState.instance?.deactivate) {
          await pluginState.instance.deactivate();
        }

        // 清理订阅
        if (pluginState.context) {
          for (const sub of pluginState.context.subscriptions) {
            try {
              await sub.dispose();
            } catch {
              // 忽略清理错误
            }
          }
        }

        // 更新状态
        setPlugins((prev) => {
          const newMap = new Map(prev);
          newMap.set(pluginId, {
            ...pluginState,
            activated: false,
            instance: undefined,
            context: undefined,
          });
          return newMap;
        });

        onPluginDeactivated?.(pluginState);

        return true;
      } catch (error) {
        logger.error('usePluginLoader', `[PluginLoader] Failed to deactivate plugin: ${pluginId}`, error);
        return false;
      }
    },
    [onPluginDeactivated, plugins],
  );

  /**
   * 卸载插件
   */
  const unloadPlugin = useCallback(
    async (pluginId: string): Promise<boolean> => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState) {
        return false;
      }

      // 先停用
      if (pluginState.activated) {
        await deactivatePlugin(pluginId);
      }

      // 清理激活事件监听
      pluginState.manifest.activationEvents.forEach((event) => {
        activationListeners.current.get(event)?.delete(pluginId);
      });

      // 移除插件
      setPlugins((prev) => {
        const newMap = new Map(prev);
        newMap.delete(pluginId);
        return newMap;
      });

      return true;
    },
    [deactivatePlugin, plugins],
  );

  /**
   * 启用插件
   */
  const enablePlugin = useCallback(
    (pluginId: string): boolean => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState) {
        return false;
      }

      setPlugins((prev) => {
        const newMap = new Map(prev);
        newMap.set(pluginId, { ...pluginState, enabled: true });
        return newMap;
      });

      // 从禁用列表移除
      if (config.disabledPlugins.includes(pluginId)) {
        updateConfig({
          disabledPlugins: config.disabledPlugins.filter((id) => id !== pluginId),
        });
      }

      return true;
    },
    [config.disabledPlugins, plugins, updateConfig],
  );

  /**
   * 禁用插件
   */
  const disablePlugin = useCallback(
    async (pluginId: string): Promise<boolean> => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState) {
        return false;
      }

      // 先停用
      if (pluginState.activated) {
        await deactivatePlugin(pluginId);
      }

      setPlugins((prev) => {
        const newMap = new Map(prev);
        newMap.set(pluginId, { ...pluginState, enabled: false });
        return newMap;
      });

      // 添加到禁用列表
      if (!config.disabledPlugins.includes(pluginId)) {
        updateConfig({
          disabledPlugins: [...config.disabledPlugins, pluginId],
        });
      }

      return true;
    },
    [config.disabledPlugins, deactivatePlugin, plugins, updateConfig],
  );

  /**
   * 触发激活事件
   */
  const triggerActivationEvent = useCallback(
    async (event: ActivationEvent): Promise<void> => {
      const pluginIds = activationListeners.current.get(event);

      if (!pluginIds) {
        return;
      }

      for (const pluginId of pluginIds) {
        const pluginState = plugins.get(pluginId);
        if (pluginState && pluginState.enabled && !pluginState.activated) {
          await activatePlugin(pluginId);
        }
      }
    },
    [activatePlugin, plugins],
  );

  /**
   * 发现并加载所有插件
   */
  const discoverPlugins = useCallback(async (): Promise<number> => {
    setIsLoading(true);
    setLoadProgress(0);

    try {
      // 模拟发现插件
      // 实际实现需要扫描插件目录
      const pluginsPath = workspacePath
        ? `${workspacePath}/${config.pluginsDir}`
        : config.pluginsDir;

      logger.debug('usePluginLoader', `[PluginLoader] Discovering plugins in: ${pluginsPath}`);

      // TODO: 实现实际的目录扫描
      // const entries = await readDir(pluginsPath);
      // const pluginDirs = entries.filter(e => e.isDirectory);

      const pluginDirs: string[] = []; // 占位符

      let loaded = 0;
      for (let i = 0; i < pluginDirs.length; i++) {
        const dir = pluginDirs[i];
        const result = await loadPlugin(`${pluginsPath}/${dir}`);

        if (result.success) {
          loaded++;

          // 如果配置了自动激活，检查是否需要立即激活
          if (config.autoActivate && result.plugin) {
            const hasImmediateActivation =
              result.plugin.manifest.activationEvents.includes("*") ||
              result.plugin.manifest.activationEvents.includes("onStartupFinished");

            if (hasImmediateActivation) {
              await activatePlugin(result.plugin.id);
            }
          }
        }

        setLoadProgress(((i + 1) / pluginDirs.length) * 100);
      }

      // 触发启动完成事件
      await triggerActivationEvent("onStartupFinished");

      return loaded;
    } finally {
      setIsLoading(false);
      setLoadProgress(100);
    }
  }, [
    activatePlugin,
    config.autoActivate,
    config.pluginsDir,
    loadPlugin,
    triggerActivationEvent,
    workspacePath,
  ]);

  /**
   * 重新加载插件
   */
  const reloadPlugin = useCallback(
    async (pluginId: string): Promise<PluginLoadResult> => {
      const pluginState = plugins.get(pluginId);

      if (!pluginState) {
        return { success: false, error: "Plugin not found" };
      }

      const pluginPath = pluginState.path;

      // 卸载
      await unloadPlugin(pluginId);

      // 重新加载
      return loadPlugin(pluginPath);
    },
    [loadPlugin, plugins, unloadPlugin],
  );

  /**
   * 获取插件
   */
  const getPlugin = useCallback(
    (pluginId: string): PluginState | undefined => {
      return plugins.get(pluginId);
    },
    [plugins],
  );

  /**
   * 获取所有插件
   */
  const getAllPlugins = useCallback((): PluginState[] => {
    return Array.from(plugins.values());
  }, [plugins]);

  /**
   * 获取已激活的插件
   */
  const getActivePlugins = useCallback((): PluginState[] => {
    return Array.from(plugins.values()).filter((p) => p.activated);
  }, [plugins]);

  /**
   * 获取插件统计
   */
  const getStats = useCallback(() => {
    const all = Array.from(plugins.values());
    return {
      total: all.length,
      enabled: all.filter((p) => p.enabled).length,
      activated: all.filter((p) => p.activated).length,
      errors: all.filter((p) => p.error).length,
      totalLoadTime: all.reduce((sum, p) => sum + (p.loadTime || 0), 0),
      totalActivationTime: all.reduce((sum, p) => sum + (p.activationTime || 0), 0),
    };
  }, [plugins]);

  // 初始化时发现插件
  useEffect(() => {
    if (workspacePath) {
      discoverPlugins();
    }
  }, [workspacePath]); // 只在 workspacePath 变化时重新发现

  return {
    // 状态
    config,
    plugins: Array.from(plugins.values()),
    pluginsMap: plugins,
    isLoading,
    loadProgress,

    // 配置方法
    updateConfig,

    // 生命周期方法
    loadPlugin,
    unloadPlugin,
    activatePlugin,
    deactivatePlugin,
    reloadPlugin,
    enablePlugin,
    disablePlugin,

    // 发现方法
    discoverPlugins,
    triggerActivationEvent,

    // 查询方法
    getPlugin,
    getAllPlugins,
    getActivePlugins,
    getStats,

    // 验证方法
    validateManifest,
    checkPermissions,
  };
}

export default usePluginLoader;
