# Fangyu Code 全面扫描报告

## 扫描概述

- **扫描时间**: 2026-01-10
- **TypeScript 错误总数**: 351 个
- **受影响文件数**: 99 个
- **严重程度**: 🔴 高（项目无法通过类型检查）

---

## 🔴 严重问题（阻塞性 Bug）

### 问题 1: useSessionThresholdMonitor 返回值不匹配

**文件**: `src/components/ClaudeCodeSession.tsx` (行 593)
**错误**: `Property 'summary' does not exist on type '{ status: ThresholdStatus; generateSummary: () => Promise<string>; }'`

**原因**: 
- `useSessionThresholdMonitor` 返回 `{ status, generateSummary }`
- `ClaudeCodeSession.tsx` 试图解构 `summary: thresholdSummary`

**修复方案**:
```typescript
// 错误写法
const { status: thresholdStatus, summary: thresholdSummary } = useSessionThresholdMonitor({...});

// 正确写法
const { status: thresholdStatus, generateSummary } = useSessionThresholdMonitor({...});
```

---

### 问题 2: ValidatableSession 类型不完整

**文件**: `src/components/SessionList.tsx`, `src/hooks/useSessionCache.ts`
**错误**: 23 个相关错误

**原因**:
- `ValidatableSession` 只定义了 `{ id, first_message?, engine? }`
- 代码中访问了 `last_message_timestamp`, `message_timestamp`, `created_at`, `todo_data`, `project_id`, `project_path` 等未定义属性
- `Session` 类型包含 `siliconflow` 引擎，但 `ValidatableSession` 不包含

**修复方案**:
```typescript
// 更新 ValidatableSession 定义
export interface ValidatableSession {
  id: string;
  first_message?: string;
  engine?: "claude" | "codex" | "gemini" | "siliconflow";
  last_message_timestamp?: number;
  message_timestamp?: number;
  created_at?: string;
  todo_data?: unknown;
  project_id?: string;
  project_path?: string;
}
```

---

### 问题 3: 缺失模块 @core/types/unified-agent

**文件**: 多个文件
**错误**: `Cannot find module '@core/types/unified-agent'`

**受影响文件**:
- `src/core/agents/AgentRoles.ts`
- `src/core/agents/UnifiedAgentOrchestrator.property.test.ts`
- `src/tests/generators.ts`
- `src/tests/test-utils.ts`

**原因**: 路径别名配置问题或文件不存在

---

### 问题 4: UI 组件缺失

**文件**: `src/components/workflow/WorkflowControlPanel.tsx`
**错误**: 
- `Cannot find name 'ResizablePanelGroup'`
- `Cannot find name 'ResizablePanel'`
- `Cannot find name 'ResizableHandle'`

**文件**: `src/components/output/SmartOutputParser.tsx`
**错误**: `Cannot find name 'Button'`

**原因**: 组件未导入或未安装

---

### 问题 5: Popover 组件导出缺失

**文件**: `src/components/copilot/CopilotSidebar.tsx`
**错误**:
- `Module '"@/components/ui/popover"' has no exported member 'PopoverContent'`
- `Module '"@/components/ui/popover"' has no exported member 'PopoverTrigger'`

---

### 问题 6: Canvas 组件导出缺失

**文件**: `src/components/new-features/index.ts`
**错误**:
- `Module '"../canvas"' has no exported member 'CanvasRenderer'`
- `Module '"../canvas"' has no exported member 'CanvasMode'`
- `Module '"../canvas"' has no exported member 'CanvasLanguage'`
- `Module '"../canvas"' has no exported member 'CanvasRendererProps'`

---

### 问题 7: FileTreeExplorer 类型错误

**文件**: `src/components/explorer/FileTreeExplorer.tsx`
**错误**: `Argument of type 'FileNode' is not assignable to parameter of type 'FileNode[]'`

**原因**: 函数期望数组但传入了单个对象

---

### 问题 8: ExecutionEngineSelector 类型不匹配

**文件**: `src/components/ExecutionEngineSelector.tsx`
**错误**: 函数签名不匹配

```typescript
// 期望
(mode: string, distro: string | null) => Promise<void>

// 实际
(mode: "auto" | "native" | "wsl", wslDistro?: string | null) => Promise<string>
```

---

### 问题 9: HookToggleManager 缺失 API 方法

**文件**: `src/components/HookToggleManager.tsx`
**错误**: `Property 'getClaudeDir' does not exist on type`

---

### 问题 10: ToolRecommendationToast 缺失方法

**文件**: `src/components/ToolRecommendationToast.tsx`
**错误**: `Property 'global' does not exist on type`

---

## 🟡 中等问题（未使用的代码）

### 未使用的导入（155 个）

主要集中在以下文件：
- `src/components/copilot/CopilotSidebar.tsx` - 12 个未使用导入
- `src/components/workflow/WorkflowControlPanel.tsx` - 23 个未使用导入
- `src/components/input/MultiModalInput.tsx` - 9 个未使用导入
- `src/components/ProjectMCPQuickConfig.tsx` - 9 个未使用导入
- `src/examples/NewFeaturesDemo.tsx` - 21 个未使用导入

### 未使用的变量（47 个）

示例：
- `src/components/FloatingPromptInput/ControlBar.tsx`: `compactStatus`, `isCompacting`, `compactProgress`, `deltaMessagesCount`
- `src/components/UsageDashboard.tsx`: `hourlyData`, `setHourlyData`
- `src/components/workflow/DAGVisualizer.tsx`: `selectedTask`, `liveUpdate`, `onTaskRetry`, `onTaskCancel`

---

## 🟢 轻微问题（代码质量）

### 未使用的 @ts-expect-error 指令

**文件**: `src/lib/services/llmApiService.ts`
**行**: 572

### 可能的 undefined 访问

**文件**: `src/services/notificationService.ts`
**错误**: `'notification.duration' is possibly 'undefined'`

---

## 按文件分类的错误统计

| 文件 | 错误数 | 主要问题 |
|------|--------|----------|
| src/core/models/ModelRouter.property.test.ts | 30 | 测试类型问题 |
| src/components/SessionList.tsx | 23 | ValidatableSession 类型 |
| src/components/workflow/WorkflowControlPanel.tsx | 23 | 缺失组件 + 未使用导入 |
| src/lib/api.ts | 21 | 类型问题 |
| src/examples/NewFeaturesDemo.tsx | 21 | 未使用导入 |
| src/components/copilot/CopilotSidebar.tsx | 12 | 缺失导出 + 未使用导入 |
| src/components/input/MultiModalInput.tsx | 9 | 类型问题 + 未使用导入 |
| src/components/ProjectMCPQuickConfig.tsx | 9 | 类型问题 + 未使用导入 |

---

## 修复优先级建议

### P0 - 立即修复（阻塞构建）
1. 修复 `useSessionThresholdMonitor` 返回值解构
2. 更新 `ValidatableSession` 类型定义
3. 修复缺失的模块导入 (`@core/types/unified-agent`)
4. 添加缺失的 UI 组件导入

### P1 - 高优先级（功能问题）
1. 修复 `FileTreeExplorer` 类型错误
2. 修复 `ExecutionEngineSelector` 函数签名
3. 修复 `HookToggleManager` 缺失 API
4. 修复 `ToolRecommendationToast` 缺失方法

### P2 - 中优先级（代码清理）
1. 清理 155 个未使用的导入
2. 清理 47 个未使用的变量
3. 移除未使用的 @ts-expect-error 指令

### P3 - 低优先级（代码质量）
1. 添加 undefined 检查
2. 统一类型定义

---

## 正确性属性

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: 类型一致性
*For any* 组件或 Hook，其返回值类型必须与调用处的解构类型完全匹配
**Validates: Requirements 1.1, 3.1**

### Property 2: 导入完整性
*For any* 使用的组件或函数，必须存在对应的导入语句且模块必须导出该成员
**Validates: Requirements 1.2, 3.2**

### Property 3: 类型扩展兼容性
*For any* 扩展类型（如 ValidatableSession），必须包含所有被访问的属性
**Validates: Requirements 1.3, 3.3**

---

## 测试策略

### 单元测试
- 验证每个 Hook 的返回值类型
- 验证组件 props 类型
- 验证 API 函数签名

### 属性测试
- 类型一致性检查
- 导入完整性检查
- 运行时类型验证

---

## 错误处理

### 类型错误处理
1. 使用 TypeScript 严格模式
2. 启用 `noImplicitAny`
3. 启用 `strictNullChecks`

### 运行时错误处理
1. 添加 null/undefined 检查
2. 使用 Optional Chaining
3. 添加 ErrorBoundary
