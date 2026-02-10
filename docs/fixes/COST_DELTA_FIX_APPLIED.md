# 费用增量显示问题修复 - 已完成

## 修复内容

已成功修复 `ClaudeStatusIndicator.tsx` 中的费用增量显示问题。

### 关键改动

1. **导入更新**
   - ✅ 添加 `aggregateSessionCost` 从 `@/lib/sessionCost`
   - ✅ 添加 `useCostDelta` 从 `@/hooks/useCostDelta`
   - ✅ 移除 `tokenExtractor`（不再需要）

2. **Props 更新**
   - ✅ 添加 `isStreaming?: boolean` prop

3. **状态变量**
   - ✅ 添加 `showDelta` 状态
   - ✅ 添加 `deltaTimerRef` 引用
   - ✅ 添加 `prevCostRef` 引用

4. **费用计算**
   - ✅ 使用 `aggregateSessionCost()` 替代手动计算
   - ✅ 确保与 `PromptNavigator` 一致

5. **增量逻辑**
   - ✅ 获取 `commandDelta` 和 `isDataLoaded` 从 `useCostDelta`
   - ✅ 添加 `isDataLoaded` 检查，避免初始化时显示错误的总和
   - ✅ 添加流式输出和执行完成的定时器逻辑

6. **UI 更新**
   - ✅ 增量显示时使用蓝色样式
   - ✅ 总费用显示时使用绿色样式
   - ✅ 添加平滑过渡动画

## 问题解决

**问题**：重新加载会话时，底部状态栏有时会显示 "+$总和"（例如 +$1.2589），而不是增量。

**原因**：`useCostDelta` 需要等待数据稳定（2帧）才能正确初始化，在此期间如果费用发生变化，可能会显示错误的总和。

**解决**：添加 `isDataLoaded` 检查，只有在数据加载完成后才显示增量：

```typescript
if (sessionCost > prevCostRef.current && prevCostRef.current > 0 && isDataLoaded) {
  setShowDelta(true);
}
```

## 清理工作

已删除以下备份文件，防止文件被恢复到旧版本：
- ✅ `src/components/FloatingPromptInput/index.tsx.backup`
- ✅ `src/components/message/ThinkingBlock.tsx.backup`
- ✅ `src/components/PromptNavigator.tsx.backup`
- ✅ `src/components/ClaudeCodeSession.tsx.backup`
- ✅ `src/hooks/usePromptExecution.ts.backup`

## 预期效果

修复后：
- ✅ 重新加载会话时不会显示错误的 "+$总和"
- ✅ 只有在真正发生费用增加时才显示增量
- ✅ 增量显示为蓝色，总费用显示为绿色
- ✅ 流式输出时增量显示 1.2 秒，执行完成后显示 2 秒

## 测试建议

1. 打开一个已有的会话（例如费用为 $1.2589）
2. 刷新页面重新加载会话
3. 观察底部状态栏，应该只显示总费用 "$1.2589"（绿色），不显示增量
4. 发送一条新提示词
5. 观察底部状态栏，应该显示增量（例如 "+$0.1234"，蓝色）
6. 等待 2 秒后，增量消失，显示新的总费用（例如 "$1.3823"，绿色）

---

**修复时间**：2026-01-06
**修复文件**：`src/components/ClaudeStatusIndicator.tsx`
**相关文档**：`COST_DELTA_FIX.md`（详细修复说明）
