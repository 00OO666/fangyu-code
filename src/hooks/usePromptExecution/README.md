# usePromptExecution 重构指南

## 📋 重构进度

### ✅ 已完成（阶段 1）
- [x] 提取类型定义到 `types.ts`
- [x] 提取工具函数到 `utils.ts`
- [x] 创建 Codex 引擎模块 (`engines/codex.ts`)
- [x] 创建 Gemini 引擎模块 (`engines/gemini.ts`)
- [x] 创建 Claude 引擎模块 (`engines/claude.ts`)
- [x] 创建引擎统一导出 (`engines/index.ts`)

### 🔄 待完成（阶段 2）
- [ ] 重构主 Hook 使用新的引擎模块
- [ ] 简化 `handleSendPrompt` 函数
- [ ] 移除重复的事件监听器代码
- [ ] 测试所有引擎功能

## 📁 新架构

```
src/hooks/usePromptExecution/
├── index.ts              # 主入口，导出所有功能
├── types.ts              # 类型定义
├── utils.ts              # 工具函数
└── engines/              # 引擎模块
    ├── index.ts          # 引擎统一导出
    ├── codex.ts          # Codex 引擎 (250 行)
    ├── gemini.ts         # Gemini 引擎 (350 行)
    └── claude.ts         # Claude 引擎 (280 行)
```

## 🔧 如何使用新的引擎模块

### 示例：设置 Codex 事件监听器

```typescript
import { setupCodexEventListeners, type CodexEngineContext } from '@/hooks/usePromptExecution/engines';

// 准备上下文
const context: CodexEngineContext = {
  config: {
    projectPath,
    isMountedRef,
    setMessages,
    setRawJsonlOutput,
    // ... 其他配置
  },
  tabIdRef,
  codexThreadIdRef,
  updateCodexRateLimits,
  refreshCodexRateLimitsFromHistory,
  handleSendPrompt,
  isUserInitiated,
  codexPendingInfo,
};

// 设置监听器
const unlisteners = await setupCodexEventListeners(context);

// 保存 unlisteners 以便清理
unlistenRefs.current = unlisteners;
```

## 📊 重构收益

| 指标 | 重构前 | 重构后 | 改进 |
|------|--------|--------|------|
| 主文件行数 | 2640 行 | ~800 行（预期） | ↓ 70% |
| 引擎模块数 | 0 | 3 | +3 |
| 代码重复率 | ~20% | < 5%（预期） | ↓ 75% |
| 可维护性 | 低 | 高 | ↑ 显著 |

## ⚠️ 注意事项

1. **向后兼容**：原有的 `usePromptExecution` hook 保持不变
2. **渐进式迁移**：可以逐步将主 Hook 的逻辑迁移到新模块
3. **充分测试**：每次迁移后都要测试所有引擎功能
4. **保留备份**：在删除旧代码前确保新代码完全正常工作

## 🚀 下一步

1. 修改 `usePromptExecution.ts` 中的事件监听器设置代码
2. 使用新的引擎模块替代内联的监听器逻辑
3. 简化 `handleSendPrompt` 函数
4. 移除重复代码
5. 全面测试

## 📝 迁移检查清单

- [ ] Codex 引擎功能正常
- [ ] Gemini 引擎功能正常
- [ ] Claude 引擎功能正常
- [ ] 会话恢复功能正常
- [ ] 消息去重功能正常
- [ ] 错误处理功能正常
- [ ] 队列处理功能正常
- [ ] 内存泄漏已修复
