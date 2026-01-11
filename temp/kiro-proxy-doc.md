# KiroProxy 认证问题分析与解决方案

## 问题根因

经过深入研究，发现 **KiroProxy 的认证方式从根本上是错误的**：

### Kiro Token 的本质
```
accessToken: "aoaAAAAAGliuy8sTZVXtfkMJ1W0..."  // AWS SSO OIDC bearer token
provider: "BuilderId"                          // AWS Builder ID 认证
authMethod: "IdC"                              // IAM Identity Center
```

这个 token 是 **AWS SSO OIDC bearer token**，只能用于：
- CodeWhisperer API
- Amazon Q Developer API
- 其他支持 Builder ID 的 AWS 服务

**不能直接用于 Bedrock API！**

### 当前代码的错误
```typescript
// ❌ 错误：把 OIDC bearer token 当作 STS session token
credentials: {
  accessKeyId: 'PLACEHOLDER',
  secretAccessKey: 'PLACEHOLDER',
  sessionToken: token.accessToken,  // 这是 OIDC token，不是 STS token！
}
```

## 可行的解决方案

### 方案 1：使用 AWS IAM 凭证（推荐）

最简单可靠的方案是使用你自己的 AWS IAM 凭证：

1. **创建 IAM 用户**，授予 Bedrock 权限
2. **生成 Access Key**
3. **配置 KiroProxy** 使用这些凭证

```typescript
// src/routes/messages.ts
const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
```

**优点**：
- 简单可靠，100% 工作
- 不依赖 Kiro 的 token
- 可以使用任何 Bedrock 模型

**缺点**：
- 需要 AWS 账户
- 需要自己付费（Bedrock 按量计费）

### 方案 2：使用 Bedrock API Key（新功能）

AWS 最近推出了 Bedrock API Key 功能：

```bash
# 设置环境变量
export AWS_BEARER_TOKEN_BEDROCK="your-api-key"

# 或在代码中
curl -X POST "https://bedrock-runtime.us-east-1.amazonaws.com/model/..." \
  -H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK"
```

**注意**：这需要先在 AWS 控制台生成 API Key。

### 方案 3：放弃 KiroProxy，直接使用 Kiro

如果你的目标是在 Claude Code 中使用 AI，最简单的方案是：

1. **直接使用 Kiro** 作为 IDE
2. **或者使用 Claude Code 官方订阅**

Kiro 的 token 是专门为 CodeWhisperer/Amazon Q 设计的，无法用于通用的 Bedrock API 调用。

## 技术细节

### 为什么不能用 getRoleCredentials？

理论上可以用 SSO `getRoleCredentials` API 把 OIDC token 换成 STS 凭证：

```typescript
import { SSOClient, GetRoleCredentialsCommand } from '@aws-sdk/client-sso';

const sso = new SSOClient({ region: 'us-east-1' });
const response = await sso.send(new GetRoleCredentialsCommand({
  accessToken: kiroToken.accessToken,
  accountId: '???',    // 我们没有这个！
  roleName: '???',     // 我们也没有这个！
}));
```

但问题是：
- **Builder ID 没有关联 AWS 账户**
- **没有 accountId 和 roleName**
- **Kiro 内部使用的是专有 API，不是标准 Bedrock**

### Kiro 内部是怎么工作的？

Kiro 使用的是 **CodeWhisperer/Amazon Q 的专有 API**：
- 端点：`codewhisperer.us-east-1.amazonaws.com`
- 认证：Bearer token（直接使用 OIDC token）
- API：`GenerateCompletions`、`SendMessage` 等

这些 API 不是公开的 Bedrock API，无法通过代理方式使用。

## 结论

**KiroProxy 的设计思路是错误的**。Kiro 的 token 不能用于调用 Bedrock API。

如果你想在 Claude Code 中使用 AI：
1. 使用 Claude Code 官方订阅
2. 或者使用自己的 AWS IAM 凭证 + Bedrock
3. 或者直接使用 Kiro IDE

---

*分析时间：2026-01-11*
