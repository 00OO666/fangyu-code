# 🚀 多代理系统快速开始指南

## 🎯 5分钟快速体验

### 步骤 1: 安装依赖

\`\`\`bash
cd F:\Any-Code-Dev
npm install reactflow dagre uuid framer-motion
npm install -D @types/dagre @types/uuid
\`\`\`

### 步骤 2: 添加到侧边栏

编辑 `src/components/layout/Sidebar.tsx`:

\`\`\`tsx
// 在 mainNavItems 数组中添加
const mainNavItems: NavItem[] = [
  // ... 现有项目
  {
    view: 'multi-agent-workflow',
    icon: Workflow,  // 需要从 lucide-react 导入
    label: '多代理工作流'
  },
];
\`\`\`

### 步骤 3: 添加路由

编辑 `src/App.tsx` 或主路由文件:

\`\`\`tsx
import { WorkflowControlPanel } from '@/components/workflow';

// 在 View 类型定义中添加
type View =
  | 'projects'
  | 'claude-code-session'
  // ... 其他视图
  | 'multi-agent-workflow';  // 新增

// 在渲染逻辑中添加
function renderView() {
  switch (currentView) {
    // ... 其他 case
    case 'multi-agent-workflow':
      return <WorkflowControlPanel />;
    default:
      return <ProjectsView />;
  }
}
\`\`\`

### 步骤 4: 配置 API 密钥

在 localStorage 中设置（或通过设置界面）:

\`\`\`javascript
localStorage.setItem('claude_api_key', 'sk-your-api-key');
// 可选：自定义 base URL
localStorage.setItem('claude_api_base_url', 'https://hongmacode.com/api');
\`\`\`

### 步骤 5: 启动并测试

\`\`\`bash
npm run dev
\`\`\`

1. 点击侧边栏的 "多代理工作流"
2. 在输入框输入任务描述，例如：
   ```
   创建一个待办事项应用，包含：
   - React 前端（使用 Tailwind CSS）
   - Express 后端 API
   - SQLite 数据库
   - 完整的 CRUD 功能
   ```
3. 选择思考深度为 "极致"
4. 点击 "生成工作流"
5. 查看自动生成的 DAG 图
6. 点击 "开始执行" 观看代理协同工作！

---

## 🎨 快速定制

### 修改代理数量

\`\`\`tsx
<WorkflowControlPanel
  config={{
    maxAgents: 10,  // 默认 20
    maxConcurrentTasks: 5  // 默认 10
  }}
/>
\`\`\`

### 自定义项目路径

\`\`\`tsx
<WorkflowControlPanel
  projectPath="/path/to/your/project"
/>
\`\`\`

### 监听事件

\`\`\`tsx
import { useWorkflowOrchestrator } from '@/hooks/agents/useWorkflowOrchestrator';

function MyComponent() {
  const orchestrator = useWorkflowOrchestrator({
    onWorkflowCompleted: (workflow) => {
      alert('工作流完成！');
      console.log('完成的任务:', workflow.tasks);
    },
    onWorkflowFailed: (error) => {
      alert('执行失败: ' + error.message);
    }
  });

  return <div>...</div>;
}
\`\`\`

---

## 🧪 测试示例

### 简单任务

\`\`\`
创建一个 React 组件：按钮点击计数器
\`\`\`

预期结果：生成 2-3 个任务，1-2 个代理

### 中等任务

\`\`\`
创建一个天气查询应用：
- 前端输入框和展示
- 调用 OpenWeatherMap API
- 显示5天预报
- 响应式设计
\`\`\`

预期结果：生成 5-8 个任务，3-4 个代理，2-3 个并行组

### 复杂任务

\`\`\`
创建一个完整的电商系统：
- 用户认证和授权
- 商品列表和搜索
- 购物车
- 订单管理
- 支付集成
- 管理后台
- 移动端适配
- 单元测试和E2E测试
\`\`\`

预期结果：生成 15-25 个任务，8-12 个代理，5-8 个并行组

---

## 🔧 故障排除

### 问题 1: API 密钥未设置

**错误信息:** "TaskPlanner not initialized" 或 API 401 错误

**解决方案:**
\`\`\`javascript
localStorage.setItem('claude_api_key', 'your-api-key');
\`\`\`

### 问题 2: Docker 未运行

**错误信息:** "Docker not available"

**解决方案:**
- 当前版本会自动切换到模拟模式
- 完整功能需要安装并启动 Docker Desktop

### 问题 3: 依赖未安装

**错误信息:** "Module not found: reactflow" 等

**解决方案:**
\`\`\`bash
npm install reactflow dagre uuid framer-motion
\`\`\`

### 问题 4: 工作流生成缓慢

**原因:** ultrathink 模式需要更多计算时间（10-30秒）

**解决方案:**
- 选择较低的思考深度（"标准"或"深度"）
- 或等待 ultrathink 完成以获得更好的结果

---

## 📚 下一步

完成快速开始后，查阅：

1. [完整文档](./MULTI_AGENT_SYSTEM_README.md) - 深入了解所有功能
2. [API 参考](./docs/api-reference.md) - 详细的 API 文档
3. [最佳实践](./docs/best-practices.md) - 使用建议和优化技巧
4. [示例集合](./examples/multi-agent/) - 更多实际案例

---

## 💡 提示

- **思考深度:** ultrathink 适合复杂任务，标准模式适合简单任务
- **并行度:** 工作流会自动识别可并行的任务，无需手动配置
- **代理复用:** 系统会智能复用现有代理，减少创建开销
- **实时监控:** 点击 DAG 图中的节点可查看详细信息
- **日志查看:** 底部日志面板显示所有执行细节

---

**开始探索多代理编程的强大能力吧！** 🚀

如有任何问题，欢迎查阅完整文档或提交 issue。
