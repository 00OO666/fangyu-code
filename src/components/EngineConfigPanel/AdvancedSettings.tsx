/**
 * 高级设置组件 - 可折叠面板
 * 包含运行模式和 Claude Code 环境变量设置
 */

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  Terminal,
  Eye,
  EyeOff,
  Info,
  FileText,
  List,
} from "lucide-react";
import type { EngineType, RuntimeConfig, RuntimeMode, ClaudeEnvVars } from "../../types/provider";
import { cn } from "../../lib/utils";

interface AdvancedSettingsProps {
  engine: EngineType;
  runtimeConfig: RuntimeConfig;
  onUpdateRuntimeConfig: (updates: Partial<RuntimeConfig>) => void;
}

const RUNTIME_MODE_OPTIONS: { value: RuntimeMode; label: string; description: string }[] = [
  { value: "auto", label: "自动", description: "根据系统环境自动选择" },
  { value: "native", label: "原生", description: "直接在 Windows 中运行" },
  { value: "wsl", label: "WSL", description: "在 WSL 中运行" },
];

// Claude Code 环境变量配置项
const CLAUDE_ENV_VARS: {
  key: keyof ClaudeEnvVars;
  label: string;
  type: "text" | "number" | "boolean" | "secret";
  placeholder?: string;
  description: string;
}[] = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "ANTHROPIC_API_KEY",
    type: "secret",
    placeholder: "sk-ant-...",
    description: "Anthropic API 密钥",
  },
  {
    key: "ANTHROPIC_BASE_URL",
    label: "ANTHROPIC_BASE_URL",
    type: "text",
    placeholder: "https://api.anthropic.com",
    description: "API 端点 URL",
  },
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    label: "ANTHROPIC_AUTH_TOKEN",
    type: "secret",
    placeholder: "Bearer token",
    description: "认证令牌（部分代理商需要）",
  },
  {
    key: "ANTHROPIC_MODEL",
    label: "ANTHROPIC_MODEL",
    type: "text",
    placeholder: "claude-sonnet-4-20250514",
    description: "默认使用的模型",
  },
  {
    key: "API_TIMEOUT_MS",
    label: "API_TIMEOUT_MS",
    type: "number",
    placeholder: "60000",
    description: "API 请求超时时间（毫秒）",
  },
  {
    key: "MAX_THINKING_TOKENS",
    label: "MAX_THINKING_TOKENS",
    type: "number",
    placeholder: "10000",
    description: "最大思考 Token 数",
  },
  {
    key: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
    label: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
    type: "number",
    placeholder: "16000",
    description: "最大输出 Token 数",
  },
  {
    key: "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    label: "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    type: "boolean",
    description: "禁用非必要网络流量",
  },
  {
    key: "CLAUDE_CODE_DISABLE_TELEMETRY",
    label: "CLAUDE_CODE_DISABLE_TELEMETRY",
    type: "boolean",
    description: "禁用遥测数据收集",
  },
  {
    key: "CLAUDE_CODE_USE_BEDROCK",
    label: "CLAUDE_CODE_USE_BEDROCK",
    type: "boolean",
    description: "使用 AWS Bedrock",
  },
];

export function AdvancedSettings({
  engine,
  runtimeConfig,
  onUpdateRuntimeConfig,
}: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEnvExpanded, setIsEnvExpanded] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isTextMode, setIsTextMode] = useState(false);
  const [textModeContent, setTextModeContent] = useState("");

  const currentMode = runtimeConfig.engineModes[engine] || "auto";
  const claudeEnvVars = runtimeConfig.claudeEnvVars || {};

  const handleModeChange = useCallback(
    (mode: RuntimeMode) => {
      onUpdateRuntimeConfig({
        engineModes: {
          ...runtimeConfig.engineModes,
          [engine]: mode,
        },
      });
    },
    [engine, runtimeConfig.engineModes, onUpdateRuntimeConfig]
  );

  const handleEnvVarChange = useCallback(
    (key: keyof ClaudeEnvVars, value: string | number | boolean | undefined) => {
      const currentEnvVars = runtimeConfig.claudeEnvVars || {};
      const newEnvVars = { ...currentEnvVars };
      if (value === "" || value === undefined) {
        delete newEnvVars[key];
      } else {
        (newEnvVars as Record<string, unknown>)[key] = value;
      }
      onUpdateRuntimeConfig({ claudeEnvVars: newEnvVars });
    },
    [runtimeConfig.claudeEnvVars, onUpdateRuntimeConfig]
  );

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 转换为文本格式
  const envVarsToText = useCallback(() => {
    const entries = Object.entries(claudeEnvVars)
      .filter(([_, value]) => value !== undefined && value !== "")
      .map(([key, value]) => {
        if (typeof value === "boolean") {
          return `${key}=${value ? "true" : "false"}`;
        }
        return `${key}=${value}`;
      });
    return entries.join("\n");
  }, [claudeEnvVars]);

  // 从文本解析环境变量
  const textToEnvVars = useCallback((text: string) => {
    const newEnvVars: Partial<ClaudeEnvVars> = {};
    const lines = text.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) continue;

      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      // 查找对应的配置项以确定类型
      const config = CLAUDE_ENV_VARS.find((v) => v.key === key);
      if (!config) continue;

      if (config.type === "boolean") {
        (newEnvVars as Record<string, unknown>)[key] = value === "true";
      } else if (config.type === "number") {
        const num = Number(value);
        if (!isNaN(num)) {
          (newEnvVars as Record<string, unknown>)[key] = num;
        }
      } else {
        (newEnvVars as Record<string, unknown>)[key] = value;
      }
    }

    return newEnvVars;
  }, []);

  // 切换到文本模式
  const switchToTextMode = useCallback(() => {
    setTextModeContent(envVarsToText());
    setIsTextMode(true);
  }, [envVarsToText]);

  // 切换到表单模式
  const switchToFormMode = useCallback(() => {
    const newEnvVars = textToEnvVars(textModeContent);
    onUpdateRuntimeConfig({ claudeEnvVars: newEnvVars });
    setIsTextMode(false);
  }, [textModeContent, textToEnvVars, onUpdateRuntimeConfig]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* 折叠头部 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "bg-gray-50 dark:bg-gray-800/50",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "transition-colors"
        )}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">高级设置</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* 运行模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              运行模式
            </label>
            <div className="space-y-2">
              {RUNTIME_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer",
                    "transition-colors",
                    currentMode === option.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <input
                    type="radio"
                    name={`runtime-mode-${engine}`}
                    value={option.value}
                    checked={currentMode === option.value}
                    onChange={() => handleModeChange(option.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* WSL 设置 */}
          {currentMode === "wsl" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                WSL 发行版
              </label>
              <input
                type="text"
                value={runtimeConfig.wslDistro || ""}
                onChange={(e) => onUpdateRuntimeConfig({ wslDistro: e.target.value || null })}
                placeholder="默认发行版"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm",
                  "bg-white dark:bg-gray-800",
                  "border-gray-300 dark:border-gray-600",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500"
                )}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                留空使用默认 WSL 发行版
              </p>
            </div>
          )}

          {/* Claude Code 环境变量设置 */}
          {engine === "claude" && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsEnvExpanded(!isEnvExpanded)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2",
                  "bg-gray-100 dark:bg-gray-700/50",
                  "hover:bg-gray-200 dark:hover:bg-gray-700",
                  "transition-colors"
                )}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Claude Code 环境变量
                  </span>
                </div>
                {isEnvExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isEnvExpanded && (
                <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-1">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {isTextMode
                          ? "文本模式：每行一个变量，格式为 KEY=value。支持 # 注释。"
                          : "这些环境变量会在启动 Claude Code CLI 时自动设置。留空的变量不会被设置。"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={isTextMode ? switchToFormMode : switchToTextMode}
                      className="ml-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title={isTextMode ? "切换到表单模式" : "切换到文本模式"}
                    >
                      {isTextMode ? (
                        <>
                          <List className="w-3 h-3" />
                          表单
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          文本
                        </>
                      )}
                    </button>
                  </div>

                  {isTextMode ? (
                    <div className="space-y-2">
                      <textarea
                        value={textModeContent}
                        onChange={(e) => setTextModeContent(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-xs font-mono",
                          "bg-white dark:bg-gray-800",
                          "border-gray-300 dark:border-gray-600",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500",
                          "resize-y min-h-[200px]"
                        )}
                        placeholder="# 示例：&#10;ANTHROPIC_API_KEY=sk-ant-...&#10;ANTHROPIC_BASE_URL=https://api.anthropic.com&#10;MAX_THINKING_TOKENS=10000"
                        spellCheck={false}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        💡 提示：切换回表单模式时会自动保存
                      </p>
                    </div>
                  ) : (
                    CLAUDE_ENV_VARS.map((envVar) => (
                      <div key={envVar.key} className="space-y-1">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                            {envVar.label}
                          </code>
                        </label>

                        {envVar.type === "boolean" ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!claudeEnvVars[envVar.key]}
                              onChange={(e) =>
                                handleEnvVarChange(envVar.key, e.target.checked || undefined)
                              }
                              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {envVar.description}
                            </span>
                          </label>
                        ) : envVar.type === "secret" ? (
                          <div className="relative">
                            <input
                              type={showSecrets[envVar.key] ? "text" : "password"}
                              value={(claudeEnvVars[envVar.key] as string) || ""}
                              onChange={(e) =>
                                handleEnvVarChange(envVar.key, e.target.value || undefined)
                              }
                              placeholder={envVar.placeholder}
                              className={cn(
                                "w-full px-3 py-1.5 pr-10 rounded-lg border text-sm font-mono",
                                "bg-white dark:bg-gray-800",
                                "border-gray-300 dark:border-gray-600",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500"
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => toggleSecret(envVar.key)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                            >
                              {showSecrets[envVar.key] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ) : envVar.type === "number" ? (
                          <input
                            type="number"
                            value={(claudeEnvVars[envVar.key] as number) || ""}
                            onChange={(e) =>
                              handleEnvVarChange(
                                envVar.key,
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            placeholder={envVar.placeholder}
                            className={cn(
                              "w-full px-3 py-1.5 rounded-lg border text-sm",
                              "bg-white dark:bg-gray-800",
                              "border-gray-300 dark:border-gray-600",
                              "focus:outline-none focus:ring-2 focus:ring-blue-500"
                            )}
                          />
                        ) : (
                          <input
                            type="text"
                            value={(claudeEnvVars[envVar.key] as string) || ""}
                            onChange={(e) =>
                              handleEnvVarChange(envVar.key, e.target.value || undefined)
                            }
                            placeholder={envVar.placeholder}
                            className={cn(
                              "w-full px-3 py-1.5 rounded-lg border text-sm",
                              "bg-white dark:bg-gray-800",
                              "border-gray-300 dark:border-gray-600",
                              "focus:outline-none focus:ring-2 focus:ring-blue-500"
                            )}
                          />
                        )}

                        {envVar.type !== "boolean" && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {envVar.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 引擎特定提示 */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {engine === "claude" &&
                "提示: Claude Code CLI 需要在 WSL 中运行以获得最佳体验。环境变量会自动同步到 ~/.claude/settings.json"}
              {engine === "codex" && "提示: OpenAI Codex 可以在 Windows 原生环境中运行。"}
              {engine === "gemini" && "提示: Google Gemini CLI 支持 Windows 和 WSL 环境。"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedSettings;
