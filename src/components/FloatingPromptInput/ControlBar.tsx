import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Wand2, ChevronDown, DollarSign, Info, Settings, Code2, Zap, Sparkles, Hash, Webhook, TrendingUp, TrendingDown, Cpu, BarChart3, Network } from "lucide-react";
import { useCostDelta } from "@/hooks/useCostDelta";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { formatDuration, formatTokensK } from "@/lib/pricing";
import { ExecutionEngineSelector, type ExecutionEngineConfig } from "@/components/ExecutionEngineSelector";
import { ModelSelector } from "./ModelSelector";
import { CodexModelSelector } from "./CodexModelSelector";
import { CodexReasoningLevelSelector, type CodexReasoningLevel } from "./CodexReasoningLevelSelector";
import { CodexRateLimitBadge } from "./CodexRateLimitBadge";
import { GeminiModelSelector } from "./GeminiModelSelector";
import { SiliconFlowModelSelector } from "./SiliconFlowModelSelector";
import { ThinkingModeToggle } from "./ThinkingModeToggle";
import { PlanModeToggle } from "./PlanModeToggle";
import { ContextWindowIndicator } from "@/components/widgets/ContextWindowIndicator";
import { ModelType, ModelConfig } from "./types";
import type { CodexRateLimits } from "@/types/codex";
import { useHooksCount } from "@/hooks/useHooksCount";
import { loadSiliconFlowConfig } from "@/config/siliconflowConfig";
import { TodayUsagePopover } from "@/components/TodayUsagePopover";

interface ControlBarProps {
  disabled?: boolean;
  isLoading: boolean;
  prompt: string;
  hasAttachments?: boolean;
  executionEngineConfig: ExecutionEngineConfig;
  setExecutionEngineConfig: (config: ExecutionEngineConfig) => void;
  selectedModel: ModelType;
  setSelectedModel: (model: ModelType) => void;
  availableModels: ModelConfig[];
  selectedThinkingMode: string;
  handleToggleThinkingMode: () => void;
  isPlanMode?: boolean;
  onTogglePlanMode?: () => void;
  hasMessages: boolean;
  sessionCost?: string;
  sessionStats?: any;
  showCostPopover: boolean;
  setShowCostPopover: (show: boolean) => void;
  messages?: any[];
  session?: any;
  codexRateLimits?: CodexRateLimits | null;
  isEnhancing: boolean;
  projectPath?: string;
  enableProjectContext: boolean;
  setEnableProjectContext: (enable: boolean) => void;
  enableDualAPI: boolean;
  setEnableDualAPI: (enable: boolean) => void;
  getEnabledProviders: () => any[];
  handleEnhancePromptWithAPI: (id: string) => void;
  onCancel: () => void;
  onSend: () => void;
  onOpenCanvas?: () => void;
  hasPreviewableCode?: boolean;  // 是否检测到可预览代码
  codeSource?: 'markdown' | 'tool_use';  // 代码来源
  onToggleUsageDashboard?: () => void;  // 切换 Usage Dashboard
  showUsageDashboard?: boolean;  // Usage Dashboard 显示状态
  onToggleMCPConfig?: () => void;  // 切换项目级 MCP 配置对话框
}

export const ControlBar: React.FC<ControlBarProps> = ({
  disabled,
  isLoading,
  prompt,
  hasAttachments = false,
  executionEngineConfig,
  setExecutionEngineConfig,
  selectedModel,
  setSelectedModel,
  availableModels,
  selectedThinkingMode,
  handleToggleThinkingMode,
  isPlanMode,
  onTogglePlanMode,
  hasMessages,
  sessionCost,
  sessionStats,
  showCostPopover,
  setShowCostPopover,
  messages,
  session,
  codexRateLimits: providedCodexRateLimits,
  isEnhancing,
  projectPath,
  enableProjectContext,
  setEnableProjectContext,
  enableDualAPI,
  setEnableDualAPI,
  getEnabledProviders,
  handleEnhancePromptWithAPI,
  onCancel,
  onSend,
  onOpenCanvas,
  hasPreviewableCode,
  codeSource,
  onToggleUsageDashboard,
  showUsageDashboard,
  onToggleMCPConfig
}) => {
  const { t } = useTranslation();
  const { count: hooksCount } = useHooksCount();
  const [siliconFlowDialogOpen, setSiliconFlowDialogOpen] = useState(false);
  const siliconFlowConfig = loadSiliconFlowConfig();

  // 费用变动追踪
  const currentCostValue = useMemo(() => {
    if (!sessionCost) return 0;
    // 解析费用字符串，如 "$1.23" -> 1.23
    const match = sessionCost.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }, [sessionCost]);

  const sessionIdForCost = session?.id || session?.sessionId || '';
  const {
    sessionDelta,        // 🆕 会话总增量
    commandDelta,        // 🆕 当前指令增量
    lastCommandCost,     // 🆕 最新指令的总消耗
    resetSessionBaseline, // 🆕 重置会话基准
    resetCommandBaseline, // 🆕 重置指令基准
  } = useCostDelta(sessionIdForCost, currentCostValue, messages);

  // 🆕 动画状态：控制是否显示变动额（橙色闪烁）
  const [showDeltaAnimation, setShowDeltaAnimation] = useState(false);
  const animationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLoadingRef = React.useRef<boolean>(false);

  // 🆕 监听 isLoading 和 commandDelta 变化，实现动画效果
  // - 指令执行中(isLoading=true)：显示橙色变动额（实时累加）
  // - 指令完成后2.5秒：切换为显示指令总消耗
  React.useEffect(() => {
    // 清除之前的定时器
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    // 当有指令在执行（isLoading = true）且有费用产生时，显示橙色变动额
    if (isLoading && commandDelta > 0) {
      setShowDeltaAnimation(true);
      wasLoadingRef.current = true;
    }
    // 当指令刚执行完成（从 loading 变为非 loading）
    else if (!isLoading && wasLoadingRef.current && commandDelta > 0) {
      // 延迟2.5秒后切换为显示指令总消耗
      animationTimerRef.current = setTimeout(() => {
        setShowDeltaAnimation(false);
        wasLoadingRef.current = false;
      }, 2500);
    }

    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [isLoading, commandDelta]);

  // 格式化费用变动显示
  const formatCostDelta = (delta: number): string => {
    if (delta === 0) return '';
    const sign = delta > 0 ? '+' : '';
    if (delta < 0.01 && delta > -0.01 && delta !== 0) {
      return `${sign}${(delta * 100).toFixed(2)}¢`;
    }
    return `${sign}$${delta.toFixed(4)}`;
  };

  // 🆕 格式化费用（无符号）
  const formatCost = (cost: number): string => {
    if (cost === 0) return '';
    if (cost < 0.01 && cost > 0) {
      return `${(cost * 100).toFixed(2)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  };

  const contextWindowModel =
    executionEngineConfig.engine === 'codex'
      ? (session?.model || executionEngineConfig.codexModel)
      : executionEngineConfig.engine === 'gemini'
        ? (executionEngineConfig.geminiModel || session?.model)
        : selectedModel;

  // Extract latest Codex rate limits from messages
  const codexRateLimits = useMemo<CodexRateLimits | null>(() => {
    if (executionEngineConfig.engine !== 'codex') {
      return null;
    }

    if (providedCodexRateLimits) {
      return providedCodexRateLimits;
    }

    if (!messages || messages.length === 0) {
      return null;
    }

    // Find the latest message with rate limits in codexMetadata
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const rateLimits = (msg as any)?.codexMetadata?.rateLimits;
      if (rateLimits && (rateLimits.primary || rateLimits.secondary)) {
        return rateLimits;
      }
    }

    return null;
  }, [executionEngineConfig.engine, messages, providedCodexRateLimits]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Execution Engine Selector */}
      <ExecutionEngineSelector
        value={executionEngineConfig}
        onChange={setExecutionEngineConfig}
      />

      {/* Claude-specific controls */}
      {executionEngineConfig.engine === 'claude' && (
        <>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            disabled={disabled}
            availableModels={availableModels}
          />

          <ThinkingModeToggle
            isEnabled={selectedThinkingMode === "on"}
            onToggle={handleToggleThinkingMode}
            disabled={disabled}
          />

          {onTogglePlanMode && (
            <PlanModeToggle
              isPlanMode={isPlanMode || false}
              onToggle={onTogglePlanMode}
              disabled={disabled}
            />
          )}
        </>
      )}

      {/* Codex-specific controls */}
      {executionEngineConfig.engine === 'codex' && (
        <>
          <CodexModelSelector
            selectedModel={executionEngineConfig.codexModel}
            onModelChange={(model) => setExecutionEngineConfig({
              ...executionEngineConfig,
              codexModel: model,
            })}
            disabled={disabled}
          />
          <CodexReasoningLevelSelector
            selectedLevel={executionEngineConfig.codexReasoningLevel}
            onLevelChange={(level: CodexReasoningLevel) => setExecutionEngineConfig({
              ...executionEngineConfig,
              codexReasoningLevel: level,
            })}
            disabled={disabled}
          />
          {/* Codex Rate Limit Badge */}
          {codexRateLimits && (
            <CodexRateLimitBadge rateLimits={codexRateLimits} />
          )}
        </>
      )}

      {/* Gemini-specific controls */}
      {executionEngineConfig.engine === 'gemini' && (
        <GeminiModelSelector
          selectedModel={executionEngineConfig.geminiModel}
          onModelChange={(model) => setExecutionEngineConfig({
            ...executionEngineConfig,
            geminiModel: model,
          })}
          disabled={disabled}
        />
      )}

      {/* Token 统计 Badge */}
      {hasMessages && sessionStats && sessionStats.totalTokens > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8 cursor-default hover:bg-accent transition-colors border-border/50">
            <Hash className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="font-mono text-xs">{formatTokensK(sessionStats.totalTokens)}</span>
          </Badge>
        </motion.div>
      )}

      {/* Session Cost with Details */}
      {hasMessages && sessionCost && sessionStats && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setShowCostPopover(true)}
            onMouseLeave={() => setShowCostPopover(false)}
          >
            <Popover
              open={showCostPopover}
              onOpenChange={setShowCostPopover}
              trigger={
                <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8 cursor-default hover:bg-accent transition-colors border-border/50">
                  <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="font-mono text-xs">{sessionCost}</span>
                  <Info className="h-3 w-3 text-muted-foreground ml-1" />
                </Badge>
              }
              content={
                <div className="space-y-2">
                  <div className="font-medium text-sm border-b pb-1">{t('promptInput.sessionStats')}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t('promptInput.totalCost')}:</span>
                      <span className="font-mono font-medium">{sessionCost}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t('promptInput.totalTokens')}:</span>
                      <span className="font-mono">{formatTokensK(sessionStats.totalTokens)} ({sessionStats.totalTokens.toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t('promptInput.inputTokens', '输入')}:</span>
                      <span className="font-mono">{formatTokensK(sessionStats.inputTokens)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t('promptInput.outputTokens', '输出')}:</span>
                      <span className="font-mono">{formatTokensK(sessionStats.outputTokens)}</span>
                    </div>
                    {sessionStats.durationSeconds > 0 && (
                      <>
                        <div className="border-t pt-1 mt-1"></div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{t('promptInput.sessionDuration')}:</span>
                          <span className="font-mono">{formatDuration(sessionStats.durationSeconds)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              }
              side="top"
              align="center"
              className="w-80"
            />
          </motion.div>

          {/* 🆕 指令费用显示 - 动画切换效果 */}
          {/* 执行中：橙色闪烁显示累积变动额 (+$0.05 → +$0.09 → +$0.17) */}
          {/* 完成后2.5秒：切换为蓝色显示指令总消耗 ($0.17) */}
          {commandDelta > 0 && (
            <motion.div
              key={showDeltaAnimation ? 'delta' : 'total'}
              initial={{ opacity: 0, scale: 0.9, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              transition={{ duration: 0.3 }}
            >
              {showDeltaAnimation ? (
                /* 橙色变动额 - 执行中实时累加 */
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 h-8 cursor-default transition-all",
                    "border-orange-500/50 bg-orange-500/10",
                    "text-orange-600 dark:text-orange-400",
                    isLoading && "animate-pulse"
                  )}
                  title="当前指令累计消耗（执行中...）"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs font-semibold">
                    {formatCostDelta(commandDelta)}
                  </span>
                </Badge>
              ) : (
                /* 蓝色指令总消耗 - 执行完成后显示 */
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 h-8 cursor-pointer transition-all hover:bg-accent",
                    "border-blue-500/50 bg-blue-500/5",
                    "text-blue-600 dark:text-blue-400"
                  )}
                  onClick={resetCommandBaseline}
                  title="最新指令总消耗\n点击重置基准"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs font-medium">
                    {formatCost(lastCommandCost)}
                  </span>
                </Badge>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Hooks 数量 Badge */}
      {hooksCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8 cursor-default hover:bg-accent transition-colors border-border/50">
            <Webhook className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <span className="font-mono text-xs">Hooks: {hooksCount}</span>
          </Badge>
        </motion.div>
      )}

      {/* Context Window Indicator - Claude / Codex / Gemini 引擎显示 */}
      {(executionEngineConfig.engine === 'claude' || executionEngineConfig.engine === 'codex' || executionEngineConfig.engine === 'gemini') && hasMessages && messages && (
        <ContextWindowIndicator
          messages={messages}
          model={contextWindowModel}
          engine={executionEngineConfig.engine}
          show={true}
        />
      )}

      {/* Loading Indicator - 移至 SessionMessages 中显示为 CLI 风格 */}

      <div className="flex-1" />

      {/* Today Usage Popover - 今日消耗 */}
      <TodayUsagePopover hasMessages={hasMessages} />

      {/* Usage Dashboard Toggle - Token 消耗图表 */}
      {onToggleUsageDashboard && hasMessages && (
        <Button
          variant={showUsageDashboard ? "default" : "outline"}
          size="default"
          onClick={onToggleUsageDashboard}
          className={cn(
            "gap-2 h-8 transition-all",
            showUsageDashboard
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "border-border/50 bg-background/50 hover:bg-accent/50"
          )}
          title="Token 消耗图表 (Ctrl+Shift+T)"
        >
          <BarChart3 className={cn(
            "h-3.5 w-3.5",
            showUsageDashboard ? "text-white" : "text-blue-500"
          )} />
          <span className="text-xs">图表</span>
        </Button>
      )}

      {/* 🆕 MCP Quick Config - 项目级 MCP 快捷配置 */}
      {onToggleMCPConfig && projectPath && (
        <Button
          variant="outline"
          size="default"
          onClick={onToggleMCPConfig}
          className="gap-2 h-8 border-border/50 bg-background/50 hover:bg-accent/50 transition-all"
          title="项目 MCP 配置 - 快速开关此项目的 MCP 服务器"
        >
          <Network className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs">MCP</span>
        </Button>
      )}

      {/* Canvas Button - 打开实时预览 */}
      {onOpenCanvas && hasMessages && (
        <div className="relative">
          <Button
            variant={hasPreviewableCode ? "default" : "outline"}
            size="default"
            onClick={onOpenCanvas}
            className={cn(
              "gap-2 h-8 transition-all",
              hasPreviewableCode
                ? "bg-purple-600 hover:bg-purple-700 text-white animate-pulse"
                : "border-border/50 bg-background/50 hover:bg-accent/50"
            )}
            title={
              hasPreviewableCode
                ? `检测到可预览代码 (${codeSource === 'tool_use' ? '工具调用' : 'Markdown'}) - 点击预览 (Ctrl+Shift+C)`
                : "Canvas 实时预览 (Ctrl+Shift+C)"
            }
          >
            <Sparkles className={cn(
              "h-3.5 w-3.5",
              hasPreviewableCode ? "text-white" : "text-purple-500"
            )} />
            <span className="text-xs">
              {hasPreviewableCode ? '预览代码' : 'Canvas'}
            </span>
          </Button>
          {hasPreviewableCode && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
          )}
        </div>
      )}

      {/* SiliconFlow Button - 硅基流动模型选择 */}
      <Button
        variant="outline"
        size="default"
        onClick={() => setSiliconFlowDialogOpen(true)}
        className={cn(
          "gap-2 h-8 border-border/50 bg-background/50 hover:bg-accent/50 transition-all",
          siliconFlowConfig.apiKey && "border-cyan-500/30"
        )}
        title={siliconFlowConfig.apiKey
          ? `SiliconFlow: ${siliconFlowConfig.selectedModel.split('/').pop()}`
          : "SiliconFlow 模型选择 - 点击配置"
        }
      >
        <Cpu className={cn(
          "h-3.5 w-3.5",
          siliconFlowConfig.apiKey ? "text-cyan-500" : "text-muted-foreground"
        )} />
        <span className="text-xs">
          {siliconFlowConfig.apiKey
            ? siliconFlowConfig.selectedModel.split('/').pop()?.slice(0, 12) || 'SiliconFlow'
            : 'SiliconFlow'
          }
        </span>
      </Button>

      {/* SiliconFlow Model Selector Dialog */}
      <SiliconFlowModelSelector
        open={siliconFlowDialogOpen}
        onOpenChange={setSiliconFlowDialogOpen}
      />

      {/* Enhance Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="default"
            disabled={disabled || isEnhancing}
            className="gap-2 h-8 border-border/50 bg-background/50 hover:bg-accent/50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span className="text-xs">{isEnhancing ? t('promptInput.enhancing') : t('promptInput.enhance')}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-background/95 backdrop-blur-md border-border/50">
          {/* Project Context Switch */}
          {projectPath && (
            <>
              <div className="px-2 py-1.5">
                <label className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 transition-colors">
                  <div className="flex items-center gap-2">
                    <Code2 className={`h-4 w-4 ${enableProjectContext ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <div className={`text-sm font-medium ${enableProjectContext ? 'text-primary' : ''}`}>
                        {t('promptInput.enableProjectContext')}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('promptInput.useAcemcpSearch')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enableProjectContext}
                    onCheckedChange={setEnableProjectContext}
                  />
                </label>
              </div>
              <DropdownMenuSeparator className="bg-border/50" />
            </>
          )}

          {/* Smart Context Switch */}
          <div className="px-2 py-1.5">
            <label className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 transition-colors">
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${enableDualAPI ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <div className={`text-sm font-medium ${enableDualAPI ? 'text-primary' : ''}`}>
                    {t('promptInput.smartContextExtraction')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('promptInput.aiFilterMessages')}
                  </p>
                </div>
              </div>
              <Switch
                checked={enableDualAPI}
                onCheckedChange={(checked) => {
                  setEnableDualAPI(checked);
                  localStorage.setItem('enable_dual_api_enhancement', String(checked));
                }}
              />
            </label>
          </div>
          <DropdownMenuSeparator className="bg-border/50" />

          {/* Third-party API Providers */}
          {(() => {
            const enabledProviders = getEnabledProviders();
            if (enabledProviders.length > 0) {
              return (
                <>
                  {enabledProviders.map((provider) => (
                    <DropdownMenuItem
                      key={provider.id}
                      onClick={() => handleEnhancePromptWithAPI(provider.id)}
                      className="cursor-pointer"
                    >
                      {provider.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-border/50" />
                </>
              );
            }
            return null;
          })()}

          <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('open-prompt-api-settings'))} className="cursor-pointer">
            <Settings className="h-3 w-3 mr-2" />
            {t('promptInput.manageApiConfig')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Send/Cancel Button */}
      {isLoading ? (
        <Button
          onClick={onCancel}
          variant="destructive"
          size="default"
          disabled={disabled}
          className="h-8 shadow-md bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white font-medium"
        >
          {t('buttons.cancel')}
        </Button>
      ) : (
        <Button
          onClick={onSend}
          disabled={(!prompt.trim() && !hasAttachments) || disabled}
          size="default"
          className="h-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-200"
        >
          {t('promptInput.send')}
        </Button>
      )}
    </div>
  );
};
