# Requirements Document

## Introduction

统一工作流系统（Unified Workflow System）旨在合并现有的两套工作流实现：
1. **WorkflowManagerPanel** (Kiro 风格) - 基于 SpecDrivenWorkflow 类，功能简单但可用
2. **useWorkflowOrchestrator** (Devin/Windsurf 风格) - 基于 AgentSwarmManager，功能强大但未使用

目标是创建一个统一的、功能完整的工作流系统，结合两者的优势：
- Kiro 风格的规范生成能力
- Devin 风格的任务分解和并行执行能力
- React Hook 模式的状态管理
- 事件驱动的 UI 更新

## Glossary

- **Unified_Workflow_Engine**: 统一工作流引擎，负责协调任务规划、代理管理和执行调度
- **Task_Planner**: 任务规划器，将用户需求分解为 DAG（有向无环图）工作流
- **Agent_Swarm_Manager**: 代理群管理器，负责代理池管理、任务分配和并行执行
- **Spec_Generation_Engine**: 规范生成引擎，将用户需求转换为技术规范
- **Workflow_DAG**: 工作流有向无环图，表示任务之间的依赖关系
- **Agent_Pool**: 代理池，管理可用的 AI 代理实例
- **Execution_Context**: 执行上下文，包含任务执行所需的环境和状态信息

## Requirements

### Requirement 1: 统一工作流引擎

**User Story:** As a developer, I want a unified workflow engine that combines spec generation and task planning, so that I can process complex requirements with a single system.

#### Acceptance Criteria

1. WHEN a user submits a requirement, THE Unified_Workflow_Engine SHALL parse the requirement and generate a technical specification
2. WHEN a technical specification is generated, THE Unified_Workflow_Engine SHALL decompose it into a Workflow_DAG with task dependencies
3. WHEN tasks have no dependencies between them, THE Unified_Workflow_Engine SHALL identify them as parallelizable
4. IF the requirement parsing fails, THEN THE Unified_Workflow_Engine SHALL return a descriptive error with suggestions
5. THE Unified_Workflow_Engine SHALL support both simple (sequential) and complex (DAG) workflow modes

### Requirement 2: 任务规划与分解

**User Story:** As a developer, I want intelligent task decomposition, so that complex requirements are broken down into manageable, executable tasks.

#### Acceptance Criteria

1. WHEN a requirement is submitted, THE Task_Planner SHALL analyze it and create a list of atomic tasks
2. WHEN creating tasks, THE Task_Planner SHALL identify dependencies between tasks and build a DAG structure
3. WHEN a DAG is created, THE Task_Planner SHALL calculate the critical path for execution optimization
4. WHEN tasks are independent, THE Task_Planner SHALL mark them for parallel execution
5. IF a task cannot be decomposed, THEN THE Task_Planner SHALL treat it as a single atomic task
6. THE Task_Planner SHALL use the configured API (HiAPI, hone.vvvv.ee, or other OpenAI-compatible endpoints) for intelligent decomposition

### Requirement 3: 代理池管理

**User Story:** As a developer, I want a managed pool of AI agents, so that tasks can be executed efficiently with proper resource allocation.

#### Acceptance Criteria

1. THE Agent_Swarm_Manager SHALL maintain a pool of available agents with different capabilities
2. WHEN a task is ready for execution, THE Agent_Swarm_Manager SHALL assign the most suitable agent based on task type
3. WHEN multiple tasks are ready, THE Agent_Swarm_Manager SHALL execute them in parallel up to the configured concurrency limit
4. WHEN an agent completes a task, THE Agent_Swarm_Manager SHALL return it to the pool for reuse
5. IF no suitable agent is available, THEN THE Agent_Swarm_Manager SHALL queue the task until an agent becomes available
6. THE Agent_Swarm_Manager SHALL support agent types: orchestrator, planner, frontend, backend, testing, devops, review, docs

### Requirement 4: 工作流执行控制

**User Story:** As a developer, I want to control workflow execution with pause, resume, retry, and cancel operations, so that I can manage long-running workflows effectively.

#### Acceptance Criteria

1. WHEN a workflow is running, THE Unified_Workflow_Engine SHALL allow pausing execution at task boundaries
2. WHEN a workflow is paused, THE Unified_Workflow_Engine SHALL preserve the current state for later resumption
3. WHEN a paused workflow is resumed, THE Unified_Workflow_Engine SHALL continue from the last completed task
4. WHEN a task fails, THE Unified_Workflow_Engine SHALL allow retrying the failed task without restarting the entire workflow
5. WHEN a workflow is cancelled, THE Unified_Workflow_Engine SHALL stop all running tasks and clean up resources
6. THE Unified_Workflow_Engine SHALL emit events for all state changes (started, paused, resumed, completed, failed, cancelled)

### Requirement 5: React Hook 集成

**User Story:** As a frontend developer, I want a React Hook interface for the workflow system, so that I can easily integrate it into React components with proper state management.

#### Acceptance Criteria

1. THE useUnifiedWorkflow Hook SHALL expose workflow state (idle, planning, executing, paused, completed, failed)
2. THE useUnifiedWorkflow Hook SHALL provide methods: startWorkflow, pauseWorkflow, resumeWorkflow, retryTask, cancelWorkflow
3. WHEN workflow state changes, THE useUnifiedWorkflow Hook SHALL trigger React re-renders with updated state
4. THE useUnifiedWorkflow Hook SHALL expose current task progress (completed count, total count, current task)
5. THE useUnifiedWorkflow Hook SHALL expose execution logs and error messages
6. THE useUnifiedWorkflow Hook SHALL support cleanup on component unmount to prevent memory leaks

### Requirement 6: API 配置兼容性

**User Story:** As a user, I want to use my existing API configurations, so that I don't need to set up additional API keys.

#### Acceptance Criteria

1. THE Unified_Workflow_Engine SHALL read API configuration from localStorage (claude_api_key, claude_api_base_url)
2. THE Unified_Workflow_Engine SHALL support HiAPI endpoint (https://hiapi.online/v1)
3. THE Unified_Workflow_Engine SHALL support hone.vvvv.ee endpoint (https://hone.vvvv.ee/)
4. THE Unified_Workflow_Engine SHALL support any OpenAI-compatible API endpoint
5. IF no API key is configured, THEN THE Unified_Workflow_Engine SHALL display a clear error message with configuration instructions

### Requirement 7: 事件驱动架构

**User Story:** As a developer, I want an event-driven architecture, so that UI components can react to workflow changes in real-time.

#### Acceptance Criteria

1. THE Unified_Workflow_Engine SHALL emit events using EventEmitter pattern
2. WHEN a task starts, THE Unified_Workflow_Engine SHALL emit a 'task:started' event with task details
3. WHEN a task completes, THE Unified_Workflow_Engine SHALL emit a 'task:completed' event with results
4. WHEN a task fails, THE Unified_Workflow_Engine SHALL emit a 'task:failed' event with error details
5. WHEN workflow state changes, THE Unified_Workflow_Engine SHALL emit a 'workflow:stateChanged' event
6. THE Unified_Workflow_Engine SHALL support subscribing and unsubscribing to specific event types

### Requirement 8: UI 组件重构

**User Story:** As a user, I want an improved WorkflowManagerPanel UI, so that I can visualize and control workflows effectively.

#### Acceptance Criteria

1. THE WorkflowManagerPanel SHALL display the current workflow state with visual indicators
2. THE WorkflowManagerPanel SHALL show a DAG visualization of tasks and their dependencies
3. THE WorkflowManagerPanel SHALL provide buttons for pause, resume, retry, and cancel operations
4. THE WorkflowManagerPanel SHALL display real-time progress with completed/total task counts
5. THE WorkflowManagerPanel SHALL show execution logs with timestamps
6. WHEN a task fails, THE WorkflowManagerPanel SHALL highlight the failed task and show error details
