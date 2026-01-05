---
inclusion: manual
---

# Fangyu Code Audit - 全面代码审查

> 从 Claude Code Skills 迁移

## 触发词
- "代码审查"、"code review"
- "质量检查"、"quality check"
- "性能优化"、"performance optimization"
- "架构分析"、"architecture analysis"
- "代码问题"、"code issues"
- "全面检查"、"comprehensive audit"
- "最佳实践"、"best practices"

## 审查维度

### 1. 架构设计 (Architecture)
- 项目结构组织
- 模块化和解耦程度
- 组件层次设计
- 状态管理架构
- 代码复用性

### 2. 性能优化 (Performance)
- React 渲染性能
- 内存使用和泄漏
- Bundle 大小优化
- 懒加载和代码分割
- 缓存策略
- 虚拟化长列表

### 3. UI/UX 体验 (User Experience)
- 界面一致性
- 响应式设计
- 可访问性 (a11y)
- 加载状态和反馈
- 错误提示友好性

### 4. 代码质量 (Code Quality)
- 命名规范
- 代码可读性
- 注释和文档
- TypeScript 类型安全
- 错误处理
- ESLint/Prettier 配置

### 5. 安全性 (Security)
- XSS 防护
- 敏感数据处理
- API 密钥管理
- 依赖漏洞检查
- Tauri 安全配置

### 6. 可维护性 (Maintainability)
- 技术债务
- 废弃代码清理
- 依赖更新状态
- Git 提交规范

## 工作流程

### 阶段1: 项目扫描
1. 读取项目结构 (`F:\Fangyu-Code-Dev\`)
2. 分析 `package.json` 依赖
3. 检查 `tsconfig.json` 配置
4. 扫描 `src/` 目录结构

### 阶段2: 自动化检查
```powershell
# 运行 ESLint 检查
npm run lint

# 检查 TypeScript 类型错误
npx tsc --noEmit

# 扫描安全漏洞
npm audit
```

### 阶段3: 代码审查
1. 审查核心组件 (`src/components/`)
2. 检查状态管理 (`src/hooks/`, `src/lib/`)
3. 分析性能瓶颈
4. 评估 UI/UX 一致性

### 阶段4: 生成报告

```markdown
# Fangyu Code 代码审查报告
生成时间: YYYY-MM-DD HH:mm:ss

## 📊 总体评分
- 架构设计: ⭐⭐⭐⭐☆ (8/10)
- 性能优化: ⭐⭐⭐☆☆ (6/10)
- UI/UX体验: ⭐⭐⭐⭐⭐ (9/10)
- 代码质量: ⭐⭐⭐⭐☆ (7/10)
- 安全性: ⭐⭐⭐⭐☆ (8/10)
- 可维护性: ⭐⭐⭐☆☆ (6/10)

**综合评分: 7.3/10**

## 🔴 严重问题 (Critical)
[问题列表]

## 🟡 中等问题 (Medium)
[问题列表]

## 🟢 轻微问题 (Minor)
[问题列表]

## ✅ 优秀实践
[识别的优秀实践]

## 📋 优化建议优先级
[按优先级排序的建议]
```

## 注意事项
1. **不自动修改代码** - 仅提供报告和建议
2. **需要用户确认** - 重大问题需要用户确认后再修复
3. **保持客观** - 基于最佳实践，不带主观偏见
4. **提供上下文** - 每个问题都附带详细的解释和参考资料

## 参考资源
- [React Performance Checklist 2025](https://www.zartek.in/react-app-performance-checklist)
- [React Code Review Checklist](https://redwerk.com/blog/react-code-review-checklist-boost-security-performance/)
- [Frontend Performance Checklist](https://talent500.com/blog/frontend-performance-checklist-2025/)
