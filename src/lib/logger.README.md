# Logger Service 使用指南

## 📝 简介

统一的日志管理服务，替代分散的 `console.log`，提供：
- ✅ 日志级别控制
- ✅ 开发/生产环境区分
- ✅ 统一的日志格式
- ✅ 性能监控

## 🚀 快速开始

### 基本使用

```typescript
import logger from '@/lib/logger';

// Debug 日志（仅开发环境）
logger.debug('MyComponent', '组件已挂载', { props });

// Info 日志
logger.info('API', '请求成功', response);

// Warning 日志
logger.warn('Validation', '输入值可能不正确', value);

// Error 日志
logger.error('Network', '请求失败', error);
```

### 性能监控

```typescript
import logger from '@/lib/logger';

logger.time('数据加载');
await loadData();
logger.timeEnd('数据加载'); // 输出: 数据加载: 123.45ms
```

### 分组日志

```typescript
import logger from '@/lib/logger';

logger.group('用户操作');
logger.info('User', '点击按钮', buttonId);
logger.info('User', '提交表单', formData);
logger.groupEnd();
```

## ⚙️ 配置

```typescript
import logger from '@/lib/logger';

// 配置日志服务
logger.configure({
  enabled: true,           // 是否启用日志
  level: 'info',           // 最低日志级别
  showTimestamp: true,     // 显示时间戳
  showCaller: false,       // 显示调用者（未实现）
});
```

## 📊 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| `debug` | 调试信息（仅开发环境） | 变量值、函数调用 |
| `info` | 一般信息 | 操作成功、状态变化 |
| `warn` | 警告信息 | 潜在问题、降级处理 |
| `error` | 错误信息（始终输出） | 异常、失败 |

## 🔄 迁移指南

### 替换 console.log

**之前：**
```typescript
console.log('[MyComponent] 组件已挂载', props);
```

**之后：**
```typescript
logger.debug('MyComponent', '组件已挂载', props);
```

### 替换 console.error

**之前：**
```typescript
console.error('请求失败:', error);
```

**之后：**
```typescript
logger.error('API', '请求失败', error);
```

### 替换 console.warn

**之前：**
```typescript
console.warn('[Validation] 输入值可能不正确', value);
```

**之后：**
```typescript
logger.warn('Validation', '输入值可能不正确', value);
```

## 📦 批量替换

使用 VS Code 的查找替换功能：

1. **替换 console.log**
   - 查找：`console\.log\(['"](\[.*?\])\s*(.*?)['"],`
   - 替换：`logger.debug('$1', '$2',`

2. **替换 console.error**
   - 查找：`console\.error\(['"](\[.*?\])\s*(.*?)['"],`
   - 替换：`logger.error('$1', '$2',`

3. **替换 console.warn**
   - 查找：`console\.warn\(['"](\[.*?\])\s*(.*?)['"],`
   - 替换：`logger.warn('$1', '$2',`

## ✅ 优势

1. **统一管理**：所有日志通过一个服务管理
2. **环境区分**：生产环境自动禁用 debug 日志
3. **格式统一**：所有日志格式一致，易于搜索
4. **性能优化**：生产环境可完全禁用日志
5. **易于扩展**：未来可添加日志上报、过滤等功能

## 🔮 未来扩展

- [ ] 日志持久化（保存到文件）
- [ ] 日志上报（发送到服务器）
- [ ] 日志过滤（按模块、级别过滤）
- [ ] 日志搜索（全文搜索）
- [ ] 日志导出（导出为文件）
