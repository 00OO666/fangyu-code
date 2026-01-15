# Design Document: Settings Page Refactor

## Overview

重构设置页面，将分散的配置项按执行引擎分类组织。采用两级标签页结构：顶层为功能分类（常规、引擎配置、翻译等），引擎配置内部为各引擎的子标签页。每个引擎的配置使用可折叠区域组织代理商、环境变量、权限等设置。

## Architecture

```
Settings Page
├── Header (返回按钮 + 标题 + 保存按钮)
├── Main Tabs (7个主标签)
│   ├── 常规 (General)
│   ├── 引擎配置 (Engines) ← 新增
│   │   ├── Claude Code (orange)
│   │   │   ├── [折叠] 代理商/API配置
│   │   │   ├── [折叠] 环境变量
│   │   │   └── [折叠] 权限规则
│   │   ├── OpenAI Codex (green)
│   │   ├── Gemini (blue)
│   │   └── SiliconFlow (purple)
│   ├── 翻译 (Translation)
│   ├── 提示词API (Prompt API)
│   ├── 存储 (Storage)
│   ├── Super Agent
│   └── 配置管理 (Config)
└── Dialogs (确认对话框等)
```

## Components and Interfaces

### 1. Settings 组件（主组件）

```typescript
interface SettingsProps {
  className?: string;
  initialTab?: string;
  onBack?: () => void;
}

// 状态管理
const [activeTab, setActiveTab] = useState(initialTab || "general");
const [providerSubTab, setProviderSubTab] = useState("claude");
```

### 2. 引擎配置标签页结构

```typescript
// 引擎配置常量
const ENGINE_CONFIGS = {
  claude: {
    name: "Claude Code",
    color: "orange",
    colorClass: "bg-orange-500",
    borderClass: "border-orange-500/20",
    bgClass: "bg-orange-500/5"
  },
  codex: {
    name: "OpenAI Codex", 
    color: "green",
    colorClass: "bg-green-500",
    borderClass: "border-green-500/20",
    bgClass: "bg-green-500/5"
  },
  gemini: {
    name: "Gemini",
    color: "blue", 
    colorClass: "bg-blue-500",
    borderClass: "border-blue-500/20",
    bgClass: "bg-blue-500/5"
  },
  siliconflow: {
    name: "SiliconFlow",
    color: "purple",
    colorClass: "bg-purple-500",
    borderClass: "border-purple-500/20",
    bgClass: "bg-purple-500/5"
  }
} as const;
```

### 3. 可折叠配置区域

使用原生 HTML `<details>` 和 `<summary>` 元素实现折叠：

```tsx
<details className="group" open>
  <summary className="cursor-pointer text-sm font-medium">
    <span className="group-open:rotate-90 transition-transform">▶</span>
    代理商 / API 配置
  </summary>
  <div className="mt-4 pl-4 border-l-2">
    <ProviderManager />
  </div>
</details>
```

## Data Models

### 现有数据模型（保持不变）

```typescript
interface PermissionRule {
  id: string;
  value: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  // ... 其他设置
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tab Navigation Consistency

*For any* tab selection action, the displayed content SHALL match the selected tab identifier.

**Validates: Requirements 1.2, 4.2**

### Property 2: Engine Color Consistency

*For any* engine type displayed in the UI, the color indicator SHALL be consistent across all occurrences (tab indicator, section header, border).

**Validates: Requirements 1.3, 6.1, 6.2**

### Property 3: Settings Persistence

*For any* settings modification followed by a save action, reloading the settings SHALL return the same values that were saved.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Collapsible State Independence

*For any* collapsible section, expanding or collapsing it SHALL NOT affect the state of other collapsible sections.

**Validates: Requirements 5.1, 5.2**

## Error Handling

1. **设置加载失败**: 显示错误提示，使用空对象作为默认值
2. **设置保存失败**: 显示错误通知，保留当前编辑状态
3. **执行配置加载失败**: 静默处理，使用默认值继续

## Testing Strategy

### Unit Tests
- 测试标签页切换逻辑
- 测试折叠区域展开/收起状态
- 测试设置保存和加载

### Property Tests
- 验证标签导航一致性
- 验证引擎颜色一致性
- 验证设置持久化

### Integration Tests
- 测试完整的设置保存流程
- 测试引擎配置子标签切换
