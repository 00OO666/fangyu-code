# 提示词导航费用明细功能实现指南

## 功能需求

在提示词导航中实现：
1. 实时同步会话统计的费用变化
2. 鼠标悬停显示详细的费用明细
3. 费用明细包括：系统消息、工具调用、思考、其他非用户触发的消息

## 实现步骤

### 步骤 1: 添加费用明细数据结构

在 `PromptNavigator.tsx` 的 `PromptItem` 接口之前添加：

```typescript
/** 费用明细项 */
interface CostDetailItem {
  /** 消息类型 */
  type: 'system' | 'tool_call' | 'thinking' | 'assistant' | 'other';
  /** 描述 */
  description: string;
  /** 费用 */
  cost: number;
  /** Token 统计 */
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  /** 模型 */
  model?: string;
  /** 引擎 */
  engine?: string;
  /** 消息索引（用于调试） */
  messageIndex?: number;
}
```

在 `PromptItem` 接口中添加：

```typescript
interface PromptItem {
  // ... 现有字段 ...
  /** 费用明细列表 */
  costDetails?: CostDetailItem[];
}
```

### 步骤 2: 改进费用计算逻辑

在 `prompts` 的 `useMemo` 中，修改费用计算部分（约第 225-312 行）：

```typescript
// 🆕 添加费用明细记录
const costDetails: CostDetailItem[] = [];

// 向后查找该指令对应的所有 assistant/system 消息
for (let j = i + 1; j < messages.length; j++) {
  const nextMessage = messages[j];
  const nextType = (nextMessage as any).type || (nextMessage.message as any)?.role;

  // 遇到下一个用户消息，停止统计
  if (nextType === 'user') break;

  if (nextType === 'assistant' || nextType === 'system') {
    // ... 现有的去重逻辑 ...

    // 🆕 记录费用明细
    const msgCostUsd = (nextMessage as any).costUSD ??
                      (nextMessage as any).totalCostUSD ??
                      (nextMessage as any).cost_usd ??
                      (nextMessage as any).total_cost_usd;

    // 判断消息类型
    let detailType: CostDetailItem['type'] = 'other';
    let description = '';

    if (nextType === 'system') {
      detailType = 'system';
      const subtype = (nextMessage as any).subtype;
      description = subtype ? `系统消息 (${subtype})` : '系统消息';
    } else if (nextMessage.message?.content) {
      const content = Array.isArray(nextMessage.message.content)
        ? nextMessage.message.content
        : [nextMessage.message.content];

      // 检查是否包含工具调用
      const hasToolUse = content.some((block: any) => block.type === 'tool_use');
      // 检查是否包含思考
      const hasThinking = content.some((block: any) => block.type === 'thinking');

      if (hasThinking) {
        detailType = 'thinking';
        description = 'Claude Code 思考';
      } else if (hasToolUse) {
        detailType = 'tool_call';
        const toolNames = content
          .filter((block: any) => block.type === 'tool_use')
          .map((block: any) => block.name)
          .join(', ');
        description = `工具调用: ${toolNames}`;
      } else {
        detailType = 'assistant';
        description = 'AI 回复';
      }
    }

    // 添加到费用明细
    if (msgCostUsd && msgCostUsd > 0) {
      costDetails.push({
        type: detailType,
        description,
        cost: msgCostUsd,
        tokens: {
          input: extractedTokens.input_tokens,
          output: extractedTokens.output_tokens,
          cacheRead: extractedTokens.cache_read_tokens,
          cacheWrite: extractedTokens.cache_creation_tokens,
        },
        model: msgModel,
        engine: msgEngine,
        messageIndex: j,
      });
    }
  }
}

// 在 items.push 时添加 costDetails
items.push({
  promptIndex,
  content: text,
  timestamp: (message as any).sentAt || (message as any).timestamp,
  tokens,
  cost: totalTokens > 0 ? cost : undefined,
  toolCalls: totalToolCalls > 0 ? { total: totalToolCalls, byType: toolCallsMap } : undefined,
  thinking: thinkingCount > 0 ? { count: thinkingCount, tokens: thinkingTokens } : undefined,
  cacheHitRate,
  engine: displayEngine,
  model: displayModel,
  costDetails: costDetails.length > 0 ? costDetails : undefined, // 🆕 添加费用明细
});
```

### 步骤 3: 实现费用明细 Tooltip UI

在渲染费用的地方（约第 600-700 行），修改为：

```typescript
{prompt.cost !== undefined && (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-mono text-sm cursor-help">
          <Zap className="w-3.5 h-3.5" />
          <span>${formatCost(prompt.cost)}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-md">
        <div className="space-y-2">
          <div className="font-semibold text-sm border-b pb-1">
            费用明细 (总计: ${formatCost(prompt.cost)})
          </div>

          {prompt.costDetails && prompt.costDetails.length > 0 ? (
            <div className="space-y-1.5 text-xs">
              {prompt.costDetails.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-start gap-3 py-1 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {detail.description}
                    </div>
                    {detail.tokens && (
                      <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                        {detail.tokens.input}/{detail.tokens.output}
                        {detail.tokens.cacheRead > 0 && ` (缓存:${detail.tokens.cacheRead})`}
                      </div>
                    )}
                    {detail.model && (
                      <div className="text-muted-foreground mt-0.5 text-[10px]">
                        {detail.model}
                      </div>
                    )}
                  </div>
                  <div className="text-amber-500 dark:text-amber-400 font-mono font-medium whitespace-nowrap">
                    ${formatCost(detail.cost)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              无详细费用信息
            </div>
          )}

          {prompt.tokens && (
            <div className="text-xs text-muted-foreground pt-1 border-t">
              <div>总 Token: {prompt.tokens.total.toLocaleString()}</div>
              <div className="font-mono">
                输入: {prompt.tokens.input.toLocaleString()} |
                输出: {prompt.tokens.output.toLocaleString()}
                {prompt.tokens.cacheRead > 0 && ` | 缓存: ${prompt.tokens.cacheRead.toLocaleString()}`}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

### 步骤 4: 测试

1. 启动开发版本：`pnpm tauri dev`
2. 发送一条提示词
3. 观察提示词导航中的费用是否实时更新
4. 鼠标悬停在费用上，查看是否显示详细明细
5. 验证明细中是否包含：
   - 系统消息
   - 工具调用
   - 思考
   - AI 回复
   - Token 统计
   - 模型信息

## 预期效果

- 当用户发送提示词后，费用会随着 Claude Code 的响应实时更新
- 每当有新消息到达，`lastMessagesCostSignal` 会触发重新计算
- 鼠标悬停在费用上时，显示详细的费用明细
- 费用明细按消息类型分类，显示描述、Token 统计、模型信息

## 注意事项

1. 费用明细只记录有 `cost_usd` 字段的消息
2. 消息类型判断优先级：思考 > 工具调用 > AI 回复 > 系统消息
3. Tooltip 使用 Radix UI 的 Tooltip 组件，确保已导入
4. 费用格式化使用现有的 `formatCost` 函数

## 调试

如果费用不更新，检查：
1. `lastMessagesCostSignal` 是否正确触发
2. 控制台是否有 `[PromptNavigator]` 的调试日志
3. `costDetails` 数组是否正确填充

如果 Tooltip 不显示，检查：
1. Tooltip 组件是否正确导入
2. `costDetails` 是否有数据
3. CSS 样式是否正确
