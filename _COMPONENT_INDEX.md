# UI 组件完整索引

> **Fangyu Code 组件导航** | 85+ React 组件快速查找

---

## 目录

- [布局组件](#布局组件) - 页面结构
- [用户输入组件](#用户输入组件) - 提示输入和控制
- [消息渲染组件](#消息渲染组件) - AI 消息显示
- [会话管理组件](#会话管理组件) - 会话控制
- [对话框组件](#对话框组件) - 弹窗和确认框
- [编辑器组件](#编辑器组件) - 代码和文本编辑
- [设置组件](#设置组件) - 配置和偏好设置
- [管理器组件](#管理器组件) - 资源管理
- [功能组件](#功能组件) - 特定功能实现
- [UI 基础组件](#ui-基础组件) - 可复用的基础组件
- [图标组件](#图标组件) - 图标集
- [其他组件](#其他组件) - 工具和辅助组件

---

## 布局组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **AppLayout** | `src/components/layout/AppLayout.tsx` | 应用主布局容器 | 整个窗口的容器，包含侧边栏和主内容区 |
| **ViewRouter** | `src/components/layout/ViewRouter.tsx` | 视图路由器 | 根据导航状态切换不同视图 |
| **Sidebar** | `src/components/layout/Sidebar.tsx` | 侧边栏导航 | 左侧边栏，包含项目列表、会话列表、设置入口 |
| **AppBreadcrumbs** | `src/components/layout/AppBreadcrumbs.tsx` | 面包屑导航 | 顶部面包屑，显示当前路径 |

**相关目录**: `src/components/layout/`

---

## 用户输入组件

### FloatingPromptInput (核心输入系统)

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **FloatingPromptInput** | `src/components/FloatingPromptInput/index.tsx` | 浮动提示输入主组件 | 页面底部的输入框，支持多行、附件、Slash 命令 |
| **InputArea** | `src/components/FloatingPromptInput/InputArea.tsx` | 文本输入区域 | 可展开的文本输入框 |
| **ModelSelector** | `src/components/FloatingPromptInput/ModelSelector.tsx` | Claude 模型选择器 | 下拉菜单，选择 Claude 模型（Opus/Sonnet/Haiku） |
| **CodexModelSelector** | `src/components/FloatingPromptInput/CodexModelSelector.tsx` | Codex 模型选择器 | 下拉菜单，选择 OpenAI Codex 模型 |
| **GeminiModelSelector** | `src/components/FloatingPromptInput/GeminiModelSelector.tsx` | Gemini 模型选择器 | 下拉菜单，选择 Google Gemini 模型 |
| **SlashCommandMenu** | `src/components/FloatingPromptInput/SlashCommandMenu.tsx` | Slash 命令菜单 | 输入 `/` 时弹出的命令选择菜单 |
| **ThinkingModeSelector** | `src/components/FloatingPromptInput/ThinkingModeSelector.tsx` | 思考模式选择器 | 选择扩展思考模式 |
| **ThinkingModeToggle** | `src/components/FloatingPromptInput/ThinkingModeToggle.tsx` | 思考模式开关 | 切换思考模式的按钮 |
| **ThinkingModeIndicator** | `src/components/FloatingPromptInput/ThinkingModeIndicator.tsx` | 思考模式指示器 | 显示当前思考模式状态 |
| **PlanModeToggle** | `src/components/FloatingPromptInput/PlanModeToggle.tsx` | 计划模式开关 | 启用/禁用计划模式 |
| **ExpandedModal** | `src/components/FloatingPromptInput/ExpandedModal.tsx` | 扩展输入模态框 | 全屏输入模式 |
| **AttachmentPreview** | `src/components/FloatingPromptInput/AttachmentPreview.tsx` | 附件预览 | 显示上传的文件和图片 |
| **CodexReasoningLevelSelector** | `src/components/FloatingPromptInput/CodexReasoningLevelSelector.tsx` | Codex 推理等级选择器 | 选择 Codex 的推理深度 |
| **CodexRateLimitBadge** | `src/components/FloatingPromptInput/CodexRateLimitBadge.tsx` | Codex 速率限制标识 | 显示 API 速率限制状态 |
| **SuggestionOverlay** | `src/components/FloatingPromptInput/components/SuggestionOverlay.tsx` | 提示建议覆盖层 | 自动补全建议 |

**相关文件**:
- 配置: `slashCommands.ts`, `geminiSlashCommands.ts`
- Hooks: `hooks/useCustomSlashCommands.ts`, `hooks/useDraftPersistence.ts`
- 详细文档: `src/components/FloatingPromptInput/_README.md`

---

## 消息渲染组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **AIMessage** | `src/components/message/AIMessage.tsx` | AI 消息渲染 | AI 回复的消息气泡，包含 Markdown、代码高亮 |
| **StreamMessageV2** | `src/components/message/StreamMessageV2.tsx` | 流式消息渲染 V2 | 实时流式渲染 AI 回复 |
| **MessageBubble** | `src/components/message/MessageBubble.tsx` | 消息气泡容器 | 消息的容器，包含头像、边框、背景 |
| **MessageContent** | `src/components/message/MessageContent.tsx` | 消息内容渲染 | Markdown 内容渲染器 |
| **MessageHeader** | `src/components/message/MessageHeader.tsx` | 消息头部 | 显示发送者、时间戳 |
| **MessageActions** | `src/components/message/MessageActions.tsx` | 消息操作按钮 | 复制、编辑、删除等按钮 |
| **MessageImagePreview** | `src/components/message/MessageImagePreview.tsx` | 消息图片预览 | 显示消息中的图片 |
| **ToolCallsGroup** | `src/components/message/ToolCallsGroup.tsx` | 工具调用组 | 显示 AI 使用的工具调用 |
| **ThinkingBlock** | `src/components/message/ThinkingBlock.tsx` | 思考块 | 显示 AI 的思考过程 |
| **SubagentMessageGroup** | `src/components/message/SubagentMessageGroup.tsx` | 子代理消息组 | 显示子代理的消息 |
| **SummaryMessage** | `src/components/message/SummaryMessage.tsx` | 摘要消息 | 会话摘要显示 |
| **SystemMessage** | `src/components/message/SystemMessage.tsx` | 系统消息 | 系统提示信息 |
| **ResultMessage** | `src/components/message/ResultMessage.tsx` | 结果消息 | 显示命令执行结果 |

**相关目录**: `src/components/message/`

---

## 会话管理组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **ClaudeCodeSession** | `src/components/ClaudeCodeSession.tsx` | Claude Code 会话主组件 | 会话窗口的主容器 |
| **SessionList** | `src/components/SessionList.tsx` | 会话列表 | 左侧边栏的会话列表 |
| **SessionToolbar** | `src/components/SessionToolbar.tsx` | 会话工具栏 | 顶部工具栏，包含会话控制按钮 |
| **SessionHeader** | `src/components/session/SessionHeader.tsx` | 会话头部 | 会话标题和元信息 |
| **SessionFooter** | `src/components/session/SessionFooter.tsx` | 会话底部 | 会话底部信息 |
| **TabIndicator** | `src/components/TabIndicator.tsx` | 标签页指示器 | 显示当前标签页状态 |
| **TabManager** | `src/components/TabManager.tsx` | 标签页管理器 | 管理多个会话标签页 |
| **TabSessionWrapper** | `src/components/TabSessionWrapper.tsx` | 标签页会话包装器 | 标签页中的会话包装组件 |
| **GlobalSessionCenter** | `src/components/GlobalSessionCenter.tsx` | 全局会话中心 | 跨标签页的会话管理 |
| **RunningClaudeSessions** | `src/components/RunningClaudeSessions.tsx` | 运行中的 Claude 会话 | 显示正在运行的会话 |

**相关目录**: `src/components/session/`

---

## 对话框组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **AskUserQuestionDialog** | `src/components/dialogs/AskUserQuestionDialog.tsx` | 询问用户对话框 | AI 询问用户选择的弹窗 |
| **ClaudeBinaryDialog** | `src/components/dialogs/ClaudeBinaryDialog.tsx` | Claude 二进制文件对话框 | 设置 Claude CLI 路径 |
| **PlanApprovalDialog** | `src/components/dialogs/PlanApprovalDialog.tsx` | 计划批准对话框 | 批准 AI 生成的计划 |
| **UpdateDialog** | `src/components/dialogs/UpdateDialog.tsx` | 更新对话框 | 应用更新提示 |

**相关目录**: `src/components/dialogs/`

---

## 编辑器组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **MarkdownEditor** | `src/components/MarkdownEditor.tsx` | Markdown 编辑器 | 通用 Markdown 编辑器 |
| **CodexMarkdownEditor** | `src/components/CodexMarkdownEditor.tsx` | Codex Markdown 编辑器 | Codex 专用编辑器 |
| **GeminiMarkdownEditor** | `src/components/GeminiMarkdownEditor.tsx` | Gemini Markdown 编辑器 | Gemini 专用编辑器 |
| **ClaudeFileEditor** | `src/components/ClaudeFileEditor.tsx` | Claude 文件编辑器 | Claude 配置文件编辑器 |
| **HooksEditor** | `src/components/HooksEditor.tsx` | Hooks 编辑器 | 编辑 Claude Hooks 配置 |

**相关目录**: `src/components/editor/`

---

## 设置组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **Settings** | `src/components/Settings.tsx` | 主设置面板 | 应用设置的主容器 |
| **ProjectSettings** | `src/components/ProjectSettings.tsx` | 项目设置 | 当前项目的配置 |
| **PromptContextConfigSettings** | `src/components/PromptContextConfigSettings.tsx` | 提示上下文配置 | 上下文窗口配置 |
| **PromptEnhancementSettings** | `src/components/PromptEnhancementSettings.tsx` | 提示增强设置 | 提示增强功能配置 |
| **TranslationSettings** | `src/components/TranslationSettings.tsx` | 翻译设置 | 翻译功能配置 |
| **AutoCompactSettings** | `src/components/AutoCompactSettings.tsx` | 自动压缩设置 | 自动上下文压缩配置 |
| **AcemcpConfigSettings** | `src/components/AcemcpConfigSettings.tsx` | ACEMCP 配置设置 | ACEMCP 协议配置 |

**相关目录**: `src/components/settings/`

---

## 管理器组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **ProviderManager** | `src/components/ProviderManager.tsx` | Provider 管理器 | 管理 Claude API Provider |
| **CodexProviderManager** | `src/components/CodexProviderManager.tsx` | Codex Provider 管理器 | 管理 Codex API Provider |
| **GeminiProviderManager** | `src/components/GeminiProviderManager.tsx` | Gemini Provider 管理器 | 管理 Gemini API Provider |
| **MCPManager** | `src/components/MCPManager.tsx` | MCP 管理器 | Model Context Protocol 管理 |
| **MCPServerList** | `src/components/MCPServerList.tsx` | MCP 服务器列表 | 显示和管理 MCP 服务器 |
| **MCPServerDialog** | `src/components/MCPServerDialog.tsx` | MCP 服务器对话框 | 添加/编辑 MCP 服务器 |
| **MCPAddServer** | `src/components/MCPAddServer.tsx` | MCP 添加服务器 | 添加新的 MCP 服务器 |
| **MCPImportExport** | `src/components/MCPImportExport.tsx` | MCP 导入导出 | 导入导出 MCP 配置 |
| **MCPEnginePanel** | `src/components/MCPEnginePanel.tsx` | MCP 引擎面板 | MCP 引擎控制面板 |
| **ClaudeExtensionsManager** | `src/components/ClaudeExtensionsManager.tsx` | Claude 扩展管理器 | 管理 Claude 扩展 |
| **EnhancedHooksManager** | `src/components/EnhancedHooksManager.tsx` | 增强 Hooks 管理器 | 管理增强 Hooks |
| **PluginManager** | `src/components/PluginManager.tsx` | 插件管理器 | 管理应用插件 |
| **SubagentManager** | `src/components/SubagentManager.tsx` | 子代理管理器 | 管理 AI 子代理 |
| **SkillsManager** | `src/components/SkillsManager.tsx` | Skills 管理器 | 管理 Claude Skills |

---

## 功能组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **ExecutionEngineSelector** | `src/components/ExecutionEngineSelector.tsx` | 执行引擎选择器 | 选择 Claude/Codex/Gemini 引擎 |
| **ProjectList** | `src/components/ProjectList.tsx` | 项目列表 | 显示所有项目 |
| **DeletedProjects** | `src/components/DeletedProjects.tsx` | 已删除项目 | 显示回收站中的项目 |
| **FilePicker** | `src/components/FilePicker.tsx` | 文件选择器 | 选择文件对话框 |
| **ImagePreview** | `src/components/ImagePreview.tsx` | 图片预览 | 预览图片文件 |
| **WebviewPreview** | `src/components/WebviewPreview.tsx` | Webview 预览 | 在应用内预览网页 |
| **PromptNavigator** | `src/components/PromptNavigator.tsx` | 提示导航器 | 导航历史提示 |
| **PromptSearchModal** | `src/components/PromptSearchModal.tsx` | 提示搜索模态框 | 搜索历史提示 |
| **RevertPromptPicker** | `src/components/RevertPromptPicker.tsx` | 恢复提示选择器 | 恢复到历史提示 |
| **ClaudeStatusIndicator** | `src/components/ClaudeStatusIndicator.tsx` | Claude 状态指示器 | 显示 Claude 连接状态 |
| **UnifiedEngineStatus** | `src/components/UnifiedEngineStatus.tsx` | 统一引擎状态 | 显示所有引擎状态 |
| **UsageDashboard** | `src/components/UsageDashboard.tsx` | 使用统计仪表盘 | Token 和成本统计 |
| **StorageTab** | `src/components/StorageTab.tsx` | 存储标签页 | 存储管理和清理 |
| **LanguageSelector** | `src/components/LanguageSelector.tsx` | 语言选择器 | 切换界面语言 |
| **ClaudeMemoriesDropdown** | `src/components/ClaudeMemoriesDropdown.tsx` | Claude 记忆下拉菜单 | 管理 Claude 记忆 |
| **BackgroundTasksPanel** | `src/components/BackgroundTasksPanel.tsx` | 后台任务面板 | 显示后台运行的任务 |
| **ParallelTasksView** | `src/components/ParallelTasksView.tsx` | 并行任务视图 | 显示并行执行的任务 |
| **CheckpointTimeline** | `src/components/CheckpointTimeline.tsx` | 检查点时间线 | 显示会话检查点 |
| **CheckpointDiff** | `src/components/CheckpointDiff.tsx` | 检查点差异 | 对比检查点之间的差异 |
| **GitChangesPanel** | `src/components/GitChangesPanel.tsx` | Git 变更面板 | 显示 Git 文件变更 |
| **ThinkingDepthSelector** | `src/components/ThinkingDepthSelector.tsx` | 思考深度选择器 | 选择思考深度级别 |
| **ThinkingVisualizer** | `src/components/ThinkingVisualizer.tsx` | 思考可视化 | 可视化思考过程 |
| **TurboModeSwitch** | `src/components/TurboModeSwitch.tsx` | Turbo 模式开关 | 启用/禁用加速模式 |

---

## UI 基础组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **Button** | `src/components/ui/button.tsx` | 按钮 | 可复用按钮组件（基于 Radix UI） |
| **Input** | `src/components/ui/input.tsx` | 输入框 | 文本输入框 |
| **Select** | `src/components/ui/select.tsx` | 选择框 | 下拉选择框 |
| **Dialog** | `src/components/ui/dialog.tsx` | 对话框 | 模态对话框 |
| **Dropdown** | `src/components/ui/dropdown-menu.tsx` | 下拉菜单 | 下拉菜单组件 |
| **Checkbox** | `src/components/ui/checkbox.tsx` | 复选框 | 复选框组件 |
| **RadioGroup** | `src/components/ui/radio-group.tsx` | 单选组 | 单选按钮组 |
| **Switch** | `src/components/ui/switch.tsx` | 开关 | 切换开关 |
| **Slider** | `src/components/ui/slider.tsx` | 滑块 | 数值滑块 |
| **Tooltip** | `src/components/ui/tooltip.tsx` | 工具提示 | 悬停提示 |
| **Toast** | `src/components/ui/toast.tsx` | 消息提示 | 临时消息通知 |
| **Separator** | `src/components/ui/separator.tsx` | 分隔符 | 分隔线 |
| **Label** | `src/components/ui/label.tsx` | 标签 | 表单标签 |
| **Tabs** | `src/components/ui/tabs.tsx` | 标签页 | 标签页组件 |
| **Popover** | `src/components/ui/popover.tsx` | 弹出层 | 弹出内容层 |

**相关目录**: `src/components/ui/`

---

## 图标组件

| 组件名 | 文件路径 | 用途 |
|-------|---------|------|
| **ClaudeIcon** | `src/components/icons/ClaudeIcon.tsx` | Claude 图标 |
| **CodexIcon** | `src/components/icons/CodexIcon.tsx` | Codex 图标 |
| **GeminiIcon** | `src/components/icons/GeminiIcon.tsx` | Gemini 图标 |

**相关目录**: `src/components/icons/`
**其他图标**: 使用 `lucide-react` 图标库

---

## 其他组件

| 组件名 | 文件路径 | 用途 | 视觉描述 |
|-------|---------|------|---------|
| **ErrorBoundary** | `src/components/ErrorBoundary.tsx` | 错误边界 | 捕获组件错误 |
| **ErrorDisplay** | `src/components/common/ErrorDisplay.tsx` | 错误显示 | 显示错误信息 |
| **UpdateBadge** | `src/components/common/UpdateBadge.tsx` | 更新标识 | 显示更新提示 |
| **ToolWidgets** | `src/components/ToolWidgets.tsx` | 工具小部件 | 工具栏小部件容器 |
| **ProviderForm** | `src/components/ProviderForm.tsx` | Provider 表单 | API Provider 配置表单 |
| **CodexProviderForm** | `src/components/CodexProviderForm.tsx` | Codex Provider 表单 | Codex API 配置表单 |
| **GeminiProviderForm** | `src/components/GeminiProviderForm.tsx` | Gemini Provider 表单 | Gemini API 配置表单 |
| **GeminiSessionDetailViewer** | `src/components/GeminiSessionDetailViewer.tsx` | Gemini 会话详情查看器 | 查看 Gemini 会话详情 |
| **GeminiSessionHistoryPanel** | `src/components/GeminiSessionHistoryPanel.tsx` | Gemini 会话历史面板 | 显示 Gemini 会话历史 |
| **GeminiSessionManager** | `src/components/GeminiSessionManager.tsx` | Gemini 会话管理器 | 管理 Gemini 会话 |

---

## 骨架屏组件

加载状态的骨架屏组件位于 `src/components/skeletons/`

---

## 视觉定位参考

### 页面区域划分

```
┌─────────────────────────────────────────────────────────┐
│ SessionToolbar (顶部工具栏)                              │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ Side   │   Main Content Area                           │
│ bar    │   (ClaudeCodeSession)                         │
│        │                                                │
│ (会话  │   - AIMessage                                  │
│  列表) │   - StreamMessageV2                            │
│        │   - ToolCallsGroup                             │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ FloatingPromptInput (底部输入框)                         │
│   - InputArea                                           │
│   - ModelSelector                                       │
│   - SlashCommandMenu                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 常见组件查找场景

| 需求 | 组件路径 | 说明 |
|------|---------|------|
| 修改输入框样式 | `FloatingPromptInput/InputArea.tsx` | 底部输入框 |
| 修改消息气泡 | `message/MessageBubble.tsx` | 消息容器样式 |
| 修改代码高亮 | `message/MessageContent.tsx` | Markdown 渲染器 |
| 修改模型下拉菜单 | `FloatingPromptInput/ModelSelector.tsx` | 模型选择 UI |
| 修改侧边栏 | `layout/Sidebar.tsx` | 左侧导航栏 |
| 修改工具栏 | `SessionToolbar.tsx` | 顶部工具栏 |
| 修改设置面板 | `Settings.tsx` | 设置主入口 |
| 修改 MCP 管理 | `MCPManager.tsx` | MCP 管理界面 |
| 修改 Hooks 编辑器 | `HooksEditor.tsx` | Hooks 配置编辑 |
| 修改插件管理器 | `PluginManager.tsx` | 插件列表和配置 |

---

## 组件开发规范

### 命名约定
- **组件文件**: PascalCase（如 `MyComponent.tsx`）
- **Hook 文件**: camelCase with `use` prefix（如 `useMyHook.ts`）
- **类型文件**: PascalCase（如 `MyTypes.ts`）

### 组件结构
```tsx
// 1. 导入
import { useState } from 'react'

// 2. 类型定义
interface MyComponentProps {
  title: string
}

// 3. 组件定义
export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return <div>{title}</div>
}
```

### 样式方案
- **优先**: Tailwind CSS 实用类
- **其次**: CSS Modules（`*.module.css`）
- **避免**: 内联样式（除非必要）

### 可访问性
- 所有交互元素需要键盘支持
- 使用 ARIA 属性
- 遵循 Radix UI 的可访问性模式

---

**最后更新**: 2025-12-27
**组件总数**: 85+
