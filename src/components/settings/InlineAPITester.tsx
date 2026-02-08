/**
 * InlineAPITester - 内嵌式 API 测试组件
 *
 * 直接在代理商卡片内展开显示测试结果，不占用全屏
 *
 * Feature: settings-refactor
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// 类型定义
// =============================================================================

export type APIProviderType = "claude" | "openai" | "gemini";

interface ModelTestResult {
  requestedModel: string;
  status: "pending" | "success" | "replaced" | "error";
  actualModel?: string;
  latency?: number;
  error?: string;
}

interface InlineAPITesterProps {
  provider: APIProviderType;
  apiKey: string;
  baseUrl: string;
  isOpen: boolean;
  onClose: () => void;
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
  { id: "claude-opus-4-5-20251101", name: "Opus 4.5", tier: "premium" },
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5", tier: "standard" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", tier: "fast" },
  { id: "claude-sonnet-4-20250514", name: "Sonnet 4", tier: "standard" },
  { id: "claude-3-5-sonnet-20241022", name: "Sonnet 3.5", tier: "legacy" },
  { id: "claude-3-5-haiku-20241022", name: "Haiku 3.5", tier: "legacy" },
];

const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o", tier: "premium" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: "fast" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", tier: "standard" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5", tier: "fast" },
  { id: "o1-mini", name: "o1 Mini", tier: "standard" },
];

const GEMINI_MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro-preview-06-05", name: "2.5 Pro", tier: "premium" },
  { id: "gemini-2.0-flash", name: "2.0 Flash", tier: "fast" },
  { id: "gemini-1.5-pro", name: "1.5 Pro", tier: "standard" },
  { id: "gemini-1.5-flash", name: "1.5 Flash", tier: "fast" },
];

const MODELS_BY_PROVIDER: Record<APIProviderType, ModelInfo[]> = {
  claude: CLAUDE_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
};

// =============================================================================
// API 测试函数
// =============================================================================

async function testClaudeModel(
  modelId: string,
  apiKey: string,
  baseUrl: string
): Promise<ModelTestResult> {
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
    }
    return {
      requestedModel: modelId,
      status: "error",
      error: data.error?.message?.slice(0, 40) || "未知错误",
      latency,
    };
  } catch (error) {
    return {
      requestedModel: modelId,
      status: "error",
      error: error instanceof Error ? error.message.slice(0, 40) : "网络错误",
      latency: Date.now() - startTime,
    };
  }
}

async function testOpenAIModel(
  modelId: string,
  apiKey: string,
  baseUrl: string
): Promise<ModelTestResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 20,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const latency = Date.now() - startTime;
    const data = await response.json();
    if (data.choices) {
      const actualModel = data.model;
      const isMatch = actualModel?.startsWith(modelId) || modelId === actualModel;
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
      error: data.error?.message?.slice(0, 40) || "未知错误",
      latency,
    };
  } catch (error) {
    return {
      requestedModel: modelId,
      status: "error",
      error: error instanceof Error ? error.message.slice(0, 40) : "网络错误",
      latency: Date.now() - startTime,
    };
  }
}

async function testGeminiModel(
  modelId: string,
  apiKey: string,
  baseUrl: string
): Promise<ModelTestResult> {
  const startTime = Date.now();
  try {
    const url = `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    });
    const latency = Date.now() - startTime;
    const data = await response.json();
    if (data.candidates) {
      return { requestedModel: modelId, status: "success", actualModel: modelId, latency };
    }
    return {
      requestedModel: modelId,
      status: "error",
      error: data.error?.message?.slice(0, 40) || "未知错误",
      latency,
    };
  } catch (error) {
    return {
      requestedModel: modelId,
      status: "error",
      error: error instanceof Error ? error.message.slice(0, 40) : "网络错误",
      latency: Date.now() - startTime,
    };
  }
}

const TEST_FUNCTIONS: Record<APIProviderType, typeof testClaudeModel> = {
  claude: testClaudeModel,
  openai: testOpenAIModel,
  gemini: testGeminiModel,
};

// =============================================================================
// 主组件
// =============================================================================

export const InlineAPITester: React.FC<InlineAPITesterProps> = ({
  provider,
  apiKey,
  baseUrl,
  isOpen,
  onClose,
}) => {
  const [results, setResults] = useState<ModelTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const modelsToTest = MODELS_BY_PROVIDER[provider];
  const testFunction = TEST_FUNCTIONS[provider];

  const runAllTests = useCallback(async () => {
    if (!apiKey || !baseUrl) return;
    setIsTesting(true);
    setResults([]);
    setProgress(0);

    const newResults: ModelTestResult[] = [];
    for (let i = 0; i < modelsToTest.length; i++) {
      const model = modelsToTest[i];
      setResults((prev) => [...prev, { requestedModel: model.id, status: "pending" }]);

      const result = await testFunction(model.id, apiKey, baseUrl);
      newResults.push(result);
      setResults([...newResults]);
      setProgress(((i + 1) / modelsToTest.length) * 100);

      if (i < modelsToTest.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setIsTesting(false);
  }, [modelsToTest, testFunction, apiKey, baseUrl]);

  const stats = {
    success: results.filter((r) => r.status === "success").length,
    replaced: results.filter((r) => r.status === "replaced").length,
    error: results.filter((r) => r.status === "error").length,
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden border-t border-gray-200 dark:border-gray-700"
      >
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              模型可用性测试
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={runAllTests}
                disabled={isTesting || !apiKey}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isTesting || !apiKey
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                {isTesting ? "测试中..." : results.length > 0 ? "重测" : "开始测试"}
              </button>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 进度条 */}
          {isTesting && (
            <div className="mb-3">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 结果网格 */}
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {results.map((result) => {
                  const modelInfo = modelsToTest.find((m) => m.id === result.requestedModel);
                  const statusIcon = {
                    pending: "⏳",
                    success: "✅",
                    replaced: "⚠️",
                    error: "❌",
                  }[result.status];
                  const bgColor = {
                    pending: "bg-gray-100 dark:bg-gray-700",
                    success: "bg-green-100 dark:bg-green-900/30",
                    replaced: "bg-yellow-100 dark:bg-yellow-900/30",
                    error: "bg-red-100 dark:bg-red-900/30",
                  }[result.status];

                  return (
                    <motion.div
                      key={result.requestedModel}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-2 rounded-lg ${bgColor}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{statusIcon}</span>
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          {modelInfo?.name || result.requestedModel.slice(0, 15)}
                        </span>
                      </div>
                      {result.latency && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 pl-5">
                          {result.latency}ms
                          {result.status === "replaced" && result.actualModel && (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              {" "}
                              → {result.actualModel.slice(0, 12)}
                            </span>
                          )}
                        </div>
                      )}
                      {result.status === "error" && result.error && (
                        <div className="text-[10px] text-red-500 mt-0.5 pl-5 truncate">
                          {result.error}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* 统计 */}
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="text-green-600 dark:text-green-400">✅ {stats.success}</span>
                <span className="text-yellow-600 dark:text-yellow-400">⚠️ {stats.replaced}</span>
                <span className="text-red-600 dark:text-red-400">❌ {stats.error}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
              {!apiKey ? "请先配置 API Key" : '点击"开始测试"检测代理商支持的模型'}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InlineAPITester;
