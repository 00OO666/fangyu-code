/**
 * 内嵌模型测试组件 - 完全重写版
 *
 * 修复:
 * 1. 更智能的模型匹配（识别 thinking/版本变体）
 * 2. 添加确认对话框防止误点击
 * 3. 更好的实时反馈
 * 4. 错误处理和重试
 */

import { useState, useCallback, useEffect } from "react";
import { Loader2, CheckCircle, AlertTriangle, XCircle, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

export type APIProviderType = "claude" | "openai" | "gemini";

interface ModelConfig {
  id: string;
  name: string;
  thinkingBudget?: number;
  isThinking?: boolean;
}

interface ModelTestResult {
  model: string;
  status: "pending" | "success" | "replaced" | "error";
  actualModel?: string;
  latency?: number;
  error?: string;
  isThinking?: boolean;
}

interface InlineModelTesterProps {
  provider: APIProviderType;
  apiKey: string;
  baseUrl: string;
  onClose: () => void;
  onTestComplete?: (results: ModelTestResult[]) => void;
  selectedModel?: string | null;
  onModelSelect?: (modelId: string) => void;
}

// Claude 官方模型（2026-01 更新）
const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5" },
  { id: "claude-opus-4-5-20251101", name: "Opus 4.5" },
];

// Gemini 官方模型（2026-01）
const GEMINI_MODELS = [
  { id: "gemini-2.5-pro", name: "2.5 Pro" },
  { id: "gemini-2.5-flash", name: "2.5 Flash" },
  { id: "gemini-3-pro-preview", name: "3 Pro" },
  { id: "gemini-3-flash-preview", name: "3 Flash" },
];

// OpenAI 官方模型（2026-01）
const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "o1", name: "o1" },
  { id: "o3-mini", name: "o3 Mini" },
];

const MODELS_BY_PROVIDER: Record<APIProviderType, ModelConfig[]> = {
  claude: CLAUDE_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
};

/**
 * 超级智能的模型匹配 - 识别所有变体
 */
function isModelMatch(requested: string, actual: string): boolean {
  if (!actual) return false;
  if (requested === actual) return true;

  // 标准化模型名称（移除日期、thinking、preview等后缀）
  const normalizeModel = (name: string) => {
    return name
      .replace(/-thinking$/i, "") // 移除 -thinking
      .replace(/-\d{8}$/g, "") // 移除日期 (20250929)
      .replace(/-\d{4}-\d{2}-\d{2}/g, "") // 移除日期 (2024-05-13)
      .replace(/-preview$/i, "") // 移除 -preview
      .replace(/-latest$/i, "") // 移除 -latest
      .replace(/-snapshot$/i, ""); // 移除 -snapshot
  };

  const normalizedRequested = normalizeModel(requested);
  const normalizedActual = normalizeModel(actual);

  // 检查核心部分是否匹配
  return normalizedRequested === normalizedActual;
}

/**
 * 带超时的 fetch（30秒）
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
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("请求超时（30秒）");
    }
    throw error;
  }
}

/**
 * 测试单个模型（带重试）
 */
async function testModel(
  modelConfig: ModelConfig,
  apiKey: string,
  baseUrl: string,
  provider: APIProviderType
): Promise<ModelTestResult> {
  const { id: modelId } = modelConfig;
  const startTime = Date.now();

  try {
    const url = `${baseUrl}/v1/chat/completions`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      const actualModel = data.model || modelId;
      const isMatch = isModelMatch(modelId, actualModel);

      return {
        model: modelId,
        status: isMatch ? "success" : "replaced",
        actualModel,
        latency,
      };
    }

    return {
      model: modelId,
      status: "error",
      error: data.error?.message || "未知错误",
      latency,
    };
  } catch (error) {
    return {
      model: modelId,
      status: "error",
      error: error instanceof Error ? error.message : "网络错误",
      latency: Date.now() - startTime,
    };
  }
}

export function InlineModelTester({
  provider,
  apiKey,
  baseUrl,
  onClose,
  onTestComplete,
  selectedModel,
  onModelSelect,
}: InlineModelTesterProps) {
  const [results, setResults] = useState<ModelTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const models = MODELS_BY_PROVIDER[provider];

  const runTests = useCallback(async () => {
    setIsTesting(true);
    setResults([]);
    setCurrentModel(null);
    setCompletedCount(0);

    const newResults: ModelTestResult[] = [];

    for (const model of models) {
      setCurrentModel(model.name);

      const result = await testModel(model, apiKey, baseUrl, provider);
      newResults.push(result);
      setResults([...newResults]);
      setCompletedCount(newResults.length);

      // 短暂延迟
      await new Promise((r) => setTimeout(r, 300));
    }

    setCurrentModel(null);
    setIsTesting(false);

    if (onTestComplete) {
      onTestComplete(newResults);
    }
  }, [models, apiKey, baseUrl, provider, onTestComplete]);

  // 自动开始测试
  useEffect(() => {
    runTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = {
    success: results.filter((r) => r.status === "success").length,
    replaced: results.filter((r) => r.status === "replaced").length,
    error: results.filter((r) => r.status === "error").length,
  };

  const progress = models.length > 0 ? (completedCount / models.length) * 100 : 0;

  const handleModelSelect = (modelId: string) => {
    setShowConfirm(modelId);
  };

  const confirmModelSelect = () => {
    if (showConfirm && onModelSelect) {
      onModelSelect(showConfirm);
    }
    setShowConfirm(null);
  };

  const getStatusIcon = (status: ModelTestResult["status"]) => {
    switch (status) {
      case "pending":
        return <Loader2 className="w-3 h-3 animate-spin text-gray-400" />;
      case "success":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "replaced":
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case "error":
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
  };

  return (
    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
          测试 {provider.toUpperCase()} 官方模型
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* 进度条和状态 */}
      {isTesting && (
        <div className="mb-3 space-y-2">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              ⏳ {currentModel || "准备测试..."}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {completedCount}/{models.length}
            </span>
          </div>
        </div>
      )}

      {/* 结果列表 */}
      <div className="space-y-1.5">
        {models.map((model, index) => {
          const result = results[index];
          const isSelectable = result?.status === "success" || result?.status === "replaced";
          const displayModelId = result?.status === "replaced" ? result.actualModel : model.id;
          const isSelected = selectedModel === displayModelId;

          return (
            <div
              key={model.id}
              onClick={() => {
                if (isSelectable && onModelSelect && displayModelId) {
                  handleModelSelect(displayModelId);
                }
              }}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all",
                result?.status === "success" && "bg-green-50 dark:bg-green-900/20",
                result?.status === "replaced" && "bg-yellow-50 dark:bg-yellow-900/20",
                result?.status === "error" && "bg-red-50 dark:bg-red-900/20",
                !result && "bg-gray-50 dark:bg-gray-800",
                isSelectable && "cursor-pointer hover:ring-2 hover:ring-blue-400",
                isSelected && "ring-2 ring-blue-500"
              )}
            >
              <div className="flex items-center gap-2">
                {result ? getStatusIcon(result.status) : <div className="w-3 h-3" />}
                <span className="font-medium text-gray-700 dark:text-gray-300">{model.name}</span>
                {isSelected && (
                  <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">
                    当前
                  </span>
                )}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-right">
                {!result && "等待中..."}
                {result?.status === "success" && `${result.latency}ms`}
                {result?.status === "replaced" && (
                  <div className="text-yellow-600 dark:text-yellow-400 text-[10px]">
                    → {result.actualModel}
                  </div>
                )}
                {result?.status === "error" && (
                  <span className="text-red-500 text-[10px]">{result.error?.slice(0, 20)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 统计 */}
      {!isTesting && results.length > 0 && (
        <div className="space-y-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400">✓ {stats.success}</span>
            <span className="text-yellow-600 dark:text-yellow-400">⚠ {stats.replaced}</span>
            <span className="text-red-500">✗ {stats.error}</span>
            <button
              onClick={runTests}
              className="ml-auto text-blue-500 hover:text-blue-600 font-medium"
            >
              重新测试
            </button>
          </div>
          {onModelSelect && (stats.success > 0 || stats.replaced > 0) && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              💡 点击可用模型将其设为默认（需确认）
            </div>
          )}
        </div>
      )}

      {/* 确认对话框 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              确认设置默认模型
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              将{" "}
              <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                {showConfirm}
              </code>{" "}
              设为默认模型？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                取消
              </button>
              <button
                onClick={confirmModelSelect}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 rounded"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InlineModelTester;
