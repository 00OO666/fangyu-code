# Design Document

## Overview

本设计文档描述两个功能的技术实现方案：
1. **错误监控面板拖拽** - 前端 React 组件增强，支持拖拽交互
2. **Git 命令执行与回滚** - Tauri 后端 + 前端集成，实现完整的 Git 操作能力

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ErrorMonitorPanel.tsx          GitChangesPanel.tsx          │
│  ├─ useDraggable hook           ├─ useGitAutoCommit hook     │
│  ├─ Position persistence        ├─ Rollback UI               │
│  └─ Boundary constraints        └─ Confirmation dialogs      │
├─────────────────────────────────────────────────────────────┤
│                      Tauri IPC Bridge                        │
├─────────────────────────────────────────────────────────────┤
│                      Backend (Rust)                          │
│  src-tauri/src/commands/git.rs                               │
│  ├─ execute_git_command                                      │
│  ├─ git_status                                               │
│  ├─ git_log                                                  │
│  ├─ git_diff                                                 │
│  ├─ git_reset                                                │
│  └─ git_create_backup_branch                                 │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. useDraggable Hook

```typescript
interface DraggableOptions {
  /** 初始位置 */
  initialPosition?: { x: number; y: number };
  /** localStorage 存储键 */
  storageKey?: string;
  /** 是否约束在视口内 */
  constrainToViewport?: boolean;
  /** 面板尺寸（用于边界计算） */
  panelSize?: { width: number; height: number };
}

interface DraggableResult {
  /** 当前位置 */
  position: { x: number; y: number };
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 拖拽区域的事件处理器 */
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: { cursor: string };
  };
  /** 重置位置到默认值 */
  resetPosition: () => void;
}

function useDraggable(options: DraggableOptions): DraggableResult;
```

### 2. Git Command Executor (Rust)

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommandResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub exit_code: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "M", "A", "D", "?", "R"
    pub staged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
    pub files_changed: i32,
    pub insertions: i32,
    pub deletions: i32,
}

// Tauri Commands
#[tauri::command]
async fn git_status(project_path: String) -> Result<Vec<GitFileStatus>, String>;

#[tauri::command]
async fn git_log(project_path: String, count: i32) -> Result<Vec<GitCommitInfo>, String>;

#[tauri::command]
async fn git_diff(project_path: String, file_path: Option<String>) -> Result<String, String>;

#[tauri::command]
async fn git_reset(
    project_path: String, 
    commit_hash: String, 
    mode: String, // "soft", "mixed", "hard"
    create_backup: bool
) -> Result<GitCommandResult, String>;

#[tauri::command]
async fn git_create_backup_branch(project_path: String) -> Result<String, String>;
```

### 3. Frontend Git Service

```typescript
// src/lib/gitService.ts
export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R';
  staged: boolean;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitResetOptions {
  commitHash: string;
  mode: 'soft' | 'mixed' | 'hard';
  createBackup: boolean;
}

export const gitService = {
  getStatus: (projectPath: string) => Promise<GitFileStatus[]>,
  getLog: (projectPath: string, count?: number) => Promise<GitCommitInfo[]>,
  getDiff: (projectPath: string, filePath?: string) => Promise<string>,
  reset: (projectPath: string, options: GitResetOptions) => Promise<boolean>,
  createBackupBranch: (projectPath: string) => Promise<string>,
};
```

## Data Models

### Position State (localStorage)

```typescript
interface PanelPosition {
  x: number;  // 距离视口左边的像素
  y: number;  // 距离视口顶部的像素
}

// localStorage key: "fangyu-error-panel-position"
// 默认位置: { x: window.innerWidth - 420 - 16, y: window.innerHeight - 560 - 16 }
```

### Git Reset Confirmation State

```typescript
interface ResetConfirmation {
  isOpen: boolean;
  targetCommit: GitCommitInfo | null;
  mode: 'soft' | 'mixed' | 'hard';
  backupBranchName: string | null;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Drag Position Tracking

*For any* mouse movement delta (dx, dy) during drag mode, the panel position should change by exactly (dx, dy) from its previous position.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Position Persistence Round-Trip

*For any* valid panel position, saving to localStorage and then loading should produce the same position value.

**Validates: Requirements 1.4**

### Property 3: Viewport Boundary Constraint

*For any* panel position (x, y) and viewport size (vw, vh), the constrained position should satisfy:
- 0 <= x <= vw - panelWidth
- 0 <= y <= vh - panelHeight

**Validates: Requirements 1.5**

### Property 4: Git Error Handling

*For any* Git command execution on an invalid repository or with invalid parameters, the result should contain a non-empty error message and success should be false.

**Validates: Requirements 2.3, 2.5**

### Property 5: Reset Mode Behavior

*For any* Git reset operation:
- If mode is "soft", staged changes should be preserved
- If mode is "hard", all changes should be discarded
- If createBackup is true, a backup branch should exist before reset

**Validates: Requirements 3.3, 3.6**

### Property 6: File Status Mapping

*For any* Git file status character ('M', 'A', 'D', '?', 'R'), the UI should display the corresponding indicator (Modified, Added, Deleted, Untracked, Renamed).

**Validates: Requirements 4.4**

## Error Handling

### Frontend Errors

| Error Type | Handling Strategy |
|------------|-------------------|
| Drag outside viewport | Constrain to viewport bounds |
| localStorage unavailable | Use in-memory fallback |
| Git command timeout | Show timeout error, suggest retry |
| Invalid Git repository | Show "Not a Git repository" message |

### Backend Errors

| Error Type | Handling Strategy |
|------------|-------------------|
| Git not installed | Return error with installation instructions |
| Permission denied | Return error with permission fix suggestion |
| Network error (push/pull) | Return error with network troubleshooting |
| Merge conflict | Return conflict details for user resolution |

## Testing Strategy

### Unit Tests

1. **useDraggable hook tests**
   - Initial position from localStorage
   - Position update on mouse move
   - Boundary constraint logic
   - Reset position functionality

2. **Git service tests**
   - Mock Tauri invoke calls
   - Error handling for various failure modes
   - Data transformation from Rust to TypeScript

### Property-Based Tests

使用 fast-check 库进行属性测试：

1. **Position constraint property** - 生成随机位置，验证约束后的位置在视口内
2. **Persistence round-trip property** - 生成随机位置，验证存储和加载的一致性
3. **Status mapping property** - 生成所有可能的 Git 状态，验证映射正确性

### Integration Tests

1. **Git command execution** - 在真实 Git 仓库中测试命令执行
2. **Reset operation** - 测试 soft/hard reset 的实际效果
3. **Backup branch creation** - 验证备份分支正确创建

