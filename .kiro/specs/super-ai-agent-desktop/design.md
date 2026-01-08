# Design Document: Super AI Agent Desktop

## Overview

本设计文档描述了一个三合一超级 AI Agent 桌面应用的技术架构，融合了：
- **Kiro** 的 Spec 驱动开发、Steering 规则、Powers 扩展系统
- **Oh My OpenCode** 的多模型 Agent 编排、后台并行执行、LSP/AST 工具
- **Fangyu Code** 现有的 Tauri 桌面架构、AgentSwarmManager、HookChain

### 设计目标

1. **统一架构**：将三个系统的优势整合到一个一致的架构中
2. **最小化上下文**：按需加载，避免 token 浪费
3. **并行执行**：支持多 Agent 后台并行处理
4. **可扩展性**：通过 Powers/MCP/Skills 实现无限扩展
5. **安全第一**：多层安全机制保护用户代码

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Super AI Agent Desktop                               │
│                              (Tauri + React)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Frontend Layer (React)                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │ Chat UI  │  │  Editor  │  │ Spec UI  │  │ Agent Dashboard  │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴───────────────────────────────────┐    │
│  │                      Core Runtime Layer                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │    │
│  │  │ UnifiedAgent    │  │ EnhancedHook    │  │ ContextManager      │  │    │
│  │  │ Orchestrator    │  │ Engine          │  │ (70%/85% threshold) │  │    │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │    │
│  │           │                    │                      │              │    │
│  │  ┌────────┴────────┐  ┌────────┴────────┐  ┌─────────┴───────────┐  │    │
│  │  │ BackgroundAgent │  │ SteeringLoader  │  │ ReferenceResolver   │  │    │
│  │  │ Manager         │  │ (always/match/  │  │ (#File/#Folder/     │  │    │
│  │  │ (并发控制)       │  │  manual)        │  │  #Problems/etc)     │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴───────────────────────────────────┐    │
│  │                      Tool Integration Layer                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │ LSP      │  │ AST-Grep │  │ Powers   │  │ Skills   │            │    │
│  │  │ (13工具) │  │ (25语言) │  │ (按需)   │  │ Manager  │            │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴───────────────────────────────────┐    │
│  │                      Spec Execution Layer                            │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │    │
│  │  │ SpecExecutor    │  │ TodoEnforcer    │  │ TaskTracker         │  │    │
│  │  │ (需求→设计→任务)│  │ (强制继续)      │  │ (进度追踪)          │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴───────────────────────────────────┐    │
│  │                      Security & Process Layer                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │ Security │  │ Process  │  │ Autonomy │  │ Diagnos- │            │    │
│  │  │ Guard    │  │ Manager  │  │ Mode     │  │ tics     │            │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
├────────────────────────────────────┼────────────────────────────────────────┤
│                      Tauri Backend (Rust)                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ FileOps  │  │ Shell    │  │ MCP      │  │ Model    │                    │
│  │ (精确替换)│  │ Executor │  │ Bridge   │  │ Router   │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   Claude API        │ │   OpenAI API        │ │   Gemini API        │
│   (Opus/Sonnet)     │ │   (GPT-4/5)         │ │   (Pro/Flash)       │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

## Components and Interfaces

### 1. UnifiedAgentOrchestrator

统一 Agent 编排器，融合三个系统的 Agent 管理能力。

```typescript
// src/core/agents/UnifiedAgentOrchestrator.ts
interface AgentRole {
  id: string;
  name: string;
  type: AgentRoleType;
  model: ModelConfig;
  capabilities: AgentCapabilities;
  tools: ToolPermissions;
  prompt: string;
  temperature: number;
}

type AgentRoleType = 
  | 'orchestrator'   // 主编排器 (Sisyphus)
  | 'oracle'         // 架构师 (GPT)
  | 'librarian'      // 文档研究 (Claude Sonnet)
  | 'explorer'       // 代码探索 (Grok)
  | 'frontend'       // 前端开发 (Gemini)
  | 'backend'        // 后端开发
  | 'docs'           // 文档撰写
  | 'testing'        // 测试
  | 'review'         // 代码审查
  | 'devops';        // DevOps

interface UnifiedAgentOrchestrator {
  // Agent 生命周期
  createAgent(role: AgentRoleType, config?: Partial<AgentRole>): Promise<Agent>;
  cloneAgent(agentId: string, reason: string): Promise<Agent>;
  destroyAgent(agentId: string): Promise<void>;
  
  // 任务分配
  assignTask(task: Task): Promise<Agent>;
  calculateFitScore(agent: Agent, task: Task): number;
  
  // 后台执行
  spawnBackground(role: AgentRoleType, prompt: string): Promise<string>;
  getBackgroundStatus(taskId: string): BackgroundTaskStatus;
  cancelBackground(taskId: string): Promise<void>;
  
  // 并发控制
  getConcurrencyLimits(): ConcurrencyConfig;
  setConcurrencyLimits(config: ConcurrencyConfig): void;
  
  // 性能追踪
  getAgentMetrics(agentId: string): AgentMetrics;
  getPoolStatus(): PoolStatus;
}
```

### 2. EnhancedHookEngine

增强 Hook 引擎，合并三套 Hook 系统。

```typescript
// src/core/hooks/EnhancedHookEngine.ts
type HookEventType = 
  // Kiro 风格
  | 'onMessage'
  | 'onComplete'
  | 'onSessionCreate'
  | 'onFileSave'
  | 'manual'
  // OpenCode 风格
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'chat.message'
  | 'session.idle'
  | 'session.error'
  // 扩展事件
  | 'agent.spawn'
  | 'agent.complete'
  | 'task.start'
  | 'task.complete'
  | 'context.threshold';

interface SteeringRule {
  id: string;
  content: string;
  inclusion: 'always' | 'fileMatch' | 'manual';
  fileMatchPattern?: string;
  priority: number;
}

interface HookDefinition {
  id: string;
  name: string;
  event: HookEventType;
  matcher?: string | RegExp;
  priority: number;
  action: HookAction;
  canBlock: boolean;
}

interface EnhancedHookEngine {
  // Steering 管理
  loadSteering(path: string): Promise<SteeringRule[]>;
  getActiveSteering(context: ExecutionContext): SteeringRule[];
  
  // Hook 注册
  registerHook(hook: HookDefinition): void;
  unregisterHook(hookId: string): void;
  
  // 执行
  executeChain(event: HookEventType, context: HookContext): Promise<HookChainResult>;
  abort(): void;
  
  // Claude Code 兼容
  loadClaudeCodeHooks(settingsPath: string): Promise<void>;
  
  // 日志统计
  getExecutionLog(): HookLogEntry[];
  getStats(): HookStats;
}
```

### 3. SmartContextManager

智能上下文管理器，支持多模型适配和自动压缩。

```typescript
// src/core/context/SmartContextManager.ts
interface ModelContextConfig {
  modelId: string;
  maxTokens: number;
  warningThreshold: number;  // 0.7
  compactionThreshold: number;  // 0.85
}

interface ContextSource {
  type: 'system' | 'steering' | 'environment' | 'history' | 'tools' | 'reference';
  content: string;
  tokens: number;
  priority: number;
  compressible: boolean;
}

interface SmartContextManager {
  // 配置
  setModelConfig(config: ModelContextConfig): void;
  
  // 使用量追踪
  getUsage(): { used: number; total: number; percentage: number };
  
  // 阈值监控
  checkThresholds(): ThresholdStatus;
  onThresholdExceeded(callback: (status: ThresholdStatus) => void): void;
  
  // 压缩
  triggerCompaction(): Promise<CompactionResult>;
  
  // 输出截断
  truncateOutput(output: string, maxTokens?: number): string;
  
  // 去重注入
  inject(source: ContextSource): boolean;  // false if duplicate
  
  // #引用解析
  resolveReference(ref: string): Promise<string>;
}
```

### 4. IDEToolchain

IDE 级工具链，集成 LSP/AST-Grep/Powers/Skills。

```typescript
// src/core/tools/IDEToolchain.ts
interface LSPTools {
  hover(file: string, line: number, character: number): Promise<HoverInfo>;
  rename(file: string, line: number, character: number, newName: string): Promise<WorkspaceEdit>;
  references(file: string, line: number, character: number): Promise<Location[]>;
  definition(file: string, line: number, character: number): Promise<Location>;
  diagnostics(files: string[]): Promise<Diagnostic[]>;
  completion(file: string, line: number, character: number): Promise<CompletionItem[]>;
}

interface ASTGrepTools {
  search(pattern: string, lang: string, path?: string): Promise<ASTMatch[]>;
  replace(pattern: string, replacement: string, path: string, lang: string): Promise<ReplaceResult>;
  supportedLanguages(): string[];
}

interface PowersManager {
  list(): Power[];
  activate(powerName: string): Promise<PowerActivation>;
  use(powerName: string, serverName: string, toolName: string, args: any): Promise<any>;
  readSteering(powerName: string, steeringFile: string): Promise<string>;
  configure(): void;
}

interface IDEToolchain {
  lsp: LSPTools;
  astGrep: ASTGrepTools;
  powers: PowersManager;
  skills: SkillManager;
  
  // 统一接口
  analyzeCode(file: string, position: Position): Promise<CodeAnalysis>;
  validateSyntax(file: string): Promise<ValidationResult>;
}
```

### 5. SpecExecutor

Spec 驱动执行器，实现需求→设计→任务的自动化流程。

```typescript
// src/core/spec/SpecExecutor.ts
interface SpecWorkflow {
  featureName: string;
  status: 'requirements' | 'design' | 'tasks' | 'executing' | 'completed';
  requirements?: RequirementsDoc;
  design?: DesignDoc;
  tasks?: TaskList;
}

interface TaskItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  assignedAgent?: string;
  progress: number;
  subtasks?: TaskItem[];
  isOptional: boolean;
}

interface SpecExecutor {
  // 工作流管理
  createSpec(featureName: string, idea: string): Promise<SpecWorkflow>;
  loadSpec(featureName: string): Promise<SpecWorkflow>;
  
  // 阶段推进
  generateRequirements(idea: string): Promise<RequirementsDoc>;
  generateDesign(requirements: RequirementsDoc): Promise<DesignDoc>;
  generateTasks(design: DesignDoc): Promise<TaskList>;
  
  // 任务执行
  executeTask(taskId: string): Promise<TaskResult>;
  updateTaskStatus(taskId: string, status: TaskStatus): void;
  
  // Todo Enforcer
  checkIncompleteTasks(): TaskItem[];
  enforceCompletion(): Promise<void>;
  
  // 进度追踪
  getProgress(): SpecProgress;
  onProgressUpdate(callback: (progress: SpecProgress) => void): void;
}
```

### 6. SecurityGuard

安全防护层，实现多层安全机制。

```typescript
// src/core/security/SecurityGuard.ts
interface SecurityConfig {
  workspaceBoundary: string;
  dangerousCommands: string[];
  sensitivePatterns: RegExp[];
  commandWhitelist?: string[];
}

interface SecurityGuard {
  // 路径验证
  validatePath(path: string): ValidationResult;
  isWithinWorkspace(path: string): boolean;
  
  // 命令安全
  validateCommand(command: string): ValidationResult;
  isDangerousCommand(command: string): boolean;
  
  // 敏感信息
  redactSensitiveInfo(content: string): string;
  detectSensitiveInfo(content: string): SensitiveMatch[];
  
  // 审计
  logOperation(operation: Operation): void;
  getAuditLog(): AuditEntry[];
  
  // 确认
  requireConfirmation(operation: Operation): Promise<boolean>;
}
```

### 7. ProcessManager

进程管理器，支持后台进程的启动/停止/监控。

```typescript
// src/core/process/ProcessManager.ts
interface BackgroundProcess {
  id: number;
  command: string;
  path: string;
  status: 'running' | 'stopped' | 'error';
  startTime: number;
  output: string[];
}

interface ProcessManager {
  // 命令执行
  execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;
  
  // 后台进程
  startBackground(command: string, path?: string): Promise<BackgroundProcess>;
  stopBackground(processId: number): Promise<void>;
  listProcesses(): BackgroundProcess[];
  getOutput(processId: number, lines?: number): string[];
  
  // 长时间运行检测
  isLongRunning(command: string): boolean;
  suggestBackgroundMode(command: string): boolean;
}
```

## Data Models

### Agent 角色配置

```typescript
const AGENT_ROLES: Record<AgentRoleType, AgentRole> = {
  orchestrator: {
    id: 'orchestrator',
    name: 'Sisyphus',
    type: 'orchestrator',
    model: { provider: 'anthropic', model: 'claude-opus-4-5' },
    capabilities: { languages: ['*'], frameworks: ['*'], tools: ['*'] },
    tools: { read: true, write: true, execute: true },
    prompt: 'You are Sisyphus, the main orchestrator...',
    temperature: 0.1
  },
  oracle: {
    id: 'oracle',
    name: 'Oracle',
    type: 'oracle',
    model: { provider: 'openai', model: 'gpt-5.2' },
    capabilities: { specializations: ['architecture', 'code-review', 'strategy'] },
    tools: { read: true, write: false, execute: false },
    prompt: 'You are Oracle, a senior architect...',
    temperature: 0.1
  },
  // ... 其他角色
};
```

### 并发控制配置

```typescript
const CONCURRENCY_CONFIG: ConcurrencyConfig = {
  defaultConcurrency: 5,
  providerConcurrency: {
    anthropic: 3,
    openai: 5,
    google: 10,
    xai: 5
  },
  modelConcurrency: {
    'anthropic/claude-opus-4-5': 2,
    'openai/gpt-5.2': 3
  }
};
```

### 上下文阈值配置

```typescript
const CONTEXT_THRESHOLDS: Record<string, ModelContextConfig> = {
  'claude-opus-4-5': { maxTokens: 200000, warningThreshold: 0.7, compactionThreshold: 0.85 },
  'claude-sonnet-4-5': { maxTokens: 200000, warningThreshold: 0.7, compactionThreshold: 0.85 },
  'gpt-5.2': { maxTokens: 128000, warningThreshold: 0.7, compactionThreshold: 0.85 },
  'gemini-3-pro': { maxTokens: 1000000, warningThreshold: 0.8, compactionThreshold: 0.9 }
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Agent 任务分配适配性

*For any* 提交的任务和可用的 Agent 池，系统选择的 Agent 角色应该与任务需求匹配（前端任务分配给 Frontend Agent，后端任务分配给 Backend Agent 等）。

**Validates: Requirements 1.2**

### Property 2: 并行任务独立性

*For any* 一组标记为独立的任务，它们的执行顺序不应影响最终结果，且应能并行执行。

**Validates: Requirements 1.3, 6.2**

### Property 3: Agent 克隆等价性

*For any* Agent 克隆操作，克隆后的 Agent 应具有与原 Agent 相同的配置（角色、模型、能力、工具权限）。

**Validates: Requirements 1.5**

### Property 4: 任务队列优先级排序

*For any* 进入队列的任务集合，出队顺序应严格按照优先级从高到低排列。

**Validates: Requirements 1.6**

### Property 5: Hook 链执行顺序

*For any* 匹配同一事件的多个 Hook，它们的执行顺序应严格按照优先级从高到低排列。

**Validates: Requirements 2.4**

### Property 6: Hook 阻塞传播

*For any* Hook 链执行，如果某个 Hook 返回阻塞决定，则后续所有 Hook 都不应执行。

**Validates: Requirements 2.3, 2.6**

### Property 7: Steering 规则加载正确性

*For any* Steering 规则文件，系统应根据 inclusion 模式（always/fileMatch/manual）正确决定是否加载。

**Validates: Requirements 2.2**

### Property 8: AST 模式搜索准确性

*For any* AST-Grep 搜索模式和代码库，返回的所有匹配结果都应真正匹配该模式。

**Validates: Requirements 3.2**

### Property 9: 语法验证正确性

*For any* 代码修改操作，如果修改后的代码有语法错误，验证应返回失败。

**Validates: Requirements 3.6**

### Property 10: 上下文阈值触发

*For any* 上下文使用量，当超过 70% 时应触发警告通知，当超过 85% 时应触发自动压缩。

**Validates: Requirements 4.2, 4.3**

### Property 11: 上下文去重注入

*For any* 相同内容的多次注入请求，上下文中应只保留一份副本。

**Validates: Requirements 4.6**

### Property 12: 压缩信息保留

*For any* 上下文压缩操作，标记为关键的信息应在压缩后保留。

**Validates: Requirements 4.7**

### Property 13: EARS 格式合规性

*For any* 系统生成的需求文档，每条需求应符合 EARS 模式之一（Ubiquitous/Event-driven/State-driven/Unwanted/Optional/Complex）。

**Validates: Requirements 5.2**

### Property 14: 任务依赖顺序

*For any* 生成的任务列表，如果任务 A 依赖任务 B，则 B 应在 A 之前执行。

**Validates: Requirements 5.4**

### Property 15: 后台任务生命周期

*For any* 后台任务，从创建到完成应经历正确的状态转换（pending → running → completed/failed），且完成时应触发通知。

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 16: 并发限制遵守

*For any* 模型/提供商的并发配置，同时运行的任务数不应超过配置的限制。

**Validates: Requirements 6.3**

### Property 17: 模型回退正确性

*For any* 主模型不可用的情况，系统应自动切换到配置的回退模型。

**Validates: Requirements 7.3**

### Property 18: Token 使用统计准确性

*For any* API 请求，记录的 token 使用量应与实际使用量一致。

**Validates: Requirements 7.4**

### Property 19: 路径安全验证

*For any* 文件路径操作，包含路径遍历尝试（../）或工作区外路径的请求应被拒绝。

**Validates: Requirements 12.1, 12.2**

### Property 20: 危险命令拦截

*For any* shell 命令执行请求，匹配危险命令模式的请求应被拦截并要求确认。

**Validates: Requirements 12.3, 12.7**

### Property 21: 敏感信息脱敏

*For any* 包含敏感信息（API 密钥、密码、PII）的内容，输出时应自动脱敏。

**Validates: Requirements 12.4**

### Property 22: 审计日志完整性

*For any* 系统操作，应在审计日志中留下记录，包含操作类型、时间、参数和结果。

**Validates: Requirements 12.5**

### Property 23: strReplace 唯一匹配

*For any* strReplace 操作，如果匹配数为 0 或大于 1，操作应失败并返回错误。

**Validates: Requirements 15.2**

### Property 24: strReplace 精确替换

*For any* strReplace 操作，只有匹配的部分应被修改，文件其余部分应保持不变。

**Validates: Requirements 15.1**

### Property 25: 文件编码保持

*For any* 文件修改操作，原文件的编码和行尾格式应在修改后保持不变。

**Validates: Requirements 15.5**

### Property 26: #引用解析正确性

*For any* #引用（#File、#Folder、#Problems 等），解析后的内容应与引用目标的实际内容一致。

**Validates: Requirements 10.1-10.7**

### Property 27: 自治模式切换

*For any* 模式切换操作，系统应立即按新模式行为（Autopilot 自动执行，Supervised 需确认）。

**Validates: Requirements 11.1, 11.2**

## Error Handling

### 错误分类

| 错误类型 | 处理策略 | 用户通知 |
|---------|---------|---------|
| 网络错误 | 自动重试 3 次，指数退避 | 重试失败后通知 |
| 模型 API 错误 | 尝试回退模型 | 所有模型失败后通知 |
| 文件操作错误 | 回滚已执行的操作 | 立即通知 |
| 权限错误 | 请求用户授权 | 立即通知 |
| 上下文溢出 | 触发压缩 | 压缩后通知 |
| 任务超时 | 取消任务，释放资源 | 通知并提供重试选项 |
| 安全违规 | 阻止操作，记录审计 | 立即通知 |

### 错误恢复机制

```typescript
interface ErrorRecovery {
  // 网络错误重试
  retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T>;
  
  // 模型回退
  fallbackToAlternativeModel(
    originalModel: string,
    error: Error
  ): Promise<ModelConfig>;
  
  // 文件操作回滚
  rollbackFileOperations(
    operations: FileOperation[]
  ): Promise<void>;
  
  // 上下文压缩
  compactContext(
    context: ContextSource[],
    targetReduction: number
  ): Promise<ContextSource[]>;
}
```

### 错误日志格式

```typescript
interface ErrorLog {
  timestamp: number;
  errorType: ErrorType;
  message: string;
  stack?: string;
  context: {
    operation: string;
    agent?: string;
    task?: string;
    file?: string;
  };
  recovery: {
    attempted: boolean;
    successful: boolean;
    action: string;
  };
}
```

## Testing Strategy

### 测试框架选择

- **单元测试**: Vitest（与 Vite 集成，快速）
- **属性测试**: fast-check（TypeScript 原生支持）
- **集成测试**: Playwright（跨平台桌面应用测试）
- **E2E 测试**: Tauri Driver（Tauri 官方测试工具）

### 测试层次

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E Tests (Tauri Driver)                  │
│                    完整用户流程测试                           │
├─────────────────────────────────────────────────────────────┤
│                Integration Tests (Playwright)                │
│                组件间交互测试                                 │
├─────────────────────────────────────────────────────────────┤
│                Property Tests (fast-check)                   │
│                正确性属性验证                                 │
├─────────────────────────────────────────────────────────────┤
│                  Unit Tests (Vitest)                         │
│                  单个函数/类测试                              │
└─────────────────────────────────────────────────────────────┘
```

### 属性测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['**/*.property.test.ts'],
    testTimeout: 30000,  // 属性测试需要更长时间
  }
});

// 属性测试示例
import { fc } from 'fast-check';

describe('Property Tests', () => {
  // Property 23: strReplace 唯一匹配
  // Feature: super-ai-agent-desktop, Property 23: strReplace unique match
  it('strReplace should fail when match count is not exactly 1', () => {
    fc.assert(
      fc.property(
        fc.string(),  // 文件内容
        fc.string(),  // 搜索字符串
        fc.string(),  // 替换字符串
        (content, search, replace) => {
          const matchCount = content.split(search).length - 1;
          const result = strReplace(content, search, replace);
          
          if (matchCount === 1) {
            expect(result.success).toBe(true);
          } else {
            expect(result.success).toBe(false);
            expect(result.error).toContain(
              matchCount === 0 ? 'no match' : 'multiple matches'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Property 19: 路径安全验证
  // Feature: super-ai-agent-desktop, Property 19: path security validation
  it('should reject path traversal attempts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('..', '.', 'normal', 'path')),
        (pathParts) => {
          const path = pathParts.join('/');
          const result = validatePath(path, '/workspace');
          
          if (path.includes('..')) {
            expect(result.valid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 测试覆盖要求

| 测试类型 | 覆盖目标 | 最低要求 |
|---------|---------|---------|
| 单元测试 | 核心业务逻辑 | 80% 行覆盖 |
| 属性测试 | 所有正确性属性 | 100% 属性覆盖 |
| 集成测试 | 组件交互 | 关键路径 100% |
| E2E 测试 | 用户流程 | 主要流程 100% |

### 测试数据生成器

```typescript
// 自定义生成器
const agentRoleArb = fc.constantFrom(
  'orchestrator', 'oracle', 'librarian', 'explorer',
  'frontend', 'backend', 'docs', 'testing', 'review', 'devops'
);

const taskArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  type: fc.constantFrom('frontend', 'backend', 'docs', 'testing'),
  priority: fc.integer({ min: 1, max: 10 }),
  dependencies: fc.array(fc.uuid(), { maxLength: 5 })
});

const filePathArb = fc.array(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split(''))),
  { minLength: 1, maxLength: 5 }
).map(parts => parts.join('/'));
```

### CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit
      
  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:property
      
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
```

