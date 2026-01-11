# Kiro API 安全替代方案

> 日期: 2026-01-11
> 背景: 直接调用 Kiro API 风险极高，多次导致封号
> 更新: 发现官方 Kiro CLI 工具！

---

## 🎉 重大发现：Kiro CLI（官方工具）

Amazon Q Developer CLI 已被重命名为 **Kiro CLI**，是官方闭源产品！

> 来源: https://github.com/aws/amazon-q-developer-cli
> "This open source project is no longer being actively maintained... 
> Amazon Q Developer CLI is now available as **Kiro CLI** (https://kiro.dev/cli/)"

这意味着：
1. ✅ 官方支持的 CLI 工具
2. ✅ 可以在终端中使用 Claude
3. ✅ 与 Kiro IDE 使用相同的认证
4. ✅ 零封号风险（官方工具）

---

## 🚨 为什么直接调用 API 会被封号？

AWS 的检测机制非常严格：

| 检测项 | 说明 |
|--------|------|
| TLS 指纹 | 即使用 Electron，指纹细节可能仍有差异 |
| 请求频率 | 正常用户不会在短时间内发送多个请求 |
| 会话完整性 | 缺少 conversationId、history 等上下文 |
| 遥测数据 | Kiro 会定期发送 SendTelemetryEvent |
| 行为分析 | 机器学习检测异常使用模式 |

---

## ✅ 官方解决方案：Kiro CLI

### 什么是 Kiro CLI？

Kiro CLI 是 AWS 官方的命令行 AI 助手，功能包括：
- 🤖 Agentic 对话模式（`kiro-cli chat`）
- 📝 代码生成和修改
- 🔧 自动化工作流
- 🔌 MCP 集成
- 🎯 支持多种模型（Haiku 4.5、Sonnet、Opus）

### 安装方法

**Windows（通过 WSL）**:
```bash
# 1. 安装 WSL（如果没有）
wsl --install

# 2. 在 WSL 中安装 Kiro CLI
curl -fsSL https://cli.kiro.dev/install | bash

# 3. 登录
kiro-cli login

# 4. 开始对话
kiro-cli chat
```

**macOS**:
```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

**Linux (Ubuntu)**:
```bash
wget https://desktop-release.q.us-east-1.amazonaws.com/latest/kiro-cli.deb
sudo dpkg -i kiro-cli.deb
```

### 使用方法

```bash
# 开始对话
kiro-cli chat

# 恢复之前的对话
kiro-cli chat --resume

# 检查状态
kiro-cli doctor

# 登录
kiro-cli login
```

---

## 📊 方案对比

| 特性 | Kiro CLI | Claude Code | Kiro IDE |
|------|----------|-------------|----------|
| 价格 | 免费（有限额） | 付费订阅 | 免费（有限额） |
| 模型 | Claude 全系列 | Claude | Claude 全系列 |
| Agent 模式 | ✅ | ✅ | ✅ |
| MCP 支持 | ✅ | ✅ | ✅ |
| Windows 原生 | ❌ (需要 WSL) | ✅ | ✅ |
| 终端使用 | ✅ | ✅ | ❌ |
| 封号风险 | 无 | 无 | 无 |

---

## 🔗 在 Claude Code 中使用 Kiro

### 方案：通过 MCP 集成

虽然不能直接替换 Claude Code 的后端 API，但可以通过 MCP 将 Kiro CLI 作为工具集成：

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "kiro": {
      "command": "wsl",
      "args": ["-e", "kiro-cli", "mcp"]
    }
  }
}
```

这样可以在 Claude Code 中调用 Kiro 的能力作为辅助工具。

---

## 📝 结论

| 方案 | 推荐度 | 说明 |
|------|--------|------|
| 直接调用 Kiro API | ❌ 不推荐 | 高封号风险，已验证 |
| **Kiro CLI（官方）** | ✅ 强烈推荐 | 官方工具，零风险 |
| Kiro IDE | ✅ 推荐 | 完整功能 |
| Claude Code + Anthropic API | ✅ 推荐 | 付费但稳定 |

**最佳实践**：
1. 日常开发使用 **Kiro IDE** 或 **Kiro CLI**
2. 需要 Claude Code 特定功能时使用官方 Anthropic API
3. ❌ 不要尝试逆向调用 API（封号风险太高）

---

## 📚 参考链接

- Kiro CLI 官网: https://kiro.dev/cli/
- Kiro CLI 安装文档: https://kiro.dev/docs/cli/installation/
- Kiro CLI 博客介绍: https://kiro.dev/blog/introducing-kiro-cli/
- Amazon Q Developer CLI (已废弃): https://github.com/aws/amazon-q-developer-cli
