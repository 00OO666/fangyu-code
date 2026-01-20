# ClaudeCodeSession 重构计划

## 📊 当前状态
- **文件大小**: 2105 行
- **主组件**: ClaudeCodeSessionInner (1970 行)
- **问题**:
  - 40+ useState
  - 20+ useEffect
  - 30+ 自定义 hooks
  - 职责过多

## 🎯 重构目标
将 2105 行的单文件拆分为多个小组件，每个组件 < 300 行

## 📁 新架构

```
src/components/session/
├── ClaudeCodeSession.tsx      # 主容器 (~200 行)
├── SessionLayout.tsx           # 布局组件 (~100 行)
├── SessionState.tsx            # 状态管理 (~150 行)
├── SessionHeader.tsx           # 已存在
├── SessionMessages.tsx         # 已存在
├── SessionFooter.tsx           # 输入区域 (~200 行)
├── SessionSidebar.tsx          # 侧边栏 (~150 行)
├── SessionDialogs.tsx          # 对话框集合 (~200 行)
└── hooks/
    ├── useSessionState.ts      # 状态管理 hook (~200 行)
    ├── useSessionEffects.ts    # 副作用管理 (~150 行)
    └── useSessionHandlers.ts   # 事件处理器 (~150 行)
```

## 🔄 拆分步骤

### 阶段 1：提取状态管理 ✅
- [x] 创建 `useSessionState.ts`
- [x] 使用 useReducer 替代 40+ useState
- [x] 创建 SessionContext

### 阶段 2：提取副作用
- [ ] 创建 `useSessionEffects.ts`
- [ ] 合并相关的 useEffect
- [ ] 提取到自定义 hooks

### 阶段 3：提取 UI 组件
- [ ] 创建 `SessionFooter.tsx`
- [ ] 创建 `SessionSidebar.tsx`
- [ ] 创建 `SessionDialogs.tsx`
- [ ] 创建 `SessionLayout.tsx`

### 阶段 4：重构主组件
- [ ] 简化 `ClaudeCodeSession.tsx`
- [ ] 使用新的子组件
- [ ] 移除重复代码

## 📝 注意事项

1. **保持功能完整**: 每次拆分后都要测试
2. **渐进式重构**: 一次拆分一个部分
3. **向后兼容**: 保持 API 不变
4. **充分测试**: 确保没有破坏现有功能
