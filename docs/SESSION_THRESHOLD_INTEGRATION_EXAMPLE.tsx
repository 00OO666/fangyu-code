/**
 * 会话阈值监控集成示例
 *
 * 在 ClaudeCodeSession 组件中集成此功能的步骤：
 */

import { useState } from "react";
import { useSessionThresholdMonitor } from "@/hooks/useSessionThresholdMonitor";
import { SessionSummaryDialog } from "@/components/SessionSummaryDialog";
import { api } from "@/lib/api";

// ============================================================================
// 示例 1: 基础集成（在 ClaudeCodeSession 组件中）
// ============================================================================

export function ClaudeCodeSessionExample() {
  // 现有的状态
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);

  // 新增：摘要对话框状态
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [sessionSummary, setSessionSummary] = useState("");

  // 新增：阈值监控
  const { status, generateSummary } = useSessionThresholdMonitor({
    sessionId: session?.id,
    messages: messages,
    config: {
      warningThreshold: 0.8,  // 80% 警告
      criticalThreshold: 0.9, // 90% 临界
      maxContextTokens: 120000,
    },
    onWarning: (status) => {
      console.warn("⚠️ 会话接近上下文限制:", status.percentage);
      // 可选：显示一个小提示
    },
    onCritical: async (status) => {
      console.error("🚨 会话达到临界值:", status.percentage);

      // 1. 停止当前任务
      if (session?.id) {
        try {
          await api.cancelClaudeExecution(session.id);
        } catch (error) {
          console.error("停止任务失败:", error);
        }
      }

      // 2. 生成摘要
      try {
        const summary = await generateSummary();
        setSessionSummary(summary);
        setShowSummaryDialog(true);
      } catch (error) {
        console.error("生成摘要失败:", error);
      }
    },
  });

  return (
    <div>
      {/* 现有的组件内容 */}

      {/* 新增：Token 使用进度条（当超过 70% 时显示） */}
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

      {/* 新增：摘要对话框 */}
      <SessionSummaryDialog
        isOpen={showSummaryDialog}
        summary={sessionSummary}
        tokenPercentage={status.percentage}
        onClose={() => setShowSummaryDialog(false)}
        onStartNewSession={() => {
          // 开启新会话的逻辑
          setShowSummaryDialog(false);
          // TODO: 实现创建新标签页或清空当前会话
        }}
        onContinueAnyway={() => {
          // 用户选择继续当前会话
          setShowSummaryDialog(false);
        }}
      />
    </div>
  );
}

// ============================================================================
// 示例 2: 手动触发摘要生成
// ============================================================================

export function ManualSummaryExample() {
  const { generateSummary } = useSessionThresholdMonitor({
    sessionId: "session-123",
    messages: [],
  });

  const handleGenerateSummary = async () => {
    try {
      const summary = await generateSummary();
      console.log("生成的摘要:", summary);
      // 复制到剪贴板
      await navigator.clipboard.writeText(summary);
      alert("摘要已复制到剪贴板");
    } catch (error) {
      console.error("生成摘要失败:", error);
    }
  };

  return (
    <button onClick={handleGenerateSummary}>
      生成会话摘要
    </button>
  );
}

// ============================================================================
// 示例 3: 自定义阈值配置
// ============================================================================

export function CustomThresholdExample() {
  const { status } = useSessionThresholdMonitor({
    sessionId: "session-123",
    messages: [],
    config: {
      warningThreshold: 0.75,  // 75% 警告
      criticalThreshold: 0.85, // 85% 临界
      maxContextTokens: 100000, // 自定义最大 token 数
    },
  });

  return (
    <div>
      <p>当前 Token 使用: {status.currentTokens}</p>
      <p>使用百分比: {(status.percentage * 100).toFixed(1)}%</p>
      <p>警告状态: {status.isWarning ? "是" : "否"}</p>
      <p>临界状态: {status.isCritical ? "是" : "否"}</p>
    </div>
  );
}

// ============================================================================
// 集成位置建议
// ============================================================================

/**
 * 在以下文件中集成：
 *
 * 1. src/components/ClaudeCodeSession.tsx
 *    - 导入 useSessionThresholdMonitor 和 SessionSummaryDialog
 *    - 添加状态管理
 *    - 在 JSX 中添加进度条和对话框
 *
 * 2. src/components/layout/ViewRouter.tsx
 *    - 如果需要全局监控，可以在这里集成
 *
 * 3. src/hooks/usePromptExecution.ts
 *    - 如果需要在发送提示前检查阈值，可以在这里集成
 */

// ============================================================================
// 测试步骤
// ============================================================================

/**
 * 1. 重启开发服务器: npm run tauri:dev
 * 2. 创建一个新会话
 * 3. 发送多条消息，观察 token 使用进度
 * 4. 当达到 80% 时，应该看到黄色进度条
 * 5. 当达到 90% 时，应该自动弹出摘要对话框
 * 6. 点击"复制摘要"按钮，验证复制功能
 * 7. 点击"开启新会话"，验证会话切换功能
 */
