---
inclusion: manual
---

# Code Index - 代码索引快速定位

> 从 Claude Code Skills 迁移

## 触发词
- "修改 xxx 文件"、"modify file"
- "找到 xxx 函数"、"find function"
- "搜索 xxx"、"search for"
- "定位 xxx"、"locate"
- "分析文件结构"、"analyze structure"
- "查找所有 xxx 文件"、"find all files"

## 核心价值

| 场景 | 传统方式 | 智能索引方式 |
|------|----------|-------------|
| 查找文件 | `find . -name "*.php"` (遍历全部) | 索引查询 (O(1)) |
| 搜索代码 | `grep -r "keyword"` (全盘扫描) | 智能搜索 |
| 分析结构 | 读取整个文件 | 结构摘要 |

**Token 节省**: 避免读取大量无关文件，直接定位目标。

## 工作流程

### 阶段1: 快速定位
1. 根据用户需求选择搜索方式
2. 使用 grepSearch 或 fileSearch 工具
3. 从结果中识别目标文件

### 阶段2: 精确读取
1. 使用 readFile 工具读取目标文件
2. 分析代码逻辑
3. 提供修改建议

### 阶段3: 验证修改
1. 修改代码后重新搜索
2. 确认修改已生效
3. 检查是否影响其他文件

## Kiro 工具对应

| 功能 | Kiro 工具 |
|------|----------|
| 查找文件 | `fileSearch` |
| 搜索代码 | `grepSearch` |
| 读取文件 | `readFile` / `readMultipleFiles` |
| 分析结构 | `readFile` + 手动分析 |

## 常用搜索示例

### 查找特定类型文件
```
fileSearch: query="*.tsx" 或 "Controller.php"
```

### 搜索函数定义
```
grepSearch: query="function processPayment" 或 "const handleSubmit"
```

### 搜索组件使用
```
grepSearch: query="<Header" includePattern="**/*.tsx"
```

### 搜索 PbootCMS 标签
```
grepSearch: query="{pboot:list" includePattern="**/*.html"
```

## 修改文件的标准流程

```
1. 定位目标
   fileSearch() 或 grepSearch()
        ↓
2. 分析结构
   readFile() 了解文件结构
        ↓
3. 精准读取
   readFile 读取目标文件/片段
        ↓
4. 修改代码
   strReplace / fsWrite 进行修改
        ↓
5. 验证修改
   getDiagnostics 检查语法错误
```

## 注意事项
1. **修改前必须定位** - 避免盲目修改，先定位目标文件
2. **优先使用搜索工具** - 比手动查找快得多
3. **限制搜索范围** - 使用 includePattern 缩小范围
4. **验证路径** - 定位后验证文件是否存在
