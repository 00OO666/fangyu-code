# Kiro API 逆向工程完整指南

> 作者: Fangyu  
> 日期: 2026-01-11  
> 状态: ✅ 已验证成功

---

## 目录

1. [概述](#1-概述)
2. [Kiro 架构分析](#2-kiro-架构分析)
3. [认证机制](#3-认证机制)
4. [API 端点详解](#4-api-端点详解)
5. [请求头完整分析](#5-请求头完整分析)
6. [请求体格式](#6-请求体格式)
7. [响应解析](#7-响应解析)
8. [TLS 指纹问题](#8-tls-指纹问题)
9. [完整实现代码](#9-完整实现代码)
10. [踩坑记录](#10-踩坑记录)
11. [安全建议](#11-安全建议)

---

## 1. 概述

### 1.1 什么是 Kiro

Kiro 是 AWS 推出的 AI 编程助手 IDE，基于 VS Code 构建，底层使用 Amazon Q Developer（原 CodeWhisperer）的 API。

### 1.2 逆向目标

通过分析 Kiro 的网络请求，实现：
- 脱离 Kiro IDE 直接调用 AI API
- 构建自定义的 AI 编程助手
- 集成到其他工具或工作流中

### 1.3 最终结论

| 方案 | 结果 | 原因 |
|------|------|------|
| Node.js 直接调用 | ❌ 封号 | TLS 指纹不匹配 |
| Electron 调用 | ✅ 成功 | TLS 指纹与 Kiro 一致 |
| curl-impersonate | ⚠️ 未测试 | 理论可行 |

**关键发现**: AWS 不仅检查请求头，还检查 TLS 握手指纹。必须使用 Electron 或其他能模拟 Chrome TLS 指纹的方式。

---

## 2. Kiro 架构分析

### 2.1 技术栈

```
┌─────────────────────────────────────────────────────────┐
│                      Kiro IDE                           │
├─────────────────────────────────────────────────────────┤
│  Electron (Chromium + Node.js)                          │
│  ├── VS Code 核心                                       │
│  ├── Kiro 扩展 (TypeScript)                             │
│  └── AWS SDK for JavaScript v3                          │
├─────────────────────────────────────────────────────────┤
│  网络层                                                  │
│  ├── Electron net 模块 (Chromium 网络栈)                │
│  └── TLS 1.3 (Chrome 指纹)                              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Amazon Q Developer API                      │
│              q.us-east-1.amazonaws.com                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 关键文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| Kiro 主程序 | `F:\软件\一级重要软件\Kiro\` | 安装目录 |
| package.json | `resources\app\package.json` | 版本信息 |
| 扩展代码 | `resources\app\extensions\` | TypeScript 源码 |
| Token 缓存 | `~\.aws\sso\cache\kiro-auth-token.json` | 认证 Token |

### 2.3 Kiro 版本信息

```json
{
  "name": "kiro",
  "version": "0.8.86",
  "main": "./out/main.js"
}
```

---

## 3. 认证机制

### 3.1 认证流程

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  用户    │────▶│  AWS SSO     │────▶│  Builder ID     │
│  登录    │     │  OAuth 2.0   │     │  认证服务       │
└──────────┘     └──────────────┘     └─────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Access Token    │
              │  (JWT 格式)      │
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  本地缓存        │
              │  kiro-auth-      │
              │  token.json      │
              └──────────────────┘
```

### 3.2 Token 文件结构

路径: `C:\Users\{用户名}\.aws\sso\cache\kiro-auth-token.json`

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-12T10:30:00Z",
  "refreshToken": "...",
  "region": "us-east-1",
  "startUrl": "https://view.awsapps.com/start"
}
```

### 3.3 Token 有效期

- Access Token: 约 8 小时
- Refresh Token: 约 30 天
- Kiro 会自动刷新过期的 Token

### 3.4 读取 Token 的代码

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

function readToken() {
    const tokenPath = path.join(
        os.homedir(), 
        '.aws', 
        'sso', 
        'cache', 
        'kiro-auth-token.json'
    );
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    return tokenData.accessToken;
}
```

---

## 4. API 端点详解

### 4.1 主要端点

| 端点 | URL | 用途 |
|------|-----|------|
| 主 API | `https://q.us-east-1.amazonaws.com` | AI 对话 |
| 备用 API | `https://codewhisperer.us-east-1.amazonaws.com` | 兼容旧版 |
| 遥测 | `https://q.us-east-1.amazonaws.com/SendTelemetryEvent` | 使用统计 |

### 4.2 API 调用方式

Kiro 使用 **AWS JSON-RPC** 风格的 API：

```
POST / HTTP/1.1
Host: q.us-east-1.amazonaws.com
Content-Type: application/x-amz-json-1.0
X-Amz-Target: AmazonCodeWhispererStreamingService.GenerateAssistantResponse
```

### 4.3 可用的 API 操作

| X-Amz-Target | 说明 |
|--------------|------|
| `GenerateAssistantResponse` | AI 对话（主要） |
| `SendTelemetryEvent` | 发送遥测数据 |
| `GetConversation` | 获取会话历史 |
| `ListConversations` | 列出所有会话 |

---

## 5. 请求头完整分析

### 5.1 必需的请求头

```javascript
const headers = {
    // ===== 基础头 =====
    'Content-Type': 'application/x-amz-json-1.0',
    'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
    'Authorization': `Bearer ${accessToken}`,
    
    // ===== AWS SDK 标准头 =====
    'User-Agent': userAgent,           // 见下文详解
    'x-amz-user-agent': xAmzUserAgent, // 见下文详解
    'amz-sdk-invocation-id': uuid(),   // 每次请求唯一
    'amz-sdk-request': 'attempt=1; max=4',
    
    // ===== Kiro 特有头 =====
    'x-amzn-codewhisperer-optout': 'true',  // 隐私设置
    'x-amzn-kiro-agent-mode': 'true',       // Agent 模式标识
};
```

### 5.2 User-Agent 详解

AWS SDK 会自动构建 User-Agent，格式非常严格：

```
aws-sdk-js/{sdkVersion} ua/2.1 os/{platform}/{release} lang/js md/nodejs/{nodeVersion} api/codewhispererstreaming/{sdkVersion} {customUserAgent}
```

**完整示例**:
```
aws-sdk-js/3.682.0 ua/2.1 os/win32/10.0.22631 lang/js md/nodejs/20.18.0 api/codewhispererstreaming/3.682.0 KiroIDE 0.8.86 9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64
```

**各部分含义**:

| 部分 | 值 | 说明 |
|------|-----|------|
| `aws-sdk-js/3.682.0` | SDK 版本 | AWS SDK for JavaScript v3 |
| `ua/2.1` | UA 格式版本 | 固定值 |
| `os/win32/10.0.22631` | 操作系统 | `os.platform()/os.release()` |
| `lang/js` | 语言 | JavaScript |
| `md/nodejs/20.18.0` | 运行时 | Node.js 版本 |
| `api/codewhispererstreaming/3.682.0` | API 名称 | CodeWhisperer Streaming |
| `KiroIDE 0.8.86` | 客户端 | Kiro 版本 |
| `9d5916fe...` | machineId | 机器唯一标识 |

### 5.3 x-amz-user-agent 详解

简化版的 User-Agent：

```
aws-sdk-js/3.682.0 KiroIDE 0.8.86 {machineId}
```

### 5.4 machineId 计算方式

Kiro 使用 `node-machine-id` 包获取机器 ID：

```javascript
// Windows 上的计算方式
const crypto = require('crypto');
const { execSync } = require('child_process');

function getMachineId() {
    // 1. 读取 Windows 注册表中的 MachineGuid
    const output = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf-8' }
    );
    
    // 2. 提取 GUID
    const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
    const guid = match[1].trim();
    // 例如: ffaa5a94-3508-4331-a0c8-4bbfcc9e397d
    
    // 3. SHA256 哈希
    const machineId = crypto.createHash('sha256').update(guid).digest('hex');
    // 例如: 9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64
    
    return machineId;
}
```

### 5.5 amz-sdk-invocation-id

每次请求必须生成新的 UUID v4：

```javascript
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

---

## 6. 请求体格式

### 6.1 基础请求体

```json
{
    "conversationState": {
        "currentMessage": {
            "userInputMessage": {
                "content": "你的问题"
            }
        },
        "chatTriggerType": "MANUAL"
    }
}
```

### 6.2 多轮对话请求体

```json
{
    "conversationState": {
        "conversationId": "从响应头获取的会话ID",
        "currentMessage": {
            "userInputMessage": {
                "content": "后续问题"
            }
        },
        "history": [
            {
                "userInputMessage": {
                    "content": "之前的问题"
                }
            },
            {
                "assistantResponseMessage": {
                    "content": "之前的回答"
                }
            }
        ],
        "chatTriggerType": "MANUAL"
    }
}
```

### 6.3 带图片的请求体

```json
{
    "conversationState": {
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
        },
        "chatTriggerType": "MANUAL"
    }
}
```

### 6.4 chatTriggerType 可选值

| 值 | 说明 |
|-----|------|
| `MANUAL` | 用户手动输入 |
| `INLINE` | 内联补全 |
| `DIAGNOSTIC` | 诊断触发 |

---

## 7. 响应解析

### 7.1 响应头

```
HTTP/1.1 200 OK
Content-Type: application/vnd.amazon.eventstream
x-amzn-requestid: e02446e2-f37d-4fe9-83e6-a64014030108
x-amzn-codewhisperer-conversation-id: conv-12345...
```

**重要响应头**:

| 头 | 说明 |
|-----|------|
| `x-amzn-requestid` | 请求 ID，用于调试 |
| `x-amzn-codewhisperer-conversation-id` | 会话 ID，多轮对话需要 |

### 7.2 响应体格式

响应使用 **AWS Event Stream** 格式，是二进制流：

```
[消息长度(4字节)][头长度(4字节)][头CRC(4字节)][头数据][消息数据][消息CRC(4字节)]
```

### 7.3 简化解析方法

由于 Event Stream 格式复杂，可以用正则提取 JSON：

```javascript
response.on('data', (chunk) => {
    const str = chunk.toString('utf-8');
    
    // 提取所有 JSON 对象
    const jsonMatches = str.match(/\{[^{}]*\}/g);
    
    if (jsonMatches) {
        jsonMatches.forEach(json => {
            try {
                const obj = JSON.parse(json);
                
                // 文本内容
                if (obj.content) {
                    process.stdout.write(obj.content);
                }
                
                // 会话 ID
                if (obj.conversationId) {
                    console.log('会话ID:', obj.conversationId);
                }
            } catch (e) {
                // 忽略解析错误
            }
        });
    }
});
```

### 7.4 响应事件类型

| 事件 | 说明 |
|------|------|
| `assistantResponseEvent` | AI 回复文本 |
| `codeReferenceEvent` | 代码引用 |
| `supplementaryWebLinksEvent` | 相关链接 |
| `followupPromptEvent` | 后续问题建议 |

---

## 8. TLS 指纹问题

### 8.1 什么是 TLS 指纹

TLS 握手时，客户端会发送支持的加密套件、扩展等信息，这些信息组合起来形成唯一的"指纹"。

不同的 HTTP 客户端有不同的 TLS 指纹：

| 客户端 | TLS 指纹 |
|--------|----------|
| Chrome/Electron | JA3: `771,4865-4866-4867...` |
| Node.js | JA3: `771,49195-49199...` |
| curl | JA3: `771,49196-49200...` |
| Python requests | JA3: `771,49195-49199...` |

### 8.2 AWS 的检测机制

AWS 会检查：
1. 请求头是否完整
2. TLS 指纹是否匹配预期客户端
3. 请求行为是否异常

如果 TLS 指纹与声称的 User-Agent 不匹配，会被判定为异常请求。

### 8.3 为什么 Node.js 会被封号

```
声称: KiroIDE 0.8.86 (应该是 Electron/Chrome 指纹)
实际: Node.js TLS 指纹

→ 指纹不匹配 → 判定为伪造请求 → 封号
```

### 8.4 解决方案

**方案 1: 使用 Electron（推荐）**

Electron 使用 Chromium 的网络栈，TLS 指纹与 Chrome 一致：

```javascript
const { app, net } = require('electron');

app.whenReady().then(() => {
    const request = net.request({
        method: 'POST',
        url: 'https://q.us-east-1.amazonaws.com/'
    });
    // ... 设置请求头和发送
});
```

**方案 2: 使用 curl-impersonate**

curl-impersonate 可以模拟 Chrome 的 TLS 指纹：

```bash
curl_chrome116 -X POST https://q.us-east-1.amazonaws.com/ \
  -H "Content-Type: application/x-amz-json-1.0" \
  -H "X-Amz-Target: AmazonCodeWhispererStreamingService.GenerateAssistantResponse" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"conversationState":...}'
```

**方案 3: 修改 Node.js TLS 配置（不推荐）**

理论上可以修改 Node.js 的 TLS 配置，但非常复杂且不稳定。

---

## 9. 完整实现代码

### 9.1 Electron 版本（推荐）

```javascript
/**
 * Kiro API Electron 客户端
 * 
 * 使用方法:
 * 1. npm install electron
 * 2. npx electron this-file.js "你的问题"
 */

const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============ 配置 ============
const KIRO_VERSION = '0.8.86';
const SDK_VERSION = '3.682.0';
const MACHINE_ID = '你的machineId'; // 用 getMachineId() 获取

// ============ 工具函数 ============
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function readToken() {
    const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    return tokenData.accessToken;
}

// ============ 主函数 ============
async function chat(question) {
    const accessToken = readToken();
    const invocationId = generateUUID();
    const platform = os.platform();
    const release = os.release();
    const nodeVersion = process.versions.node;

    // 构建 User-Agent
    const userAgent = `aws-sdk-js/${SDK_VERSION} ua/2.1 os/${platform}/${release} lang/js md/nodejs/${nodeVersion} api/codewhispererstreaming/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;
    const xAmzUserAgent = `aws-sdk-js/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;

    // 构建请求体
    const body = JSON.stringify({
        conversationState: {
            currentMessage: {
                userInputMessage: { content: question }
            },
            chatTriggerType: 'MANUAL'
        }
    });

    return new Promise((resolve, reject) => {
        const request = net.request({
            method: 'POST',
            url: 'https://q.us-east-1.amazonaws.com/',
        });

        // 设置请求头
        request.setHeader('Content-Type', 'application/x-amz-json-1.0');
        request.setHeader('X-Amz-Target', 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse');
        request.setHeader('Authorization', `Bearer ${accessToken}`);
        request.setHeader('User-Agent', userAgent);
        request.setHeader('x-amz-user-agent', xAmzUserAgent);
        request.setHeader('amz-sdk-invocation-id', invocationId);
        request.setHeader('amz-sdk-request', 'attempt=1; max=4');
        request.setHeader('x-amzn-codewhisperer-optout', 'true');
        request.setHeader('x-amzn-kiro-agent-mode', 'true');

        let fullResponse = '';
        let conversationId = null;

        request.on('response', (response) => {
            conversationId = response.headers['x-amzn-codewhisperer-conversation-id'];

            response.on('data', (chunk) => {
                const str = chunk.toString('utf-8');
                const jsonMatches = str.match(/\{[^{}]*\}/g);
                if (jsonMatches) {
                    jsonMatches.forEach(json => {
                        try {
                            const obj = JSON.parse(json);
                            if (obj.content) {
                                fullResponse += obj.content;
                            }
                        } catch (e) {}
                    });
                }
            });

            response.on('end', () => {
                resolve({ response: fullResponse, conversationId });
            });
        });

        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

// ============ 入口 ============
app.whenReady().then(async () => {
    const question = process.argv[2] || '你好';
    
    try {
        const result = await chat(question);
        console.log('回答:', result.response);
        console.log('会话ID:', result.conversationId);
    } catch (error) {
        console.error('错误:', error.message);
    }
    
    app.quit();
});

app.disableHardwareAcceleration();
```

### 9.2 获取 machineId 的脚本

```javascript
/**
 * 获取 machineId（Windows）
 */
const crypto = require('crypto');
const { execSync } = require('child_process');

function getMachineId() {
    try {
        const output = execSync(
            'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
            { encoding: 'utf-8' }
        );
        const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
        if (match) {
            const guid = match[1].trim();
            return crypto.createHash('sha256').update(guid).digest('hex');
        }
    } catch (e) {
        console.error('获取 MachineGuid 失败:', e.message);
    }
    return null;
}

console.log('你的 machineId:', getMachineId());
```

---

## 10. 踩坑记录

### 10.1 失败的方案

| 方案 | 结果 | 原因 |
|------|------|------|
| Bedrock API + SigV4 签名 | ❌ | Kiro 不使用 Bedrock |
| Bedrock API + Bearer Token | ❌ | 端点错误 |
| AssumeRoleWithWebIdentity | ❌ | 不适用于 Builder ID |
| getRoleCredentials | ❌ | 需要 IAM Identity Center |
| Fiddler 抓包 | ❌ | AWS SDK 绕过系统代理 |
| Node.js 直接调用 | ❌ | TLS 指纹不匹配，封号 |

### 10.2 成功的方案

| 方案 | 结果 | 说明 |
|------|------|------|
| Electron + 完整请求头 | ✅ | TLS 指纹匹配 |

### 10.3 封号经历

**时间**: 2026-01-11

**原因**: 使用 Node.js 直接调用 API，TLS 指纹与 User-Agent 不匹配

**恢复方式**: 联系 AWS 支持，说明是测试导致的误操作

**教训**: 
1. 不要用 Node.js 直接调用
2. 必须使用 Electron 或其他能模拟 Chrome TLS 指纹的方式
3. 测试前先用小号

---

## 11. 安全建议

### 11.1 降低封号风险

1. **使用 Electron** - TLS 指纹与 Kiro 一致
2. **限制请求频率** - 每次请求间隔 > 3 秒
3. **使用真实 machineId** - 与 Kiro 使用相同的机器 ID
4. **保持会话连续性** - 使用 conversationId 进行多轮对话
5. **模拟正常使用** - 不要批量请求

### 11.2 请求频率建议

| 场景 | 建议间隔 |
|------|----------|
| 单次测试 | 无限制 |
| 连续对话 | 3-5 秒 |
| 批量测试 | 10+ 秒 |
| 长期使用 | 模拟人类打字速度 |

### 11.3 Token 安全

- 不要将 Token 提交到代码仓库
- Token 过期后会自动刷新（需要 Kiro 运行）
- 可以手动刷新：重新登录 Kiro

---

## 附录

### A. 相关文件

| 文件 | 说明 |
|------|------|
| `temp/test-kiro-api-electron.cjs` | Electron 测试脚本 |
| `temp/test-kiro-api-safe.cjs` | Node.js 测试脚本（⚠️ 可能封号） |
| `temp/kiro-api-headers-analysis.md` | 请求头分析文档 |

### B. 参考资料

- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Amazon Q Developer](https://aws.amazon.com/q/developer/)
- [Electron net 模块](https://www.electronjs.org/docs/latest/api/net)
- [JA3 TLS 指纹](https://github.com/salesforce/ja3)

### C. 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-01-11 | 初版，验证 Electron 方案成功 |
| 2026-01-11 | 重大更新：发现模型切换方法，获取完整模型列表 |

---

## 12. 模型切换（重大发现！）

### 12.1 可用模型列表

通过 `ListAvailableModels` API 获取的完整模型列表：

| 模型 ID | 名称 | 倍率 | 说明 |
|---------|------|------|------|
| `auto` | Auto | 1x | 默认，自动选择最优模型 |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | 1.3x | 最新 Sonnet |
| `claude-sonnet-4` | Claude Sonnet 4 | 1.3x | 混合推理和编码 |
| `claude-haiku-4.5` | Claude Haiku 4.5 | 0.4x | 最快最便宜 |
| `claude-opus-4.5` | Claude Opus 4.5 | 2.2x | 最强最贵 |

### 12.2 modelId 传递位置

**正确位置**: `userInputMessage.modelId`

```json
{
    "conversationState": {
        "currentMessage": {
            "userInputMessage": {
                "content": "你的问题",
                "modelId": "claude-opus-4.5",
                "origin": "AI_EDITOR"
            }
        },
        "chatTriggerType": "MANUAL"
    }
}
```

### 12.3 获取模型列表的 API

```javascript
// 端点: https://q.us-east-1.amazonaws.com/
// X-Amz-Target: AmazonCodeWhispererService.ListAvailableModels

const body = JSON.stringify({
    origin: 'AI_EDITOR'
});
```

### 12.4 测试命令

```bash
# 默认模型（auto）
npx electron temp/test-kiro-api-electron.cjs "你的问题"

# 指定 Claude Opus 4.5（最强）
npx electron temp/test-kiro-api-electron.cjs "你的问题" "claude-opus-4.5"

# 指定 Claude Haiku 4.5（最快）
npx electron temp/test-kiro-api-electron.cjs "你的问题" "claude-haiku-4.5"

# 指定 Claude Sonnet 4.5
npx electron temp/test-kiro-api-electron.cjs "你的问题" "claude-sonnet-4.5"

# 获取模型列表
npx electron temp/list-kiro-models.cjs
```

### 12.5 注意事项

1. **模型自我认知不准确** - 即使使用 Opus 4.5，模型可能仍说自己是 3.5 Sonnet
2. **倍率影响计费** - Opus 4.5 是 2.2x，Haiku 4.5 是 0.4x
3. **auto 模式** - 服务端根据任务自动选择最优模型

---

**免责声明**: 本文档仅供学习研究使用，请遵守 AWS 服务条款。
