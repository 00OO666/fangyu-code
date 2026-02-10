# Oh My OpenCode 项目深度原理分析

> 项目地址: https://github.com/code-yeongyu/oh-my-opencode
> 版本: 2.14.0
> 定位: OpenCode 的 "oh-my-zsh" —— 一个功能完备的 AI Agent 编排框架

---

## 一、项目概述

Oh My OpenCode 是一个为 [OpenCode](https://opencode.ai) 打造的插件系统，核心目标是实现**多模型 AI Agent 编排**。它将多个 LLM（Claude、GPT、Gemini、Grok）组织成一个协作团队，每个 Agent 负责特定领域的任务。

### 核心价值主张

1. **多模型编排**: 不同任务分配给最擅长的模型
2. **并行后台 Agent**: 异步执行任务，主 Agent 保持轻量上下文
3. **LSP/AST 工具集成**: 给 AI Agent 提供 IDE 级别的代码分析能力
4. **Claude Code 兼容层**: 无缝迁移现有 Claude Code 配置

---

## 二、技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Oh My OpenCode                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Agents    │  │    Hooks    │  │    Tools    │              │
│  │  (7 个AI)   │  │ (22+ 钩子)  │  │ (LSP/AST等) │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────┴────────────────┴────────────────┴──────┐              │
│  │              Plugin Core (index.ts)            │              │
│  │         - 生命周期管理                          │              │
│  │         - 事件分发                              │              │
│  │         - 配置加载                              │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                        │
│  ┌──────────────────────┴────────────────────────┐              │
│  │              Features Layer                    │              │
│  │  - Background Agent Manager                    │              │
│  │  - Skill MCP Manager                           │              │
│  │  - Context Injector                            │              │
│  │  - Claude Code Compatibility                   │              │
│  └───────────────────────────────────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                    OpenCode Plugin SDK                           │
│              (@opencode-ai/plugin, @opencode-ai/sdk)             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心依赖

```json
{
  "@opencode-ai/plugin": "^1.1.1",      // OpenCode 插件接口
  "@opencode-ai/sdk": "^1.1.1",         // OpenCode SDK
  "@ast-grep/napi": "^0.40.0",          // AST 模式匹配
  "@modelcontextprotocol/sdk": "^1.25.1", // MCP 协议支持
  "zod": "^4.1.8"                        // 运行时类型校验
}
```

---

## 三、核心技术实现

### 3.1 多 Agent 编排系统

#### Agent 角色分工

| Agent | 默认模型 | 职责 | 设计理念 |
|-------|---------|------|---------|
| **Sisyphus** | Claude Opus 4.5 | 主编排器，任务规划与分发 | 希腊神话中的西西弗斯，永不停歇地推石头 |
| **Oracle** | GPT 5.2 | 架构设计、代码审查、策略 | 高 IQ 逻辑推理 |
| **Librarian** | Claude Sonnet 4.5 | 文档查询、开源实现研究 | 深度代码理解 |
| **Explore** | Grok Code | 快速代码库探索 | 速度优先 |
| **Frontend UI/UX** | Gemini 3 Pro | UI 生成 | 创意设计能力 |
| **Document Writer** | Gemini 3 Flash | 技术文档撰写 | 文字表达能力 |
| **Multimodal Looker** | Gemini 3 Flash | PDF/图片分析 | 多模态理解 |

#### Agent 定义结构 (以 Oracle 为例)

```typescript
// src/agents/oracle.ts
export const oracleAgent = {
  name: "oracle",
  model: "openai/gpt-5.2",
  temperature: 0.1,  // 低温度保证确定性
  prompt: `You are Oracle, a senior architect and strategic advisor...`,
  tools: {
    read: true,
    grep: true,
    glob: true,
    // 限制写入权限，专注分析
    write: false,
    edit: false,
  },
  permission: {
    edit: "deny",
    bash: "ask",
  }
};
```

#### 底层原理: Agent 调用机制

```typescript
// src/tools/call-omo-agent/tool.ts
export const createCallOmoAgent = (ctx, backgroundManager) => ({
  name: "call_omo_agent",
  description: "Spawn specialized agents for specific tasks",
  parameters: z.object({
    agent_type: z.enum(["oracle", "librarian", "explore", ...]),
    prompt: z.string(),
    run_in_background: z.boolean().optional(),
  }),
  execute: async ({ agent_type, prompt, run_in_background }) => {
    if (run_in_background) {
      // 异步执行，不阻塞主 Agent
      return backgroundManager.spawn(agent_type, prompt);
    }
    // 同步执行，等待结果
    return ctx.client.session.prompt({
      body: { agent: agent_type, parts: [{ type: "text", text: prompt }] }
    });
  }
});
```

### 3.2 后台 Agent 管理器

这是实现**并行执行**的核心组件。

```typescript
// src/features/background-agent/manager.ts
export class BackgroundManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private concurrencyLimits: ConcurrencyConfig;

  async spawn(agentType: string, prompt: string): Promise<string> {
    const taskId = generateTaskId();
    
    // 检查并发限制
    await this.waitForSlot(agentType);
    
    // 创建后台任务
    const task = new BackgroundTask({
      id: taskId,
      agent: agentType,
      prompt,
      onComplete: (result) => this.notifyCompletion(taskId, result),
    });
    
    this.tasks.set(taskId, task);
    task.start();  // 非阻塞启动
    
    return taskId;
  }

  // 并发控制: 按模型/提供商限制
  private async waitForSlot(agentType: string): Promise<void> {
    const model = this.getModelForAgent(agentType);
    const limit = this.concurrencyLimits.modelConcurrency[model] 
                || this.concurrencyLimits.providerConcurrency[getProvider(model)]
                || this.concurrencyLimits.defaultConcurrency;
    
    while (this.getRunningCount(model) >= limit) {
      await sleep(100);
    }
  }
}
```

### 3.3 Hook 系统 (生命周期钩子)

Hook 是插件的神经系统，拦截和增强各种事件。

#### Hook 类型

| Hook 名称 | 触发时机 | 用途 |
|----------|---------|------|
| `tool.execute.before` | 工具执行前 | 参数校验、权限检查 |
| `tool.execute.after` | 工具执行后 | 结果处理、日志记录 |
| `chat.message` | 用户消息提交 | 关键词检测、上下文注入 |
| `event` | 系统事件 | 会话管理、错误恢复 |

#### 关键 Hook 实现

**1. Todo Continuation Enforcer (任务持续执行器)**

```typescript
// src/hooks/todo-continuation-enforcer.ts
export const createTodoContinuationEnforcer = (ctx, { backgroundManager }) => {
  let pendingTodos: string[] = [];
  
  return {
    handler: async (input) => {
      const { event } = input;
      
      // 当 Agent 停止时检查是否有未完成任务
      if (event.type === "session.idle") {
        const todos = await getTodosFromSession(input.sessionID);
        const incomplete = todos.filter(t => !t.completed);
        
        if (incomplete.length > 0) {
          // 强制继续执行
          await ctx.client.session.prompt({
            path: { id: input.sessionID },
            body: {
              parts: [{
                type: "text",
                text: `You have ${incomplete.length} incomplete TODOs. Continue working.`
              }]
            }
          });
        }
      }
    }
  };
};
```

**2. Context Window Monitor (上下文窗口监控)**

```typescript
// src/hooks/context-window-monitor.ts
export const createContextWindowMonitorHook = (ctx) => {
  return {
    event: async (input) => {
      const usage = await getContextUsage(input.sessionID);
      const percentage = usage.used / usage.total;
      
      // 70% 时提醒 Agent 还有空间
      if (percentage > 0.7 && percentage < 0.85) {
        await injectMessage(input.sessionID, 
          "Context window at 70%. You still have headroom - don't rush.");
      }
      
      // 85% 时触发预压缩
      if (percentage > 0.85) {
        await triggerCompaction(input.sessionID);
      }
    }
  };
};
```

**3. Keyword Detector (关键词检测器)**

```typescript
// src/hooks/keyword-detector/index.ts
const KEYWORDS = {
  ultrawork: { mode: "parallel", agents: ["oracle", "librarian", "explore"] },
  search: { mode: "search", agents: ["explore", "librarian"] },
  analyze: { mode: "deep", agents: ["oracle"] },
};

export const createKeywordDetectorHook = (ctx) => ({
  "chat.message": async (input, output) => {
    const text = extractText(output.parts);
    
    for (const [keyword, config] of Object.entries(KEYWORDS)) {
      if (text.toLowerCase().includes(keyword)) {
        // 注入模式指令
        output.parts.push({
          type: "text",
          text: `[ACTIVATED: ${config.mode} mode with ${config.agents.join(", ")}]`
        });
      }
    }
  }
});
```

### 3.4 LSP 工具集成

给 AI Agent 提供 IDE 级别的代码分析能力。

```typescript
// src/tools/lsp/tools.ts
export const lspTools = {
  lsp_hover: {
    description: "Get type info and documentation at position",
    parameters: z.object({
      file: z.string(),
      line: z.number(),
      character: z.number(),
    }),
    execute: async ({ file, line, character }) => {
      const client = await getLspClient(file);
      return client.textDocument.hover({
        textDocument: { uri: `file://${file}` },
        position: { line, character }
      });
    }
  },
  
  lsp_rename: {
    description: "Rename symbol across workspace",
    parameters: z.object({
      file: z.string(),
      line: z.number(),
      character: z.number(),
      newName: z.string(),
    }),
    execute: async ({ file, line, character, newName }) => {
      const client = await getLspClient(file);
      
      // 先验证重命名是否可行
      const prepareResult = await client.textDocument.prepareRename({
        textDocument: { uri: `file://${file}` },
        position: { line, character }
      });
      
      if (!prepareResult) {
        throw new Error("Cannot rename at this position");
      }
      
      // 执行重命名
      return client.textDocument.rename({
        textDocument: { uri: `file://${file}` },
        position: { line, character },
        newName
      });
    }
  },
  
  // ... 其他 11 个 LSP 工具
};
```

### 3.5 AST-Grep 集成

基于 AST 的代码搜索和替换，比正则更精确。

```typescript
// src/tools/ast-grep/tools.ts
import { parse, Lang } from "@ast-grep/napi";

export const astGrepTools = {
  ast_grep_search: {
    description: "AST-aware code pattern search (25 languages)",
    parameters: z.object({
      pattern: z.string(),
      path: z.string().optional(),
      lang: z.enum(["typescript", "javascript", "python", ...]),
    }),
    execute: async ({ pattern, path, lang }) => {
      const files = await globFiles(path || ".", `**/*.${getExtension(lang)}`);
      const results = [];
      
      for (const file of files) {
        const code = await readFile(file);
        const root = parse(lang, code);
        const matches = root.findAll(pattern);
        
        results.push(...matches.map(m => ({
          file,
          line: m.range().start.line,
          text: m.text(),
          context: getContext(code, m.range()),
        })));
      }
      
      return results;
    }
  },
  
  ast_grep_replace: {
    description: "AST-aware code replacement",
    parameters: z.object({
      pattern: z.string(),
      replacement: z.string(),
      path: z.string(),
      lang: z.string(),
    }),
    execute: async ({ pattern, replacement, path, lang }) => {
      // 使用 AST 确保替换的语法正确性
      const code = await readFile(path);
      const root = parse(lang, code);
      const newCode = root.replace(pattern, replacement);
      
      await writeFile(path, newCode);
      return { success: true, changes: root.findAll(pattern).length };
    }
  }
};
```

### 3.6 MCP (Model Context Protocol) 集成

内置 MCP 服务器提供扩展能力。

```typescript
// src/mcp/index.ts
export const builtinMcps = {
  // Web 搜索
  websearch: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-exa"],
    env: { EXA_API_KEY: "${EXA_API_KEY}" }
  },
  
  // 官方文档查询
  context7: {
    command: "npx", 
    args: ["-y", "@anthropic-ai/mcp-context7"]
  },
  
  // GitHub 代码搜索
  grep_app: {
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-grep-app"]
  }
};
```

### 3.7 Claude Code 兼容层

无缝迁移现有 Claude Code 配置。

```typescript
// src/features/claude-code-hooks-loader/index.ts
export const loadClaudeCodeHooks = async () => {
  const locations = [
    "~/.claude/settings.json",
    "./.claude/settings.json",
    "./.claude/settings.local.json"
  ];
  
  const hooks = { PreToolUse: [], PostToolUse: [], UserPromptSubmit: [], Stop: [] };
  
  for (const loc of locations) {
    const settings = await readJsonSafe(loc);
    if (settings?.hooks) {
      for (const [event, handlers] of Object.entries(settings.hooks)) {
        hooks[event].push(...handlers);
      }
    }
  }
  
  return hooks;
};

// 执行 Claude Code 风格的 Hook
export const executeClaudeCodeHook = async (event, context) => {
  const hooks = await loadClaudeCodeHooks();
  const handlers = hooks[event] || [];
  
  for (const handler of handlers) {
    if (handler.matcher && !new RegExp(handler.matcher).test(context.tool)) {
      continue;
    }
    
    if (handler.type === "command") {
      const cmd = handler.command.replace("$FILE", context.file);
      await exec(cmd);
    }
  }
};
```

---

## 四、关键设计模式

### 4.1 工厂模式 (Factory Pattern)

所有 Hook 和 Tool 都通过工厂函数创建，便于依赖注入。

```typescript
// 命名约定: createXXXHook, createXXXTool
export const createSessionRecoveryHook = (ctx, options) => {
  // 闭包保存状态
  let recoveryAttempts = 0;
  
  return {
    isRecoverableError: (error) => { ... },
    handleSessionRecovery: async (messageInfo) => { ... },
    setOnAbortCallback: (cb) => { ... },
  };
};
```

### 4.2 Barrel 导出模式

每个模块目录都有 `index.ts` 统一导出。

```typescript
// src/hooks/index.ts
export { createTodoContinuationEnforcer } from "./todo-continuation-enforcer";
export { createContextWindowMonitorHook } from "./context-window-monitor";
export { createSessionRecoveryHook } from "./session-recovery";
// ... 22+ hooks
```

### 4.3 配置驱动设计

通过 Zod Schema 定义配置，支持 JSONC (带注释的 JSON)。

```typescript
// src/config/schema.ts
export const OhMyOpenCodeConfigSchema = z.object({
  google_auth: z.boolean().optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_agents: z.array(z.string()).optional(),
  agents: z.record(AgentOverrideSchema).optional(),
  experimental: ExperimentalConfigSchema.optional(),
  // ...
});
```

---

## 五、工作流程示例

### 5.1 用户输入 "ultrawork 重构这个模块"

```
1. chat.message Hook 触发
   └─> Keyword Detector 检测到 "ultrawork"
       └─> 注入并行模式指令

2. Sisyphus (主 Agent) 接收任务
   └─> 分析任务，创建 TODO 列表
   └─> 调用 call_omo_agent 分发任务:
       ├─> Oracle (后台): 分析架构
       ├─> Explore (后台): 搜索相关代码
       └─> Librarian (后台): 查找最佳实践

3. 后台任务完成
   └─> Background Notification Hook 通知 Sisyphus
   └─> Sisyphus 整合结果，开始重构

4. 重构过程中
   └─> LSP 工具: 安全重命名符号
   └─> AST-Grep: 批量替换模式
   └─> Comment Checker: 清理多余注释

5. 任务完成检查
   └─> Todo Continuation Enforcer 检查 TODO 列表
   └─> 如有未完成项，强制继续
```

### 5.2 上下文窗口管理流程

```
Context Usage: 0% ──────────────────────────────────────> 100%
                   │         │              │           │
                   │         │              │           └─ Hard Limit
                   │         │              └─ 85%: Preemptive Compaction
                   │         └─ 70%: "Don't rush" 提醒
                   └─ 正常工作区
```

---

## 六、性能优化策略

### 6.1 并发控制

```typescript
// 按模型/提供商限制并发
{
  "background_task": {
    "defaultConcurrency": 5,
    "providerConcurrency": {
      "anthropic": 3,  // Claude 限制更严格
      "google": 10     // Gemini 可以更多
    },
    "modelConcurrency": {
      "anthropic/claude-opus-4-5": 2  // 昂贵模型限制更严
    }
  }
}
```

### 6.2 输出截断

```typescript
// 防止单个工具输出占满上下文
const truncateOutput = (output, remainingTokens) => {
  const maxTokens = Math.min(remainingTokens * 0.5, 50000);
  if (estimateTokens(output) > maxTokens) {
    return truncateToTokens(output, maxTokens) + "\n[TRUNCATED]";
  }
  return output;
};
```

### 6.3 上下文注入优化

```typescript
// 只注入一次 AGENTS.md，避免重复
const injectedPaths = new Set();

const injectAgentsMd = (filePath) => {
  const agentsMdPath = findAgentsMd(filePath);
  if (agentsMdPath && !injectedPaths.has(agentsMdPath)) {
    injectedPaths.add(agentsMdPath);
    return readFile(agentsMdPath);
  }
  return null;
};
```

---

## 七、扩展机制

### 7.1 自定义 Agent

```json
// ~/.claude/agents/my-agent.md
---
name: my-custom-agent
model: anthropic/claude-sonnet-4
temperature: 0.2
tools:
  read: true
  write: true
---

You are a specialized agent for...
```

### 7.2 自定义 Skill (带 MCP)

```yaml
# ~/.claude/skills/playwright/SKILL.md
---
description: Browser automation skill
mcp:
  playwright:
    command: npx
    args: ["-y", "@anthropic-ai/mcp-playwright"]
---

Use this skill for web scraping and browser automation...
```

### 7.3 自定义 Hook (通过 Claude Code settings.json)

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{ "type": "command", "command": "eslint --fix $FILE" }]
    }]
  }
}
```

---

## 八、总结

Oh My OpenCode 的核心创新在于:

1. **多模型编排**: 不是简单的模型切换，而是让不同模型扮演不同角色，协同工作
2. **后台并行执行**: 主 Agent 保持轻量，耗时任务异步执行
3. **IDE 级工具**: LSP/AST 工具让 AI 能进行精确的代码操作
4. **自愈机制**: 会话恢复、上下文压缩、任务持续执行
5. **兼容性**: 无缝迁移 Claude Code 配置

这个项目展示了如何将多个 LLM 组织成一个高效的"AI 开发团队"，而不是简单地使用单一模型。

---

*分析完成于 2026-01-08*
*基于 oh-my-opencode v2.14.0*
