# hooks/ - 自定义 Hook 库

> **35 个自定义 React Hook** | 业务逻辑复用层

---

## 概述

hooks/ 目录包含 Fangyu Code 的所有自定义 React Hook，实现：

- 会话和消息管理
- AI 引擎状态
- 翻译和国际化
- 成本追踪
- 插件系统
- 编辑器增强

---

## Hook 分类索引

### ⭐ 核心 Hook（最常用）

| Hook                      | 文件                       | 用途                         | 复杂度 |
| ------------------------- | -------------------------- | ---------------------------- | ------ |
| **useSessionStream**      | `useSessionStream.ts`      | 流式消息处理核心             | 高     |
| **useSmartSession**       | `useSmartSession.ts`       | 智能会话管理                 | 高     |
| **usePromptExecution**    | `usePromptExecution.ts`    | 提示执行引擎                 | 高     |
| **useTabs**               | `useTabs.ts`               | 标签页管理（含 TabProvider） | 中     |
| **useMessageTranslation** | `useMessageTranslation.ts` | 消息翻译                     | 中     |

---

### 会话管理 Hook

| Hook                      | 文件                           | 用途         |
| ------------------------- | ------------------------------ | ------------ |
| useSessionStream          | `useSessionStream.ts`          | 流式消息处理 |
| useSmartSession           | `useSmartSession.ts`           | 智能会话管理 |
| useSessionSync            | `useSessionSync.ts`            | 会话同步     |
| useSessionActivityStatus  | `useSessionActivityStatus.ts`  | 会话活动状态 |
| useSessionCostCalculation | `useSessionCostCalculation.ts` | 会话成本计算 |

---

### 消息处理 Hook

| Hook                   | 文件                        | 用途           |
| ---------------------- | --------------------------- | -------------- |
| useDisplayableMessages | `useDisplayableMessages.ts` | 可显示消息过滤 |
| useGroupedMessages     | `useGroupedMessages.ts`     | 消息分组       |
| useMessageTranslation  | `useMessageTranslation.ts`  | 消息翻译       |
| useToolResults         | `useToolResults.ts`         | 工具结果提取   |
| useMentionParser       | `useMentionParser.ts`       | @提及解析      |

---

### AI 引擎 Hook

| Hook                 | 文件                      | 用途           |
| -------------------- | ------------------------- | -------------- |
| useEngineStatus      | `useEngineStatus.ts`      | 引擎状态监控   |
| useExtendedThinking  | `useExtendedThinking.ts`  | 扩展思考模式   |
| useTurboMode         | `useTurboMode.ts`         | Turbo 加速模式 |
| useSubagentExecution | `useSubagentExecution.ts` | 子代理执行     |
| useSkillTrigger      | `useSkillTrigger.ts`      | Skill 自动触发 |

---

### 插件系统 Hook

| Hook                 | 文件                      | 用途          |
| -------------------- | ------------------------- | ------------- |
| usePluginLoader      | `usePluginLoader.ts`      | 插件动态加载  |
| usePluginMarketplace | `usePluginMarketplace.ts` | 插件市场      |
| useHookChain         | `useHookChain.ts`         | Hook 链式调用 |

---

### UI 和交互 Hook

| Hook                       | 文件                            | 用途           |
| -------------------------- | ------------------------------- | -------------- |
| useSmartAutoScroll         | `useSmartAutoScroll.ts`         | 智能自动滚动   |
| useSmartTabTitle           | `useSmartTabTitle.ts`           | 智能标签页标题 |
| useTypewriter              | `useTypewriter.ts`              | 打字机效果     |
| useGlobalKeyboardShortcuts | `useGlobalKeyboardShortcuts.ts` | 全局快捷键     |
| useKeyboardShortcuts       | `useKeyboardShortcuts.ts`       | 局部快捷键     |

---

### 编辑器增强 Hook

| Hook           | 文件                | 用途       |
| -------------- | ------------------- | ---------- |
| useCodeFolding | `useCodeFolding.ts` | 代码折叠   |
| useMultiCursor | `useMultiCursor.ts` | 多光标编辑 |
| useCompletion  | `useCompletion.ts`  | 代码完成   |

---

### 系统和工具 Hook

| Hook                  | 文件                       | 用途             |
| --------------------- | -------------------------- | ---------------- |
| useContextWindowUsage | `useContextWindowUsage.ts` | 上下文窗口使用率 |
| useAutoCompactStatus  | `useAutoCompactStatus.ts`  | 自动压缩状态     |
| useGitAutoCommit      | `useGitAutoCommit.ts`      | Git 自动提交     |
| useUpdateCheck        | `useUpdateCheck.ts`        | 检查更新         |
| useGlobalEvents       | `useGlobalEvents.ts`       | 全局事件监听     |
| useTaskNotifications  | `useTaskNotifications.ts`  | 任务通知         |
| useWebSocket          | `useWebSocket.ts`          | WebSocket 连接   |
| useTranslation        | `useTranslation.ts`        | i18n 翻译封装    |

---

## 核心 Hook 详解

### useSessionStream - 流式消息处理

**用途**: 处理 Claude/Codex/Gemini 的流式响应

**返回值**:

```typescript
interface UseSessionStreamReturn {
  messages: Message[]; // 消息列表
  isStreaming: boolean; // 是否正在流式传输
  streamContent: string; // 当前流内容
  error: Error | null; // 错误信息
  startStream: (prompt: string) => Promise<void>; // 开始流
  stopStream: () => void; // 停止流
  clearMessages: () => void; // 清空消息
}
```

**使用示例**:

```tsx
const { messages, isStreaming, startStream, stopStream } = useSessionStream({
  sessionId: "session-123",
  engine: "claude",
});

// 发送消息
await startStream("帮我写一个函数");

// 停止流式传输
stopStream();
```

---

### useSmartSession - 智能会话管理

**用途**: 管理会话的创建、加载、保存

**返回值**:

```typescript
interface UseSmartSessionReturn {
  session: Session | null; // 当前会话
  isLoading: boolean; // 加载状态
  createSession: () => Promise<Session>; // 创建会话
  loadSession: (id: string) => Promise<void>; // 加载会话
  saveSession: () => Promise<void>; // 保存会话
  deleteSession: () => Promise<void>; // 删除会话
}
```

---

### usePromptExecution - 提示执行引擎

**用途**: 执行用户输入的提示

**返回值**:

```typescript
interface UsePromptExecutionReturn {
  execute: (prompt: string, options?: Options) => Promise<void>;
  isExecuting: boolean;
  cancelExecution: () => void;
  lastResult: ExecutionResult | null;
}
```

---

### useTabs - 标签页管理

**用途**: 管理多标签页会话

**返回值**:

```typescript
interface UseTabsReturn {
  tabs: Tab[]; // 所有标签页
  activeTab: Tab | null; // 当前活动标签
  addTab: () => void; // 添加标签
  removeTab: (id: string) => void; // 移除标签
  switchTab: (id: string) => void; // 切换标签
  reorderTabs: (from: number, to: number) => void; // 重排序
}
```

**提供 Context**:

```tsx
import { TabProvider, useTabs } from "@/hooks/useTabs";

// 在 App.tsx 中
<TabProvider>
  <App />
</TabProvider>;

// 在组件中使用
const { tabs, addTab, removeTab } = useTabs();
```

---

### useMessageTranslation - 消息翻译

**用途**: 自动翻译 AI 消息

**返回值**:

```typescript
interface UseMessageTranslationReturn {
  translatedMessages: Message[]; // 翻译后的消息
  isTranslating: boolean; // 翻译状态
  enableTranslation: boolean; // 是否启用翻译
  setEnableTranslation: (enable: boolean) => void;
  translateMessage: (message: Message) => Promise<Message>;
}
```

---

### useExtendedThinking - 扩展思考模式

**用途**: 管理 Claude 的扩展思考功能

**返回值**:

```typescript
interface UseExtendedThinkingReturn {
  thinkingMode: "none" | "low" | "medium" | "high";
  setThinkingMode: (mode: ThinkingMode) => void;
  thinkingBudget: number; // 思考预算 (tokens)
  setThinkingBudget: (budget: number) => void;
  isThinking: boolean; // 是否正在思考
  thinkingContent: string; // 思考内容
}
```

---

### usePluginLoader - 插件动态加载

**用途**: 加载和管理 VSCode 风格插件

**返回值**:

```typescript
interface UsePluginLoaderReturn {
  plugins: Plugin[]; // 已加载插件
  loadPlugin: (path: string) => Promise<Plugin>;
  unloadPlugin: (id: string) => void;
  enablePlugin: (id: string) => void;
  disablePlugin: (id: string) => void;
  getPluginAPI: (id: string) => PluginAPI;
}
```

---

## Hook 开发规范

### 命名规范

- 以 `use` 开头
- camelCase 命名
- 描述性名称（如 `useSessionStream` 而非 `useStream`）

### 文件结构

```typescript
// 1. 导入
import { useState, useEffect, useCallback, useMemo } from "react";

// 2. 类型定义
interface UseMyHookOptions {
  initialValue?: string;
  onComplete?: () => void;
}

interface UseMyHookReturn {
  value: string;
  setValue: (value: string) => void;
  reset: () => void;
}

// 3. Hook 实现
export function useMyHook(options: UseMyHookOptions = {}): UseMyHookReturn {
  const { initialValue = "", onComplete } = options;

  const [value, setValue] = useState(initialValue);

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    // 副作用逻辑
    return () => {
      // 清理逻辑
    };
  }, []);

  return {
    value,
    setValue,
    reset,
  };
}
```

### 最佳实践

1. **单一职责**: 每个 Hook 只做一件事
2. **可组合**: Hook 可以调用其他 Hook
3. **稳定依赖**: `useEffect` 的依赖项要完整
4. **避免闭包陷阱**: 使用 `useCallback` 和 `useRef`
5. **TypeScript**: 完整的类型定义

---

## 常见修改场景

### 场景 1: 添加新的 Hook

1. 在 `hooks/` 下创建 `useMyHook.ts`
2. 定义类型和实现
3. 导出 Hook

### 场景 2: 修改会话流处理

**文件**: `useSessionStream.ts`

1. 理解现有流处理逻辑
2. 修改 `startStream` 或 `processChunk` 函数
3. 更新类型定义

### 场景 3: 添加新的快捷键

**文件**: `useGlobalKeyboardShortcuts.ts` 或 `useKeyboardShortcuts.ts`

1. 在快捷键映射中添加新快捷键
2. 定义处理函数
3. 确保不与现有快捷键冲突

---

## Hook 依赖关系

```
useTabs
  └─ useSmartSession
       └─ useSessionStream
            └─ useMessageTranslation
       └─ useSessionCostCalculation

usePromptExecution
  └─ useSessionStream
  └─ useExtendedThinking
  └─ useSkillTrigger

usePluginLoader
  └─ useHookChain
```

---

**最后更新**: 2025-12-27
**Hook 总数**: 35 个
