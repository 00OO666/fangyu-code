# AI 编程引擎安装部署指南

> Fangyu Code 支持的四种 AI 引擎完整配置教程
> 
> 更新日期：2026年1月

---

## 📋 目录

1. [引擎对比总览](#引擎对比总览)
2. [Claude Code 安装配置](#1-claude-code-安装配置)
3. [OpenAI Codex 安装配置](#2-openai-codex-安装配置)
4. [Google Gemini 安装配置](#3-google-gemini-安装配置)
5. [SiliconFlow 安装配置](#4-siliconflow-安装配置)
6. [常见问题汇总](#常见问题汇总)

---

## 引擎对比总览

| 特性 | Claude Code | OpenAI Codex | Google Gemini | SiliconFlow |
|------|-------------|--------------|---------------|-------------|
| **开发商** | Anthropic | OpenAI | Google | 硅基流动 |
| **主要模型** | Claude 4 Sonnet/Opus | GPT-4o, o1, o3 | Gemini 2.5 Pro/Flash | DeepSeek, Qwen, GLM |
| **免费额度** | 无（需订阅） | 有限（Plus用户） | 1500次/天 | 2000万 Tokens |
| **国内访问** | 需代理 | 需代理 | 需代理 | ✅ 直连 |
| **延迟** | 中等 | 中等 | 中等 | 低（国内服务器） |
| **价格** | $20-100/月 | $20-200/月 | 免费/按量付费 | 极低 |
| **适用场景** | 复杂代码生成 | 通用编程 | 多模态任务 | 国内用户首选 |

---

## 1. Claude Code 安装配置

### 1.1 简介

Claude Code 是 Anthropic 官方推出的命令行 AI 编程工具，可以直接在终端中读取、修改和运行代码。它是目前最强大的 AI 编程助手之一。

### 1.2 系统要求

- **操作系统**: macOS 10.15+, Ubuntu 20.04+/Debian 10+, Windows 10+ (需 WSL 或 Git Bash)
- **内存**: 最低 4GB RAM
- **网络**: 需要稳定的国际网络连接
- **订阅**: Claude Pro ($20/月), Max ($100/月), Teams 或 Enterprise

### 1.3 安装步骤

#### Windows 安装（推荐使用 PowerShell）

```powershell
# 方法 1: 官方安装脚本
irm https://claude.ai/install.ps1 | iex

# 方法 2: 使用 WinGet
winget install Anthropic.ClaudeCode

# 方法 3: CMD 安装
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

#### macOS / Linux 安装

```bash
# 方法 1: 官方安装脚本（推荐）
curl -fsSL https://claude.ai/install.sh | bash

# 方法 2: Homebrew (macOS)
brew install --cask claude-code
```

#### Windows WSL 安装

```bash
# 在 WSL 终端中执行
curl -fsSL https://claude.ai/install.sh | bash
```

### 1.4 获取 API Key / 登录

Claude Code 支持两种认证方式：

#### 方式 1: Claude 订阅账号登录（推荐）

```bash
# 启动 Claude Code，首次运行会提示登录
cd your-project
claude

# 按提示在浏览器中完成 OAuth 登录
```

#### 方式 2: API Key 认证

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create Key** 创建新密钥
5. 复制密钥（格式：`sk-ant-api03-...`）

```bash
# 设置环境变量
# Windows PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-api03-your-key-here"

# macOS / Linux
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# 永久保存（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"' >> ~/.bashrc
```

### 1.5 验证安装

```bash
# 检查版本
claude --version

# 进入项目目录并启动
cd your-project
claude

# 测试简单命令
claude "列出当前目录的文件"
```

### 1.6 在 Fangyu Code 中配置

在 Fangyu Code 设置中：
1. 选择 **Claude Code** 引擎
2. 输入 API Key（如果使用 API 认证）
3. 或选择 **使用 Claude 订阅** 进行 OAuth 登录

### 1.7 常见问题

| 问题 | 解决方案 |
|------|----------|
| 安装失败 | 确保 Node.js 18+ 已安装 |
| 登录超时 | 检查网络代理设置 |
| API Key 无效 | 确认密钥格式正确，账户有余额 |
| Windows 路径问题 | 使用 WSL 或确保路径不含中文 |

---

## 2. OpenAI Codex 安装配置

### 2.1 简介

OpenAI Codex CLI 是 OpenAI 官方的命令行编程工具，基于 GPT 系列模型，可以在终端中进行代码生成、调试和重构。

### 2.2 系统要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 随 Node.js 一起安装
- **操作系统**: Windows, macOS, Linux
- **订阅**: ChatGPT Plus ($20/月), Pro ($200/月), Team 或 Enterprise

### 2.3 安装步骤

#### 全局安装（所有平台）

```bash
# 使用 npm 全局安装
npm install -g @openai/codex

# 或使用 yarn
yarn global add @openai/codex

# 验证安装
codex --version
```

#### 升级到最新版本

```bash
codex --upgrade
# 或
npm update -g @openai/codex
```

### 2.4 获取 API Key / 登录

#### 方式 1: ChatGPT 账号登录（推荐）

```bash
# 启动 Codex，选择 "Sign in with ChatGPT"
codex

# 按提示在浏览器中完成登录
# Plus/Pro/Team/Enterprise 用户可直接使用，无需额外付费
```

#### 方式 2: API Key 认证

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create new secret key**
5. 复制密钥（格式：`sk-proj-...`）

```bash
# 设置环境变量
# Windows PowerShell
$env:OPENAI_API_KEY = "sk-proj-your-key-here"

# macOS / Linux
export OPENAI_API_KEY="sk-proj-your-key-here"

# 永久保存
echo 'export OPENAI_API_KEY="sk-proj-your-key-here"' >> ~/.bashrc
```

### 2.5 配置文件

Codex 支持通过配置文件自定义行为：

```bash
# 创建配置文件
mkdir -p ~/.codex
cat > ~/.codex/config.json << 'EOF'
{
  "model": "gpt-4o",
  "approvalMode": "suggest",
  "fullAutoErrorMode": "ask-user"
}
EOF
```

**可用模型**:
- `gpt-4o` - 默认，平衡性能和速度
- `o1` - 推理模型，适合复杂问题
- `o3-mini` - 快速推理
- `gpt-4o-mini` - 轻量快速

### 2.6 验证安装

```bash
# 进入项目目录
cd your-project

# 启动 Codex
codex

# 测试命令
codex "创建一个简单的 Hello World 程序"
```

### 2.7 在 Fangyu Code 中配置

在 Fangyu Code 设置中：
1. 选择 **OpenAI Codex** 引擎
2. 输入 API Key 或选择 ChatGPT 登录
3. 选择默认模型（推荐 gpt-4o）

### 2.8 常见问题

| 问题 | 解决方案 |
|------|----------|
| npm 安装失败 | 检查 Node.js 版本 >= 18 |
| 登录失败 | 确保有 ChatGPT Plus 或更高订阅 |
| API 配额不足 | 检查 OpenAI 账户余额 |
| Windows 路径问题 | 使用完整路径或添加到 PATH |

---

## 3. Google Gemini 安装配置

### 3.1 简介

Google Gemini 是 Google 推出的多模态 AI 模型，支持文本、图像、音频和视频处理。通过 API 可以轻松集成到各种应用中。

### 3.2 系统要求

- **Python**: 3.9 或更高版本（如使用 Python SDK）
- **Node.js**: 18+ （如使用 JavaScript SDK）
- **网络**: 需要访问 Google 服务

### 3.3 获取 API Key（免费）

Gemini API 提供慷慨的免费额度，无需信用卡！

#### 步骤：

1. 访问 [Google AI Studio](https://ai.google.dev/)
2. 使用 Google 账号登录
3. 点击左侧 **Get API key**
4. 点击 **Create API key**
5. 选择或创建一个 Google Cloud 项目
6. 复制生成的 API Key

#### 免费额度（2025年数据）：

| 模型 | 请求/分钟 | 请求/天 | Token/分钟 |
|------|-----------|---------|------------|
| Gemini 2.5 Flash | 10 | 1500 | 100万 |
| Gemini 2.5 Pro | 2 | 50 | 100万 |
| Gemini 1.5 Flash | 15 | 1500 | 100万 |

### 3.4 安装 SDK

#### Python SDK

```bash
# 安装 Google Generative AI SDK
pip install google-generativeai

# 或使用 Vertex AI SDK（企业级）
pip install google-cloud-aiplatform
```

#### Node.js SDK

```bash
npm install @google/generative-ai
```

### 3.5 环境配置

```bash
# 设置环境变量
# Windows PowerShell
$env:GEMINI_API_KEY = "your-api-key-here"

# macOS / Linux
export GEMINI_API_KEY="your-api-key-here"

# 永久保存
echo 'export GEMINI_API_KEY="your-api-key-here"' >> ~/.bashrc
```

### 3.6 验证安装

#### Python 测试

```python
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")
response = model.generate_content("Hello, Gemini!")
print(response.text)
```

#### Node.js 测试

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function test() {
  const result = await model.generateContent("Hello, Gemini!");
  console.log(result.response.text());
}
test();
```

### 3.7 在 Fangyu Code 中配置

在 Fangyu Code 设置中：
1. 选择 **Google Gemini** 引擎
2. 输入 API Key
3. 选择模型（推荐 gemini-2.5-flash）

### 3.8 可用模型

| 模型 | 特点 | 适用场景 |
|------|------|----------|
| gemini-2.5-flash | 快速、经济 | 日常编程任务 |
| gemini-2.5-pro | 强大推理 | 复杂问题 |
| gemini-1.5-flash | 稳定可靠 | 生产环境 |
| gemini-1.5-pro | 长上下文 | 大型代码库 |

### 3.9 常见问题

| 问题 | 解决方案 |
|------|----------|
| API Key 无效 | 确认在 AI Studio 正确创建 |
| 配额超限 | 等待重置或升级付费计划 |
| 网络连接失败 | 检查代理设置，确保能访问 Google |
| 模型不可用 | 某些模型可能有地区限制 |

---

## 4. SiliconFlow 安装配置

### 4.1 简介

SiliconFlow（硅基流动）是国内领先的 AI 模型聚合平台，提供 DeepSeek、Qwen、GLM 等多种开源模型的 API 服务。**国内直连，无需代理，延迟极低！**

### 4.2 优势

- ✅ **国内直连**: 无需代理，访问稳定
- ✅ **超低延迟**: 国内服务器，响应快速
- ✅ **免费额度**: 新用户注册送 2000万 Tokens
- ✅ **价格实惠**: 比国外服务便宜 90%+
- ✅ **模型丰富**: DeepSeek-R1、Qwen、GLM 等

### 4.3 注册账号

1. 访问 [SiliconFlow 官网](https://cloud.siliconflow.cn/)
2. 点击 **登录/注册**
3. 支持手机号、邮箱、GitHub、Google 登录
4. 完成注册后自动获得 **2000万 Tokens** 免费额度

### 4.4 获取 API Key

1. 登录 [SiliconFlow 控制台](https://cloud.siliconflow.cn/)
2. 进入 **API Keys** 页面
3. 点击 **创建 API Key**
4. 复制密钥（格式：`sk-...`）

### 4.5 环境配置

```bash
# 设置环境变量
# Windows PowerShell
$env:SILICONFLOW_API_KEY = "sk-your-key-here"

# macOS / Linux
export SILICONFLOW_API_KEY="sk-your-key-here"

# 永久保存
echo 'export SILICONFLOW_API_KEY="sk-your-key-here"' >> ~/.bashrc
```

### 4.6 API 调用方式

SiliconFlow 兼容 OpenAI API 格式，可以直接使用 OpenAI SDK！

#### Python 调用

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key-here",
    base_url="https://api.siliconflow.cn/v1"
)

response = client.chat.completions.create(
    model="deepseek-ai/DeepSeek-R1",  # 或其他模型
    messages=[
        {"role": "user", "content": "你好，请介绍一下自己"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

#### Node.js 调用

```javascript
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: "sk-your-key-here",
  baseURL: "https://api.siliconflow.cn/v1"
});

async function chat() {
  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-R1",
    messages: [{ role: "user", content: "你好" }]
  });
  console.log(response.choices[0].message.content);
}
chat();
```

#### cURL 调用

```bash
curl -X POST https://api.siliconflow.cn/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-ai/DeepSeek-R1",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 4.7 可用模型

| 模型 | 类型 | 特点 | 价格 |
|------|------|------|------|
| DeepSeek-R1 | 推理 | 最强开源推理模型 | ¥4/百万Token |
| DeepSeek-V3 | 通用 | 高性能通用模型 | ¥2/百万Token |
| Qwen2.5-72B-Instruct | 通用 | 阿里通义千问 | ¥4/百万Token |
| Qwen2.5-Coder-32B | 代码 | 代码专用模型 | ¥2/百万Token |
| GLM-4.7 | 通用 | 智谱清言 | ¥1/百万Token |
| DeepSeek-R1-Distill-Qwen-32B | 推理 | 蒸馏版推理模型 | ¥1/百万Token |

### 4.8 在 Fangyu Code 中配置

在 Fangyu Code 设置中：
1. 选择 **SiliconFlow** 引擎
2. 输入 API Key
3. 选择模型（推荐 DeepSeek-R1 或 Qwen2.5-Coder）

### 4.9 常见问题

| 问题 | 解决方案 |
|------|----------|
| API Key 无效 | 确认密钥正确，账户已激活 |
| 余额不足 | 充值或等待免费额度重置 |
| 模型不存在 | 检查模型名称拼写 |
| 请求超时 | 检查网络，或减少请求频率 |

---

## 常见问题汇总

### Q1: 哪个引擎最适合国内用户？

**推荐 SiliconFlow**，原因：
- 国内直连，无需代理
- 延迟低，响应快
- 价格便宜，免费额度多
- 支持 DeepSeek-R1 等强大模型

### Q2: 哪个引擎代码能力最强？

根据 2025 年基准测试：
1. **Claude Code** (Claude 4 Opus) - 复杂代码生成最强
2. **OpenAI Codex** (o3) - 推理能力出色
3. **Google Gemini** (2.5 Pro) - 多模态理解强
4. **SiliconFlow** (DeepSeek-R1) - 开源最强，性价比高

### Q3: 如何在 Fangyu Code 中切换引擎？

1. 打开 Fangyu Code
2. 点击左下角 **设置** 图标
3. 选择 **引擎配置**
4. 选择目标引擎并配置 API Key
5. 点击 **保存**

### Q4: API Key 安全吗？

- Fangyu Code 将 API Key 加密存储在本地
- 密钥不会上传到任何服务器
- 建议定期轮换密钥
- 不要在公开代码中暴露密钥

### Q5: 如何节省 API 费用？

1. 使用免费额度（Gemini、SiliconFlow）
2. 选择合适的模型（不必总用最贵的）
3. 优化 Prompt，减少 Token 消耗
4. 使用 Fangyu Code 的上下文压缩功能

---

## 附录：环境变量汇总

```bash
# Claude Code
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# OpenAI Codex
export OPENAI_API_KEY="sk-proj-..."

# Google Gemini
export GEMINI_API_KEY="..."

# SiliconFlow
export SILICONFLOW_API_KEY="sk-..."
```

---

> 📝 本文档由 Fangyu Code + Kiro 自动生成
> 
> 如有问题，请访问 [Fangyu Code GitHub](https://github.com/00OO666/fangyu-code/)
