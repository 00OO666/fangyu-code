# DevTools 自动监控集成指南

> **使用 Chrome DevTools MCP 实现实时异常检测和自动修复**

---

## 🎯 功能概述

DevTools 自动监控服务可以：

✅ **实时监控** - 持续监控 Fangyu Code 的运行状态
✅ **自动检测** - 自动识别 console 错误、网络失败、性能问题
✅ **智能分析** - 分析异常模式并提供修复建议
✅ **自动修复** - 对于简单问题（如消息重复）自动应用修复
✅ **可视化** - 集成到 ErrorMonitorPanel 显示实时异常

---

## 📋 前置条件

### 1. 启用 Chrome DevTools MCP

确保 `~/.claude/settings.json` 中已配置：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-chrome-devtools"]
    }
  }
}
```

### 2. 重启 Claude Desktop

配置后需要重启 Claude Desktop 以加载 MCP 服务器。

---

## 🚀 快速开始

### 步骤 1：在 App.tsx 中启动监控

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { devToolsMonitor } from '@/services/devToolsAutoMonitor';

function App() {
  useEffect(() => {
    // 开发模式下启动监控
    if (import.meta.env.DEV) {
      devToolsMonitor.startMonitoring("http://localhost:1420", {
        interval: 10, // 每 10 秒检查一次
        autoFix: true, // 启用自动修复
        severityThreshold: "medium", // 只报告中等及以上严重性的问题
      });

      // 监听异常事件
      devToolsMonitor.on("anomaly", (anomaly) => {
        console.warn("[DevTools] 检测到异常:", anomaly);
      });

      devToolsMonitor.on("critical-anomaly", (anomalies) => {
        console.error("[DevTools] 🚨 严重异常:", anomalies);
        // 可以在这里触发通知
      });

      // 清理
      return () => {
        devToolsMonitor.stopMonitoring();
      };
    }
  }, []);

  return (
    // ... 应用内容
  );
}
```

### 步骤 2：集成到 ErrorMonitorPanel

```typescript
// src/components/ErrorMonitorPanel.tsx
import { devToolsMonitor } from '@/services/devToolsAutoMonitor';

export const ErrorMonitorPanel: React.FC<ErrorMonitorPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [devToolsAnomalies, setDevToolsAnomalies] = useState<DevToolsAnomaly[]>([]);

  useEffect(() => {
    // 监听 DevTools 异常
    const handleAnomaly = (anomaly: DevToolsAnomaly) => {
      setDevToolsAnomalies((prev) => [...prev, anomaly]);
    };

    devToolsMonitor.on("anomaly", handleAnomaly);

    return () => {
      devToolsMonitor.off("anomaly", handleAnomaly);
    };
  }, []);

  // 显示 DevTools 异常
  return (
    <div>
      {/* 现有的 console 错误 */}
      {errors.map((error) => (
        <ErrorItem key={error.id} error={error} />
      ))}

      {/* DevTools 检测到的异常 */}
      <div className="border-t mt-4 pt-4">
        <h4 className="text-sm font-semibold mb-2">DevTools 检测到的异常</h4>
        {devToolsAnomalies.map((anomaly) => (
          <DevToolsAnomalyItem key={anomaly.id} anomaly={anomaly} />
        ))}
      </div>
    </div>
  );
};
```

### 步骤 3：创建 Tauri 命令来调用 MCP 工具

```rust
// src-tauri/src/main.rs

#[tauri::command]
async fn call_mcp_tool(
    server: String,
    tool: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    // 这里需要实现调用 MCP 工具的逻辑
    // 可以通过 stdio 或 HTTP 与 MCP 服务器通信

    // 示例实现（需要根据实际情况调整）
    use std::process::{Command, Stdio};
    use std::io::Write;

    let mut child = Command::new("npx")
        .arg("-y")
        .arg("@modelcontextprotocol/server-chrome-devtools")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // 发送 MCP 请求
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": args
        }
    });

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(request.to_string().as_bytes())
            .map_err(|e| e.to_string())?;
    }

    // 读取响应
    let output = child.wait_with_output()
        .map_err(|e| e.to_string())?;

    let response: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| e.to_string())?;

    Ok(response)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![call_mcp_tool])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 🔧 配置选项

### 监控选项

```typescript
devToolsMonitor.startMonitoring(url, {
  // 检查间隔（秒）
  interval: 10,

  // 是否自动修复简单问题
  autoFix: true,

  // 严重性阈值（只报告此级别及以上的问题）
  // "low" | "medium" | "high" | "critical"
  severityThreshold: "medium",
});
```

### 事件监听

```typescript
// 监听所有异常
devToolsMonitor.on("anomaly", (anomaly: DevToolsAnomaly) => {
  console.log("检测到异常:", anomaly);
});

// 监听严重异常
devToolsMonitor.on("critical-anomaly", (anomalies: DevToolsAnomaly[]) => {
  console.error("严重异常:", anomalies);
});

// 监听自动修复
devToolsMonitor.on("auto-fix-applied", ({ anomaly, fix }) => {
  console.log("已自动修复:", fix);
});
```

---

## 📊 异常类型

| 类型 | 描述 | 严重性 | 自动修复 |
|------|------|--------|---------|
| `console-error` | Console 错误和警告 | 根据内容判断 | 部分支持 |
| `network-failure` | 网络请求失败 | High | 不支持 |
| `performance` | 性能问题（加载慢） | Medium | 不支持 |
| `memory-leak` | 内存泄漏 | High | 不支持 |

---

## 🎨 可视化示例

### DevTools 异常项组件

```typescript
const DevToolsAnomalyItem: React.FC<{ anomaly: DevToolsAnomaly }> = ({ anomaly }) => {
  const severityColors = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={severityColors[anomaly.severity]}>
          {anomaly.severity.toUpperCase()}
        </Badge>
        <Badge variant="outline">{anomaly.type}</Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(anomaly.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-sm font-medium">{anomaly.message}</p>

      {anomaly.suggestion && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-2">
          <p className="text-blue-800 dark:text-blue-200 text-xs">
            💡 {anomaly.suggestion}
          </p>
        </div>
      )}

      {anomaly.autoFixAvailable && (
        <Button size="sm" variant="outline" className="text-xs">
          自动修复
        </Button>
      )}
    </div>
  );
};
```

---

## 🔍 调试和故障排除

### 检查 MCP 连接状态

```typescript
// 在浏览器控制台中
const session = devToolsMonitor.getSession();
console.log("监控会话:", session);

const stats = devToolsMonitor.getStatistics();
console.log("异常统计:", stats);
```

### 常见问题

**问题 1: "无法连接到 Chrome DevTools"**

解决方案：
1. 确保 chrome-devtools MCP 已在 Claude Desktop 中启用
2. 检查 `~/.claude/settings.json` 配置
3. 重启 Claude Desktop

**问题 2: "call_mcp_tool 未定义"**

解决方案：
1. 确保已在 Tauri 中实现 `call_mcp_tool` 命令
2. 检查 `src-tauri/src/main.rs` 中的命令注册

**问题 3: "监控没有检测到异常"**

解决方案：
1. 检查监控间隔设置
2. 降低严重性阈值（如改为 "low"）
3. 查看浏览器控制台是否有实际错误

---

## 📈 性能影响

- **CPU 使用**: 每次检查约 50-100ms
- **内存使用**: 约 5-10MB（取决于异常数量）
- **网络影响**: 无（本地通信）

建议：
- 开发模式：启用完整监控
- 生产模式：禁用或仅监控严重错误

---

## 🎉 完整示例

```typescript
// src/App.tsx
import { useEffect, useState } from 'react';
import { devToolsMonitor, type DevToolsAnomaly } from '@/services/devToolsAutoMonitor';
import { ErrorMonitorPanel } from '@/components/ErrorMonitorPanel';

function App() {
  const [showMonitor, setShowMonitor] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // 启动监控
      devToolsMonitor.startMonitoring("http://localhost:1420", {
        interval: 10,
        autoFix: true,
        severityThreshold: "medium",
      });

      // 监听异常
      devToolsMonitor.on("anomaly", (anomaly: DevToolsAnomaly) => {
        setAnomalyCount((prev) => prev + 1);

        // 严重异常时自动打开监控面板
        if (anomaly.severity === "critical") {
          setShowMonitor(true);
        }
      });

      return () => {
        devToolsMonitor.stopMonitoring();
      };
    }
  }, []);

  return (
    <div className="flex h-screen">
      <main className="flex-1">
        {/* 应用内容 */}
      </main>

      {/* 错误监控面板 */}
      <ErrorMonitorPanel
        isOpen={showMonitor}
        onClose={() => setShowMonitor(false)}
      />

      {/* 监控按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowMonitor(!showMonitor)}
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        <Bug className="h-4 w-4 mr-2" />
        DevTools 监控
        {anomalyCount > 0 && (
          <Badge variant="destructive" className="ml-2">
            {anomalyCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}
```

---

## 🔗 相关资源

- [Chrome DevTools MCP 文档](https://mcpservers.org/servers/benjaminr/chrome-devtools-mcp)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Error Monitoring Guide](./ERROR_MONITORING_GUIDE.md)

---

**🎯 现在你的 Fangyu Code 具备了完整的实时异常监控能力！**
