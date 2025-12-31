# 功能模块索引

> **Fangyu Code 功能快速导航** | 从功能到代码的映射表

---

## 目录

- [核心功能](#核心功能)
- [会话管理](#会话管理)
- [消息处理](#消息处理)
- [AI 引擎](#ai-引擎)
- [MCP 协议](#mcp-协议)
- [插件系统](#插件系统)
- [翻译系统](#翻译系统)
- [成本追踪](#成本追踪)
- [文件操作](#文件操作)
- [项目管理](#项目管理)
- [设置与配置](#设置与配置)
- [开发工具](#开发工具)

---

## 核心功能

| 功能 | 主要文件 | 相关组件 | 相关 Hook | Tauri 命令 |
|------|---------|---------|---------|-----------|
| **用户输入** | `FloatingPromptInput/` | InputArea, ModelSelector | usePromptExecution | `send_message` |
| **消息渲染** | `message/` | AIMessage, StreamMessageV2 | useSessionStream | - |
| **Slash 命令** | `FloatingPromptInput/slashCommands.ts` | SlashCommandMenu | useCustomSlashCommands | - |
| **流式处理** | `lib/stream/` | StreamMessageV2 | useSessionStream | `start_stream` |
| **多标签页** | `TabManager.tsx` | TabIndicator, TabSessionWrapper | useTabs | - |

---

## 会话管理

### 会话创建与加载

| 功能 | 主要文件 | 相关组件 | 相关 Hook | API |
|------|---------|---------|---------|-----|
| 创建新会话 | `hooks/useSmartSession.ts` | ClaudeCodeSession | useSmartSession | `POST /api/sessions` |
| 加载历史会话 | `components/SessionList.tsx` | SessionList | useSessionSync | `GET /api/sessions` |
| 会话自动保存 | `hooks/useSessionSync.ts` | - | useSessionSync | `PATCH /api/sessions/:id` |
| 会话导出 | `lib/sessionExport.ts` | - | - | `export_session` |
| 会话导入 | `lib/sessionHelpers.ts` | - | - | `import_session` |

### 会话状态管理

| 功能 | 主要文件 | 相关组件 | 相关 Hook | Context |
|------|---------|---------|---------|---------|
| 会话状态同步 | `hooks/useSessionSync.ts` | - | useSessionSync | - |
| 会话活动检测 | `hooks/useSessionActivityStatus.ts` | - | useSessionActivityStatus | - |
| 会话成本计算 | `hooks/useSessionCostCalculation.ts` | UsageDashboard | useSessionCostCalculation | - |
| 标签页管理 | `hooks/useTabs.ts` | TabManager | useTabs | TabProvider |
| 全局会话中心 | `components/GlobalSessionCenter.tsx` | GlobalSessionCenter | - | SessionContext |

---

## 消息处理

### 消息渲染

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|---------|------|
| AI 消息渲染 | `message/AIMessage.tsx` | AIMessage | - | Markdown + 代码高亮 |
| 流式消息渲染 | `message/StreamMessageV2.tsx` | StreamMessageV2 | useSessionStream | 实时流式渲染 |
| 工具调用显示 | `message/ToolCallsGroup.tsx` | ToolCallsGroup | useToolResults | 显示 AI 工具使用 |
| 思考过程显示 | `message/ThinkingBlock.tsx` | ThinkingBlock | - | Extended Thinking |
| 子代理消息组 | `message/SubagentMessageGroup.tsx` | SubagentMessageGroup | - | 子代理消息分组 |
| 系统消息 | `message/SystemMessage.tsx` | SystemMessage | - | 系统提示信息 |

### 消息处理

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|---------|------|
| 消息翻译 | `lib/translationMiddleware.ts` | - | useMessageTranslation | 双语翻译 |
| 消息分组 | `lib/subagentGrouping.ts` | - | useGroupedMessages | 子代理分组 |
| 消息过滤 | `hooks/useDisplayableMessages.ts` | - | useDisplayableMessages | 显示过滤 |
| 消息工具提取 | `hooks/useToolResults.ts` | - | useToolResults | 提取工具结果 |
| 消息提及解析 | `hooks/useMentionParser.ts` | - | useMentionParser | @提及解析 |

---

## AI 引擎

### Claude Code CLI

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| Claude CLI 集成 | `src-tauri/src/claude_binary.rs` | ClaudeCodeSession | `start_claude_session` | 核心集成 |
| Claude 状态监控 | `hooks/useEngineStatus.ts` | ClaudeStatusIndicator | `get_claude_status` | 连接状态 |
| Claude 扩展管理 | `components/ClaudeExtensionsManager.tsx` | ClaudeExtensionsManager | `manage_extensions` | 扩展管理 |
| Claude 记忆管理 | `components/ClaudeMemoriesDropdown.tsx` | ClaudeMemoriesDropdown | `get_memories` | 记忆功能 |
| Claude 文件编辑 | `components/ClaudeFileEditor.tsx` | ClaudeFileEditor | - | 配置编辑 |

### OpenAI Codex

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| Codex MCP | `src-tauri/src/codex_mcp.rs` | - | `codex_*` | MCP 协议 |
| Codex Provider | `components/CodexProviderManager.tsx` | CodexProviderManager | `add_codex_provider` | API 配置 |
| Codex 模型选择 | `FloatingPromptInput/CodexModelSelector.tsx` | CodexModelSelector | - | 模型选择 |
| Codex 推理等级 | `FloatingPromptInput/CodexReasoningLevelSelector.tsx` | CodexReasoningLevelSelector | - | 推理深度 |
| Codex 速率限制 | `FloatingPromptInput/CodexRateLimitBadge.tsx` | CodexRateLimitBadge | - | 限流显示 |

### Google Gemini

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| Gemini MCP | `src-tauri/src/gemini_mcp.rs` | - | `gemini_*` | MCP 协议 |
| Gemini Provider | `components/GeminiProviderManager.tsx` | GeminiProviderManager | `add_gemini_provider` | API 配置 |
| Gemini 模型选择 | `FloatingPromptInput/GeminiModelSelector.tsx` | GeminiModelSelector | - | 模型选择 |
| Gemini 会话管理 | `components/GeminiSessionManager.tsx` | GeminiSessionManager | - | 会话管理 |
| Gemini 会话历史 | `components/GeminiSessionHistoryPanel.tsx` | GeminiSessionHistoryPanel | - | 历史记录 |

### 引擎切换

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|---------|------|
| 引擎选择器 | `components/ExecutionEngineSelector.tsx` | ExecutionEngineSelector | - | Claude/Codex/Gemini |
| 引擎状态 | `components/UnifiedEngineStatus.tsx` | UnifiedEngineStatus | useEngineStatus | 统一状态显示 |
| 双 API 增强 | `lib/dualAPIEnhancement.ts` | - | - | 双引擎协作 |

---

## MCP 协议

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| MCP 服务器管理 | `components/MCPManager.tsx` | MCPManager | `add_mcp_server` | 管理 MCP 服务器 |
| MCP 服务器列表 | `components/MCPServerList.tsx` | MCPServerList | `list_mcp_servers` | 显示服务器列表 |
| MCP 添加服务器 | `components/MCPAddServer.tsx` | MCPAddServer | `add_mcp_server` | 添加新服务器 |
| MCP 导入导出 | `components/MCPImportExport.tsx` | MCPImportExport | `import/export_mcp` | 配置备份 |
| MCP 引擎面板 | `components/MCPEnginePanel.tsx` | MCPEnginePanel | - | 引擎控制 |
| MCP 描述 | `lib/mcpDescriptions.ts` | - | - | MCP 元数据 |
| ACEMCP 配置 | `src-tauri/src/commands/acemcp.rs` | AcemcpConfigSettings | `configure_acemcp` | ACEMCP 协议 |

---

## 插件系统

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|-----------|------|
| 插件加载 | `hooks/usePluginLoader.ts` | - | usePluginLoader | 动态加载 |
| 插件管理器 | `components/PluginManager.tsx` | PluginManager | - | 插件列表 |
| 插件市场 | `hooks/usePluginMarketplace.ts` | - | usePluginMarketplace | 插件商店 |
| Hook 链 | `hooks/useHookChain.ts` | - | useHookChain | Hook 链式调用 |
| 增强 Hooks | `components/EnhancedHooksManager.tsx` | EnhancedHooksManager | - | Hook 管理 |
| Hooks 编辑器 | `components/HooksEditor.tsx` | HooksEditor | - | Hook 配置编辑 |

---

## 翻译系统

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|-----------|------|
| 翻译中间件 | `lib/translationMiddleware.ts` | - | useMessageTranslation | 核心翻译逻辑 |
| 渐进式翻译 | `lib/progressiveTranslation.ts` | - | - | 逐步翻译 |
| 翻译设置 | `components/TranslationSettings.tsx` | TranslationSettings | - | 翻译配置 |
| i18n 国际化 | `src/i18n/` | LanguageSelector | useTranslation | 界面翻译 |
| 语言选择器 | `components/LanguageSelector.tsx` | LanguageSelector | - | 切换语言 |

---

## 成本追踪

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|---------|------|
| Token 计数 | `lib/tokenCounter.ts` | - | - | 计算 Token 数 |
| 定价配置 | `lib/pricing.ts` | - | - | 模型定价 |
| 成本计算 | `lib/sessionCost.ts` | - | useSessionCostCalculation | 会话成本 |
| 使用统计 | `components/UsageDashboard.tsx` | UsageDashboard | - | Token/成本仪表盘 |
| 上下文窗口 | `hooks/useContextWindowUsage.ts` | - | useContextWindowUsage | 窗口使用率 |

---

## 文件操作

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| 文件选择 | `components/FilePicker.tsx` | FilePicker | `select_file` | 文件对话框 |
| 文件读取 | `src-tauri/src/commands/` | - | `read_file` | 读取文件 |
| 文件写入 | `src-tauri/src/commands/` | - | `write_file` | 写入文件 |
| 图片预览 | `components/ImagePreview.tsx` | ImagePreview | - | 预览图片 |
| 附件处理 | `FloatingPromptInput/AttachmentPreview.tsx` | AttachmentPreview | - | 附件上传预览 |

---

## 项目管理

| 功能 | 主要文件 | 相关组件 | 相关 Hook | Context |
|------|---------|---------|---------|---------|
| 项目列表 | `components/ProjectList.tsx` | ProjectList | - | ProjectContext |
| 项目设置 | `components/ProjectSettings.tsx` | ProjectSettings | - | ProjectContext |
| 已删除项目 | `components/DeletedProjects.tsx` | DeletedProjects | - | - |
| 项目上下文 | `contexts/ProjectContext.tsx` | - | - | ProjectProvider |

---

## 设置与配置

| 功能 | 主要文件 | 相关组件 | Tauri 命令 | 说明 |
|------|---------|---------|-----------|------|
| 主设置面板 | `components/Settings.tsx` | Settings | - | 设置入口 |
| 提示上下文配置 | `components/PromptContextConfigSettings.tsx` | PromptContextConfigSettings | - | 上下文窗口 |
| 提示增强设置 | `components/PromptEnhancementSettings.tsx` | PromptEnhancementSettings | - | 提示增强 |
| 自动压缩设置 | `components/AutoCompactSettings.tsx` | AutoCompactSettings | - | 自动压缩 |
| 存储管理 | `components/StorageTab.tsx` | StorageTab | `clear_storage` | 存储清理 |

---

## 开发工具

| 功能 | 主要文件 | 相关组件 | 相关 Hook | Tauri 命令 |
|------|---------|---------|---------|-----------|
| Git 自动提交 | `hooks/useGitAutoCommit.ts` | GitChangesPanel | useGitAutoCommit | `git_*` |
| Git 变更面板 | `components/GitChangesPanel.tsx` | GitChangesPanel | - | - |
| WSL 集成 | `src-tauri/src/commands/wsl_utils.rs` | - | - | `wsl_*` |
| 后台任务 | `components/BackgroundTasksPanel.tsx` | BackgroundTasksPanel | - | `manage_tasks` |
| 并行任务 | `components/ParallelTasksView.tsx` | ParallelTasksView | - | - |
| 子代理执行 | `hooks/useSubagentExecution.ts` | SubagentManager | useSubagentExecution | - |
| 检查点管理 | `components/CheckpointTimeline.tsx` | CheckpointTimeline | - | `checkpoint_*` |
| 代码折叠 | `hooks/useCodeFolding.ts` | - | useCodeFolding | - |
| 多光标编辑 | `hooks/useMultiCursor.ts` | - | useMultiCursor | - |
| 代码完成 | `hooks/useCompletion.ts` | - | useCompletion | - |

---

## 高级功能

| 功能 | 主要文件 | 相关组件 | 相关 Hook | 说明 |
|------|---------|---------|---------|------|
| 扩展思考 | `hooks/useExtendedThinking.ts` | ThinkingModeSelector | useExtendedThinking | Extended Thinking |
| 思考深度 | `components/ThinkingDepthSelector.tsx` | ThinkingDepthSelector | - | 思考深度选择 |
| 思考可视化 | `components/ThinkingVisualizer.tsx` | ThinkingVisualizer | - | 思考过程可视化 |
| Turbo 模式 | `components/TurboModeSwitch.tsx` | TurboModeSwitch | useTurboMode | 加速模式 |
| 自动压缩 | `hooks/useAutoCompactStatus.ts` | - | useAutoCompactStatus | 上下文压缩 |
| 提示增强 | `lib/promptEnhancementService.ts` | - | - | 提示优化 |
| Skill 触发 | `hooks/useSkillTrigger.ts` | SkillsManager | useSkillTrigger | Skill 自动触发 |
| Skills 管理 | `components/SkillsManager.tsx` | SkillsManager | - | Skills 管理 |

---

## 常见功能修改场景

### 场景 1: "我想添加新的模型支持"
**涉及文件**:
1. `lib/pricing.ts` - 添加模型定价
2. `FloatingPromptInput/ModelSelector.tsx` - 添加模型选项
3. `types/claude.ts` - 添加模型类型定义

### 场景 2: "我想修改消息的显示样式"
**涉及文件**:
1. `message/MessageBubble.tsx` - 修改气泡样式
2. `message/MessageContent.tsx` - 修改内容渲染
3. `src/index.css` - 修改全局样式

### 场景 3: "我想添加新的 Tauri 命令"
**涉及文件**:
1. `src-tauri/src/commands/` - 创建新命令模块
2. `src-tauri/src/main.rs` - 注册命令
3. 前端调用: `import { invoke } from '@tauri-apps/api/core'`

### 场景 4: "我想修改翻译逻辑"
**涉及文件**:
1. `lib/translationMiddleware.ts` - 核心翻译逻辑
2. `components/TranslationSettings.tsx` - 翻译配置 UI
3. `hooks/useMessageTranslation.ts` - 翻译 Hook

### 场景 5: "我想添加新的快捷键"
**涉及文件**:
1. `hooks/useGlobalKeyboardShortcuts.ts` - 全局快捷键
2. `hooks/useKeyboardShortcuts.ts` - 局部快捷键
3. `src-tauri/src/main.rs` - Tauri 全局快捷键注册

---

## 功能依赖流程图

### 用户发送消息流程

```
用户输入
  ↓
FloatingPromptInput/InputArea.tsx
  ↓
usePromptExecution Hook
  ↓
lib/api.ts (API 调用)
  ↓
src-tauri/commands/ (Rust 后端)
  ↓
Claude CLI / Codex / Gemini API
  ↓
lib/stream/SessionConnection.ts (流式处理)
  ↓
useSessionStream Hook
  ↓
message/StreamMessageV2.tsx (渲染)
```

### MCP 服务器通信流程

```
MCPManager.tsx (UI)
  ↓
src-tauri/src/commands/mcp.rs (命令)
  ↓
src-tauri/src/mcp/ (MCP 协议实现)
  ↓
外部 MCP 服务器
```

### 翻译流程

```
message/AIMessage.tsx
  ↓
useMessageTranslation Hook
  ↓
lib/translationMiddleware.ts
  ↓
lib/progressiveTranslation.ts
  ↓
翻译后的双语内容
```

---

**最后更新**: 2025-12-27
**功能模块数**: 15+
