# 监控服务集成状态检查

> **快速判断监控服务是否已集成到 Fangyu Code**

---

## 📊 当前集成状态

### ✅ 已完成

- [x] 消息去重逻辑（已内置在 `sessionCost.ts` 中）
- [x] 监控服务文件已创建
- [x] 测试文件已创建
- [x] 文档已完成

### ❌ 未完成（需要集成）

- [ ] Console 监控未启用
- [ ] 错误监控面板未显示
- [ ] DevTools 自动监控未启动
- [ ] useMessageDeduplication Hook 未使用

---

## 🔍 如何检查是否已集成

### 方法 1：运行时检查（最直接）

启动 Fangyu Code 开发模式：

```bash
cd F:/Fangyu-Code-Dev
npm run tauri:dev
```

打开浏览器控制台（F12），检查以下内容：

#### ✅ 已集成的标志

1. **Console 监控已启用**
   - 控制台中看到：`[ConsoleMonitor] 已启用，正在监控 console.error 和 console.warn`

2. **错误监控面板可见**
   - 界面右下角有"错误监控"按钮或面板
   - 点击后可以看到错误列表

3. **DevTools 监控已启动**
   - 控制台中看到：`[DevToolsMonitor] 已连接到 Chrome DevTools`
   - 或看到：`[DevToolsMonitor] 开始实时监控...`

4. **消息去重正常工作**
   - 发送提示词后，控制台中看到：`[SessionCost] 🔧 去重: 原始 X 条 → 去重后 Y 条`
   - 会话统计不会重复计费

#### ❌ 未集成的标志

- 控制台中没有任何 `[ConsoleMonitor]` 或 `[DevToolsMonitor]` 日志
- 界面上找不到错误监控相关的 UI 元素
- 触发错误时没有任何监控反应

---

### 方法 2：代码检查

检查以下文件是否导入了监控服务：

```bash
# 在项目根目录执行
cd F:/Fangyu-Code-Dev

# 检查是否有文件导入了监控服务
grep -r "useConsoleMonitor" src/ --exclude-dir=node_modules
grep -r "ErrorMonitorPanel" src/ --exclude-dir=node_modules
grep -r "devToolsAutoMonitor" src/ --exclude-dir=node_modules
```

**预期结果**：
- ✅ 已集成：找到多个文件（除了监控服务自身）
- ❌ 未集成：只找到监控服务文件本身

---

## 🚀 快速集成指南

如果检查发现**未集成**，按以下步骤快速集成：

### 步骤 1：启用 Console 监控

在 `src/App.tsx` 中添加：

```typescript
import { useConsoleMonitor } from '@/hooks/useConsoleMonitor';

function App() {
  // 启用 Console 监控（仅开发模式）
  const { errors, errorCount, warnCount } = useConsoleMonitor({
    enabled: import.meta.env.DEV,
    maxErrors: 50,
    showOriginal: true
  });

  // ... 其他代码
}
```

### 步骤 2：显示错误监控面板

在 `src/App.tsx` 或主布局组件中添加：

```typescript
import { ErrorMonitorPanel } from '@/components/ErrorMonitorPanel';

function App() {
  const { errors, clearErrors, clearError } = useConsoleMonitor({
    enabled: import.meta.env.DEV
  });

  return (
    <div>
      {/* 其他组件 */}

      {/* 错误监控面板（仅开发模式） */}
      {import.meta.env.DEV && (
        <ErrorMonitorPanel
          errors={errors}
          onClearAll={clearErrors}
          onClearError={clearError}
        />
      )}
    </div>
  );
}
```

### 步骤 3：启动 DevTools 监控（可选）

在 `src/App.tsx` 中添加：

```typescript
import { devToolsMonitor } from '@/services/devToolsAutoMonitor';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      devToolsMonitor.startMonitoring("http://localhost:1420", {
        interval: 10,
        autoFix: false,
        severityThreshold: "medium"
      }).catch(err => {
        console.warn("[App] DevTools 监控启动失败:", err);
      });

      return () => {
        devToolsMonitor.stopMonitoring();
      };
    }
  }, []);

  // ... 其他代码
}
```

### 步骤 4：使用消息去重 Hook（可选优化）

在 `src/lib/sessionCost.ts` 中替换现有去重逻辑：

```typescript
import { deduplicateMessages } from '@/hooks/useMessageDeduplication';

export function aggregateSessionCost(messages: ClaudeStreamMessage[]): SessionCostAggregation {
  // 使用 Hook 中的去重逻辑
  const { messages: deduplicatedMessages, duplicateCount } = deduplicateMessages(messages);

  if (duplicateCount > 0) {
    console.warn(`[SessionCost] 🔧 去重: 移除 ${duplicateCount} 条重复`);
  }

  messages = deduplicatedMessages;

  // ... 其他代码
}
```

---

## ✅ 集成验证清单

完成集成后，按以下清单验证：

- [ ] 启动 `npm run tauri:dev`
- [ ] 打开浏览器控制台（F12）
- [ ] 看到 `[ConsoleMonitor] 已启用` 日志
- [ ] 界面上有错误监控 UI 元素
- [ ] 手动触发错误：`console.error("test")`
- [ ] 错误监控面板显示该错误
- [ ] 发送提示词，检查会话统计是否正确
- [ ] 控制台中看到去重日志（如果有重复消息）

---

## 📝 集成状态总结

**当前状态**：监控服务已创建，但**未集成到应用中**

**下一步**：按照"快速集成指南"完成集成

**预计时间**：5-10 分钟

---

**💡 提示**：集成后记得测试所有功能，确保监控服务正常工作！
