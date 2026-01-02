/**
 * usePluginMarketplace - 插件市场 Hook
 *
 * 功能:
 * - 搜索和浏览插件
 * - 安装/更新/卸载插件
 * - 插件评分和评论
 * - 推荐插件
 * - 离线缓存
 *
 * 来源: VSCode Marketplace + npm Registry
 */

import { useCallback, useMemo, useState } from "react";
import type {
  PluginCategory,
  PluginInstallOptions,
  PluginMarketplaceInfo,
  PluginSearchOptions,
  PluginSearchResult,
} from "@/types/plugins";

// ============================================================
// 类型定义
// ============================================================

export interface MarketplaceConfig {
  /** 市场 API 地址 */
  apiUrl: string;
  /** 请求超时（毫秒） */
  timeout: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存过期时间（毫秒） */
  cacheExpiry: number;
}

export interface InstallProgress {
  pluginId: string;
  status: "downloading" | "extracting" | "installing" | "completed" | "error";
  progress: number; // 0-100
  error?: string;
}

export interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl: string;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: MarketplaceConfig = {
  apiUrl: "https://marketplace.fangyu.dev/api",
  timeout: 30000,
  enableCache: true,
  cacheExpiry: 3600000, // 1小时
};

// ============================================================
// 模拟数据
// ============================================================

const MOCK_PLUGINS: PluginMarketplaceInfo[] = [
  {
    id: "fangyu.ai-assistant",
    name: "AI 助手增强版",
    version: "2.0.0",
    description: "为 Fangyu Code 提供更强大的 AI 辅助功能，包括代码解释、重构建议和错误诊断。",
    author: { name: "Fangyu Team", email: "dev@fangyu.dev" },
    publisher: "fangyu",
    categories: ["ai", "productivity"],
    tags: ["ai", "assistant", "code", "refactor"],
    activationEvents: ["*"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 15234,
    rating: 4.8,
    reviewCount: 128,
    lastUpdated: "2024-12-20",
    publishedDate: "2024-06-15",
    downloadUrl: "https://marketplace.fangyu.dev/packages/ai-assistant-2.0.0.zip",
    screenshots: [
      "https://marketplace.fangyu.dev/screenshots/ai-assistant-1.png",
      "https://marketplace.fangyu.dev/screenshots/ai-assistant-2.png",
    ],
  },
  {
    id: "community.react-snippets",
    name: "React 代码片段",
    version: "3.1.0",
    description: "提供 300+ React、Redux、React Router 代码片段，支持 TypeScript。",
    author: { name: "React Community" },
    publisher: "community",
    categories: ["snippet", "language"],
    tags: ["react", "redux", "typescript", "snippets"],
    activationEvents: ["onLanguage:javascript", "onLanguage:typescriptreact"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 89543,
    rating: 4.9,
    reviewCount: 456,
    lastUpdated: "2024-12-18",
    publishedDate: "2023-01-10",
    downloadUrl: "https://marketplace.fangyu.dev/packages/react-snippets-3.1.0.zip",
  },
  {
    id: "tools.eslint-integration",
    name: "ESLint 集成",
    version: "4.0.2",
    description: "将 ESLint 集成到 Fangyu Code，实时显示代码质量问题和修复建议。",
    author: { name: "Tools Team" },
    publisher: "tools",
    categories: ["linter", "formatter"],
    tags: ["eslint", "linter", "javascript", "typescript"],
    activationEvents: ["onLanguage:javascript", "onLanguage:typescript"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 45678,
    rating: 4.7,
    reviewCount: 234,
    lastUpdated: "2024-12-15",
    publishedDate: "2023-03-20",
    downloadUrl: "https://marketplace.fangyu.dev/packages/eslint-integration-4.0.2.zip",
  },
  {
    id: "themes.one-dark-pro",
    name: "One Dark Pro",
    version: "1.5.0",
    description: "Atom 风格的深色主题，支持多种语言语法高亮优化。",
    author: { name: "Theme Studio" },
    publisher: "themes",
    categories: ["theme"],
    tags: ["theme", "dark", "atom", "one-dark"],
    activationEvents: ["*"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 123456,
    rating: 4.9,
    reviewCount: 892,
    lastUpdated: "2024-11-30",
    publishedDate: "2022-08-15",
    downloadUrl: "https://marketplace.fangyu.dev/packages/one-dark-pro-1.5.0.zip",
  },
  {
    id: "git.advanced-tools",
    name: "Git 高级工具",
    version: "2.3.0",
    description: "提供高级 Git 功能：交互式 rebase、cherry-pick 可视化、冲突解决助手。",
    author: { name: "Git Power Users" },
    publisher: "git",
    categories: ["git", "productivity"],
    tags: ["git", "rebase", "cherry-pick", "merge"],
    activationEvents: ["onFileSystem:git"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 34567,
    rating: 4.6,
    reviewCount: 167,
    lastUpdated: "2024-12-10",
    publishedDate: "2023-07-22",
    downloadUrl: "https://marketplace.fangyu.dev/packages/git-advanced-2.3.0.zip",
  },
  {
    id: "testing.jest-runner",
    name: "Jest Test Runner",
    version: "1.8.0",
    description: "在编辑器中运行和调试 Jest 测试，支持代码覆盖率显示和快照测试。",
    author: { name: "Testing Community" },
    publisher: "testing",
    categories: ["testing", "debugger"],
    tags: ["jest", "testing", "coverage", "snapshot"],
    activationEvents: ["onLanguage:javascript", "onLanguage:typescript"],
    engines: { fangyu: ">=1.0.0" },
    downloads: 28934,
    rating: 4.5,
    reviewCount: 89,
    lastUpdated: "2024-12-05",
    publishedDate: "2023-09-10",
    downloadUrl: "https://marketplace.fangyu.dev/packages/jest-runner-1.8.0.zip",
  },
];

const RECOMMENDED_PLUGINS = [
  "fangyu.ai-assistant",
  "community.react-snippets",
  "themes.one-dark-pro",
];

// ============================================================
// Hook
// ============================================================

interface UsePluginMarketplaceOptions {
  /** 初始配置 */
  initialConfig?: Partial<MarketplaceConfig>;
  /** 已安装插件列表 */
  installedPlugins?: string[];
  /** 安装完成回调 */
  onInstallComplete?: (pluginId: string) => void;
  /** 安装错误回调 */
  onInstallError?: (pluginId: string, error: Error) => void;
}

export function usePluginMarketplace(options: UsePluginMarketplaceOptions = {}) {
  const { initialConfig, installedPlugins = [], onInstallComplete, onInstallError } = options;

  // 配置状态
  const [config, setConfig] = useState<MarketplaceConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 运行时状态
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PluginMarketplaceInfo[]>([]);
  const [featured, setFeatured] = useState<PluginMarketplaceInfo[]>([]);
  const [trending, setTrending] = useState<PluginMarketplaceInfo[]>([]);
  const [installProgress, setInstallProgress] = useState<Map<string, InstallProgress>>(new Map());
  const [availableUpdates, setAvailableUpdates] = useState<UpdateInfo[]>([]);

  // 缓存
  const [cache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());

  // 更新配置
  const updateConfig = useCallback((updates: Partial<MarketplaceConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * 从缓存获取数据
   */
  const getFromCache = useCallback(
    (key: string): any | null => {
      if (!config.enableCache) return null;

      const cached = cache.get(key);
      if (!cached) return null;

      if (Date.now() - cached.timestamp > config.cacheExpiry) {
        cache.delete(key);
        return null;
      }

      return cached.data;
    },
    [cache, config.enableCache, config.cacheExpiry],
  );

  /**
   * 设置缓存数据
   */
  const setToCache = useCallback(
    (key: string, data: any) => {
      if (!config.enableCache) return;
      cache.set(key, { data, timestamp: Date.now() });
    },
    [cache, config.enableCache],
  );

  /**
   * 搜索插件
   */
  const searchPlugins = useCallback(
    async (searchOptions: PluginSearchOptions): Promise<PluginSearchResult> => {
      const cacheKey = `search:${JSON.stringify(searchOptions)}`;
      const cached = getFromCache(cacheKey);
      if (cached) return cached;

      setIsLoading(true);

      try {
        // 模拟 API 请求
        await new Promise((resolve) => setTimeout(resolve, 300));

        let results = [...MOCK_PLUGINS];

        // 关键词搜索
        if (searchOptions.query) {
          const query = searchOptions.query.toLowerCase();
          results = results.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              p.description.toLowerCase().includes(query) ||
              p.tags?.some((t) => t.toLowerCase().includes(query)),
          );
        }

        // 分类过滤
        if (searchOptions.category) {
          results = results.filter((p) => p.categories.includes(searchOptions.category!));
        }

        // 排序
        if (searchOptions.sortBy) {
          switch (searchOptions.sortBy) {
            case "downloads":
              results.sort((a, b) => b.downloads - a.downloads);
              break;
            case "rating":
              results.sort((a, b) => b.rating - a.rating);
              break;
            case "date":
              results.sort(
                (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
              );
              break;
            case "relevance":
            default:
              // 保持默认顺序或按相关性排序
              break;
          }
        }

        // 分页
        const page = searchOptions.page || 1;
        const pageSize = searchOptions.pageSize || 10;
        const start = (page - 1) * pageSize;
        const paged = results.slice(start, start + pageSize);

        const result: PluginSearchResult = {
          plugins: paged,
          total: results.length,
          page,
          pageSize,
        };

        setSearchResults(paged);
        setToCache(cacheKey, result);

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [getFromCache, setToCache],
  );

  /**
   * 获取插件详情
   */
  const getPluginDetails = useCallback(
    async (pluginId: string): Promise<PluginMarketplaceInfo | null> => {
      const cacheKey = `plugin:${pluginId}`;
      const cached = getFromCache(cacheKey);
      if (cached) return cached;

      setIsLoading(true);

      try {
        // 模拟 API 请求
        await new Promise((resolve) => setTimeout(resolve, 200));

        const plugin = MOCK_PLUGINS.find((p) => p.id === pluginId) || null;

        if (plugin) {
          setToCache(cacheKey, plugin);
        }

        return plugin;
      } finally {
        setIsLoading(false);
      }
    },
    [getFromCache, setToCache],
  );

  /**
   * 获取精选插件
   */
  const getFeaturedPlugins = useCallback(async (): Promise<PluginMarketplaceInfo[]> => {
    const cacheKey = "featured";
    const cached = getFromCache(cacheKey);
    if (cached) {
      setFeatured(cached);
      return cached;
    }

    setIsLoading(true);

    try {
      // 模拟 API 请求
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 获取推荐插件
      const featuredPlugins = MOCK_PLUGINS.filter((p) => RECOMMENDED_PLUGINS.includes(p.id));

      setFeatured(featuredPlugins);
      setToCache(cacheKey, featuredPlugins);

      return featuredPlugins;
    } finally {
      setIsLoading(false);
    }
  }, [getFromCache, setToCache]);

  /**
   * 获取热门插件
   */
  const getTrendingPlugins = useCallback(async (): Promise<PluginMarketplaceInfo[]> => {
    const cacheKey = "trending";
    const cached = getFromCache(cacheKey);
    if (cached) {
      setTrending(cached);
      return cached;
    }

    setIsLoading(true);

    try {
      // 模拟 API 请求
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 按下载量排序获取热门
      const trendingPlugins = [...MOCK_PLUGINS]
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 6);

      setTrending(trendingPlugins);
      setToCache(cacheKey, trendingPlugins);

      return trendingPlugins;
    } finally {
      setIsLoading(false);
    }
  }, [getFromCache, setToCache]);

  /**
   * 获取分类下的插件
   */
  const getPluginsByCategory = useCallback(
    async (category: PluginCategory): Promise<PluginMarketplaceInfo[]> => {
      const result = await searchPlugins({ category, pageSize: 50 });
      return result.plugins;
    },
    [searchPlugins],
  );

  /**
   * 安装插件
   */
  const installPlugin = useCallback(
    async (pluginId: string, _installOptions?: Partial<PluginInstallOptions>): Promise<boolean> => {
      const plugin = await getPluginDetails(pluginId);
      if (!plugin) {
        console.error(`[Marketplace] Plugin not found: ${pluginId}`);
        return false;
      }

      // 更新安装进度
      const updateProgress = (
        status: InstallProgress["status"],
        progress: number,
        error?: string,
      ) => {
        setInstallProgress((prev) => {
          const next = new Map(prev);
          next.set(pluginId, { pluginId, status, progress, error });
          return next;
        });
      };

      try {
        updateProgress("downloading", 0);

        // 模拟下载
        for (let i = 0; i <= 50; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          updateProgress("downloading", i);
        }

        updateProgress("extracting", 50);

        // 模拟解压
        for (let i = 50; i <= 80; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          updateProgress("extracting", i);
        }

        updateProgress("installing", 80);

        // 模拟安装
        for (let i = 80; i <= 100; i += 5) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          updateProgress("installing", i);
        }

        updateProgress("completed", 100);

        console.log(`[Marketplace] Plugin installed: ${pluginId}`);
        onInstallComplete?.(pluginId);

        // 延迟清除进度
        setTimeout(() => {
          setInstallProgress((prev) => {
            const next = new Map(prev);
            next.delete(pluginId);
            return next;
          });
        }, 3000);

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        updateProgress("error", 0, errorMessage);
        onInstallError?.(pluginId, error instanceof Error ? error : new Error(errorMessage));
        return false;
      }
    },
    [getPluginDetails, onInstallComplete, onInstallError],
  );

  /**
   * 卸载插件
   */
  const uninstallPlugin = useCallback(async (pluginId: string): Promise<boolean> => {
    // 模拟卸载
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(`[Marketplace] Plugin uninstalled: ${pluginId}`);
    return true;
  }, []);

  /**
   * 检查更新
   */
  const checkForUpdates = useCallback(async (pluginIds: string[]): Promise<UpdateInfo[]> => {
    setIsLoading(true);

    try {
      // 模拟检查更新
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updates: UpdateInfo[] = [];

      // 模拟：随机选择一些插件有更新
      for (const pluginId of pluginIds) {
        const plugin = MOCK_PLUGINS.find((p) => p.id === pluginId);
        if (plugin && Math.random() > 0.7) {
          updates.push({
            pluginId,
            currentVersion: "1.0.0", // 模拟当前版本
            latestVersion: plugin.version,
            releaseNotes: `Bug fixes and performance improvements for version ${plugin.version}`,
            downloadUrl: plugin.downloadUrl,
          });
        }
      }

      setAvailableUpdates(updates);
      return updates;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 更新插件
   */
  const updatePlugin = useCallback(
    async (pluginId: string): Promise<boolean> => {
      const updateInfo = availableUpdates.find((u) => u.pluginId === pluginId);
      if (!updateInfo) {
        console.error(`[Marketplace] No update available for: ${pluginId}`);
        return false;
      }

      // 使用安装流程进行更新
      const result = await installPlugin(pluginId);

      if (result) {
        // 从更新列表中移除
        setAvailableUpdates((prev) => prev.filter((u) => u.pluginId !== pluginId));
      }

      return result;
    },
    [availableUpdates, installPlugin],
  );

  /**
   * 更新所有插件
   */
  const updateAllPlugins = useCallback(async (): Promise<number> => {
    let updated = 0;

    for (const update of availableUpdates) {
      const result = await updatePlugin(update.pluginId);
      if (result) updated++;
    }

    return updated;
  }, [availableUpdates, updatePlugin]);

  /**
   * 获取安装进度
   */
  const getInstallProgress = useCallback(
    (pluginId: string): InstallProgress | undefined => {
      return installProgress.get(pluginId);
    },
    [installProgress],
  );

  /**
   * 检查插件是否已安装
   */
  const isInstalled = useCallback(
    (pluginId: string): boolean => {
      return installedPlugins.includes(pluginId);
    },
    [installedPlugins],
  );

  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    cache.clear();
    setSearchResults([]);
    setFeatured([]);
    setTrending([]);
  }, [cache]);

  // 计算统计信息
  const stats = useMemo(
    () => ({
      totalPlugins: MOCK_PLUGINS.length,
      installedCount: installedPlugins.length,
      pendingUpdates: availableUpdates.length,
      installing: installProgress.size,
    }),
    [installedPlugins.length, availableUpdates.length, installProgress.size],
  );

  return {
    // 状态
    config,
    isLoading,
    searchResults,
    featured,
    trending,
    availableUpdates,
    stats,

    // 配置方法
    updateConfig,

    // 搜索方法
    searchPlugins,
    getPluginDetails,
    getFeaturedPlugins,
    getTrendingPlugins,
    getPluginsByCategory,

    // 安装方法
    installPlugin,
    uninstallPlugin,
    getInstallProgress,
    isInstalled,

    // 更新方法
    checkForUpdates,
    updatePlugin,
    updateAllPlugins,

    // 工具方法
    clearCache,
  };
}

export default usePluginMarketplace;
