# 消息显示被覆盖问题修复

## 问题描述
用户在 Fangyu Code 中和 Claude 聊天时，Claude 调用工具前后有时会说一句话，但那句话刚说完就被覆盖了。

## 根本原因分析

经过代码审查，发现 **3 个导致消息被覆盖的关键问题**：

### 问题 1：消息聚合逻辑过于激进（最可能的原因）
**位置**：`src/lib/subagentGrouping.ts` 的 `getTechnicalMessageType()` 函数

系统会自动将连续的"技术性消息"（仅包含工具调用或思考块的消息）聚合成一个消息组。聚合时会检查消息是否包含"真实文本内容"，但判断逻辑有缺陷：

```typescript
const hasRealContent = trimmedText.length > 0 &&
                      !trimmedText.match(/^<\/?[a-z_]+>$/i);
```

**问题**：如果 Claude 说的话被误判为"仅包含标签"或"空白"，就会被聚合到前面的工具调用消息中，导致用户看不到这句话。

### 问题 2：消息去重逻辑可能误删消息
**位置**：`src/hooks/useMessageTranslation.ts` 和 `src/hooks/useSessionStream.ts`

当消息有相同 ID 时，系统会用新消息**替换**旧消息，而不是保留两者：

```typescript
if (processedMessageIds.current.has(messageId)) {
  // 已存在，更新而非追加
  onMessagesUpdate((prev) => {
    return prev.map((msg) => {
      if (existingId === messageId) {
        return processedMessage; // 直接替换！
      }
      return msg;
    });
  });
}
```

**问题**：Claude 可能在同一个消息 ID 下先发送文本，再发送工具调用。如果工具调用消息覆盖了文本消息，用户就看不到 Claude 说的话了。

### 问题 3：消息 ID 生成不够唯一
**位置**：`src/hooks/usePromptExecution.ts` 的 `getClaudeMessageId()` 函数

```typescript
if (msg.timestamp) return `claude-${msg.timestamp}-${msg.type}`;
```

**问题**：如果两条消息有相同的 timestamp 和 type，它们会被认为是同一条消息，导致后者覆盖前者。

## 用户故事

### US-1: 工具调用前的文本应该保留
**作为** Fangyu Code 用户
**我希望** 当 Claude 在调用工具前说了一句话时，这句话能够正常显示
**以便** 我能理解 Claude 为什么要执行这个操作

**验收标准**：
- Claude 说 "我来帮你执行这个命令" 后调用工具，两者都应该显示
- 文本消息不应该被工具调用消息覆盖
- 消息顺序应该正确（先文本，后工具）

### US-2: 工具调用后的文本应该保留
**作为** Fangyu Code 用户
**我希望** 当 Claude 在工具执行完成后说了一句话时，这句话能够正常显示
**以便** 我能看到 Claude 对工具执行结果的解释

**验收标准**：
- 工具执行完成后 Claude 的解释文本应该显示
- 文本不应该被后续消息覆盖

### US-3: 消息去重不应该丢失内容
**作为** Fangyu Code 用户
**我希望** 消息去重逻辑不会导致有意义的内容丢失
**以便** 我能看到 Claude 的完整回复

**验收标准**：
- 相同 ID 的消息应该合并内容，而不是简单替换
- 文本内容和工具调用应该都保留

## 技术要求

### TR-1: 改进消息聚合判断逻辑
- 修改 `getTechnicalMessageType()` 函数
- 更严格地判断"真实文本内容"
- 对于包含 Claude 说话内容的消息，即使很短也不应该聚合
- 添加调试日志，记录所有被聚合的消息

### TR-2: 改进消息去重逻辑
- 修改 `useMessageTranslation.ts` 中的消息更新逻辑
- 相同 ID 的消息应该**合并**内容，而不是简单替换
- 保留文本内容和工具调用

### TR-3: 改进消息 ID 生成
- 修改 `getClaudeMessageId()` 函数
- 确保每条消息都有唯一的 ID
- 考虑使用 uuid 或更精确的时间戳

## 影响范围

| 文件 | 修改类型 |
|------|----------|
| `src/lib/subagentGrouping.ts` | 修改聚合逻辑 |
| `src/hooks/useMessageTranslation.ts` | 修改去重逻辑 |
| `src/hooks/usePromptExecution.ts` | 修改 ID 生成 |
