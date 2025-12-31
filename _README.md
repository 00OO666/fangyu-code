# Fangyu Code - 项目总览

> **Fangyu 专属 AI 开发工具** | 基于 Tauri 2 + React 18 + TypeScript + Rust 构建

---

## 快速定位指南

**需要修改代码？直接查表👇定位文件！**

| 我想要... | 去这里找 | 文件/目录 |
|-----------|---------|---------|
| 修改模型选择器 | 用户输入组件 | `src/components/FloatingPromptInput/ModelSelector.tsx` |
| 添加新 Slash 命令 | 命令配置文件 | `src/components/FloatingPromptInput/slashCommands.ts` |
| 修改消息渲染 | 消息组件 | `src/components/message/AIMessage.tsx` |
| 修改成本计算 | 定价逻辑 | `src/lib/pricing.ts` |
| 修改流式处理 | 核心 Hook | `src/hooks/useSessionStream.ts` |
| 修改会话管理 | 智能会话 Hook | `src/hooks/useSmartSession.ts` |
| 修改 Claude CLI 集成 | Rust 后端 | `src-tauri/src/claude_binary.rs` |
| 添加新 Tauri 命令 | 命令模块 | `src-tauri/src/commands/` |
| 修改侧边栏导航 | 布局组件 | `src/components/layout/Sidebar.tsx` |
| 修改顶部工具栏 | 会话工具栏 | `src/components/SessionToolbar.tsx` |
| 修改主题样式 | 全局样式 | `src/index.css` |
| 修改 MCP 服务器管理 | MCP 组件 | `src/components/MCPManager.tsx` |
| 修改 Hook 编辑器 | Hook 管理 | `src/components/HooksEditor.tsx` |
| 修改插件系统 | 插件管理器 | `src/components/PluginManager.tsx` |
| 修改多引擎选择 | 引擎选择器 | `src/components/ExecutionEngineSelector.tsx` |
| 修改翻译功能 | 翻译中间件 | `src/lib/translationMiddleware.ts` |
| 修改 Token 计算 | Token 计数器 | `src/lib/tokenCounter.ts` |
| 修改国际化文案 | i18n 配置 | `src/i18n/locales/` |

---

## 项目结构

```
F:/Any-Code-Dev/
├── src/                         # React 前端源码
│   ├── components/              # 85+ React 组件
│   │   ├── FloatingPromptInput/ # 用户输入核心组件 ⭐
│   │   ├── message/             # 消息渲染组件 ⭐
│   │   ├── layout/              # 页面布局组件
│   │   ├── session/             # 会话管理组件
│   │   ├── dialogs/             # 对话框组件
│   │   ├── editor/              # 编辑器组件
│   │   ├── widgets/             # 功能小部件
│   │   ├── settings/            # 设置面板
│   │   ├── common/              # 通用组件
│   │   ├── ui/                  # 基础 UI 组件
│   │   ├── icons/               # 图标组件
│   │   ├── skeletons/           # 加载骨架屏
│   │   ├── sync/                # 同步相关组件
│   │   └── *.tsx                # 顶层组件（50+ 文件）
│   ├── hooks/                   # 35 个自定义 Hook ⭐
│   ├── contexts/                # 8 个 React Context
│   ├── lib/                     # 工具库和服务 ⭐
│   │   ├── stream/              # 流式处理核心
│   │   └── services/            # API 服务
│   ├── types/                   # TypeScript 类型定义
│   ├── i18n/                    # 国际化（简中/繁中/英文）
│   ├── config/                  # 配置文件
│   ├── pages/                   # 页面组件
│   ├── assets/                  # 静态资源
│   └── styles/                  # 全局样式
│
├── src-tauri/                   # Rust 后端源码
│   ├── src/
│   │   ├── main.rs              # Rust 主入口
│   │   ├── claude_binary.rs     # Claude CLI 集成 (86KB) ⭐
│   │   ├── claude_mcp.rs        # Claude MCP 协议
│   │   ├── codex_mcp.rs         # OpenAI Codex MCP
│   │   ├── gemini_mcp.rs        # Google Gemini MCP
│   │   ├── commands/            # 26 个命令模块 ⭐
│   │   │   ├── acemcp.rs        # ACEMCP 配置 (59KB)
│   │   │   ├── mcp.rs           # MCP 命令 (37KB)
│   │   │   ├── wsl_utils.rs     # WSL 工具 (73KB)
│   │   │   └── ...              # 20+ 更多命令
│   │   ├── mcp/                 # MCP 协议实现
│   │   ├── process/             # 进程管理
│   │   └── utils/               # Rust 工具函数
│   ├── Cargo.toml               # Rust 依赖配置
│   ├── tauri.conf.json          # Tauri 应用配置
│   └── icons/                   # 应用图标
│
├── package.json                 # Node.js 项目配置
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 构建配置
├── tailwind.config.js           # Tailwind CSS 配置
├── README.md                    # 项目说明文档
├── FANGYU-CUSTOMIZATION.md      # Fangyu 定制说明
└── BUILD.bat                    # 构建脚本
```

---

## 技术栈

### 前端技术
- **框架**: React 18.3.1
- **语言**: TypeScript 5.9.3
- **构建工具**: Vite 6.0.3
- **UI 组件库**: Radix UI (20+ 组件)
- **样式**: Tailwind CSS 4.1.8
- **动画**: Framer Motion 12.23.24
- **国际化**: i18next 25.6.0
- **Markdown**: react-md-editor 4.0.8, react-markdown 9.0.3
- **虚拟化**: TanStack React Virtual 3.13.12
- **代码高亮**: react-syntax-highlighter 15.6.1

### 后端技术 (Rust)
- **框架**: Tauri 2.9
- **异步运行时**: Tokio
- **数据库**: SQLite (SQLx ORM)
- **HTTP 客户端**: Reqwest 0.12
- **序列化**: serde + serde_json
- **日志**: env_logger 0.11

### AI SDK
- **Claude SDK**: @anthropic-ai/sdk ^0.68.0
- **Claude Agent SDK**: @anthropic-ai/claude-agent-sdk ^0.1.30

### Tauri 插件
- dialog (文件对话框)
- fs (文件系统)
- shell (Shell 命令)
- process (进程管理)
- http (HTTP 请求)
- updater (自动更新)
- global-shortcut (全局快捷键)
- opener (文件打开器)

---

## 核心功能模块

### 1. 三引擎架构
- **Claude Code CLI**: 官方 Claude Code CLI 集成
- **OpenAI Codex**: API 集成
- **Google Gemini**: API 集成

### 2. 会话管理系统
- 多标签页独立对话
- 会话历史记录
- 实时流式输出
- 会话导出和导入
- 会话成本追踪

### 3. MCP (Model Context Protocol)
- 多应用 MCP 支持
- MCP 服务器管理
- MCP 命令 API

### 4. 高级编辑功能
- 代码折叠 (`useCodeFolding`)
- 多光标编辑 (`useMultiCursor`)
- 代码完成 (`useCompletion`)
- 代码语法高亮

### 5. AI 能力增强
- 扩展思考模式 (`useExtendedThinking`)
- 自动上下文压缩 (`useAutoCompactStatus`)
- 提示增强服务
- Token 计数和成本追踪

### 6. 翻译中间件
- 双语文本处理
- 渐进式翻译
- 翻译缓存

### 7. 开发工具集
- Git 自动提交 (`useGitAutoCommit`)
- Bash/命令执行
- 文件操作
- 项目搜索
- WSL 集成

### 8. 插件系统
- VSCode 风格插件加载
- 插件 Hook 注册
- 动态加载机制

---

## 核心文件速查表

| 文件路径 | 作用 | 修改频率 | 复杂度 |
|---------|------|---------|--------|
| `src/App.tsx` | 应用入口，Context 嵌套 | 低 | 简单 |
| `src/components/layout/AppLayout.tsx` | 主布局容器 | 低 | 中 |
| `src/components/layout/ViewRouter.tsx` | 视图路由 | 中 | 中 |
| `src/components/FloatingPromptInput/` | 用户输入核心 | 高 | 高 |
| `src/components/message/` | 消息渲染 | 高 | 高 |
| `src/hooks/useSessionStream.ts` | 流式处理核心 | 中 | 高 |
| `src/hooks/useSmartSession.ts` | 会话管理 | 中 | 高 |
| `src/lib/api.ts` | API 调用层 | 中 | 中 |
| `src/lib/pricing.ts` | 定价逻辑 | 低 | 中 |
| `src/lib/translationMiddleware.ts` | 翻译系统 | 低 | 高 |
| `src-tauri/src/main.rs` | Rust 主入口 | 低 | 中 |
| `src-tauri/src/claude_binary.rs` | Claude CLI 集成 | 中 | 高 |
| `src-tauri/src/commands/` | Tauri 命令模块 | 中 | 中-高 |

---

## 常见修改场景

### 场景 1: "我想在消息中添加新的工具调用显示"
**修改文件**:
1. `src/components/message/ToolCallsGroup.tsx` - 工具调用组件
2. `src/components/message/AIMessage.tsx` - AI 消息渲染
3. `src/types/claude.ts` - 如需新类型定义

**修改步骤**:
1. 在 `ToolCallsGroup` 中添加新的工具类型判断
2. 在 `AIMessage` 中渲染新工具调用
3. 更新类型定义

---

### 场景 2: "我想添加新的 Slash 命令"
**修改文件**:
1. `src/components/FloatingPromptInput/slashCommands.ts` - 命令定义
2. `src/components/FloatingPromptInput/SlashCommandMenu.tsx` - 命令菜单

**修改步骤**:
1. 在 `slashCommands.ts` 的 `commands` 数组中添加新命令对象
2. 定义命令的 `name`, `description`, `category`, `action`
3. 命令菜单会自动显示新命令

---

### 场景 3: "我想修改模型选择器的样式"
**修改文件**:
1. `src/components/FloatingPromptInput/ModelSelector.tsx` - 组件逻辑和样式
2. `src/index.css` - 如需全局样式覆盖

**修改步骤**:
1. 找到组件中的 `className` 属性
2. 修改 Tailwind CSS 类名
3. 或添加自定义 CSS 类并在 `src/index.css` 中定义

---

### 场景 4: "我想添加新的 Tauri 命令"
**修改文件**:
1. `src-tauri/src/commands/` - 创建新的命令模块 `.rs` 文件
2. `src-tauri/src/main.rs` - 注册命令

**修改步骤**:
1. 在 `commands/` 下创建 `my_command.rs`
2. 定义命令函数并添加 `#[tauri::command]` 注解
3. 在 `main.rs` 的 `.invoke_handler()` 中注册命令
4. 在前端使用 `invoke('my_command')` 调用

---

### 场景 5: "我想修改会话成本计算"
**修改文件**:
1. `src/lib/pricing.ts` - 定价配置
2. `src/hooks/useSessionCostCalculation.ts` - 成本计算 Hook

**修改步骤**:
1. 在 `pricing.ts` 中修改 `modelPricing` 对象
2. 更新 `calculateCost` 函数逻辑
3. `useSessionCostCalculation` 会自动使用新定价

---

## 项目特色

### ✨ 多引擎支持
同时支持 Claude Code CLI、OpenAI Codex、Google Gemini 三种 AI 引擎

### 🌐 完整国际化
支持简体中文、繁体中文、英文三种语言

### 🔌 插件系统
VSCode 风格的插件加载机制

### 🎨 现代化 UI
基于 Radix UI + Tailwind CSS 打造

### 🚀 高性能
虚拟化列表、流式渲染、智能缓存

### 🔧 强大的开发工具
Git 集成、Hook 管理、MCP 协议、WSL 支持

---

## 开发指南

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run tauri:dev
```

### 构建应用
```bash
# 完整构建（发布版）
npm run tauri:build

# 快速构建（调试版）
npm run tauri:build-fast
```

### 代码规范
- **React 组件**: 使用函数式组件 + Hooks
- **类型定义**: 严格的 TypeScript 类型
- **样式**: Tailwind CSS 实用类 + CSS Modules
- **命名**: 驼峰命名（camelCase）用于变量/函数，帕斯卡命名（PascalCase）用于组件

---

## 相关文档

- **组件索引**: `_COMPONENT_INDEX.md` - UI 组件完整目录
- **功能索引**: `_FUNCTION_INDEX.md` - 功能模块映射
- **src 目录**: `src/_README.md` - 前端源码说明
- **components**: `src/components/_README.md` - 组件目录说明
- **hooks**: `src/hooks/_README.md` - Hook 库说明
- **lib**: `src/lib/_README.md` - 工具库说明
- **Rust 后端**: `src-tauri/_README.md` - Rust 后端说明

---

## 维护建议

1. **组件开发**: 遵循 Radix UI 的 API 设计模式
2. **Hook 开发**: 确保 Hook 的可复用性和独立性
3. **类型定义**: 及时更新 `src/types/` 中的类型
4. **文档更新**: 修改代码后同步更新对应的 README
5. **性能优化**: 使用 `React.memo`、`useMemo`、`useCallback` 避免不必要的渲染

---

**最后更新**: 2025-12-27
**版本**: 1.0.0
**维护者**: Fangyu
**License**: AGPL-3.0
