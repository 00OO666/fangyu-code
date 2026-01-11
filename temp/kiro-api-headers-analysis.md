# Kiro API 完整请求头分析

> 分析 Kiro 扩展代码，提取完整的请求头和参数，用于模拟官方客户端
> 更新时间: 2026-01-11

## 🔴 重要发现

Kiro 使用两种 API 调用方式：
1. **JSON-RPC 方式** (X-Amz-Target) - 用于简单请求
2. **REST API 方式** (POST /generateAssistantResponse) - 用于完整请求

## 1. 必需的请求头

### 基础头（JSON-RPC 方式）
| Header | 值 | 说明 |
|--------|-----|------|
| `Content-Type` | `application/x-amz-json-1.0` | AWS JSON-RPC 格式 |
| `X-Amz-Target` | `AmazonCodeWhispererStreamingService.GenerateAssistantResponse` | API 操作 |
| `Authorization` | `Bearer {accessToken}` | SSO Token |

### 基础头（REST API 方式）
| Header | 值 | 说明 |
|--------|-----|------|
| `Content-Type` | `application/json` | JSON 格式 |
| `Authorization` | `Bearer {accessToken}` | SSO Token |
| `x-amzn-kiro-agent-mode` | `true` 或 `false` | Agent 模式标识 |

### AWS SDK 自动添加的头
| Header | 值示例 | 说明 |
|--------|--------|------|
| `User-Agent` | `aws-sdk-js/3.682.0 ua/2.1 os/win32/10.0.22631 lang/js md/nodejs/20.18.0 api/codewhispererstreaming/3.682.0 KiroIDE 0.8.86 {machineId}` | 完整 UA |
| `x-amz-user-agent` | `aws-sdk-js/3.682.0 KiroIDE 0.8.86 {machineId}` | AWS 专用 UA |
| `amz-sdk-invocation-id` | `{uuid}` | 每次请求唯一 ID |
| `amz-sdk-request` | `attempt=1; max=3` | 重试信息 |

### Kiro 特有的头
| Header | 值 | 说明 |
|--------|-----|------|
| `x-amzn-codewhisperer-optout` | `true` | 隐私设置（禁用数据收集） |
| `x-amzn-kiro-agent-mode` | `true` 或 `false` | Agent 模式标识（关键！） |
| `x-kiro-machineid` | `{machineId}` | 遥测用的机器 ID |

### 响应头（服务器返回）
| Header | 说明 |
|--------|------|
| `x-amzn-codewhisperer-conversation-id` | 会话 ID，用于多轮对话 |
| `x-amzn-requestid` | 请求 ID |

## 2. 请求体参数

### REST API 方式（推荐）
```json
{
  "conversationState": {
    "currentMessage": {
      "userInputMessage": {
        "content": "用户的问题"
      }
    },
    "chatTriggerType": "MANUAL"
  },
  "profileArn": "arn:aws:codewhisperer:us-east-1:xxxx:profile/xxxx"
}
```

### JSON-RPC 方式（简化）
```json
{
  "conversationState": {
    "currentMessage": {
      "userInputMessage": {
        "content": "用户的问题"
      }
    },
    "chatTriggerType": "MANUAL"
  }
}
```

### profileArn 来源
- **Builder ID 用户**: 可能为空或不需要
- **IAM Identity Center 用户**: 从 token 文件或 profile 存储获取
- 格式: `arn:aws:codewhisperer:{region}:{accountId}:profile/{profileId}`

## 3. API 端点

| 端点 | 路径 | 说明 |
|------|------|------|
| `q.us-east-1.amazonaws.com` | `/` (JSON-RPC) | 主端点 |
| `q.us-east-1.amazonaws.com` | `/generateAssistantResponse` (REST) | REST 端点 |
| `codewhisperer.us-east-1.amazonaws.com` | `/` | 备用端点 |

## 4. customUserAgent 格式

```javascript
customUserAgent: `KiroIDE ${kiroVersion} ${machineId}`
// 示例: "KiroIDE 0.8.86 fe7515efc582981fbbbb8155ed8dd7b2a03558651b67fa03e4390012b6927502"
```

**当前 Kiro 版本**: 0.8.86

## 5. 完整的 User-Agent 构成

AWS SDK 会自动构建 User-Agent，格式为：
```
aws-sdk-js/{sdkVersion} ua/2.1 os/{platform}/{release} lang/js md/nodejs/{nodeVersion} api/codewhispererstreaming/{sdkVersion} {customUserAgent}
```

示例：
```
aws-sdk-js/3.682.0 ua/2.1 os/win32/10.0.22631 lang/js md/nodejs/20.18.0 api/codewhispererstreaming/3.682.0 KiroIDE 0.8.86 fe7515efc582981fbbbb8155ed8dd7b2a03558651b67fa03e4390012b6927502
```

## 6. 获取 machineId

Kiro 使用 `node-machine-id` 包获取机器 ID：
```javascript
const { machineIdSync } = require('node-machine-id');
const machineId = machineIdSync();
```

**Windows 上的计算方式**:
```javascript
// 读取注册表 MachineGuid
const guid = "ffaa5a94-3508-4331-a0c8-4bbfcc9e397d"; // HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
// SHA256 哈希
const machineId = sha256(guid); // 64 字符的十六进制字符串
```

**你的 machineId**: `9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64`

## 7. 获取 profileArn

对于 Builder ID 用户，profileArn 可能不需要或为空。

从 token 文件检查：
```javascript
const tokenData = JSON.parse(fs.readFileSync('~/.aws/sso/cache/kiro-auth-token.json'));
// 如果存在 profileArn 字段则使用
const profileArn = tokenData.profileArn || undefined;
```

## 8. 中间件添加的头

### addPrivacyHeadersMiddleware
```javascript
// 如果 telemetry.dataSharing.contentCollectionForServiceImprovement = false（默认）
headers["x-amzn-codewhisperer-optout"] = "true"
```

### addAgentModeHeadersMiddleware
```javascript
headers["x-amzn-kiro-agent-mode"] = agentMode  // "true" 或 "false"
```

## 9. 完整模拟请求示例

```javascript
const https = require('https');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const fs = require('fs');
const path = require('path');

// 获取 machineId (Windows)
function getMachineId() {
  // 实际应该用 node-machine-id，这里简化
  const guid = 'ffaa5a94-3508-4331-a0c8-4bbfcc9e397d'; // 从注册表读取
  return crypto.createHash('sha256').update(guid).digest('hex');
}

// 读取 token
const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
const accessToken = tokenData.accessToken;

const machineId = getMachineId();
const kiroVersion = '0.8.86';
const invocationId = uuidv4();
const sdkVersion = '3.682.0';

const headers = {
  'Content-Type': 'application/x-amz-json-1.0',
  'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
  'Authorization': `Bearer ${accessToken}`,
  
  // AWS SDK 标准头
  'User-Agent': `aws-sdk-js/${sdkVersion} ua/2.1 os/${os.platform()}/${os.release()} lang/js md/nodejs/${process.versions.node} api/codewhispererstreaming/${sdkVersion} KiroIDE ${kiroVersion} ${machineId}`,
  'x-amz-user-agent': `aws-sdk-js/${sdkVersion} KiroIDE ${kiroVersion} ${machineId}`,
  'amz-sdk-invocation-id': invocationId,
  'amz-sdk-request': 'attempt=1; max=4',
  
  // Kiro 特有头
  'x-amzn-codewhisperer-optout': 'true',
  'x-amzn-kiro-agent-mode': 'true',
};

const body = JSON.stringify({
  conversationState: {
    currentMessage: {
      userInputMessage: { content: '你的问题' }
    },
    chatTriggerType: 'MANUAL'
  }
  // profileArn: 'arn:aws:...'  // Builder ID 用户可能不需要
});

const options = {
  hostname: 'q.us-east-1.amazonaws.com',
  port: 443,
  path: '/',
  method: 'POST',
  headers: headers
};

const req = https.request(options, (res) => {
  console.log('状态:', res.statusCode);
  console.log('x-amzn-requestid:', res.headers['x-amzn-requestid']);
  console.log('conversation-id:', res.headers['x-amzn-codewhisperer-conversation-id']);
  
  res.on('data', (chunk) => {
    // 解析 AWS Event Stream 格式
    const str = chunk.toString('utf-8');
    const jsonMatches = str.match(/\{[^{}]*\}/g);
    if (jsonMatches) {
      jsonMatches.forEach(json => {
        try {
          const obj = JSON.parse(json);
          if (obj.content) console.log(obj.content);
        } catch (e) {}
      });
    }
  });
});

req.write(body);
req.end();
```

## 10. 避免封号的关键策略

### 🔴 导致封号的原因分析
根据之前的测试，封号可能是因为：
1. **User-Agent 不完整** - 缺少 AWS SDK 标准格式
2. **缺少 machineId** - 没有包含机器标识
3. **缺少 x-amzn-kiro-agent-mode 头** - 这是 Kiro 特有的标识
4. **请求频率异常** - 短时间内多次请求
5. **缺少 amz-sdk-invocation-id** - 每次请求应该有唯一 ID

### ⚠️ 诚实的风险评估（2026-01-11 更新）

**已解决的问题**:
| 问题 | 状态 | 说明 |
|------|------|------|
| User-Agent 格式 | ✅ 已解决 | 完整模拟 AWS SDK 格式 |
| machineId | ✅ 已解决 | 使用真实的机器 ID |
| x-amzn-kiro-agent-mode | ✅ 已解决 | 添加了此头 |
| amz-sdk-invocation-id | ✅ 已解决 | 每次请求生成新 UUID |
| amz-sdk-request | ✅ 已解决 | 添加重试信息 |

**仍然存在的风险**:
| 风险 | 严重程度 | 能否绕过 | 说明 |
|------|----------|---------|------|
| TLS 指纹 | 🔴 高 | ❌ 困难 | Node.js 和 Electron 的 TLS 握手特征不同 |
| 遥测缺失 | 🟡 中 | ⚠️ 可实现 | Kiro 会发送 `/SendTelemetryEvent`，脚本不发送 |
| 行为模式 | 🟡 中 | ⚠️ 部分 | 请求间隔、对话长度等行为特征 |
| 进程验证 | 🔴 高 | ❌ 不可能 | AWS 可能验证请求是否来自 Kiro.exe |
| IP/设备关联 | 🟡 中 | ⚠️ 未知 | 同一 machineId 但不同请求特征 |

### 🛡️ 降低风险的方法

#### 方法 1: 使用 Electron 运行（推荐）
在 Electron 环境中运行脚本，TLS 指纹与 Kiro 一致：
```javascript
// 创建一个简单的 Electron 应用来运行 API 调用
const { app } = require('electron');
app.whenReady().then(() => {
  // 在这里运行 API 调用
});
```

#### 方法 2: 使用 curl-impersonate
伪装 TLS 指纹为 Chrome/Electron：
```bash
# 安装 curl-impersonate
# 使用 chrome 指纹发送请求
curl_chrome116 -X POST https://q.us-east-1.amazonaws.com/ ...
```

#### 方法 3: 模拟遥测事件
定期发送遥测事件，模拟正常客户端行为：
```javascript
// 每隔一段时间发送遥测
await sendTelemetryEvent({
  clientToken: uuid(),
  optOutPreference: 'OPTOUT',
  telemetryEvent: { /* ... */ }
});
```

#### 方法 4: 限制使用频率
- 每天只测试 1-2 次
- 请求间隔 > 5 秒
- 模拟人类打字速度

### ✅ 安全使用建议
1. **使用完整的请求头** - 包括所有 AWS SDK 和 Kiro 特有的头
2. **使用真实的 machineId** - 与 Kiro 使用相同的机器 ID
3. **添加 x-amzn-kiro-agent-mode** - 设置为 "true"
4. **限制请求频率** - 每次请求间隔至少 2-3 秒
5. **保持会话连续性** - 使用响应中的 conversation-id 进行多轮对话
6. **使用正确的 User-Agent 格式** - 完全模拟 AWS SDK 的格式
7. **每次请求生成新的 invocation-id** - 使用 UUID v4

### 🔧 请求频率建议
| 场景 | 建议间隔 |
|------|----------|
| 单次测试 | 无限制 |
| 连续对话 | 2-3 秒 |
| 批量测试 | 5-10 秒 |
| 长期使用 | 模拟人类打字速度 |

### 🎯 结论
**不能保证 100% 不封号**。即使请求头完全正确，AWS 仍有多种方式检测非官方客户端。
建议：
1. 账号恢复后，先用 Electron 方式测试（TLS 指纹一致）
2. 如果仍被封，说明 AWS 有更深层的检测机制
3. 考虑是否值得继续这个方向

## 11. 封号后的恢复

如果账号被封，需要：
1. 访问 https://support.aws.amazon.com/#/contacts/kiro
2. 说明是误操作或测试导致
3. 等待 AWS 审核恢复

## 12. 待确认的信息

- [x] profileArn 的具体存储位置 → Builder ID 用户可能不需要
- [x] conversationId 的管理方式 → 从响应头 x-amzn-codewhisperer-conversation-id 获取
- [x] 是否有其他遥测相关的头 → x-kiro-machineid 用于遥测
- [ ] Token 刷新时的请求头
- [ ] 多轮对话时如何传递 conversationId


## 13. 多轮对话实现

### ConversationState 完整结构
```json
{
  "conversationState": {
    "conversationId": "从响应头获取的会话ID",
    "currentMessage": {
      "userInputMessage": {
        "content": "当前问题"
      }
    },
    "history": [
      {
        "userInputMessage": {
          "content": "之前的问题1"
        }
      },
      {
        "assistantResponseMessage": {
          "content": "之前的回答1"
        }
      }
    ],
    "chatTriggerType": "MANUAL",
    "agentTaskType": "...",
    "agentContinuationId": "...",
    "customizationArn": "...",
    "workspaceId": "..."
  }
}
```

### 多轮对话流程
1. **首次请求**: 不传 `conversationId` 和 `history`
2. **获取会话ID**: 从响应头 `x-amzn-codewhisperer-conversation-id` 获取
3. **后续请求**: 传入 `conversationId` 和 `history`（包含之前的对话）

### ChatMessage 类型
- `userInputMessage`: 用户消息，包含 `content` 字段
- `assistantResponseMessage`: 助手回复，包含 `content` 字段

### 图片支持
ConversationState 支持图片输入：
```json
{
  "currentMessage": {
    "userInputMessage": {
      "content": "描述这张图片",
      "imageBlocks": [
        {
          "format": "png",
          "source": {
            "bytes": "base64编码的图片数据"
          }
        }
      ]
    }
  }
}
```

## 14. 遥测事件（可选）

Kiro 会发送遥测事件到 `/SendTelemetryEvent` 端点：
```json
{
  "clientToken": "uuid",
  "modelId": "...",
  "optOutPreference": "OPTOUT",
  "profileArn": "...",
  "telemetryEvent": { ... },
  "userContext": { ... }
}
```

**注意**: 不发送遥测事件可能会被检测为异常行为。

## 15. 下一步研究方向

1. **TLS 指纹问题**: 考虑使用 Electron 或修改 Node.js 的 TLS 配置
2. **遥测模拟**: 研究是否需要发送遥测事件
3. **会话管理**: 实现完整的多轮对话支持
4. **Token 刷新**: 研究 token 过期后的刷新机制
