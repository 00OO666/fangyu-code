# 🔍 Claude API 代理测试工具

> 一键检测你的 Claude API 代理服务器是否靠谱

## 🎯 功能

- ✅ **模型可用性检测** - 测试代理商支持哪些模型
- ⏱️ **响应延迟测量** - 精确到毫秒的 TTFB 统计
- ⚠️ **模型替换检测** - 发现代理商偷偷降级模型的行为
- 📊 **批量测试** - 一次测试 20+ 种模型格式

## 🚀 快速开始

### 方式一：使用配置文件（推荐）

如果你使用 Claude Code，配置会自动从 `~/.claude/settings.json` 读取：

```bash
# 克隆仓库
git clone https://github.com/00OO666/claude-api-proxy-tester.git
cd claude-api-proxy-tester

# 运行测试
node test.js
```

### 方式二：命令行参数

```bash
node test.js --api-key "sk-xxx" --base-url "https://your-proxy.com"
```

### 方式三：环境变量

```bash
export ANTHROPIC_API_KEY="sk-xxx"
export ANTHROPIC_BASE_URL="https://your-proxy.com"
node test.js
```

## 📋 配置文件格式

`~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-xxx",
    "ANTHROPIC_BASE_URL": "https://your-proxy.com"
  }
}
```

## 📊 输出示例

```
测试代理商支持的模型格式...

API Base: https://your-proxy.com

✅ claude-opus-4-5-20251101       → claude-opus-4-5-20251101 (11818ms)
❌ claude-4-opus                  → 分组 xxx 下模型 claude-4-opus 无可用渠道
✅ claude-sonnet-4-5-20250929     → claude-sonnet-4-5-20250929 (25978ms)
⚠️ claude-opus-4-5-20251101       → claude-sonnet-4-5-20250929 (6277ms)  # 模型被替换！
✅ claude-haiku-4-5-20251001      → claude-haiku-4-5-20251001 (7516ms)
❌ claude-3-5-sonnet-20241022     → 无可用渠道

测试完成！
```

### 状态说明

| 符号 | 含义 |
|------|------|
| ✅ | 模型可用且返回正确 |
| ⚠️ | 模型可用但被替换成其他模型 |
| ❌ | 模型不可用（503/无渠道） |

## 🔧 测试的模型列表

脚本会测试以下模型格式：

**Claude 4.5 系列**
- `claude-opus-4-5-20251101`
- `claude-sonnet-4-5-20250929`
- `claude-haiku-4-5-20251001`

**简写格式**
- `claude-opus-4.5`
- `claude-sonnet-4.5`
- `claude-haiku-4.5`
- `claude-4-opus`
- `claude-4-sonnet`
- `claude-4-haiku`

**Claude 3.5 系列**
- `claude-3-5-sonnet-20241022`
- `claude-3.5-sonnet`

**Claude 3 系列**
- `claude-3-opus-20240229`
- `claude-3-opus`

## ⚠️ 常见问题

### 1. 模型被替换

如果你请求 `claude-opus-4-5-20251101` 但返回的是 `claude-sonnet-4-5-20250929`，说明代理商在偷偷降级你的请求。这意味着你付的是 Opus 的钱，用的是 Sonnet 的模型。

**建议**：换一个靠谱的代理商，或者直接使用官方 API。

### 2. 响应延迟过高

正常的 API 响应应该在 1-3 秒内。如果延迟超过 10 秒，说明代理商服务器性能较差。

### 3. 无可用渠道

返回 503 错误和 "无可用渠道" 说明代理商没有配置该模型的上游渠道。

## 📝 License

MIT

## 🙏 致谢

- [Anthropic](https://anthropic.com) - Claude API
- [Fangyu Code](https://github.com/00OO666/fangyu-code) - 下一代 AI 编程工具
