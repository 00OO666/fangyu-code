# Fangyu Code 后台操作通知系统

## 概述

Fangyu Code 现在支持全局通知系统，可以在后台操作时显示通知，让用户知道发生了什么。

## 已实现的功能

### 1. 后台压缩通知 ✅

当上下文压缩时，会在右上角显示全局通知：
- **开始压缩**：显示"后台压缩中..."（不自动关闭）
- **压缩完成**：显示"压缩完成"（3 秒后自动关闭）
- **压缩失败**：显示"压缩失败"及错误信息（5 秒后自动关闭）

**实现位置**：
- `src/hooks/useBackgroundCompact.ts` - 压缩逻辑 + 通知调用
- `src/types/notification.ts` - 通知模板定义

### 2. Git 操作通知框架 ✅

已创建 Git 事件监听器，支持以下事件：
- `git-format-start` - 格式化开始
- `git-format-complete` - 格式化完成
- `git-commit-start` - 提交开始
- `git-commit-complete` - 提交完成
- `git-push-start` - 推送开始
- `git-push-complete` - 推送完成

**实现位置**：
- `src/hooks/useGitNotifications.ts` - Git 事件监听器
- `src/App.tsx` - 全局集成

## 如何为 Git 操作添加通知

### 方案 1：修改 pre-commit hook（推荐）

由于 pre-commit hook 运行在 Git 进程中，无法直接发送 Tauri 事件。需要创建一个 Node.js 脚本来包装操作：

**步骤 1：创建通知脚本**

```javascript
// .git/hooks/notify-git-event.js
const { exec } = require('child_process');

// 发送 Tauri 事件（通过 IPC）
function notifyTauri(eventName, payload = {}) {
  // 写入临时文件，让 Tauri 监听
  const fs = require('fs');
  const path = require('path');
  const eventFile = path.join(process.env.TEMP || '/tmp', 'fangyu-git-events.json');

  const event = {
    name: eventName,
    payload,
    timestamp: Date.now()
  };

  fs.appendFileSync(eventFile, JSON.stringify(event) + '\n');
}

// 使用示例
notifyTauri('git-format-start');
exec('npx @biomejs/biome check --write .', (error, stdout, stderr) => {
  if (error) {
    notifyTauri('git-format-error', { error: error.message });
  } else {
    const filesCount = (stdout.match(/Formatted/g) || []).length;
    notifyTauri('git-format-complete', { filesCount });
  }
});
```

**步骤 2：修改 pre-commit hook**

```bash
#!/bin/bash
# .git/hooks/pre-commit

# 发送格式化开始事件
node .git/hooks/notify-git-event.js format-start

# 运行格式化
echo "🔧 Running Biome formatter..."
npx @biomejs/biome check --write --no-errors-on-unmatched . 2>/dev/null

# 发送格式化完成事件
node .git/hooks/notify-git-event.js format-complete

# Add any formatted files back to the commit
git add .

echo "✅ Formatting complete"
```

### 方案 2：Tauri 文件监听器（更简单）

在 Rust 后端创建文件监听器，监听 Git 事件文件：

```rust
// src-tauri/src/commands/git_watcher.rs
use notify::{Watcher, RecursiveMode, watcher};
use std::sync::mpsc::channel;
use std::time::Duration;

#[tauri::command]
pub fn start_git_event_watcher(app_handle: tauri::AppHandle) {
    let (tx, rx) = channel();
    let mut watcher = watcher(tx, Duration::from_secs(1)).unwrap();

    let event_file = std::env::temp_dir().join("fangyu-git-events.json");
    watcher.watch(&event_file, RecursiveMode::NonRecursive).unwrap();

    std::thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(event) => {
                    // 读取事件文件并发送 Tauri 事件
                    if let Ok(content) = std::fs::read_to_string(&event_file) {
                        for line in content.lines() {
                            if let Ok(git_event) = serde_json::from_str::<GitEvent>(line) {
                                app_handle.emit_all(&git_event.name, git_event.payload).ok();
                            }
                        }
                        // 清空文件
                        std::fs::write(&event_file, "").ok();
                    }
                }
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    });
}
```

### 方案 3：Tauri 命令包装（最可靠）

创建 Tauri 命令来执行 Git 操作，这样可以直接发送事件：

```rust
// src-tauri/src/commands/git_ops.rs
use std::process::Command;

#[tauri::command]
pub async fn git_commit_with_notification(
    app_handle: tauri::AppHandle,
    message: String,
) -> Result<String, String> {
    // 发送开始事件
    app_handle.emit_all("git-commit-start", ()).ok();

    // 执行 Git 提交
    let output = Command::new("git")
        .args(&["commit", "-m", &message])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let commit_hash = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .to_string();

        // 发送完成事件
        app_handle.emit_all("git-commit-complete", serde_json::json!({
            "commitHash": commit_hash,
            "message": message
        })).ok();

        Ok(commit_hash)
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Err(error)
    }
}
```

然后在前端调用：

```typescript
import { invoke } from '@tauri-apps/api/core';

async function commitChanges(message: string) {
  try {
    const commitHash = await invoke<string>('git_commit_with_notification', { message });
    console.log('Committed:', commitHash);
  } catch (error) {
    console.error('Commit failed:', error);
  }
}
```

## 通知位置

通知系统支持 3 种位置：

1. **`chat`** - 聊天输入框上方
2. **`global`** - 右上角标题栏旁边（推荐用于后台操作）
3. **`top-center`** - 屏幕顶部居中

## 添加新的通知类型

### 步骤 1：在 `src/types/notification.ts` 添加模板

```typescript
export const NotificationTemplates = {
  // ... 现有模板

  // 🆕 你的新操作
  myOperationStart: () => ({
    type: "info" as const,
    message: "正在执行操作...",
    duration: 0, // 不自动关闭
    position: "global" as const,
  }),
  myOperationComplete: () => ({
    type: "success" as const,
    message: "操作完成",
    duration: 3000,
    position: "global" as const,
  }),
};
```

### 步骤 2：在代码中调用

```typescript
import { notify } from '@/services/notificationService';
import { NotificationTemplates } from '@/types/notification';

// 开始操作
const template = NotificationTemplates.myOperationStart();
const notificationId = notify.info(template.message, template);

// 操作完成后
notify.close(notificationId); // 关闭之前的通知
const completeTemplate = NotificationTemplates.myOperationComplete();
notify.success(completeTemplate.message, completeTemplate);
```

## 测试

### 测试后台压缩通知

由于后台压缩功能的 Rust 后端尚未实现，当前会触发超时错误通知（30 秒后）。你可以通过以下方式测试：

1. 启动 Fangyu Code
2. 在控制台运行：`window.__testCompactNotification = true`
3. 观察右上角的全局通知

### 测试 Git 通知

1. 修改代码文件
2. 运行 `git add .`
3. 运行 `git commit -m "test"`
4. 观察右上角是否显示通知

## 注意事项

1. **Token 消耗**：通知系统不消耗 Claude API token，完全在前端运行
2. **性能影响**：通知系统使用事件监听，性能开销极小
3. **用户体验**：后台操作通知应该使用 `global` 位置，避免干扰聊天界面
4. **自动关闭**：
   - 进行中的操作：`duration: 0`（不自动关闭）
   - 完成/成功：`duration: 3000`（3 秒）
   - 错误/失败：`duration: 5000`（5 秒）

## 未来改进

- [ ] 实现 Rust 后端的 Git 事件监听器
- [ ] 添加通知历史记录
- [ ] 支持通知分组（多个相关通知合并显示）
- [ ] 添加通知音效（可选）
- [ ] 支持通知优先级（重要通知置顶）
