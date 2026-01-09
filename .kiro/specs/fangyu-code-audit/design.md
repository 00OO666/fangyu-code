# Design Document: Fangyu Code v2.5.0 审计与改进

## Overview

本设计文档详细描述了 Fangyu Code v2.5.0 的问题修复和功能改进方案。基于需求文档中识别的 3 个问题和 7 项改进建议，本文档提供了具体的技术实现方案。

## Architecture

### 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Fangyu Code v2.5.0                      │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (React + TypeScript)                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ SessionWindow│ │ TabManager  │ │ Settings    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  Core Layer                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Hooks       │ │ Contexts    │ │ Services    │            │
│  │ - useTabs   │ │ - Session   │ │ - API       │            │
│  │ - usePrompt │ │ - Theme     │ │ - MCP       │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  Engine Layer                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Claude      │ │ Codex       │ │ Gemini      │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  Tauri Backend (Rust)                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Commands    │ │ MCP Server  │ │ File System │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 改进后架构

新增以下模块：
- **SecureStorage**: 安全存储 API 密钥
- **ErrorBoundary**: 增强的错误边界
- **VirtualList**: 虚拟滚动组件
- **RetryService**: 自动重试服务

## Components and Interfaces

### 1. SessionWindow 事件清理增强

```typescript
// src/pages/SessionWindow.tsx
interface EventCleanup {
  unlistenFunctions: Array<() => void>;
  cleanup: () => Promise<void>;
}

// 使用 useEffect 统一管理所有 Tauri 事件监听
const useEventCleanup = (): EventCleanup => {
  const unlistenFunctions = useRef<Array<() => void>>([]);
  
  const registerListener = async (
    event: string, 
    handler: (event: any) => void
  ) => {
    const unlisten = await window.listen(event, handler);
    unlistenFunctions.current.push(unlisten);
    return unlisten;
  };
  
  const cleanup = async () => {
    for (const unlisten of unlistenFunctions.current) {
      unlisten();
    }
    unlistenFunctions.current = [];
  };
  
  return { unlistenFunctions: unlistenFunctions.current, cleanup };
};
```

### 2. SandboxManager 完整实现

```typescript
// src/core/sandbox/SandboxManager.ts
interface SandboxConfig {
  image: string;
  memory: string;
  cpus: number;
  timeout: number;
}

interface SandboxInstance {
  id: string;
  containerId: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: Date;
}

class SandboxManager {
  private instances: Map<string, SandboxInstance> = new Map();
  
  async create(config: SandboxConfig): Promise<SandboxInstance>;
  async execute(sandboxId: string, command: string): Promise<string>;
  async destroy(sandboxId: string): Promise<void>;
  async destroyAll(): Promise<void>;
}
```

### 3. SecureStorage 接口

```typescript
// src/lib/secureStorage.ts
interface SecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// 使用 Tauri 的安全存储 API
const secureStorage: SecureStorage = {
  async setItem(key, value) {
    await invoke('secure_store_set', { key, value });
  },
  async getItem(key) {
    return await invoke('secure_store_get', { key });
  },
  // ...
};
```

### 4. RetryService 接口

```typescript
// src/lib/services/retryService.ts
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<RetryResult<T>>;
```

### 5. VirtualList 组件

```typescript
// src/components/common/VirtualList.tsx
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

const VirtualList = <T,>({ 
  items, 
  itemHeight, 
  renderItem, 
  overscan = 5 
}: VirtualListProps<T>) => {
  // 只渲染可见区域的项目
};
```

## Data Models

### API Key 安全存储模型

```typescript
interface SecureAPIKey {
  id: string;
  provider: 'claude' | 'openai' | 'gemini' | 'siliconflow';
  keyHash: string;  // 用于显示的哈希值
  createdAt: Date;
  lastUsedAt: Date;
  isValid: boolean;
}

interface APIKeyValidation {
  isValid: boolean;
  format: 'claude' | 'openai' | 'gemini' | 'unknown';
  errors: string[];
}
```

### Feature Flag 模型

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  phase: 1 | 2 | 3;
  dependencies?: string[];
}

const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  CONTEXT_WINDOW_PRUNING: {
    id: 'context-window-pruning',
    name: 'Context Window Pruning',
    description: '自动修剪上下文窗口以优化 Token 使用',
    enabled: false,
    phase: 2,
  },
  VIRTUAL_SCROLLING: {
    id: 'virtual-scrolling',
    name: 'Virtual Scrolling',
    description: '使用虚拟滚动优化大量消息的渲染性能',
    enabled: false,
    phase: 2,
  },
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 组件卸载清理完整性

*For any* SessionWindow 组件实例，当组件卸载时，所有通过 `window.listen` 注册的事件监听器都应该被正确清理，且清理后的监听器数量应该为零。

**Validates: Requirements 1.1, 1.2**

### Property 2: Sandbox 资源配对

*For any* 通过 SandboxManager 创建的沙箱实例，调用 `destroy` 后，该沙箱的所有 Docker 资源（容器、网络、卷）都应该被释放，且 `instances` Map 中不应该再包含该沙箱。

**Validates: Requirements 2.3**

### Property 3: 错误消息用户友好性

*For any* API 调用失败，系统返回的错误消息应该包含：(1) 用户可理解的描述，(2) 建议的解决方案，(3) 不包含技术堆栈信息。

**Validates: Requirements 2.1**

### Property 4: 指数退避重试

*For any* 网络错误触发的重试序列，第 N 次重试的延迟应该等于 `min(baseDelay * backoffMultiplier^(N-1), maxDelay)`。

**Validates: Requirements 2.2**

### Property 5: 进度指示器一致性

*For any* 耗时超过 500ms 的操作，系统应该显示进度指示器，且操作完成后指示器应该被移除。

**Validates: Requirements 6.2**

### Property 6: 输入验证反馈

*For any* 用户输入的无效数据，系统应该在 100ms 内提供内联验证反馈，且反馈消息应该明确指出错误原因。

**Validates: Requirements 6.3**

### Property 7: API 密钥安全存储

*For any* 保存的 API 密钥，(1) 不应该存储在 localStorage 中，(2) 在 UI 中默认应该被遮罩显示，(3) 保存前应该通过格式验证。

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 8: API 密钥格式验证

*For any* API 密钥输入，系统应该根据提供商类型验证格式：
- Claude: 以 `sk-ant-` 开头
- OpenAI: 以 `sk-` 开头
- Gemini: 以 `AI` 开头
- SiliconFlow: 以 `sf-` 开头

**Validates: Requirements 7.3**

## Error Handling

### 错误分类

| 错误类型 | 处理策略 | 用户提示 |
|---------|---------|---------|
| 网络错误 | 自动重试 + 指数退避 | "网络连接不稳定，正在重试..." |
| API 认证错误 | 提示检查密钥 | "API 密钥无效，请检查配置" |
| 速率限制 | 等待后重试 | "请求过于频繁，稍后重试" |
| 服务器错误 | 记录日志 + 通知 | "服务暂时不可用，请稍后再试" |
| 本地错误 | 显示详情 + 恢复选项 | "发生错误：[描述]，点击重试" |

### 错误恢复流程

```
错误发生
    │
    ▼
┌─────────────────┐
│ 分类错误类型     │
└─────────────────┘
    │
    ├─── 可重试 ──────► 自动重试（最多 3 次）
    │                      │
    │                      ├─── 成功 ──► 继续
    │                      │
    │                      └─── 失败 ──► 显示错误 + 手动重试选项
    │
    └─── 不可重试 ────► 显示错误 + 建议操作
```

## Testing Strategy

### 测试类型分布

| 测试类型 | 覆盖范围 | 工具 |
|---------|---------|------|
| 单元测试 | 核心函数、工具函数 | Vitest |
| 属性测试 | 正确性属性验证 | fast-check |
| 集成测试 | 组件交互、Hook 组合 | Vitest + React Testing Library |
| E2E 测试 | 完整用户流程 | Playwright |

### 属性测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 属性测试配置
    testTimeout: 30000, // 属性测试可能需要更长时间
  },
});

// 属性测试示例
import { fc } from 'fast-check';

describe('API Key Validation', () => {
  // Feature: fangyu-code-audit, Property 8: API 密钥格式验证
  it('should validate Claude API key format', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (key) => {
          const result = validateAPIKey(key, 'claude');
          if (key.startsWith('sk-ant-')) {
            return result.isValid === true;
          }
          return result.isValid === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 单元测试重点

- **useEventCleanup**: 验证监听器注册和清理
- **RetryService**: 验证重试逻辑和延迟计算
- **SecureStorage**: 验证存储和检索（使用 mock）
- **validateAPIKey**: 验证各提供商的密钥格式

### 集成测试重点

- SessionWindow 组件生命周期
- 多引擎切换流程
- 错误处理和恢复流程

### E2E 测试重点

- 完整的会话创建和对话流程
- API 密钥配置流程
- 标签页管理流程
