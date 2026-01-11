---
inclusion: manual
---

# Kiro Proxy 逆向研究记录

> 记录 Kiro Token 认证机制的关键发现，供后续开发参考

## 🔑 核心发现

### 1. Kiro 使用 AWS Builder ID 认证
- **认证类型**: AWS Builder ID（不是 IAM Identity Center）
- **Token 类型**: SSO OIDC Access Token
- **Token 格式**: `aoa...`（Access Token）、`aor...`（Refresh Token）
- **Token 位置**: `~/.aws/sso/cache/kiro-auth-token.json`

### 2. Kiro 的 API 端点
| 服务 | 端点 |
|------|------|
| 认证服务 | `prod.us-east-1.auth.desktop.kiro.dev` |
| 下载服务 | `prod.download.desktop.kiro.dev` |
| 遥测服务 | `prod.us-east-1.telemetry.desktop.kiro.dev` |
| LLM API | `bedrock-runtime.{region}.amazonaws.com` |

### 3. Token 文件结构
```json
{
  "accessToken": "aoa...",      // SSO OIDC Access Token
  "refreshToken": "aor...",     // 用于刷新 accessToken
  "expiresAt": "2026-01-10T20:48:46.862Z",
  "region": "us-east-1",
  "clientId": "...",            // SSO OIDC Client ID (有时不存在)
  "clientSecret": "..."         // SSO OIDC Client Secret (有时不存在)
}
```

### 4. SSO Cache 目录结构
`~/.aws/sso/cache/` 包含两个文件：
- `kiro-auth-token.json` - Kiro 的 access token（1小时有效）
- `{clientIdHash}.json` - CodeWhisperer 客户端注册信息（90天有效，包含 clientId 和 clientSecret）

### 5. Token 刷新机制
- 使用 `@aws-sdk/client-sso-oidc` 的 `CreateTokenCommand`
- 参数: `clientId`, `clientSecret`, `grantType: 'refresh_token'`, `refreshToken`
- 刷新后更新 token 文件
- ✅ **已验证可用**

## ❌ 已验证失败的方案

### 方案 1: AWS SDK token 配置
```typescript
const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    token: { token: kiroToken.accessToken },
});
```
**结果**: `Could not load credentials from any providers`
**测试时间**: 2026-01-11 08:07

### 方案 2: HTTP Bearer Token 直接调用 Bedrock
```typescript
fetch('https://bedrock-runtime.us-east-1.amazonaws.com/model/.../converse', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
});
```
**结果**: `403 - Invalid API Key format: Must start with pre-defined prefix`
**原因**: Bedrock Bearer Token 认证需要专门生成的 Bedrock API Key（在 AWS 控制台生成），不是 SSO Token

### 方案 3: AssumeRoleWithWebIdentity
```typescript
new AssumeRoleWithWebIdentityCommand({
    WebIdentityToken: accessToken,
    RoleArn: '...',
});
```
**结果**: `InvalidIdentityTokenException - The ID Token provided is not a valid JWT`
**原因**: 需要 ID Token，不是 Access Token

### 方案 4: 调用 Kiro 认证服务
- 测试了 `prod.us-east-1.auth.desktop.kiro.dev` 的多个端点
- 所有端点返回 `404 UnknownOperationException`
- Kiro 认证服务不对外暴露凭证获取 API

## 🔍 关键技术发现

### Kiro 内部使用 SigV4 签名
- Kiro 扩展代码中发现 `AwsSdkSigV4Signer`、`BedrockRuntimeClient`、`ConverseCommand`
- Kiro 必须有某种方式将 SSO Token 转换为 AWS 凭证
- **推测**: Kiro 后端有专门的代理服务，用 AWS 内部凭证调用 Bedrock

### Bedrock API 认证方式（官方文档）
1. **SigV4 签名** - 需要 AccessKeyId + SecretAccessKey + SessionToken
2. **Bedrock API Key** - 专门在 AWS 控制台生成的 API Key，格式 `AWS_BEARER_TOKEN_BEDROCK`
3. Kiro 的 SSO Token（`aoa...`）不属于以上任何一种

### AWS Builder ID vs IAM Identity Center
- **Builder ID**: 个人开发者身份，不关联 AWS 账户，无法获取 AWS 凭证
- **IAM Identity Center**: 企业身份，关联 AWS 账户和角色，可以获取临时凭证
- Kiro 使用 Builder ID，无法通过 `getRoleCredentials` 获取 AWS 凭证

### Claude Code LLM Gateway 配置
根据官方文档 `https://docs.claude.com/en/docs/claude-code/llm-gateway`：
- `CLAUDE_CODE_SKIP_BEDROCK_AUTH=1` - 跳过 Bedrock 认证
- `ANTHROPIC_BASE_URL` - 自定义 API 端点
- 支持 LiteLLM 等第三方代理

## 🚧 当前状态

**结论**: Kiro 的 SSO Token 无法直接用于调用 Bedrock API

**可能的解释**:
1. **Kiro 后端有专门的代理服务**，用自己的 AWS 凭证调用 Bedrock，用户的 SSO Token 只用于身份验证和计费
2. Kiro 使用了 AWS 内部的特殊认证机制（非公开 API）
3. Kiro 的 500 积分是通过 AWS 账户计费，不是用户的 AWS 账户

## 🤔 关于"之前成功"的疑问

用户回忆 2026-01-10 下午曾经成功让 KiroProxy 工作（服务器一关就无法收到回复，一开就正常）。

**可能的解释**:
1. 当时可能有其他 AWS 凭证（`~/.aws/credentials`）
2. 当时 Claude Code 可能使用了第三方 API（用户配置了 `ANTHROPIC_BASE_URL`）
3. 当时的 token 格式可能不同

**当前 Claude Code 配置** (`~/.claude/settings.json`):
- `ANTHROPIC_BASE_URL`: `http://localhost:8080`
- `ANTHROPIC_MODEL`: `claude-opus-4-5-20251101`
- 没有设置 `ANTHROPIC_API_KEY`

## � 相关文件

- **KiroProxy 项目**: `F:\Kiro\2\kiro-claude-proxy\`
- **Token 提取**: `src/token/extractor.ts`
- **Token 刷新**: `src/token/token-refresher.ts`
- **API 路由**: `src/routes/messages.ts`
- **Kiro 扩展**: `F:\软件\一级重要软件\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js` (42MB)
- **测试脚本**: `temp/test-bedrock-bearer.cjs`, `temp/test-assume-role.cjs`, `temp/test-kiro-auth.cjs`
- **会话记录**: `temp/kiro-session-039902a7.json`, `temp/kiro-session-success.json`

## 🔧 可能的替代方案

1. **使用自己的 AWS 账户**: 配置 AWS 凭证，直接调用 Bedrock（需要付费）
2. **生成 Bedrock API Key**: 在 AWS 控制台生成，设置 `AWS_BEARER_TOKEN_BEDROCK` 环境变量
3. **等待 Kiro 官方 API**: 如果 Kiro 开放 API，可以直接使用
4. **抓包分析**: 使用 Fiddler/Charles 抓取 Kiro 的实际 API 调用，看看它是如何认证的
5. **继续使用第三方 API**: 用户已有的第三方 Claude API 服务

## ✅ 成功调用 Q Developer API（2026-01-11）

**已验证可用！** 使用 Kiro 的 SSO Token 直接调用 Amazon Q Developer API：

```javascript
const https = require('https');
const options = {
  hostname: 'q.us-east-1.amazonaws.com',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-amz-json-1.0',
    'Authorization': `Bearer ${accessToken}`,  // kiro-auth-token.json 中的 accessToken
    'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
  }
};

const body = JSON.stringify({
  conversationState: {
    currentMessage: {
      userInputMessage: { content: '你的问题' }
    },
    chatTriggerType: 'MANUAL'
  }
});
```

**测试结果**：
- 问题：`1+1等于几？`
- 回复：`1+1=2` ✅

## 🎯 重大发现（2026-01-11 代码分析）

### Kiro 实际使用的 API

**Kiro 不是直接调用 Bedrock API，而是调用 Amazon Q Developer / CodeWhisperer 的专有 API！**

| 组件 | 说明 |
|------|------|
| **客户端** | `@aws/codewhisperer-streaming-client` |
| **API 端点** | `https://q.us-east-1.amazonaws.com` |
| **认证方式** | Bearer Token（直接使用 SSO OIDC Token） |
| **命令** | `GenerateAssistantResponseCommand` |

### 关键代码片段

```javascript
// 获取 CodeWhisperer Streaming Client
getCodeWhispererStreamingClient = async (retryStrategy) => {
  const bearerToken = await authProvider.getToken();
  return new CodeWhispererStreaming({
    ...await getCodeWhispererConfig(),
    retryStrategy,
    token: { token: bearerToken.toString() },  // 直接使用 SSO Token！
    customUserAgent: `KiroIDE ${kiroVersion} ${machineId}`
  });
};

// 预设配置
usEast1Config = {
  region: "us-east-1",
  endpoint: "https://q.us-east-1.amazonaws.com"
};
```

### 为什么之前的方案都失败了

1. **我们尝试调用 Bedrock API** → 但 Kiro 用的是 Q Developer API
2. **Bedrock 需要 SigV4 签名** → Q Developer 只需要 Bearer Token
3. **Bedrock 端点**: `bedrock-runtime.*.amazonaws.com` → **Q Developer 端点**: `q.*.amazonaws.com`

### 新的可能方案

如果要复用 Kiro 的 token，需要：
1. 使用 `@aws/codewhisperer-streaming-client` 包
2. 调用 `https://q.us-east-1.amazonaws.com` 端点
3. 使用 Bearer Token 认证（`token: { token: accessToken }`）

但这个包是 AWS 内部包，可能不公开发布。

## 📅 更新记录

- 2026-01-11: 初始记录
- 2026-01-11: 验证多个方案均失败，更新结论
- 2026-01-11: 深入分析 Kiro 扩展代码，发现使用标准 AWS SDK
- 2026-01-11: 搜索历史会话记录，找到"终于成功了"的对话，但缺少关键实现细节
- 2026-01-11: 确认当前 `token: { token: accessToken }` 方式返回 `CredentialsProviderError`
- 2026-01-11: **重大发现** - Kiro 使用 Q Developer API（`q.*.amazonaws.com`），不是 Bedrock API
- 2026-01-11: Fiddler 抓包失败（AWS SDK 绕过 HTTP 代理），改用代码分析
