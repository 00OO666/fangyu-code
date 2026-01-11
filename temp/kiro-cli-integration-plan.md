# Kiro CLI 集成到 Fangyu Code 计划

> 日期: 2026-01-11
> 状态: ✅ 后端完成，前端基础完成
> 目标: 将 Kiro CLI 作为第五引擎集成到 Fangyu Code

---

## ✅ 已完成

### Rust 后端
1. ✅ `src-tauri/src/commands/kiro/mod.rs` - Kiro 模块入口
2. ✅ `src-tauri/src/commands/kiro/cli_runner.rs` - Kiro CLI 执行器
3. ✅ `src-tauri/src/commands/mod.rs` - 注册 kiro 模块
4. ✅ `src-tauri/src/main.rs` - 注册 Kiro 命令和状态

### 前端
1. ✅ `src/lib/kiroApi.ts` - Kiro API 调用接口
2. ✅ `src/components/settings/KiroConfigPanel.tsx` - Kiro 配置面板

### 已实现的命令
| 命令 | 功能 |
|------|------|
| `check_kiro_cli_installed` | 检查 Kiro CLI 是否已安装 |
| `check_kiro_cli_logged_in` | 检查登录状态 |
| `get_kiro_cli_version` | 获取版本号 |
| `get_kiro_models` | 获取支持的模型列表 |
| `execute_kiro_chat` | 执行对话（流式输出） |
| `cancel_kiro_execution` | 取消执行 |
| `open_kiro_login` | 打开登录终端 |

---

## 🔄 待完成

### 前端集成
1. [ ] 在设置页面添加 Kiro 配置入口
2. [ ] 在引擎选择器中添加 Kiro 选项
3. [ ] 创建 Kiro 会话组件（类似 ClaudeCodeSession）
4. [ ] 集成到主聊天界面

### 功能增强
1. [ ] 会话历史管理
2. [ ] 流式输出解析和显示
3. [ ] 错误处理和重试机制
4. [ ] 进程管理（取消、超时）

---

## 🔬 Claude Code 中逆向 Kiro API 研究

### 方案分析

#### 方案 A: MCP Server 集成 Kiro CLI（推荐）

```
Claude Code → MCP → kiro-mcp-server → Kiro CLI → Kiro 服务
```

**实现方式**：
1. 创建一个 MCP Server，封装 Kiro CLI 调用
2. 在 Claude Code 中配置这个 MCP Server
3. Claude Code 可以通过 MCP 工具调用 Kiro

**优点**：
- 使用官方 Kiro CLI，零封号风险
- MCP 是标准协议，集成简单
- 可以选择模型（Opus/Sonnet/Haiku）

**缺点**：
- 需要 WSL（Windows）
- 不能替代 Claude Code 的主模型，只能作为辅助工具
- 双倍消耗（Claude Code + Kiro 都在运行）

#### 方案 B: 直接调用 Kiro API（高风险）

```
Claude Code (Electron) → 直接调用 Kiro API
```

**理论可行性**：
- Claude Code 是 Electron 应用
- Electron 的 TLS 指纹与 Chrome 一致
- 理论上可以在 Claude Code 的 Electron 环境中调用 Kiro API

**风险**：
- 仍然可能被检测封号
- 需要修改 Claude Code 源码或注入代码
- 维护成本高

**结论**：不推荐

---

### MCP Server 实现示例

创建一个 `kiro-mcp-server`：

```javascript
// kiro-mcp-server.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { spawn } = require('child_process');

const server = new Server({
  name: 'kiro-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// 定义 Kiro 对话工具
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'kiro_chat',
    description: '使用 Kiro CLI 进行 AI 对话，支持 Claude Opus/Sonnet/Haiku 模型',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息' },
        model: { 
          type: 'string', 
          description: '模型选择: auto, claude-opus-4.5, claude-sonnet-4.5, claude-haiku-4.5',
          default: 'auto'
        },
      },
      required: ['message'],
    },
  }],
}));

// 执行 Kiro CLI
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'kiro_chat') {
    const { message, model = 'auto' } = request.params.arguments;
    
    return new Promise((resolve, reject) => {
      // 通过 WSL 调用 kiro-cli
      const args = ['-e', 'kiro-cli', 'chat', '--message', message];
      if (model !== 'auto') {
        args.push('--model', model);
      }
      
      const proc = spawn('wsl', args);
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        resolve({
          content: [{ type: 'text', text: output }],
        });
      });
    });
  }
});

// 启动服务器
const transport = new StdioServerTransport();
server.connect(transport);
```

### Claude Code 配置

```json
// ~/.claude.json
{
  "mcpServers": {
    "kiro": {
      "command": "node",
      "args": ["path/to/kiro-mcp-server.js"]
    }
  }
}
```

### 使用方式

在 Claude Code 中：
```
使用 kiro_chat 工具，用 Opus 4.5 模型帮我分析这段代码
```

---

### 下一步

1. [ ] 先安装 Kiro CLI（见安装指南）
2. [ ] 创建 kiro-mcp-server
3. [ ] 在 Claude Code 中配置
4. [ ] 测试集成效果
