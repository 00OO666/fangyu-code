# Fangyu Code - 文本输出被隐藏问题调试

## 问题描述

用户报告：Fangyu Code 中 Claude Code 的输出内容被"吞了"，只显示工具调用和最后的总结，不显示正常的文本响应。

## 已添加的调试日志

### 1. useDisplayableMessages Hook
- 记录处理的消息总数
- 记录每条被过滤的消息及原因
- 记录每条保留的消息类型

### 2. AIMessage Component
- 记录是否有文本内容
- 记录文本长度
- 记录是否有工具调用和思考块
- 记录原始消息内容结构

## 调试步骤

1. **打开 Fangyu Code**
2. **打开浏览器开发者工具** (F12)
3. **切换到 Console 标签**
4. **发送一条消息给 Claude**
5. **查看控制台输出**，寻找以下日志：
   - `[useDisplayableMessages] Processing X messages`
   - `[useDisplayableMessages] Keeping message at index X type: assistant`
   - `[AIMessage] Rendering: { hasText: true/false, ... }`

## 可能的原因

### 原因 1: 消息被过滤
如果看到 `[useDisplayableMessages] Filtered: ...` 日志，说明消息被过滤掉了。

**检查点：**
- 是否有 `isMeta` 标记？
- 是否被识别为 Warmup 消息？
- 是否被识别为自动继续消息？

### 原因 2: 文本提取失败
如果看到 `[AIMessage] Rendering: { hasText: false, ... }`，说明文本提取失败。

**检查点：**
- `messageContent` 的结构是什么？
- 是否有 `type: 'text'` 的内容项？
- `text` 字段是否存在？

### 原因 3: 渲染条件不满足
如果消息通过了过滤，但没有渲染。

**检查点：**
- 是否同时有工具调用和文本？
- 是否有 CSS 隐藏了文本？

## 下一步

根据控制台日志，我们可以确定：
1. 消息是否被过滤
2. 文本是否被正确提取
3. 渲染逻辑是否正确执行

请将控制台日志截图或复制给我，我会根据日志进一步诊断问题。

---

**创建时间：** 2026-01-03
**状态：** 等待用户测试反馈
