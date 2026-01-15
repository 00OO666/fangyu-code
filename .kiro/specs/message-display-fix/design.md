# 消息显示被覆盖问题 - 技术设计

## 设计概述

本设计解决 Claude 聊天中消息被覆盖的问题，通过三个层面的修复确保消息完整显示。

## 详细设计

### 1. 改进消息聚合判断逻辑

**文件**: `src/lib/subagentGrouping.ts`

**当前问题**:
```typescript
// 当前逻辑：只检查文本是否为空或仅包含标签
const hasRealContent = trimmedText.length > 0 &&
                      !trimmedText.match(/^<\/?[a-z_]+>$/i);
```

**修复方案**:
```typescript
function getTechnicalMessageType(message: ClaudeStreamMessage): "tool" | "thinking" | null {
  // ... 现有逻辑 ...

  content.forEach((item: any) => {
    if (item.type === "text") {
      const text = item.text || '';
      const trimmedText = text.trim();
      
      // 🔧 FIX: 更严格的文本检测
      // 1. 忽略空白
      // 2. 忽略仅包含 XML 标签的文本（如 <thinking></thinking>）
      // 3. 忽略仅包含换行符的文本
      // 4. 但保留任何有意义的文本，即使很短
      const isEmptyOrTag = 
        trimmedText.length === 0 ||
        /^<\/?[a-z_]+>$/i.test(trimmedText) ||
        /^[\s\n\r]*$/.test(trimmedText);
      
      if (!isEmptyOrTag) {
        hasText = true;
        // 🔍 DEBUG: 记录包含文本的消息
        console.log('[subagentGrouping] ✅ Message has real text:', {
          uuid: message.uuid,
          textPreview: trimmedText.substring(0, 100),
          textLength: trimmedText.length
        });
      }
    }
  });

  // 如果包含可见文本，不可聚合
  if (hasText) {
    console.log('[subagentGrouping] ❌ NOT aggregating (has text):', message.uuid);
    return null;
  }
  
  // ... 其余逻辑 ...
}
```

### 2. 改进消息去重逻辑

**文件**: `src/hooks/useMessageTranslation.ts`

**当前问题**:
```typescript
// 当前逻辑：直接替换整个消息
if (processedMessageIds.current.has(messageId)) {
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

**修复方案**:
```typescript
if (processedMessageIds.current.has(messageId)) {
  // 已存在，智能合并而非简单替换
  onMessagesUpdate((prev) => {
    return prev.map((msg) => {
      const existingId = (msg as any)?.message?.id ||
        (msg as any).id ||
        (msg as any).uuid;
      
      if (existingId === messageId) {
        // 🔧 FIX: 智能合并消息内容
        return mergeMessages(msg, processedMessage);
      }
      return msg;
    });
  });
}

/**
 * 智能合并两条消息
 * - 保留两者的文本内容
 * - 保留两者的工具调用
 * - 保留 thinking 块
 */
function mergeMessages(
  existing: ClaudeStreamMessage, 
  incoming: ClaudeStreamMessage
): ClaudeStreamMessage {
  const existingContent = Array.isArray(existing.message?.content) 
    ? existing.message.content 
    : [];
  const incomingContent = Array.isArray(incoming.message?.content) 
    ? incoming.message.content 
    : [];

  // 提取各类型内容
  const existingText = existingContent.filter((item: any) => item.type === 'text');
  const existingTools = existingContent.filter((item: any) => 
    item.type === 'tool_use' || item.type === 'tool_result');
  const existingThinking = existingContent.filter((item: any) => item.type === 'thinking');

  const incomingText = incomingContent.filter((item: any) => item.type === 'text');
  const incomingTools = incomingContent.filter((item: any) => 
    item.type === 'tool_use' || item.type === 'tool_result');
  const incomingThinking = incomingContent.filter((item: any) => item.type === 'thinking');

  // 合并策略：
  // 1. 文本：如果新消息有文本，使用新文本；否则保留旧文本
  // 2. 工具：合并两者的工具调用（去重）
  // 3. Thinking：保留旧的 thinking（如果新消息没有）
  
  const mergedText = incomingText.length > 0 ? incomingText : existingText;
  const mergedThinking = incomingThinking.length > 0 ? incomingThinking : existingThinking;
  
  // 工具调用去重（按 id）
  const toolIds = new Set(existingTools.map((t: any) => t.id));
  const mergedTools = [
    ...existingTools,
    ...incomingTools.filter((t: any) => !toolIds.has(t.id))
  ];

  // 按顺序组合：thinking -> text -> tools
  const mergedContent = [...mergedThinking, ...mergedText, ...mergedTools];

  return {
    ...incoming,
    message: {
      ...incoming.message,
      content: mergedContent
    }
  };
}
```

### 3. 改进消息 ID 生成

**文件**: `src/hooks/usePromptExecution.ts`

**当前问题**:
```typescript
// 当前逻辑：使用 timestamp + type，可能不够唯一
if (msg.timestamp) return `claude-${msg.timestamp}-${msg.type}`;
```

**修复方案**:
```typescript
const getClaudeMessageId = (payload: string): string => {
  try {
    const msg = JSON.parse(payload) as ClaudeStreamMessage;
    
    // 优先使用消息自带的 ID
    if (msg.id) return `claude-${msg.id}`;
    if (msg.uuid) return `claude-${msg.uuid}`;
    if ((msg as any).message?.id) return `claude-${(msg as any).message.id}`;
    
    // 🔧 FIX: 使用更精确的组合 ID
    // 包含 timestamp + type + 内容哈希
    if (msg.timestamp) {
      const contentHash = hashContent(msg);
      return `claude-${msg.timestamp}-${msg.type}-${contentHash}`;
    }
  } catch {
    // Fall through to hash-based ID
  }
  
  // Fallback: use payload hash
  return `claude-${hashString(payload)}`;
};

/**
 * 计算消息内容的哈希值
 */
function hashContent(msg: ClaudeStreamMessage): string {
  const content = msg.message?.content;
  if (!content) return '0';
  
  const contentStr = JSON.stringify(content);
  return hashString(contentStr).toString(16).slice(0, 8);
}

/**
 * 字符串哈希函数
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

## 调试支持

添加调试日志，方便排查问题：

```typescript
// 在 useSessionStream.ts 中
const specificOutputUnlisten = await listen<string>(
  `${eventPrefix}-output:${sessionId}`,
  async (event) => {
    // 🔍 DEBUG: 记录原始消息
    try {
      const parsed = JSON.parse(event.payload);
      if (parsed.type === 'assistant' && parsed.message?.content) {
        const hasText = parsed.message.content.some((item: any) => 
          item.type === 'text' && item.text?.trim());
        const hasTools = parsed.message.content.some((item: any) => 
          item.type === 'tool_use');
        
        console.log('[useSessionStream] 📨 Received message:', {
          uuid: parsed.uuid,
          hasText,
          hasTools,
          contentTypes: parsed.message.content.map((item: any) => item.type)
        });
      }
    } catch (e) {
      // Ignore parsing errors in debug code
    }
    // ... 原有逻辑 ...
  }
);
```

## 测试场景

1. **场景 A**: Claude 说 "我来执行这个命令" → 调用工具
   - 预期：两条消息都显示

2. **场景 B**: 工具执行完成 → Claude 说 "执行成功"
   - 预期：工具结果和文本都显示

3. **场景 C**: Claude 在同一条消息中包含文本和工具调用
   - 预期：文本和工具调用都显示

4. **场景 D**: 快速连续发送多条消息
   - 预期：所有消息都显示，不丢失
