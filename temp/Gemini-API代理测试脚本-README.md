# Gemini API 代理测试脚本 v1.0

> 测试 Gemini API 代理商的可用性和模型支持情况

## 功能特点

- ✅ 自动查询代理商支持的模型列表
- ✅ 测试官方 Gemini 模型（2.5/3.0 系列）
- ✅ 详细输出：延迟、响应内容、思维链检测
- ✅ 支持自定义代理商配置
- ✅ 60秒超时，适合慢速模型

## 使用方法

### 默认配置（hiapi.online）

```bash
node gemini-api-tester.cjs
```

### 自定义代理商

```bash
node gemini-api-tester.cjs <base-url> <api-key>

# 示例
node gemini-api-tester.cjs https://api.example.com/v1 sk-your-api-key
```

## 测试的模型

| 模型 | 说明 |
|------|------|
| `gemini-2.5-pro` | 100w上下文，带思维链和搜索 |
| `gemini-2.5-flash` | 快速模型 |
| `gemini-3-pro-preview` | 最新 Pro 模型 |
| `gemini-3-flash-preview` | 性价比最高 |
| `gemini-2.5-pro-search` | 2.5 Pro + 搜索 |
| `gemini-3-pro-search` | 3 Pro + 搜索 |
| `gemini-2.5-pro-no` | 2.5 Pro 无思维链 |
| `gemini-3-pro-no` | 3 Pro 无思维链 |

## 输出示例

```
═══════════════════════════════════════════════════════════════════════
  Gemini API 代理测试脚本 v1.0
═══════════════════════════════════════════════════════════════════════
  配置来源: 默认配置 (hiapi.online)
  API Base: https://hiapi.online/v1

📋 Step 1: 查询代理商支持的模型...
✅ 代理商返回 53 个模型

🔌 Step 3: 测试模型...

   ✅ gemini-2.5-pro
      延迟: 2.3s
      响应: "我是一个大型语言模型，由 Google 训练。..."

   ✅ gemini-3-pro-preview
      延迟: 6.8s
      响应: "我是 Gemini，由 Google 开发的大型语言模型。..."

═══════════════════════════════════════════════════════════════════════
  测试结果
═══════════════════════════════════════════════════════════════════════
  ✅ 代理商正常工作
  ✅ 成功测试 8/8 个模型
```

## 默认配置

脚本内置 hiapi.online 的配置：
- Base URL: `https://hiapi.online/v1`
- API Key: `sk-ljX4qbaBf84c9tOytKzYDFHdc7hlkUEJ1ix2ZoionqiGA9xp`

## 相关脚本

- `api-proxy-tester.cjs` - Claude API 代理测试脚本

## 作者

Fangyu | MIT License
