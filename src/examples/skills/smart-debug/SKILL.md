---
name: smart-debug
description: |
  智能调试助手。系统化诊断和解决代码问题，支持错误分析、日志解读、性能排查。
  当用户说"调试"、"报错"、"不工作"、"出问题"、"诊断"时触发。
license: Apache-2.0
compatibility: Fangyu Code 2.4+
metadata:
  author: Fangyu
  version: 1.0.0
  categories:
    - debugging
    - troubleshooting
  keywords:
    - debug
    - error
    - fix
    - diagnose
---

# Smart Debug - 智能调试助手

## 概述

智能调试助手，帮助系统化地诊断和解决代码问题。

核心能力：
- **错误分析** - 解析错误信息，定位根因
- **日志解读** - 分析日志，找出异常模式
- **代码审查** - 检查可疑代码段
- **修复建议** - 提供具体的修复方案
- **验证测试** - 确认问题已解决

## 触发条件

当用户提到以下关键词时自动触发：
- "调试" / "debug"
- "报错" / "error"
- "不工作" / "not working"
- "出问题" / "issue"
- "诊断" / "diagnose"
- "502" / "500" / "404"

## 工作流程

### 步骤 1: 问题收集

收集问题信息：
```
请描述遇到的问题：
1. 错误信息是什么？（完整复制）
2. 什么操作触发的？
3. 之前正常吗？最近改了什么？
4. 能复现吗？复现步骤是？
```

### 步骤 2: 错误分析

分析错误类型：

| 错误类型 | 特征 | 常见原因 |
|---------|------|---------|
| 语法错误 | SyntaxError | 拼写、括号、分号 |
| 类型错误 | TypeError | 类型不匹配、null/undefined |
| 引用错误 | ReferenceError | 变量未定义 |
| 网络错误 | NetworkError | 连接、超时、CORS |
| 运行时错误 | RuntimeError | 逻辑错误、边界条件 |

### 步骤 3: 定位根因

使用二分法定位：
1. 确定问题范围（文件/函数/行）
2. 添加日志点
3. 检查输入输出
4. 对比正常/异常情况

### 步骤 4: 修复方案

提供修复建议：
```markdown
## 🔧 修复方案

### 问题原因
[具体原因分析]

### 修复代码
\`\`\`typescript
// 修改前
const result = data.items.map(...)

// 修改后
const result = data?.items?.map(...) ?? []
\`\`\`

### 验证方法
1. 运行测试用例
2. 手动测试边界情况
```

### 步骤 5: 验证修复

确认问题已解决：
- [ ] 原问题不再出现
- [ ] 没有引入新问题
- [ ] 相关测试通过
- [ ] 边界情况处理正确

## 常见问题速查

### 前端问题

| 症状 | 可能原因 | 快速修复 |
|------|---------|---------|
| 白屏 | JS 错误 | 检查控制台 |
| 样式错乱 | CSS 冲突 | 检查选择器优先级 |
| 数据不显示 | API 失败 | 检查网络请求 |
| 点击无反应 | 事件未绑定 | 检查 onClick |

### 后端问题

| 症状 | 可能原因 | 快速修复 |
|------|---------|---------|
| 502 | 服务崩溃 | 检查进程/日志 |
| 500 | 代码异常 | 检查错误堆栈 |
| 超时 | 慢查询/死循环 | 检查性能 |
| 403 | 权限问题 | 检查认证 |

### Tauri 问题

| 症状 | 可能原因 | 快速修复 |
|------|---------|---------|
| 命令失败 | Rust panic | 检查 Rust 日志 |
| IPC 超时 | 异步阻塞 | 使用 spawn_blocking |
| 窗口空白 | 前端错误 | 开启 DevTools |

## 调试工具

### 浏览器 DevTools
- Console - 查看错误和日志
- Network - 检查请求
- Sources - 断点调试
- Performance - 性能分析

### VS Code
- 断点调试
- 变量监视
- 调用堆栈

### 命令行
```bash
# 查看日志
tail -f /var/log/app.log

# 检查进程
ps aux | grep node

# 网络诊断
curl -v http://localhost:3000
```

## 注意事项

1. **先复现再修复** - 确保能稳定复现问题
2. **最小化改动** - 只修改必要的代码
3. **保留现场** - 记录错误信息和上下文
4. **回归测试** - 修复后测试相关功能

## 最佳实践

### 日志规范
```typescript
// ✅ 好的日志
console.log('[UserService] Login failed:', { userId, error: err.message });

// ❌ 差的日志
console.log('error');
```

### 错误处理
```typescript
// ✅ 好的处理
try {
  const data = await fetchData();
  return data;
} catch (err) {
  console.error('[fetchData] Failed:', err);
  throw new AppError('DATA_FETCH_FAILED', err);
}

// ❌ 差的处理
try {
  return await fetchData();
} catch {
  return null;
}
```
