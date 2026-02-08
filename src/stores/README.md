# 状态管理规范

> 🏗️ 架构优化 (v2.7.6) - 统一状态管理方案

## 核心原则

### 1. Zustand 用于全局状态

- 跨组件共享的状态
- 需要持久化的状态
- 高频更新的状态（避免 Context 重渲染）

### 2. Context 用于依赖注入

- 主题配置
- 国际化
- 路由信息
- 一次性配置（不频繁变化）

### 3. useState 用于组件内部状态

- 表单输入
- UI 状态（展开/折叠）
- 临时状态

## Store 结构

```
src/stores/
├── README.md           # 本文档
├── sessionStore.ts     # 会话相关状态
├── uiStore.ts          # UI 状态（主题、布局等）
└── index.ts            # 统一导出
```

## 使用示例

### 读取状态（使用选择器）

```typescript
// ✅ 正确：使用选择器，只订阅需要的状态
const engine = useSessionStore((state) => state.executionEngineConfig.engine);

// ❌ 错误：订阅整个 store，任何变化都会重渲染
const store = useSessionStore();
```

### 更新状态

```typescript
// ✅ 正确：使用 action
const setEngine = useSessionStore((state) => state.setExecutionEngineConfig);
setEngine({ engine: "claude" });

// ❌ 错误：直接修改状态
store.executionEngineConfig.engine = "claude";
```

### 持久化

```typescript
// 使用 persist 中间件
export const useStore = create<Store>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'store-key',
      partialize: (state) => ({
        // 只持久化需要的字段
        field1: state.field1,
      }),
    }
  )
);
```

## 迁移指南

### 从 Context 迁移到 Zustand

1. 识别高频更新的状态
2. 创建对应的 Zustand store
3. 使用选择器 hooks 替代 useContext
4. 保留 Context 用于依赖注入

### 示例：迁移引擎配置

Before (Context):

```typescript
const { engineConfig, setEngineConfig } = useSessionContext();
```

After (Zustand):

```typescript
const engineConfig = useExecutionEngineConfig();
const setEngineConfig = useSetExecutionEngineConfig();
```

## 性能优化

1. **使用选择器**：只订阅需要的状态片段
2. **浅比较**：Zustand 默认使用浅比较，避免不必要的重渲染
3. **分离 actions**：将 actions 和 state 分开订阅
4. **避免内联选择器**：将选择器提取为常量或 hooks

## 调试

```typescript
// 开发环境启用 devtools
import { devtools } from 'zustand/middleware';

const useStore = create<Store>()(
  devtools(
    (set) => ({ ... }),
    { name: 'StoreName' }
  )
);
```
