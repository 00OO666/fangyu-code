# 🚀 Fangyu Code 2.0 - 多代理自主编程系统

## 📖 概述

Fangyu Code 2.0 引入了革命性的多代理自主编程系统，能够将复杂任务自动分解为可并行执行的工作流，并通过多个专业化 AI 代理协同完成任务。

### ✨ 核心特性

- **🧠 智能任务分解** - 基于 Claude Opus 4 ultrathink 模式，自动生成 DAG 工作流
- **🤖 多代理并行** - 支持最多 20 个代理同时工作
- **🔄 自我克隆** - 代理可动态复制应对高负载
- **📊 实时可视化** - React Flow 驱动的交互式工作流图
- **🐳 代理沙箱** - Docker 隔离环境，安全执行代码
- **⚡ 智能调度** - 基于依赖图的优先级执行

---

## 🏗️ 架构组件

### 1. TaskPlanner（任务规划器）

**文件位置:** `src/core/planning/TaskPlanner.ts`

**功能:**
- 将用户自然语言需求转换为结构化工作流
- 自动识别可并行执行的任务
- 计算关键路径
- 估算任务复杂度和时间

**使用示例:**

\`\`\`typescript
import { TaskPlanner } from '@/core/planning/TaskPlanner';

const planner = new TaskPlanner({
  model: 'claude-opus-4-5-20251101',
  apiKey: process.env.CLAUDE_API_KEY,
  maxThinkingTokens: 10000,
  temperature: 0.7
});

const result = await planner.generateWorkflowDAG(
  '创建一个全栈博客系统，包含用户认证、文章CRUD、评论系统'
);

console.log('生成的工作流:', result.workflow);
console.log('AI 思考过程:', result.thinkingProcess);
\`\`\`

---

### 2. AgentSwarmManager（代理群管理器）

**文件位置:** `src/core/agents/AgentSwarmManager.ts`

**功能:**
- 创建和管理代理池
- 智能任务分配
- 代理克隆和负载均衡
- 代理间通信协调

**代理类型:**

| 类型 | 专长 | 适用场景 |
|------|------|---------|
| `orchestrator` | 总调度 | 工作流协调 |
| `frontend` | 前端开发 | React/Vue/Angular |
| `backend` | 后端开发 | API/数据库 |
| `fullstack` | 全栈开发 | 前后端集成 |
| `testing` | 测试 | 单元/E2E 测试 |
| `devops` | 运维 | CI/CD/部署 |
| `review` | 代码审查 | 质量检查 |
| `docs` | 文档 | API 文档 |

**使用示例:**

\`\`\`typescript
import { AgentSwarmManager } from '@/core/agents/AgentSwarmManager';

const swarmManager = new AgentSwarmManager({
  maxAgents: 20,
  maxConcurrentTasks: 10,
  taskTimeout: 300000
});

// 创建代理
const frontendAgent = await swarmManager.createAgent('frontend', 'React-Agent');
const backendAgent = await swarmManager.createAgent('backend', 'API-Agent');

// 部署并执行工作流
await swarmManager.deployAndExecute(workflow);

// 监听事件
swarmManager.on('task:completed', (event) => {
  console.log('任务完成:', event.task.description);
});
\`\`\`

---

### 3. SandboxManager（沙箱管理器）

**文件位置:** `src/core/sandbox/SandboxManager.ts`

**功能:**
- 为每个代理创建 Docker 隔离环境
- 终端会话管理
- 文件系统操作
- 浏览器自动化（Playwright）
- 资源监控

**使用示例:**

\`\`\`typescript
import { SandboxManager } from '@/core/sandbox/SandboxManager';

const sandboxManager = new SandboxManager(config);

// 创建沙箱
const sandbox = await sandboxManager.createSandbox({
  agentId: 'agent-1',
  projectPath: '/path/to/project',
  baseImage: 'node:20-alpine'
});

// 执行命令
const result = await sandboxManager.executeCommand(
  sandbox.id,
  'npm install && npm run build'
);

// 读写文件
await sandboxManager.writeFile(sandbox.id, '/workspace/src/App.tsx', code);
const content = await sandboxManager.readFile(sandbox.id, '/workspace/package.json');

// 启动浏览器测试
await sandboxManager.launchBrowser(sandbox.id, 'http://localhost:3000');
const screenshot = await sandboxManager.captureScreenshot(sandbox.id);
\`\`\`

---

### 4. DAGVisualizer（工作流可视化）

**文件位置:** `src/components/workflow/DAGVisualizer.tsx`

**功能:**
- 交互式工作流图展示
- 实时任务状态更新
- 关键路径高亮
- 代理活动监控

**使用示例:**

\`\`\`tsx
import { DAGVisualizer } from '@/components/workflow/DAGVisualizer';

<DAGVisualizer
  workflow={workflow}
  agents={agents}
  liveUpdate={true}
  isPaused={false}
  onTaskClick={(task) => console.log('点击任务:', task)}
  onTogglePause={() => setPaused(!paused)}
/>
\`\`\`

---

### 5. WorkflowControlPanel（主控制面板）

**文件位置:** `src/components/workflow/WorkflowControlPanel.tsx`

**功能:**
- 任务输入界面
- 工作流生成和执行控制
- 代理状态监控
- 日志和统计

**使用示例:**

\`\`\`tsx
import { WorkflowControlPanel } from '@/components/workflow/WorkflowControlPanel';

<WorkflowControlPanel
  config={{
    maxAgents: 20,
    maxConcurrentTasks: 10
  }}
  projectPath="/path/to/project"
  onClose={() => setShowPanel(false)}
/>
\`\`\`

---

## 🎯 完整使用流程

### 步骤 1: 集成到现有项目

在主应用中添加路由或菜单项：

\`\`\`tsx
// src/App.tsx
import { WorkflowControlPanel } from '@/components/workflow/WorkflowControlPanel';

function App() {
  const [showWorkflow, setShowWorkflow] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowWorkflow(true)}>
        <Workflow className="w-4 h-4 mr-2" />
        多代理工作流
      </Button>

      {showWorkflow && (
        <WorkflowControlPanel
          onClose={() => setShowWorkflow(false)}
        />
      )}
    </div>
  );
}
\`\`\`

### 步骤 2: 使用 Hook 管理工作流

\`\`\`tsx
import { useWorkflowOrchestrator } from '@/hooks/agents/useWorkflowOrchestrator';

function MyComponent() {
  const {
    workflow,
    agents,
    isPlanning,
    isRunning,
    generateWorkflow,
    startExecution,
    pauseExecution
  } = useWorkflowOrchestrator({
    projectPath: '/path/to/project',
    onWorkflowCompleted: (workflow) => {
      console.log('工作流完成!', workflow);
    }
  });

  const handleSubmit = async () => {
    // 生成工作流
    await generateWorkflow('创建一个 React + Express 全栈应用', true);

    // 开始执行
    await startExecution();
  };

  return (
    <div>
      <button onClick={handleSubmit}>开始</button>
      {isRunning && <button onClick={pauseExecution}>暂停</button>}

      <DAGVisualizer workflow={workflow} agents={agents} />
    </div>
  );
}
\`\`\`

### 步骤 3: 监听事件

\`\`\`tsx
const orchestrator = useWorkflowOrchestrator({
  onEvent: (event) => {
    switch (event.type) {
      case 'task:started':
        console.log('任务开始:', event.data.task.description);
        break;
      case 'task:completed':
        console.log('任务完成:', event.data.task.description);
        break;
      case 'agent:cloned':
        console.log('代理克隆:', event.data.clone.name);
        break;
    }
  }
});
\`\`\`

---

## 📦 依赖安装

添加到 `package.json`:

\`\`\`json
{
  "dependencies": {
    "reactflow": "^11.10.4",
    "dagre": "^0.8.5",
    "uuid": "^9.0.1",
    "framer-motion": "^10.16.16"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52",
    "@types/uuid": "^9.0.7"
  }
}
\`\`\`

安装命令:

\`\`\`bash
npm install reactflow dagre uuid framer-motion
npm install -D @types/dagre @types/uuid
\`\`\`

---

## ⚙️ 配置

### 环境变量

\`\`\`env
# Claude API 配置
CLAUDE_API_KEY=sk-xxx
CLAUDE_API_BASE_URL=https://api.anthropic.com

# 工作流配置
MAX_AGENTS=20
MAX_CONCURRENT_TASKS=10
TASK_TIMEOUT=300000

# Docker 配置
DOCKER_DEFAULT_IMAGE=node:20-alpine
DOCKER_MEMORY_LIMIT=2g
DOCKER_CPU_LIMIT=1
\`\`\`

### 代码配置

\`\`\`typescript
import { DEFAULT_WORKFLOW_CONFIG } from '@/core/types/workflow';

const customConfig: Partial<WorkflowConfig> = {
  maxAgents: 10,
  maxConcurrentTasks: 5,
  taskTimeout: 600000, // 10 分钟
  retryPolicy: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  },
  sandbox: {
    defaultImage: 'node:20-alpine',
    memoryLimit: '4g',
    cpuLimit: 2,
    timeout: 1200000 // 20 分钟
  }
};
\`\`\`

---

## 🐛 调试和日志

### 启用详细日志

\`\`\`typescript
const orchestrator = useWorkflowOrchestrator({
  config: {
    logging: {
      level: 'debug',
      persist: true,
      maxLogs: 10000
    }
  }
});

// 监控所有日志
console.log('日志历史:', orchestrator.logs);
\`\`\`

### 查看代理状态

\`\`\`typescript
// 获取所有代理
const agents = swarmManager.getAgents();

// 获取池状态
const poolStatus = swarmManager.getPoolStatus();
console.log('代理池状态:', poolStatus);
// { total: 5, idle: 2, busy: 3, maxAgents: 20 }

// 获取调度器状态
const schedulerStatus = swarmManager.getSchedulerStatus();
console.log('调度器状态:', schedulerStatus);
\`\`\`

---

## 🎨 UI 定制

### 自定义节点样式

\`\`\`tsx
// 修改 DAGVisualizer.tsx 中的 STATUS_STYLES
const STATUS_STYLES = {
  pending: {
    bg: 'bg-custom-pending',
    border: 'border-custom-pending',
    text: 'text-custom-pending',
    icon: <YourCustomIcon />
  }
  // ...
};
\`\`\`

### 自定义主题

\`\`\`tsx
<WorkflowControlPanel
  className="dark:bg-slate-900"
  // ...
/>
\`\`\`

---

## 📊 性能优化

### 1. 限制并发数

\`\`\`typescript
const config = {
  maxConcurrentTasks: 5 // 减少并发任务数
};
\`\`\`

### 2. 代理复用

\`\`\`typescript
// 优先复用现有代理，减少创建开销
const agent = findMatchingAgent(type, capabilities);
if (!agent) {
  agent = await createAgent(type);
}
\`\`\`

### 3. 任务批处理

\`\`\`typescript
// 将小任务合并为批次
const batchedTasks = groupSmallTasks(tasks);
\`\`\`

---

## 🔒 安全注意事项

1. **沙箱隔离**: 所有代码执行都在 Docker 容器中进行
2. **资源限制**: 每个沙箱都有内存和 CPU 限制
3. **网络隔离**: 可配置容器网络模式
4. **文件权限**: 严格的文件系统访问控制

---

## 📝 示例场景

### 场景 1: 创建全栈应用

\`\`\`typescript
const workflow = await orchestrator.generateWorkflow(
  \`创建一个全栈博客系统：
  - 用户认证（JWT）
  - 文章 CRUD
  - 评论系统
  - 响应式 UI（React + Tailwind）
  - RESTful API（Express + PostgreSQL）
  - 单元测试和 E2E 测试\`
);

await orchestrator.startExecution();
\`\`\`

### 场景 2: 代码重构

\`\`\`typescript
const workflow = await orchestrator.generateWorkflow(
  \`重构项目代码：
  - 提取重复代码为可复用组件
  - 优化性能（React.memo, useMemo）
  - 改进类型定义
  - 添加单元测试
  - 更新文档\`
);
\`\`\`

### 场景 3: Bug 修复

\`\`\`typescript
const workflow = await orchestrator.generateWorkflow(
  \`修复以下 bugs：
  1. 登录页面加载缓慢
  2. 评论提交失败（500 错误）
  3. 移动端布局错乱
  4. 内存泄漏问题\`
);
\`\`\`

---

## 🚀 未来规划

- [ ] 支持更多 AI 模型（GPT-4, Gemini）
- [ ] 可视化工作流编辑器
- [ ] 工作流模板库
- [ ] 代理学习和性能分析
- [ ] 远程代理集群
- [ ] 工作流版本管理

---

## 📞 支持

如有问题，请查阅：
- [完整开发指南](./Fangyu-Code-完整开发与升级指南.md)
- [API 文档](./docs/api.md)
- [常见问题](./docs/faq.md)

---

**版本:** v2.0.0
**最后更新:** 2025-12-28
**作者:** Fangyu Code Team
