# Powers 系统使用指南

## 概述

Powers 是 Fangyu Code 的扩展能力系统，类似于 Kiro 的 Powers 概念，提供模块化的 AI 能力扩展。

## 核心组件

### Agent 编排系统
- **UnifiedAgentOrchestrator** - 统一的 Agent 调度器
- **TaskQueue** - 优先级任务队列
- **AgentRoles** - Agent 角色定义

### 工具链
- **IDEToolchain** - IDE 集成工具
- **PreciseFileOps** - 精确文件操作
- **SecurityLayer** - 安全层

### 上下文管理
- **ContextManager** - 上下文管理器
- **ContextPruner** - 上下文裁剪

## 使用方式

### 1. 任务分配

```typescript
import { UnifiedAgentOrchestrator } from '@/core/agents';

const orchestrator = new UnifiedAgentOrchestrator();
const result = await orchestrator.assignTask({
  type: 'code-review',
  priority: 1,
  payload: { file: 'src/app.ts' }
});
```

### 2. 工具调用

```typescript
import { IDEToolchain } from '@/core/tools';

const toolchain = new IDEToolchain();
const result = await toolchain.execute('readFile', {
  path: 'src/app.ts'
});
```

### 3. 上下文管理

```typescript
import { ContextManager } from '@/core/context';

const ctx = new ContextManager();
ctx.set('currentFile', 'src/app.ts');
ctx.set('projectRoot', '/workspace');
```

## 安全考虑

- 所有文件操作经过 SecurityLayer 验证
- 敏感路径自动过滤
- 操作日志记录

## 扩展开发

参考 `src/core/` 目录下的实现创建自定义 Power。
