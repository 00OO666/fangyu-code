/**
 * Super AI Agent Desktop - Unified Agent Types
 *
 * Core type definitions for the unified agent orchestration system,
 * combining features from multiple agent systems and Fangyu Code.
 */

// ============================================================================
// Agent Role Types
// ============================================================================

export type AgentRoleType =
  | "orchestrator" // Main orchestrator (Sisyphus)
  | "oracle" // Architect (GPT)
  | "librarian" // Documentation research (Claude Sonnet)
  | "explorer" // Code exploration (Grok)
  | "frontend" // Frontend development (Gemini)
  | "backend" // Backend development
  | "docs" // Documentation writing
  | "testing" // Testing
  | "review" // Code review
  | "devops"; // DevOps

export type ModelProvider = "anthropic" | "openai" | "google" | "xai";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  fallbackModel?: string;
}

export interface AgentCapabilities {
  languages?: string[];
  frameworks?: string[];
  tools?: string[];
  specializations?: string[];
}

export interface ToolPermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
  network?: boolean;
}

export interface AgentRole {
  id: string;
  name: string;
  type: AgentRoleType;
  model: ModelConfig;
  capabilities: AgentCapabilities;
  tools: ToolPermissions;
  prompt: string;
  temperature: number;
}

export interface Agent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  createdAt: number;
  lastActiveAt: number;
  metrics: AgentMetrics;
}

export type AgentStatus = "idle" | "busy" | "error" | "terminated";

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  totalTokensUsed: number;
  averageCompletionTime: number;
  successRate: number;
}

// ============================================================================
// Task Types
// ============================================================================

export interface Task {
  id: string;
  description: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  dependencies: string[];
  assignedAgent?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: TaskResult;
  isBackground: boolean;
  metadata?: Record<string, unknown>;
}

export type TaskType =
  | "frontend"
  | "backend"
  | "docs"
  | "testing"
  | "review"
  | "devops"
  | "research"
  | "general"
  | "batch"; // 批量任务

export type TaskStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: string[];
  tokensUsed: number;
  duration: number;
}

// ============================================================================
// Concurrency Types
// ============================================================================

export interface ConcurrencyConfig {
  defaultConcurrency: number;
  providerConcurrency: Record<ModelProvider, number>;
  modelConcurrency: Record<string, number>;
}

export interface PoolStatus {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  queuedTasks: number;
  runningTasks: number;
}

// ============================================================================
// Background Task Types
// ============================================================================

export interface BackgroundTaskStatus {
  taskId: string;
  status: TaskStatus;
  progress: number;
  startedAt: number;
  estimatedCompletion?: number;
  output?: string[];
}

// ============================================================================
// Hook Types
// ============================================================================

export type HookEventType =
  // Core lifecycle events
  | "onMessage"
  | "onComplete"
  | "onSessionCreate"
  | "onFileSave"
  | "manual"
  // OpenCode-style events
  | "tool.execute.before"
  | "tool.execute.after"
  | "chat.message"
  | "session.idle"
  | "session.error"
  // Extended events
  | "agent.spawn"
  | "agent.complete"
  | "task.start"
  | "task.complete"
  | "context.threshold";

export type SteeringInclusion = "always" | "fileMatch" | "manual";

export interface SteeringRule {
  id: string;
  content: string;
  inclusion: SteeringInclusion;
  fileMatchPattern?: string;
  priority: number;
  source: string;
}

export interface HookDefinition {
  id: string;
  name: string;
  event: HookEventType;
  matcher?: string | RegExp;
  priority: number;
  action: HookAction;
  canBlock: boolean;
  enabled: boolean;
}

export type HookActionType = "message" | "command" | "function";

export interface HookAction {
  type: HookActionType;
  payload: string | (() => Promise<void>);
}

export interface HookContext {
  event: HookEventType;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
  agentId?: string;
}

export interface HookChainResult {
  executed: number;
  blocked: boolean;
  blockedBy?: string;
  results: HookExecutionResult[];
}

export interface HookExecutionResult {
  hookId: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface HookLogEntry {
  timestamp: number;
  hookId: string;
  event: HookEventType;
  success: boolean;
  duration: number;
  error?: string;
}

export interface HookStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  byEvent: Record<HookEventType, number>;
}

// ============================================================================
// Context Management Types
// ============================================================================

export interface ModelContextConfig {
  modelId: string;
  maxTokens: number;
  warningThreshold: number; // 0.7
  compactionThreshold: number; // 0.85
}

export type ContextSourceType =
  | "system"
  | "steering"
  | "environment"
  | "history"
  | "tools"
  | "reference";

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  content: string;
  tokens: number;
  priority: number;
  compressible: boolean;
  hash?: string;
}

export interface ContextUsage {
  used: number;
  total: number;
  percentage: number;
}

export type ThresholdLevel = "normal" | "warning" | "critical";

export interface ThresholdStatus {
  level: ThresholdLevel;
  percentage: number;
  remaining: number;
  shouldCompact: boolean;
}

export interface CompactionResult {
  originalTokens: number;
  compactedTokens: number;
  reduction: number;
  removedSources: string[];
}

// ============================================================================
// Reference Types (#File, #Folder, etc.)
// ============================================================================

export type ReferenceType = "file" | "folder" | "problems" | "terminal" | "gitDiff" | "codebase";

export interface Reference {
  type: ReferenceType;
  target: string;
  resolved?: string;
  tokens?: number;
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityConfig {
  workspaceBoundary: string;
  dangerousCommands: string[];
  sensitivePatterns: RegExp[];
  commandWhitelist?: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  severity?: "info" | "warning" | "error";
}

export interface SensitiveMatch {
  type: string;
  start: number;
  end: number;
  redacted: string;
}

export interface Operation {
  type: OperationType;
  target: string;
  params?: Record<string, unknown>;
  timestamp: number;
  agentId?: string;
}

export type OperationType =
  | "file.read"
  | "file.write"
  | "file.delete"
  | "command.execute"
  | "network.request";

export interface AuditEntry {
  id: string;
  operation: Operation;
  result: "success" | "failure" | "blocked";
  error?: string;
  duration: number;
}

// ============================================================================
// Process Management Types
// ============================================================================

export interface BackgroundProcess {
  id: number;
  command: string;
  path: string;
  status: ProcessStatus;
  startTime: number;
  output: string[];
  pid?: number;
}

export type ProcessStatus = "running" | "stopped" | "error";

export interface ExecuteOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  background?: boolean;
}

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// ============================================================================
// Spec Execution Types
// ============================================================================

export type SpecStatus = "requirements" | "design" | "tasks" | "executing" | "completed";

export interface SpecWorkflow {
  featureName: string;
  status: SpecStatus;
  requirements?: RequirementsDoc;
  design?: DesignDoc;
  tasks?: TaskList;
  createdAt: number;
  updatedAt: number;
}

export interface RequirementsDoc {
  introduction: string;
  glossary: Record<string, string>;
  requirements: Requirement[];
}

export interface Requirement {
  id: string;
  userStory: string;
  acceptanceCriteria: string[];
}

export interface DesignDoc {
  overview: string;
  architecture: string;
  components: ComponentSpec[];
  dataModels: DataModel[];
  correctnessProperties: CorrectnessProperty[];
  errorHandling: string;
  testingStrategy: string;
}

export interface ComponentSpec {
  name: string;
  description: string;
  interfaces: string;
}

export interface DataModel {
  name: string;
  definition: string;
}

export interface CorrectnessProperty {
  id: number;
  title: string;
  description: string;
  validates: string[];
}

export interface TaskList {
  overview: string;
  tasks: TaskItem[];
}

export interface TaskItem {
  id: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  assignedAgent?: string;
  progress: number;
  subtasks?: TaskItem[];
  isOptional: boolean;
  requirements?: string[];
  property?: number;
}

export interface SpecProgress {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  percentage: number;
}

// ============================================================================
// Autonomy Mode Types
// ============================================================================

export type AutonomyMode = "autopilot" | "supervised";

export interface AutonomyConfig {
  mode: AutonomyMode;
  confirmDangerous: boolean;
  autoApprovePatterns?: string[];
}

export interface OperationHistory {
  operations: Operation[];
  undoStack: UndoableOperation[];
}

export interface UndoableOperation {
  operation: Operation;
  undoAction: () => Promise<void>;
}

// ============================================================================
// File Operation Types
// ============================================================================

export interface StrReplaceOptions {
  path: string;
  oldStr: string;
  newStr: string;
}

export interface StrReplaceResult {
  success: boolean;
  matchCount: number;
  error?: string;
}

export interface FileEncoding {
  encoding: BufferEncoding;
  bom: boolean;
  lineEnding: "lf" | "crlf";
}

// ============================================================================
// IDE Toolchain Types
// ============================================================================

export interface Position {
  line: number;
  character: number;
}

export interface Location {
  file: string;
  range: Range;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface HoverInfo {
  contents: string;
  range?: Range;
}

export interface Diagnostic {
  file: string;
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
}

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface ASTMatch {
  file: string;
  range: Range;
  text: string;
  captures?: Record<string, string>;
}

export interface CodeAnalysis {
  hover?: HoverInfo;
  definition?: Location;
  references?: Location[];
  diagnostics?: Diagnostic[];
}

// ============================================================================
// Powers System Types
// ============================================================================

export interface MCPServer {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface Power {
  name: string;
  displayName: string;
  description: string;
  keywords: string[];
  mcpServers: MCPServer[];
  steeringFiles: string[];
  disabled: boolean;
}

export interface PowerConfig {
  disabled: boolean;
  autoApprove: string[];
  env: Record<string, string>;
}

export interface PowerActivation {
  powerName: string;
  overview: string;
  toolsByServer: Record<string, PowerTool[]>;
  steeringFiles: string[];
}

export interface PowerTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorType =
  | "network"
  | "model_api"
  | "file_operation"
  | "permission"
  | "context_overflow"
  | "timeout"
  | "security";

export interface ErrorLog {
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
