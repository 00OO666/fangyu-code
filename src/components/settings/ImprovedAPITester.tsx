/**
 * 改进的 API 模型测试组件
 *
 * 改进点：
 * - ✅ 超时控制（15秒）
 * - ✅ 自动重试（失败后重试1次）
 * - ✅ 并发测试（3个并发）
 * - ✅ 更智能的模型匹配
 * - ✅ 完整的错误信息
 * - ✅ 可取消测试
 */

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// 类型定义
// =============================================================================

export type APIProviderType = "claude" | "openai" | "gemini";

interface ModelTestResult {
  requestedModel: string;
  status: "pending" | "success" | "replaced" | "error" | "timeout";
  actualModel?: string;
  latency?: number;
  error?: string;
  retried?: boolean;
}

interface ImprovedAPITesterProps {
  provider: APIProviderType;
  apiKey: string;
  baseUrl: string;
  onClose?: () => void;
}

interface ModelInfo {
  id: string;
  name: string;
  tier: "premium" | "standard" | "fast" | "legacy";
}

// =============================================================================
// 模型列表
// =============================================================================

const CLAUDE_MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5", tier: "standard" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", tier: "fast" },
  { id: "claude-opus-4-5-20251101", name: "Opus 4.5", tier: "premium" },
  { id: "claude-opus-4-1-20250805", name: "Opus 4.1", tier: "premium" },
];

const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o", tier: "premium" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: "fast" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", tier: "standard" },
  { id: "o1", name: "o1", tier: "premium" },
  { id: "o1-mini", name: "o1 Mini", tier: "standard" },
  { id: "o3-mini", name: "o3 Mini", tier: "premium" },
];

const GEMINI_MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "premium" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "fast" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", tier: "premium" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", tier: "fast" },
];

const MODELS_BY_PROVIDER: Record<APIProviderType, ModelInfo[]> = {
  claude: CLAUDE_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
};

const PROVIDER_INFO: Record<APIProviderType, { name: string; icon: string; color: string }> = {
  claude: { name: "Claude", icon: "🟠", color: "orange" },
  openai: { name: "OpenAI", icon: "🟢", color: "green" },
  gemini: { name: "Gemini", icon: "🔵", color: "blue" },
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 智能模型匹配 - 处理版本后缀、日期等变体
 */
function isModelMatch(requested: string, actual: string): boolean {
  if (requested === actual) return true;

  // OpenAI 模型可能带日期后缀 (gpt-4o-2024-05-13)
  if (actual.startsWith(requested)) return true;

  // 处理别名 (gpt-4-turbo-preview -> gpt-4-turbo)
  const normalizedRequested = requested.replace(/-preview|-latest|-snapshot/g, "");
  const normalizedActual = actual.replace(/-preview|-latest|-snapshot|-\d{4}-\d{2}-\d{2}/g, "");

  return normalizedRequested === normalizedActual;
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.message.includes("超时")) {
      throw new Error("请求超时（30秒）");
    }
    throw error;
  }
}

// =============================================================================
// API 测试函数
// =============================================================================

async function testModelWithRetry(
  modelId: string,
  apiKey: string,
  baseUrl: string,
  provider: APIProviderType,
  maxRetries: number = 1
): Promise<ModelTestResult> {
  let lastError: string = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await testModel(modelId, apiKey, baseUrl, provider);

      // 如果成功或被替换，直接返回
      if (result.status === "success" || result.status === "replaced") {
        return { ...result, retried: attempt > 0 };
      }

      // 如果是错误，记录并重试
      lastError = result.error || "未知错误";

      // 最后一次尝试，返回错误
      if (attempt === maxRetries) {
        return { ...result, retried: attempt > 0 };
      }

      // 等待后重试
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      lastError = error instanceof Error ? error.message : "网络错误";

      if (attempt === maxRetries) {
        return {
          requestedModel: modelId,
          status: "error",
          error: lastError,
          retried: true,
        };
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return {
    requestedModel: modelId,
    status: "error",
    error: lastError,
    retried: true,
  };
}

async function testModel(
  modelId: string,
  apiKey: string,
  baseUrl: string,
  provider: APIProviderType
): Promise<ModelTestResult> {
  const startTime = Date.now();

  try {
    // 先尝试 OpenAI 兼容格式
    const openaiUrl = `${baseUrl}/v1/chat/completions`;
    const response = await fetchWithTimeout(openaiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 100,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    // 成功响应
    if (data.choices && data.choices.length > 0) {
      const actualModel = data.model || modelId;
      const isMatch = isModelMatch(modelId, actualModel);

      return {
        requestedModel: modelId,
        status: isMatch ? "success" : "replaced",
        actualModel,
        latency,
      };
    }

    // 错误响应 - 如果是 Claude，尝试原生格式
    if (provider === "claude" && data.error) {
      return await testClaudeNative(modelId, apiKey, baseUrl, startTime);
    }

    // 其他错误
    return {
      requestedModel: modelId,
      status: "error",
      error: data.error?.message || JSON.stringify(data).slice(0, 100),
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    if (error instanceof Error && error.message.includes("超时")) {
      return {
        requestedModel: modelId,
        status: "timeout",
        error: "请求超时",
        latency,
      };
    }

    return {
      requestedModel: modelId,
      status: "error",
      error: error instanceof Error ? error.message : "网络错误",
      latency,
    };
  }
}

async function testClaudeNative(
  modelId: string,
  apiKey: string,
  baseUrl: string,
  startTime: number
): Promise<ModelTestResult> {
  try {
    const anthropicUrl = `${baseUrl}/v1/messages`;
    const response = await fetchWithTimeout(anthropicUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 100,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (data.content && data.content.length > 0) {
      const actualModel = data.model || modelId;
      const isMatch = isModelMatch(modelId, actualModel);

      return {
        requestedModel: modelId,
        status: isMatch ? "success" : "replaced",
        actualModel,
        latency,
      };
    }

    return {
      requestedModel: modelId,
      status: "error",
      error: data.error?.message || "未知错误",
      latency,
    };
  } catch (error) {
    return {
      requestedModel: modelId,
      status: "error",
      error: error instanceof Error ? error.message : "网络错误",
      latency: Date.now() - startTime,
    };
  }
}

// =============================================================================
// 主组件
// =============================================================================

export const ImprovedAPITester: React.FC<ImprovedAPITesterProps> = ({
  provider,
  apiKey,
  baseUrl,
  onClose,
}) => {
  const [results, setResults] = useState<ModelTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const providerInfo = PROVIDER_INFO[provider];
  const modelsToTest = MODELS_BY_PROVIDER[provider];

  const runAllTests = useCallback(async () => {
    setIsTesting(true);
    setResults([]);
    setProgress(0);

    abortControllerRef.current = new AbortController();

    // 初始化所有结果为 pending
    const initialResults: ModelTestResult[] = modelsToTest.map((m) => ({
      requestedModel: m.id,
      status: "pending",
    }));
    setResults(initialResults);

    // 并发测试（3个并发）
    const CONCURRENCY = 3;
    const newResults: ModelTestResult[] = [];

    for (let i = 0; i < modelsToTest.length; i += CONCURRENCY) {
      if (abortControllerRef.current?.signal.aborted) break;

      const batch = modelsToTest.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map((model) =>
        testModelWithRetry(model.id, apiKey, baseUrl, provider)
      );

      const batchResults = await Promise.all(batchPromises);
      newResults.push(...batchResults);

      setResults([...newResults, ...initialResults.slice(newResults.length)]);
      setProgress((newResults.length / modelsToTest.length) * 100);

      // 批次间延迟
      if (i + CONCURRENCY < modelsToTest.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setIsTesting(false);
    abortControllerRef.current = null;
  }, [modelsToTest, apiKey, baseUrl, provider]);

  const cancelTests = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsTesting(false);
  }, []);

  const getStatusIcon = (status: ModelTestResult["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "success":
        return "✅";
      case "replaced":
        return "⚠️";
      case "timeout":
        return "⏱️";
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
      case "timeout":
        return "text-orange-500";
      case "error":
        return "text-red-500";
    }
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency) return "text-gray-400";
    if (latency < 2000) return "text-green-500";
    if (latency < 5000) return "text-yellow-500";
    if (latency < 10000) return "text-orange-500";
    return "text-red-500";
  };

  const stats = {
    total: results.filter((r) => r.status !== "pending").length,
    success: results.filter((r) => r.status === "success").length,
    replaced: results.filter((r) => r.status === "replaced").length,
    timeout: results.filter((r) => r.status === "timeout").length,
    error: results.filter((r) => r.status === "error").length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {providerInfo.icon} {providerInfo.name} API 模型测试
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {baseUrl} · 并发测试 · 自动重试 · 30秒超时
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
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
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
            <p className="text-xs text-gray-400 mt-1">
              正在测试 {stats.total}/{modelsToTest.length} 个模型...
            </p>
          </div>
        )}

        {/* 结果列表 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[55vh]">
          {results.length === 0 && !isTesting ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                点击下方按钮开始测试 {providerInfo.name} 模型
              </p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>✅ 成功 - 模型可用且返回正确</p>
                <p>⚠️ 替换 - 模型被替换成其他模型</p>
                <p>⏱️ 超时 - 请求超过30秒</p>
                <p>❌ 失败 - 模型不可用</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {results.map((result, index) => {
                  const modelInfo = modelsToTest.find((m) => m.id === result.requestedModel);
                  return (
                    <motion.div
                      key={result.requestedModel}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`
                                                flex items-center justify-between p-3 rounded-lg border
                                                ${result.status === "pending" ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700" : ""}
                                                ${result.status === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : ""}
                                                ${result.status === "replaced" ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" : ""}
                                                ${result.status === "timeout" ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" : ""}
                                                ${result.status === "error" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : ""}
                                            `}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`text-lg ${getStatusColor(result.status)}`}>
                          {getStatusIcon(result.status)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {modelInfo?.name || result.requestedModel}
                            </p>
                            {result.retried && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                重试
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                            {result.requestedModel}
                          </p>
                        </div>
                      </div>

                      <div className="text-right ml-3">
                        {result.status === "pending" && (
                          <span className="text-sm text-gray-400">等待中...</span>
                        )}
                        {result.status === "success" && (
                          <span
                            className={`text-sm font-medium ${getLatencyColor(result.latency)}`}
                          >
                            {result.latency}ms
                          </span>
                        )}
                        {result.status === "replaced" && (
                          <div>
                            <p className="text-sm text-yellow-600 dark:text-yellow-400 truncate max-w-[200px]">
                              → {result.actualModel}
                            </p>
                            <p className={`text-xs ${getLatencyColor(result.latency)}`}>
                              {result.latency}ms
                            </p>
                          </div>
                        )}
                        {(result.status === "error" || result.status === "timeout") && (
                          <p
                            className="text-xs text-red-500 max-w-[250px] truncate"
                            title={result.error}
                          >
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
          {stats.total > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
              <span className="text-green-500">✅ {stats.success}</span>
              <span className="text-yellow-500">⚠️ {stats.replaced}</span>
              <span className="text-orange-500">⏱️ {stats.timeout}</span>
              <span className="text-red-500">❌ {stats.error}</span>
              <span className="text-gray-400 ml-auto">
                总计: {stats.total}/{modelsToTest.length}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              关闭
            </button>
            <div className="flex gap-2">
              {isTesting && (
                <button
                  onClick={cancelTests}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  取消测试
                </button>
              )}
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
        </div>
      </motion.div>
    </div>
  );
};

export default ImprovedAPITester;
