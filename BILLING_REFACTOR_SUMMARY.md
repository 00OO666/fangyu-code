# Claude Code 计费统计重构总结

**日期**: 2026-01-06
**版本**: Fangyu Code v2.2.0+

---

## 📊 Claude Code 官方计费规则（2026年1月）

### 1. 订阅计划
- **Pro**: $20/月（年付 $17/月）- 包含 Claude Code 访问
- **Max**: $100/月（5×使用量）或 $200/月（20×使用量）
- **Team Premium**: $150/人/月（最少5人）

### 2. API Token 计费（按使用量）

#### Opus 4.5（最智能，适合 Agent 和编码）
- Input: $5/MTok
- Output: $25/MTok
- Cache Write: $6.25/MTok
- Cache Read: $0.50/MTok

#### Sonnet 4.5（平衡性能和成本）⚠️ **分层定价**
- **≤200K tokens**:
  - Input: $3/MTok
  - Output: $15/MTok
  - Cache Write: $3.75/MTok
  - Cache Read: $0.30/MTok
- **>200K tokens**:
  - Input: $6/MTok
  - Output: $22.50/MTok
  - Cache Write: $7.50/MTok
  - Cache Read: $0.60/MTok

#### Haiku 4.5（最快最便宜）
- Input: $1/MTok
- Output: $5/MTok
- Cache Write: $1.25/MTok
- Cache Read: $0.10/MTok

### 3. 额外功能计费
- **Web Search**: $10/1000次搜索
- **Code Execution**: 每天50小时免费，超出后 $0.05/小时/容器

### 4. 关键计费要点
- ✅ **Extended Thinking tokens** 已包含在 output tokens 中
- ✅ **Prompt Caching** 可节省大量成本（cache read 比 write 便宜 10-12.5 倍）
- ✅ **Batch Processing** 可节省 50% 成本（适用于非紧急任务）
- ✅ **Sonnet 4.5 分层定价**：超过 200K tokens 时价格翻倍

---

## 🔧 重构内容

### 1. 更新 `src/lib/pricing.ts`

#### 新增功能
- ✅ **Sonnet 4.5 分层定价支持**
  - 新增 `getClaudeSonnetTieredPricing()` 函数
  - 根据 prompt tokens 数量自动选择定价层级
  - 与 Gemini 分层定价逻辑保持一致

#### 改进注释
- ✅ 更新文件头部注释，说明：
  - Extended Thinking tokens 处理方式
  - Prompt Caching 节省成本的原理
  - Sonnet 4.5 分层定价规则
  - 优先使用 Claude CLI 返回的 costUSD 字段

#### 代码变更
```typescript
// 新增函数
function getClaudeSonnetTieredPricing(promptTokens: number): ModelPricing {
  const isOver200k = promptTokens > 200_000;
  return {
    input: isOver200k ? 6.0 : 3.0,
    output: isOver200k ? 22.5 : 15.0,
    cacheWrite: isOver200k ? 7.5 : 3.75,
    cacheRead: isOver200k ? 0.6 : 0.3,
  };
}

// 更新 calculateMessageCost() 函数
// 自动检测 Sonnet 4.5 并应用分层定价
```

### 2. 更新 `src/lib/sessionCost.ts`

#### 改进注释
- ✅ 明确说明 `costUSD` 字段包含的内容：
  - Extended Thinking tokens
  - 分层定价
  - 所有 token 类型的准确计费
- ✅ 说明回退逻辑：优先使用 CLI 返回值，否则本地计算

### 3. 更新 `src/components/PromptNavigator.tsx`

#### 改进注释
- ✅ 统一注释风格，与 `sessionCost.ts` 保持一致
- ✅ 明确说明费用计算的优先级和回退逻辑

---

## ✅ 验证清单

### 计费准确性
- [x] Opus 4.5 定价正确（$5/$25）
- [x] Sonnet 4.5 分层定价正确（≤200K: $3/$15, >200K: $6/$22.5）
- [x] Haiku 4.5 定价正确（$1/$5）
- [x] Prompt Caching 定价正确（write/read 比例 10-12.5:1）
- [x] 优先使用 Claude CLI 返回的 costUSD 字段
- [x] 回退到本地计算时支持分层定价

### 功能完整性
- [x] 会话统计显示准确费用
- [x] 提示词导航显示每条指令的费用明细
- [x] 费用明细包含：系统消息、工具调用、思考、AI回复
- [x] 支持多引擎（Claude、Codex、Gemini）
- [x] 支持多模型场景（同一会话使用不同模型）

### 用户体验
- [x] 费用显示清晰（提示词费用 vs 会话总费用）
- [x] Tooltip 提供详细的费用分解
- [x] 缓存命中率显示（帮助用户优化成本）
- [x] 模型信息显示（engine · model）

---

## 📈 成本优化建议

### 1. 使用 Prompt Caching
- **节省**: 缓存读取比写入便宜 10-12.5 倍
- **适用场景**: 重复使用相同的系统提示词、项目上下文
- **实现**: Fangyu Code 已自动支持

### 2. 选择合适的模型
- **Haiku 4.5**: 简单任务（文件读取、搜索）- 最便宜
- **Sonnet 4.5**: 开发任务（编辑、重构）- 平衡性价比
- **Opus 4.5**: 复杂任务（架构设计、难bug）- 最智能

### 3. 注意 Sonnet 4.5 分层定价
- **≤200K tokens**: $3/$15（标准价格）
- **>200K tokens**: $6/$22.5（价格翻倍）
- **建议**: 控制单次对话的上下文长度，避免超过 200K

### 4. 使用 Batch Processing
- **节省**: 50% 成本
- **适用场景**: 非紧急任务（批量处理、数据分析）
- **限制**: 需要等待处理完成

---

## 🔗 参考资料

- [Anthropic 官方定价](https://www.anthropic.com/pricing)
- [Claude Code 定价指南](https://blog.promptlayer.com/claude-code-pricing-how-to-save-money/)
- [OpenAI 定价](https://platform.openai.com/docs/pricing)
- [Gemini 定价](https://ai.google.dev/gemini-api/docs/pricing)

---

## 📝 后续优化建议

1. **实时费用预估**: 在输入框显示预估费用（基于当前上下文长度）
2. **费用预警**: 当单次对话费用超过阈值时提醒用户
3. **成本分析报告**: 生成每日/每周/每月的费用分析报告
4. **模型推荐**: 根据任务类型自动推荐最合适的模型
5. **缓存优化建议**: 分析哪些提示词适合使用缓存

---

**重构完成时间**: 2026-01-06
**测试状态**: ✅ 通过
**部署状态**: 待用户确认后部署
