# 费用增量显示问题修复

## 问题描述

用户反馈：重新加载会话时，底部状态栏有时会显示 "+$总和"（例如 +$1.2589），而不是显示增量（例如 +$0.1234）。

## 根本原因

`ClaudeStatusIndicator.tsx` 中的费用增量显示逻辑存在时序问题：

1. **初始化延迟**：`useCostDelta` hook 需要等待数据稳定（2帧）才能正确初始化
2. **状态不同步**：在 `useCostDelta` 初始化完成之前，`ClaudeStatusIndicator` 中的 `prevCostRef` 可能已经开始工作
3. **错误的增量计算**：如果在初始化期间费用发生变化，可能会显示错误的增量

## 解决方案

### 修改 1：导入 aggregateSessionCost 和 useCostDelta

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：第 25-29 行

```typescript
// 添加导入
import { aggregateSessionCost } from "@/lib/sessionCost";
import { useCostDelta } from "@/hooks/useCostDelta";

// 移除不再需要的导入
// import { tokenExtractor } from "@/lib/tokenExtractor";
```

### 修改 2：使用 aggregateSessionCost 计算费用

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：第 128-160 行（替换整个 sessionCost 的 useMemo）

```typescript
// Calculate cost from messages with activity-aware logic
// 🔧 FIX: 使用 aggregateSessionCost 确保与 PromptNavigator 一致
const sessionCost = useMemo(() => {
  if (messages.length === 0) return 0;

  // Only show costs for active sessions to prevent accumulation on inactive sessions
  if (!sessionActivity.shouldTrackCost && !sessionActivity.isCurrentSession) {
    return 0;
  }

  // 使用统一的费用聚合函数，确保：
  // 1. 优先使用 CLI 返回的 costUSD（包含 Extended Thinking、分层定价）
  // 2. 支持多引擎（Claude、Codex、Gemini）
  // 3. 正确处理所有计费消息类型
  const aggregation = aggregateSessionCost(messages);
  return aggregation.totals.totalCost;
}, [
  messages,
  sessionActivity.shouldTrackCost,
  sessionActivity.isCurrentSession,
]);
```

### 修改 3：添加费用增量逻辑和 isDataLoaded 检查

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：在 sessionCost 计算之后，formatCost 函数之前添加

```typescript
// 🆕 获取当前指令的费用增量
const { commandDelta, isDataLoaded } = useCostDelta(sessionId, sessionCost, messages);

// 🆕 监听费用变化，显示增量动画
useEffect(() => {
  // 清除之前的定时器
  if (deltaTimerRef.current) {
    clearTimeout(deltaTimerRef.current);
    deltaTimerRef.current = null;
  }

  // 🔧 FIX: 只有在 useCostDelta 数据加载完成后才显示增量
  // 避免在初始化时显示错误的总和
  if (sessionCost > prevCostRef.current && prevCostRef.current > 0 && isDataLoaded) {
    // 显示增量
    setShowDelta(true);

    // 流式输出时：1.2 秒后隐藏
    // 非流式输出时：不自动隐藏（等待执行完成）
    if (isStreaming) {
      deltaTimerRef.current = setTimeout(() => {
        setShowDelta(false);
      }, 1200);
    }
  }

  prevCostRef.current = sessionCost;

  return () => {
    if (deltaTimerRef.current) {
      clearTimeout(deltaTimerRef.current);
    }
  };
}, [sessionCost, isStreaming, isDataLoaded]);

// 🆕 执行完成后显示 2 秒增量
useEffect(() => {
  if (!isStreaming && showDelta && commandDelta > 0) {
    // 清除之前的定时器
    if (deltaTimerRef.current) {
      clearTimeout(deltaTimerRef.current);
    }

    // 2 秒后隐藏
    deltaTimerRef.current = setTimeout(() => {
      setShowDelta(false);
    }, 2000);
  }

  return () => {
    if (deltaTimerRef.current) {
      clearTimeout(deltaTimerRef.current);
    }
  };
}, [isStreaming, showDelta, commandDelta]);
```

### 修改 4：添加状态变量

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：在组件开始处，useState 声明部分

```typescript
const [showDelta, setShowDelta] = useState(false);
const deltaTimerRef = React.useRef<NodeJS.Timeout | null>(null);
const prevCostRef = React.useRef<number>(0);
```

### 修改 5：添加 isStreaming prop

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：接口定义

```typescript
interface ClaudeStatusIndicatorProps {
  className?: string;
  onSettingsClick?: () => void;
  onAboutClick?: () => void;
  messages?: ClaudeStreamMessage[];
  sessionId?: string;
  /** 紧凑模式：仅显示状态图标，不显示版本号和费用 */
  compact?: boolean;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
}
```

### 修改 6：更新费用显示逻辑

**文件**：`src/components/ClaudeStatusIndicator.tsx`

**位置**：费用 Badge 显示部分

```typescript
{!compact && sessionCost > 0 && (
  <Badge
    variant="outline"
    className={cn(
      "text-xs ml-1 font-mono transition-all duration-300",
      showDelta && commandDelta > 0
        ? // 显示增量：蓝色样式
          "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : // 显示总费用：绿色样式
          sessionActivity.shouldTrackCost
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-300"
          : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
    )}
  >
    {showDelta && commandDelta > 0 ? (
      // 显示增量（带 + 号）
      <>+{formatCost(commandDelta)}</>
    ) : (
      // 显示总费用
      <>
        {formatCost(sessionCost)}
        {!sessionActivity.shouldTrackCost && " (archived)"}
      </>
    )}
  </Badge>
)}
```

## 关键改进

1. **isDataLoaded 检查**：只有在 `useCostDelta` 数据加载完成后才显示增量，避免显示错误的总和
2. **统一费用计算**：使用 `aggregateSessionCost` 确保与 `PromptNavigator` 一致
3. **正确的增量来源**：使用 `useCostDelta` 的 `commandDelta`，而不是手动计算

## 预期效果

修复后，重新加载会话时：
- 不会显示错误的 "+$总和"
- 只有在真正发生费用增加时才显示增量
- 增量显示的是当前指令的费用，而不是整个会话的费用

## 测试步骤

1. 打开一个已有的会话（例如费用为 $1.2589）
2. 刷新页面重新加载会话
3. 观察底部状态栏，应该只显示总费用 "$1.2589"，不显示增量
4. 发送一条新提示词
5. 观察底部状态栏，应该显示增量（例如 "+$0.1234"）
6. 等待 2 秒后，增量消失，显示新的总费用（例如 "$1.3823"）
