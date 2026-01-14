# 通用 API 代理测试脚本 v3.0

> 一个脚本测试所有 AI API 代理商（Claude / Gemini / OpenAI）

## 功能特点

- ✅ **自动检测 API 类型** - 根据模型列表或 URL 自动判断
- ✅ **自动检测 API 格式** - OpenAI 兼容 / Anthropic 原生
- ✅ **支持多种 AI** - Claude、Gemini、OpenAI
- ✅ **详细输出** - 延迟、响应内容、Token 用量
- ✅ **灵活配置** - 命令行参数 / 配置文件 / 内置默认

## 使用方法

### 方式 1: 使用 ~/.claude/settings.json 配置

```bash
node universal-api-tester.cjs
```

### 方式 2: 使用内置 hiapi.online 配置

```bash
node universal-api-tester.cjs --hiapi
```

### 方式 3: 手动指定

```bash
node universal-api-tester.cjs <base-url> <api-key>

# 示例
node universal-api-tester.cjs https://api.example.com/v1 sk-your-api-key
```

### 方式 4: 强制指定 API 类型

```bash
node universal-api-tester.cjs --type=gemini <base-url> <api-key>
node universal-api-tester.cjs --type=claude <base-url> <api-key>
node universal-api-tester.cjs --type=openai <base-url> <api-key>
```

## 支持的模型

### Claude（2026-01 官方）
| 模型 | 说明 |
|------|------|
| `claude-sonnet-4-5-20250929` | 日常编程首选 |
| `claude-haiku-4-5-20251001` | 快速响应 |
| `claude-opus-4-5-20251101` | 复杂推理 |
| `claude-opus-4-1-20250805` | 混合推理 |

### Gemini（2026-01 官方）
| 模型 | 说明 |
|------|------|
| `gemini-2.5-pro` | 100w上下文，带思维链 |
| `gemini-2.5-flash` | 快速模型 |
| `gemini-3-pro-preview` | 最新 Pro 模型 |
| `gemini-3-flash-preview` | 性价比最高 |
| `gemini-2.5-pro-search` | 2.5 Pro + 搜索 |
| `gemini-3-pro-search` | 3 Pro + 搜索 |
| `gemini-2.5-pro-no` | 无思维链版本 |
| `gemini-3-pro-no` | 无思维链版本 |

### OpenAI（2026-01 官方）
| 模型 | 说明 |
|------|------|
| `gpt-4o` | 多模态旗舰 |
| `gpt-4o-mini` | 快速便宜 |
| `gpt-4-turbo` | 128k上下文 |
| `o1` | 推理模型 |
| `o1-mini` | 轻量推理 |
| `o3-mini` | 最新推理 |

## 输出示例

```
═══════════════════════════════════════════════════════════════════════
  通用 API 代理测试脚本 v3.0
═══════════════════════════════════════════════════════════════════════
  配置来源: ~/.claude/settings.json
  API Base: https://hone.vvvv.ee

📋 Step 1: 查询代理商支持的模型...
✅ 代理商返回 53 个模型

🔍 Step 2: 检测 API 类型...
   根据模型列表检测: CLAUDE

🔌 Step 4: 检测 API 格式...
   ✅ 使用 OpenAI 兼容格式

🧪 Step 5: 测试模型...

   ✅ claude-sonnet-4-5-20250929
      延迟: 10.4s
      响应: "我是Claude,一个由Anthropic开发的AI助手..."
      Token: 输入 67, 输出 52

═══════════════════════════════════════════════════════════════════════
  测试结果
═══════════════════════════════════════════════════════════════════════
  ✅ 代理商正常工作
  ✅ 成功测试 3/4 个模型
  📝 API 类型: CLAUDE
  📝 API 格式: OpenAI 兼容
  📝 平均延迟: 6.6s
```

## 自动检测逻辑

1. **查询 /models 端点** - 获取代理商支持的模型列表
2. **分析模型名称** - 统计 claude/gemini/gpt 关键词
3. **选择占比最高的类型** - 作为 API 类型
4. **URL 备选** - 如果无法获取模型列表，根据 URL 猜测
5. **默认 Claude** - 都无法判断时使用 Claude

## 内置配置

| 名称 | Base URL | 说明 |
|------|----------|------|
| hiapi | `https://hiapi.online/v1` | Gemini 代理 |
| settings.json | 读取 `~/.claude/settings.json` | Claude 代理 |

## 作者

Fangyu | MIT License
