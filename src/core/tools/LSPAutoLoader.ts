/**
 * LSP Auto Loader - 自动为 LLM 加载语言服务器
 *
 * 功能：
 * 1. 自动检测项目中使用的编程语言
 * 2. 为每种语言启动对应的 Language Server
 * 3. 管理 Language Server 的生命周期
 * 4. 提供统一的 LSP 功能接口给 LLM
 *
 * 灵感来源：OpenCode 的 LSP 自动加载机制
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';
import { LSPClient, LSPTools, CompletionItem, WorkspaceEdit } from './LSPTools';
import {
  Position,
  Location,
  HoverInfo,
  Diagnostic,
  DiagnosticSeverity,
} from '../types/unified-agent';

// Language Server 配置
export interface LanguageServerConfig {
  language: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  initializationOptions?: Record<string, unknown>;
}

// 预定义的 Language Server 配置
export const LANGUAGE_SERVER_CONFIGS: LanguageServerConfig[] = [
  {
    language: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  {
    language: 'rust',
    command: 'rust-analyzer',
    args: [],
    fileExtensions: ['.rs'],
  },
  {
    language: 'python',
    command: 'pylsp',
    args: [],
    fileExtensions: ['.py'],
  },
  {
    language: 'go',
    command: 'gopls',
    args: [],
    fileExtensions: ['.go'],
  },
  {
    language: 'java',
    command: 'jdtls',
    args: [],
    fileExtensions: ['.java'],
  },
  {
    language: 'cpp',
    command: 'clangd',
    args: [],
    fileExtensions: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'],
  },
  {
    language: 'csharp',
    command: 'omnisharp',
    args: ['--languageserver'],
    fileExtensions: ['.cs'],
  },
  {
    language: 'php',
    command: 'intelephense',
    args: ['--stdio'],
    fileExtensions: ['.php'],
  },
  {
    language: 'ruby',
    command: 'solargraph',
    args: ['stdio'],
    fileExtensions: ['.rb'],
  },
  {
    language: 'vue',
    command: 'vls',
    args: [],
    fileExtensions: ['.vue'],
  },
];

// Language Server 实例
interface LanguageServerInstance {
  language: string;
  config: LanguageServerConfig;
  processId?: number;
  initialized: boolean;
  capabilities?: Record<string, unknown>;
}

/**
 * 真实的 LSP 客户端实现
 * 通过 Tauri 后端与 Language Server 通信
 */
export class RealLSPClient implements LSPClient {
  private workspaceRoot: string = '';
  private servers: Map<string, LanguageServerInstance> = new Map();
  private fileLanguageMap: Map<string, string> = new Map();

  async initialize(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;

    // 扫描项目文件，检测使用的语言
    const detectedLanguages = await this.detectProjectLanguages(workspaceRoot);

    // 为每种语言启动 Language Server
    for (const language of detectedLanguages) {
      await this.startLanguageServer(language);
    }
  }

  async shutdown(): Promise<void> {
    // 关闭所有 Language Server
    for (const [language, server] of this.servers) {
      if (server.processId) {
        await invoke('lsp_shutdown', { language });
      }
    }
    this.servers.clear();
    this.fileLanguageMap.clear();
  }

  /**
   * 检测项目中使用的编程语言
   */
  private async detectProjectLanguages(workspaceRoot: string): Promise<string[]> {
    try {
      const files = await invoke<string[]>('scan_project_files', { path: workspaceRoot });
      const languages = new Set<string>();

      for (const file of files) {
        const language = this.detectLanguageFromFile(file);
        if (language) {
          languages.add(language);
          this.fileLanguageMap.set(file, language);
        }
      }

      return Array.from(languages);
    } catch (error) {
      logger.error('LSPAutoLoader', 'Failed to detect project languages:', error);
      return [];
    }
  }

  /**
   * 根据文件扩展名检测语言
   */
  private detectLanguageFromFile(file: string): string | null {
    for (const config of LANGUAGE_SERVER_CONFIGS) {
      if (config.fileExtensions.some(ext => file.endsWith(ext))) {
        return config.language;
      }
    }
    return null;
  }

  /**
   * 启动 Language Server
   */
  private async startLanguageServer(language: string): Promise<void> {
    const config = LANGUAGE_SERVER_CONFIGS.find(c => c.language === language);
    if (!config) {
      logger.warn('LSPAutoLoader', `No Language Server config found for ${language}`);
      return;
    }

    try {
      const result = await invoke<{ processId: number; capabilities: Record<string, unknown> }>(
        'lsp_start',
        {
          language,
          command: config.command,
          args: config.args,
          workspaceRoot: this.workspaceRoot,
          initializationOptions: config.initializationOptions,
        }
      );

      this.servers.set(language, {
        language,
        config,
        processId: result.processId,
        initialized: true,
        capabilities: result.capabilities,
      });

      logger.debug('LSPAutoLoader', `Language Server started for ${language} (PID: ${result.processId});`);
    } catch (error) {
      logger.error('LSPAutoLoader', `Failed to start Language Server for ${language}:`, error);

      // 标记为未初始化，但保留配置
      this.servers.set(language, {
        language,
        config,
        initialized: false,
      });
    }
  }

  /**
   * 获取文件对应的 Language Server
   */
  private getServerForFile(file: string): LanguageServerInstance | null {
    const language = this.fileLanguageMap.get(file) || this.detectLanguageFromFile(file);
    if (!language) return null;

    const server = this.servers.get(language);
    if (!server || !server.initialized) return null;

    return server;
  }

  async textDocumentHover(file: string, position: Position): Promise<HoverInfo | null> {
    const server = this.getServerForFile(file);
    if (!server) return null;

    try {
      const result = await invoke<HoverInfo | null>('lsp_hover', {
        language: server.language,
        file,
        position,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP hover failed:', error);
      return null;
    }
  }

  async textDocumentDefinition(file: string, position: Position): Promise<Location | null> {
    const server = this.getServerForFile(file);
    if (!server) return null;

    try {
      const result = await invoke<Location | null>('lsp_definition', {
        language: server.language,
        file,
        position,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP definition failed:', error);
      return null;
    }
  }

  async textDocumentReferences(file: string, position: Position): Promise<Location[]> {
    const server = this.getServerForFile(file);
    if (!server) return [];

    try {
      const result = await invoke<Location[]>('lsp_references', {
        language: server.language,
        file,
        position,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP references failed:', error);
      return [];
    }
  }

  async textDocumentRename(
    file: string,
    position: Position,
    newName: string
  ): Promise<WorkspaceEdit | null> {
    const server = this.getServerForFile(file);
    if (!server) return null;

    try {
      const result = await invoke<WorkspaceEdit | null>('lsp_rename', {
        language: server.language,
        file,
        position,
        newName,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP rename failed:', error);
      return null;
    }
  }

  async textDocumentCompletion(file: string, position: Position): Promise<CompletionItem[]> {
    const server = this.getServerForFile(file);
    if (!server) return [];

    try {
      const result = await invoke<CompletionItem[]>('lsp_completion', {
        language: server.language,
        file,
        position,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP completion failed:', error);
      return [];
    }
  }

  async textDocumentDiagnostics(file: string): Promise<Diagnostic[]> {
    const server = this.getServerForFile(file);
    if (!server) return [];

    try {
      const result = await invoke<Diagnostic[]>('lsp_diagnostics', {
        language: server.language,
        file,
      });
      return result;
    } catch (error) {
      logger.error('LSPAutoLoader', 'LSP diagnostics failed:', error);
      return [];
    }
  }

  /**
   * 获取所有活动的 Language Server
   */
  getActiveServers(): LanguageServerInstance[] {
    return Array.from(this.servers.values()).filter(s => s.initialized);
  }

  /**
   * 手动添加语言支持
   */
  async addLanguageSupport(language: string): Promise<void> {
    if (this.servers.has(language)) {
      logger.warn('LSPAutoLoader', `Language Server for ${language} already exists`);
      return;
    }

    await this.startLanguageServer(language);
  }

  /**
   * 获取 Language Server 状态
   */
  async getServerStatus(language: string): Promise<string | null> {
    try {
      return await invoke<string | null>('lsp_get_status', { language });
    } catch (error) {
      logger.error('LSPAutoLoader', `Failed to get status for ${language}:`, error);
      return null;
    }
  }

  /**
   * 获取所有 Language Server 状态
   */
  async getAllServerStatus(): Promise<Record<string, string>> {
    try {
      return await invoke<Record<string, string>>('lsp_get_all_status', {});
    } catch (error) {
      logger.error('LSPAutoLoader', 'Failed to get all server status:', error);
      return {};
    }
  }

  /**
   * 重启 Language Server
   */
  async restartServer(language: string): Promise<boolean> {
    try {
      const processId = await invoke<number>('lsp_restart', { language });

      // 更新本地状态
      const server = this.servers.get(language);
      if (server) {
        server.processId = processId;
        server.initialized = true;
      }

      logger.debug('LSPAutoLoader', `Language Server restarted for ${language} (PID: ${processId});`);
      return true;
    } catch (error) {
      logger.error('LSPAutoLoader', `Failed to restart Language Server for ${language}:`, error);
      return false;
    }
  }

  /**
   * 获取 Language Server 详细信息
   */
  async getServerInfo(language: string): Promise<Record<string, unknown> | null> {
    try {
      return await invoke<Record<string, unknown> | null>('lsp_get_server_info', { language });
    } catch (error) {
      logger.error('LSPAutoLoader', `Failed to get server info for ${language}:`, error);
      return null;
    }
  }
}

/**
 * LSP Auto Loader
 * 自动管理 Language Server 的生命周期
 */
export class LSPAutoLoader {
  private client: RealLSPClient;
  private tools: LSPTools;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.client = new RealLSPClient();
    this.tools = new LSPTools(workspaceRoot, this.client);
  }

  /**
   * 初始化并自动加载所有 Language Server
   */
  async initialize(): Promise<void> {
    await this.tools.initialize();
  }

  /**
   * 关闭所有 Language Server
   */
  async shutdown(): Promise<void> {
    await this.tools.shutdown();
  }

  /**
   * 获取 LSP 工具实例
   */
  getTools(): LSPTools {
    return this.tools;
  }

  /**
   * 获取活动的 Language Server 列表
   */
  getActiveServers(): LanguageServerInstance[] {
    return this.client.getActiveServers();
  }

  /**
   * 手动添加语言支持
   */
  async addLanguageSupport(language: string): Promise<void> {
    await this.client.addLanguageSupport(language);
  }

  /**
   * 获取 Language Server 状态
   */
  async getServerStatus(language: string): Promise<string | null> {
    return await this.client.getServerStatus(language);
  }

  /**
   * 获取所有 Language Server 状态
   */
  async getAllServerStatus(): Promise<Record<string, string>> {
    return await this.client.getAllServerStatus();
  }

  /**
   * 重启 Language Server
   */
  async restartServer(language: string): Promise<boolean> {
    return await this.client.restartServer(language);
  }

  /**
   * 获取 Language Server 详细信息
   */
  async getServerInfo(language: string): Promise<Record<string, unknown> | null> {
    return await this.client.getServerInfo(language);
  }

  /**
   * 为 LLM 提供上下文信息
   * 返回当前项目的语言服务器状态
   */
  getLLMContext(): string {
    const servers = this.getActiveServers();

    if (servers.length === 0) {
      return 'No Language Servers are currently active.';
    }

    const serverInfo = servers.map(s => {
      const capabilities = Object.keys(s.capabilities || {}).join(', ');
      return `- ${s.language}: ${s.config.command} (capabilities: ${capabilities})`;
    }).join('\n');

    return `Active Language Servers:\n${serverInfo}\n\nYou can use LSP features like hover, definition, references, completion, and diagnostics for these languages.`;
  }
}

export default LSPAutoLoader;
