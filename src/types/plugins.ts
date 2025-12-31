/**
 * Plugin System Types - 插件系统类型定义
 *
 * 功能:
 * - 插件元数据和配置
 * - 插件API接口定义
 * - 插件生命周期钩子
 * - 插件权限和安全
 *
 * 来源: VSCode Extensions + Zed Plugins + Cursor Extensions
 */

// ============================================================
// 插件元数据
// ============================================================

export interface PluginManifest {
  /** 插件唯一标识符（格式: publisher.name） */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本（遵循语义化版本） */
  version: string;
  /** 插件描述 */
  description: string;
  /** 作者信息 */
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  /** 发布者 */
  publisher: string;
  /** 主页链接 */
  homepage?: string;
  /** 仓库链接 */
  repository?: string;
  /** 许可证 */
  license?: string;
  /** 图标路径 */
  icon?: string;
  /** 分类 */
  categories: PluginCategory[];
  /** 标签 */
  tags?: string[];
  /** 依赖的其他插件 */
  dependencies?: Record<string, string>;
  /** 引擎版本要求 */
  engines: {
    fangyu?: string; // Fangyu Code 版本要求
    claude?: string; // Claude API 版本要求
  };
  /** 激活事件（何时加载插件） */
  activationEvents: ActivationEvent[];
  /** 贡献点（插件提供的功能） */
  contributes?: PluginContributions;
  /** 权限要求 */
  permissions?: PluginPermission[];
}

export type PluginCategory =
  | 'ai' // AI 增强
  | 'editor' // 编辑器功能
  | 'language' // 语言支持
  | 'theme' // 主题
  | 'snippet' // 代码片段
  | 'debugger' // 调试器
  | 'formatter' // 格式化
  | 'linter' // 代码检查
  | 'testing' // 测试
  | 'productivity' // 效率工具
  | 'git' // Git 工具
  | 'other'; // 其他

export type ActivationEvent =
  | '*' // 总是激活
  | `onLanguage:${string}` // 打开特定语言文件时
  | `onCommand:${string}` // 执行特定命令时
  | `onView:${string}` // 打开特定视图时
  | `onFileSystem:${string}` // 访问特定文件系统时
  | 'onStartupFinished' // 启动完成后
  | 'onUri'; // 处理 URI 时

export interface PluginContributions {
  /** 命令贡献 */
  commands?: CommandContribution[];
  /** 菜单贡献 */
  menus?: MenuContribution[];
  /** 配置贡献 */
  configuration?: ConfigurationContribution;
  /** 语言贡献 */
  languages?: LanguageContribution[];
  /** 主题贡献 */
  themes?: ThemeContribution[];
  /** 代码片段贡献 */
  snippets?: SnippetContribution[];
  /** AI 提示词贡献 */
  prompts?: PromptContribution[];
  /** 工具贡献 */
  tools?: ToolContribution[];
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string; // When 表达式
}

export interface MenuContribution {
  commandPalette?: Array<{
    command: string;
    when?: string;
  }>;
  editor?: Array<{
    command: string;
    group?: string;
    when?: string;
  }>;
  context?: Array<{
    command: string;
    group?: string;
    when?: string;
  }>;
}

export interface ConfigurationContribution {
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: any;
  description: string;
  enum?: any[];
  enumDescriptions?: string[];
}

export interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions?: string[];
  configuration?: string; // 语言配置文件路径
}

export interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface PromptContribution {
  id: string;
  name: string;
  description: string;
  template: string;
  variables?: string[];
}

export interface ToolContribution {
  id: string;
  name: string;
  description: string;
  schema: any; // JSON Schema
}

export type PluginPermission =
  | 'filesystem.read' // 读取文件系统
  | 'filesystem.write' // 写入文件系统
  | 'network.fetch' // 网络请求
  | 'shell.execute' // 执行 Shell 命令
  | 'clipboard.read' // 读取剪贴板
  | 'clipboard.write' // 写入剪贴板
  | 'ai.prompt' // 使用 AI 提示
  | 'ai.tools' // 使用 AI 工具
  | 'config.read' // 读取配置
  | 'config.write'; // 写入配置

// ============================================================
// 插件状态
// ============================================================

export interface PluginState {
  /** 插件唯一ID */
  id: string;
  /** 插件清单 */
  manifest: PluginManifest;
  /** 插件路径 */
  path: string;
  /** 是否已启用 */
  enabled: boolean;
  /** 是否已激活 */
  activated: boolean;
  /** 加载时间 */
  loadTime?: number;
  /** 激活时间 */
  activationTime?: number;
  /** 错误信息 */
  error?: string;
  /** 插件实例 */
  instance?: Plugin;
  /** 上下文对象 */
  context?: PluginContext;
}

// ============================================================
// 插件API
// ============================================================

/**
 * 插件主类 - 插件必须导出此接口的实现
 */
export interface Plugin {
  /**
   * 激活插件
   * @param context 插件上下文
   */
  activate(context: PluginContext): void | Promise<void>;

  /**
   * 停用插件（可选）
   */
  deactivate?(): void | Promise<void>;
}

/**
 * 插件上下文 - 传递给插件的API访问对象
 */
export interface PluginContext {
  /** 订阅列表（用于清理） */
  subscriptions: Disposable[];
  /** 插件全局状态存储 */
  globalState: StateStorage;
  /** 插件工作区状态存储 */
  workspaceState: StateStorage;
  /** 插件路径 */
  extensionPath: string;
  /** 插件URI */
  extensionUri: string;
  /** 环境变量 */
  environmentVariableCollection: EnvironmentVariableCollection;
  /** 日志输出 */
  logger: Logger;
  /** API 访问器 */
  api: PluginAPI;
}

/**
 * 可释放对象接口
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * 状态存储接口
 */
export interface StateStorage {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
  keys(): readonly string[];
}

/**
 * 环境变量集合
 */
export interface EnvironmentVariableCollection {
  persistent: boolean;
  replace(variable: string, value: string): void;
  append(variable: string, value: string): void;
  prepend(variable: string, value: string): void;
  get(variable: string): EnvironmentVariable | undefined;
  delete(variable: string): void;
  clear(): void;
}

export interface EnvironmentVariable {
  value: string;
  type: 'replace' | 'append' | 'prepend';
}

/**
 * 日志接口
 */
export interface Logger {
  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string | Error, ...args: any[]): void;
}

/**
 * 插件API - 插件可以访问的所有功能
 */
export interface PluginAPI {
  /** 命令API */
  commands: CommandsAPI;
  /** 编辑器API */
  editor: EditorAPI;
  /** 工作区API */
  workspace: WorkspaceAPI;
  /** AI API */
  ai: AIAPI;
  /** 窗口API */
  window: WindowAPI;
  /** 文件系统API */
  fs: FileSystemAPI;
  /** Git API */
  git?: GitAPI;
}

export interface CommandsAPI {
  /** 注册命令 */
  registerCommand(
    command: string,
    callback: (...args: any[]) => any,
    thisArg?: any
  ): Disposable;
  /** 执行命令 */
  executeCommand<T = unknown>(command: string, ...args: any[]): Promise<T>;
  /** 获取所有命令 */
  getCommands(filterInternal?: boolean): Promise<string[]>;
}

export interface EditorAPI {
  /** 获取活动编辑器 */
  getActiveEditor(): EditorInstance | undefined;
  /** 获取所有编辑器 */
  getAllEditors(): EditorInstance[];
  /** 打开文件 */
  openFile(path: string, options?: OpenFileOptions): Promise<EditorInstance>;
  /** 监听编辑器变化 */
  onDidChangeActiveEditor(
    listener: (editor: EditorInstance | undefined) => void
  ): Disposable;
}

export interface EditorInstance {
  document: TextDocument;
  selection: Selection;
  selections: Selection[];
  edit(callback: (editBuilder: TextEditorEdit) => void): Promise<boolean>;
  insertSnippet(snippet: string, location?: Position | Range): Promise<boolean>;
}

export interface TextDocument {
  uri: string;
  fileName: string;
  languageId: string;
  version: number;
  isDirty: boolean;
  isClosed: boolean;
  lineCount: number;
  getText(range?: Range): string;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  save(): Promise<boolean>;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Selection extends Range {
  anchor: Position;
  active: Position;
  isReversed: boolean;
}

export interface TextEditorEdit {
  insert(location: Position, value: string): void;
  delete(location: Range | Selection): void;
  replace(location: Range | Selection, value: string): void;
}

export interface OpenFileOptions {
  preview?: boolean;
  selection?: Range;
  viewColumn?: number;
}

export interface WorkspaceAPI {
  /** 获取工作区根路径 */
  getRootPath(): string | undefined;
  /** 获取工作区文件夹 */
  getWorkspaceFolders(): WorkspaceFolder[];
  /** 查找文件 */
  findFiles(
    include: string,
    exclude?: string,
    maxResults?: number
  ): Promise<string[]>;
  /** 读取配置 */
  getConfiguration(section?: string): WorkspaceConfiguration;
  /** 监听文件变化 */
  onDidChangeTextDocument(
    listener: (event: TextDocumentChangeEvent) => void
  ): Disposable;
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  index: number;
}

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  update(
    section: string,
    value: any,
    configurationTarget?: 'global' | 'workspace'
  ): Promise<void>;
}

export interface TextDocumentChangeEvent {
  document: TextDocument;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface TextDocumentContentChangeEvent {
  range: Range;
  rangeLength: number;
  text: string;
}

export interface AIAPI {
  /** 发送提示词 */
  prompt(
    prompt: string,
    options?: AIPromptOptions
  ): Promise<AIResponse>;
  /** 流式提示 */
  streamPrompt(
    prompt: string,
    options?: AIPromptOptions,
    onChunk?: (chunk: string) => void
  ): Promise<AIResponse>;
  /** 注册工具 */
  registerTool(tool: AITool): Disposable;
  /** 使用工具 */
  useTool(toolId: string, input: any): Promise<any>;
}

export interface AIPromptOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  name: string;
  input: any;
}

export interface AITool {
  id: string;
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
  execute(input: any): Promise<any>;
}

export interface WindowAPI {
  /** 显示信息消息 */
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
  /** 显示警告消息 */
  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
  /** 显示错误消息 */
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
  /** 显示输入框 */
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  /** 显示快速选择 */
  showQuickPick(
    items: string[] | QuickPickItem[],
    options?: QuickPickOptions
  ): Promise<string | QuickPickItem | undefined>;
  /** 创建输出通道 */
  createOutputChannel(name: string): OutputChannel;
  /** 创建状态栏项 */
  createStatusBarItem(alignment?: 'left' | 'right', priority?: number): StatusBarItem;
}

export interface InputBoxOptions {
  value?: string;
  prompt?: string;
  placeHolder?: string;
  password?: boolean;
  validateInput?(value: string): string | undefined | Promise<string | undefined>;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
}

export interface QuickPickOptions {
  placeHolder?: string;
  canPickMany?: boolean;
  ignoreFocusOut?: boolean;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}

export interface OutputChannel {
  name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export interface StatusBarItem {
  text: string;
  tooltip?: string;
  color?: string;
  command?: string;
  alignment: 'left' | 'right';
  priority: number;
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface FileSystemAPI {
  /** 读取文件 */
  readFile(path: string): Promise<Uint8Array>;
  /** 写入文件 */
  writeFile(path: string, content: Uint8Array): Promise<void>;
  /** 读取目录 */
  readDirectory(path: string): Promise<[string, 'file' | 'directory'][]>;
  /** 创建目录 */
  createDirectory(path: string): Promise<void>;
  /** 删除文件或目录 */
  delete(path: string, options?: { recursive?: boolean }): Promise<void>;
  /** 重命名文件或目录 */
  rename(oldPath: string, newPath: string, options?: { overwrite?: boolean }): Promise<void>;
  /** 检查文件或目录是否存在 */
  exists(path: string): Promise<boolean>;
  /** 获取文件状态 */
  stat(path: string): Promise<FileStat>;
}

export interface FileStat {
  type: 'file' | 'directory' | 'symlink';
  ctime: number;
  mtime: number;
  size: number;
}

export interface GitAPI {
  /** 获取仓库信息 */
  getRepository(path: string): Promise<GitRepository | undefined>;
  /** 获取所有仓库 */
  getRepositories(): Promise<GitRepository[]>;
}

export interface GitRepository {
  rootUri: string;
  state: GitRepositoryState;
  commit(message: string): Promise<void>;
  add(paths: string[]): Promise<void>;
  diff(path?: string): Promise<string>;
  log(options?: GitLogOptions): Promise<GitCommit[]>;
}

export interface GitRepositoryState {
  HEAD: GitBranch | undefined;
  refs: GitRef[];
  workingTreeChanges: GitChange[];
  indexChanges: GitChange[];
}

export interface GitBranch {
  name: string;
  type: 'local' | 'remote';
  commit?: string;
  upstream?: GitBranch;
}

export interface GitRef {
  name: string;
  commit: string;
  type: 'branch' | 'tag' | 'remote';
}

export interface GitChange {
  uri: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  originalUri?: string;
}

export interface GitLogOptions {
  maxEntries?: number;
  path?: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  authorDate: Date;
  commitDate: Date;
}

// ============================================================
// 插件安装和管理
// ============================================================

export interface PluginInstallOptions {
  /** 安装源 */
  source: 'marketplace' | 'file' | 'url' | 'git';
  /** 源路径或URL */
  location: string;
  /** 是否覆盖已存在的插件 */
  overwrite?: boolean;
  /** 是否自动启用 */
  autoEnable?: boolean;
}

export interface PluginMarketplaceInfo extends PluginManifest {
  /** 下载量 */
  downloads: number;
  /** 评分 */
  rating: number;
  /** 评论数 */
  reviewCount: number;
  /** 最后更新时间 */
  lastUpdated: string;
  /** 发布时间 */
  publishedDate: string;
  /** 下载链接 */
  downloadUrl: string;
  /** 截图 */
  screenshots?: string[];
}

export interface PluginSearchOptions {
  /** 搜索关键词 */
  query?: string;
  /** 分类过滤 */
  category?: PluginCategory;
  /** 排序方式 */
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'date';
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

export interface PluginSearchResult {
  plugins: PluginMarketplaceInfo[];
  total: number;
  page: number;
  pageSize: number;
}
