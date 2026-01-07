# 会话阈值监控和自动摘要功能 - 集成指南

## 功能概述

当会话的 token 使用量接近上下文限制时，自动：
1. 停止当前任务
2. 生成会话摘要（markdown 格式）
3. 弹出对话框，提供一键复制和开启新会话功能

## 已创建的文件

1. `src/hooks/useSessionThresholdMonitor.ts` - 阈值监控 hook
2. `src/components/SessionSummaryDialog.tsx` - 摘要对话框组件
3. `src/lib/api.ts` - 添加了 `generateTextWithLLM` 方法

## 集成步骤

### 1. 在 ClaudeCodeSession 组件中使用

```typescript
import { useSessionThresholdMonitor } from "@/hooks/useSessionThresholdMonitor";
import { SessionSummaryDialog } from "@/components/SessionSummaryDialog";
import { useState } from "react";

// 在组件内部
const [showSummaryDialog, setShowSummaryDialog] = useState(false);
const [sessionSummary, setSessionSummary] = useState("");

// 使用阈值监控 hook
const { status, generateSummary } = useSessionThresholdMonitor({
  sessionId: session?.id,
  messages: messages, // 当前会话的所有消息
  config: {
    warningThreshold: 0.8,  // 80% 时警告
    criticalThreshold: 0.9, // 90% 时强制触发
    maxContextTokens: 120000,
  },
  onWarning: (status) => {
    console.warn("会话接近上下文限制:", status);
    // 可以显示一个小提示
  },
  onCritical: async (status) => {
    console.error("会话达到临界值:", status);

    // 停止当前任务
    if (session?.id) {
      await api.cancelClaudeExecution(session.id);
    }

    // 生成摘要
    const summary = await generateSummary();
    setSessionSummary(summary);
    setShowSummaryDialog(true);
  },
  onSummaryGenerated: (summary) => {
    console.log("摘要已生成:", summary);
  },
});

// 在 JSX 中添加对话框
return (
  <>
    {/* 现有的组件内容 */}

    <SessionSummaryDialog
      isOpen={showSummaryDialog}
      summary={sessionSummary}
      tokenPercentage={status.percentage}
      onClose={() => setShowSummaryDialog(false)}
      onStartNewSession={() => {
        // 开启新会话的逻辑
        setShowSummaryDialog(false);
        // 创建新标签页或清空当前会话
      }}
      onContinueAnyway={() => {
        // 用户选择继续当前会话
        setShowSummaryDialog(false);
      }}
    />
  </>
);
```

### 2. 后端实现（Rust）

需要在 `src-tauri/src/commands/` 中添加 `generate_text_with_llm` 命令：

```rust
#[tauri::command]
pub async fn generate_text_with_llm(
    prompt: String,
    model: String,
) -> Result<String, String> {
    // 调用 Claude API 生成文本
    // 使用 Haiku 模型以节省成本

    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY not set".to_string())?;

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": format!("claude-{}", model),
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let text = data["content"][0]["text"]
        .as_str()
        .ok_or("No text in response")?
        .to_string();

    Ok(text)
}
```

然后在 `main.rs` 中注册命令：

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... 其他命令
            generate_text_with_llm,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. 配置选项

可以在设置中添加阈值配置：

```typescript
interface ThresholdSettings {
  enabled: boolean;
  warningThreshold: number;  // 0.8 = 80%
  criticalThreshold: number; // 0.9 = 90%
  autoStopOnCritical: boolean; // 是否自动停止任务
  autoGenerateSummary: boolean; // 是否自动生成摘要
}
```

### 4. 显示进度条

在会话界面顶部显示 token 使用进度：

```typescript
{status.percentage > 0.7 && (
  <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm text-yellow-200">
        上下文使用: {Math.round(status.percentage * 100)}%
      </span>
      <button
        onClick={async () => {
          const summary = await generateSummary();
          setSessionSummary(summary);
          setShowSummaryDialog(true);
        }}
        className="text-xs text-yellow-300 hover:text-yellow-100"
      >
        生成摘要
      </button>
    </div>
    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all ${
          status.isCritical ? "bg-red-500" : "bg-yellow-500"
        }`}
        style={{ width: `${Math.min(status.percentage * 100, 100)}%` }}
      />
    </div>
  </div>
)}
```

## 工作流程

1. **正常使用**：用户正常聊天，token 使用量逐渐增加
2. **80% 警告**：显示黄色进度条，提示用户接近限制
3. **90% 临界**：
   - 自动停止当前任务（调用 `cancelClaudeExecution`）
   - 生成会话摘要（使用 Haiku 模型）
   - 弹出对话框显示摘要
4. **用户选择**：
   - 复制摘要 → 开启新会话 → 粘贴摘要继续
   - 或者选择"继续当前会话"（风险自负）

## 优势

1. **自动化**：无需手动监控 token 使用
2. **成本优化**：使用 Haiku 模型生成摘要，成本低
3. **用户体验**：一键复制摘要，快速恢复上下文
4. **避免错误**：在达到限制前主动处理，避免 thinking blocks 错误

## 注意事项

1. Token 估算是近似值，实际使用可能有偏差
2. 摘要生成需要几秒钟，期间会显示加载状态
3. 建议在 80% 时就开始考虑开启新会话
4. 摘要质量取决于会话内容的复杂度

## 下一步

1. 实现后端的 `generate_text_with_llm` 命令
2. 在 `ClaudeCodeSession` 组件中集成
3. 添加设置页面，允许用户配置阈值
4. 测试不同场景下的表现
