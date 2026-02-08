# Fangyu Code 插件系统

> 完整的插件扩展系统，参考 VSCode Extensions、Zed Plugins、Cursor Extensions 设计

## 快速开始

### 1. 安装和使用

```tsx
import { PluginManager, usePluginLoader, usePluginMarketplace } from "@/plugins";

function App() {
  return (
    <PluginManager
      workspacePath="/path/to/workspace"
      onInstall={(id) => console.log("Installed:", id)}
    />
  );
}
```

### 2. 使用插件加载器

```tsx
import { usePluginLoader } from "@/plugins";

function MyComponent() {
  const { plugins, loadPlugin, activatePlugin, deactivatePlugin, getStats } = usePluginLoader({
    workspacePath: "/path/to/workspace",
    onPluginActivated: (plugin) => {
      console.log("Plugin activated:", plugin.id);
    },
  });

  const stats = getStats();
  console.log(`${stats.activated}/${stats.total} plugins activated`);

  return (
    <div>
      {plugins.map((p) => (
        <div key={p.id}>
          {p.manifest.name} - {p.activated ? "Active" : "Inactive"}
        </div>
      ))}
    </div>
  );
}
```

### 3. 使用插件市场

```tsx
import { usePluginMarketplace } from "@/plugins";

function Marketplace() {
  const { searchPlugins, installPlugin, getFeaturedPlugins, getInstallProgress } =
    usePluginMarketplace({
      onInstallComplete: (id) => {
        console.log("Installed:", id);
      },
    });

  // 搜索插件
  const handleSearch = async () => {
    const result = await searchPlugins({
      query: "react",
      category: "snippet",
      sortBy: "downloads",
    });
    console.log(result.plugins);
  };

  // 安装插件
  const handleInstall = async (id: string) => {
    const success = await installPlugin(id);
    if (success) {
      console.log("Installation successful");
    }
  };

  return <div>...</div>;
}
```

## 插件开发

### 插件清单 (package.json)

```json
{
  "id": "fangyu.my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Description of my plugin",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "publisher": "fangyu",
  "categories": ["ai", "productivity"],
  "tags": ["ai", "assistant", "code"],
  "activationEvents": ["*", "onLanguage:javascript", "onCommand:myPlugin.doSomething"],
  "engines": {
    "fangyu": ">=1.0.0"
  },
  "contributes": {
    "commands": [
      {
        "command": "myPlugin.doSomething",
        "title": "Do Something",
        "category": "My Plugin"
      }
    ],
    "configuration": {
      "title": "My Plugin Settings",
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable my plugin"
        }
      }
    }
  },
  "permissions": ["filesystem.read", "filesystem.write", "ai.prompt"]
}
```

### 插件主文件 (index.ts)

```typescript
import { Plugin, PluginContext } from "@/plugins";

export default class MyPlugin implements Plugin {
  async activate(context: PluginContext): Promise<void> {
    context.logger.info("Plugin activated!");

    // 注册命令
    const disposable = context.api.commands.registerCommand("myPlugin.doSomething", async () => {
      const result = await context.api.ai.prompt("Hello AI!");
      context.api.window.showInformationMessage(result.content);
    });

    // 添加到订阅列表（自动清理）
    context.subscriptions.push(disposable);

    // 读取配置
    const config = context.api.workspace.getConfiguration("myPlugin");
    const enabled = config.get<boolean>("enabled", true);

    if (enabled) {
      // 监听编辑器变化
      const editorListener = context.api.editor.onDidChangeActiveEditor((editor) => {
        if (editor) {
          context.logger.info("Active editor changed:", editor.document.fileName);
        }
      });

      context.subscriptions.push(editorListener);
    }

    // 使用状态存储
    await context.globalState.update("lastActivated", new Date().toISOString());
  }

  async deactivate(): Promise<void> {
    console.log("Plugin deactivated!");
  }
}
```

## API 文档

### PluginContext

插件上下文对象，提供插件生命周期内的所有功能访问：

```typescript
interface PluginContext {
  subscriptions: Disposable[]; // 订阅列表（自动清理）
  globalState: StateStorage; // 全局状态
  workspaceState: StateStorage; // 工作区状态
  extensionPath: string; // 插件路径
  logger: Logger; // 日志器
  api: PluginAPI; // API 访问器
}
```

### PluginAPI

#### Commands API

```typescript
// 注册命令
context.api.commands.registerCommand("myPlugin.cmd", () => {
  console.log("Command executed");
});

// 执行命令
await context.api.commands.executeCommand("editor.action.formatDocument");

// 获取所有命令
const commands = await context.api.commands.getCommands();
```

#### Editor API

```typescript
// 获取活动编辑器
const editor = context.api.editor.getActiveEditor();
if (editor) {
  // 获取文本
  const text = editor.document.getText();

  // 编辑文本
  await editor.edit((editBuilder) => {
    editBuilder.insert({ line: 0, character: 0 }, "Hello World\n");
  });

  // 插入代码片段
  await editor.insertSnippet('console.log("${1:message}")');
}

// 监听编辑器变化
context.api.editor.onDidChangeActiveEditor((editor) => {
  console.log("Editor changed:", editor?.document.fileName);
});
```

#### Workspace API

```typescript
// 获取工作区路径
const rootPath = context.api.workspace.getRootPath();

// 查找文件
const files = await context.api.workspace.findFiles("**/*.ts", "**/node_modules/**");

// 读取配置
const config = context.api.workspace.getConfiguration("myPlugin");
const value = config.get<string>("setting", "default");

// 更新配置
await config.update("setting", "newValue", "global");

// 监听文件变化
context.api.workspace.onDidChangeTextDocument((event) => {
  console.log("Document changed:", event.document.fileName);
});
```

#### AI API

```typescript
// 发送提示
const response = await context.api.ai.prompt("Explain this code", {
  model: "claude-3-opus",
  temperature: 0.7,
  maxTokens: 1000,
});

// 流式提示
await context.api.ai.streamPrompt("Generate code", {}, (chunk) => console.log("Chunk:", chunk));

// 注册 AI 工具
context.api.ai.registerTool({
  id: "myTool",
  name: "My Tool",
  description: "Does something useful",
  inputSchema: { type: "object", properties: { input: { type: "string" } } },
  execute: async (input) => {
    return { result: "Done" };
  },
});
```

#### Window API

```typescript
// 显示消息
await context.api.window.showInformationMessage("Hello!");
await context.api.window.showWarningMessage("Warning!");
await context.api.window.showErrorMessage("Error!", "Retry", "Cancel");

// 显示输入框
const input = await context.api.window.showInputBox({
  prompt: "Enter your name",
  placeHolder: "Name",
});

// 显示快速选择
const item = await context.api.window.showQuickPick(["Option 1", "Option 2"]);

// 创建输出通道
const output = context.api.window.createOutputChannel("My Plugin");
output.appendLine("Hello from plugin!");
output.show();

// 创建状态栏项
const statusBar = context.api.window.createStatusBarItem("left", 100);
statusBar.text = "$(check) My Plugin";
statusBar.tooltip = "Plugin is active";
statusBar.show();
```

#### FileSystem API

```typescript
// 读取文件
const content = await context.api.fs.readFile("/path/to/file.txt");

// 写入文件
await context.api.fs.writeFile("/path/to/file.txt", new TextEncoder().encode("content"));

// 读取目录
const entries = await context.api.fs.readDirectory("/path/to/dir");

// 创建目录
await context.api.fs.createDirectory("/path/to/newdir");

// 删除
await context.api.fs.delete("/path/to/file", { recursive: true });

// 重命名
await context.api.fs.rename("/old/path", "/new/path");

// 检查存在
const exists = await context.api.fs.exists("/path/to/file");

// 获取文件信息
const stat = await context.api.fs.stat("/path/to/file");
console.log(stat.type, stat.size, stat.mtime);
```

## 插件分类

| 分类           | 说明       | 图标 |
| -------------- | ---------- | ---- |
| `ai`           | AI 增强    | 🤖   |
| `editor`       | 编辑器功能 | ✏️   |
| `language`     | 语言支持   | 🌐   |
| `theme`        | 主题       | 🎨   |
| `snippet`      | 代码片段   | 📝   |
| `debugger`     | 调试器     | 🐛   |
| `formatter`    | 格式化     | 📐   |
| `linter`       | 代码检查   | 🔍   |
| `testing`      | 测试       | 🧪   |
| `productivity` | 效率工具   | ⚡   |
| `git`          | Git 工具   | 📦   |
| `other`        | 其他       | 📁   |

## 激活事件

| 事件                     | 说明                       |
| ------------------------ | -------------------------- |
| `*`                      | 总是激活（启动时自动加载） |
| `onStartupFinished`      | 启动完成后激活             |
| `onLanguage:javascript`  | 打开 JavaScript 文件时激活 |
| `onCommand:myPlugin.cmd` | 执行特定命令时激活         |
| `onView:myView`          | 打开特定视图时激活         |
| `onFileSystem:git`       | 访问 Git 文件系统时激活    |

## 权限说明

| 权限               | 说明            |
| ------------------ | --------------- |
| `filesystem.read`  | 读取文件系统    |
| `filesystem.write` | 写入文件系统    |
| `network.fetch`    | 发起网络请求    |
| `shell.execute`    | 执行 Shell 命令 |
| `clipboard.read`   | 读取剪贴板      |
| `clipboard.write`  | 写入剪贴板      |
| `ai.prompt`        | 使用 AI 提示    |
| `ai.tools`         | 使用 AI 工具    |
| `config.read`      | 读取配置        |
| `config.write`     | 写入配置        |

## 工具函数

```typescript
import {
  validatePluginManifest,
  parsePluginId,
  compareVersions,
  needsUpdate,
  formatFileSize,
  formatDownloads,
} from "@/plugins";

// 验证清单
const { valid, errors } = validatePluginManifest(manifest);

// 解析插件 ID
const { publisher, name } = parsePluginId("fangyu.my-plugin");

// 比较版本
const newer = compareVersions("2.0.0", "1.5.0"); // 1

// 检查更新
if (needsUpdate("1.0.0", "1.5.0")) {
  console.log("Update available");
}

// 格式化文件大小
formatFileSize(1024000); // "1.00 MB"

// 格式化下载次数
formatDownloads(1500000); // "1.5M"
```

## 最佳实践

### 1. 使用订阅列表管理资源

```typescript
async activate(context: PluginContext) {
  // ✅ 正确：添加到订阅列表
  context.subscriptions.push(
    context.api.commands.registerCommand('cmd', () => {})
  );

  // ❌ 错误：不添加到订阅列表会导致内存泄漏
  context.api.commands.registerCommand('cmd', () => {});
}
```

### 2. 错误处理

```typescript
async activate(context: PluginContext) {
  try {
    // 你的代码
  } catch (error) {
    context.logger.error('Activation failed:', error);
    context.api.window.showErrorMessage('Plugin activation failed');
    throw error; // 重新抛出让系统知道激活失败
  }
}
```

### 3. 异步操作

```typescript
async activate(context: PluginContext) {
  // ✅ 使用 async/await
  const data = await fetchData();

  // ❌ 不要阻塞激活
  // syncHeavyOperation(); // 这会阻塞 UI
}
```

### 4. 配置管理

```typescript
// 定义配置架构
"contributes": {
  "configuration": {
    "properties": {
      "myPlugin.autoSave": {
        "type": "boolean",
        "default": true,
        "description": "自动保存"
      }
    }
  }
}

// 读取配置
const config = context.api.workspace.getConfiguration('myPlugin');
const autoSave = config.get<boolean>('autoSave', true);

// 监听配置变化
// TODO: 添加配置变化监听 API
```

## 插件示例

查看 `/plugins/examples/` 目录下的完整示例：

- `hello-world/` - 最简单的插件示例
- `code-snippet/` - 代码片段插件
- `ai-assistant/` - AI 辅助插件
- `git-tools/` - Git 工具插件

## 故障排查

### 插件无法加载

1. 检查 `package.json` 格式是否正确
2. 确认 `activationEvents` 已设置
3. 查看日志输出（`context.logger`）

### 命令未注册

1. 确认命令已添加到 `contributes.commands`
2. 检查命令 ID 是否匹配
3. 确认插件已激活

### 权限被拒绝

1. 检查 `permissions` 数组是否包含所需权限
2. 确认用户已授予权限

## 相关资源

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Zed Extensions](https://zed.dev/docs/extensions)
- [Cursor Extensions](https://cursor.sh/docs/extensions)
