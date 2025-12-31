<div align="center">

# Fangyu Code

### AI 驱动的终极编程伴侣

**三引擎 · 智能队列 · 实时成本追踪 · 自动上下文管理**

[![Release](https://img.shields.io/github/v/release/anyme123/any-code?style=for-the-badge&color=blue)](https://github.com/anyme123/any-code/releases)
[![Downloads](https://img.shields.io/github/downloads/anyme123/any-code/total?style=for-the-badge&color=green)](https://github.com/anyme123/any-code/releases)
[![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/anyme123/any-code?style=for-the-badge&color=yellow)](https://github.com/anyme123/any-code/stargazers)

<br/>

**[下载安装](#-快速开始)** · **[功能特性](#-核心特性)** · **[使用文档](#-使用指南)** · **[问题反馈](https://github.com/anyme123/any-code/issues)**

<br/>

<img src="https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=white" alt="Tauri"/>
<img src="https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
<img src="https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white" alt="Rust"/>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"/>

</div>

---

## 为什么选择 Fangyu Code？

> **不只是 GUI 包装器，而是真正的 AI 编程伙伴**

| 痛点 | Fangyu Code 解决方案 |
|------|---------------------|
| AI 工作时只能干等 | **提示词队列系统** - 边等边输入，指令自动排队 |
| 想纠正 AI 但怕打断 | **插队模式** - 即时发送指导，不中断当前任务 |
| 多条指令逐个发送太慢 | **打包模式** - 多条合并成一条，批量处理 |
| 不知道花了多少钱 | **实时成本追踪** - 每次对话费用一目了然 |
| 上下文超限崩溃 | **自动压缩** - 智能监控，后台无感压缩 |
| 只能用一个 AI | **三引擎架构** - Claude/Codex/Gemini 一键切换 |

---

## 核心特性

### 🚀 v1.4.0 新功能：提示词队列系统

**AI 工作时，你也不用停下来**

```
你正在等 AI 写代码...
  ↓
突然想到需要补充说明
  ↓
直接输入，自动排队！
  ↓
或者选择「插队」即时指导 AI
```

<table>
<tr>
<td width="33%" align="center">

**📋 智能排队**

AI 工作时继续输入
指令自动排队等待执行
支持撤回、编辑、重排序

</td>
<td width="33%" align="center">

**⚡ 插队模式**

即时发送指导/纠正
不中断当前任务
AI 实时收到你的反馈

</td>
<td width="33%" align="center">

**📦 打包发送**

多条指令合并为一条
减少上下文切换
批量任务更高效

</td>
</tr>
</table>

---

### 🎯 三引擎架构

**一个应用，三大 AI 引擎**

| 引擎 | 特点 | 适用场景 |
|------|------|---------|
| **Claude Code** | 官方 CLI 完整集成，支持 MCP/Hooks | 复杂编程任务、代码重构 |
| **OpenAI Codex** | Full Auto / Read-only 模式 | 快速原型、代码补全 |
| **Google Gemini** | 百万级上下文窗口 | 大型代码库分析 |

---

### 💰 实时成本追踪

**每一分钱，心中有数**

- 实时显示当前会话费用
- 按模型/项目/日期统计
- Cache 命中率分析
- 成本优化建议

```
会话成本: $0.42  |  Tokens: 12.5K  |  Cache: 78%
         ↑              ↑              ↑
     实时累计      输入+输出      缓存命中率
```

---

### 🧠 自动上下文管理

**告别「上下文超限」**

- 智能监控 Token 使用量
- 自动触发后台压缩
- 保留关键信息和工具调用
- 压缩历史可追溯

---

### 🔧 开发者工具集

<table>
<tr>
<td width="50%">

**MCP 集成**
- 完整的 MCP 服务器管理
- 项目级配置，无需重启
- 智能推荐适合的 MCP

</td>
<td width="50%">

**Hooks 自动化**
- 提交前代码审查
- 安全漏洞扫描
- 自定义触发规则

</td>
</tr>
<tr>
<td width="50%">

**智能翻译**
- 中英文透明翻译
- 8 种内容提取策略
- 翻译缓存加速

</td>
<td width="50%">

**扩展管理**
- Plugins 查看器
- Subagents 管理
- Skills 配置

</td>
</tr>
</table>

---

## 快速开始

### 📦 下载安装

从 [Releases](https://github.com/anyme123/any-code/releases) 下载最新版本：

| 平台 | 下载 | 说明 |
|------|------|------|
| **Windows** | `.msi` / `.exe` | 推荐 MSI 安装包 |
| **macOS** | `.dmg` | 支持 Apple Silicon |
| **Linux** | `.AppImage` / `.deb` | 推荐 AppImage |

### ⚙️ 前置要求

1. **安装 Claude Code CLI**
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

## 使用指南

### 提示词队列（v1.4.0 新功能）

| 操作 | 说明 |
|------|------|
| **Enter 发送** | AI 空闲直接发送，AI 忙碌自动排队 |
| **队列按钮** | 右下角「队列」按钮（AI 工作时显示） |
| **撤回编辑** | 队列面板点击撤回，指令回到输入框 |
| **插队发送** | 点击⚡图标，即时发送指导（不中断 AI） |
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

## 技术架构

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

## 更新日志

### v1.4.0 (2026-01-01)

**🚀 提示词队列系统**
- 📋 AI 工作时可继续输入，指令自动排队
- ⚡ 插队模式 - 即时指导，不中断任务
- 📦 打包模式 - 多条合并，批量处理
- 🔄 撤回编辑 - 队列指令可撤回修改
- ↕️ 调整顺序 - 拖拽或按钮重排序

**⭐ 改进**
- 默认模型设置优化
- 队列可视化面板
- 智能队列按钮

[查看完整更新日志](https://github.com/anyme123/any-code/releases)

---

## 源码构建

```bash
# 克隆仓库
git clone https://github.com/anyme123/any-code.git
cd any-code

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

## 问题反馈

遇到问题？

1. 查看 [常见问题](https://github.com/anyme123/any-code/wiki/FAQ)
2. 搜索 [已有 Issues](https://github.com/anyme123/any-code/issues)
3. 提交 [新 Issue](https://github.com/anyme123/any-code/issues/new)

提交 Issue 时请包含：
- 问题描述和复现步骤
- 系统环境（Windows/macOS/Linux 版本）
- 错误截图或日志

---

## 贡献

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

## 许可证

**AGPL-3.0** - 详见 [LICENSE](LICENSE)

---

## Star History

<div align="center">

**如果 Fangyu Code 对你有帮助，请给个 Star ⭐**

[![Star History Chart](https://api.star-history.com/svg?repos=anyme123/any-code&type=Date)](https://star-history.com/#anyme123/any-code&Date)

</div>

---

<div align="center">

**Fangyu Code** - AI 驱动的终极编程伴侣

Made with ❤️ by Fangyu

[GitHub](https://github.com/anyme123/any-code) · [下载](https://github.com/anyme123/any-code/releases) · [反馈](https://github.com/anyme123/any-code/issues)

</div>
