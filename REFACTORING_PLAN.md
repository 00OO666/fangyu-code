# ClaudeCodeSession 组件重构计划

**目标文件**: `F:\Fangyu-Code-Dev\src\components\ClaudeCodeSession.tsx`
**当前行数**: 2,443 行
**目标**: 拆分为 5-8 个子组件，每个 < 500 行

## 重构策略

### Phase 1: 提取对话框组件（最独立）
这些组件已经相对独立，可以直接提取：

1. **SessionDialogs.tsx** (~200 行)
   - PlanApprovalDialog
   - AskUserQuestionDialog
   - SessionSummaryDialog
   - DuplicateRateWarning

### Phase 2: 提取工具栏和控制组件
2. **SessionToolbar.tsx** (~150 行)
   - SessionToolbar（已存在，检查是否需要优化）
   - SessionHeader（已存在）
   - CompactStatusIndicator

3. **SessionFloatingWindows.tsx** (~200 行)
   - CanvasFloatingWindow
   - WebviewPreview
   - SmartRecommendationBar
   - ProjectMCPQuickConfig

### Phase 3: 提取导航组件
4. **SessionNavigation.tsx** (~150 行)
   - PromptNavigator
   - RevertPromptPicker

### Phase 4: 提取 Hooks（状态管理逻辑）
5. **hooks/useSessionManagement.ts** (~200 行)
   - 整合所有会话相关的状态管理
   - 提取 handleSendPrompt 相关逻辑

6. **hooks/useSessionDialogs.ts** (~100 行)
   - 管理所有对话框的显示/隐藏状态
   - 提取对话框回调逻辑

### Phase 5: 重构主组件
7. **ClaudeCodeSession.tsx** (目标 < 500 行)
   - 只保留组件组合逻辑
   - 使用提取的 Hooks 和子组件

## 实施步骤

### Step 1: 创建目录结构
```
src/components/
├── ClaudeCodeSession.tsx (主组件，重构后)
├── session/
│   ├── SessionDialogs.tsx (新建)
│   ├── SessionFloatingWindows.tsx (新建)
│   ├── SessionNavigation.tsx (新建)
│   ├── SessionHeader.tsx (已存在)
│   └── SessionMessages.tsx (已存在)
└── hooks/
    ├── useSessionManagement.ts (新建)
    └── useSessionDialogs.ts (新建)
```

### Step 2: 提取对话框组件
- 创建 SessionDialogs.tsx
- 移动所有对话框相关的 JSX
- 移动对话框状态和回调

### Step 3: 提取悬浮窗组件
- 创建 SessionFloatingWindows.tsx
- 移动 Canvas、Webview、推荐条等

### Step 4: 提取导航组件
- 创建 SessionNavigation.tsx
- 移动 PromptNavigator 和 RevertPromptPicker

### Step 5: 提取 Hooks
- 创建 useSessionManagement.ts
- 创建 useSessionDialogs.ts
- 移动相关逻辑

### Step 6: 重构主组件
- 使用提取的组件和 Hooks
- 简化主组件逻辑
- 确保功能完整性

## 风险控制

1. **保持功能完整性**
   - 每次提取后立即测试
   - 确保所有回调正确传递

2. **避免破坏现有功能**
   - 不修改业务逻辑
   - 只做结构重构

3. **保持向后兼容**
   - 保持 Props 接口不变
   - 保持导出接口不变

## 预期成果

- ClaudeCodeSession.tsx: ~400 行
- SessionDialogs.tsx: ~200 行
- SessionFloatingWindows.tsx: ~200 行
- SessionNavigation.tsx: ~150 行
- useSessionManagement.ts: ~200 行
- useSessionDialogs.ts: ~100 行

**总计**: ~1,250 行（相比原始 2,443 行减少 49%）

## 开始时间
2026-02-10

## 预计完成时间
2-3 小时
