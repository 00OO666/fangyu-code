# FloatingPromptInput/ - 用户输入核心组件

> **用户与 AI 交互的入口** | 输入框、模型选择、Slash 命令

---

## 概述

FloatingPromptInput 是 Fangyu Code 的核心输入组件，位于页面底部，提供：

- 多行文本输入
- 文件和图片附件
- Slash 命令系统
- 模型选择（Claude/Codex/Gemini）
- 扩展思考模式

---

## 目录结构

```
FloatingPromptInput/
├── index.tsx                    # 主组件入口
├── InputArea.tsx                # 文本输入区域 ⭐
├── ModelSelector.tsx            # Claude 模型选择器 ⭐
├── CodexModelSelector.tsx       # Codex 模型选择器
├── GeminiModelSelector.tsx      # Gemini 模型选择器
├── SlashCommandMenu.tsx         # Slash 命令菜单 ⭐
├── slashCommands.ts             # Slash 命令配置 ⭐
├── geminiSlashCommands.ts       # Gemini Slash 命令
├── ThinkingModeSelector.tsx     # 思考模式选择器
├── ThinkingModeToggle.tsx       # 思考模式开关
├── ThinkingModeIndicator.tsx    # 思考模式指示器
├── PlanModeToggle.tsx           # 计划模式开关
├── ExpandedModal.tsx            # 扩展输入模态框
├── AttachmentPreview.tsx        # 附件预览
├── CodexReasoningLevelSelector.tsx  # Codex 推理等级
├── CodexRateLimitBadge.tsx      # Codex 速率限制标识
├── defaultModelStorage.ts       # 默认模型存储
├── reducer.ts                   # 状态管理 Reducer
├── types.ts                     # 类型定义
├── constants.tsx                # 常量定义
├── README.md                    # 官方文档
├── hooks/                       # 组件专用 Hook
│   ├── useCustomSlashCommands.ts    # 自定义 Slash 命令
│   ├── useDraftPersistence.ts       # 草稿持久化
│   ├── useDraftPromptSync.ts        # 草稿同步
│   ├── useFileSelection.ts          # 文件选择
│   ├── useImageHandling.ts          # 图片处理
│   ├── usePromptEnhancement.ts      # 提示增强
│   ├── usePromptSuggestion.ts       # 提示建议
│   └── useSlashCommandMenu.ts       # Slash 菜单逻辑
└── components/                  # 子组件
    └── SuggestionOverlay.tsx    # 建议覆盖层
```

---

## 核心文件详解

### index.tsx - 主组件入口

**用途**: 整合所有子组件，提供完整的输入界面

**主要功能**:

- 组合 InputArea、模型选择器、Slash 命令菜单
- 处理输入提交
- 管理附件状态
- 集成扩展思考模式

**关键代码位置**:

- 输入提交: `handleSubmit` 函数
- 状态管理: `useReducer` 配合 `reducer.ts`

---

### InputArea.tsx - 文本输入区域

**用途**: 用户输入文本的核心区域

**主要功能**:

- 多行文本输入
- 自动调整高度
- 支持 Ctrl+Enter 提交
- 占位符文本
- 输入验证

**视觉描述**:

- 位置: 页面底部
- 外观: 白色/深色背景，圆角边框
- 交互: 输入时自动扩展高度

**使用示例**:

```tsx
<InputArea
  value={input}
  onChange={handleChange}
  onSubmit={handleSubmit}
  placeholder="输入消息..."
/>
```

---

### ModelSelector.tsx - Claude 模型选择器

**用途**: 选择 Claude 模型（Opus/Sonnet/Haiku）

**主要功能**:

- 下拉菜单选择模型
- 显示当前选中模型
- 保存模型偏好

**视觉描述**:

- 位置: 输入框左侧
- 外观: 下拉按钮，显示模型名称
- 交互: 点击展开模型列表

**修改模型列表**:
在组件中找到 `models` 数组，添加新模型配置：

```tsx
const models = [
  { id: "claude-opus-4", name: "Opus 4", description: "最强大的模型" },
  { id: "claude-sonnet-4", name: "Sonnet 4", description: "平衡模型" },
  { id: "claude-haiku-4", name: "Haiku 4", description: "最快模型" },
];
```

---

### SlashCommandMenu.tsx - Slash 命令菜单

**用途**: 显示和执行 Slash 命令

**主要功能**:

- 输入 `/` 触发菜单
- 搜索过滤命令
- 键盘导航
- 命令分类显示

**视觉描述**:

- 位置: 输入框上方弹出
- 外观: 浮动菜单，带搜索框
- 交互: 输入过滤，方向键选择，Enter 执行

**触发方式**: 输入框中输入 `/`

---

### slashCommands.ts - Slash 命令配置

**用途**: 定义所有 Slash 命令

**命令结构**:

```typescript
interface SlashCommand {
  name: string; // 命令名称（/commit）
  description: string; // 命令描述
  category: string; // 命令分类
  icon?: ReactNode; // 命令图标
  action: (args: string) => Promise<void>; // 执行函数
}
```

**添加新命令**:

```typescript
// 在 commands 数组中添加
{
  name: 'my-command',
  description: '我的自定义命令',
  category: 'custom',
  icon: <MyIcon />,
  action: async (args) => {
    // 命令逻辑
  }
}
```

**现有命令分类**:

- `session`: 会话相关（/clear, /compact）
- `file`: 文件操作（/add-file, /read-file）
- `git`: Git 操作（/commit, /status）
- `tool`: 工具命令（/search, /shell）
- `mode`: 模式切换（/plan, /think）

---

## Hooks 详解

### useCustomSlashCommands.ts

自定义 Slash 命令的管理

### useDraftPersistence.ts

草稿内容持久化到 localStorage

### useFileSelection.ts

处理文件选择对话框

### useImageHandling.ts

处理图片附件的上传和预览

### usePromptEnhancement.ts

提示增强功能

### useSlashCommandMenu.ts

Slash 命令菜单的显示/隐藏逻辑

---

## 常见修改场景

### 场景 1: 添加新的 Slash 命令

**文件**: `slashCommands.ts`
**步骤**:

1. 打开 `slashCommands.ts`
2. 在 `commands` 数组中添加新命令对象
3. 定义 `action` 函数实现命令逻辑

### 场景 2: 修改输入框样式

**文件**: `InputArea.tsx`
**步骤**:

1. 找到 `className` 属性
2. 修改 Tailwind CSS 类名

### 场景 3: 添加新的模型选项

**文件**: `ModelSelector.tsx`
**步骤**:

1. 找到模型列表数组
2. 添加新模型配置
3. 在 `lib/pricing.ts` 中添加定价

### 场景 4: 修改 Slash 命令菜单样式

**文件**: `SlashCommandMenu.tsx`
**步骤**:

1. 找到菜单容器的 `className`
2. 修改样式类名

### 场景 5: 修改思考模式选项

**文件**: `ThinkingModeSelector.tsx`
**步骤**:

1. 找到思考模式选项数组
2. 修改或添加选项

---

## 视觉定位

```
┌─────────────────────────────────────────────────────────┐
│                     主内容区域                          │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ SlashCommandMenu (输入 / 时弹出)                    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [ModelSelector] [InputArea................] [Send]  │ │
│ │                                                     │ │
│ │ [ThinkingModeToggle] [PlanModeToggle] [Attachments]│ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 组件 Props

### FloatingPromptInput (index.tsx)

| 属性      | 类型                     | 必填 | 说明        |
| --------- | ------------------------ | ---- | ----------- |
| sessionId | string                   | 是   | 当前会话 ID |
| onSubmit  | (prompt: string) => void | 是   | 提交回调    |
| isLoading | boolean                  | 否   | 加载状态    |
| disabled  | boolean                  | 否   | 禁用状态    |

### InputArea

| 属性        | 类型                    | 必填 | 说明       |
| ----------- | ----------------------- | ---- | ---------- |
| value       | string                  | 是   | 输入值     |
| onChange    | (value: string) => void | 是   | 值变化回调 |
| onSubmit    | () => void              | 是   | 提交回调   |
| placeholder | string                  | 否   | 占位文本   |
| disabled    | boolean                 | 否   | 禁用状态   |

### ModelSelector

| 属性     | 类型                    | 必填 | 说明         |
| -------- | ----------------------- | ---- | ------------ |
| value    | string                  | 是   | 当前选中模型 |
| onChange | (model: string) => void | 是   | 模型变化回调 |
| disabled | boolean                 | 否   | 禁用状态     |

---

## 状态管理

组件使用 `useReducer` 管理复杂状态：

```typescript
// reducer.ts
interface State {
  input: string
  attachments: Attachment[]
  isExpanded: boolean
  selectedModel: string
  thinkingMode: ThinkingMode
  planMode: boolean
}

type Action =
  | { type: 'SET_INPUT', payload: string }
  | { type: 'ADD_ATTACHMENT', payload: Attachment }
  | { type: 'TOGGLE_EXPANDED' }
  | { type: 'SET_MODEL', payload: string }
  | // ...
```

---

## 快捷键

| 快捷键          | 功能                |
| --------------- | ------------------- |
| `Enter`         | 发送消息            |
| `Shift + Enter` | 换行                |
| `Ctrl + Enter`  | 发送消息（备选）    |
| `/`             | 打开 Slash 命令菜单 |
| `Escape`        | 关闭菜单/取消       |
| `↑ / ↓`         | Slash 菜单导航      |

---

**最后更新**: 2025-12-27
**文件数**: 15+ 核心文件
