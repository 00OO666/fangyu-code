# Token 使用诊断报告

## 如何验证 Token 统计是否准确

### 方法 1: 检查浏览器控制台

1. 打开 Fangyu Code
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 输入以下命令查看当前会话的详细统计：

```javascript
// 获取当前会话的所有消息
const messages = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.getCurrentFiber?.()?.memoizedState?.messages || [];

// 统计 token 使用
let totalInput = 0;
let totalOutput = 0;
let totalCacheRead = 0;
let totalCacheWrite = 0;
let totalCost = 0;

messages.forEach(msg => {
  const usage = msg.usage || msg.message?.usage;
  if (usage) {
    totalInput += usage.input_tokens || 0;
    totalOutput += usage.output_tokens || 0;
    totalCacheRead += usage.cache_read_input_tokens || usage.cache_read_tokens || 0;
    totalCacheWrite += usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0;
  }
});

// 计算成本 (Claude Sonnet 4.5 定价)
const inputCost = (totalInput / 1_000_000) * 3.0;
const outputCost = (totalOutput / 1_000_000) * 15.0;
const cacheReadCost = (totalCacheRead / 1_000_000) * 0.3;
const cacheWriteCost = (totalCacheWrite / 1_000_000) * 3.75;
totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

console.log('=== Token 使用统计 ===');
console.log(`Input Tokens: ${totalInput.toLocaleString()}`);
console.log(`Output Tokens: ${totalOutput.toLocaleString()}`);
console.log(`Cache Read Tokens: ${totalCacheRead.toLocaleString()}`);
console.log(`Cache Write Tokens: ${totalCacheWrite.toLocaleString()}`);
console.log(`\n=== 成本明细 ===`);
console.log(`Input Cost: $${inputCost.toFixed(4)}`);
console.log(`Output Cost: $${outputCost.toFixed(4)}`);
console.log(`Cache Read Cost: $${cacheReadCost.toFixed(4)}`);
console.log(`Cache Write Cost: $${cacheWriteCost.toFixed(4)}`);
console.log(`\n总成本: $${totalCost.toFixed(4)}`);
```

### 方法 2: 检查会话历史文件

1. 打开文件资源管理器
2. 导航到：`C:\Users\666\.claude-sessions\`
3. 找到你的会话文件（按时间排序）
4. 用文本编辑器打开，搜索 `"usage"` 关键词
5. 手动统计所有的 token 使用情况

### 方法 3: 对比 API 日志

如果你使用的是第三方 API 代理（如 `https://hone.vvvv.ee`），可以：

1. 登录代理平台
2. 查看 API 调用日志
3. 对比每次调用的 token 使用情况
4. 检查是否有重复调用或失败重试

## 常见问题排查

### 问题 1: 多会话累积

**症状**: 平台显示的费用远高于单个会话

**排查方法**:
```bash
# 检查所有会话文件
cd C:\Users\666\.claude-sessions\
dir /o-d

# 统计所有会话的 token 使用
# (需要手动打开每个文件查看)
```

**解决方案**:
- 关闭不需要的标签页
- 定期清理旧会话

### 问题 2: 历史消息累积

**症状**: 每次发送消息后，input_tokens 越来越高

**原因**: Claude Code CLI 会自动加载完整的会话历史

**解决方案**:
- 使用 `/compact` 命令压缩会话历史
- 或者创建新会话（File > New Session）

### 问题 3: 缓存 Token 统计

**症状**: cache_read_tokens 很高，但成本计算不对

**检查**: 确认 cache_read_tokens 使用的是折扣价格（$0.3/M，而不是 $3/M）

**验证代码**:
```javascript
// 检查定价配置
const pricing = {
  input: 3.0,
  output: 15.0,
  cacheWrite: 3.75,
  cacheRead: 0.3  // 应该是 0.3，不是 3.0
};
```

## 建议的监控方案

### 1. 启用详细日志

在 Fangyu Code 设置中启用详细日志，记录每次 API 调用的 token 使用情况。

### 2. 定期导出统计

每天导出一次 token 使用统计，对比平台账单。

### 3. 设置预算警报

在平台上设置预算警报，当费用超过阈值时发送通知。

## 下一步行动

1. ✅ 运行上面的诊断脚本，获取当前会话的详细统计
2. ✅ 对比 Fangyu Code 显示的费用和脚本计算的费用
3. ✅ 检查平台上的 API 调用日志
4. ✅ 如果发现差异，提供具体的数据以便进一步分析

---

**生成时间**: 2026-01-07
**Fangyu Code 版本**: 检查 package.json 中的版本号
