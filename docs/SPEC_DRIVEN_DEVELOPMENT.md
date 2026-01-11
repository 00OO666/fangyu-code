# Spec-Driven Development with LSP Integration

这个文档介绍如何在 Fangyu Code 中使用新实现的规范驱动开发和 LSP 集成功能。

## 🎯 功能概览

### 1. LSP 自动加载器
自动检测项目中使用的编程语言，并为每种语言启动对应的 Language Server，为 LLM 提供实时的代码分析能力。

**支持的语言**：
- TypeScript/JavaScript
- Rust
- Python
- Go
- Java
- C/C++
- C#
- PHP
- Ruby
- Vue

### 2. 规范生成引擎
将自然语言需求转换为结构化的技术规范，包含：
- 架构设计
- API 设计
- 实现计划
- 测试策略
- 部署计划

### 3. 增强的代理系统
新增 5 个专门的代理：
- **CodeGenerator**: 基于规范生成高质量代码
- **TestWriter**: 生成全面的测试套件
- **Deployer**: 执行构建和部署流程
- **Monitor**: 设置监控和告警
- **SpecAnalyzer**: 分析和验证技术规范

### 4. 代理协作系统
实现多代理协作，支持：
- 任务依赖管理
- 并行任务执行
- 代理间数据传递
- 工作流编排

---

## 📦 安装和配置

### 前置条件

确保已安装所需的 Language Server：

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server

# Rust
rustup component add rust-analyzer

# Python
pip install python-lsp-server

# Go
go install golang.org/x/tools/gopls@latest

# 其他语言的 Language Server 请参考官方文档
```

### 配置

在项目中创建配置文件：

```typescript
// config/workflow.config.ts
import { WorkflowConfig } from '@/core/workflow/SpecDrivenWorkflow';
import { createHiAPIClient } from '@/core/api/RealAPIClient';

export const workflowConfig: WorkflowConfig = {
  workspaceRoot: '/path/to/your/project',
  apiClient: createHiAPIClient('your-api-key'),
  model: 'claude-opus-4-5-20250514',
  enableLSP: true,
};
```

---

## 🚀 使用示例

### 示例 1: 基本的规范驱动开发

```typescript
import { SpecDrivenWorkflow } from '@/core/workflow/SpecDrivenWorkflow';
import { workflowConfig } from './config/workflow.config';

async function main() {
  // 创建工作流实例
  const workflow = new SpecDrivenWorkflow(workflowConfig);

  // 初始化（启动 LSP）
  await workflow.initialize();

  // 定义需求
  const requirements = `
    Create a user authentication system with the following features:
    - User registration with email and password
    - Login with JWT tokens
    - Password reset functionality
    - Email verification
    - Rate limiting for security
  `;

  // 执行工作流
  const result = await workflow.executeFromRequirements(
    requirements,
    'feature',
    {
      dryRun: false,
      stopOnError: true,
    }
  );

  // 查看结果
  console.log('Workflow completed:', result.success);
  console.log('Duration:', result.duration, 'ms');
  console.log('\nReport:\n', result.report);

  // 导出规范
  const specMarkdown = await workflow.exportSpec(result.spec, 'markdown');
  console.log('\nSpecification:\n', specMarkdown);

  // 关闭
  await workflow.shutdown();
}

main().catch(console.error);
```

### 示例 2: 只生成规范（不执行）

```typescript
import { SpecGenerationEngine } from '@/core/spec/SpecGenerationEngine';
import { createHiAPIClient } from '@/core/api/RealAPIClient';

async function generateSpecOnly() {
  const apiClient = createHiAPIClient('your-api-key');
  const engine = new SpecGenerationEngine(apiClient);

  const requirements = `
    Build a real-time chat application with:
    - WebSocket connections
    - Message persistence
    - User presence indicators
    - Typing indicators
    - File sharing
  `;

  // 生成规范
  const spec = await engine.generateSpec(requirements, 'feature', {
    includeArchitecture: true,
    includeAPI: true,
    includeTesting: true,
    includeDeployment: true,
    detailLevel: 'detailed',
  });

  // 导出为不同格式
  const json = await engine.exportSpec(spec, 'json');
  const yaml = await engine.exportSpec(spec, 'yaml');
  const markdown = await engine.exportSpec(spec, 'markdown');

  console.log('Specification generated successfully');
  console.log('Title:', spec.metadata.title);
  console.log('Phases:', spec.implementation.phases.length);
}

generateSpecOnly().catch(console.error);
```

### 示例 3: 使用 LSP 功能

```typescript
import { LSPAutoLoader } from '@/core/tools/LSPAutoLoader';

async function useLSP() {
  const lspLoader = new LSPAutoLoader('/path/to/project');

  // 初始化（自动检测语言并启动 Language Server）
  await lspLoader.initialize();

  // 查看活动的 Language Server
  const servers = lspLoader.getActiveServers();
  console.log('Active Language Servers:', servers);

  // 获取 LSP 工具
  const tools = lspLoader.getTools();

  // 使用 LSP 功能
  const hoverInfo = await tools.hover('src/index.ts', 10, 5);
  console.log('Hover info:', hoverInfo);

  const definition = await tools.definition('src/index.ts', 10, 5);
  console.log('Definition:', definition);

  const diagnostics = await tools.diagnostics('src/index.ts');
  console.log('Diagnostics:', diagnostics);

  // 获取 LLM 上下文
  const context = lspLoader.getLLMContext();
  console.log('LSP Context for LLM:\n', context);

  // 关闭
  await lspLoader.shutdown();
}

useLSP().catch(console.error);
```

### 示例 4: 手动创建协作工作流

```typescript
import { AgentCollaborationSystem } from '@/core/agents/AgentCollaborationSystem';
import { TechnicalSpec } from '@/core/spec/SpecGenerationEngine';

async function manualWorkflow(spec: TechnicalSpec) {
  const collaboration = new AgentCollaborationSystem();

  // 从规范创建工作流
  const workflow = collaboration.createWorkflowFromSpec(spec);

  console.log('Workflow created:', workflow.id);
  console.log('Phases:', workflow.phases.length);

  // 执行工作流
  await collaboration.executeWorkflow(
    workflow.id,
    async (agentId, task) => {
      console.log(`Executing task ${task.id} with agent ${agentId}`);

      // 这里应该调用实际的代理执行逻辑
      // 例如：调用 UnifiedAgentOrchestrator

      return {
        taskId: task.id,
        agentId,
        success: true,
        output: { result: 'Task completed' },
        duration: 1000,
      };
    }
  );

  // 生成报告
  const report = collaboration.generateWorkflowReport(workflow.id);
  console.log('\nWorkflow Report:\n', report);
}
```

### 示例 5: 更新现有规范

```typescript
import { SpecGenerationEngine } from '@/core/spec/SpecGenerationEngine';
import { createHiAPIClient } from '@/core/api/RealAPIClient';

async function updateExistingSpec(existingSpec: TechnicalSpec) {
  const apiClient = createHiAPIClient('your-api-key');
  const engine = new SpecGenerationEngine(apiClient);

  const updates = `
    Add the following features to the authentication system:
    - Two-factor authentication (2FA)
    - OAuth integration (Google, GitHub)
    - Session management with Redis
  `;

  // 更新规范
  const updatedSpec = await engine.updateSpec(existingSpec, updates);

  console.log('Specification updated');
  console.log('New phases:', updatedSpec.implementation.phases.length);

  return updatedSpec;
}
```

---

## 🏗️ 架构说明

### 工作流程

```
用户需求
    ↓
规范生成引擎 (SpecGenerationEngine)
    ↓
技术规范 (TechnicalSpec)
    ↓
规范分析代理 (SpecAnalyzer) - 验证
    ↓
协作工作流 (CollaborationWorkflow)
    ↓
多代理协作执行
    ├─ CodeGenerator → 生成代码
    ├─ TestWriter → 编写测试
    ├─ Deployer → 执行部署
    └─ Monitor → 设置监控
    ↓
LSP 支持 (实时代码分析)
    ↓
最终报告
```

### 代理协作流程

```
Phase 1: 架构设计
  ├─ Task 1.1: 设计数据模型 (Backend)
  ├─ Task 1.2: 设计 API (Backend)
  └─ Task 1.3: 设计前端组件 (Frontend)

Phase 2: 实现
  ├─ Task 2.1: 实现后端 API (CodeGenerator + Backend)
  │   └─ 依赖: Task 1.1, 1.2
  ├─ Task 2.2: 实现前端组件 (CodeGenerator + Frontend)
  │   └─ 依赖: Task 1.3
  └─ Task 2.3: 集成前后端 (CodeGenerator)
      └─ 依赖: Task 2.1, 2.2

Phase 3: 测试
  ├─ Task 3.1: 单元测试 (TestWriter)
  │   └─ 依赖: Task 2.1, 2.2
  └─ Task 3.2: 集成测试 (TestWriter)
      └─ 依赖: Task 2.3

Phase 4: 部署
  ├─ Task 4.1: 构建和部署 (Deployer)
  │   └─ 依赖: Task 3.1, 3.2
  └─ Task 4.2: 设置监控 (Monitor)
      └─ 依赖: Task 4.1
```

---

## 🔧 高级配置

### 自定义代理行为

```typescript
import { ENHANCED_AGENT_ROLES } from '@/core/agents/EnhancedAgentRoles';

// 修改代理配置
ENHANCED_AGENT_ROLES['code-generator'].model.temperature = 0.1;
ENHANCED_AGENT_ROLES['code-generator'].model.maxTokens = 32768;
```

### 添加自定义 Language Server

```typescript
import { LANGUAGE_SERVER_CONFIGS } from '@/core/tools/LSPAutoLoader';

// 添加新的 Language Server 配置
LANGUAGE_SERVER_CONFIGS.push({
  language: 'kotlin',
  command: 'kotlin-language-server',
  args: [],
  fileExtensions: ['.kt', '.kts'],
});
```

### 自定义工作流执行器

```typescript
class CustomWorkflowExecutor {
  async executeAgentTask(agentId: string, task: CollaborationTask) {
    // 自定义执行逻辑
    // 例如：调用实际的 UnifiedAgentOrchestrator
    const orchestrator = new UnifiedAgentOrchestrator();
    const agent = await orchestrator.createAgent(agentId);
    const result = await agent.execute(task);
    return result;
  }
}
```

---

## 📊 监控和调试

### 查看工作流状态

```typescript
const workflow = new SpecDrivenWorkflow(config);
await workflow.initialize();

// 执行工作流
const result = await workflow.executeFromRequirements(requirements, 'feature');

// 查看状态
const status = workflow.getWorkflowStatus(result.workflowId);
console.log('Workflow status:', status?.status);
console.log('Phases:', status?.phases.map(p => ({
  phase: p.phase,
  name: p.name,
  status: p.status,
  tasks: p.tasks.length,
})));
```

### 重试失败的任务

```typescript
// 如果某个任务失败，可以重试
const retryResult = await workflow.retryFailedTask(
  workflowId,
  'task-id-that-failed'
);

console.log('Retry result:', retryResult.success);
```

### 取消工作流

```typescript
// 取消正在执行的工作流
workflow.cancelWorkflow(workflowId);
```

---

## 🎓 最佳实践

1. **明确需求**：提供详细、明确的需求描述，包括功能、约束和验收标准

2. **先生成规范**：在执行前先生成规范并审查，确保理解正确

3. **使用 Dry Run**：首次执行时使用 `dryRun: true` 查看工作流计划

4. **启用 LSP**：对于代码密集型任务，启用 LSP 可以提供更好的代码质量

5. **监控执行**：使用工作流报告监控执行进度和结果

6. **处理失败**：为失败的任务设置重试策略

7. **保存规范**：将生成的规范保存为文档，便于后续参考和更新

---

## 🐛 故障排除

### Language Server 启动失败

```bash
# 检查 Language Server 是否已安装
which typescript-language-server
which rust-analyzer

# 查看 LSP 日志
# 日志位置：~/.fangyu-code/lsp-logs/
```

### 规范生成质量不佳

- 提供更详细的需求描述
- 使用 `detailLevel: 'detailed'`
- 增加示例和约束条件

### 代理执行失败

- 检查 API 配置和密钥
- 查看错误日志
- 使用 `stopOnError: false` 继续执行其他任务

---

## 📚 相关文档

- [Agent Roles Configuration](../agents/AgentRoles.ts)
- [Enhanced Agent Roles](../agents/EnhancedAgentRoles.ts)
- [LSP Tools](../tools/LSPTools.ts)
- [Spec Generation Engine](../spec/SpecGenerationEngine.ts)
- [Agent Collaboration System](../agents/AgentCollaborationSystem.ts)

---

## 🤝 贡献

欢迎贡献代码和改进建议！请参考项目的贡献指南。

---

**版本**: 1.0.0
**最后更新**: 2026-01-10
