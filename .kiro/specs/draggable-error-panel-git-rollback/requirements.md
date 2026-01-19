# Requirements Document

## Introduction

本功能包含两个独立但相关的改进：
1. **错误监控面板拖拽功能** - 允许用户自由拖动错误监控面板到屏幕任意位置
2. **Git 代码回滚功能** - 实现完整的 Git 命令执行能力，支持代码回滚操作

## Glossary

- **Error_Monitor_Panel**: 开发模式下显示的错误监控浮动面板组件
- **Git_Command_Executor**: Tauri 后端执行 Git 命令的服务
- **Drag_Handler**: 处理面板拖拽交互的逻辑模块
- **Position_State**: 面板位置状态，包含 x/y 坐标
- **Rollback_Operation**: Git reset 或 checkout 操作，用于回滚代码到指定提交

## Requirements

### Requirement 1: 错误监控面板拖拽

**User Story:** As a developer, I want to drag the error monitor panel to any position on screen, so that it doesn't block my view of important content.

#### Acceptance Criteria

1. WHEN a user presses and holds the mouse button on the panel header, THE Drag_Handler SHALL initiate drag mode and track mouse movement
2. WHILE in drag mode, THE Error_Monitor_Panel SHALL follow the mouse cursor position in real-time
3. WHEN the user releases the mouse button, THE Drag_Handler SHALL end drag mode and save the final position
4. THE Error_Monitor_Panel SHALL persist its position to localStorage so it remembers the position across sessions
5. WHEN the panel is dragged outside the viewport boundaries, THE Drag_Handler SHALL constrain the position to keep the panel visible
6. THE Error_Monitor_Panel SHALL display a visual indicator (cursor change) when hovering over the draggable area

### Requirement 2: Git 命令执行后端

**User Story:** As a developer, I want Fangyu Code to execute Git commands, so that I can manage version control directly from the application.

#### Acceptance Criteria

1. WHEN a Git command is requested, THE Git_Command_Executor SHALL execute the command in the specified project directory
2. THE Git_Command_Executor SHALL return the command output (stdout/stderr) and exit status
3. IF the Git command fails, THEN THE Git_Command_Executor SHALL return a descriptive error message
4. THE Git_Command_Executor SHALL support the following commands: status, log, diff, add, commit, reset, checkout
5. WHEN executing Git commands, THE Git_Command_Executor SHALL validate that the directory is a valid Git repository

### Requirement 3: 代码回滚功能

**User Story:** As a developer, I want to rollback my code to a previous commit, so that I can undo unwanted changes quickly.

#### Acceptance Criteria

1. WHEN a user selects a commit and clicks "回滚到此提交", THE Rollback_Operation SHALL reset the working directory to that commit
2. WHEN performing a rollback, THE System SHALL show a confirmation dialog warning about potential data loss
3. THE Rollback_Operation SHALL support two modes: soft reset (keep changes staged) and hard reset (discard all changes)
4. WHEN a rollback is successful, THE System SHALL refresh the file list and show a success notification
5. IF a rollback fails, THEN THE System SHALL display the error message and suggest recovery steps
6. THE System SHALL create a backup branch before performing hard reset operations

### Requirement 4: Git 变更文件列表

**User Story:** As a developer, I want to see the list of changed files in my project, so that I can track my modifications.

#### Acceptance Criteria

1. WHEN the Git panel is opened, THE System SHALL display all modified, added, and deleted files
2. THE System SHALL refresh the file list automatically every 5 seconds
3. WHEN a file is clicked, THE System SHALL show the diff content for that file
4. THE System SHALL display file status indicators (M for modified, A for added, D for deleted, ? for untracked)

