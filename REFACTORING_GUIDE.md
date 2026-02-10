# ClaudeCodeSession 组件重构指南

**文件**: `F:\Fangyu-Code-Dev\src\components\ClaudeCodeSession.tsx`
**当前行数**: 2,443 行
**目标**: 拆分为 5-8 个子组件

## 📋 当前组件分析

### 导入依赖（~80 行）
- React hooks: useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, useTransition
- 20+ 个自定义 Hooks
- 10+ 个 UI 组件
- 多个 Context Providers

### 主要功能区域

#### 1. 对话框组件（行 2325-2416）
```typescript
// Plan Approval Dialog
<PlanApprovalDialog
  open={showApprovalDialog}
  plan={pendingApproval?.plan || ""}
  onClose={closeApprovalDialog}
  onApprove={approvePlan}
  onReject={rejectPlan}
/>

// User Question Dialog
<AskUserQuestionDialog
  open={showQuestionDialog}
  questions={pendingQuestion?.questions || []}
  onClose={closeQuestionDialog}
  onSubmit={submitAnswers}
/>

// Session Summary Dialog
<SessionSummaryDialog
  isOpen={showSummaryDialog}
  summary={sessionSummary}
  tokenPercentage={thresholdStatus.percentage}
  onClose={() => setShowSummaryDialog(false)}
  onStartNewSession={() => {...}}
  onContinueAnyway={() => {...}}
/>
```

#### 2. 导航组件（行 2313-2353）
```typescript
// Revert Prompt Picker
{showRevertPicker && effectiveSession && (
  <RevertPromptPicker
    sessionId={effectiveSession.id}
    projectId={effectiveSession.project_id}
    projectPath={projectPath}
    engine={effectiveSession.engine || executionEngineConfig.engine || "claude"}
    onSelect={handleRevert}
    onClose={() => setShowRevertPicker(false)}
  />
)}

// Prompt Navigator
<PromptNavigator
  messages={messages}
  promptItems={promptCostSummary.items}
  promptsTotalCost={promptCostSummary.promptsTotalCost}
  sessionTotalCost={promptCostSummary.sessionTotalCost}
  isOpen={showPromptNavigator}
  onClose={() => setShowPromptNavigator(false)}
  onPromptClick={handlePromptNavigation}
/>
```

#### 3. 悬浮窗组件（行 2355-2394）
```typescript
// Canvas Floating Window
{showCanvas && (
  <Suspense fallback={<Loader2 />}>
    <CanvasFloatingWindow
      isOpen={showCanvas}
      onClose={() => setShowCanvas(false)}
      extractedCode={extractedCode?.code || ""}
      language={extractedCode?.language || "tsx"}
    />
  </Suspense>
)}

// Smart Recommendation Bar
{recommendations.length > 0 && (
  <SmartRecommendationBar
    recommendations={recommendations}
    onDismiss={dismissRecommendation}
    onSnooze={snoozeRecommendation}
    onClearAll={clearRecommendations}
    onRefresh={refreshMCPStatus}
  />
)}

// Project MCP Quick Config
{projectPath && (
  <ProjectMCPQuickConfig
    open={showMCPConfig}
    onClose={() => setShowMCPConfig(false)}
    projectPath={projectPath}
    engine={executionEngineConfig.engine}
  />
)}
```

## 🎯 重构方案

### Phase 1: 提取对话框组件

**新文件**: `src/components/session/SessionDialogs.tsx`

```typescript
import React from 'react';
import { PlanApprovalDialog } from '@/components/dialogs/PlanApprovalDialog';
import { AskUserQuestionDialog } from '@/components/dialogs/AskUserQuestionDialog';
import { SessionSummaryDialog } from '@/components/SessionSummaryDialog';

interface SessionDialogsProps {
  // Plan Approval
  showApprovalDialog: boolean;
  pendingApproval: { plan: string } | null;
  closeApprovalDialog: () => void;
  approvePlan: () => void;
  rejectPlan: () => void;

  // User Question
  showQuestionDialog: boolean;
  pendingQuestion: { questions: any[] } | null;
  closeQuestionDialog: () => void;
  submitAnswers: (answers: any) => void;

  // Session Summary
  showSummaryDialog: boolean;
  sessionSummary: string;
  thresholdPercentage: number;
  onCloseSummary: () => void;
  onStartNewSession: () => void;
  onContinueAnyway: () => void;
}

export const SessionDialogs: React.FC<SessionDialogsProps> = ({
  showApprovalDialog,
  pendingApproval,
  closeApprovalDialog,
  approvePlan,
  rejectPlan,
  showQuestionDialog,
  pendingQuestion,
  closeQuestionDialog,
  submitAnswers,
  showSummaryDialog,
  sessionSummary,
  thresholdPercentage,
  onCloseSummary,
  onStartNewSession,
  onContinueAnyway,
}) => {
  return (
    <>
      {/* Plan Approval Dialog */}
      <PlanApprovalDialog
        open={showApprovalDialog}
        plan={pendingApproval?.plan || ""}
        onClose={closeApprovalDialog}
        onApprove={approvePlan}
        onReject={rejectPlan}
      />

      {/* User Question Dialog */}
      <AskUserQuestionDialog
        open={showQuestionDialog}
        questions={pendingQuestion?.questions || []}
        onClose={closeQuestionDialog}
        onSubmit={submitAnswers}
      />

      {/* Session Summary Dialog */}
      <SessionSummaryDialog
        isOpen={showSummaryDialog}
        summary={sessionSummary}
        tokenPercentage={thresholdPercentage}
        onClose={onCloseSummary}
        onStartNewSession={onStartNewSession}
        onContinueAnyway={onContinueAnyway}
      />
    </>
  );
};
```

**在主组件中使用**:
```typescript
// 替换原来的对话框 JSX
<SessionDialogs
  showApprovalDialog={showApprovalDialog}
  pendingApproval={pendingApproval}
  closeApprovalDialog={closeApprovalDialog}
  approvePlan={approvePlan}
  rejectPlan={rejectPlan}
  showQuestionDialog={showQuestionDialog}
  pendingQuestion={pendingQuestion}
  closeQuestionDialog={closeQuestionDialog}
  submitAnswers={submitAnswers}
  showSummaryDialog={showSummaryDialog}
  sessionSummary={sessionSummary}
  thresholdPercentage={thresholdStatus.percentage}
  onCloseSummary={() => setShowSummaryDialog(false)}
  onStartNewSession={() => {
    logger.debug("ClaudeCodeSession", "[ClaudeCodeSession] Start new session");
    setShowSummaryDialog(false);
  }}
  onContinueAnyway={() => {
    logger.debug("ClaudeCodeSession", "[ClaudeCodeSession] Continue anyway");
    setShowSummaryDialog(false);
  }}
/>
```

**减少行数**: ~90 行 → ~10 行（净减少 80 行）

### Phase 2: 提取导航组件

**新文件**: `src/components/session/SessionNavigation.tsx`

```typescript
import React from 'react';
import { RevertPromptPicker } from '@/components/RevertPromptPicker';
import { PromptNavigator } from '@/components/PromptNavigator';
import type { Session } from '@/lib/api';

interface SessionNavigationProps {
  // Revert Picker
  showRevertPicker: boolean;
  effectiveSession: Session | null;
  projectPath: string;
  executionEngine: "claude" | "codex" | "gemini";
  onRevert: (promptIndex: number) => void;
  onCloseRevertPicker: () => void;

  // Prompt Navigator
  showPromptNavigator: boolean;
  messages: any[];
  promptItems: any[];
  promptsTotalCost: number;
  sessionTotalCost: number;
  onClosePromptNavigator: () => void;
  onPromptClick: (index: number) => void;
}

export const SessionNavigation: React.FC<SessionNavigationProps> = ({
  showRevertPicker,
  effectiveSession,
  projectPath,
  executionEngine,
  onRevert,
  onCloseRevertPicker,
  showPromptNavigator,
  messages,
  promptItems,
  promptsTotalCost,
  sessionTotalCost,
  onClosePromptNavigator,
  onPromptClick,
}) => {
  return (
    <>
      {/* Revert Prompt Picker */}
      {showRevertPicker && effectiveSession && (
        <RevertPromptPicker
          sessionId={effectiveSession.id}
          projectId={effectiveSession.project_id}
          projectPath={projectPath}
          engine={effectiveSession.engine || executionEngine}
          onSelect={onRevert}
          onClose={onCloseRevertPicker}
        />
      )}

      {/* Prompt Navigator */}
      <PromptNavigator
        messages={messages}
        promptItems={promptItems}
        promptsTotalCost={promptsTotalCost}
        sessionTotalCost={sessionTotalCost}
        isOpen={showPromptNavigator}
        onClose={onClosePromptNavigator}
        onPromptClick={onPromptClick}
      />
    </>
  );
};
```

**减少行数**: ~40 行 → ~10 行（净减少 30 行）

### Phase 3: 提取悬浮窗组件

**新文件**: `src/components/session/SessionFloatingWindows.tsx`

```typescript
import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SmartRecommendationBar } from '@/components/SmartRecommendationBar';
import { ProjectMCPQuickConfig } from '@/components/ProjectMCPQuickConfig';

const CanvasFloatingWindow = lazy(() =>
  import("@/components/canvas/CanvasFloatingWindow").then((m) => ({
    default: m.CanvasFloatingWindow,
  }))
);

interface SessionFloatingWindowsProps {
  // Canvas
  showCanvas: boolean;
  extractedCode: { code: string; language: string } | null;
  onCloseCanvas: () => void;

  // Recommendations
  recommendations: any[];
  onDismissRecommendation: (id: string) => void;
  onSnoozeRecommendation: (id: string) => void;
  onClearRecommendations: () => void;
  onRefreshMCPStatus: () => void;

  // MCP Config
  showMCPConfig: boolean;
  projectPath: string;
  executionEngine: "claude" | "codex" | "gemini";
  onCloseMCPConfig: () => void;
}

export const SessionFloatingWindows: React.FC<SessionFloatingWindowsProps> = ({
  showCanvas,
  extractedCode,
  onCloseCanvas,
  recommendations,
  onDismissRecommendation,
  onSnoozeRecommendation,
  onClearRecommendations,
  onRefreshMCPStatus,
  showMCPConfig,
  projectPath,
  executionEngine,
  onCloseMCPConfig,
}) => {
  return (
    <>
      {/* Canvas Floating Window */}
      {showCanvas && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
        >
          <CanvasFloatingWindow
            isOpen={showCanvas}
            onClose={onCloseCanvas}
            extractedCode={extractedCode?.code || ""}
            language={extractedCode?.language || "tsx"}
          />
        </Suspense>
      )}

      {/* Smart Recommendation Bar */}
      {recommendations.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 max-w-md">
          <SmartRecommendationBar
            recommendations={recommendations}
            onDismiss={onDismissRecommendation}
            onSnooze={onSnoozeRecommendation}
            onClearAll={onClearRecommendations}
            onRefresh={onRefreshMCPStatus}
          />
        </div>
      )}

      {/* Project MCP Quick Config */}
      {projectPath && (
        <ProjectMCPQuickConfig
          open={showMCPConfig}
          onClose={onCloseMCPConfig}
          projectPath={projectPath}
          engine={executionEngine}
        />
      )}
    </>
  );
};
```

**减少行数**: ~40 行 → ~10 行（净减少 30 行）

### Phase 4: 提取对话框状态管理 Hook

**新文件**: `src/hooks/useSessionDialogs.ts`

```typescript
import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface PendingApproval {
  plan: string;
}

interface PendingQuestion {
  questions: any[];
}

export function useSessionDialogs() {
  // Plan Approval Dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  const openApprovalDialog = useCallback((plan: string) => {
    setPendingApproval({ plan });
    setShowApprovalDialog(true);
  }, []);

  const closeApprovalDialog = useCallback(() => {
    setShowApprovalDialog(false);
    setPendingApproval(null);
  }, []);

  const approvePlan = useCallback(() => {
    logger.debug("useSessionDialogs", "Plan approved");
    closeApprovalDialog();
    // 实际的审批逻辑由调用者处理
  }, [closeApprovalDialog]);

  const rejectPlan = useCallback(() => {
    logger.debug("useSessionDialogs", "Plan rejected");
    closeApprovalDialog();
    // 实际的拒绝逻辑由调用者处理
  }, [closeApprovalDialog]);

  // User Question Dialog
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);

  const openQuestionDialog = useCallback((questions: any[]) => {
    setPendingQuestion({ questions });
    setShowQuestionDialog(true);
  }, []);

  const closeQuestionDialog = useCallback(() => {
    setShowQuestionDialog(false);
    setPendingQuestion(null);
  }, []);

  const submitAnswers = useCallback((answers: any) => {
    logger.debug("useSessionDialogs", "Answers submitted:", answers);
    closeQuestionDialog();
    // 实际的提交逻辑由调用者处理
  }, [closeQuestionDialog]);

  // Session Summary Dialog
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [sessionSummary, setSessionSummary] = useState("");

  const openSummaryDialog = useCallback((summary: string) => {
    setSessionSummary(summary);
    setShowSummaryDialog(true);
  }, []);

  const closeSummaryDialog = useCallback(() => {
    setShowSummaryDialog(false);
    setSessionSummary("");
  }, []);

  return {
    // Plan Approval
    showApprovalDialog,
    pendingApproval,
    openApprovalDialog,
    closeApprovalDialog,
    approvePlan,
    rejectPlan,

    // User Question
    showQuestionDialog,
    pendingQuestion,
    openQuestionDialog,
    closeQuestionDialog,
    submitAnswers,

    // Session Summary
    showSummaryDialog,
    sessionSummary,
    openSummaryDialog,
    closeSummaryDialog,
  };
}
```

**减少主组件行数**: ~50 行（状态定义和回调）

## 📊 预期成果

### 重构前
- ClaudeCodeSession.tsx: 2,443 行

### 重构后
- ClaudeCodeSession.tsx: ~1,800 行（减少 643 行）
- SessionDialogs.tsx: ~150 行
- SessionNavigation.tsx: ~100 行
- SessionFloatingWindows.tsx: ~150 行
- useSessionDialogs.ts: ~100 行

**总计**: ~2,300 行（减少 143 行，主要是通过消除重复和优化结构）

### 主要改进
1. **可维护性**: 对话框逻辑集中管理
2. **可测试性**: 每个组件可独立测试
3. **可读性**: 主组件更简洁
4. **可复用性**: 提取的组件可在其他地方使用

## ⚠️ 注意事项

### 1. 保持功能完整性
- 所有回调必须正确传递
- 状态更新逻辑不能改变
- 事件处理保持一致

### 2. 测试要点
- 对话框打开/关闭
- 回调函数执行
- 状态更新正确性
- Props 传递完整性

### 3. 风险控制
- 每次提取后立即测试
- 使用 Git 分支进行重构
- 保留原始文件备份

## 🚀 实施步骤

### Step 1: 创建新文件
```bash
mkdir -p src/components/session
touch src/components/session/SessionDialogs.tsx
touch src/components/session/SessionNavigation.tsx
touch src/components/session/SessionFloatingWindows.tsx
touch src/hooks/useSessionDialogs.ts
```

### Step 2: 复制代码到新文件
- 从 ClaudeCodeSession.tsx 复制相关代码
- 调整导入路径
- 添加 TypeScript 类型

### Step 3: 更新主组件
- 导入新组件
- 替换原有 JSX
- 传递必要的 Props

### Step 4: 测试
- 运行应用
- 测试所有对话框功能
- 确认无回归问题

### Step 5: 清理
- 删除主组件中已提取的代码
- 优化导入语句
- 更新注释

## 📝 后续优化

完成基础拆分后，可以继续优化：

1. **提取更多 Hooks**
   - useSessionState
   - useSessionEffects
   - useSessionHandlers

2. **进一步拆分主组件**
   - 提取消息处理逻辑
   - 提取工具调用逻辑
   - 提取滚动管理逻辑

3. **性能优化**
   - 添加 React.memo
   - 优化 useCallback 依赖
   - 减少不必要的重渲染

---

**创建时间**: 2026-02-10
**作者**: refactor-agent-opus
**状态**: 待实施
