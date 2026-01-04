# 通知系统使用指南

完整的通知系统使用示例，包括所有使用场景。

## 目录

- [基础用法](#基础用法)
- [在 React 组件中使用](#在-react-组件中使用)
- [在非组件代码中使用](#在非组件代码中使用)
- [使用预设模板](#使用预设模板)
- [高级用法](#高级用法)

---

## 基础用法

### 在 React 组件中使用 Hook

```tsx
import { useNotify } from '@/hooks/useNotify';

function MyComponent() {
  const notify = useNotify();

  const handleSave = async () => {
    try {
      await saveData();
      notify.success('保存成功');
    } catch (error) {
      notify.error('保存失败', {
        description: error.message,
        duration: 5000,
      });
    }
  };

  return <button onClick={handleSave}>保存</button>;
}
```

### 指定通知位置

```tsx
import { useGlobalNotify, useChatNotify } from '@/hooks/useNotify';

function SettingsPanel() {
  // 全局通知（显示在标题栏）
  const globalNotify = useGlobalNotify();

  const handleSettingChange = () => {
    globalNotify.success('设置已保存');
  };

  return <button onClick={handleSettingChange}>保存设置</button>;
}

function ChatInput() {
  // 聊天通知（显示在输入框上方）
  const chatNotify = useChatNotify();

  const handleSend = () => {
    chatNotify.success('消息已发送');
  };

  return <button onClick={handleSend}>发送</button>;
}
```

---

## 在 React 组件中使用

### 示例 1: MCP 工具开关

```tsx
// F:\Fangyu-Code-Dev\src\components\settings\MCPToolsList.tsx
import { useGlobalNotify } from '@/hooks/useNotify';

export const MCPToolsList: React.FC = () => {
  const notify = useGlobalNotify();

  const handleToggleTool = async (toolName: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableMCPTool(toolName);
        notify.fromTemplate('mcpEnabled', toolName);
        // 或者手动写：
        // notify.success(`已启用 MCP 工具：${toolName}`, { duration: 3000 });
      } else {
        await disableMCPTool(toolName);
        notify.fromTemplate('mcpDisabled', toolName);
      }
    } catch (error) {
      notify.error(`操作失败：${error.message}`, { duration: 5000 });
    }
  };

  return (
    <div>
      {/* MCP 工具列表 */}
    </div>
  );
};
```

### 示例 2: Hook 管理

```tsx
// F:\Fangyu-Code-Dev\src\components\settings\HookManager.tsx
import { useGlobalNotify } from '@/hooks/useNotify';

export const HookManager: React.FC = () => {
  const notify = useGlobalNotify();

  const handleToggleHook = (hookName: string, enabled: boolean) => {
    if (enabled) {
      notify.fromTemplate('hookEnabled', hookName);
    } else {
      notify.fromTemplate('hookDisabled', hookName);
    }
  };

  return (
    <div>
      {/* Hook 列表 */}
    </div>
  );
};
```

### 示例 3: 项目记忆创建

```tsx
// F:\Fangyu-Code-Dev\src\components\memory\ProjectMemoryPrompt.tsx
import { useChatNotify } from '@/hooks/useNotify';

export const ProjectMemoryPrompt: React.FC = () => {
  const notify = useChatNotify();

  const handleCreateMemory = async (projectName: string) => {
    try {
      await createProjectMemory(projectName);
      notify.fromTemplate('memoryCreated', projectName);
    } catch (error) {
      notify.error('创建记忆失败', {
        description: error.message,
        duration: 5000,
      });
    }
  };

  return (
    <Dialog>
      {/* 创建记忆对话框 */}
    </Dialog>
  );
};
```

### 示例 4: 会话操作

```tsx
// F:\Fangyu-Code-Dev\src\components\SessionList.tsx
import { useNotify } from '@/hooks/useNotify';

export const SessionList: React.FC = () => {
  const notify = useNotify({ defaultPosition: 'chat' });

  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    try {
      await deleteSession(sessionId);
      notify.fromTemplate('sessionDeleted', sessionName);
    } catch (error) {
      notify.error('删除失败', { description: error.message });
    }
  };

  const handleRenameSession = async (sessionId: string, oldName: string, newName: string) => {
    try {
      await renameSession(sessionId, newName);
      notify.fromTemplate('sessionRenamed', oldName, newName);
    } catch (error) {
      notify.error('重命名失败', { description: error.message });
    }
  };

  return (
    <div>
      {/* 会话列表 */}
    </div>
  );
};
```

### 示例 5: 带操作按钮的通知

```tsx
import { useNotify } from '@/hooks/useNotify';

export const FileUploader: React.FC = () => {
  const notify = useNotify();

  const handleUploadComplete = (fileId: string) => {
    notify.success('文件上传成功', {
      description: '点击查看文件',
      action: {
        label: '查看',
        onClick: () => {
          window.open(`/files/${fileId}`);
        },
      },
      duration: 10000, // 10秒后自动关闭
    });
  };

  return (
    <div>
      {/* 上传组件 */}
    </div>
  );
};
```

---

## 在非组件代码中使用

在工具函数、Service、API 调用等非 React 组件中，可以直接使用 `notify` 对象：

### 示例 1: API 调用

```tsx
// F:\Fangyu-Code-Dev\src\lib\api.ts
import { notify } from '@/components/notifications';

export async function saveSetting(key: string, value: any) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });

    if (!response.ok) throw new Error('保存失败');

    // 全局通知
    notify.global.success('设置已保存');
    return await response.json();
  } catch (error) {
    notify.global.error('设置保存失败', {
      description: error.message,
      duration: 5000,
    });
    throw error;
  }
}
```

### 示例 2: Tauri 命令调用

```tsx
// F:\Fangyu-Code-Dev\src\lib\tauriCommands.ts
import { invoke } from '@tauri-apps/api/core';
import { notify } from '@/components/notifications';

export async function selectProjectPath(): Promise<string | null> {
  try {
    const path = await invoke<string | null>('select_directory');
    if (path) {
      notify.chat.info(`已选择项目路径：${path}`);
    }
    return path;
  } catch (error) {
    notify.chat.error('选择路径失败', {
      description: error.message,
    });
    return null;
  }
}
```

### 示例 3: 错误处理器

```tsx
// F:\Fangyu-Code-Dev\src\lib\errorHandler.ts
import { notify } from '@/components/notifications';

export function handleApiError(error: any, operation: string) {
  console.error(`[${operation}] Error:`, error);

  if (error.response?.status === 401) {
    notify.global.error('认证失败', {
      description: '请重新登录',
      action: {
        label: '登录',
        onClick: () => window.location.href = '/login',
      },
      duration: 0, // 不自动关闭
    });
  } else if (error.response?.status === 403) {
    notify.global.error('权限不足', {
      description: '您没有执行此操作的权限',
    });
  } else {
    notify.global.error(`${operation}失败`, {
      description: error.message || '未知错误',
    });
  }
}
```

---

## 使用预设模板

所有预设模板都在 `src/types/notification.ts` 的 `NotificationTemplates` 中定义。

### 在 Hook 中使用模板

```tsx
import { useGlobalNotify } from '@/hooks/useNotify';

function SettingsPanel() {
  const notify = useGlobalNotify();

  // 使用模板
  notify.fromTemplate('hookEnabled', 'auto-compact');
  notify.fromTemplate('mcpEnabled', 'GitHub');
  notify.fromTemplate('settingsSaved');
}
```

### 在非组件中使用模板

```tsx
import { notify } from '@/components/notifications';

// 指定位置
notify.template('memoryCreated', 'chat', 'My Project');
notify.template('engineSwitched', 'global', 'Gemini');
```

### 可用的模板列表

```typescript
// 记忆系统
NotificationTemplates.memoryCreated(projectName: string)
NotificationTemplates.memoryLoaded(projectName: string)
NotificationTemplates.memoryUpdated(projectName: string)

// Hook 管理
NotificationTemplates.hookEnabled(hookName: string)
NotificationTemplates.hookDisabled(hookName: string)

// MCP 工具
NotificationTemplates.mcpEnabled(toolName: string)
NotificationTemplates.mcpDisabled(toolName: string)

// Skill 管理
NotificationTemplates.skillEnabled(skillName: string)
NotificationTemplates.skillDisabled(skillName: string)

// 设置更改
NotificationTemplates.settingsSaved()
NotificationTemplates.settingsFailed(error: string)

// 执行引擎
NotificationTemplates.engineSwitched(engineName: string)

// 模型切换
NotificationTemplates.modelChanged(modelName: string)

// 会话操作
NotificationTemplates.sessionCreated(sessionName: string)
NotificationTemplates.sessionDeleted(sessionName: string)
NotificationTemplates.sessionRenamed(oldName: string, newName: string)

// 项目操作
NotificationTemplates.projectCreated(projectName: string)
NotificationTemplates.projectSwitched(projectName: string)

// 通用操作
NotificationTemplates.operationSuccess(operation: string)
NotificationTemplates.operationFailed(operation: string, error?: string)
```

---

## 高级用法

### 自定义默认配置

```tsx
import { useNotify } from '@/hooks/useNotify';

function MyComponent() {
  const notify = useNotify({
    defaultPosition: 'global',
    defaultDuration: 5000,
  });

  // 所有通知都会在标题栏显示，持续 5 秒
  notify.success('操作成功');
}
```

### 手动控制通知关闭

```tsx
import { useNotify } from '@/hooks/useNotify';

function MyComponent() {
  const notify = useNotify();

  const handleLongOperation = async () => {
    // 显示持久通知（不自动关闭）
    const notificationId = notify.info('正在处理，请稍候...', {
      duration: 0, // 0 表示不自动关闭
    });

    try {
      await longRunningTask();
      // 关闭之前的通知
      notify.close(notificationId);
      // 显示成功通知
      notify.success('处理完成');
    } catch (error) {
      notify.close(notificationId);
      notify.error('处理失败', { description: error.message });
    }
  };

  return <button onClick={handleLongOperation}>开始处理</button>;
}
```

### 关闭所有通知

```tsx
import { useNotify } from '@/hooks/useNotify';

function MyComponent() {
  const notify = useNotify();

  const handleClearAll = () => {
    notify.closeAll();
  };

  return <button onClick={handleClearAll}>清除所有通知</button>;
}
```

### 不同类型的通知

```tsx
import { useNotify } from '@/hooks/useNotify';

function NotificationDemo() {
  const notify = useNotify();

  return (
    <div className="space-y-2">
      <button onClick={() => notify.success('成功消息')}>
        成功通知
      </button>
      <button onClick={() => notify.error('错误消息')}>
        错误通知
      </button>
      <button onClick={() => notify.info('信息消息')}>
        信息通知
      </button>
      <button onClick={() => notify.warning('警告消息')}>
        警告通知
      </button>
    </div>
  );
}
```

---

## 完整示例：设置页面

```tsx
// F:\Fangyu-Code-Dev\src\components\settings\SettingsPanel.tsx
import React, { useState } from 'react';
import { useGlobalNotify } from '@/hooks/useNotify';
import { Button } from '@/components/ui/button';

export const SettingsPanel: React.FC = () => {
  const notify = useGlobalNotify();
  const [settings, setSettings] = useState({
    theme: 'dark',
    language: 'zh-CN',
    autoSave: true,
  });

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      notify.fromTemplate('settingsSaved');
    } catch (error) {
      notify.fromTemplate('settingsFailed', error.message);
    }
  };

  const handleToggleAutoSave = (enabled: boolean) => {
    setSettings({ ...settings, autoSave: enabled });
    if (enabled) {
      notify.success('已启用自动保存', { duration: 2000 });
    } else {
      notify.info('已禁用自动保存', { duration: 2000 });
    }
  };

  const handleThemeChange = (theme: string) => {
    setSettings({ ...settings, theme });
    notify.info(`已切换主题：${theme}`, { duration: 2000 });
  };

  return (
    <div className="space-y-4">
      {/* 设置选项 */}
      <div>
        <label>主题</label>
        <select onChange={(e) => handleThemeChange(e.target.value)} value={settings.theme}>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="auto">自动</option>
        </select>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => handleToggleAutoSave(e.target.checked)}
          />
          自动保存
        </label>
      </div>

      <Button onClick={handleSave}>保存设置</Button>
    </div>
  );
};
```

---

## 最佳实践

1. **在 React 组件中优先使用 Hook**
   - 使用 `useGlobalNotify()` 处理全局设置变更
   - 使用 `useChatNotify()` 处理聊天相关操作

2. **在非组件代码中使用 `notify` 对象**
   - API 调用、工具函数、错误处理器等

3. **善用预设模板**
   - 保持通知消息的一致性
   - 减少重复代码

4. **合理设置持续时间**
   - 成功/信息：2-3 秒
   - 警告：3-5 秒
   - 错误：5-10 秒
   - 需要用户操作：设为 0（不自动关闭）

5. **提供有用的描述**
   - 错误通知应该包含错误原因
   - 操作通知应该说明下一步

6. **使用操作按钮**
   - 为用户提供快捷操作
   - 例如：上传成功后提供"查看"按钮

---

## 故障排查

### 通知不显示

1. 检查是否正确集成了通知组件：
   - `ChatNotification` 在 `ClaudeCodeSession.tsx` 中
   - `GlobalNotification` 在 `TabManager.tsx` 中

2. 检查通知位置是否正确：
   ```tsx
   // 聊天区域通知
   notify.chat.success('消息');

   // 全局通知（标题栏）
   notify.global.success('消息');
   ```

### 通知不会自动关闭

检查 `duration` 设置：
```tsx
// 不自动关闭
notify.success('消息', { duration: 0 });

// 3 秒后关闭
notify.success('消息', { duration: 3000 });
```

### TypeScript 类型错误

确保导入了正确的类型：
```tsx
import type { NotifyAPI, NotificationOptions } from '@/components/notifications';
```

---

## 总结

通知系统提供了灵活、统一的用户反馈机制：

- ✅ 两种位置：聊天区域（输入框上方）+ 全局（标题栏）
- ✅ 四种类型：成功、错误、信息、警告
- ✅ Hook 方式：在组件中使用
- ✅ 对象方式：在非组件中使用
- ✅ 预设模板：保持消息一致性
- ✅ 自定义配置：持续时间、描述、操作按钮

现在你可以在任何地方轻松显示通知！
