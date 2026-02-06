# Fangyu Code 架构文档

> 版本: v2.5.0 | 更新日期: 2026-01-09

## 概述

Fangyu Code 是一个基于 Tauri 2.x 的跨平台 AI 编程助手，采用 React + TypeScript 前端和 Rust 后端的混合架构。

## 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Fangyu Code v2.5.0                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      React 前端层                            │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │   UI 组件    │  │   Hooks      │  │   Contexts   │       │   │
│  │  │              │  │              │  │              │       │   │
│  │  │ • Session    │  │ • useTabs    │  │ • Session    │       │   │
│  │  │ • Message    │  │ • usePrompt  │  │ • Project    │       │   │
│  │  │ • Canvas     │  │ • useEvent   │  │ • Theme      │       │   │
│  │  │ • Settings   │  │ • useValidate│  │ • Settings   │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │                    Core 核心层                        │   │   │
│  │  │                                                       │   │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │   │
│  │  │  │ Agents  │  │   API   │  │  Tools  │  │Workflow │  │   │   │
│  │  │  │         │  │         │  │         │  │         │  │   │   │
│  │  │  │ Claude  │  │ Config  │  │ File    │  │ Spec    │  │   │   │
│  │  │  │ OpenAI  │  │ Manager │  │ Search  │  │ Execute │  │   │   │
│  │  │  │ Gemini  │  │         │  │ Shell   │  │         │  │   │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │                   Services 服务层                     │   │   │
│  │  │                                                       │   │   │
│  │  │  • RetryService      - 自动重试与指数退避             │   │   │
│  │  │  • SecureStorage     - API 密钥安全存储               │   │   │
│  │  │  • MessageOptimizer  - Token 优化与上下文压缩         │   │   │
│  │  │  • UserFriendlyError - 用户友好错误消息               │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                         Tauri IPC 桥接                              │
│                                │                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Rust 后端层                             │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │   Commands   │  │   Storage    │  │   Services   │       │   │
│  │  │              │  │              │  │              │       │   │
│  │  │ • Claude CLI │  │ • SQLite     │  │ • Auto Update│       │   │
│  │  │ • Docker     │  │ • Keyring    │  │ • MCP Server │       │   │
│  │  │ • File Ops   │  │ • Config     │  │ • Translate  │       │   │
│  │  │ • Smart Sess │  │              │  │              │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  ┌───────────┐          ┌───────────┐          ┌───────────┐
  │Claude Code│          │  OpenAI   │          │  Google   │
  │    CLI    │          │  Codex    │          │  Gemini   │
  └───────────┘          └───────────┘          └───────────┘
```

## 目录结构

```
fangyu-code/
├── src/                          # React 前端源码
│   ├── components/               # UI 组件 (70+)
│   │   ├── canvas/              # Canvas 预览组件
│   │   ├── common/              # 通用组件
│   │   │   ├── VirtualList.tsx  # 虚拟滚动组件
│   │   │   ├── ProgressIndicator.tsx
│   │   │   └── ValidationFeedback.tsx
│   │   ├── message/             # 消息相关组件
│   │   ├── session/             # 会话相关组件
│   │   └── settings/            # 设置面板组件
│   ├── contexts/                # React Context
│   │   ├── SessionContext.tsx
│   │   ├── ProjectContext.tsx
│   │   └── ThemeContext.tsx
│   ├── core/                    # 核心引擎
│   │   ├── agents/              # AI Agent 实现
│   │   ├── api/                 # API 配置管理
│   │   ├── sandbox/             # Sandbox 管理
│   │   ├── tools/               # 工具实现
│   │   └── workflow/            # 工作流引擎
│   ├── hooks/                   # React Hooks (60+)
│   │   ├── useEventCleanup.ts   # 事件清理 Hook
│   │   ├── useProgressIndicator.ts
│   │   ├── useValidation.ts
│   │   └── ...
│   ├── lib/                     # 工具库
│   │   ├── api.ts               # API 调用
│   │   ├── secureStorage.ts     # 安全存储
│   │   ├── apiKeyValidator.ts   # API 密钥验证
│   │   ├── userFriendlyErrors.ts
│   │   └── services/
│   │       └── retryService.ts  # 重试服务
│   ├── services/                # 业务服务
│   │   └── messageContextOptimizer.ts
│   └── types/                   # TypeScript 类型
│
├── src-tauri/                   # Rust 后端源码
│   ├── src/
│   │   ├── commands/            # Tauri 命令
│   │   │   ├── claude/          # Claude CLI 集成
│   │   │   ├── docker.rs        # Docker 命令
│   │   │   ├── secure_storage.rs
│   │   │   ├── smart_session.rs
│   │   │   └── auto_update.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/                        # 文档
├── .fangyu/                     # 项目配置
│   ├── specs/                   # 功能规格
│   ├── steering/                # Steering 文件
│   └── hooks/                   # Agent Hooks
└── tests/                       # 测试文件
```

## 核心模块说明

### 1. 事件管理 (useEventCleanup)

统一管理 Tauri 事件监听器，防止内存泄漏：

```typescript
const { registerListener, cleanup } = useEventCleanup();

// 注册监听器
registerListener('event-name', (payload) => {
  // 处理事件
});

// 组件卸载时自动清理
```

### 2. 安全存储 (SecureStorage)

使用系统 Keyring 安全存储 API 密钥：

```typescript
import { secureStorage } from '@/lib/secureStorage';

// 存储 API 密钥
await secureStorage.setItem('openai', apiKey);

// 获取 API 密钥
const key = await secureStorage.getItem('openai');
```

### 3. 重试服务 (RetryService)

支持指数退避的自动重试：

```typescript
import { withRetry } from '@/lib/services/retryService';

const result = await withRetry(
  () => fetchData(),
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
);
```

### 4. 虚拟滚动 (VirtualList)

高性能虚拟滚动组件：

```typescript
<VirtualList
  items={messages}
  renderItem={(item) => <MessageItem message={item} />}
  getItemKey={(item) => item.id}
  estimatedItemHeight={50}
  height={600}
  overscan={3}
/>
```

### 5. Sandbox 管理 (SandboxManager)

Docker 容器沙箱管理：

```typescript
const sandbox = await SandboxManager.create({
  image: 'node:18',
  memory: '512m',
  timeout: 30000,
});

const result = await sandbox.execute('npm test');
await sandbox.destroy();
```

## Feature Flags

通过 Feature Flags 控制功能启用：

```typescript
import { isFeatureEnabled, FeatureFlag } from '@/config/featureFlags';

if (isFeatureEnabled(FeatureFlag.VIRTUAL_SCROLLING)) {
  // 使用虚拟滚动
}
```

当前 Phase 2 标志：
- `CONTEXT_WINDOW_PRUNING` - 上下文窗口裁剪
- `VIRTUAL_SCROLLING` - 虚拟滚动优化

## 测试策略

### 单元测试
- 使用 Vitest 框架
- 文件命名: `*.test.ts`

### 属性测试
- 使用 fast-check 库
- 文件命名: `*.property.test.ts`
- 验证通用正确性属性

```bash
# 运行所有测试
npm run test

# 运行属性测试
npm run test:property
```

## 构建与部署

```bash
# 开发模式
npm run tauri dev

# 快速构建（调试版）
npm run build && npm run tauri:build-fast

# 生产构建
npm run tauri build

# 发布版本
git tag -a v2.x.x -m "Release v2.x.x"
git push origin main && git push origin v2.x.x
```

## 相关文档

- [API 配置指南](./API_CONFIG_GUIDE.md)
- [v2.5.0 使用指南](./v2.5.0-使用指南.md)
- [Token 优化说明](./TOKEN_OPTIMIZATION_PHASE1.md)
- [监控集成指南](./MONITORING_INTEGRATION_STATUS.md)
