# 流式输出性能优化与错误修复 - 设计文档

## Overview

本设计文档针对 Fangyu Code 的流式输出系统进行全面优化，修复已知的运行时错误，提升渲染性能和用户体验。

核心目标：
1. 消除所有 React 警告和运行时错误
2. 将消息重复率降至 5% 以下
3. 实现 60fps 流畅的流式输出
4. 应用高性能 Markdown 渲染组件

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     流式输出系统架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ SessionStream│───▶│ Deduplication│───▶│ Virtual List │      │
│  │    Hook      │    │    Hook      │    │  Renderer    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Threshold    │    │ Message      │    │ Optimized    │      │
│  │ Monitor      │    │ Content      │    │ Markdown     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. useSessionThresholdMonitor (修复)

**问题**: `msg.message?.content?.map is not a function`

**原因**: `content` 可能是字符串而非数组

**解决方案**:
```typescript
// 修复前
const content = msg.message?.content?.map((c) => ...)

// 修复后
const content = typeof msg.message === "string"
  ? msg.message
  : Array.isArray(msg.message?.content)
    ? msg.message.content.map((c) => ...).join("\n")
    : String(msg.message?.content || "");
```

### 2. SessionMessages (修复 flushSync)

**问题**: `flushSync was called from inside a lifecycle method`

**原因**: ResizeObserver 回调在 React 渲染期间触发 measureElement

**解决方案**:
```typescript
// 修复前
const observer = new ResizeObserver(() => {
  measureRef.current(el);
});

// 修复后
const observer = new ResizeObserver(() => {
  // 使用 requestAnimationFrame 延迟到下一帧
  requestAnimationFrame(() => {
    if (elRef.current) {
      measureRef.current(elRef.current);
    }
  });
});
```

### 3. Tooltip forwardRef 修复

**问题**: `Function components cannot be given refs`

**解决方案**: 为所有被 Tooltip 包裹的函数组件添加 forwardRef

```typescript
// 修复前
const MyButton = ({ onClick }) => <button onClick={onClick}>Click</button>;

// 修复后
const MyButton = forwardRef<HTMLButtonElement, Props>(({ onClick }, ref) => (
  <button ref={ref} onClick={onClick}>Click</button>
));
```

### 4. Dialog 控制状态修复

**问题**: `A component is changing an uncontrolled input to be controlled`

**解决方案**: 确保 `open` prop 始终有定义的初始值

```typescript
// 修复前
const [open, setOpen] = useState();

// 修复后
const [open, setOpen] = useState(false);
```

### 5. 消息去重优化

**当前问题**: 重复率 20%-37%

**根本原因**: `processMessageWithTranslation` 在每个流事件中追加消息

**解决方案**:
1. 在消息源头防止重复添加
2. 使用 Set 跟踪已处理的消息 ID
3. 优化事件监听器注册，防止重复订阅

```typescript
// 在 useMessageTranslation 中添加去重逻辑
const processedIds = useRef(new Set<string>());

const processMessage = (msg) => {
  const id = msg.message?.id;
  if (id && processedIds.current.has(id)) {
    // 更新现有消息而非追加
    return updateExistingMessage(id, msg);
  }
  processedIds.current.add(id);
  return appendNewMessage(msg);
};
```

### 6. OptimizedMarkdown 集成

**目标**: 替换 MessageContent 中的 ReactMarkdown

**优化点**:
- 懒加载语法高亮
- 长代码块折叠
- macOS 风格代码头部
- CSS 动画光标

## Data Models

### ThresholdStatus (已有)
```typescript
interface ThresholdStatus {
  currentTokens: number;
  percentage: number;
  isWarning: boolean;
  isCritical: boolean;
  isGeneratingSummary: boolean;
}
```

### DeduplicationResult (已有)
```typescript
interface DeduplicationResult {
  messages: ClaudeStreamMessage[];
  originalCount: number;
  deduplicatedCount: number;
  duplicateCount: number;
  duplicateRate: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Content Type Handling
*For any* message object where `message.content` is not an array (string, undefined, null, or other type), the `generateSummary` function SHALL process it without throwing errors and return a valid string.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Message Deduplication Effectiveness
*For any* stream of messages with duplicate IDs, the deduplication system SHALL:
- Keep exactly one instance of each unique message ID
- Preserve the most recent/complete version
- Maintain original message order
- Achieve duplicate rate < 5%

**Validates: Requirements 5.1, 5.2**

### Property 3: Event Listener Uniqueness
*For any* component lifecycle, event listeners SHALL be registered at most once per event type, preventing duplicate subscriptions that cause message multiplication.

**Validates: Requirements 5.3**

### Property 4: Dialog State Consistency
*For any* Dialog component, the `open` prop SHALL have a defined boolean value (true or false) at all times, never undefined.

**Validates: Requirements 4.1, 4.2**

### Property 5: Tooltip Ref Forwarding
*For any* functional component wrapped by Tooltip, the component SHALL properly forward refs using React.forwardRef, allowing Tooltip to attach positioning refs.

**Validates: Requirements 1.1, 1.2**

## Error Handling

### 1. Content Type Errors
- 使用类型守卫检查 `Array.isArray(content)`
- 提供 fallback 处理非数组内容
- 记录详细错误信息用于调试

### 2. Render Phase Errors
- 使用 `requestAnimationFrame` 延迟 DOM 操作
- 避免在 render 期间调用 `flushSync`
- 使用 `useLayoutEffect` 替代直接 DOM 操作

### 3. Ref Errors
- 所有被 Tooltip 包裹的组件使用 `forwardRef`
- 提供 displayName 便于调试

## Testing Strategy

### 单元测试
- 测试 `generateSummary` 处理各种 content 类型
- 测试 Dialog 组件初始状态
- 测试 forwardRef 组件的 ref 传递

### 属性测试 (Property-Based Testing)
使用 `fast-check` 库进行属性测试：

1. **Content Type Property Test**
   - 生成随机 message 对象（content 为 string/array/undefined/null）
   - 验证 generateSummary 不抛出错误

2. **Deduplication Property Test**
   - 生成随机消息流（包含重复 ID）
   - 验证去重后无重复 ID
   - 验证重复率 < 5%

3. **Dialog State Property Test**
   - 生成随机 Dialog 配置
   - 验证 open prop 始终为 boolean

### 集成测试
- 测试完整的流式输出流程
- 验证 60fps 渲染性能
- 验证 OptimizedMarkdown 正确渲染

### 测试配置
- 属性测试最少运行 100 次迭代
- 使用 `vitest` 作为测试框架
- 使用 `fast-check` 进行属性测试
