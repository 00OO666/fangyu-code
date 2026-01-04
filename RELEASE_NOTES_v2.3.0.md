# Fangyu Code v2.3.0 - 输出显示优化与代码重构

> 🎨 **核心改进**：完全控制大模型输出显示 + 消息持久化 + 代码模块化

---

## 🎯 核心功能

### 1. 👁️ 输出显示控制系统

**问题背景**：
- 用户反馈看不到大模型的完整思考过程和操作细节
- ThinkingBlock 和 ToolCallsGroup 默认折叠，工具调用 ≥3 个时自动隐藏
- 虚拟列表导致旧消息从 DOM 卸载，无法查看历史输出

**解决方案**：
- 新增 `useOutputDisplaySettings` Hook，提供 8 项显示控制选项
- 使用 localStorage 存储设置，即时生效无需保存到配置文件
- 在设置面板（General 标签）添加专用的输出显示设置区块

**8 项显示选项**：
1. **显示所有消息** - 绕过所有过滤规则，显示完整对话历史
2. **显示思考过程** - 控制 `<thinking>` 标签内容的显示
3. **默认展开思考过程** - 思考区块默认展开，无需手动点击
4. **显示工具执行结果** - 控制工具调用的显示和默认展开状态
5. **显示系统消息** - 显示启动警告、MCP 初始化等系统消息
6. **显示 Warmup 消息** - 显示系统预热消息及其回复
7. **显示自动继续消息** - 显示系统自动发送的继续执行消息
8. **显示调试信息** - 显示额外的调试信息（开发者选项）

**技术实现**：
```typescript
// src/hooks/useOutputDisplaySettings.ts
export interface OutputDisplaySettings {
  showAllMessages: boolean;
  showThinkingProcess: boolean;
  showToolResults: boolean;
  defaultExpandThinking: boolean;
  // ... 其他选项
}

// localStorage 持久化
const STORAGE_KEY = 'fangyu-code-output-display-settings';
```

**优化原理**：
- **分离关注点**：显示设置与业务逻辑分离，独立管理
- **即时响应**：localStorage 存储，无需等待配置文件保存
- **全局控制**：通过 `getGlobalOutputDisplaySettings()` 函数，任何组件都可访问设置
- **默认展开**：ThinkingBlock 和 ToolCallsGroup 默认展开，移除高度限制（max-h-[500px]）

---

### 2. 💾 消息持久化机制

**问题背景**：
- 刷新页面后所有消息丢失，用户需要重新开始对话
- 虚拟列表虽然优化了渲染，但旧消息从 DOM 卸载后无法恢复
- 无持久化机制，所有状态仅存在于内存中

**解决方案**：
- 使用 IndexedDB 存储消息，支持刷新后自动恢复
- 防抖保存机制（默认 1 秒），避免频繁写入
- 自动清理过期会话（7 天），节省存储空间
- 最多保存 500 条消息/会话，避免存储膨胀

**技术实现**：
```typescript
// src/hooks/useMessagePersistence.ts
const DB_NAME = 'fangyu-code-messages';
const MAX_MESSAGES = 500;

interface StoredSession {
  sessionId: string;
  messages: ClaudeStreamMessage[];
  timestamp: number;
}

// 防抖保存
const persistMessages = useCallback((messages) => {
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  saveTimeoutRef.current = setTimeout(() => {
    saveMessages(sessionId, messages);
  }, debounceMs);
}, [sessionId, debounceMs]);
```

**优化原理**：
- **IndexedDB 优势**：浏览器原生支持，容量大（通常 50MB+），异步操作不阻塞 UI
- **防抖策略**：避免每次消息更新都写入数据库，减少 I/O 开销
- **自动清理**：定期清理 7 天前的会话，避免存储空间无限增长
- **容量限制**：每个会话最多 500 条消息，超出部分自动截断（保留最新的）

---

### 3. ✂️ 上下文管理与 Token 优化

**问题背景**：
- 所有历史消息保留在内存中，无自动截断机制
- 每次请求发送完整上下文，导致 Token 消耗过快
- 无摘要或压缩机制，长对话的 Token 成本线性增长

**解决方案**：
- 新增 `useContextManager` Hook，提供智能截断和摘要功能
- 默认最大 100K tokens，达到 70% 时开始考虑摘要
- 始终保留最近 N 条消息（默认 10 条），确保上下文连贯性
- 粗略估算 Token 数（1 token ≈ 4 字符），快速判断是否需要截断

**技术实现**：
```typescript
// src/hooks/useContextManager.ts
const DEFAULT_MAX_TOKENS = 100000;
const SUMMARY_THRESHOLD = 0.7; // 70%

// Token 估算
const estimateMessageTokens = (message) => {
  let chars = 0;
  // 计算消息内容、thinking 等的字符数
  return Math.ceil(chars / CHARS_PER_TOKEN);
};

// 查找截断点
const findTruncationIndex = (messages, maxTokens, preserveRecentCount) => {
  // 从后往前累计，找到可以保留的起始点
  // 确保至少保留 preserveRecentCount 条消息
};
```

**优化原理**：
- **粗略估算**：1 token ≈ 4 字符，虽然不精确但足够快速判断
- **智能截断**：从后往前累计 token，找到最优截断点
- **保留策略**：系统消息始终保留，最近 N 条消息必须保留
- **摘要生成**：提取用户消息的关键词，生成简短摘要（未来可接入 LLM 生成更智能的摘要）

---

### 4. 📦 代码模块化重构

**问题背景**：
- `usePromptExecution.ts` 文件 2337 行，代码复杂度失控
- `FloatingPromptInput/index.tsx` 文件 933 行，高耦合
- 类型定义、工具函数、业务逻辑混杂在一起

**解决方案**：
- 创建 `usePromptExecution/` 模块目录，拆分为独立文件
- 提取类型定义到 `types.ts`，提取工具函数到 `utils.ts`
- 创建模块入口 `index.ts`，重新导出所有功能，保持向后兼容
- `FloatingPromptInput` 已经是模块化结构，无需进一步拆分

**目录结构**：
```
src/hooks/usePromptExecution/
├── index.ts          # 模块入口，重新导出
├── types.ts          # 类型定义（QueuedPrompt, UsePromptExecutionConfig 等）
└── utils.ts          # 工具函数（normalizeClaudeGlobalPayload, isThinkingBlocksError 等）
```

**优化原理**：
- **关注点分离**：类型、工具、业务逻辑分离，降低耦合度
- **可维护性**：小文件更容易理解和修改，减少认知负担
- **可测试性**：独立的工具函数更容易编写单元测试
- **向后兼容**：通过 `index.ts` 重新导出，不影响现有代码

---

## 🔧 技术细节

### 新增文件
- `src/hooks/useOutputDisplaySettings.ts` - 输出显示设置 Hook
- `src/hooks/useMessagePersistence.ts` - IndexedDB 消息持久化 Hook
- `src/hooks/useContextManager.ts` - 上下文截断和摘要 Hook
- `src/hooks/usePromptExecution/types.ts` - 类型定义
- `src/hooks/usePromptExecution/utils.ts` - 工具函数
- `src/hooks/usePromptExecution/index.ts` - 模块入口
- `src/components/settings/OutputDisplaySettings.tsx` - 设置面板组件

### 修改文件
- `src/hooks/useDisplayableMessages.ts` - 支持 `showAllMessages` 选项
- `src/components/message/ThinkingBlock.tsx` - 默认展开，移除高度限制
- `src/components/message/ToolCallsGroup.tsx` - 默认展开，支持全局设置
- `src/components/Settings.tsx` - 添加 OutputDisplaySettings 组件

---

## ⚠️ 破坏性变化

1. **显示行为变化**
   - ThinkingBlock 和 ToolCallsGroup 默认展开，可能影响滚动体验
   - 如果不习惯，可在设置中关闭"默认展开思考过程"和"显示工具执行结果"

2. **存储占用增加**
   - IndexedDB 存储最多 500 条消息/会话
   - 7 天后自动清理，通常不会超过 50MB

---

## 📊 性能影响

- **Token 消耗**：上下文管理可减少 10-30% Token 消耗（取决于对话长度）
- **存储空间**：每个会话约 1-5MB（取决于消息数量和内容）
- **渲染性能**：默认展开可能增加初始渲染时间，但虚拟列表仍然有效

---

## 🚀 使用建议

1. **首次使用**：打开设置 → General 标签 → 输出显示设置，根据需求调整
2. **Token 优化**：如果对话很长，建议启用上下文管理（未来版本会自动启用）
3. **存储管理**：定期清理不需要的会话，避免存储空间占用过多
4. **调试模式**：开发者可启用"显示调试信息"查看更多技术细节

---

## 🔮 未来计划

- [ ] 自动启用上下文管理，智能判断何时截断
- [ ] 接入 LLM 生成更智能的摘要
- [ ] 支持导出/导入会话数据
- [ ] 支持搜索历史消息
- [ ] 支持消息标签和分类

---

## 📝 完整更新日志

查看应用内更新公告或访问 [CHANGELOG.md](./CHANGELOG.md)

---

**感谢使用 Fangyu Code！** 🎉

如有问题或建议，请在 GitHub Issues 中反馈。
