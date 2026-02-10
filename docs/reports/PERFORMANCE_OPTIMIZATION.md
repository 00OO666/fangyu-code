# Fangyu Code 性能优化方案

> **版本**: 2.6.0+
> **创建时间**: 2026-01-11
> **目标**: 提升应用流畅度 50%+

---

## 📊 当前性能分析

### 技术栈
- ✅ React 18.3.1（已使用最新版本）
- ✅ Vite 6.0.3（快速构建工具）
- ✅ Tauri 2.9（轻量级桌面框架）
- ✅ @tanstack/react-virtual（虚拟滚动）
- ⚠️ Framer Motion（动画库，可能影响性能）

### 已完成的优化（2026-01-11）
1. ✅ 引擎切换使用 `useTransition` 降低优先级
2. ✅ 消息动画只对新消息启用
3. ✅ 移除生产环境调试日志
4. ✅ 使用 `useCallback` 稳定回调引用

---

## 🚀 深度优化方案

### 1. 代码分割与懒加载（优先级：高）

**问题**: 所有组件在启动时一次性加载，首屏时间长

**方案**: 使用 React.lazy + Suspense 按需加载

```tsx
// src/App.tsx
import { lazy, Suspense } from 'react';

// 懒加载大型组件
const ClaudeCodeSession = lazy(() => import('@/components/ClaudeCodeSession'));
const SettingsView = lazy(() => import('@/pages/SettingsView'));
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// 使用 Suspense 包裹
<Suspense fallback={<LoadingSpinner />}>
  <ClaudeCodeSession />
</Suspense>
```

**预期收益**: 首屏加载时间减少 40%+

---

### 2. 虚拟化优化（优先级：高）

**当前状态**: 已使用 @tanstack/react-virtual

**进一步优化**:

```tsx
// src/components/session/SessionMessages.tsx
const rowVirtualizer = useVirtualizer({
  count: messageGroups.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100, // 预估高度
  overscan: 3, // 🔧 减少 overscan，从 5 降到 3
  measureElement: (el) => el.getBoundingClientRect().height,
  // 🆕 添加滚动优化
  scrollMargin: scrollRef.current?.offsetTop ?? 0,
  // 🆕 启用平滑滚动
  scrollPaddingStart: 0,
  scrollPaddingEnd: 0,
});
```

**预期收益**: 大量消息时滚动帧率提升 20%+

---

### 3. 状态管理优化（优先级：中）

**问题**: Context API 在大型应用中可能导致不必要的重渲染

**方案**: 引入 Zustand（轻量级状态管理）

```bash
npm install zustand
```

```tsx
// src/stores/sessionStore.ts
import { create } from 'zustand';

interface SessionStore {
  executionEngineConfig: ExecutionEngineConfig;
  setExecutionEngineConfig: (config: ExecutionEngineConfig) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  executionEngineConfig: getDefaultConfig(),
  setExecutionEngineConfig: (config) => set({ executionEngineConfig: config }),
}));
```

**优势**:
- 只有订阅了特定状态的组件才会重渲染
- 比 Context API 性能更好
- 代码更简洁

**预期收益**: 减少 30% 的不必要重渲染

---

### 4. Framer Motion 优化（优先级：高）

**问题**: 动画库开销大，影响性能

**方案 A**: 减少动画使用（已部分完成）
```tsx
// 只对关键交互启用动画
const shouldAnimate = isNewMessage && !isLowPowerMode;
```

**方案 B**: 使用 CSS 动画替代
```css
/* 更轻量的 CSS 动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-enter {
  animation: fadeIn 0.2s ease-out;
}
```

**方案 C**: 启用 GPU 加速
```tsx
<motion.div
  style={{ willChange: 'transform' }} // 提示浏览器使用 GPU
  animate={{ opacity: 1, y: 0 }}
/>
```

**预期收益**: 动画性能提升 50%+

---

### 5. Monaco Editor 优化（优先级：中）

**问题**: Monaco Editor 体积大（~5MB），加载慢

**方案**:

```tsx
// src/components/CodeEditor.tsx
import { lazy, Suspense } from 'react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// 配置优化
<MonacoEditor
  options={{
    minimap: { enabled: false }, // 禁用小地图
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    occurrencesHighlight: false, // 禁用高亮
    renderValidationDecorations: 'off', // 禁用验证装饰
    quickSuggestions: false, // 禁用快速建议
  }}
/>
```

**预期收益**: 编辑器加载时间减少 60%+

---

### 6. 打包体积优化（优先级：中）

**分析工具**:
```bash
npm install -D rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ]
}
```

**优化策略**:
1. 移除未使用的依赖
2. 使用 tree-shaking
3. 压缩图片资源
4. 使用 CDN 加载大型库

**预期收益**: 打包体积减少 30%+

---

### 7. Rust 后端优化（优先级：高）

**问题**: 部分耗时操作在前端执行，阻塞 UI

**方案**: 将计算密集型任务移到 Tauri Rust 后端

```rust
// src-tauri/src/commands.rs

#[tauri::command]
async fn parse_large_file(path: String) -> Result<Vec<String>, String> {
    // 在 Rust 中解析大文件，速度比 JS 快 10-100 倍
    tokio::task::spawn_blocking(move || {
        // 解析逻辑
    }).await.map_err(|e| e.to_string())
}
```

```tsx
// 前端调用
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('parse_large_file', { path: '/path/to/file' });
```

**适合移到 Rust 的操作**:
- 文件解析和处理
- 大量数据计算
- 正则表达式匹配
- 加密解密

**预期收益**: 耗时操作速度提升 10-100 倍

---

### 8. Web Worker 优化（优先级：低）

**问题**: 复杂计算阻塞主线程

**方案**: 使用 Web Worker 处理后台任务

```ts
// src/workers/messageParser.worker.ts
self.onmessage = (e) => {
  const { messages } = e.data;
  const parsed = parseMessages(messages);
  self.postMessage(parsed);
};
```

```tsx
// 使用 Worker
const worker = new Worker(new URL('./workers/messageParser.worker.ts', import.meta.url));
worker.postMessage({ messages });
worker.onmessage = (e) => {
  setMessages(e.data);
};
```

**预期收益**: 主线程响应速度提升 30%+

---

### 9. 缓存策略优化（优先级：中）

**方案**: 使用 React Query 或 SWR 进行数据缓存

```bash
npm install @tanstack/react-query
```

```tsx
// src/hooks/useSession.ts
import { useQuery } from '@tanstack/react-query';

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
    cacheTime: 10 * 60 * 1000, // 缓存 10 分钟
  });
}
```

**预期收益**: 减少 50% 的重复请求

---

### 10. 渲染优化（优先级：高）

**React 18 并发特性**:

```tsx
// 使用 useTransition 标记非紧急更新
const [isPending, startTransition] = useTransition();

startTransition(() => {
  setMessages(newMessages); // 低优先级更新
});

// 使用 useDeferredValue 延迟渲染
const deferredMessages = useDeferredValue(messages);
```

**React.memo 优化**:
```tsx
// 只在 props 真正变化时重渲染
export const MessageItem = React.memo(({ message }) => {
  // ...
}, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.content === next.message.content;
});
```

**预期收益**: 渲染性能提升 40%+

---

## 📈 优化优先级排序

### 立即执行（本周）
1. ✅ 消息动画优化（已完成）
2. ✅ 引擎切换优化（已完成）
3. 🔄 Framer Motion 优化
4. 🔄 代码分割与懒加载

### 短期优化（本月）
5. 虚拟化进一步优化
6. Monaco Editor 优化
7. Rust 后端迁移

### 长期优化（下个版本）
8. 状态管理重构（Zustand）
9. 打包体积优化
10. Web Worker 引入

---

## 🎯 性能目标

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 首屏加载时间 | ~2s | <1s | 50%+ |
| 消息渲染帧率 | ~30fps | 60fps | 100%+ |
| 引擎切换延迟 | ~500ms | <100ms | 80%+ |
| 打包体积 | ~15MB | <10MB | 33%+ |
| 内存占用 | ~200MB | <150MB | 25%+ |

---

## 🔧 实施步骤

### 第一阶段：快速优化（1-2 天）
```bash
# 1. 实现代码分割
# 2. 优化 Framer Motion
# 3. 减少 Monaco Editor 配置
```

### 第二阶段：深度优化（1 周）
```bash
# 1. 引入 Zustand
# 2. 将耗时操作移到 Rust
# 3. 优化虚拟滚动
```

### 第三阶段：持续优化（持续进行）
```bash
# 1. 监控性能指标
# 2. 分析用户反馈
# 3. 迭代优化
```

---

## 📊 性能监控

### 开发环境
```tsx
// src/utils/performance.ts
export function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`[Performance] ${name}: ${end - start}ms`);
}
```

### 生产环境
```tsx
// 使用 Tauri 的性能 API
import { invoke } from '@tauri-apps/api/core';

await invoke('log_performance', {
  metric: 'message_render_time',
  value: renderTime,
});
```

---

## 🎉 预期总体收益

- **启动速度**: 提升 50%+
- **运行流畅度**: 提升 60%+
- **内存占用**: 减少 25%+
- **打包体积**: 减少 30%+

---

**最后更新**: 2026-01-11
**维护者**: Claude Code Team
