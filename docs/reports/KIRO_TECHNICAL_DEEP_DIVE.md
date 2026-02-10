# Kiro 技术深度解析

> 全面剖析 Kiro IDE 的核心设计理念与技术实现方案

## 目录

1. [架构概览](#1-架构概览)
2. [工具系统设计](#2-工具系统设计)
3. [文件操作系统](#3-文件操作系统)
4. [智能上下文管理](#4-智能上下文管理)
5. [Steering 系统](#5-steering-系统)
6. [Specs 规范系统](#6-specs-规范系统)
7. [Hooks 自动化系统](#7-hooks-自动化系统)
8. [Powers 扩展系统](#8-powers-扩展系统)
9. [MCP 协议集成](#9-mcp-协议集成)
10. [Sub-Agent 子代理系统](#10-sub-agent-子代理系统)
11. [进程管理系统](#11-进程管理系统)
12. [诊断系统](#12-诊断系统)
13. [Web 能力](#13-web-能力)
14. [自治模式设计](#14-自治模式设计)
15. [安全机制](#15-安全机制)

---

## 1. 架构概览

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Kiro IDE 前端                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Chat UI    │  │  Editor     │  │  File Explorer      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kiro Agent Runtime                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Tool Router │  │ Context Mgr │  │  Execution Engine   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Claude API     │ │  MCP Servers    │ │  Local Tools    │
│  (Opus 4.5)     │ │  (扩展能力)      │ │  (文件/进程)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 1.2 核心设计理念

| 理念 | 描述 |
|------|------|
| **最小化上下文** | 按需加载，避免 token 浪费 |
| **工具优先** | 通过工具扩展能力，而非硬编码 |
| **结构化工作流** | Specs + Steering 引导开发流程 |
| **安全第一** | 多层安全机制保护用户代码 |
| **可扩展性** | Powers + MCP 实现无限扩展 |

---

## 2. 工具系统设计

### 2.1 工具调用机制

Kiro 使用 Claude 的 Function Calling 能力，通过 JSON Schema 定义工具接口：

```typescript
// 工具定义示例
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

// 工具调用格式
<function_calls>
<invoke name="toolName">
<parameter name="param1">value1

```

### 2.2 并行工具调用

Kiro 支持在单次响应中发起多个独立的工具调用：

```xml
<!-- 并行调用示例 -->
<function_calls>
  <invoke name="readFile"><parameter name="path">file1.ts</parameter></invoke>
  <invoke name="readFile"><parameter name="path">file2.ts</parameter></invoke>
  <invoke name="grepSearch"><parameter name="query">TODO</parameter></invoke>
</function_calls>
```

**执行引擎处理流程：**

```
1. 解析所有工具调用
2. 构建依赖图（检测参数依赖）
3. 无依赖的调用并行执行
4. 有依赖的调用按序执行
5. 收集所有结果返回模型
```

### 2.3 工具分类

| 类别 | 工具 | 用途 |
|------|------|------|
| **文件操作** | `readFile`, `readMultipleFiles`, `fsWrite`, `fsAppend`, `strReplace`, `deleteFile` | 文件读写修改 |
| **搜索发现** | `fileSearch`, `grepSearch`, `listDirectory` | 代码搜索定位 |
| **进程管理** | `executePwsh`, `controlPwshProcess`, `listProcesses`, `getProcessOutput` | 命令执行 |
| **诊断分析** | `getDiagnostics` | 代码问题检测 |
| **Web 能力** | `remote_web_search`, `webFetch`, `mcp_fetch_fetch` | 网络请求 |
| **浏览器** | `mcp_puppeteer_*` | 浏览器自动化 |
| **扩展系统** | `kiroPowers` | Powers 管理 |
| **子代理** | `invokeSubAgent` | 任务委派 |

---

## 3. 文件操作系统

### 3.1 多文件批量读取

**核心优势：** 减少 API 往返，节省 token 开销

```typescript
// readMultipleFiles 实现原理
async function readMultipleFiles(paths: string[]): Promise<FileContent[]> {
  // 并行读取所有文件
  const results = await Promise.all(
    paths.map(path => fs.readFile(path, 'utf-8'))
  );
  
  // 合并返回，减少 token 开销
  return results.map((content, i) => ({
    path: paths[i],
    content: content
  }));
}
```

### 3.2 智能文件写入

**fsWrite + fsAppend 组合策略：**

```
大文件写入流程：
1. fsWrite 写入前 50 行（创建文件）
2. fsAppend 追加剩余内容（分批）
3. 自动处理换行符

优势：
- 避免单次写入过大内容
- 提高写入成功率
- 支持流式生成
```

### 3.3 精确字符串替换 (strReplace)

**设计亮点：** 避免重写整个文件，只修改必要部分

```typescript
// strReplace 核心逻辑
function strReplace(path: string, oldStr: string, newStr: string) {
  const content = fs.readFileSync(path, 'utf-8');
  
  // 精确匹配检查
  const matches = content.split(oldStr).length - 1;
  if (matches === 0) throw new Error('未找到匹配内容');
  if (matches > 1) throw new Error('匹配到多处，请提供更多上下文');
  
  // 执行替换
  const newContent = content.replace(oldStr, newStr);
  fs.writeFileSync(path, newContent);
}
```

**使用规范：**
- `oldStr` 必须精确匹配（包括空格、缩进）
- 建议包含 2-3 行上下文确保唯一性
- 支持并行调用多个 strReplace

---

## 4. 智能上下文管理

### 4.1 上下文来源

```
┌─────────────────────────────────────────────────────────┐
│                    Kiro 上下文组成                       │
├─────────────────────────────────────────────────────────┤
│  1. 系统提示词 (System Prompt)                          │
│     - 身份定义、能力说明、规则约束                        │
│                                                         │
│  2. Steering 规则 (自动/手动加载)                        │
│     - 全局规则、项目规则、条件规则                        │
│                                                         │
│  3. 环境上下文 (EnvironmentContext)                     │
│     - 当前打开的文件、活动编辑器                          │
│     - 文件树结构                                         │
│                                                         │
│  4. 对话历史 (Conversation History)                     │
│     - 用户消息、助手回复、工具调用结果                    │
│                                                         │
│  5. 工具定义 (Tool Definitions)                         │
│     - 所有可用工具的 JSON Schema                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 上下文优化策略

```typescript
// 上下文优化器伪代码
class ContextOptimizer {
  // 1. 文件内容智能裁剪
  truncateFileContent(content: string, maxLines: number): string {
    if (content.split('\n').length <= maxLines) return content;
    return content.split('\n').slice(0, maxLines).join('\n') + '\n[truncated...]';
  }
  
  // 2. 搜索结果限制
  limitSearchResults(results: SearchResult[], max: number = 50): SearchResult[] {
    return results.slice(0, max);
  }
  
  // 3. 长行截断
  truncateLongLines(content: string, maxLength: number = 500): string {
    return content.split('\n').map(line => 
      line.length > maxLength ? line.slice(0, maxLength) + '[truncated]' : line
    ).join('\n');
  }
}
```

### 4.3 #引用系统

用户可以通过 `#` 符号主动添加上下文：

| 引用类型 | 语法 | 说明 |
|----------|------|------|
| 文件 | `#File` | 引用特定文件 |
| 文件夹 | `#Folder` | 引用整个目录 |
| 问题 | `#Problems` | 当前文件的诊断问题 |
| 终端 | `#Terminal` | 终端输出内容 |
| Git Diff | `#Git Diff` | 当前 Git 变更 |
| 代码库 | `#Codebase` | 全代码库索引搜索 |

---

## 5. Steering 系统

### 5.1 设计理念

Steering 是 Kiro 的"指导规则"系统，类似于 Claude Code 的 CLAUDE.md，但更加结构化。

```
.kiro/steering/
├── global-rules.md      # 全局规则（always）
├── skills-index.md      # 技能索引（always）
├── fangyu-code.md       # 项目规则（fileMatch）
└── skills-*.md          # 各种技能（manual）
```

### 5.2 加载模式

```yaml
# 1. Always 模式 - 始终加载
---
inclusion: always
---

# 2. FileMatch 模式 - 文件匹配时加载
---
inclusion: fileMatch
fileMatchPattern: "src/**/*.tsx"
---

# 3. Manual 模式 - 手动引用加载
---
inclusion: manual
---
# 使用 #steering-name 引用
```

### 5.3 文件引用语法

Steering 文件支持引用其他文件：

```markdown
# 在 Steering 中引用外部文件
参考 API 规范：#[[file:docs/api-spec.yaml]]
参考 GraphQL Schema：#[[file:schema.graphql]]
```

---

## 6. Specs 规范系统

### 6.1 Specs 是什么？

Specs 是 Kiro 的"结构化开发流程"系统，将复杂功能开发分解为：

```
需求 (Requirements) → 设计 (Design) → 任务 (Tasks)
```

### 6.2 目录结构

```
.kiro/specs/
└── feature-name/
    ├── requirements.md   # 需求文档
    ├── design.md         # 技术设计
    └── tasks.md          # 实现任务清单
```

### 6.3 工作流程

```
┌─────────────────────────────────────────────────────────┐
│                    Specs 工作流程                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 需求阶段 (requirements.md)                          │
│     - 用户故事                                          │
│     - 功能需求                                          │
│     - 非功能需求                                        │
│     - 验收标准                                          │
│                                                         │
│  2. 设计阶段 (design.md)                                │
│     - 技术方案                                          │
│     - 架构设计                                          │
│     - 接口定义                                          │
│     - 数据模型                                          │
│                                                         │
│  3. 任务阶段 (tasks.md)                                 │
│     - [ ] 任务 1: 创建基础组件                          │
│     - [ ] 任务 2: 实现核心逻辑                          │
│     - [ ] 任务 3: 添加测试                              │
│     - [ ] 任务 4: 文档更新                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.4 优势

- **增量开发**：复杂功能分步实现，可控可追踪
- **文档驱动**：设计先行，减少返工
- **协作友好**：清晰的任务分工
- **可恢复性**：中断后可从任务清单继续

---

## 7. Hooks 自动化系统

### 7.1 Hooks 概念

Hooks 是 Kiro 的"事件驱动自动化"系统，当特定事件发生时自动触发 Agent 执行。

### 7.2 触发事件类型

| 事件类型 | 触发时机 | 示例用途 |
|----------|----------|----------|
| `onMessage` | 发送消息时 | 添加额外指令 |
| `onComplete` | Agent 执行完成 | 自动验证结果 |
| `onSessionCreate` | 新会话创建 | 初始化上下文 |
| `onFileSave` | 保存文件时 | 自动运行测试 |
| `manual` | 手动点击按钮 | 代码检查、部署 |

### 7.3 Hook 配置示例

```json
// .kiro/hooks/auto-test.json
{
  "name": "Auto Test on Save",
  "trigger": {
    "type": "onFileSave",
    "pattern": "src/**/*.ts"
  },
  "action": {
    "type": "sendMessage",
    "message": "文件已保存，请运行相关测试并报告结果"
  }
}
```

### 7.4 应用场景

```
┌─────────────────────────────────────────────────────────┐
│                    Hooks 应用场景                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📝 代码保存时                                           │
│     → 自动运行测试                                       │
│     → 自动格式化代码                                     │
│     → 更新相关文档                                       │
│                                                         │
│  🌍 翻译文件更新时                                       │
│     → 同步更新其他语言                                   │
│                                                         │
│  🔘 手动触发                                             │
│     → 代码审查                                           │
│     → 安全扫描                                           │
│     → 一键部署                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Powers 扩展系统

### 8.1 Powers 是什么？

Powers 是 Kiro 的"能力包"系统，打包了：
- 文档 (POWER.md)
- 工作流指南 (Steering Files)
- MCP 服务器 (可选)

### 8.2 设计理念

```
传统方式：加载所有工具定义 → Token 浪费严重
Powers 方式：按需激活 → 最小化上下文
```

### 8.3 Powers 操作流程

```typescript
// 1. 列出已安装的 Powers
kiroPowers({ action: "list" })

// 2. 激活 Power（获取文档和工具定义）
kiroPowers({ action: "activate", powerName: "weather-power" })
// 返回：overview, toolsByServer, steeringFiles

// 3. 使用 Power 的工具
kiroPowers({
  action: "use",
  powerName: "weather-power",
  serverName: "weather-api",
  toolName: "get_forecast",
  arguments: { location: "Seattle" }
})

// 4. 读取工作流指南
kiroPowers({
  action: "readSteering",
  powerName: "weather-power",
  steeringFile: "getting-started.md"
})
```

### 8.4 Powers vs 直接 MCP

| 特性 | 直接 MCP | Powers |
|------|----------|--------|
| 工具定义加载 | 始终加载 | 按需激活 |
| Token 消耗 | 高 | 低 |
| 文档支持 | 无 | 内置 POWER.md |
| 工作流指南 | 无 | Steering Files |
| 管理界面 | 无 | 可视化面板 |

---

## 9. MCP 协议集成

### 9.1 MCP 是什么？

Model Context Protocol (MCP) 是一个标准化的协议，允许 AI 模型与外部工具/服务通信。

### 9.2 配置层级

```
优先级（从低到高）：
1. 用户级配置：~/.kiro/settings/mcp.json
2. 工作区配置：.kiro/settings/mcp.json
3. 多工作区：后面的覆盖前面的
```

### 9.3 配置示例

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-fetch"],
      "env": {},
      "disabled": false,
      "autoApprove": ["fetch"]
    },
    "github": {
      "command": "uvx",
      "args": ["mcp-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-puppeteer"]
    }
  }
}
```

### 9.4 常用 MCP 服务器

| 服务器 | 用途 | 命令 |
|--------|------|------|
| fetch | HTTP 请求 | `uvx mcp-fetch` |
| github | GitHub 操作 | `uvx mcp-github` |
| puppeteer | 浏览器自动化 | `npx @anthropic/mcp-puppeteer` |
| context7 | 技术文档查询 | `uvx context7-mcp` |
| filesystem | 文件系统扩展 | `uvx mcp-filesystem` |

---

## 10. Sub-Agent 子代理系统

### 10.1 设计理念

将复杂任务委派给专门的子代理，实现：
- 任务隔离
- 并行处理
- 专业化分工

### 10.2 可用子代理

| 子代理 | 用途 | 适用场景 |
|--------|------|----------|
| `context-gatherer` | 代码库探索 | 不熟悉的代码库、Bug 调查、理解组件交互 |
| `general-task-execution` | 通用任务执行 | 独立子任务、并行工作流 |

### 10.3 使用示例

```typescript
// 使用 context-gatherer 探索代码库
invokeSubAgent({
  name: "context-gatherer",
  prompt: "分析登录功能的实现，找出所有相关文件",
  explanation: "需要理解认证流程后再修改"
})

// 使用 general-task-execution 执行子任务
invokeSubAgent({
  name: "general-task-execution",
  prompt: "为 UserService 类编写单元测试",
  explanation: "并行处理测试编写任务"
})
```

### 10.4 最佳实践

```
✅ 推荐使用场景：
- 开始处理不熟悉的代码库
- 调查跨多个文件的 Bug
- 需要理解组件交互关系
- 并行处理独立任务

❌ 不推荐使用场景：
- 简单的单文件修改
- 已经知道要修改哪些文件
- 任务依赖性强，无法并行
```

---

## 11. 进程管理系统

### 11.1 命令执行 (executePwsh)

```typescript
// 执行 Shell 命令
executePwsh({
  command: "npm install",
  path: "src/project",      // 工作目录
  timeout: 30000,           // 超时时间
  ignoreWarning: false      // 是否忽略长时间运行警告
})
```

### 11.2 后台进程管理 (controlPwshProcess)

```typescript
// 启动后台进程（如开发服务器）
controlPwshProcess({
  action: "start",
  command: "npm run dev",
  path: "src/project"
})
// 返回：{ processId: 123, isReused: false }

// 停止后台进程
controlPwshProcess({
  action: "stop",
  processId: 123
})
```

### 11.3 进程监控

```typescript
// 列出所有后台进程
listProcesses()
// 返回：[{ processId, command, path, status }]

// 获取进程输出
getProcessOutput({
  processId: 123,
  lines: 50  // 最近 50 行
})
```

### 11.4 长时间运行命令处理

```
⚠️ 禁止直接执行的命令：
- npm run dev
- yarn start
- webpack --watch
- jest --watch

✅ 正确做法：
1. 使用 controlPwshProcess 启动后台进程
2. 使用 getProcessOutput 监控输出
3. 使用 controlPwshProcess stop 停止
```

---

## 12. 诊断系统

### 12.1 getDiagnostics 工具

```typescript
// 获取文件的编译/类型/lint 错误
getDiagnostics({
  paths: ["src/App.tsx", "src/utils/helpers.ts"]
})
```

### 12.2 诊断类型

| 类型 | 来源 | 示例 |
|------|------|------|
| 语法错误 | 编译器 | 缺少分号、括号不匹配 |
| 类型错误 | TypeScript | 类型不兼容 |
| Lint 警告 | ESLint/Biome | 未使用变量 |
| 语义错误 | 语言服务 | 未定义的引用 |

### 12.3 使用场景

```
1. 修改代码后验证
   → 确保没有引入新错误

2. 用户报告问题时
   → 查看用户看到的相同错误

3. 代码审查
   → 批量检查多个文件
```

---

## 13. Web 能力

### 13.1 Web 搜索 (remote_web_search)

```typescript
remote_web_search({
  query: "React 19 new features"
})
// 返回：title, url, snippet, publishedDate, domain
```

### 13.2 网页抓取 (webFetch)

```typescript
webFetch({
  url: "https://docs.example.com/api",
  mode: "truncated",  // truncated | full | selective
  searchPhrase: "authentication"  // selective 模式需要
})
```

### 13.3 MCP Fetch (更可靠)

```typescript
mcp_fetch_fetch({
  url: "https://api.example.com/docs",
  max_length: 5000,
  raw: false  // true 返回原始 HTML
})
```

### 13.4 Puppeteer 浏览器自动化

```typescript
// 导航到页面
mcp_puppeteer_puppeteer_navigate({ url: "https://example.com" })

// 截图
mcp_puppeteer_puppeteer_screenshot({ name: "homepage", width: 1200 })

// 点击元素
mcp_puppeteer_puppeteer_click({ selector: "#login-button" })

// 填写表单
mcp_puppeteer_puppeteer_fill({ selector: "#email", value: "test@example.com" })

// 执行 JavaScript
mcp_puppeteer_puppeteer_evaluate({ script: "document.title" })
```

---

## 14. 自治模式设计

### 14.1 两种模式

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| **Autopilot** | 自动执行所有操作 | 信任度高、批量任务 |
| **Supervised** | 每步操作需确认 | 敏感操作、学习阶段 |

### 14.2 Autopilot 模式特性

```
✅ 自动执行：
- 文件读写
- 代码修改
- 命令执行
- 工具调用

⚠️ 仍需确认：
- 危险命令（rm -rf 等）
- 敏感文件修改
- 外部 API 调用（取决于配置）
```

### 14.3 Supervised 模式特性

```
每次操作后：
1. 显示即将执行的操作
2. 等待用户确认
3. 提供撤销选项
4. 记录操作历史
```

---

## 15. 安全机制

### 15.1 多层安全防护

```
┌─────────────────────────────────────────────────────────┐
│                    安全防护层级                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 1: 输入验证                                      │
│  - 路径遍历检查                                         │
│  - 命令注入防护                                         │
│  - 参数类型验证                                         │
│                                                         │
│  Layer 2: 权限控制                                      │
│  - 工作区边界限制                                       │
│  - 敏感文件保护                                         │
│  - 系统目录隔离                                         │
│                                                         │
│  Layer 3: 操作审计                                      │
│  - 所有操作记录                                         │
│  - 可追溯性                                             │
│  - 撤销支持                                             │
│                                                         │
│  Layer 4: 内容过滤                                      │
│  - PII 脱敏                                             │
│  - 恶意代码检测                                         │
│  - 敏感信息屏蔽                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 15.2 路径安全

```typescript
// 路径验证逻辑
function validatePath(path: string): boolean {
  // 1. 禁止绝对路径（除非明确允许）
  if (path.startsWith('/') || path.match(/^[A-Z]:\\/)) {
    return false;
  }
  
  // 2. 禁止路径遍历
  if (path.includes('..')) {
    return false;
  }
  
  // 3. 检查是否在工作区内
  const resolved = path.resolve(workspaceRoot, path);
  return resolved.startsWith(workspaceRoot);
}
```

### 15.3 命令安全

```
⚠️ 危险命令检测：
- rm -rf /
- del /s /q C:\
- format
- mkfs
- dd if=/dev/zero

🛡️ 防护措施：
- 命令白名单
- 参数检查
- 确认提示
- 沙箱执行（可选）
```

### 15.4 敏感信息处理

```
自动脱敏的信息类型：
- API Keys
- 密码
- 私钥
- 个人身份信息 (PII)
- 数据库连接字符串

处理方式：
- 代码示例中替换为占位符
- 日志中屏蔽
- 不发送到外部服务
```

---

## 总结

Kiro 的核心设计亮点：

1. **工具系统** - 并行调用、批量操作、精确替换
2. **上下文管理** - 按需加载、智能裁剪、#引用系统
3. **Steering** - 结构化规则、多种加载模式、文件引用
4. **Specs** - 需求→设计→任务的结构化开发流程
5. **Hooks** - 事件驱动自动化
6. **Powers** - 最小化上下文的能力扩展
7. **MCP** - 标准化的外部工具集成
8. **Sub-Agent** - 任务委派与并行处理
9. **进程管理** - 后台进程、输出监控
10. **安全机制** - 多层防护、路径验证、敏感信息处理

这些设计共同构成了一个高效、安全、可扩展的 AI 编程助手平台。
