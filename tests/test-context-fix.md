# 上下文丢失问题修复测试

## 问题描述
在 Fangyu Code 中使用 Claude Code 引擎聊天时，每条指令都被当作新会话的第一条指令处理，导致无法看到历史上下文。

## 根本原因
在 `usePromptExecution.ts` 中，当收到 Claude 的 `system:init` 消息时：
- ✅ 正确设置了 `claudeSessionId`
- ❌ **没有设置 `isFirstPrompt = false`**

导致第二条消息发送时，虽然有 `effectiveSession`，但因为 `isFirstPrompt` 仍为 `true`，条件 `if (effectiveSession && !isFirstPrompt)` 不满足，又创建了新会话。

## 修复方案
在 `usePromptExecution.ts` 第 1717 行，设置 `claudeSessionId` 后立即添加：
```typescript
setIsFirstPrompt(false);
```

## 测试步骤

### 1. 启动 Fangyu Code
```bash
cd F:\Fangyu-Code-Dev
npm run dev
```

### 2. 打开开发者工具
按 `F12` 打开开发者工具，切换到 Console 标签页。

### 3. 发送第一条消息
在 Fangyu Code 中选择一个项目目录，发送第一条消息：
```
你好，请介绍一下你自己
```

### 4. 观察日志
在 Console 中查找以下日志：
```
[usePromptExecution] ✅ Session initialized: sessionId=xxx, isFirstPrompt set to false
```

### 5. 发送第二条消息
发送第二条消息：
```
你能看到我刚才说的话吗？
```

### 6. 观察日志
在 Console 中查找以下日志：
```
[usePromptExecution] 📊 Session State: isFirstPrompt=false, hasEffectiveSession=true, sessionId=xxx
```

### 7. 验证 API 调用
在日志中查找 API 调用：
- ✅ 第一条消息应该调用 `executeClaudeCode`（创建新会话）
- ✅ 第二条消息应该调用 `resumeClaudeCode`（继续会话）

### 8. 验证 Claude 响应
Claude 应该能够看到第一条消息的内容，并回答类似：
```
是的，我能看到你刚才说的话。你说"你好，请介绍一下你自己"...
```

## 预期结果
- ✅ 第一条消息创建新会话
- ✅ 收到 `system:init` 消息后，`isFirstPrompt` 被设置为 `false`
- ✅ 第二条消息使用 `resumeClaudeCode` 继续会话
- ✅ Claude 能够看到第一条消息的内容
- ✅ 上下文正确传递

## 失败情况
如果测试失败，可能的原因：
1. `isFirstPrompt` 没有被正确设置为 `false`
2. `effectiveSession` 为 `null`
3. 会话 ID 没有被正确提取
4. React 状态更新延迟

## 调试建议
1. 在 Console 中搜索 `isFirstPrompt` 查看所有相关日志
2. 在 Console 中搜索 `Session State` 查看每次发送消息时的状态
3. 在 Console 中搜索 `resumeClaudeCode` 确认是否调用了正确的 API
4. 检查 Network 标签页，查看实际的 Tauri 命令调用

## 修复文件
- `F:\Fangyu-Code-Dev\src\hooks\usePromptExecution.ts`
  - 第 1717 行：添加 `setIsFirstPrompt(false)`
  - 第 1718 行：添加日志记录
  - 第 2379 行：添加会话状态日志

## 测试日期
2026-01-21

## 测试结果
[ ] 通过
[ ] 失败

## 备注
