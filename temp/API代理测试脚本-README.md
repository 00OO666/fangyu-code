# API 代理测试脚本 v2.0

一键测试 Claude API 代理商是否正常工作。

## 功能

- ✅ 自动查询代理商支持的模型列表
- ✅ 对比 Claude 官方 4 个模型的支持情况
- ✅ 自动检测 API 格式（OpenAI 兼容 / Anthropic 原生）
- ✅ 支持 HTTP 和 HTTPS
- ✅ 自动从 `~/.claude/settings.json` 读取配置
- ✅ 支持命令行参数手动指定

## Claude 官方模型（2026-01）

| 模型 ID | 说明 |
|---------|------|
| `claude-sonnet-4-5-20250929` | Sonnet 4.5 |
| `claude-haiku-4-5-20251001` | Haiku 4.5 |
| `claude-opus-4-5-20251101` | Opus 4.5 |
| `claude-opus-4-1-20250805` | Opus 4.1 |

> ⚠️ 脚本只测试这 4 个官方模型，其他模型（如旧版 claude-3-5-sonnet）已不再支持。

## 使用方法

### 方式 1：自动读取配置

```bash
node api-proxy-tester.cjs
```

脚本会自动从 `~/.claude/settings.json` 读取 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_API_KEY`。

### 方式 2：手动指定

```bash
node api-proxy-tester.cjs <base-url> <api-key>
```

示例：
```bash
node api-proxy-tester.cjs https://hone.vvvv.ee sk-xxx
```

## 输出示例

```
══════════════════════════════════════════════════════════════════════
  API 代理测试脚本 v2.0
══════════════════════════════════════════════════════════════════════
  时间: 2026/1/14 10:31:10
  配置来源: ~/.claude/settings.json
  API Base: https://hone.vvvv.ee
  API Key: sk-BTyzU9G...a3VW
══════════════════════════════════════════════════════════════════════

📋 Step 1: 查询代理商支持的模型...
✅ 代理商返回 4 个模型

📋 官方模型支持情况:
   ✅ claude-sonnet-4-5-20250929
   ✅ claude-haiku-4-5-20251001
   ✅ claude-opus-4-5-20251101
   ✅ claude-opus-4-1-20250805

🔍 Step 2: 自动检测 API 格式...
   ✅ 检测到 OpenAI 兼容格式 (/v1/chat/completions)

🔌 Step 3: 测试模型 (OpenAI 兼容)...
   ✅ claude-sonnet-4-5-20250929             11.1s
   ✅ claude-haiku-4-5-20251001               2.3s
   ✅ claude-opus-4-5-20251101               21.1s
   ❌ claude-opus-4-1-20250805              未知模型

══════════════════════════════════════════════════════════════════════
  测试结果
══════════════════════════════════════════════════════════════════════
  ✅ 代理商正常工作
  ✅ 成功测试 3/4 个模型
  📝 API 格式: OpenAI 兼容
  📝 可用模型: claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001, claude-opus-4-5-20251101
══════════════════════════════════════════════════════════════════════
```

## 支持的 API 格式

| 格式 | 端点 | 认证方式 |
|------|------|----------|
| OpenAI 兼容 | `/v1/chat/completions` | `Authorization: Bearer <key>` |
| Anthropic 原生 | `/v1/messages` | `x-api-key: <key>` |

脚本会自动检测代理商支持哪种格式。

## 常见问题

### Q: 提示"无法获取模型列表"
A: 代理商可能不支持 `/v1/models` 端点，脚本会直接测试 4 个官方模型。

### Q: 所有模型都失败
A: 检查：
1. API Key 是否正确
2. 代理商服务是否正常
3. 网络是否能访问代理商

### Q: 部分模型显示"未知模型"
A: 代理商可能没有配置该模型的渠道，联系代理商确认。

## License

MIT
