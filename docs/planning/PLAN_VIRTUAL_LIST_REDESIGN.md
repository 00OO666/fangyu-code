# 虚拟列表滚动问题重新设计方案

## 问题根源分析

根据 TanStack Virtual 官方文档和代码分析，滚动跳动的根本原因是：

1. **动态测量导致 totalSize 变化** - 当 `estimateSize` 估算值与实际测量值差异大时，滚动时 `getTotalSize()` 会频繁变化
2. **缺少滚动位置调整控制** - 没有使用 `shouldAdjustScrollPositionOnItemSizeChange` 来控制滚动位置调整
3. **自定义 ResizeObserver 与库内置机制冲突** - 我们的 `MeasurableItem` 组件与 `useVirtualizer` 内置的测量机制产生冲突

## 官方推荐方案

根据 TanStack Virtual 文档，处理动态高度的正确方式是：

```tsx
// 官方示例
<div
  key={virtualRow.key}
  data-index={virtualRow.index}
  ref={virtualizer.measureElement}  // 直接使用 virtualizer.measureElement
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${virtualRow.start}px)`,
  }}
>
  Row {virtualRow.index}
</div>
```

**关键点：**
- 直接使用 `virtualizer.measureElement` 作为 ref callback
- 不需要自定义 ResizeObserver
- 使用 `data-index` 属性让库知道元素对应哪个索引

## 重新设计方案

### 方案 A：完全使用官方推荐方式（推荐）

**核心改动：**
1. 删除 `MeasurableItem` 组件
2. 直接使用 `rowVirtualizer.measureElement` 作为 ref
3. 添加 `shouldAdjustScrollPositionOnItemSizeChange` 配置
4. 优化 `estimateSize` 使其更接近实际值

**优点：**
- 完全遵循官方最佳实践
- 代码更简洁
- 避免自定义逻辑与库内置机制冲突

**缺点：**
- 需要较大改动

### 方案 B：保留 MeasurableItem 但修复冲突

**核心改动：**
1. 使用 `resizeItem` API 代替 `measureElement`
2. 添加 `shouldAdjustScrollPositionOnItemSizeChange` 配置
3. 优化节流逻辑

**优点：**
- 改动较小
- 保留现有架构

**缺点：**
- 仍然是自定义实现，可能有未知问题

## 推荐方案：方案 A

### 实现步骤

#### Step 1: 删除 MeasurableItem 组件

删除整个 `MeasurableItem` 组件及其相关的全局变量（`isScrolling`, `scrollEndTimer`）。

#### Step 2: 修改 useVirtualizer 配置

```tsx
const rowVirtualizer = useVirtualizer({
  count: messageGroups.length,
  getScrollElement: () => parentRef.current,
  estimateSize,
  getItemKey,
  overscan: 5,  // 减少到 5，官方默认是 1

  // 🔧 关键配置：控制滚动位置调整
  shouldAdjustScrollPositionOnItemSizeChange: (item, delta, instance) => {
    // 只有当用户向后滚动（查看历史）时才调整
    // 向前滚动（查看新消息）时不调整，避免跳动
    return instance.scrollDirection === 'backward';
  },
});
```

#### Step 3: 简化渲染逻辑

```tsx
{rowVirtualizer.getVirtualItems().map((virtualItem) => {
  const messageGroup = messageGroups[virtualItem.index];
  if (!messageGroup) return null;

  return (
    <div
      key={virtualItem.key}
      data-index={virtualItem.index}
      ref={rowVirtualizer.measureElement}  // 直接使用
      className="absolute inset-x-4"
      style={{
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualItem.start}px)`,
      }}
    >
      <StreamMessageV2 ... />
    </div>
  );
})}
```

#### Step 4: 优化 estimateSize

```tsx
const estimateSize = React.useCallback((index: number) => {
  const messageGroup = messageGroupsRef.current[index];
  if (!messageGroup) return 300;

  // 基于消息类型的更准确估算
  if (messageGroup.type === 'subagent') {
    // subagent 通常较大
    return 600;
  }

  if (messageGroup.type === 'aggregated') {
    // 根据消息数量估算
    const msgCount = messageGroup.messages?.length ?? 1;
    return 150 + msgCount * 100;
  }

  const message = messageGroup.message;
  if (!message) return 300;

  // 根据内容长度估算
  const content = typeof message.content === 'string' ? message.content : '';
  const hasCodeBlock = content.includes('```');
  const lineCount = Math.ceil(content.length / 80);

  let height = 100; // 基础高度
  height += lineCount * 24; // 每行约 24px
  if (hasCodeBlock) height += 150; // 代码块额外高度

  return Math.min(Math.max(height, 150), 1000); // 限制在 150-1000px
}, []);
```

#### Step 5: 移除滚动容器的额外样式

```tsx
<div
  ref={parentRef}
  className="flex-1 overflow-y-auto relative"
  style={{
    // 移除 willChange, WebkitOverflowScrolling 等
    // 让浏览器自然处理滚动
  }}
>
```

### 预期效果

1. **滚动不再跳动** - `shouldAdjustScrollPositionOnItemSizeChange` 控制何时调整滚动位置
2. **代码更简洁** - 删除 100+ 行自定义测量代码
3. **性能更好** - 使用库内置的优化机制
4. **维护更容易** - 遵循官方最佳实践

### 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 流式输出时滚动不跟随 | 中 | 中 | 保留 scrollToBottom 逻辑 |
| 首次加载时高度闪烁 | 低 | 低 | 优化 estimateSize 准确性 |
| 向后滚动时仍有轻微跳动 | 低 | 低 | 调整 shouldAdjustScrollPositionOnItemSizeChange 逻辑 |

### 回滚方案

如果新方案有问题，可以通过 git 回滚到当前版本。建议在实施前创建一个 git commit 作为回滚点。

---

## 实施确认

请确认是否按照方案 A 进行实施？

- [ ] 确认删除 MeasurableItem 组件
- [ ] 确认使用官方 measureElement
- [ ] 确认添加 shouldAdjustScrollPositionOnItemSizeChange
- [ ] 确认优化 estimateSize
