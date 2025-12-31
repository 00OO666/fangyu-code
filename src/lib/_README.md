# lib/ - 工具库和服务

> **40+ 工具模块** | 业务逻辑和服务层

---

## 概述

lib/ 目录包含所有工具函数、服务和业务逻辑，包括：
- API 调用层
- 流式处理核心
- Token 计数和定价
- 翻译中间件
- 会话管理
- 工具注册

---

## 目录结构

```
lib/
├── api.ts                        # API 调用层 ⭐
├── pricing.ts                    # 定价逻辑 ⭐
├── tokenCounter.ts               # Token 计数 ⭐
├── translationMiddleware.ts      # 翻译中间件 ⭐
├── stream/                       # 流式处理核心 ⭐
│   ├── SessionConnection.ts      # 会话连接
│   ├── SessionStore.ts           # 会话存储
│   ├── AsyncQueue.ts             # 异步队列
│   ├── converters/               # 数据转换器
│   │   ├── ClaudeConverter.ts
│   │   ├── ConverterRegistry.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── index.ts
├── services/                     # 服务层
│   └── llmApiService.ts          # LLM API 服务
├── claudeSDK.ts                  # Claude SDK 封装
├── codexConverter.ts             # Codex 数据转换
├── geminiConverter.ts            # Gemini 数据转换
├── hooksConverter.ts             # Hooks 数据转换
├── hooksManager.ts               # Hooks 管理器
├── sessionCost.ts                # 会话成本计算
├── sessionExport.ts              # 会话导出
├── sessionHelpers.ts             # 会话辅助函数
├── messageUtils.ts               # 消息工具函数
├── contentExtraction.ts          # 内容提取
├── subagentGrouping.ts           # 子代理分组
├── tokenExtractor.ts             # Token 提取
├── toolRegistry.ts               # 工具注册表
├── promptCache.ts                # 提示缓存
├── promptContextConfig.ts        # 提示上下文配置
├── promptEnhancementService.ts   # 提示增强服务
├── progressiveTranslation.ts     # 渐进式翻译
├── dualAPIEnhancement.ts         # 双 API 增强
├── errorHandling.ts              # 错误处理
├── clipboard.ts                  # 剪贴板操作
├── date-utils.ts                 # 日期工具
├── utils.ts                      # 通用工具函数
├── windowManager.ts              # 窗口管理
├── updater.ts                    # 更新管理
├── mcpDescriptions.ts            # MCP 描述
├── claudeSyntaxTheme.ts          # Claude 语法主题
├── syntaxHighlightCompat.ts      # 语法高亮兼容
└── outputCache.ts                # 输出缓存（含 Provider）
```

---

## 核心文件详解

### api.ts - API 调用层
**用途**: 封装所有 API 调用

**主要函数**:
```typescript
// Claude API
export async function sendMessage(prompt: string, options?: SendOptions): Promise<Response>
export async function streamMessage(prompt: string): AsyncGenerator<Chunk>
export async function listSessions(): Promise<Session[]>
export async function createSession(): Promise<Session>

// Codex API
export async function codexSendMessage(...)
export async function codexStreamMessage(...)

// Gemini API
export async function geminiSendMessage(...)
export async function geminiStreamMessage(...)

// MCP
export async function callMCPTool(tool: string, args: any): Promise<any>
```

**修改 API 端点**:
```typescript
// 在文件顶部
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
```

---

### pricing.ts - 定价逻辑
**用途**: 管理 AI 模型的定价配置

**定价结构**:
```typescript
interface ModelPricing {
  inputTokenPrice: number    // 输入 Token 价格 ($/1M tokens)
  outputTokenPrice: number   // 输出 Token 价格 ($/1M tokens)
  cacheInputPrice?: number   // 缓存输入价格
  cacheOutputPrice?: number  // 缓存输出价格
}

export const modelPricing: Record<string, ModelPricing> = {
  'claude-opus-4': {
    inputTokenPrice: 15,
    outputTokenPrice: 75,
    cacheInputPrice: 1.5,
    cacheOutputPrice: 7.5
  },
  'claude-sonnet-4': {
    inputTokenPrice: 3,
    outputTokenPrice: 15
  },
  // ...
}
```

**添加新模型定价**:
```typescript
modelPricing['new-model'] = {
  inputTokenPrice: 10,
  outputTokenPrice: 30
}
```

---

### tokenCounter.ts - Token 计数
**用途**: 计算文本的 Token 数量

**主要函数**:
```typescript
export function countTokens(text: string, model: string): number
export function estimateTokens(messages: Message[]): number
export function truncateToTokenLimit(text: string, limit: number): string
```

**计数算法**:
- Claude: 使用 Anthropic 官方算法
- Codex: 使用 OpenAI tiktoken
- Gemini: 字符数 / 4（近似）

---

### translationMiddleware.ts - 翻译中间件
**用途**: 消息的自动翻译系统

**主要功能**:
1. **渐进式翻译**: 边生成边翻译
2. **双语显示**: 原文 + 译文
3. **翻译缓存**: 避免重复翻译
4. **内容提取**: 8 种提取策略

**主要函数**:
```typescript
export async function translateMessage(
  message: Message,
  targetLang: string
): Promise<Message>

export function extractTranslatableContent(
  content: string
): string[]

export function mergeTranslation(
  original: string,
  translation: string
): string  // 双语格式
```

**翻译流程**:
```
原始消息
  ↓
contentExtraction.ts (提取可翻译内容)
  ↓
调用翻译 API
  ↓
progressiveTranslation.ts (渐进式翻译)
  ↓
合并为双语文本
  ↓
返回翻译后消息
```

---

### stream/ - 流式处理核心

#### SessionConnection.ts
**用途**: 管理与后端的流式连接

**主要类**:
```typescript
class SessionConnection {
  connect(sessionId: string): Promise<void>
  sendMessage(prompt: string): AsyncGenerator<Chunk>
  disconnect(): void
  onChunk(handler: (chunk: Chunk) => void): void
  onError(handler: (error: Error) => void): void
}
```

#### SessionStore.ts
**用途**: 管理会话存储

**主要类**:
```typescript
class SessionStore {
  getSession(id: string): Session | null
  saveSession(session: Session): void
  deleteSession(id: string): void
  listSessions(): Session[]
  clearAll(): void
}
```

#### AsyncQueue.ts
**用途**: 异步队列管理

**主要类**:
```typescript
class AsyncQueue<T> {
  enqueue(item: T): void
  dequeue(): Promise<T>
  peek(): T | null
  isEmpty(): boolean
  clear(): void
}
```

---

### services/llmApiService.ts - LLM API 服务
**用途**: 统一的 LLM API 调用服务

**主要函数**:
```typescript
export async function callLLM(
  engine: 'claude' | 'codex' | 'gemini',
  prompt: string,
  options?: LLMOptions
): Promise<LLMResponse>

export async function streamLLM(
  engine: 'claude' | 'codex' | 'gemini',
  prompt: string
): AsyncGenerator<Chunk>
```

---

## 核心库功能

### 会话管理
- `sessionCost.ts` - 计算会话成本
- `sessionExport.ts` - 导出会话数据
- `sessionHelpers.ts` - 会话辅助函数

### 消息处理
- `messageUtils.ts` - 消息工具函数
- `contentExtraction.ts` - 内容提取
- `subagentGrouping.ts` - 子代理分组
- `tokenExtractor.ts` - Token 提取

### 提示优化
- `promptCache.ts` - 提示缓存
- `promptContextConfig.ts` - 上下文配置
- `promptEnhancementService.ts` - 提示增强

### 数据转换
- `codexConverter.ts` - Codex 数据转换
- `geminiConverter.ts` - Gemini 数据转换
- `hooksConverter.ts` - Hooks 数据转换

### 工具和实用函数
- `toolRegistry.ts` - 工具注册表
- `errorHandling.ts` - 错误处理
- `clipboard.ts` - 剪贴板操作
- `date-utils.ts` - 日期工具
- `utils.ts` - 通用工具函数

---

## 常见修改场景

### 场景 1: 添加新的 API 端点
**文件**: `api.ts`
**步骤**:
1. 定义函数和类型
2. 实现 HTTP 请求逻辑
3. 处理错误和响应

### 场景 2: 修改模型定价
**文件**: `pricing.ts`
**步骤**:
1. 找到 `modelPricing` 对象
2. 修改对应模型的价格
3. 或添加新模型定价

### 场景 3: 修改 Token 计数逻辑
**文件**: `tokenCounter.ts`
**步骤**:
1. 找到 `countTokens` 函数
2. 修改计数算法
3. 确保不同模型使用正确的算法

### 场景 4: 修改翻译逻辑
**文件**: `translationMiddleware.ts`
**步骤**:
1. 修改 `translateMessage` 函数
2. 或修改 `extractTranslatableContent` 提取策略
3. 或修改 `mergeTranslation` 合并格式

### 场景 5: 添加新的工具
**文件**: `toolRegistry.ts`
**步骤**:
1. 定义工具类型
2. 在 `toolRegistry` 中注册
3. 实现工具处理函数

---

## 工具函数示例

### messageUtils.ts
```typescript
// 格式化消息
export function formatMessage(message: Message): string

// 提取纯文本
export function extractText(message: Message): string

// 合并消息
export function mergeMessages(messages: Message[]): Message

// 分割长消息
export function splitLongMessage(message: Message, maxLength: number): Message[]
```

### errorHandling.ts
```typescript
// 统一错误处理
export function handleError(error: Error): ErrorResponse

// 重试机制
export async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number
): Promise<T>

// 超时控制
export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number
): Promise<T>
```

### clipboard.ts
```typescript
// 复制到剪贴板
export async function copyToClipboard(text: string): Promise<void>

// 从剪贴板读取
export async function readFromClipboard(): Promise<string>

// 复制图片
export async function copyImage(imageData: Blob): Promise<void>
```

---

## 服务架构

```
Frontend Components
  ↓
Hooks (业务逻辑)
  ↓
lib/ (工具和服务)
  ├─ api.ts → Backend API
  ├─ stream/ → WebSocket/SSE
  └─ services/llmApiService.ts → LLM APIs
```

---

## 开发规范

### 函数命名
- 动词开头（`getSession`, `createMessage`）
- 驼峰命名（camelCase）
- 描述性名称

### 类型定义
- 所有函数都有类型定义
- 使用 interface 而非 type
- 导出所有公共类型

### 错误处理
- 使用 try-catch
- 返回 `Result<T, Error>` 或抛出异常
- 记录错误日志

### 异步函数
- 所有异步函数返回 Promise
- 使用 async/await 而非 .then()
- 处理 Promise rejection

---

**最后更新**: 2025-12-27
**文件数**: 40+ 模块
