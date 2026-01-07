# Requirements Document

## Introduction

对比 F:\Fangyu-Code-Dev（当前项目）与 C:\Users\666\Fangyu-Code-Dev（备份项目）的差异，诊断 Tailwind CSS 4 构建错误和暗色主题丢失问题的根本原因，并生成修复方案。

## Glossary

- **Current_Project**: 当前项目目录 F:\Fangyu-Code-Dev，存在构建错误
- **Backup_Project**: 备份项目目录 C:\Users\666\Fangyu-Code-Dev，可正常工作
- **Diagnosis_Tool**: 项目对比诊断工具
- **Diff_Report**: 差异报告，包含文件差异和修复建议

## Requirements

### Requirement 1: 配置文件对比

**User Story:** As a developer, I want to compare configuration files between two project directories, so that I can identify dependency and build configuration differences.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool compares package.json files, THE Diagnosis_Tool SHALL identify all dependency version differences
2. WHEN the Diagnosis_Tool compares vite.config.ts files, THE Diagnosis_Tool SHALL identify Vite configuration differences
3. WHEN the Diagnosis_Tool compares tsconfig.json files, THE Diagnosis_Tool SHALL identify TypeScript configuration differences
4. WHEN the Diagnosis_Tool compares src-tauri/tauri.conf.json files, THE Diagnosis_Tool SHALL identify Tauri configuration differences
5. WHEN the Diagnosis_Tool compares src-tauri/Cargo.toml files, THE Diagnosis_Tool SHALL identify Rust dependency differences

### Requirement 2: CSS/样式文件对比

**User Story:** As a developer, I want to compare CSS and style files, so that I can identify Tailwind CSS 4 syntax compatibility issues.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool compares src/styles.css files, THE Diagnosis_Tool SHALL identify main style entry differences
2. WHEN the Diagnosis_Tool compares src/styles/*.css files, THE Diagnosis_Tool SHALL identify all style module differences
3. WHEN the Diagnosis_Tool detects Tailwind 4 specific syntax (@utility, @import "tailwindcss"), THE Diagnosis_Tool SHALL flag potential compatibility issues
4. WHEN the Diagnosis_Tool finds CSS syntax that may cause build errors, THE Diagnosis_Tool SHALL mark them as critical issues

### Requirement 3: 核心代码对比

**User Story:** As a developer, I want to compare core application files, so that I can identify changes that may affect theme switching and application behavior.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool compares src/main.tsx files, THE Diagnosis_Tool SHALL identify entry file differences
2. WHEN the Diagnosis_Tool compares src/contexts/ThemeContext.tsx files, THE Diagnosis_Tool SHALL identify theme switching logic differences
3. WHEN the Diagnosis_Tool compares src/App.tsx files, THE Diagnosis_Tool SHALL identify main application component differences

### Requirement 4: 新增/删除文件检测

**User Story:** As a developer, I want to detect added and removed files, so that I can identify potentially problematic file changes.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool scans both directories, THE Diagnosis_Tool SHALL list all files added in Current_Project
2. WHEN the Diagnosis_Tool scans both directories, THE Diagnosis_Tool SHALL list all files removed from Current_Project
3. WHEN the Diagnosis_Tool detects markdown files that may cause Tailwind scanning errors, THE Diagnosis_Tool SHALL flag them as potential issues

### Requirement 5: 编码问题检测

**User Story:** As a developer, I want to detect encoding issues, so that I can identify files that may cause CSS parsing errors.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool scans files, THE Diagnosis_Tool SHALL detect files with BOM markers
2. WHEN the Diagnosis_Tool scans file paths, THE Diagnosis_Tool SHALL detect paths containing characters that may be misinterpreted as CSS escape sequences (e.g., \f5190d)
3. IF encoding issues are detected, THEN THE Diagnosis_Tool SHALL list affected files with specific issue descriptions

### Requirement 6: 差异报告生成

**User Story:** As a developer, I want a comprehensive diff report, so that I can understand and fix all issues systematically.

#### Acceptance Criteria

1. WHEN the Diagnosis_Tool completes analysis, THE Diagnosis_Tool SHALL generate a diff report sorted by severity (critical, warning, info)
2. WHEN critical differences are found, THE Diagnosis_Tool SHALL mark them as build-failure causes
3. WHEN issues are identified, THE Diagnosis_Tool SHALL provide specific fix steps for each issue
4. WHEN file restoration is needed, THE Diagnosis_Tool SHALL list files to restore from Backup_Project
