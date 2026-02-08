/**
 * ClaudeAPITester - Claude API 代理测试组件
 *
 * 功能：
 * - 测试代理商支持的模型
 * - 检测模型替换行为
 * - 测量响应延迟
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// 类型定义
// =============================================================================

interface ModelTestResult {
  requestedModel: string;
  status: "pending" | "success" | "replaced" | "error";
  actualModel?: string;
  latency?: number;
  error?: string;
}

interface ClaudeAPITesterProps {
  apiKey: string;
  baseUrl: string;
  onClose?: () => void;
}

// =============================================================================
// 测试的模型列表
// =============================================================================

const MODELS_TO_TEST = [
  // Claude 4.5 完整格式
  { id: "claude-opus-4-5-20251101", name: "Opus 4.5", tier: "premium" },
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5", tier: "standard" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", tier: "fast" },
  // Claude 4 系列
  { id: "claude-sonnet-4-20250514", name: "Sonnet 4", tier: "standard" },
  // 简写格式
  { id: "claude-opus-4.5", name: "Opus 4.5 (简写)", tier: "premium" },
  { id: "claude-sonnet-4.5", name: "Sonnet 4.5 (简写)", tier: "standard" },
  { id: "claude-haiku-4.5", name: "Haiku 4.5 (简写)", tier: "fast" },
  // Claude 3.5 系列
  { id: "claude-3-5-sonnet-20241022", name: "Sonnet 3.5", tier: "legacy" },
  { id: "claude-3-5-haiku-20241022", name: "Haiku 3.5", tier: "legacy" },
  // Claude 3 系列
  { id: "claude-3-opus-20240229", name: "Opus 3", tier: "legacy" },
  { id: "claude-3-sonnet-20240229", name: "Sonnet 3", tier: "legacy" },
  { id: "claude-3-haiku-20240307", name: "Haiku 3", tier: "legacy" },
];

// =============================================================================
// 主组件
// =============================================================================

export const ClaudeAPITester: React.FC<ClaudeAPITesterProps> = ({ apiKey, baseUrl, onClose }) => {
  const [results, setResults] = useState<ModelTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const testModel = useCallback(
    async (modelId: string): Promise<ModelTestResult> => {
      const startTime = Date.now();

      try {
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 20,
            messages: [{ role: "user", content: "hi" }],
          }),
        });

        const latency = Date.now() - startTime;
        const data = await response.json();

        if (data.content) {
          const actualModel = data.model;
          return {
            requestedModel: modelId,
            status: modelId === actualModel ? "success" : "replaced",
            actualModel,
            latency,
          };
        } else {
          return {
            requestedModel: modelId,
            status: "error",
            error: data.error?.message?.slice(0, 60) || "未知错误",
            latency,
          };
        }
      } catch (error) {
        return {
          requestedModel: modelId,
          status: "error",
          error: error instanceof Error ? error.message : "网络错误",
          latency: Date.now() - startTime,
        };
      }
    },
    [apiKey, baseUrl]
  );

  const runAllTests = useCallback(async () => {
    setIsTesting(true);
    setResults([]);
    setProgress(0);

    const newResults: ModelTestResult[] = [];

    for (let i = 0; i < MODELS_TO_TEST.length; i++) {
      const model = MODELS_TO_TEST[i];
      setCurrentModel(model.id);

      // 先添加 pending 状态
      setResults((prev) => [...prev, { requestedModel: model.id, status: "pending" }]);

      const result = await testModel(model.id);
      newResults.push(result);

      // 更新结果
      setResults([...newResults]);
      setProgress(((i + 1) / MODELS_TO_TEST.length) * 100);

      // 间隔 500ms 避免限流
      if (i < MODELS_TO_TEST.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setCurrentModel(null);
    setIsTesting(false);
  }, [testModel]);

  const getStatusIcon = (status: ModelTestResult["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "success":
        return "✅";
      case "replaced":
        return "⚠️";
      case "error":
        return "❌";
    }
  };

  const getStatusColor = (status: ModelTestResult["status"]) => {
    switch (status) {
      case "pending":
        return "text-gray-400";
      case "success":
        return "text-green-500";
      case "replaced":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
    }
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency) return "text-gray-400";
    if (latency < 3000) return "text-green-500";
    if (latency < 10000) return "text-yellow-500";
    return "text-red-500";
  };

  // 统计
  const stats = {
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    replaced: results.filter((r) => r.status === "replaced").length,
    error: results.filter((r) => r.status === "error").length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                🔍 Claude API 代理测试
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                测试 {baseUrl} 支持的模型
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 进度条 */}
        {isTesting && (
          <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                {Math.round(progress)}%
              </span>
            </div>
            {currentModel && <p className="text-xs text-gray-400 mt-1">正在测试: {currentModel}</p>}
          </div>
        )}

        {/* 结果列表 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
          {results.length === 0 && !isTesting ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                点击下方按钮开始测试代理商支持的模型
              </p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>✅ 成功 - 模型可用且返回正确</p>
                <p>⚠️ 替换 - 模型被替换成其他模型</p>
                <p>❌ 失败 - 模型不可用</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {results.map((result, index) => {
                  const modelInfo = MODELS_TO_TEST.find((m) => m.id === result.requestedModel);
                  return (
                    <motion.div
                      key={result.requestedModel}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        flex items-center justify-between p-3 rounded-lg
                        ${result.status === "pending" ? "bg-gray-50 dark:bg-gray-800" : ""}
                        ${result.status === "success" ? "bg-green-50 dark:bg-green-900/20" : ""}
                        ${result.status === "replaced" ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}
                        ${result.status === "error" ? "bg-red-50 dark:bg-red-900/20" : ""}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${getStatusColor(result.status)}`}>
                          {getStatusIcon(result.status)}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {modelInfo?.name || result.requestedModel}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {result.requestedModel}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {result.status === "pending" && (
                          <span className="text-sm text-gray-400">测试中...</span>
                        )}
                        {result.status === "success" && (
                          <span className={`text-sm ${getLatencyColor(result.latency)}`}>
                            {result.latency}ms
                          </span>
                        )}
                        {result.status === "replaced" && (
                          <div>
                            <p className="text-sm text-yellow-600 dark:text-yellow-400">
                              → {result.actualModel?.slice(0, 25)}
                            </p>
                            <p className={`text-xs ${getLatencyColor(result.latency)}`}>
                              {result.latency}ms
                            </p>
                          </div>
                        )}
                        {result.status === "error" && (
                          <p className="text-xs text-red-500 max-w-[200px] truncate">
                            {result.error}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 统计和操作 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {results.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-green-500">✅ {stats.success} 成功</span>
              <span className="text-yellow-500">⚠️ {stats.replaced} 替换</span>
              <span className="text-red-500">❌ {stats.error} 失败</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              关闭
            </button>
            <button
              onClick={runAllTests}
              disabled={isTesting}
              className={`
                px-6 py-2 text-sm font-medium rounded-lg transition-colors
                ${
                  isTesting
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }
              `}
            >
              {isTesting ? "测试中..." : results.length > 0 ? "重新测试" : "开始测试"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClaudeAPITester;
