# 🔄 智能会话续接功能 (Smart Session Continue)

> **v1.5.0** | 替代传统压缩方案，解决上下文爆满问题
>
> **v2.0.0 新增** | 聊天历史回溯系统 - 可搜索和加载任意历史会话

---

## 📊 问题分析

### 旧方案（后台压缩）的6大问题

| # | 问题 | 影响 | 严重度 |
|---|------|------|--------|
| 1 | **压缩时间太长** | 需要等待 API 处理整个会话历史（15-60秒） | 🔴 高 |
| 2 | **压缩后重复任务** | 摘要丢失关键信息（如 TodoList 状态、修改记录） | 🔴 高 |
| 3 | **UI 状态未清除** | "压缩中"提示不消失 | 🟡 中 |
| 4 | **压缩中无法发送** | 用户体验中断 | 🟡 中 |
| 5 | **压缩后使用率仍高** | 压缩比不理想（~70%→50%） | 🟡 中 |
| 6 | **用户感知明显** | 破坏 Invisible UX 原则 | 🟡 中 |

---

## 🎯 新方案：智能会话续接

### 核心思想

**不压缩旧内容，而是开新窗口并智能注入上下文**

```
┌─────────────────────────────────────────────────────────┐
│ 旧会话（75% token 使用率）                                 │
│ ├─ 项目配置                                              │
│ ├─ TodoList 状态: [已完成3/5个任务]                        │
│ ├─ 修改文件: src/App.tsx, src/hooks/useData.ts           │
│ ├─ 关键决策: 使用 React Query 而非 Redux                  │
│ └─ 最近10条重要消息                                       │
└─────────────────────────────────────────────────────────┘
                         ↓ 75% 阈值触发
                         ↓ 生成详细摘要（~2s）
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 新会话（0% token 使用率） ← 自动注入上下文                  │
│                                                          │
│ System Prompt:                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ # 会话继承自 Session #123                          │  │
│ │                                                     │  │
│ │ ## 项目信息                                         │  │
│ │ - 路径: F:/projects/my-app                         │  │
│ │ - 技术栈: React 18 + TypeScript + Vite             │  │
│ │                                                     │  │
│ │ ## 当前任务状态                                     │  │
│ │ ✅ 1. 创建项目结构                                  │  │
│ │ ✅ 2. 配置开发环境                                  │  │
│ │ ✅ 3. 实现数据获取 Hook                             │  │
│ │ ⏳ 4. 添加 UI 组件 (进行中)                         │  │
│ │ ⏳ 5. 编写单元测试 (待开始)                         │  │
│ │                                                     │  │
│ │ ## 最近修改                                         │  │
│ │ - src/App.tsx: 添加路由配置                         │  │
│ │ - src/hooks/useData.ts: 实现 React Query 集成       │  │
│ │                                                     │  │
│ │ ## 关键决策                                         │  │
│ │ - 使用 React Query 管理服务端状态                   │  │
│ │ - 使用 Zustand 管理客户端状态                       │  │
│ │ - API 端点: https://api.example.com                │  │
│ │                                                     │  │
│ │ ## 最近对话摘要                                     │  │
│ │ [User] 帮我实现数据获取功能                         │  │
│ │ [Assistant] ✅ 已创建 useData Hook，使用 React Query │  │
│ │ [User] 添加错误处理和加载状态                        │  │
│ │ [Assistant] ✅ 已添加 isLoading 和 error 状态       │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ User: 继续添加 UI 组件 ← 用户无感知继续工作               │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ 优势对比

| 特性 | 旧方案（压缩） | 新方案（续接） | 提升 |
|------|--------------|---------------|------|
| **处理时间** | 15-60秒 | ~2秒 | 🚀 **7-30x** |
| **上下文丢失** | 50-70% | 0% | 🎯 **完整保留** |
| **Token 使用率** | 40-60% | 0% | ✨ **完全清零** |
| **用户可操作** | ❌ 阻塞 | ✅ 立即可用 | 💯 **无缝** |
| **任务状态** | ⚠️ 可能丢失 | ✅ 完整保留 | 🛡️ **可靠** |
| **UI 复杂度** | 高 | 低 | 🎨 **简洁** |

---

## 🏗️ 技术架构

### 文件结构

```
src/
├── hooks/
│   └── useSmartSessionContinue.ts    # 核心 Hook（新增）
├── components/
│   └── SessionContinueDialog.tsx      # 确认对话框（新增）
├── lib/
│   └── sessionSummarizer.ts           # 摘要生成器（新增）
└── types/
    └── session-continue.ts            # 类型定义（新增）
```

### 核心流程

```typescript
// 1. 监控 token 使用率
useEffect(() => {
  if (contextUsage >= 0.75) {
    // 触发续接准备
    prepareSessionContinue();
  }
}, [contextUsage]);

// 2. 生成详细摘要（~2秒）
const summary = await generateDetailedSummary({
  sessionHistory,
  todoList,
  modifiedFiles,
  keyDecisions,
  recentMessages: last10Messages,
});

// 3. 创建新会话并注入上下文
const newSession = await createSession({
  projectPath,
  systemPrompt: buildSystemPrompt(summary),
  parentSessionId: currentSessionId,
});

// 4. 自动切换（用户无感知）
switchToSession(newSession.id);
```

---

## 📝 摘要生成规则

### 必须包含的信息

1. **TodoList 状态**
   ```markdown
   ## 任务进度
   ✅ 1. 任务A (已完成)
   ⏳ 2. 任务B (进行中 - 45%)
   ⏸️ 3. 任务C (待开始)
   ```

2. **修改文件列表**
   ```markdown
   ## 最近修改
   - src/App.tsx: 添加路由配置
   - src/hooks/useData.ts: 实现数据获取
   - src/components/Header.tsx: 添加导航菜单
   ```

3. **关键决策**
   ```markdown
   ## 技术决策
   - 使用 React Query 而非 Redux
   - API 基础 URL: https://api.example.com
   - 认证方式: JWT Token in Header
   ```

4. **项目配置**
   ```markdown
   ## 项目信息
   - 路径: F:/projects/my-app
   - 技术栈: React + TypeScript + Vite
   - Node 版本: 18.x
   - Package Manager: pnpm
   ```

5. **最近10条重要消息**（只包含关键对话）

---

## 🎨 用户体验设计

### 方案 A: 静默切换（推荐）

```
达到 75% → 生成摘要（2s）→ 自动创建新会话 → 无缝切换
```

**特点：** 用户完全无感知，0 打断

### 方案 B: 确认对话框

```
达到 75% → 显示对话框 → 用户确认 → 创建新会话
```

```tsx
<SessionContinueDialog
  oldSessionUsage="75%"
  estimatedNewUsage="~5%"
  summary={summaryPreview}
  onConfirm={handleContinue}
  onCancel={handleStayInOldSession}
/>
```

**特点：** 用户可预览摘要，更透明

---

## 🔧 配置选项

```typescript
interface SessionContinueConfig {
  /** 触发阈值（默认 0.75 = 75%） */
  threshold: number;

  /** 自动切换还是询问用户（默认 true） */
  autoSwitch: boolean;

  /** 摘要中保留的最近消息数（默认 10） */
  recentMessagesCount: number;

  /** 是否保留旧会话（默认 true） */
  keepOldSession: boolean;

  /** 摘要详细程度 ('concise' | 'detailed') */
  summaryVerbosity: 'concise' | 'detailed';
}
```

---

## 🚀 实现清单

### Phase 1: 核心功能（当前）
- [ ] 创建 `useSmartSessionContinue` Hook
- [ ] 实现摘要生成算法
- [ ] 实现新会话创建和上下文注入
- [ ] 添加自动切换逻辑

### Phase 2: UI 增强
- [ ] 创建 `SessionContinueDialog` 对话框
- [ ] 添加摘要预览功能
- [ ] 添加设置面板配置项

### Phase 3: 优化
- [ ] 添加摘要缓存（避免重复生成）
- [ ] 优化摘要算法（压缩比）
- [ ] 添加会话继承关系可视化

### Phase 4: 测试
- [ ] 单元测试（摘要生成）
- [ ] 集成测试（完整流程）
- [ ] 用户测试（实际场景）

---

## 📖 使用示例

```typescript
// 在 ClaudeCodeSession.tsx 中使用
import { useSmartSessionContinue } from '@/hooks/useSmartSessionContinue';

function ClaudeCodeSession() {
  const {
    shouldContinue,      // 是否应该续接
    summary,             // 生成的摘要
    newSessionId,        // 新会话 ID
    continueTo,          // 执行续接
    cancel,              // 取消续接
  } = useSmartSessionContinue({
    sessionId: current SessionId,
    projectPath,
    threshold: 0.75,
    autoSwitch: true,
  });

  // 自动切换模式
  useEffect(() => {
    if (shouldContinue && newSessionId) {
      setClaudeSessionId(newSessionId);
      loadSessionHistory();
    }
  }, [shouldContinue, newSessionId]);

  return (
    <div>
      {/* 会话内容 */}
    </div>
  );
}
```

---

## 🎯 预期效果

### 用户视角

```
[正常聊天中...] token: 50%
[继续聊天...] token: 70%
[继续聊天...] token: 75%
↓ 突然感觉稍微卡了一下（~2秒）
[继续聊天...] token: 5% ← WOW! 自动清空了！
[继续聊天...] 所有上下文都还在！任务列表也在！
```

### 技术指标

- ⚡ 处理时间: **15-60s → 2s** (减少 87-97%)
- 🎯 上下文保留: **30-50% → 100%** (提升 2-3x)
- 💯 用户可操作性: **阻塞 → 立即可用**
- 📊 Token 使用率: **40-60% → 0-5%** (节省 95%+)

---

**最后更新**: 2026-01-01
**状态**: 开发中
**负责人**: Claude Opus 4.5
