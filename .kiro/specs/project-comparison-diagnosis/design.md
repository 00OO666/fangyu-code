# Design Document: Project Comparison Diagnosis

## Overview

本设计文档描述了一个项目对比诊断工具，用于对比 F:\Fangyu-Code-Dev（当前项目）与 C:\Users\666\Fangyu-Code-Dev（备份项目）的差异，诊断 Tailwind CSS 4 构建错误和暗色主题丢失问题。

### 初步诊断发现

在设计阶段的调研中，已发现以下关键问题：

1. **样式导入错误（CRITICAL）**：当前项目 `src/main.tsx` 导入的是 `./styles-test.css`，而备份项目导入的是 `./styles.css`
2. **styles-test.css 内容不完整**：只包含最简单的样式，缺少完整的主题变量定义
3. **备份目录不完整**：缺少 `package.json` 和 `vite.config.ts` 等关键配置文件

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Diagnosis Tool                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ File Scanner│  │ Diff Engine │  │Report Generator│       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Analysis Pipeline                   │       │
│  │  1. Scan directories                            │       │
│  │  2. Compare files                               │       │
│  │  3. Detect encoding issues                      │       │
│  │  4. Generate severity-sorted report             │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. File Scanner

负责扫描两个项目目录，收集文件列表和元数据。

```typescript
interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  hash?: string;
  encoding?: 'utf8' | 'utf8-bom' | 'unknown';
}

interface ScanResult {
  currentProject: FileInfo[];
  backupProject: FileInfo[];
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
}
```

### 2. Diff Engine

负责对比文件内容，生成差异报告。

```typescript
interface FileDiff {
  path: string;
  type: 'added' | 'removed' | 'modified';
  severity: 'critical' | 'warning' | 'info';
  changes: DiffChange[];
  reason?: string;
}

interface DiffChange {
  lineNumber: number;
  type: 'add' | 'remove' | 'modify';
  oldContent?: string;
  newContent?: string;
}
```

### 3. Report Generator

负责生成最终的诊断报告。

```typescript
interface DiagnosisReport {
  summary: {
    criticalIssues: number;
    warnings: number;
    infoItems: number;
  };
  issues: Issue[];
  fixSteps: FixStep[];
  filesToRestore: string[];
}

interface Issue {
  severity: 'critical' | 'warning' | 'info';
  category: 'config' | 'style' | 'code' | 'encoding' | 'file';
  description: string;
  file?: string;
  line?: number;
}

interface FixStep {
  order: number;
  description: string;
  command?: string;
  file?: string;
}
```

## Data Models

### 项目路径配置

```typescript
const PROJECT_PATHS = {
  current: 'F:\\Fangyu-Code-Dev',
  backup: 'C:\\Users\\666\\Fangyu-Code-Dev'
};
```

### 对比文件清单

```typescript
const FILES_TO_COMPARE = {
  config: [
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.toml'
  ],
  styles: [
    'src/styles.css',
    'src/styles/theme.css',
    'src/styles/typography.css',
    'src/styles/animations.css',
    'src/styles/components.css'
  ],
  core: [
    'src/main.tsx',
    'src/App.tsx',
    'src/contexts/ThemeContext.tsx'
  ]
};
```

### 严重程度定义

```typescript
const SEVERITY_RULES = {
  critical: [
    'main.tsx 导入错误的样式文件',
    'styles.css 缺失或为空',
    'Tailwind 配置错误'
  ],
  warning: [
    '依赖版本不一致',
    '配置文件差异',
    '可能导致问题的 markdown 文件'
  ],
  info: [
    '新增文件',
    '删除文件',
    '注释变化'
  ]
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Comparison Consistency

*For any* two files with the same relative path in both projects, the diff engine SHALL produce a consistent diff result that accurately reflects all differences between the files.

**Validates: Requirements 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 3.3**

### Property 2: File Change Detection Completeness

*For any* file that exists in one project but not the other, the scanner SHALL correctly classify it as either "added" (exists only in current) or "removed" (exists only in backup).

**Validates: Requirements 4.1, 4.2**

### Property 3: Encoding Issue Detection

*For any* file with a BOM marker or path containing CSS escape-like sequences, the scanner SHALL detect and report the encoding issue.

**Validates: Requirements 5.1, 5.2**

### Property 4: Report Severity Ordering

*For any* generated diagnosis report, all issues SHALL be sorted by severity in the order: critical > warning > info.

**Validates: Requirements 6.1, 6.2**

### Property 5: Tailwind Syntax Detection

*For any* CSS file containing Tailwind 4 specific syntax (@import "tailwindcss", @utility, @theme), the diagnosis tool SHALL flag it for compatibility review.

**Validates: Requirements 2.3**

## Error Handling

### 文件访问错误

- 如果文件不存在，记录为 "missing" 而非抛出错误
- 如果目录不可访问，报告权限问题并继续处理其他文件

### 编码错误

- 如果文件编码无法识别，标记为 "unknown" 并在报告中警告
- 尝试使用 UTF-8 和 UTF-16 解码，选择成功的编码

### 大文件处理

- 对于超过 1MB 的文件，只比较哈希值而非逐行对比
- 在报告中标注 "large file - hash comparison only"

## Testing Strategy

### 单元测试

由于这是一个诊断工具而非持续运行的应用，测试策略侧重于：

1. **手动验证**：执行诊断后人工验证报告准确性
2. **回归测试**：修复问题后重新运行诊断，确认问题已解决

### 验证步骤

1. 运行诊断工具
2. 检查报告中的 critical 问题
3. 按照修复步骤执行修复
4. 重新构建项目验证问题已解决

## 已知问题和修复方案

### 问题 1: 样式导入错误（CRITICAL）

**现象**：暗色主题丢失，UI 显示异常

**原因**：`src/main.tsx` 第 8 行导入了 `./styles-test.css` 而非 `./styles.css`

**修复**：
```diff
- import "./styles-test.css";
+ import "./styles.css";
```

### 问题 2: styles-test.css 是测试文件

**现象**：只有黑色背景和白色文字，缺少所有主题变量

**原因**：`styles-test.css` 是一个最小化测试文件，只包含：
```css
@import "tailwindcss";
body { background: black; color: white; }
```

**修复**：删除或重命名 `styles-test.css`，确保 `main.tsx` 导入正确的 `styles.css`

### 问题 3: 备份目录不完整

**现象**：无法完整对比配置文件

**原因**：备份目录 `C:\Users\666\Fangyu-Code-Dev` 缺少 `package.json` 和 `vite.config.ts`

**建议**：
1. 检查是否有其他更完整的备份
2. 或者从 Git 历史中恢复这些文件
