# components/ - React 组件目录

> **85+ React 组件** | 按功能分类组织的可复用组件库

---

## 目录结构

```
components/
├── FloatingPromptInput/   # 用户输入核心 ⭐ (15 文件)
├── message/               # 消息渲染组件 ⭐ (13 文件)
├── layout/                # 布局组件 (4 文件)
├── session/               # 会话管理组件
├── dialogs/               # 对话框组件 (4 文件)
├── editor/                # 编辑器组件
├── settings/              # 设置组件
├── widgets/               # 功能小部件
├── ui/                    # 基础 UI 组件 (Radix UI)
├── icons/                 # 图标组件 (3 文件)
├── common/                # 通用组件 (2 文件)
├── skeletons/             # 加载骨架屏
├── sync/                  # 同步组件
└── *.tsx                  # 顶层组件文件 (50+ 文件)
```

---

## 核心子目录

### 🎯 FloatingPromptInput/ - 用户输入核心
用户输入的核心组件，包含输入框、模型选择、Slash 命令等。
**详细文档**: `FloatingPromptInput/_README.md`

| 文件 | 用途 |
|------|------|
| `index.tsx` | 主组件入口 |
| `InputArea.tsx` | 文本输入区域 |
| `ModelSelector.tsx` | Claude 模型选择器 |
| `SlashCommandMenu.tsx` | Slash 命令菜单 |
| `slashCommands.ts` | 命令配置 |

---

### 💬 message/ - 消息渲染组件
AI 和用户消息的渲染组件。
**详细文档**: `message/_README.md`

| 文件 | 用途 |
|------|------|
| `AIMessage.tsx` | AI 消息渲染 |
| `StreamMessageV2.tsx` | 流式消息渲染 |
| `ToolCallsGroup.tsx` | 工具调用显示 |
| `ThinkingBlock.tsx` | 思考过程显示 |

---

### 📐 layout/ - 布局组件
页面布局的容器组件。
**详细文档**: `layout/_README.md`

| 文件 | 用途 |
|------|------|
| `AppLayout.tsx` | 应用主布局 |
| `ViewRouter.tsx` | 视图路由 |
| `Sidebar.tsx` | 侧边栏 |
| `AppBreadcrumbs.tsx` | 面包屑导航 |

---

### 🗨️ dialogs/ - 对话框组件
弹窗和确认对话框。
**详细文档**: `dialogs/_README.md`

| 文件 | 用途 |
|------|------|
| `AskUserQuestionDialog.tsx` | 询问用户对话框 |
| `PlanApprovalDialog.tsx` | 计划批准对话框 |
| `UpdateDialog.tsx` | 更新对话框 |
| `ClaudeBinaryDialog.tsx` | Claude CLI 对话框 |

---

### 🧩 ui/ - 基础 UI 组件
基于 Radix UI 的无头组件封装。

| 文件 | 用途 |
|------|------|
| `button.tsx` | 按钮组件 |
| `input.tsx` | 输入框 |
| `select.tsx` | 选择框 |
| `dialog.tsx` | 对话框 |
| `dropdown-menu.tsx` | 下拉菜单 |
| `checkbox.tsx` | 复选框 |
| `switch.tsx` | 开关 |
| `slider.tsx` | 滑块 |
| `tabs.tsx` | 标签页 |
| `toast.tsx` | 消息提示 |
| `tooltip.tsx` | 工具提示 |

---

## 顶层组件文件 (50+)

### 会话管理
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `ClaudeCodeSession.tsx` | Claude 会话主组件 | 高 |
| `SessionList.tsx` | 会话列表 | 中 |
| `SessionToolbar.tsx` | 会话工具栏 | 中 |
| `TabManager.tsx` | 标签页管理 | 高 |
| `TabIndicator.tsx` | 标签页指示器 | 低 |
| `TabSessionWrapper.tsx` | 标签会话包装 | 中 |
| `GlobalSessionCenter.tsx` | 全局会话中心 | 中 |
| `RunningClaudeSessions.tsx` | 运行中的会话 | 低 |

### 引擎和 Provider
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `ExecutionEngineSelector.tsx` | 执行引擎选择器 | 高 |
| `ProviderManager.tsx` | Claude Provider 管理 | 高 |
| `CodexProviderManager.tsx` | Codex Provider 管理 | 高 |
| `GeminiProviderManager.tsx` | Gemini Provider 管理 | 高 |
| `ProviderForm.tsx` | Provider 配置表单 | 中 |
| `CodexProviderForm.tsx` | Codex 配置表单 | 中 |
| `GeminiProviderForm.tsx` | Gemini 配置表单 | 中 |
| `UnifiedEngineStatus.tsx` | 统一引擎状态 | 低 |
| `ClaudeStatusIndicator.tsx` | Claude 状态指示器 | 中 |

### MCP 相关
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `MCPManager.tsx` | MCP 服务器管理 | 中 |
| `MCPServerList.tsx` | MCP 服务器列表 | 中 |
| `MCPServerDialog.tsx` | MCP 服务器对话框 | 中 |
| `MCPAddServer.tsx` | 添加 MCP 服务器 | 中 |
| `MCPImportExport.tsx` | MCP 导入导出 | 中 |
| `MCPEnginePanel.tsx` | MCP 引擎面板 | 中 |

### 设置和配置
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `Settings.tsx` | 主设置面板 | 高 |
| `ProjectSettings.tsx` | 项目设置 | 中 |
| `TranslationSettings.tsx` | 翻译设置 | 中 |
| `AutoCompactSettings.tsx` | 自动压缩设置 | 高 |
| `PromptContextConfigSettings.tsx` | 提示上下文配置 | 中 |
| `PromptEnhancementSettings.tsx` | 提示增强设置 | 中 |
| `AcemcpConfigSettings.tsx` | ACEMCP 配置 | 中 |
| `StorageTab.tsx` | 存储管理 | 高 |

### 管理器
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `PluginManager.tsx` | 插件管理器 | 高 |
| `SkillsManager.tsx` | Skills 管理器 | 高 |
| `SubagentManager.tsx` | 子代理管理器 | 中 |
| `ClaudeExtensionsManager.tsx` | 扩展管理器 | 高 |
| `EnhancedHooksManager.tsx` | Hooks 管理器 | 中 |

### 编辑器
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `MarkdownEditor.tsx` | Markdown 编辑器 | 中 |
| `CodexMarkdownEditor.tsx` | Codex 编辑器 | 中 |
| `GeminiMarkdownEditor.tsx` | Gemini 编辑器 | 中 |
| `ClaudeFileEditor.tsx` | Claude 文件编辑器 | 中 |
| `HooksEditor.tsx` | Hooks 编辑器 | 高 |

### 功能组件
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `UsageDashboard.tsx` | 使用统计仪表盘 | 高 |
| `ProjectList.tsx` | 项目列表 | 中 |
| `FilePicker.tsx` | 文件选择器 | 中 |
| `ImagePreview.tsx` | 图片预览 | 中 |
| `WebviewPreview.tsx` | Webview 预览 | 中 |
| `PromptNavigator.tsx` | 提示导航器 | 中 |
| `PromptSearchModal.tsx` | 提示搜索 | 中 |
| `RevertPromptPicker.tsx` | 恢复提示选择 | 中 |
| `BackgroundTasksPanel.tsx` | 后台任务面板 | 中 |
| `ParallelTasksView.tsx` | 并行任务视图 | 中 |
| `CheckpointTimeline.tsx` | 检查点时间线 | 中 |
| `CheckpointDiff.tsx` | 检查点差异 | 中 |
| `GitChangesPanel.tsx` | Git 变更面板 | 中 |
| `ThinkingDepthSelector.tsx` | 思考深度选择 | 中 |
| `ThinkingVisualizer.tsx` | 思考可视化 | 中 |
| `TurboModeSwitch.tsx` | Turbo 模式开关 | 中 |
| `LanguageSelector.tsx` | 语言选择器 | 低 |
| `ClaudeMemoriesDropdown.tsx` | Claude 记忆下拉 | 中 |
| `DeletedProjects.tsx` | 已删除项目 | 中 |
| `ErrorBoundary.tsx` | 错误边界 | 低 |

### Gemini 相关
| 文件 | 用途 | 复杂度 |
|------|------|--------|
| `GeminiSessionManager.tsx` | Gemini 会话管理 | 低 |
| `GeminiSessionHistoryPanel.tsx` | Gemini 历史面板 | 中 |
| `GeminiSessionDetailViewer.tsx` | Gemini 详情查看 | 中 |

---

## 组件开发规范

### 文件结构
```tsx
// 1. 导入
import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// 2. 类型定义
interface MyComponentProps {
  title: string
  onClose?: () => void
}

// 3. 组件定义
export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onClose
}) => {
  // Hooks
  const { t } = useTranslation()
  const [state, setState] = useState(false)

  // 处理函数
  const handleClick = useCallback(() => {
    setState(!state)
  }, [state])

  // 渲染
  return (
    <div className="p-4">
      <h1>{title}</h1>
      <button onClick={handleClick}>{t('button.click')}</button>
    </div>
  )
}
```

### 样式规范
- **优先**: Tailwind CSS 实用类
- **复杂样式**: CSS Modules 或 `clsx` 组合
- **动画**: Framer Motion

### 可访问性
- 使用语义化 HTML
- ARIA 属性
- 键盘导航支持

---

## 常见修改场景

### 修改组件样式
1. 找到组件文件中的 `className`
2. 修改 Tailwind 类名
3. 或在 `src/index.css` 添加自定义样式

### 添加新组件
1. 创建 `MyComponent.tsx` 文件
2. 定义 Props interface
3. 导出组件
4. 在需要的地方导入使用

### 修改现有组件逻辑
1. 找到组件文件
2. 理解 Props 和 State
3. 修改处理函数或渲染逻辑
4. 确保类型正确

---

## 组件依赖关系

```
App.tsx
├── AppLayout
│   ├── Sidebar
│   │   ├── ProjectList
│   │   └── SessionList
│   └── ViewRouter
│       └── ClaudeCodeSession
│           ├── SessionToolbar
│           ├── message/*
│           │   ├── AIMessage
│           │   ├── StreamMessageV2
│           │   └── ToolCallsGroup
│           └── FloatingPromptInput/*
│               ├── InputArea
│               ├── ModelSelector
│               └── SlashCommandMenu
```

---

**最后更新**: 2025-12-27
**组件总数**: 85+
