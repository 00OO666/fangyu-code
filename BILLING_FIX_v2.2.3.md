# Fangyu Code v2.2.3 - 会话计费修复

## 问题描述

**用户报告：** "为什么我和你聊天的时候这费用竟然在减少？那可是我的token消耗计费费用"

**症状：**
- 会话费用在对话过程中不增反减
- 费用统计不准确，无法反映真实的 token 消耗

## 根本原因

v2.2.1 和 v2.2.2 在 `sessionCost.ts` 中添加了**消息级别的去重逻辑**（lines 62-93），试图解决"5x token bug"。但这个去重逻辑存在问题：

```typescript
// ❌ 问题代码
for (const msg of messages) {
  const id = (msg as any)?.message?.id || (msg as any).id || (msg as any).uuid;

  if (id) {
    const existingIndex = seenIds.get(id);
    if (existingIndex !== undefined) {
      // 替换为最新版本（后面的消息通常更完整）
      deduplicatedMessages[existingIndex] = msg; // 在原位置替换
    } else {
      seenIds.set(id, deduplicatedMessages.length);
      deduplicatedMessages.push(msg);
    }
  }
}
```

**问题分析：**

1. **双重去重冲突**
   - 消息级别去重（基于 message ID）
   - eventMap 去重（基于 billing key）
   - 两层去重逻辑相互干扰

2. **替换逻辑问题**
   - 在原位置替换消息可能导致顺序混乱
   - 流式更新的消息可能被错误处理

3. **过度去重**
   - 可能移除了应该计费的合法消息
   - 导致费用统计偏低甚至减少

## 解决方案

### 核心思路

参考 Any-Code 的简洁实现，采用**单层去重**策略：

- ❌ 移除消息级别的去重（lines 62-93）
- ✅ 保留 eventMap 去重（基于 billing key，更可靠）
- ✅ 保留 cost_usd 优先级（使用 Claude CLI 官方计费）
- ✅ 保留 session default model 提取（提高准确性）

### 代码对比

#### Any-Code 的实现（简洁版）

```typescript
export function aggregateSessionCost(messages: ClaudeStreamMessage[]): SessionCostAggregation {
  const eventMap = new Map<string, MutableBillingEvent>();

  messages.forEach((message, index) => {
    // 直接处理消息，不做预去重
    const engine = getEngineType(message);
    // ... 处理逻辑

    // 使用 eventMap 去重（基于 billing key）
    const key = getBillingKey(message, index);
    const existing = eventMap.get(key);
    if (!existing || totalTokenCount > existing.totalTokenCount) {
      eventMap.set(key, { ... });
    }
  });

  // ... 返回结果
}
```

#### Fangyu Code v2.2.3（优化版）

```typescript
export function aggregateSessionCost(messages: ClaudeStreamMessage[]): SessionCostAggregation {
  const eventMap = new Map<string, MutableBillingEvent>();

  // ✅ 提取 session default model（保留，提高准确性）
  let sessionDefaultModel: string | undefined;
  for (const msg of messages) {
    if ((msg as any).type === "system" && (msg as any).subtype === "init") {
      sessionDefaultModel = (msg as any).model;
      if (sessionDefaultModel) break;
    }
  }

  messages.forEach((message, index) => {
    const engine = getEngineType(message);
    // ... 处理逻辑

    const key = getBillingKey(message, index);
    const model = getModelName(message, engine, sessionDefaultModel);

    // ✅ 优先使用 Claude CLI 的 cost_usd（保留，更准确）
    const actualCostUsd =
      (message as any).costUSD ??
      (message as any).totalCostUSD ??
      (message as any).cost_usd ??
      (message as any).total_cost_usd;
    const cost =
      typeof actualCostUsd === "number" && actualCostUsd > 0
        ? actualCostUsd
        : calculateMessageCost(tokens, model, engine);

    // ✅ 使用 eventMap 去重（单层去重，更可靠）
    const existing = eventMap.get(key);
    if (
      !existing ||
      totalTokenCount > existing.totalTokenCount ||
      (totalTokenCount === existing.totalTokenCount &&
        (timestampMs ?? 0) >= (existing.timestampMs ?? 0))
    ) {
      eventMap.set(key, { ... });
    }
  });

  // ... 返回结果
}
```

### 关键改进

| 项目 | v2.2.2（问题版本） | v2.2.3（修复版本） |
|------|-------------------|-------------------|
| **消息级别去重** | ✅ 有（lines 62-93） | ❌ 移除 |
| **eventMap 去重** | ✅ 有 | ✅ 保留 |
| **Debug 日志** | ✅ 大量日志 | ❌ 移除（减少噪音） |
| **cost_usd 优先** | ✅ 有 | ✅ 保留（更准确） |
| **Session Model** | ✅ 有 | ✅ 保留（更准确） |
| **代码复杂度** | 高（双重去重） | 低（单层去重） |

## 技术细节

### eventMap 去重机制

```typescript
const eventMap = new Map<string, MutableBillingEvent>();

// Billing key 生成优先级：
// 1. message.message.id
// 2. message.id
// 3. message.uuid
// 4. message.timestamp
// 5. index（最后手段）

const key = getBillingKey(message, index);

// 去重规则：
// - 如果 key 不存在，添加
// - 如果新消息 tokens 更多，替换（流式更新场景）
// - 如果 tokens 相同但时间戳更新，替换
if (
  !existing ||
  totalTokenCount > existing.totalTokenCount ||
  (totalTokenCount === existing.totalTokenCount &&
    (timestampMs ?? 0) >= (existing.timestampMs ?? 0))
) {
  eventMap.set(key, { ... });
}
```

**为什么 eventMap 去重更可靠？**

1. **基于 billing key**：使用消息的唯一标识符（ID/UUID/timestamp）
2. **智能替换**：只在消息更完整时替换（tokens 更多或时间更新）
3. **单一职责**：专注于计费去重，不干扰消息流

### cost_usd 优先级

```typescript
// 优先使用 Claude CLI 返回的官方计费
const actualCostUsd =
  (message as any).costUSD ??
  (message as any).totalCostUSD ??
  (message as any).cost_usd ??
  (message as any).total_cost_usd;

// 只有在没有官方计费时才自行计算
const cost =
  typeof actualCostUsd === "number" && actualCostUsd > 0
    ? actualCostUsd
    : calculateMessageCost(tokens, model, engine);
```

**为什么优先使用 cost_usd？**

- Claude CLI 的计费包含 Extended Thinking tokens
- 官方计费比自行计算更准确
- 避免计费差异和用户困惑

### Session Default Model

```typescript
// 从 system:init 消息中提取会话默认模型
let sessionDefaultModel: string | undefined;
for (const msg of messages) {
  if ((msg as any).type === "system" && (msg as any).subtype === "init") {
    sessionDefaultModel = (msg as any).model;
    if (sessionDefaultModel) break;
  }
}

// 在 getModelName 中使用
function getModelName(message, engine, sessionDefaultModel) {
  // 1. 尝试从消息中提取模型
  // 2. 使用 session default model
  // 3. 使用引擎默认模型
  if (sessionDefaultModel) {
    return sessionDefaultModel;
  }
  // ...
}
```

**为什么需要 session default model？**

- 某些消息可能不包含 model 字段
- 使用会话级别的默认模型更准确
- 避免错误地使用 fallback 模型导致计费偏差

## 修改文件

### 主要修改

- **`src/lib/sessionCost.ts`**
  - 移除消息级别去重（lines 62-93）
  - 移除所有 debug 日志
  - 保留 cost_usd 优先级
  - 保留 session default model 提取
  - 简化 getBillingKey（移除警告）
  - 清理注释，保持代码简洁

### 未修改（保留 UI 功能）

- **`src/hooks/useSessionCostCalculation.ts`** - 保持不变
- **`src/components/ClaudeCodeSession.tsx`** - 保持不变
- **UI 动画和费用增加效果** - 完全保留

## 验证方法

### 1. 检查费用是否正确增加

在浏览器控制台（F12）中观察：

```javascript
// 费用应该随着对话持续增加
// ✅ 正确：$0.50 → $0.75 → $1.00 → $1.25
// ❌ 错误：$0.50 → $0.45 → $0.40（减少）
```

### 2. 检查 token 统计

```javascript
// 查看会话统计面板
// - Total tokens 应该持续增加
// - Total cost 应该持续增加
// - 不应该出现减少的情况
```

### 3. 对比 Claude CLI 计费

```bash
# 在终端中运行相同的对话
# 对比 Fangyu Code 和 Claude CLI 的费用
# 应该基本一致（误差 < 5%）
```

## 预期效果

### 修复前（v2.2.2）

```
对话 1: $0.50
对话 2: $0.45  ❌ 减少了！
对话 3: $0.40  ❌ 继续减少！
```

### 修复后（v2.2.3）

```
对话 1: $0.50
对话 2: $0.75  ✅ 正确增加
对话 3: $1.00  ✅ 继续增加
```

## 经验教训

### 1. 避免过度优化

- 消息级别去重看似合理，实际引入了复杂性
- 单层去重（eventMap）已经足够可靠
- **KISS 原则**：Keep It Simple, Stupid

### 2. 参考成熟实现

- Any-Code 的实现经过实战验证
- 简洁的代码更容易维护和调试
- 不要重新发明轮子

### 3. 充分测试

- 计费逻辑是核心功能，必须充分测试
- 应该测试边界情况（流式更新、消息重复等）
- 用户反馈是最好的测试

### 4. 保留有价值的改进

- cost_usd 优先级是好的改进，保留
- session default model 提高准确性，保留
- debug 日志在开发时有用，但生产环境应移除

## 下一步

1. **测试验证**
   - 在 Fangyu Code 中进行多轮对话
   - 验证费用是否正确增加
   - 对比 Claude CLI 的计费

2. **版本发布**
   - 更新版本号到 2.2.3
   - 更新 CHANGELOGS
   - 推送到 GitHub

3. **文档更新**
   - 更新技术文档
   - 记录修复过程和经验教训

---

**文档版本：** v1.0
**创建时间：** 2026-01-03
**作者：** Claude Opus 4.5
**修复版本：** v2.2.3
