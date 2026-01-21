# 上下文丢失问题修复 - 完整报告

## 📋 问题描述

在 Fangyu Code 中使用 Claude Code 引擎聊天时，每条指令都被当作新会话的第一条指令处理，导致 Claude 无法看到历史上下文。

**症状：**
- 用户发送第一条消息："你好，我的名字是张三"
- 用户发送第二条消息："你还记得我的名字吗？"
- Claude 回答："抱歉，我不知道你的名字"（应该回答"张三"）

## 🔍 根本原因分析

### 问题定位过程

1. **初步分析**：怀疑是 API 调用没有传递历史消息
2. **深入调查**：发现 Fangyu Code 通过调用 Claude Code CLI 实现对话
3. **关键发现**：Claude Code CLI 会自动管理会话历史（存储在 `.claude/` 目录）
4. **核心问题**：前端状态管理错误，导致每次都创建新会话

### 代码分析

**文件：** `src/hooks/usePromptExecution.ts`

**问题代码（第 2379 行）：**
```typescript
if (effectiveSession && !isFirstPrompt) {
    // Resume existing session
    await api.resumeClaudeCode(...);
} else {
    // Start new session
    await api.executeClaudeCode(...);
}
```

**状态初始化（第 177 行，ClaudeCodeSession.tsx）：**
```typescript
const [isFirstPrompt, setIsFirstPrompt] = useState(!session);
```

**问题所在（第 1711-1724 行）：**
```typescript
if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    if (!currentSessionId || currentSessionId !== msg.session_id) {
        currentSessionId = msg.session_id;
        setClaudeSessionId(msg.session_id);  // ✅ 设置了 session ID

        // ❌ 但是没有设置 isFirstPrompt = false！

        if (!extractedSessionInfo) {
            const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
            setExtractedSessionInfo({
                sessionId: msg.session_id,
                projectId,
                engine: "claude",
            });
        }
    }
}
```

### 问题流程

1. **第一条消息**：
   - `isFirstPrompt = true`（初始状态）
   - `effectiveSession = null`
   - 条件 `if (effectiveSession && !isFirstPrompt)` 不满足
   - 调用 `executeClaudeCode` 创建新会话 ✅

2. **收到 system:init 消息**：
   - 设置 `claudeSessionId = "session-123"` ✅
   - **没有设置 `isFirstPrompt = false`** ❌

3. **第二条消息**：
   - `isFirstPrompt = true`（仍然是 true！）
   - `effectiveSession = { id: "session-123", ... }`
   - 条件 `if (effectiveSession && !isFirstPrompt)` **不满足**（因为 `isFirstPrompt` 还是 `true`）
   - 又调用 `executeClaudeCode` 创建新会话 ❌

## ✅ 修复方案

### 修改文件
`src/hooks/usePromptExecution.ts`

### 修改位置
第 1717 行

### 修改内容

**修改前：**
```typescript
if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    if (!currentSessionId || currentSessionId !== msg.session_id) {
        currentSessionId = msg.session_id;
        setClaudeSessionId(msg.session_id);

        // If we haven't extracted session info before, do it now
        if (!extractedSessionInfo) {
            const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
            setExtractedSessionInfo({
                sessionId: msg.session_id,
                projectId,
                engine: "claude",
            });
        }
```

**修改后：**
```typescript
if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    if (!currentSessionId || currentSessionId !== msg.session_id) {
        currentSessionId = msg.session_id;
        setClaudeSessionId(msg.session_id);

        // 🔧 FIX: 设置 isFirstPrompt 为 false，确保后续消息能正确继续会话
        setIsFirstPrompt(false);
        logger.info('usePromptExecution', `[usePromptExecution] ✅ Session initialized: sessionId=${msg.session_id}, isFirstPrompt set to false`);

        // If we haven't extracted session info before, do it now
        if (!extractedSessionInfo) {
            const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
            setExtractedSessionInfo({
                sessionId: msg.session_id,
                projectId,
                engine: "claude",
            });
        }
```

### 额外改进

**添加调试日志（第 2379 行）：**
```typescript
// 🔧 DEBUG: 记录会话状态，帮助诊断上下文丢失问题
logger.info('usePromptExecution', `[usePromptExecution] 📊 Session State: isFirstPrompt=${isFirstPrompt}, hasEffectiveSession=${!!effectiveSession}, sessionId=${effectiveSession?.id || 'none'}`);
```

## 🧪 测试方案

### 手动测试

1. **启动 Fangyu Code**
   ```bash
   cd F:\Fangyu-Code-Dev
   npm run dev
   ```

2. **打开开发者工具**
   - 按 `F12`
   - 切换到 Console 标签页

3. **发送第一条消息**
   ```
   你好，我的名字是张三，我今年25岁。请记住我的信息。
   ```

4. **观察日志**
   应该看到：
   ```
   [usePromptExecution] ✅ Session initialized: sessionId=xxx, isFirstPrompt set to false
   ```

5. **发送第二条消息**
   ```
   你还记得我的名字和年龄吗？
   ```

6. **观察日志**
   应该看到：
   ```
   [usePromptExecution] 📊 Session State: isFirstPrompt=false, hasEffectiveSession=true, sessionId=xxx
   ```

7. **验证响应**
   Claude 应该回答：
   ```
   是的，我记得。你的名字是张三，今年25岁。
   ```

### 自动化测试

运行测试脚本：
```bash
node F:\Fangyu-Code-Dev\tests\test-context-fix.js
```

测试脚本会：
1. 检查会话文件是否存在
2. 读取会话内容
3. 验证所有消息是否在同一个会话中
4. 检查助手响应是否包含历史消息的内容

## 📊 预期结果

### 修复前
- ❌ 每条消息都创建新会话
- ❌ Claude 看不到历史消息
- ❌ 会话文件中有多个不同的 `session_id`

### 修复后
- ✅ 第一条消息创建新会话
- ✅ 后续消息继续同一会话
- ✅ Claude 能看到所有历史消息
- ✅ 会话文件中只有一个 `session_id`

## 📁 修改的文件

1. **src/hooks/usePromptExecution.ts**
   - 第 1717 行：添加 `setIsFirstPrompt(false)`
   - 第 1718 行：添加日志记录
   - 第 2379 行：添加会话状态日志

2. **tests/test-context-fix.md**
   - 测试说明文档

3. **tests/test-context-fix.js**
   - 自动化测试脚本

## 🔄 修复流程（修复后）

1. **第一条消息**：
   - `isFirstPrompt = true`
   - `effectiveSession = null`
   - 调用 `executeClaudeCode` 创建新会话 ✅

2. **收到 system:init 消息**：
   - 设置 `claudeSessionId = "session-123"` ✅
   - **设置 `isFirstPrompt = false`** ✅
   - 记录日志 ✅

3. **第二条消息**：
   - `isFirstPrompt = false` ✅
   - `effectiveSession = { id: "session-123", ... }` ✅
   - 条件 `if (effectiveSession && !isFirstPrompt)` **满足** ✅
   - 调用 `resumeClaudeCode` 继续会话 ✅

## 🎯 影响范围

### 受益场景
- ✅ 多轮对话
- ✅ 上下文依赖的任务
- ✅ 代码重构（需要记住之前的修改）
- ✅ 问题排查（需要记住之前的错误信息）

### 不受影响场景
- ✅ 单次查询
- ✅ 独立任务
- ✅ 新会话创建

## 📝 后续建议

1. **添加单元测试**
   - 测试 `isFirstPrompt` 状态管理
   - 测试会话恢复逻辑

2. **改进错误处理**
   - 如果会话恢复失败，自动创建新会话
   - 添加用户提示

3. **优化用户体验**
   - 在 UI 中显示当前会话状态
   - 添加"新建会话"按钮

4. **性能优化**
   - 考虑使用 `useRef` 代替 `useState` 管理 `isFirstPrompt`
   - 减少不必要的状态更新

## 📅 修复日期
2026-01-21

## 👤 修复者
Claude Opus 4.5

## ✅ 测试状态
- [ ] 手动测试通过
- [ ] 自动化测试通过
- [ ] 代码审查通过
- [ ] 用户验收通过

---

**注意：** 此修复已完成代码修改，但需要用户重新启动 Fangyu Code 并进行测试验证。
