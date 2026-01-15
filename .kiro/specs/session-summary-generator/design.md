# Design Document: Session Summary Generator

## Overview

本设计文档描述 Fangyu Code 会话摘要生成器的技术架构和实现方案。该功能允许用户使用独立配置的 API 生成会话摘要，支持四大执行引擎（Claude/Codex/Gemini/SiliconFlow）的任意模型，并提供重构后的引擎选择器 UI。

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Session Summary Generator                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ SummaryButton   │───▶│ SummaryModal    │───▶│ SummaryAPI   │ │
│  │ (Toolbar)       │    │ (Dialog)        │    │ Service      │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                      │                      │        │
│           ▼                      ▼                      ▼        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ Token Monitor   │    │ EngineSelector  │    │ ConfigStore  │ │
│  │ Hook            │    │ (Redesigned)    │    │ (LocalStorage)│ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SummaryConfigStore

负责摘要 API 配置的存储和管理。

```typescript
interface SummaryAPIConfig {
  // 选择的引擎
  engine: 'claude' | 'codex' | 'gemini' | 'siliconflow';
  // 选择的模型
  model: string;
  // API 端点（可选，使用默认值）
  apiEndpoint?: string;
  // API Key（加密存储）
  apiKey?: string;
  // 自定义参数
  customParams?: {
    maxTokens?: number;
    temperature?: number;
    focusAreas?: string[];
  };
  // 最后更新时间
  updatedAt: number;
}

interface SummaryConfigStore {
  // 获取当前配置
  getConfig(): SummaryAPIConfig | null;
  // 保存配置
  saveConfig(config: SummaryAPIConfig): Promise<void>;
  // 重置为默认
  resetToDefaults(): Promise<void>;
  // 验证配置
  validateConfig(config: SummaryAPIConfig): ValidationResult;
}
```

### 2. SummaryGeneratorService

负责调用 API 生成摘要。

```typescript
interface SummaryGeneratorService {
  // 生成摘要
  generateSummary(
    messages: ClaudeStreamMessage[],
    config: SummaryAPIConfig,
    options?: GenerationOptions
  ): Promise<SummaryResult>;
  
  // 取消生成
  cancelGeneration(): void;
  
  // 获取生成进度
  getProgress(): GenerationProgress;
}

interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
  metadata: {
    tokensUsed: number;
    generationTime: number;
    model: string;
  };
}

interface GenerationOptions {
  maxLength?: number;
  focusAreas?: string[];
  includeCodeSnippets?: boolean;
}
```

### 3. EngineSelector (Redesigned)

重构后的引擎选择器组件。

```typescript
interface EngineSelectorProps {
  // 当前选择的引擎
  value: EngineConfig;
  // 变更回调
  onChange: (config: EngineConfig) => void;
  // 模式：主聊天 or 摘要生成
  mode: 'chat' | 'summary';
  // 是否显示配置入口
  showConfigEntry?: boolean;
  // 紧凑模式
  compact?: boolean;
}

interface EngineConfig {
  engine: 'claude' | 'codex' | 'gemini' | 'siliconflow';
  model: string;
  apiEndpoint?: string;
  apiKey?: string;
}

interface EngineInfo {
  id: string;
  name: string;
  icon: React.ComponentType;
  color: string;
  gradient?: string;
  available: boolean;
  version?: string;
  models: ModelInfo[];
  configUrl?: string;
}
```

### 4. SummaryModal

摘要生成对话框组件。

```typescript
interface SummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ClaudeStreamMessage[];
  sessionStats: SessionStats;
  onSummaryGenerated: (summary: string) => void;
  onOpenInNewSession: (summary: string) => void;
}

interface SessionStats {
  messageCount: number;
  tokenCount: number;
  tokenPercentage: number;
  estimatedCost: number;
}
```

## Data Models

### Storage Schema

```typescript
// localStorage key: 'fangyu-summary-api-config'
interface StoredSummaryConfig {
  version: number; // Schema version for migrations
  config: SummaryAPIConfig;
  encryptedApiKey?: string; // AES-256 encrypted
}

// 默认配置
const DEFAULT_SUMMARY_CONFIG: SummaryAPIConfig = {
  engine: 'claude',
  model: 'claude-3-haiku-20240307',
  customParams: {
    maxTokens: 4096,
    temperature: 0.3,
  },
  updatedAt: Date.now(),
};
```

### Engine Models Registry

```typescript
const ENGINE_MODELS: Record<string, ModelInfo[]> = {
  claude: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', costPer1k: 0.015 },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', costPer1k: 0.003 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', costPer1k: 0.00025 },
  ],
  codex: [
    { id: 'gpt-4o', name: 'GPT-4o', costPer1k: 0.005 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', costPer1k: 0.00015 },
    { id: 'o1-preview', name: 'o1 Preview', costPer1k: 0.015 },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', costPer1k: 0.00125 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', costPer1k: 0.000075 },
  ],
  siliconflow: [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', costPer1k: 0.001 },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', costPer1k: 0.0008 },
  ],
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Config Isolation

*For any* summary API configuration change, the main chat API configuration SHALL remain unchanged, and vice versa.

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 2: Engine-Model Selection Persistence

*For any* engine selection, the available models list SHALL contain only models valid for that engine, and the selected engine-model pair SHALL persist across app restarts.

**Validates: Requirements 3.2, 3.4**

### Property 3: Engine Selector State Management

*For any* engine click event, the selector SHALL immediately update to show the new engine as selected, and *for any* unavailable engine, it SHALL be displayed as disabled with correct reason.

**Validates: Requirements 4.2, 4.6**

### Property 4: Token Threshold Warning

*For any* session with token usage percentage P, the warning indicator SHALL be visible if and only if P >= 0.8 (80%).

**Validates: Requirements 5.2**

### Property 5: Session Statistics Accuracy

*For any* session, the displayed statistics (message count, token count, percentage) SHALL match the actual computed values from the message array.

**Validates: Requirements 5.3**

### Property 6: Configuration Persistence Round-Trip

*For any* valid SummaryAPIConfig object, saving then loading SHALL produce an equivalent configuration object.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Clipboard Copy Integrity

*For any* generated summary string, copying to clipboard then reading from clipboard SHALL return the identical string.

**Validates: Requirements 1.4**

### Property 8: API Fallback Behavior

*For any* summary generation request where summary config is empty or invalid, the system SHALL use the main chat API configuration.

**Validates: Requirements 2.6**

## Error Handling

### API Errors

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Network Error | "网络连接失败，请检查网络后重试" | Show retry button |
| Auth Error (401) | "API 密钥无效，请检查配置" | Link to config panel |
| Rate Limit (429) | "请求过于频繁，请稍后重试" | Show countdown timer |
| Server Error (5xx) | "服务暂时不可用，请稍后重试" | Show retry button |
| Timeout | "生成超时，请尝试减少会话长度" | Suggest truncation |

### Config Errors

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Corrupted Config | "配置文件损坏，已重置为默认设置" | Auto-reset, notify user |
| Missing API Key | "请先配置 API 密钥" | Link to config panel |
| Invalid Model | "所选模型不可用，已切换到默认模型" | Auto-fallback |

## Testing Strategy

### Unit Tests

- SummaryConfigStore: save/load/validate operations
- SummaryGeneratorService: API call formatting, error handling
- EngineSelector: state management, model filtering
- Token calculation accuracy

### Property-Based Tests

使用 fast-check 库进行属性测试：

1. **Config Isolation Test** - 生成随机配置变更，验证隔离性
2. **Engine-Model Persistence Test** - 生成随机引擎-模型组合，验证持久化
3. **Token Threshold Test** - 生成随机 token 百分比，验证警告显示
4. **Statistics Accuracy Test** - 生成随机消息数组，验证统计准确性
5. **Config Round-Trip Test** - 生成随机配置，验证保存-加载一致性
6. **Clipboard Integrity Test** - 生成随机摘要字符串，验证复制完整性

### Integration Tests

- 完整的摘要生成流程（mock API）
- 引擎切换和配置保存流程
- 新会话创建流程

## UI/UX Design

### Engine Selector Visual Design

```
┌─────────────────────────────────────────────────────┐
│  执行引擎                                            │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │  🟠      │  │  🟢      │  │  🔵      │  │  🟣      │
│  │ Claude   │  │ Codex    │  │ Gemini   │  │ Silicon  │
│  │ ✓ 已安装 │  │ ✓ 已安装 │  │ ✓ 已安装 │  │ ✓ 已配置 │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘
│                                                       │
│  当前模型: Claude 3 Haiku                             │
│  [配置 API ▶]                                        │
└─────────────────────────────────────────────────────┘
```

### Summary Modal Design

```
┌─────────────────────────────────────────────────────┐
│  生成会话摘要                                    [×] │
├─────────────────────────────────────────────────────┤
│                                                       │
│  📊 当前会话统计                                      │
│  ├─ 消息数量: 156 条                                 │
│  ├─ Token 使用: 45,230 / 200,000 (22.6%)            │
│  └─ 预估费用: $0.12                                  │
│                                                       │
│  ⚙️ 生成设置                                         │
│  ├─ 引擎: [Claude ▼]  模型: [Haiku ▼]               │
│  └─ [使用独立 API 配置 ⚙️]                           │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ [快速生成]  [高级选项 ▼]                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  📝 摘要预览                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ # 会话摘要                                      │ │
│  │                                                 │ │
│  │ ## 主题                                         │ │
│  │ 开发 Fangyu Code 会话摘要生成器功能...          │ │
│  │                                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [复制摘要 📋]  [在新会话中打开 ▶]                   │
└─────────────────────────────────────────────────────┘
```

## Implementation Notes

### API Key Encryption

使用 Web Crypto API 进行 AES-256-GCM 加密：

```typescript
async function encryptApiKey(apiKey: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(apiKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}
```

### Debounced Auto-Save

```typescript
const debouncedSave = useMemo(
  () => debounce((config: SummaryAPIConfig) => {
    saveConfig(config);
  }, 1000),
  []
);
```

### Engine Icon Components

使用 SVG 图标匹配官方品牌：

- Claude: 橙色渐变 (#FF6B35 → #FF8C42)
- Codex/OpenAI: 绿色 (#10A37F)
- Gemini: 蓝色渐变 (#4285F4 → #34A853 → #FBBC05 → #EA4335)
- SiliconFlow: 紫色渐变 (#7C3AED → #A855F7)
