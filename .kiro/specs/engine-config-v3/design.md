# Design Document: Engine Config V3

## Overview

本设计文档描述 Fangyu Code 引擎配置面板的二次开发，包括更新模型测试列表、改进编辑体验、移除无用 UI 元素、以及提供四种引擎的一键安装功能。

## Architecture

### 组件层次结构

```
Settings.tsx
└── EngineConfigPanel/
    ├── EngineCardGrid.tsx          # 引擎选择卡片（新增安装按钮）
    ├── ProviderList.tsx            # 代理商列表（移除拖拽功能）
    │   └── ProviderItem.tsx        # 代理商项（改进编辑体验）
    │       └── InlineModelTester.tsx  # 模型测试（更新模型列表）
    ├── EngineInstaller.tsx         # 新增：引擎安装器组件
    └── TestedModelSelector.tsx     # 新增：已测试模型选择器
```

### 数据流

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  EngineConfig   │────▶│  Provider State  │────▶│  Claude Code    │
│    Service      │     │  (tested models) │     │  settings.json  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Engine Install │     │  Model Selection │
│    Service      │     │  (global apply)  │
└─────────────────┘     └──────────────────┘
```

## Components and Interfaces

### 1. InlineModelTester 更新

```typescript
// 更新后的 Claude 模型列表
const CLAUDE_MODELS = [
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5' },
    { 
        id: 'claude-opus-4-5-20251101', 
        name: 'Opus 4.5 Thinking',
        thinkingBudget: 31999,  // Extended thinking tokens
        isThinking: true
    },
];
```

### 2. ProviderItem 改进

```typescript
interface TestedModel {
    id: string;
    name: string;
    status: 'success' | 'replaced' | 'error';
    latency?: number;
}

interface ProviderItemProps {
    provider: UnifiedProviderConfig;
    testedModels?: TestedModel[];  // 新增：已测试的模型列表
    onModelSelect?: (modelId: string) => void;  // 新增：模型选择回调
    // ... 其他现有属性
}
```

### 3. EngineInstaller 组件

```typescript
interface EngineInstallerProps {
    engine: EngineType;
    onInstallComplete: () => void;
    onInstallError: (error: string) => void;
}

interface InstallationState {
    status: 'idle' | 'checking' | 'installing' | 'success' | 'error';
    progress: number;
    logs: string[];
    error?: string;
}

// 引擎安装配置
const ENGINE_INSTALL_CONFIG: Record<EngineType, EngineInstallInfo> = {
    claude: {
        name: 'Claude Code',
        command: 'npm install -g @anthropic-ai/claude-code',
        requiresNodejs: true,
        postInstall: 'API Key 配置',
        docsUrl: 'https://code.claude.com/docs/en/setup',
    },
    codex: {
        name: 'Codex CLI',
        command: 'npm install -g @openai/codex',
        requiresNodejs: true,
        postInstall: 'ChatGPT 登录',
        docsUrl: 'https://help.openai.com/en/articles/11096431',
    },
    gemini: {
        name: 'Gemini CLI',
        command: 'npm install -g @google/gemini-cli',
        requiresNodejs: true,
        postInstall: 'Google 账号登录',
        docsUrl: 'https://www.geminicli.net/en/blog/gemini-cli-npm-installation-guide',
    },
    siliconflow: {
        name: 'SiliconFlow',
        command: null,  // 无需安装 CLI
        requiresNodejs: false,
        postInstall: '获取 API Key',
        registrationUrl: 'https://cloud.siliconflow.cn/account/ak',
        docsUrl: 'https://docs.siliconflow.com/en/userguide/quickstart',
    },
};
```

### 4. TestedModelSelector 组件

```typescript
interface TestedModelSelectorProps {
    models: TestedModel[];
    selectedModel: string | null;
    onSelect: (modelId: string) => void;
}
```

### 5. 全局模型应用服务

```typescript
// engineConfigService.ts 新增方法
async function applyModelToClaudeCode(modelId: string): Promise<void> {
    // 1. 读取 Claude Code settings.json
    // 2. 更新 model 字段
    // 3. 保存配置
    // 4. 不影响其他引擎配置
}
```

## Data Models

### 扩展 UnifiedProviderConfig

```typescript
interface UnifiedProviderConfig {
    // ... 现有字段
    testedModels?: TestedModel[];  // 新增：已测试的模型列表
    lastTestedAt?: number;         // 新增：最后测试时间
}

interface TestedModel {
    id: string;
    name: string;
    status: 'success' | 'replaced' | 'error';
    actualModel?: string;
    latency?: number;
    testedAt: number;
}
```

### 引擎安装状态

```typescript
interface EngineInstallStatus {
    engine: EngineType;
    installed: boolean;
    version?: string;
    lastChecked: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Key Masking Preserves Boundaries

*For any* API key string with length > 12, the masked version SHALL show exactly the first 8 characters, followed by asterisks, followed by the last 4 characters.

**Validates: Requirements 2.1**

### Property 2: Model Selection Propagates to Claude Config

*For any* model selected from the tested models list, the Claude Code configuration SHALL be updated to use that model as the default.

**Validates: Requirements 2.5**

### Property 3: Engine Configuration Isolation

*For any* update to Claude engine configuration, the configurations of Codex, Gemini, and SiliconFlow engines SHALL remain unchanged.

**Validates: Requirements 2.6**

### Property 4: Install Button Visibility for Uninstalled Engines

*For any* engine that is not installed, the Engine_Config_Panel SHALL display an "Install" button for that engine.

**Validates: Requirements 4.1**

### Property 5: Node.js Version Validation

*For any* Node.js version string, the version parser SHALL correctly determine if the major version is >= 18.

**Validates: Requirements 4.8**

## Error Handling

### 安装错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| Node.js 未安装 | 显示下载链接和安装指引 |
| npm 权限不足 | 提示使用管理员权限或 sudo |
| 网络错误 | 提示检查网络连接，提供离线安装方案 |
| 包不存在 | 显示官方文档链接 |

### API Key 验证错误

| 错误类型 | 处理方式 |
|---------|---------|
| 无效 API Key | 显示错误信息，提供获取 Key 的链接 |
| 配额耗尽 | 显示配额信息，建议升级或等待 |
| 网络超时 | 重试机制，最多 3 次 |

## Testing Strategy

### 单元测试

1. **maskApiKey 函数测试**
   - 测试各种长度的 API Key
   - 边界情况：空字符串、短字符串

2. **版本解析测试**
   - 测试各种 Node.js 版本格式
   - 边界情况：无效版本字符串

3. **模型列表测试**
   - 验证 CLAUDE_MODELS 包含正确的模型
   - 验证不包含已移除的模型

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1**: API Key 掩码属性
2. **Property 3**: 引擎配置隔离属性
3. **Property 5**: 版本号解析属性

### 集成测试

1. **模型选择流程**
   - 测试模型 → 选择模型 → 验证全局应用

2. **安装流程**
   - 模拟安装命令执行
   - 验证状态更新和日志输出
