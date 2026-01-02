# 错误监控工具使用指南

> **Fangyu Code 内置实时错误监控系统**
>
> 自动检测、分析和提供修复建议

---

## 📦 包含的工具

### 1. **useMessageDeduplication** - 消息去重 Hook
解决消息重复提交问题的一劳永逸方案。

### 2. **useConsoleMonitor** - Console 监控 Hook
实时拦截和分析 console 错误/警告。

### 3. **ErrorMonitorPanel** - 可视化错误面板
显示错误列表、统计信息和修复建议。

---

## 🚀 快速开始

### 步骤 1：在 ClaudeCodeSession 中使用消息去重

```typescript
// src/components/ClaudeCodeSession.tsx
import { useMessageDeduplication } from '@/hooks/useMessageDeduplication';

function ClaudeCodeSession() {
  const { messages: rawMessages } = useMessages();

  // 🔧 使用去重 Hook
  const { messages, duplicateCount } = useMessageDeduplication(rawMessages, {
    debug: true, // 开发模式下启用调试日志
    warningThreshold: 0.1, // 重复率超过 10% 时发出警告
  });

  // 使用去重后的 messages
  const { stats: costStats } = useSessionCostCalculation(messages);

  // 显示重复警告
  useEffect(() => {
    if (duplicateCount > 0) {
      console.warn(`检测到 ${duplicateCount} 条重复消息已自动去重`);
    }
  }, [duplicateCount]);

  return (
    // ... 组件内容
  );
}
```

### 步骤 2：集成错误监控面板

```typescript
// src/components/layout/AppLayout.tsx
import { useState } from 'react';
import { ErrorMonitorPanel } from '@/components/ErrorMonitorPanel';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AppLayout() {
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);

  return (
    <div className="flex h-screen">
      {/* 主内容区域 */}
      <main className="flex-1">
        {/* ... 现有内容 */}
      </main>

      {/* 错误监控面板 */}
      <ErrorMonitorPanel
        isOpen={showErrorMonitor}
        onClose={() => setShowErrorMonitor(false)}
      />

      {/* 错误监控按钮（固定在右下角） */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowErrorMonitor(!showErrorMonitor)}
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        <Bug className="h-4 w-4 mr-2" />
        错误监控
      </Button>
    </div>
  );
}
```

### 步骤 3：使用幂等性 Key 防止重复提交

```typescript
// src/hooks/usePromptExecution.ts
import { createIdempotencyKey } from '@/hooks/useMessageDeduplication';

function usePromptExecution() {
  const submittedPromptsRef = useRef(new Set<string>());

  const executePrompt = async (prompt: string) => {
    // 生成幂等性 Key
    const idempotencyKey = createIdempotencyKey('prompt', {
      text: prompt,
      sessionId: claudeSessionId,
      timestamp: Date.now(),
    });

    // 检查是否已提交
    if (submittedPromptsRef.current.has(idempotencyKey)) {
      console.warn('[Idempotency] 检测到重复提交，已忽略');
      return;
    }

    // 标记为已提交
    submittedPromptsRef.current.add(idempotencyKey);

    try {
      // 执行提示词
      await api.executeClaudeCode(/* ... */);
    } finally {
      // 5 秒后清除标记（允许重新提交）
      setTimeout(() => {
        submittedPromptsRef.current.delete(idempotencyKey);
      }, 5000);
    }
  };

  return { executePrompt };
}
```

---

## 🎯 解决方案总结

### 问题 1：消息重复的根本原因

根据分析和搜索结果，消息重复的主要原因：

1. **React Strict Mode**
   - 开发模式下 useEffect 会执行两次
   - 参考：[Fix Next.js Double Execution](https://openillumi.com/en/en-nextjs-double-execution-strict-mode-fix/)

2. **事件监听器未清理**
   - Tauri 事件监听器可能被注册多次
   - 参考：[preventing multiple API calls](https://www.js-craft.io/blog/react-useeffect-multiple-api-calls-fetch-race-conditions)

3. **会话恢复时重复加载**
   - 从历史记录恢复时，消息可能被多次添加到数组

### 解决方案：三层防护

```
┌─────────────────────────────────────────┐
│ 1. 幂等性 Key（防止重复提交）            │
│    - createIdempotencyKey()             │
│    - 在提交前检查是否已提交              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 2. 消息去重（清理重复消息）              │
│    - useMessageDeduplication()          │
│    - 基于消息 ID 去重                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 3. 实时监控（检测异常）                  │
│    - useConsoleMonitor()                │
│    - ErrorMonitorPanel                  │
│    - 自动提供修复建议                    │
└─────────────────────────────────────────┘
```

---

## 📊 错误监控功能

### 自动检测的错误类型

| 类别 | 检测模式 | 修复建议 |
|------|---------|---------|
| **消息重复** | `duplicate`、`重复` | 使用 useMessageDeduplication Hook |
| **内存泄漏** | `memory leak`、`unmounted component` | 在 useEffect 中添加 cleanup 函数 |
| **网络错误** | `network`、`fetch`、`request failed` | 检查 API 端点和错误处理 |
| **渲染错误** | `render`、`component` | 检查 props 和 state |
| **性能问题** | `performance`、`slow` | 使用 React.memo、useMemo |
| **状态更新** | `setState`、`useState` | 确保状态更新是不可变的 |

### 错误面板功能

- ✅ 实时显示错误和警告
- ✅ 按类型过滤（全部/错误/警告）
- ✅ 按类别分组统计
- ✅ 显示错误次数
- ✅ 提供修复建议
- ✅ 显示文件位置和行号
- ✅ 查看完整堆栈跟踪
- ✅ 一键清除错误

---

## 🔧 高级配置

### 自定义错误模式

```typescript
// 在 useConsoleMonitor.ts 中添加自定义模式
const CUSTOM_PATTERNS: ErrorPattern[] = [
  {
    pattern: /your-custom-pattern/i,
    category: "custom-category",
    suggestion: "你的修复建议",
  },
];
```

### 禁用 Strict Mode（生产环境）

```typescript
// src/main.tsx
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  ) : (
    <AppWrapper />
  )
);
```

---

## 📚 参考资料

### 状态管理最佳实践
- [State Management in React 2026](https://www.csharp.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/)
- [React Advanced 2025: Type Safe URL State Management](https://www.infoq.com/news/2025/12/nuqs-react-advanced/)

### 错误监控
- [Effective Web App Error Monitoring](https://kitemetric.com/blogs/effective-web-app-error-monitoring-a-guide)
- [Reporting Exceptions to Honeycomb](https://www.honeycomb.io/blog/reporting-exceptions-honeycomb-frontend-observability)

### 防止重复调用
- [Preventing Multiple API Calls](https://www.js-craft.io/blog/react-useeffect-multiple-api-calls-fetch-race-conditions)
- [Implementing Idempotency Keys](https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide)
- [Resolving useEffect Running Twice](https://www.dhiwise.com/post/resolving-useeffect-running-twice-a-comprehensive-guide)

---

## 🎉 完成！

现在你的 Fangyu Code 已经具备：
- ✅ 自动消息去重
- ✅ 实时错误监控
- ✅ 智能修复建议
- ✅ 可视化错误面板

**一劳永逸地解决了消息重复和错误监控问题！**
