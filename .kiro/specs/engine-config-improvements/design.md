# Design Document - 引擎配置系统全面重构

## 1. 架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Engine Configuration System                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  EngineCards    │  │ ProviderManager │  │ AdvancedSettings│  │
│  │  (选择入口)      │  │  (代理商管理)    │  │  (高级设置)      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│  ┌─────────────────────────────┴─────────────────────────────┐  │
│  │                    useEngineConfig Hook                    │  │
│  │  (统一状态管理 - 替代 useProviderConfig + useEngineStatus) │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────┴─────────────────────────────┐  │
│  │                    EngineConfigService                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │ Storage  │  │ Crypto   │  │ Migrator │  │ Tester   │   │  │
│  │  │ Manager  │  │ Service  │  │ Service  │  │ Service  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **单一入口**: 一个引擎卡片视图，点击即切换
2. **统一体验**: 所有引擎使用相同的代理商管理界面
3. **安全优先**: API Key 加密存储，导出需确认
4. **响应式设计**: 移动优先，支持暗黑模式
5. **可访问性**: 完整的 ARIA 标签和键盘导航


## 2. 组件结构设计

### 2.1 组件层次

```
Settings.tsx
└── EngineConfigPanel (新组件，替代现有分散的引擎配置)
    ├── EngineCardGrid (引擎选择卡片网格)
    │   └── EngineCard × 4 (Claude/Codex/Gemini/SiliconFlow)
    │       ├── EngineIcon
    │       ├── EngineStatus (安装状态/版本/当前代理商)
    │       └── ActiveIndicator
    │
    ├── ProviderPanel (当前引擎的代理商管理)
    │   ├── ProviderHeader (标题 + 添加按钮)
    │   ├── ProviderList (可拖拽排序)
    │   │   └── ProviderItem × N
    │   │       ├── ProviderInfo (名称/状态/最后使用)
    │   │       ├── ActiveBadge
    │   │       └── ActionButtons (编辑/测试/删除)
    │   ├── ProviderForm (内联表单，非模态)
    │   │   ├── DynamicFields (根据引擎类型动态渲染)
    │   │   ├── ApiKeyInput (带加密/显示切换)
    │   │   └── FormActions (保存/取消/测试)
    │   └── EmptyState (快速开始引导)
    │       └── PresetProviders (预设代理商)
    │
    ├── AdvancedSettingsPanel (高级设置，可折叠)
    │   ├── EnvironmentVariables
    │   ├── PermissionSettings
    │   └── RuntimeModeSelector
    │
    └── ConfigActions (配置操作)
        ├── ImportButton
        ├── ExportButton
        └── RefreshButton
```

### 2.2 EngineCard 组件设计

```tsx
interface EngineCardProps {
  engine: EngineType;
  status: EngineStatusInfo;
  isActive: boolean;
  onClick: () => void;
}
```

**视觉规格**:
- 尺寸: 180px × 120px (桌面) / 100% × 100px (移动)
- 圆角: 12px
- 阴影: `0 2px 8px rgba(0,0,0,0.1)` (默认) / `0 4px 16px rgba(0,0,0,0.15)` (hover)
- 边框: 2px solid transparent (默认) / 2px solid var(--primary) (激活)
- 过渡: all 0.2s ease

**状态显示**:
| 状态 | 图标 | 颜色 | 文字 |
|------|------|------|------|
| 已安装+已连接 | CheckCircle | green-500 | "已连接" |
| 已安装+未配置 | AlertCircle | yellow-500 | "未配置" |
| 未安装 | Download | gray-400 | "未安装" |
| 错误 | XCircle | red-500 | 错误信息 |


### 2.3 ProviderList 组件设计

```tsx
interface ProviderListProps {
  providers: UnifiedProviderConfig[];
  activeProviderId: string | null;
  onSelect: (id: string) => void;
  onReorder: (providers: UnifiedProviderConfig[]) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}
```

**拖拽排序**:
- 使用 `@dnd-kit/core` 实现
- 拖拽手柄: 左侧 GripVertical 图标
- 拖拽时显示半透明预览
- 放置时有动画过渡

**列表项布局**:
```
┌─────────────────────────────────────────────────────────┐
│ ⋮⋮  [图标] 代理商名称          [Active]  [⚡] [✏️] [🗑️] │
│      状态: 已连接 · 最后使用: 2小时前                    │
└─────────────────────────────────────────────────────────┘
```

### 2.4 ProviderForm 组件设计

```tsx
interface ProviderFormProps {
  engine: EngineType;
  provider?: UnifiedProviderConfig; // 编辑时传入
  onSave: (config: UnifiedProviderConfig) => void;
  onCancel: () => void;
  onTest: (config: Partial<UnifiedProviderConfig>) => Promise<TestResult>;
}
```

**动态字段配置**:
```typescript
const FORM_FIELDS: Record<EngineType, FormFieldConfig[]> = {
  claude: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.anthropic.com' },
    { name: 'apiKey', label: 'API Key', type: 'secret', required: true },
    { name: 'model', label: '模型', type: 'select', options: CLAUDE_MODELS },
  ],
  codex: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.openai.com/v1' },
    { name: 'apiKey', label: 'API Key', type: 'secret', required: true },
    { name: 'model', label: '模型', type: 'select', options: CODEX_MODELS },
  ],
  gemini: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'baseUrl', label: 'API 端点', type: 'url', required: false },
    { name: 'apiKey', label: 'API Key', type: 'secret', required: true },
    { name: 'model', label: '模型', type: 'select', options: GEMINI_MODELS },
  ],
  siliconflow: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'baseUrl', label: 'API 端点', type: 'url', required: true, placeholder: 'https://api.siliconflow.cn/v1' },
    { name: 'apiKey', label: 'API Key', type: 'secret', required: true },
    { name: 'model', label: '模型', type: 'text', required: true },
  ],
};
```


### 2.5 ApiKeyInput 组件设计

```tsx
interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onPaste: () => void;
  error?: string;
  disabled?: boolean;
}
```

**功能特性**:
- 默认显示掩码: `sk-****...****1234`
- 眼睛图标切换显示/隐藏
- 剪贴板粘贴按钮
- 输入时实时验证格式
- 支持键盘快捷键 (Ctrl+V 自动粘贴)

**掩码规则**:
```typescript
function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`;
}
```

### 2.6 EmptyState 组件设计

```tsx
interface EmptyStateProps {
  engine: EngineType;
  onAddProvider: () => void;
  onSelectPreset: (preset: PresetProvider) => void;
}
```

**预设代理商**:
```typescript
const PRESET_PROVIDERS: Record<EngineType, PresetProvider[]> = {
  claude: [
    { name: 'Anthropic 官方', baseUrl: 'https://api.anthropic.com', isOfficial: true },
    { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', isPartner: true },
  ],
  codex: [
    { name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', isOfficial: true },
    { name: 'Azure OpenAI', baseUrl: '', isPartner: true },
  ],
  gemini: [
    { name: 'Google AI Studio', baseUrl: 'https://generativelanguage.googleapis.com', isOfficial: true },
  ],
  siliconflow: [
    { name: 'SiliconFlow 官方', baseUrl: 'https://api.siliconflow.cn/v1', isOfficial: true },
  ],
};
```

## 3. 数据模型设计

### 3.1 更新后的 UnifiedProviderConfig

```typescript
interface UnifiedProviderConfig {
  // 基础信息
  id: string;
  name: string;
  engine: EngineType;
  description?: string;

  // 认证信息 (加密存储)
  apiKey?: string;           // 加密后的 API Key
  apiKeyIv?: string;         // AES-GCM IV
  authToken?: string;        // 加密后的 Auth Token
  authTokenIv?: string;      // AES-GCM IV
  baseUrl?: string;
  model?: string;

  // 元数据
  isOfficial?: boolean;
  isPartner?: boolean;
  category?: ProviderCategory;
  websiteUrl?: string;
  sortOrder: number;         // 新增: 排序顺序

  // 状态
  enabled: boolean;
  lastUsed?: number;
  lastTestResult?: ConnectionTestResult; // 新增: 最后测试结果

  // 引擎特定配置
  engineSpecificConfig?: string;
  customHeaders?: Record<string, string>;

  // 时间戳
  createdAt: number;
  updatedAt: number;
}

// 连接测试结果
interface ConnectionTestResult {
  success: boolean;
  timestamp: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  modelInfo?: {
    name: string;
    contextWindow?: number;
  };
}
```


### 3.2 加密服务设计

```typescript
// src/lib/cryptoService.ts

interface CryptoService {
  // 加密 API Key
  encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }>;
  
  // 解密 API Key
  decrypt(ciphertext: string, iv: string): Promise<string>;
  
  // 生成加密密钥 (基于设备指纹)
  deriveKey(): Promise<CryptoKey>;
  
  // 安全清除内存中的敏感数据
  secureWipe(data: string): void;
}

// 实现细节
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// 密钥派生: 使用 PBKDF2 + 设备指纹
async function deriveKey(): Promise<CryptoKey> {
  const deviceId = await getDeviceFingerprint(); // 从 Tauri 获取
  const salt = new TextEncoder().encode('fangyu-code-v1');
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}
```

### 3.3 存储结构更新

```typescript
// src/types/provider.ts

interface ProviderStorage {
  version: number;              // 升级到 2
  encryptionVersion: number;    // 新增: 加密版本
  providers: UnifiedProviderConfig[];
  currentEngine: EngineType;
  currentProviders: Record<EngineType, string | null>;
  migrationLog?: MigrationLogEntry[]; // 新增: 迁移日志
}

interface MigrationLogEntry {
  fromVersion: number;
  toVersion: number;
  timestamp: number;
  success: boolean;
  details?: string;
}

// 存储版本常量
const PROVIDER_STORAGE_VERSION = 2;
const ENCRYPTION_VERSION = 1;
```

### 3.4 导出配置格式

```typescript
interface ExportedConfig {
  version: number;
  exportedAt: number;
  exportedFrom: string;         // 应用版本
  includesSensitiveData: boolean;
  
  // 敏感数据处理
  sensitiveDataMode: 'encrypted' | 'masked' | 'excluded';
  encryptionHint?: string;      // 加密提示 (如果用户设置了导出密码)
  
  providers: ExportedProvider[];
  currentEngine: EngineType;
  currentProviders: Record<EngineType, string | null>;
  runtimeConfig: RuntimeConfig;
}

interface ExportedProvider {
  // 基础信息 (始终导出)
  id: string;
  name: string;
  engine: EngineType;
  baseUrl?: string;
  model?: string;
  isOfficial?: boolean;
  sortOrder: number;
  
  // 敏感信息 (根据 sensitiveDataMode)
  apiKey?: string;              // encrypted/masked/undefined
  authToken?: string;
}
```


## 4. 服务层设计

### 4.1 EngineConfigService

```typescript
// src/services/engineConfigService.ts

class EngineConfigService {
  private cryptoService: CryptoService;
  private storageManager: StorageManager;
  private connectionTester: ConnectionTester;
  private migrator: ConfigMigrator;

  // 代理商 CRUD
  async createProvider(config: Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnifiedProviderConfig>;
  async updateProvider(id: string, updates: Partial<UnifiedProviderConfig>): Promise<UnifiedProviderConfig>;
  async deleteProvider(id: string): Promise<void>;
  async getProvider(id: string): Promise<UnifiedProviderConfig | null>;
  async getProvidersByEngine(engine: EngineType): Promise<UnifiedProviderConfig[]>;
  
  // 排序
  async reorderProviders(engine: EngineType, orderedIds: string[]): Promise<void>;
  
  // 引擎切换
  async setCurrentEngine(engine: EngineType): Promise<void>;
  async setCurrentProvider(engine: EngineType, providerId: string | null): Promise<void>;
  
  // 连接测试
  async testConnection(config: Partial<UnifiedProviderConfig>): Promise<ConnectionTestResult>;
  
  // 导入导出
  async exportConfig(options: ExportOptions): Promise<ExportedConfig>;
  async importConfig(data: ExportedConfig, mode: 'merge' | 'replace'): Promise<ImportResult>;
  
  // 迁移
  async checkAndMigrate(): Promise<MigrationResult>;
}
```

### 4.2 ConnectionTester 设计

```typescript
// src/services/connectionTester.ts

interface ConnectionTester {
  test(config: TestConfig): Promise<ConnectionTestResult>;
}

interface TestConfig {
  engine: EngineType;
  baseUrl: string;
  apiKey: string;
  model?: string;
  timeout?: number; // 默认 10000ms
}

// 各引擎测试实现
const ENGINE_TESTERS: Record<EngineType, (config: TestConfig) => Promise<ConnectionTestResult>> = {
  claude: async (config) => {
    // 调用 /v1/messages 端点，发送最小请求
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      signal: AbortSignal.timeout(config.timeout || 10000),
    });
    
    if (response.ok) {
      return { success: true, timestamp: Date.now(), latencyMs: /* 计算 */ };
    }
    
    const error = await response.json();
    return {
      success: false,
      timestamp: Date.now(),
      errorCode: error.error?.type,
      errorMessage: error.error?.message,
    };
  },
  
  codex: async (config) => {
    // 调用 /v1/models 端点验证 API Key
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(config.timeout || 10000),
    });
    // ...
  },
  
  gemini: async (config) => {
    // 调用 /v1/models 端点
    // ...
  },
  
  siliconflow: async (config) => {
    // 调用 /v1/models 端点
    // ...
  },
};
```


### 4.3 ConfigMigrator 设计

```typescript
// src/services/configMigrator.ts

interface ConfigMigrator {
  checkNeedsMigration(): Promise<boolean>;
  migrate(): Promise<MigrationResult>;
  rollback(backupId: string): Promise<void>;
}

interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migratedProviders: number;
  backupId: string;
  errors?: string[];
}

// 迁移策略
const MIGRATION_STRATEGIES: Record<string, MigrationStrategy> = {
  '1_to_2': {
    async migrate(storage: ProviderStorage): Promise<ProviderStorage> {
      // 1. 创建备份
      const backupId = await createBackup(storage);
      
      try {
        // 2. 加密所有 API Keys
        const cryptoService = new CryptoService();
        const migratedProviders = await Promise.all(
          storage.providers.map(async (provider) => {
            if (provider.apiKey) {
              const { ciphertext, iv } = await cryptoService.encrypt(provider.apiKey);
              return { ...provider, apiKey: ciphertext, apiKeyIv: iv };
            }
            return provider;
          })
        );
        
        // 3. 添加 sortOrder
        const withSortOrder = migratedProviders.map((p, i) => ({
          ...p,
          sortOrder: p.sortOrder ?? i,
          createdAt: p.createdAt ?? Date.now(),
          updatedAt: p.updatedAt ?? Date.now(),
        }));
        
        // 4. 返回新版本存储
        return {
          ...storage,
          version: 2,
          encryptionVersion: 1,
          providers: withSortOrder,
          migrationLog: [
            ...(storage.migrationLog || []),
            { fromVersion: 1, toVersion: 2, timestamp: Date.now(), success: true },
          ],
        };
      } catch (error) {
        // 回滚
        await restoreBackup(backupId);
        throw error;
      }
    },
  },
};
```

## 5. Hook 设计

### 5.1 useEngineConfig Hook

```typescript
// src/hooks/useEngineConfig.ts

interface UseEngineConfigReturn {
  // 状态
  currentEngine: EngineType;
  engines: EngineStatusInfo[];
  providers: UnifiedProviderConfig[];
  currentProvider: UnifiedProviderConfig | null;
  isLoading: boolean;
  error: Error | null;
  
  // 引擎操作
  setCurrentEngine: (engine: EngineType) => Promise<void>;
  refreshEngineStatus: () => Promise<void>;
  
  // 代理商操作
  addProvider: (config: Omit<UnifiedProviderConfig, 'id'>) => Promise<void>;
  updateProvider: (id: string, updates: Partial<UnifiedProviderConfig>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setCurrentProvider: (providerId: string | null) => Promise<void>;
  reorderProviders: (orderedIds: string[]) => Promise<void>;
  
  // 连接测试
  testConnection: (config: Partial<UnifiedProviderConfig>) => Promise<ConnectionTestResult>;
  
  // 导入导出
  exportConfig: (options: ExportOptions) => Promise<Blob>;
  importConfig: (file: File, mode: 'merge' | 'replace') => Promise<ImportResult>;
  
  // 解密 API Key (临时使用)
  decryptApiKey: (providerId: string) => Promise<string>;
}

function useEngineConfig(): UseEngineConfigReturn {
  const [state, dispatch] = useReducer(engineConfigReducer, initialState);
  const serviceRef = useRef<EngineConfigService>();
  
  // 初始化服务
  useEffect(() => {
    serviceRef.current = new EngineConfigService();
    serviceRef.current.checkAndMigrate().then(() => {
      loadInitialState();
    });
  }, []);
  
  // ... 实现各方法
}
```


## 6. UI 规格设计

### 6.1 色彩方案

```css
:root {
  /* 主色调 */
  --engine-claude: #D97706;      /* 琥珀色 */
  --engine-codex: #059669;       /* 翠绿色 */
  --engine-gemini: #7C3AED;      /* 紫罗兰 */
  --engine-siliconflow: #2563EB; /* 蓝色 */
  
  /* 状态色 */
  --status-connected: #10B981;   /* 绿色 */
  --status-warning: #F59E0B;     /* 黄色 */
  --status-error: #EF4444;       /* 红色 */
  --status-unknown: #6B7280;     /* 灰色 */
  
  /* 交互色 */
  --hover-bg: rgba(0, 0, 0, 0.04);
  --active-border: var(--primary);
  --drag-overlay: rgba(59, 130, 246, 0.1);
}

.dark {
  --hover-bg: rgba(255, 255, 255, 0.06);
  --drag-overlay: rgba(59, 130, 246, 0.2);
}
```

### 6.2 响应式断点

```css
/* 移动优先设计 */
.engine-card-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;  /* 移动端: 单列 */
}

@media (min-width: 640px) {
  .engine-card-grid {
    grid-template-columns: repeat(2, 1fr);  /* 平板: 2列 */
  }
}

@media (min-width: 1024px) {
  .engine-card-grid {
    grid-template-columns: repeat(4, 1fr);  /* 桌面: 4列 */
  }
}
```

### 6.3 动画规格

```css
/* 卡片 hover */
.engine-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.engine-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

/* 拖拽动画 */
.provider-item-dragging {
  opacity: 0.8;
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 表单展开 */
.provider-form-enter {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}

/* 状态切换 */
.status-indicator {
  transition: background-color 0.3s ease;
}

/* 加载动画 */
.connection-testing {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 6.4 可访问性规格

```tsx
// ARIA 标签示例
<div
  role="radiogroup"
  aria-label="选择 AI 引擎"
>
  <button
    role="radio"
    aria-checked={isActive}
    aria-label={`${engineName}, ${statusText}`}
    tabIndex={isActive ? 0 : -1}
    onKeyDown={handleKeyNavigation}
  >
    {/* 卡片内容 */}
  </button>
</div>

// 键盘导航
function handleKeyNavigation(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      focusNextEngine();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      focusPrevEngine();
      break;
    case 'Enter':
    case ' ':
      selectEngine();
      break;
  }
}

// 焦点管理
const focusTrap = useFocusTrap({
  enabled: isFormOpen,
  returnFocus: true,
});
```


## 7. 正确性属性 (Correctness Properties)

基于 prework 分析，以下是需要通过属性测试验证的核心属性：

### 7.1 引擎卡片状态显示

```typescript
// Property 1: 引擎卡片状态与实际状态一致
property('engine card displays correct status', () => {
  fc.assert(
    fc.property(
      fc.record({
        installed: fc.boolean(),
        hasProvider: fc.boolean(),
        connectionStatus: fc.constantFrom('connected', 'disconnected', 'error', 'unknown'),
      }),
      (state) => {
        const displayStatus = computeEngineCardStatus(state);
        
        if (!state.installed) {
          return displayStatus === 'not-installed';
        }
        if (!state.hasProvider) {
          return displayStatus === 'not-configured';
        }
        return displayStatus === state.connectionStatus;
      }
    )
  );
});
```

### 7.2 引擎切换行为

```typescript
// Property 2: 切换引擎后，当前引擎和代理商正确更新
property('engine switching updates state correctly', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('claude', 'codex', 'gemini', 'siliconflow'),
      fc.constantFrom('claude', 'codex', 'gemini', 'siliconflow'),
      (fromEngine, toEngine) => {
        const initialState = createState({ currentEngine: fromEngine });
        const newState = engineConfigReducer(initialState, { type: 'SET_ENGINE', engine: toEngine });
        
        return newState.currentEngine === toEngine &&
               newState.providers === initialState.providersByEngine[toEngine];
      }
    )
  );
});
```

### 7.3 代理商排序

```typescript
// Property 3: 拖拽排序后，顺序正确保存
property('provider reordering preserves all items', () => {
  fc.assert(
    fc.property(
      fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
      (providerIds) => {
        const shuffled = fc.sample(fc.shuffledSubarray(providerIds, { minLength: providerIds.length }))[0];
        const result = reorderProviders(providerIds, shuffled);
        
        return result.length === providerIds.length &&
               new Set(result).size === providerIds.length &&
               providerIds.every(id => result.includes(id));
      }
    )
  );
});
```

### 7.4 API Key 加密往返

```typescript
// Property 4: 加密后解密得到原始值
property('API key encryption round-trip', () => {
  fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (apiKey) => {
        const cryptoService = new CryptoService();
        const { ciphertext, iv } = await cryptoService.encrypt(apiKey);
        const decrypted = await cryptoService.decrypt(ciphertext, iv);
        
        return decrypted === apiKey;
      }
    )
  );
});
```

### 7.5 API Key 掩码

```typescript
// Property 5: 掩码显示正确格式
property('API key masking format', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 100 }),
      (apiKey) => {
        const masked = maskApiKey(apiKey);
        
        if (apiKey.length < 12) {
          return masked === '••••••••';
        }
        
        return masked.startsWith(apiKey.slice(0, 4)) &&
               masked.endsWith(apiKey.slice(-4)) &&
               masked.includes('••••••••');
      }
    )
  );
});
```

### 7.6 配置导入导出往返

```typescript
// Property 6: 导出后导入得到等价配置
property('config export/import round-trip', () => {
  fc.assert(
    fc.asyncProperty(
      generateProviderStorage(),
      async (storage) => {
        const service = new EngineConfigService();
        const exported = await service.exportConfig({ includeSensitive: true });
        const imported = await service.importConfig(exported, 'replace');
        
        return imported.success &&
               storage.providers.length === imported.providers.length &&
               storage.currentEngine === imported.currentEngine;
      }
    )
  );
});
```

### 7.7 迁移数据完整性

```typescript
// Property 7: 迁移后数据完整
property('migration preserves all providers', () => {
  fc.assert(
    fc.asyncProperty(
      generateLegacyStorage(),
      async (legacyStorage) => {
        const migrator = new ConfigMigrator();
        const result = await migrator.migrate(legacyStorage);
        
        return result.success &&
               result.migratedProviders === legacyStorage.providers.length;
      }
    )
  );
});
```

### 7.8 表单验证反馈

```typescript
// Property 8: 表单验证错误正确显示
property('form validation feedback', () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
        apiKey: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
        baseUrl: fc.oneof(fc.constant(''), fc.webUrl()),
      }),
      (formData) => {
        const errors = validateProviderForm(formData);
        
        const hasNameError = formData.name === '';
        const hasApiKeyError = formData.apiKey === '';
        
        return (hasNameError === errors.includes('name')) &&
               (hasApiKeyError === errors.includes('apiKey'));
      }
    )
  );
});
```

### 7.9 删除后状态一致性

```typescript
// Property 9: 删除代理商后状态一致
property('state consistency after provider deletion', () => {
  fc.assert(
    fc.property(
      generateProviderStorage(),
      fc.nat(),
      (storage, index) => {
        if (storage.providers.length === 0) return true;
        
        const targetIndex = index % storage.providers.length;
        const targetId = storage.providers[targetIndex].id;
        const wasActive = storage.currentProviders[storage.currentEngine] === targetId;
        
        const newState = deleteProvider(storage, targetId);
        
        // 验证: 已删除的代理商不在列表中
        const notInList = !newState.providers.some(p => p.id === targetId);
        
        // 验证: 如果删除的是当前代理商，currentProvider 应该更新
        const currentProviderValid = wasActive
          ? newState.currentProviders[storage.currentEngine] !== targetId
          : true;
        
        return notInList && currentProviderValid;
      }
    )
  );
});
```

### 7.10 空状态和预设行为

```typescript
// Property 10: 选择预设后表单正确填充
property('preset selection fills form correctly', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('claude', 'codex', 'gemini', 'siliconflow'),
      fc.nat(),
      (engine, presetIndex) => {
        const presets = PRESET_PROVIDERS[engine];
        if (presets.length === 0) return true;
        
        const preset = presets[presetIndex % presets.length];
        const formData = applyPreset(preset);
        
        return formData.name === preset.name &&
               formData.baseUrl === preset.baseUrl &&
               formData.isOfficial === preset.isOfficial;
      }
    )
  );
});
```


## 8. 错误处理策略

### 8.1 错误分类

| 错误类型 | 处理方式 | 用户反馈 |
|---------|---------|---------|
| 网络错误 | 重试 3 次，指数退避 | Toast 提示 + 重试按钮 |
| 认证错误 | 不重试，提示检查 API Key | 表单内联错误 |
| 存储错误 | 尝试恢复，失败则提示 | 模态对话框 |
| 迁移错误 | 自动回滚 | 模态对话框 + 详细日志 |
| 验证错误 | 不提交，显示错误 | 表单内联错误 |

### 8.2 错误消息映射

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // 网络错误
  'NETWORK_ERROR': '网络连接失败，请检查网络设置',
  'TIMEOUT': '请求超时，请稍后重试',
  
  // 认证错误
  'INVALID_API_KEY': 'API Key 无效，请检查后重试',
  'UNAUTHORIZED': '认证失败，请检查 API Key 是否正确',
  'RATE_LIMITED': '请求过于频繁，请稍后重试',
  
  // 存储错误
  'STORAGE_FULL': '存储空间不足，请清理后重试',
  'STORAGE_CORRUPTED': '配置数据损坏，正在尝试恢复...',
  
  // 迁移错误
  'MIGRATION_FAILED': '配置迁移失败，已恢复到之前的版本',
  'BACKUP_FAILED': '备份创建失败，迁移已取消',
  
  // 导入导出错误
  'INVALID_CONFIG_FORMAT': '配置文件格式无效',
  'VERSION_MISMATCH': '配置文件版本不兼容',
  'DECRYPTION_FAILED': '解密失败，请检查密码是否正确',
};
```

### 8.3 乐观更新与回滚

```typescript
async function updateProviderOptimistic(
  id: string,
  updates: Partial<UnifiedProviderConfig>
): Promise<void> {
  // 1. 保存当前状态
  const previousState = getState();
  
  // 2. 乐观更新 UI
  dispatch({ type: 'UPDATE_PROVIDER', id, updates });
  
  try {
    // 3. 持久化到存储
    await storageManager.updateProvider(id, updates);
  } catch (error) {
    // 4. 回滚到之前状态
    dispatch({ type: 'RESTORE_STATE', state: previousState });
    
    // 5. 显示错误通知
    toast.error(getErrorMessage(error));
  }
}
```

## 9. 测试策略

### 9.1 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | 服务层、工具函数 |
| 属性测试 | fast-check | 核心逻辑、数据转换 |
| 组件测试 | React Testing Library | UI 组件 |
| 集成测试 | Vitest | Hook + Service |

### 9.2 测试文件结构

```
src/
├── services/
│   ├── engineConfigService.ts
│   ├── engineConfigService.test.ts        # 单元测试
│   └── engineConfigService.property.test.ts # 属性测试
├── hooks/
│   ├── useEngineConfig.ts
│   └── useEngineConfig.test.ts
├── components/
│   ├── EngineConfigPanel/
│   │   ├── index.tsx
│   │   ├── EngineCard.tsx
│   │   ├── ProviderList.tsx
│   │   └── __tests__/
│   │       ├── EngineCard.test.tsx
│   │       └── ProviderList.test.tsx
└── lib/
    ├── cryptoService.ts
    ├── cryptoService.test.ts
    └── cryptoService.property.test.ts
```

### 9.3 关键测试用例

```typescript
// 1. 加密服务测试
describe('CryptoService', () => {
  it('should encrypt and decrypt API key correctly');
  it('should generate unique IV for each encryption');
  it('should handle empty string');
  it('should handle special characters');
});

// 2. 迁移服务测试
describe('ConfigMigrator', () => {
  it('should migrate v1 to v2 successfully');
  it('should create backup before migration');
  it('should rollback on failure');
  it('should preserve all provider data');
});

// 3. 连接测试服务测试
describe('ConnectionTester', () => {
  it('should return success for valid credentials');
  it('should return error for invalid API key');
  it('should timeout after 10 seconds');
  it('should handle network errors gracefully');
});

// 4. UI 组件测试
describe('EngineCard', () => {
  it('should display correct status indicator');
  it('should highlight when active');
  it('should call onClick when clicked');
  it('should support keyboard navigation');
});
```

## 10. 文件清单

### 10.1 新建文件

| 文件路径 | 用途 |
|---------|------|
| `src/services/engineConfigService.ts` | 引擎配置服务 |
| `src/services/cryptoService.ts` | 加密服务 |
| `src/services/connectionTester.ts` | 连接测试服务 |
| `src/services/configMigrator.ts` | 配置迁移服务 |
| `src/hooks/useEngineConfig.ts` | 统一配置 Hook |
| `src/components/EngineConfigPanel/index.tsx` | 主面板组件 |
| `src/components/EngineConfigPanel/EngineCard.tsx` | 引擎卡片 |
| `src/components/EngineConfigPanel/EngineCardGrid.tsx` | 卡片网格 |
| `src/components/EngineConfigPanel/ProviderPanel.tsx` | 代理商面板 |
| `src/components/EngineConfigPanel/ProviderList.tsx` | 代理商列表 |
| `src/components/EngineConfigPanel/ProviderItem.tsx` | 代理商项 |
| `src/components/EngineConfigPanel/ProviderForm.tsx` | 代理商表单 |
| `src/components/EngineConfigPanel/ApiKeyInput.tsx` | API Key 输入 |
| `src/components/EngineConfigPanel/EmptyState.tsx` | 空状态 |
| `src/components/EngineConfigPanel/AdvancedSettings.tsx` | 高级设置 |
| `src/components/EngineConfigPanel/ConfigActions.tsx` | 配置操作 |

### 10.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/types/provider.ts` | 更新类型定义 |
| `src/components/Settings.tsx` | 集成新的 EngineConfigPanel |

### 10.3 删除文件

| 文件路径 | 原因 |
|---------|------|
| `src/components/UnifiedProviderManager.tsx` | 被 ProviderPanel 替代 |
| `src/components/UnifiedProviderForm.tsx` | 被 ProviderForm 替代 |
| `src/components/UnifiedEngineSelector.tsx` | 被 EngineCardGrid 替代 |
| `src/components/EngineStatusOverview.tsx` | 功能合并到 EngineCard |
| `src/hooks/useProviderConfig.ts` | 被 useEngineConfig 替代 |
| `src/hooks/useEngineStatus.ts` | 被 useEngineConfig 替代 |
| `src/lib/providerUtils.ts` | 功能迁移到 engineConfigService |
| `src/lib/providerMigration.ts` | 被 configMigrator 替代 |
