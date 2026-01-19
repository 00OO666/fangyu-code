# Kiro CodeWhisperer API 完整指南

> 基于逆向工程的 Kiro 模型选择机制研究
> 日期: 2026-01-16

---

## 📋 目录

1. [底层原理](#底层原理)
2. [API 结构](#api-结构)
3. [模型 ID 映射表](#模型-id-映射表)
4. [完整代码实现](#完整代码实现)
5. [测试脚本](#测试脚本)
6. [常见问题](#常见问题)

---

## 底层原理

### Kiro 的架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Kiro IDE                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Auto 模式  │    │ Sonnet 模式 │    │  Opus 模式  │      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            ▼                                 │
│              ┌─────────────────────────┐                     │
│              │   userInputMessage      │                     │
│              │   { modelId: "xxx" }    │                     │
│              └───────────┬─────────────┘                     │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   Amazon Q API          │
              │   (CodeWhisperer)       │
              │   q.{region}.amazonaws  │
              └───────────┬─────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   Claude Models         │
              │   - Opus 4.5            │
              │   - Sonnet 4.5          │
              │   - Sonnet 4            │
              │   - Haiku 4.5           │
              └─────────────────────────┘
```

### 关键发现

1. **模型选择不是通过 customizationArn**：之前猜测的 `customizationArn` 参数是用于自定义模型，不是选择 Claude 版本

2. **模型选择通过 `userInputMessage.modelId`**：这是在请求体深层嵌套的参数

3. **API 端点是 Amazon Q**：`https://q.{region}.amazonaws.com/generateAssistantResponse`

4. **认证方式**：
   - Builders ID (免费): 支持所有模型包括 Opus 4.5
   - IAM Identity Center (Pro): 目前不支持 Opus 4.5

### Token 文件位置

```
Windows: %USERPROFILE%\.aws\sso\cache\kiro-auth-token.json
Mac/Linux: ~/.aws/sso/cache/kiro-auth-token.json
```

Token 文件结构：
```json
{
  "accessToken": "eyJ...",
  "expiresAt": "2026-01-16T01:47:43.813472600+00:00",
  "region": "us-east-1",
  "profileArn": null  // Builders ID 没有这个字段
}
```

---

## API 结构

### 请求端点

```
POST https://q.{region}.amazonaws.com/generateAssistantResponse
```

### 请求头

```http
Content-Type: application/json
Authorization: Bearer {accessToken}
User-Agent: KiroIDE 0.7.5
Accept: application/json
x-amzn-kiro-agent-mode: vibe
```

### 请求体结构

```json
{
  "conversationState": {
    "chatTriggerType": "MANUAL",
    "conversationId": "unique-conversation-id",
    "currentMessage": {
      "userInputMessage": {
        "content": "用户消息内容",
        "origin": "AI_EDITOR",
        "modelId": "claude-opus-4.5"  // ← 模型选择在这里！
      }
    },
    "history": []  // 可选：对话历史
  },
  "profileArn": "..."  // 仅 IAM Identity Center 需要
}
```

### 响应格式

响应是 Server-Sent Events (SSE) 流：

```
:event-type {"headers":{":event-type":{"type":"string","value":"messageMetadataEvent"}}}
{"conversationId":"...","utteranceId":"..."}

:event-type {"headers":{":event-type":{"type":"string","value":"assistantResponseEvent"}}}
{"content":"响应内容片段1"}

:event-type {"headers":{":event-type":{"type":"string","value":"assistantResponseEvent"}}}
{"content":"响应内容片段2"}

... 更多片段 ...
```

---

## 模型 ID 映射表

| 模型名称 | CodeWhisperer modelId | 说明 |
|---------|----------------------|------|
| Claude Opus 4.5 | `claude-opus-4.5` | 最强大，推理能力最强 |
| Claude Haiku 4.5 | `claude-haiku-4.5` | 最快速，适合简单任务 |
| Claude Sonnet 4.5 | `CLAUDE_SONNET_4_5_20250929_V1_0` | 平衡性能和速度 |
| Claude Sonnet 4 | `CLAUDE_SONNET_4_20250514_V1_0` | 上一代 Sonnet |
| Claude 3.7 Sonnet | `CLAUDE_3_7_SONNET_20250219_V1_0` | 更早版本 |

### 测试结果 (2026-01-16)

| 模型 | modelId | 状态 | 耗时 |
|------|---------|------|------|
| Claude Opus 4.5 | `claude-opus-4.5` | ✅ 成功 | 3458ms |
| Claude Sonnet 4.5 | `CLAUDE_SONNET_4_5_20250929_V1_0` | ✅ 成功 | 2811ms |
| Claude Sonnet 4 | `CLAUDE_SONNET_4_20250514_V1_0` | ✅ 成功 | 1688ms |
| 默认 (无 modelId) | - | ✅ 成功 | 1716ms |

---

## 完整代码实现

### 1. TypeScript 模型映射模块

```typescript
// models.ts - 模型名称映射

export interface ModelInfo {
  anthropicName: string;
  codewhispererModelId: string;
  displayName: string;
  maxOutputTokens: number;
}

// CodeWhisperer API 模型 ID
export const CODEWHISPERER_MODEL_IDS = {
  OPUS_45: 'claude-opus-4.5',
  HAIKU_45: 'claude-haiku-4.5',
  SONNET_45: 'CLAUDE_SONNET_4_5_20250929_V1_0',
  SONNET_4: 'CLAUDE_SONNET_4_20250514_V1_0',
  SONNET_37: 'CLAUDE_3_7_SONNET_20250219_V1_0',
};

// 模型映射表
const MODEL_MAP: Record<string, ModelInfo> = {
  'claude-opus-4.5': {
    anthropicName: 'claude-opus-4-5-20251101',
    codewhispererModelId: CODEWHISPERER_MODEL_IDS.OPUS_45,
    displayName: 'Claude Opus 4.5',
    maxOutputTokens: 16384,
  },
  'claude-sonnet-4.5': {
    anthropicName: 'claude-sonnet-4-5-20250929',
    codewhispererModelId: CODEWHISPERER_MODEL_IDS.SONNET_45,
    displayName: 'Claude Sonnet 4.5',
    maxOutputTokens: 16384,
  },
  'claude-sonnet-4': {
    anthropicName: 'claude-sonnet-4-20250514',
    codewhispererModelId: CODEWHISPERER_MODEL_IDS.SONNET_4,
    displayName: 'Claude Sonnet 4',
    maxOutputTokens: 16384,
  },
  'claude-haiku-4.5': {
    anthropicName: 'claude-haiku-4-5',
    codewhispererModelId: CODEWHISPERER_MODEL_IDS.HAIKU_45,
    displayName: 'Claude Haiku 4.5',
    maxOutputTokens: 8192,
  },
};

export function getModelId(model: string): string {
  const info = MODEL_MAP[model];
  return info?.codewhispererModelId || CODEWHISPERER_MODEL_IDS.OPUS_45;
}
```

### 2. API 客户端类

```typescript
// kiro-api-client.ts - Kiro CodeWhisperer API 客户端

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

interface KiroToken {
  accessToken: string;
  expiresAt: string;
  region: string;
  profileArn?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  modelId?: string;
  conversationId?: string;
  history?: ChatMessage[];
}

export class KiroApiClient {
  private token: KiroToken;
  private endpoint: string;

  constructor() {
    this.token = this.loadToken();
    this.endpoint = `q.${this.token.region || 'us-east-1'}.amazonaws.com`;
  }

  private loadToken(): KiroToken {
    const tokenPath = path.join(
      process.env.USERPROFILE || process.env.HOME || '',
      '.aws', 'sso', 'cache', 'kiro-auth-token.json'
    );
    
    if (!fs.existsSync(tokenPath)) {
      throw new Error(`Token file not found: ${tokenPath}\nPlease login to Kiro IDE first.`);
    }
    
    return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  }

  async chat(message: string, options: ChatOptions = {}): Promise<string> {
    const {
      modelId = 'claude-opus-4.5',
      conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      history = []
    } = options;

    const userInputMessage: any = {
      content: message,
      origin: 'AI_EDITOR'
    };

    if (modelId) {
      userInputMessage.modelId = modelId;
    }

    const body: any = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: { userInputMessage },
        history: history.map(msg => ({
          [msg.role === 'user' ? 'userInputMessage' : 'assistantResponseMessage']: {
            content: msg.content
          }
        }))
      }
    };

    if (this.token.profileArn) {
      body.profileArn = this.token.profileArn;
    }

    return this.sendRequest(body);
  }

  private sendRequest(body: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify(body);

      const options = {
        hostname: this.endpoint,
        port: 443,
        path: '/generateAssistantResponse',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Authorization': `Bearer ${this.token.accessToken}`,
          'User-Agent': 'KiroIDE 0.7.5',
          'Accept': 'application/json',
          'x-amzn-kiro-agent-mode': 'vibe'
        }
      };

      const req = https.request(options, (res) => {
        let data = Buffer.alloc(0);

        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.toString().substring(0, 500)}`));
            return;
          }
          resolve(this.parseEventStream(data));
        });
      });

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });
  }

  private parseEventStream(buffer: Buffer): string {
    const str = buffer.toString('utf8');
    const contents: string[] = [];

    const contentMatches = str.matchAll(/"content"\s*:\s*"([^"]*)"/g);
    for (const match of contentMatches) {
      if (match[1] && match[1].length > 0) {
        let decoded = match[1];
        decoded = decoded.replace(/\\n/g, '\n');
        decoded = decoded.replace(/\\t/g, '\t');
        decoded = decoded.replace(/\\"/g, '"');
        contents.push(decoded);
      }
    }

    return contents.join('') || '(empty response)';
  }

  isTokenValid(): boolean {
    const expiresAt = new Date(this.token.expiresAt);
    return expiresAt > new Date();
  }

  getTokenInfo(): { region: string; expiresAt: string; hasProfileArn: boolean } {
    return {
      region: this.token.region,
      expiresAt: this.token.expiresAt,
      hasProfileArn: !!this.token.profileArn
    };
  }
}
```

### 3. 使用示例

```typescript
// example.ts - 使用示例

import { KiroApiClient } from './kiro-api-client';

async function main() {
  const client = new KiroApiClient();
  
  console.log('Token info:', client.getTokenInfo());
  
  // 使用 Opus 4.5
  const response1 = await client.chat('What is 2 + 2?', {
    modelId: 'claude-opus-4.5'
  });
  console.log('Opus 4.5:', response1);
  
  // 使用 Sonnet 4.5
  const response2 = await client.chat('What is 2 + 2?', {
    modelId: 'CLAUDE_SONNET_4_5_20250929_V1_0'
  });
  console.log('Sonnet 4.5:', response2);
  
  // 多轮对话
  const conversationId = `conv-${Date.now()}`;
  
  const r1 = await client.chat('My name is Alice.', {
    modelId: 'claude-opus-4.5',
    conversationId
  });
  console.log('R1:', r1);
  
  const r2 = await client.chat('What is my name?', {
    modelId: 'claude-opus-4.5',
    conversationId,
    history: [
      { role: 'user', content: 'My name is Alice.' },
      { role: 'assistant', content: r1 }
    ]
  });
  console.log('R2:', r2);
}

main().catch(console.error);
```

---

## 测试脚本

### Node.js 测试脚本 (CommonJS)

```javascript
// test-kiro-api.cjs - 完整测试脚本

const fs = require('fs');
const path = require('path');
const https = require('https');

// 模型配置
const MODELS = {
  'opus-4.5': 'claude-opus-4.5',
  'sonnet-4.5': 'CLAUDE_SONNET_4_5_20250929_V1_0',
  'sonnet-4': 'CLAUDE_SONNET_4_20250514_V1_0',
  'haiku-4.5': 'claude-haiku-4.5',
};

// 读取 Token
function loadToken() {
  const tokenPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    '.aws', 'sso', 'cache', 'kiro-auth-token.json'
  );
  
  if (!fs.existsSync(tokenPath)) {
    console.error('❌ Token 文件不存在:', tokenPath);
    console.log('请先登录 Kiro IDE');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
}

// 发送请求
function sendRequest(endpoint, token, modelId, prompt) {
  return new Promise((resolve, reject) => {
    const conversationId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const userInputMessage = {
      content: prompt,
      origin: 'AI_EDITOR'
    };
    
    if (modelId) {
      userInputMessage.modelId = modelId;
    }
    
    const body = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId,
        currentMessage: { userInputMessage }
      }
    };
    
    if (token.profileArn) {
      body.profileArn = token.profileArn;
    }
    
    const requestBody = JSON.stringify(body);
    
    const options = {
      hostname: endpoint,
      port: 443,
      path: '/generateAssistantResponse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': `Bearer ${token.accessToken}`,
        'User-Agent': 'KiroIDE 0.7.5',
        'Accept': 'application/json',
        'x-amzn-kiro-agent-mode': 'vibe'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.toString().substring(0, 500)}`));
          return;
        }
        
        // 解析 SSE 响应
        const str = data.toString('utf8');
        const contents = [];
        const matches = str.matchAll(/"content"\s*:\s*"([^"]*)"/g);
        for (const match of matches) {
          if (match[1]) {
            contents.push(match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
          }
        }
        
        resolve(contents.join('') || '(empty)');
      });
    });
    
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// 主测试函数
async function runTests() {
  const token = loadToken();
  const endpoint = `q.${token.region || 'us-east-1'}.amazonaws.com`;
  
  console.log('='.repeat(60));
  console.log('Kiro CodeWhisperer API 测试');
  console.log('='.repeat(60));
  console.log(`Region: ${token.region}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Token expires: ${token.expiresAt}`);
  console.log(`Profile ARN: ${token.profileArn || '(Builders ID)'}`);
  console.log('='.repeat(60));
  
  const prompt = 'What is 2 + 2? Answer in one word.';
  const results = [];
  
  for (const [name, modelId] of Object.entries(MODELS)) {
    console.log(`\n测试: ${name} (${modelId})`);
    
    const start = Date.now();
    try {
      const response = await sendRequest(endpoint, token, modelId, prompt);
      const elapsed = Date.now() - start;
      
      console.log(`✅ 成功 (${elapsed}ms): ${response}`);
      results.push({ name, modelId, success: true, elapsed, response });
    } catch (error) {
      const elapsed = Date.now() - start;
      console.log(`❌ 失败 (${elapsed}ms): ${error.message}`);
      results.push({ name, modelId, success: false, elapsed, error: error.message });
    }
    
    // 避免速率限制
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // 汇总
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.success ? r.response : r.error} (${r.elapsed}ms)`);
  }
  
  // 保存结果
  const resultFile = `kiro-api-test-${Date.now()}.json`;
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n结果已保存: ${resultFile}`);
}

runTests().catch(console.error);
```

### 运行测试

```bash
# 保存为 test-kiro-api.cjs 然后运行
node test-kiro-api.cjs
```

---

## 常见问题

### Q1: Token 过期怎么办？

重新打开 Kiro IDE 并登录，会自动刷新 token。

### Q2: 为什么 Opus 响应更慢？

Opus 是最强大的模型，推理能力更强，所以处理时间更长。这是正常的。

### Q3: IAM Identity Center 能用 Opus 吗？

目前不能。只有 Builders ID (免费账户) 支持 Opus 4.5。

### Q4: 如何判断我用的是哪种认证？

检查 token 文件中的 `profileArn` 字段：
- 如果不存在或为 null → Builders ID
- 如果存在 → IAM Identity Center

### Q5: 默认模型是什么？

不设置 modelId 时，默认使用 Auto 模式，由 Amazon Q 自动选择模型。

---

## 参考资料

- [AIClient-2-API](https://github.com/justlovemaki/AIClient-2-API) - 逆向工程参考
- Kiro IDE 版本: 0.7.5
- 测试日期: 2026-01-16

---

*本文档基于逆向工程研究，仅供学习参考。*
