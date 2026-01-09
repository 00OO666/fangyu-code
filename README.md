<div align="center">

# Fangyu Code

### 🚀 下一代 AI 编程工具

**边等边输入 · 三引擎切换 · 实时成本追踪 · 智能上下文管理**

[![Release](https://img.shields.io/github/v/release/00OO666/fangyu-code?style=for-the-badge&color=blue)](https://github.com/00OO666/fangyu-code/releases)
[![Downloads](https://img.shields.io/github/downloads/00OO666/fangyu-code/total?style=for-the-badge&color=green)](https://github.com/00OO666/fangyu-code/releases)
[![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/00OO666/fangyu-code?style=for-the-badge&color=yellow)](https://github.com/00OO666/fangyu-code/stargazers)

<br/>

**[立即下载](#-快速开始)** · **[核心特性](#-为什么选择-fangyu-code)** · **[使用文档](#-使用指南)** · **[问题反馈](https://github.com/00OO666/fangyu-code/issues)**

<br/>

<img src="https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=white" alt="Tauri"/>
<img src="https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
<img src="https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white" alt="Rust"/>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"/>

</div>

---

## 💡 为什么选择 Fangyu Code？

> **不只是 GUI 包装器，而是真正提升效率的 AI 编程伙伴**

### 🎯 核心竞争力

<table>
<tr>
<td width="50%" valign="top">

#### 🚀 提示词队列系统
**业界首创，告别等待浪费**

```
AI 正在写代码...
  ↓
你突然想到补充说明
  ↓
直接输入，自动排队！
  ↓
或选择「插队」即时指导
```

- ✅ **边等边输入** - AI 工作时继续输入，指令自动排队
- ⚡ **插队模式** - 即时发送指导，不中断当前任务
- 📦 **打包模式** - 多条指令合并发送，批量处理
- 🎯 **撤回编辑** - 队列中的指令可随时撤回修改

**vs 其他工具**：Cursor/Windsurf 等工具必须等 AI 完成才能输入下一条

</td>
<td width="50%" valign="top">

#### 🎨 三引擎架构
**一个应用，三种选择**

| 引擎 | 特点 | 适用场景 |
|------|------|---------|
| **Claude Code** | 官方 CLI 完整集成<br/>支持 MCP/Hooks | 复杂编程任务<br/>代码重构 |
| **OpenAI Codex** | Full Auto / Read-only<br/>快速响应 | 快速原型<br/>代码补全 |
| **Google Gemini** | 百万级上下文<br/>超大窗口 | 大型代码库<br/>全局分析 |

**vs 其他工具**：大多数工具只支持单一引擎，无法灵活切换

</td>
</tr>
</table>

---

### 🔥 独家功能

<table>
<tr>
<td width="33%" align="center">

**💰 实时成本追踪**

每一分钱，心中有数

```
会话: $0.42
Tokens: 12.5K
Cache: 78% ↑
```

- 实时显示当前会话费用
- 按模型/项目/日期统计
- Cache 命中率分析
- 成本优化建议

</td>
<td width="33%" align="center">

**🧠 智能上下文管理**

告别「上下文超限」

- 智能监控 Token 使用
- 自动触发后台压缩
- 保留关键信息
- 压缩历史可追溯

**vs 其他工具**：手动管理上下文，经常崩溃

</td>
<td width="33%" align="center">

**📚 聊天历史回溯**

再也不会忘记历史对话

- FTS5 全文搜索
- 输入关键词秒速查找
- 一键恢复上下文
- 所有对话自动归档

**vs 其他工具**：历史对话难以查找和恢复

</td>
</tr>
</table>

---

## 🆚 与竞品对比

| 功能 | Fangyu Code | Cursor | Windsurf | GitHub Copilot |
|------|-------------|--------|----------|----------------|
| **提示词队列** | ✅ 边等边输入 | ❌ 必须等待 | ❌ 必须等待 | ❌ 必须等待 |
| **多引擎支持** | ✅ 3 个引擎 | ❌ 单一引擎 | ❌ 单一引擎 | ❌ 单一引擎 |
| **实时成本追踪** | ✅ 详细统计 | ⚠️ 基础显示 | ❌ 无 | ❌ 无 |
| **自动上下文管理** | ✅ 智能压缩 | ⚠️ 手动管理 | ⚠️ 手动管理 | ❌ 无 |
| **历史搜索** | ✅ FTS5 全文 | ⚠️ 基础搜索 | ❌ 无 | ❌ 无 |
| **MCP 集成** | ✅ 完整支持 | ❌ 无 | ❌ 无 | ❌ 无 |
| **本地运行** | ✅ 完全本地 | ❌ 云端 | ❌ 云端 | ❌ 云端 |
| **开源** | ✅ AGPL-3.0 | ❌ 闭源 | ❌ 闭源 | ❌ 闭源 |

---

## 🎬 快速开始

### 📦 下载安装

从 [Releases](https://github.com/00OO666/fangyu-code/releases) 下载最新版本：

| 平台 | 下载 | 说明 |
|------|------|------|
| **Windows** | `.msi` / `.exe` | 推荐 MSI 安装包 |
| **macOS** | `.dmg` | 支持 Apple Silicon |
| **Linux** | `.AppImage` / `.deb` | 推荐 AppImage |

### ⚙️ 前置要求

1. **安装 Claude Code CLI**（必需）
   ```bash
   # 验证安装
   claude --version
   ```

2. **（可选）安装 Gemini CLI**
   ```bash
   npm install -g @anthropic-ai/claude-code
   gemini --version
   ```

### 🚀 首次使用

1. 启动 Fangyu Code
2. 选择项目目录
3. 选择 AI 引擎（Claude/Codex/Gemini）
4. 开始对话！

---

## 📖 使用指南

### 提示词队列（杀手级功能）

| 操作 | 说明 |
|------|------|
| **Enter 发送** | AI 空闲直接发送，AI 忙碌自动排队 |
| **队列按钮** | 右下角「队列」按钮（AI 工作时显示） |
| **撤回编辑** | 队列面板点击撤回，指令回到输入框 |
| **插队发送** | 点击 ⚡ 图标，即时发送指导（不中断 AI） |
| **打包发送** | 切换为「打包」模式，多条合并发送 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 发送消息 |
| `Shift+Tab` | 切换 Plan Mode |
| `Ctrl+Tab` | 切换会话标签 |
| `Ctrl+W` | 关闭当前会话 |
| `Ctrl+Shift+C` | 打开 Canvas 预览 |
| `Ctrl+Shift+T` | 打开使用统计图表 |

### Plan Mode（只读模式）

- 代码探索和分析
- 方案设计和评估
- 不修改文件、不执行命令

---

## 🔧 高级功能

<table>
<tr>
<td width="50%">

**MCP 集成**
- 完整的 MCP 服务器管理
- 项目级配置，无需重启
- 智能推荐适合的 MCP

**Hooks 自动化**
- 提交前代码审查
- 安全漏洞扫描
- 自定义触发规则

</td>
<td width="50%">

**智能翻译**
- 中英文透明翻译
- 8 种内容提取策略
- 翻译缓存加速

**扩展管理**
- Plugins 查看器
- Subagents 管理
- Skills 配置

</td>
</tr>
</table>

---

## 🏗️ 技术架构

> 详细架构文档请参阅 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

```
┌─────────────────────────────────────────────────────┐
│                   Fangyu Code                        │
├─────────────────┬─────────────────┬─────────────────┤
│   React 前端    │   Tauri 桥接    │    Rust 后端    │
│                 │                 │                 │
│ • React 18      │ • IPC 通信      │ • 三引擎管理    │
│ • TypeScript    │ • 事件流        │ • SQLite 存储   │
│ • Tailwind CSS  │ • 类型安全      │ • MCP 协议      │
│ • Framer Motion │                 │ • 翻译服务      │
└─────────────────┴─────────────────┴─────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Claude Code CLI    OpenAI Codex     Google Gemini
```

### 技术栈

| 层 | 技术 |
|----|------|
| **前端** | React 18, TypeScript, Tailwind CSS 4, Framer Motion |
| **后端** | Rust 2021, Tauri 2.9, SQLite, Tokio |
| **AI 引擎** | Claude Code CLI, OpenAI Codex API, Gemini CLI |

---

## 📝 更新日志

### v2.2.4 (2026-01-04)

**🚀 功能增强与稳定性优化**
- ✨ SiliconFlow 流式输出支持（SSE API）
- 🔄 跨窗口任务状态同步
- 🧹 自动任务清理机制（5min/30min TTL）
- 🔧 完善 SiliconFlow 引擎类型系统

### v2.2.3 (2026-01-03)

**🔧 修复消息显示问题**
- 修复 Token 优化逻辑错误导致的聊天内容被隐藏
- 完整对话显示 - 思考过程、中间输出和工具调用详情

### v2.0.0 (2026-01-02)

**🎉 重大更新：聊天历史回溯系统**
- 📚 FTS5 全文搜索
- 💾 自动保存到 SQLite
- 🎯 一键恢复上下文

[查看完整更新日志](https://github.com/00OO666/fangyu-code/releases)

---

## 🛠️ 源码构建

```bash
# 克隆仓库
git clone https://github.com/00OO666/fangyu-code.git
cd fangyu-code

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

**构建要求**:
- Node.js 18+
- Rust 1.70+
- Windows: WebView2 Runtime

---

## 🐛 问题反馈

遇到问题？

1. 查看 [常见问题](https://github.com/00OO666/fangyu-code/wiki/FAQ)
2. 搜索 [已有 Issues](https://github.com/00OO666/fangyu-code/issues)
3. 提交 [新 Issue](https://github.com/00OO666/fangyu-code/issues/new)

提交 Issue 时请包含：
- 问题描述和复现步骤
- 系统环境（Windows/macOS/Linux 版本）
- 错误截图或日志

---

## 🤝 贡献

欢迎贡献代码！

```bash
# 1. Fork 仓库
# 2. 创建分支
git checkout -b feature/your-feature

# 3. 提交更改
git commit -m "feat: add your feature"

# 4. 推送并创建 PR
git push origin feature/your-feature
```

---

## 📄 许可证

**AGPL-3.0** - 详见 [LICENSE](LICENSE)

---

## ⭐ Star History

<div align="center">

**如果 Fangyu Code 对你有帮助，请给个 Star ⭐**

[![Star History Chart](https://api.star-history.com/svg?repos=00OO666/fangyu-code&type=Date)](https://star-history.com/#00OO666/fangyu-code&Date)

</div>

---

<div align="center">

**Fangyu Code** - 下一代 AI 编程工具

Made with ❤️ by Fangyu

[GitHub](https://github.com/00OO666/fangyu-code) · [下载](https://github.com/00OO666/fangyu-code/releases) · [反馈](https://github.com/00OO666/fangyu-code/issues)

</div>
