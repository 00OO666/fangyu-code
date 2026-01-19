# Design Document: Engine One-Click Setup

## Overview

本设计文档描述 Fangyu Code 引擎配置面板的"一键配置"功能，让用户能够通过向导式界面完成引擎的完整配置，包括依赖检测、CLI 安装、API 配置和环境设置。

## Architecture

### 组件层次结构

```
Settings.tsx
└── EngineConfigPanel/
    ├── EngineCardGrid.tsx          # 引擎选择卡片（新增一键配置按钮）
    │   └── EngineCard.tsx          # 单个引擎卡片（显示配置状态）
    ├── OneClickSetup/              # 新增：一键配置模块
    │   ├── SetupWizard.tsx         # 配置向导主组件
    │   ├── DependencyChecker.tsx   # 依赖检查器
    │   ├── StepIndicator.tsx       # 步骤指示器
    │   ├── ClaudeSetup.tsx         # Claude 配置流程
    │   ├── CodexSetup.tsx          # Codex 配置流程
    │   ├── GeminiSetup.tsx         # Gemini 配置流程
    │   └── SiliconFlowSetup.tsx    # SiliconFlow 配置流程
    └── EngineInstaller.tsx         # 现有：引擎安装器（复用）
```

### 数据流

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  SetupWizard    │────▶│  Setup State     │────▶│  Engine Config  │
│  (UI Layer)     │     │  (Progress)      │     │  (Persistence)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Dependency     │     │  Installation    │     │  API Config     │
│  Checker        │     │  Service         │     │  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Components and Interfaces

### 1. SetupWizard 主组件

```typescript
interface SetupWizardProps {
    engine: EngineType;
    onComplete: () => void;
    onCancel: () => void;
}

interface SetupStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped';
    optional?: boolean;
}

interface SetupState {
    engine: EngineType;
    currentStep: number;
    steps: SetupStep[];
    logs: string[];
    error?: string;
}
```

### 2. DependencyChecker 组件

```typescript
interface DependencyStatus {
    nodejs: {
        installed: boolean;
        version?: string;
        meetsRequirement: boolean;  // >= 18
    };
    npm: {
        installed: boolean;
        version?: string;
    };
    cli: {
        installed: boolean;
        version?: string;
        path?: string;
    };
}

interface DependencyCheckerProps {
    engine: EngineType;
    onCheckComplete: (status: DependencyStatus) => void;
}
```

### 3. 引擎特定配置组件

```typescript
// Claude 配置
interface ClaudeSetupProps {
    dependencyStatus: DependencyStatus;
    existingProviders: UnifiedProviderConfig[];
    onStepComplete: (step: string) => void;
    onComplete: (config: ClaudeConfig) => void;
}

interface ClaudeConfig {
    apiKeySource: 'direct' | 'provider';
    apiKey?: string;
    providerId?: string;
    defaultModel?: string;
}

// Codex 配置
interface CodexSetupProps {
    dependencyStatus: DependencyStatus;
    onStepComplete: (step: string) => void;
    onComplete: () => void;
}

// Gemini 配置
interface GeminiSetupProps {
    dependencyStatus: DependencyStatus;
    onStepComplete: (step: string) => void;
    onComplete: () => void;
}

// SiliconFlow 配置
interface SiliconFlowSetupProps {
    onStepComplete: (step: string) => void;
    onComplete: (config: SiliconFlowConfig) => void;
}

interface SiliconFlowConfig {
    apiKey: string;
    defaultModel: string;
}
```

### 4. 配置状态服务

```typescript
// setupStateService.ts
interface EngineSetupProgress {
    engine: EngineType;
    status: 'not_started' | 'in_progress' | 'completed';
    currentStep: number;
    completedSteps: string[];
    lastUpdated: number;
}

// 保存配置进度
async function saveSetupProgress(progress: EngineSetupProgress): Promise<void>;

// 获取配置进度
async function getSetupProgress(engine: EngineType): Promise<EngineSetupProgress | null>;

// 重置配置进度
async function resetSetupProgress(engine: EngineType): Promise<void>;

// 获取引擎配置状态
async function getEngineConfigStatus(engine: EngineType): Promise<ConfigStatus>;

interface ConfigStatus {
    isFullyConfigured: boolean;
    incompleteSteps: string[];
    lastConfigured?: number;
}
```

## Data Models

### 引擎配置步骤定义

```typescript
const ENGINE_SETUP_STEPS: Record<EngineType, SetupStep[]> = {
    claude: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Claude Code CLI' },
        { id: 'config_api', title: '配置 API', description: '设置 API Key 或选择代理商' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
        { id: 'select_model', title: '选择模型', description: '设置默认模型', optional: true },
    ],
    codex: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Codex CLI' },
        { id: 'login', title: '登录账号', description: '使用 ChatGPT 账号登录' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
    ],
    gemini: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Gemini CLI' },
        { id: 'login', title: '登录账号', description: '使用 Google 账号登录' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
    ],
    siliconflow: [
        { id: 'register', title: '注册账号', description: '打开 SiliconFlow 注册页面', optional: true },
        { id: 'get_api_key', title: '获取 API Key', description: '从控制台获取 API Key' },
        { id: 'verify', title: '验证连接', description: '测试 API 连接' },
        { id: 'select_model', title: '选择模型', description: '设置默认模型' },
    ],
};
```

### 配置存储结构

```typescript
// 存储在 SQLite 数据库中
interface EngineSetupRecord {
    engine: string;           // 引擎类型
    status: string;           // 配置状态
    current_step: number;     // 当前步骤
    completed_steps: string;  // JSON 数组
    config_data: string;      // JSON 配置数据
    updated_at: number;       // 更新时间
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Status Display Consistency

*For any* engine and its configuration state, the displayed status (未配置/配置中/已配置) SHALL accurately reflect the actual configuration completeness.

**Validates: Requirements 1.1, 1.3, 1.4, 7.3**

### Property 2: Node.js Version Validation

*For any* Node.js version string, the version parser SHALL correctly determine if the major version is >= 18.

**Validates: Requirements 2.3**

(Note: This property is already implemented in engine-config-v3, will be reused)

### Property 3: Configuration State Persistence Round-Trip

*For any* setup progress state, saving and then loading the state SHALL produce an equivalent state object.

**Validates: Requirements 7.1, 7.2**

### Property 4: Engine Configuration Isolation

*For any* configuration update to one engine, the configurations of all other engines SHALL remain unchanged.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 5: Step Completion Ordering

*For any* setup wizard execution, completed steps SHALL always be a prefix of the total steps (no gaps in completion).

**Validates: Requirements 3.1, 4.1, 5.1, 6.1**

## Error Handling

### 依赖检测错误

| 错误类型 | 处理方式 |
|---------|---------|
| Node.js 未安装 | 显示下载链接 (nodejs.org)，提供安装指引 |
| Node.js 版本过低 | 显示当前版本，建议升级到 18+ |
| npm 未安装 | 提示重新安装 Node.js（npm 随 Node.js 安装） |
| CLI 安装失败 | 显示错误日志，提供手动安装命令 |

### 认证错误

| 错误类型 | 处理方式 |
|---------|---------|
| API Key 无效 | 显示错误信息，提供获取 Key 的链接 |
| 登录超时 | 提供重试按钮，显示手动登录命令 |
| 网络错误 | 显示网络诊断建议，提供重试选项 |

### 恢复策略

1. **自动重试**: 网络错误自动重试 3 次，间隔 2 秒
2. **手动重试**: 提供"重试"按钮
3. **跳过步骤**: 可选步骤提供"跳过"选项
4. **重置配置**: 提供"重新开始"选项

## Testing Strategy

### 单元测试

1. **版本解析测试** (复用 engine-config-v3)
   - 测试各种 Node.js 版本格式
   - 边界情况：无效版本字符串

2. **配置状态计算测试**
   - 测试各种步骤完成组合
   - 验证状态显示正确

3. **步骤顺序验证测试**
   - 测试步骤完成顺序约束
   - 验证不能跳过必要步骤

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1**: 配置状态显示一致性
2. **Property 3**: 配置状态持久化往返
3. **Property 4**: 引擎配置隔离
4. **Property 5**: 步骤完成顺序

### 集成测试

1. **完整配置流程测试**
   - 模拟从头到尾的配置流程
   - 验证每个步骤的状态更新

2. **断点续配测试**
   - 模拟中断后恢复
   - 验证进度正确恢复

3. **错误恢复测试**
   - 模拟各种错误场景
   - 验证错误处理和恢复

