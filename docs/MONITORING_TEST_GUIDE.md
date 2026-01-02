# 监控服务测试指南

> **测试 Fangyu Code 的错误监控和消息去重功能**

---

## ✅ 文件验证

所有监控服务文件已创建：

- ✅ `src/hooks/useMessageDeduplication.ts` - 消息去重 Hook
- ✅ `src/hooks/useConsoleMonitor.ts` - Console 监控 Hook
- ✅ `src/components/ErrorMonitorPanel.tsx` - 错误监控面板
- ✅ `src/services/devToolsAutoMonitor.ts` - DevTools 自动监控服务
- ✅ `src/tests/monitoring.test.ts` - 单元测试（需要安装 Vitest）

---

## 🧪 测试方法

### 方法 1：浏览器控制台测试（推荐）

在 Fangyu Code 运行时，打开浏览器开发者工具（F12），在控制台执行以下测试：

#### 测试 1：消息去重逻辑

```javascript
// 模拟重复消息
const messages = [
  { message: { id: "msg-1", content: "Hello" } },
  { message: { id: "msg-1", content: "Hello (updated)" } },
  { message: { id: "msg-2", content: "World" } },
  { message: { id: "msg-2", content: "World (updated)" } },
  { message: { id: "msg-3", content: "Test" } }
];

// 去重逻辑
const messageMap = new Map();
for (const msg of messages) {
  const id = msg?.message?.id;
  if (id) {
    messageMap.set(id, msg);
  }
}

console.log("原始消息数:", messages.length);
console.log("去重后消息数:", messageMap.size);
console.log("重复消息数:", messages.length - messageMap.size);

// 预期结果：原始 5 条 → 去重后 3 条 → 重复 2 条
```

#### 测试 2：幂等性 Key 生成

```javascript
// 测试幂等性 Key
function createIdempotencyKey(prefix, data) {
  const dataStr = JSON.stringify(data);
  const hash = Array.from(dataStr).reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

const data1 = { text: "Hello", timestamp: 123456 };
const data2 = { text: "Hello", timestamp: 123456 };
const data3 = { text: "World", timestamp: 123456 };

const key1 = createIdempotencyKey("prompt", data1);
const key2 = createIdempotencyKey("prompt", data2);
const key3 = createIdempotencyKey("prompt", data3);

console.log("Key 1:", key1);
console.log("Key 2:", key2);
console.log("Key 3:", key3);
console.log("Key 1 === Key 2:", key1 === key2); // 应该为 true
console.log("Key 1 === Key 3:", key1 === key3); // 应该为 false
```

#### 测试 3：错误严重性分类

```javascript
function determineSeverity(message) {
  const msg = message.toLowerCase();

  if (msg.includes("uncaught") || msg.includes("fatal")) {
    return "critical";
  }
  if (msg.includes("error") || msg.includes("failed")) {
    return "high";
  }
  if (msg.includes("warning") || msg.includes("deprecated")) {
    return "medium";
  }
  return "low";
}

const testCases = [
  { message: "Uncaught Error: Something went wrong", expected: "critical" },
  { message: "Network request failed", expected: "high" },
  { message: "Warning: deprecated API", expected: "medium" },
  { message: "Info: loading complete", expected: "low" }
];

testCases.forEach(({ message, expected }) => {
  const severity = determineSeverity(message);
  console.log(`✓ "${message}" → ${severity} (expected: ${expected})`);
  console.assert(severity === expected, `Failed: expected ${expected}, got ${severity}`);
});
```

---

### 方法 2：集成测试（实际应用）

#### 步骤 1：启动 Fangyu Code

```bash
cd F:/Any-Code-Dev
npm run tauri:dev
```

#### 步骤 2：触发测试场景

**场景 A：测试消息去重**

1. 在 ClaudeCodeSession 中发送一条提示词
2. 打开浏览器控制台（F12）
3. 查看是否有 `[SessionCost] 🔧 去重` 日志
4. 检查会话统计是否正确（不应该重复计费）

**场景 B：测试 Console 监控**

1. 在浏览器控制台手动触发错误：
   ```javascript
   console.error("Test error: duplicate message detected");
   console.warn("Test warning: performance issue");
   ```

2. 点击右下角的"错误监控"按钮
3. 检查错误监控面板是否显示这些错误
4. 验证是否有修复建议

**场景 C：测试 DevTools 监控**（需要实现 Tauri 命令）

1. 确保 `call_mcp_tool` Tauri 命令已实现
2. 在 App.tsx 中启动监控：
   ```typescript
   import { devToolsMonitor } from '@/services/devToolsAutoMonitor';

   useEffect(() => {
     if (import.meta.env.DEV) {
       devToolsMonitor.startMonitoring("http://localhost:1420", {
         interval: 10,
         autoFix: true,
         severityThreshold: "medium"
       });
     }
   }, []);
   ```

3. 触发一些错误，观察是否自动检测

---

### 方法 3：单元测试（需要配置）

如果要运行单元测试，需要先安装 Vitest：

```bash
cd F:/Any-Code-Dev
npm install -D vitest @vitest/ui
```

然后在 `package.json` 中添加测试脚本：

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

运行测试：

```bash
npm test src/tests/monitoring.test.ts
```

---

## 📊 预期结果

### 消息去重测试

- ✅ 重复消息被正确识别和去除
- ✅ 保留最新版本的消息
- ✅ 没有 ID 的消息被保留
- ✅ 会话统计不会重复计费

### Console 监控测试

- ✅ 错误和警告被正确拦截
- ✅ 错误按类别分类（消息重复、状态更新、网络错误等）
- ✅ 提供智能修复建议
- ✅ 错误监控面板正确显示

### DevTools 监控测试

- ✅ 成功连接到 Chrome DevTools
- ✅ 实时监控 console 错误
- ✅ 检测网络请求失败
- ✅ 分析性能问题
- ✅ 自动生成修复建议

---

## 🐛 常见问题

### 问题 1：TypeScript 编译错误

**原因**：直接运行 `tsc` 不会使用项目的 tsconfig.json 配置

**解决**：使用 Vite 构建（`npm run build`）或开发模式（`npm run tauri:dev`）

### 问题 2：单元测试无法运行

**原因**：项目未安装 Vitest

**解决**：按照"方法 3"安装 Vitest，或使用浏览器控制台测试

### 问题 3：DevTools 监控无法启动

**原因**：`call_mcp_tool` Tauri 命令未实现

**解决**：参考 `DEVTOOLS_MONITORING_GUIDE.md` 实现 Tauri 命令

---

## ✅ 测试清单

- [ ] 消息去重逻辑正确
- [ ] 幂等性 Key 生成一致
- [ ] 错误严重性分类准确
- [ ] Console 监控正常工作
- [ ] 错误监控面板显示正确
- [ ] 修复建议合理
- [ ] DevTools 监控集成（可选）

---

## 📚 相关文档

- [错误监控使用指南](./ERROR_MONITORING_GUIDE.md)
- [DevTools 监控集成指南](./DEVTOOLS_MONITORING_GUIDE.md)

---

**🎉 完成测试后，你的 Fangyu Code 将具备完整的错误监控和自动修复能力！**
