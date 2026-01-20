/**
 * Plugin Manager
 * 插件管理器
 */

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  config?: Record<string, any>;
  hooks?: PluginHooks;
}

export interface PluginHooks {
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: Set<string> = new Set();

  async registerPlugin(plugin: Plugin): Promise<void> {
    this.plugins.set(plugin.id, plugin);
    if (plugin.enabled) {
      await this.loadPlugin(plugin.id);
    }
  }

  async unregisterPlugin(pluginId: string): Promise<void> {
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }
    this.plugins.delete(pluginId);
  }

  async loadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (this.loadedPlugins.has(pluginId)) {
      return;
    }

    await plugin.hooks?.onLoad?.();
    this.loadedPlugins.add(pluginId);
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!this.loadedPlugins.has(pluginId)) {
      return;
    }

    await plugin.hooks?.onUnload?.();
    this.loadedPlugins.delete(pluginId);
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.enabled = true;
    await plugin.hooks?.onEnable?.();
    await this.loadPlugin(pluginId);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.enabled = false;
    await plugin.hooks?.onDisable?.();
    await this.unloadPlugin(pluginId);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return this.getAllPlugins().filter((plugin) => plugin.enabled);
  }

  getLoadedPlugins(): Plugin[] {
    return this.getAllPlugins().filter((plugin) => this.loadedPlugins.has(plugin.id));
  }

  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  updatePluginConfig(pluginId: string, config: Record<string, any>): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.config = { ...plugin.config, ...config };
  }
}

export default PluginManager;
