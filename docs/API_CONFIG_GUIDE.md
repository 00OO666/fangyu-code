# API 配置指南

## 快速开始

### 1. 配置 HiAPI（推荐）

HiAPI 是推荐的中转服务，支持多种 AI 模型：

1. 打开 Fangyu Code → 设置 → API 配置
2. 选择 **HiAPI 中转服务**
3. 输入 API 密钥（格式：`sk-xxx`）
4. 点击"验证"确认连接正常
5. 保存配置

**Base URL**: `https://hiapi.online/v1`

### 2. 支持的模型

| 提供商 | 模型 |
|--------|------|
| Claude | claude-3.5-sonnet, claude-3-opus |
| GPT | gpt-4o, gpt-4-turbo, gpt-4o-mini |
| Gemini | gemini-2.5-pro, gemini-1.5-pro |

## 多提供商配置

支持同时配置多个 API 提供商：

- **HiAPI** - 中转服务（推荐）
- **OpenAI** - 官方 API
- **Anthropic** - Claude 官方
- **Google AI** - Gemini 官方
- **Azure OpenAI** - 企业版
- **自定义** - 任意 OpenAI 兼容 API

## 故障排除

### API 密钥无效
- 检查密钥格式是否正确（`sk-xxx`）
- 确认密钥未过期
- 检查账户余额

### 连接超时
- 检查网络连接
- 尝试增加超时时间（默认 30 秒）
- 使用代理（如需要）

### 速率限制
- 等待一段时间后重试
- 升级 API 套餐
- 减少请求频率

## 配置文件位置

配置自动保存到本地存储，密钥加密存储。
