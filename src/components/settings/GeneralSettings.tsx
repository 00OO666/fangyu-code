import { logger } from '@/lib/logger';
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Download from 'lucide-react/dist/esm/icons/download';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LanguageSelector } from "../LanguageSelector";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/hooks/useTranslation";
import { api, type ClaudeSettings } from "@/lib/api";
import type { HooksConfiguration } from "@/types/hooks";

interface GeneralSettingsProps {
  settings: ClaudeSettings | null;
  updateSetting: (key: string, value: any) => void;
  disableRewindGitOps: boolean;
  handleRewindGitOpsToggle: (checked: boolean) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  updateSetting,
  disableRewindGitOps,
  handleRewindGitOpsToggle,
  setToast
}) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Custom Claude path state
  const [customClaudePath, setCustomClaudePath] = useState<string>("");
  const [isCustomPathMode, setIsCustomPathMode] = useState(false);
  const [customPathError, setCustomPathError] = useState<string | null>(null);

  // Custom Codex path state
  const [customCodexPath, setCustomCodexPath] = useState<string>("");
  const [isCodexCustomPathMode, setIsCodexCustomPathMode] = useState(false);
  const [codexPathError, setCodexPathError] = useState<string | null>(null);
  const [codexPathValid, setCodexPathValid] = useState<boolean | null>(null);
  const [validatingCodexPath, setValidatingCodexPath] = useState(false);

  // Reset settings state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Session storage path state
  const [sessionStoragePath, setSessionStoragePath] = useState<string>("");
  const [isSessionPathCustom, setIsSessionPathCustom] = useState(false);

  // Prompt Suggestions state
  const [enablePromptSuggestion, setEnablePromptSuggestion] = useState(() => {
    try {
      const stored = localStorage.getItem('enable_prompt_suggestion');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  // SiliconFlow state (从 settings.json 读取 MCP 配置)
  const [siliconFlowEnabled, setSiliconFlowEnabled] = useState(false);

  // 加载 SiliconFlow 状态
  useEffect(() => {
    // 从 settings 中读取 mcpServers 配置
    const mcpServers = (settings as any)?.mcpServers;
    if (mcpServers && typeof mcpServers === 'object') {
      // 检查是否存在且未被禁用
      const siliconflow = mcpServers['siliconflow'];
      const siliconflowVision = mcpServers['siliconflow-vision'];
      const siliconflowR1 = mcpServers['siliconflow-r1'];

      // 只要有一个 SiliconFlow 服务器启用，就认为是启用状态
      const isEnabled =
        (siliconflow && !siliconflow.disabled) ||
        (siliconflowVision && !siliconflowVision.disabled) ||
        (siliconflowR1 && !siliconflowR1.disabled);

      setSiliconFlowEnabled(isEnabled);
    }
  }, [settings]);

  // Load session storage path
  useEffect(() => {
    const loadSessionPath = async () => {
      try {
        const path = await api.invoke<string | null>("get_session_storage_path_setting");
        if (path) {
          setSessionStoragePath(path);
          setIsSessionPathCustom(true);
        }
      } catch (error) {
        logger.warn('GeneralSettings', "Failed to load session storage path:", error);
      }
    };
    loadSessionPath();
  }, []);

  // Handle session storage path change
  const handleSetSessionPath = async () => {
    try {
      await api.invoke("set_session_storage_path", { path: sessionStoragePath });
      setToast({ message: "会话存储路径已更新", type: "success" });
      setIsSessionPathCustom(true);
    } catch (error) {
      logger.error('GeneralSettings', "Failed to set session storage path:", error);
      setToast({ message: "设置失败: " + String(error), type: "error" });
    }
  };

  // Handle reset session storage path to default
  const handleResetSessionPath = async () => {
    try {
      await api.invoke("set_session_storage_path", { path: "" });
      setSessionStoragePath("");
      setIsSessionPathCustom(false);
      setToast({ message: "已恢复默认存储路径", type: "success" });
    } catch (error) {
      logger.error('GeneralSettings', "Failed to reset session storage path:", error);
      setToast({ message: "重置失败: " + String(error), type: "error" });
    }
  };

  /**
   * 初始化时加载当前 Codex 路径，并在 refresh 事件触发时同步
   */
  useEffect(() => {
    let cancelled = false;

    const loadCodexPath = async () => {
      try {
        const path = await api.getCodexPath();
        if (cancelled) return;

        if (path) {
          setCustomCodexPath(path);
          setCodexPathValid(true);
          setCodexPathError(null);
        } else {
          setCodexPathValid(null);
        }
      } catch (error) {
        if (cancelled) return;
        logger.warn('GeneralSettings', "Failed to load Codex path:", error);
      }
    };

    loadCodexPath();

    const handleRefresh = () => {
      loadCodexPath();
    };

    window.addEventListener('refresh-codex-status', handleRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('refresh-codex-status', handleRefresh);
    };
  }, []);

  /**
   * Handle setting custom Claude CLI path
   */
  const handleSetCustomPath = async () => {
    if (!customClaudePath.trim()) {
      setCustomPathError(t('generalSettings.enterValidPath'));
      return;
    }

    try {
      setCustomPathError(null);
      await api.setCustomClaudePath(customClaudePath.trim());

      // Clear the custom path field and exit custom mode
      setCustomClaudePath("");
      setIsCustomPathMode(false);

      // Show success message
      setToast({ message: t('generalSettings.customPathSuccess'), type: "success" });

      // Trigger status refresh
      window.dispatchEvent(new CustomEvent('validate-claude-installation'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('generalSettings.setCustomPathFailed');
      setCustomPathError(errorMessage);
    }
  };

  /**
   * Handle clearing custom Claude CLI path
   */
  const handleClearCustomPath = async () => {
    try {
      await api.clearCustomClaudePath();

      // Exit custom mode
      setIsCustomPathMode(false);
      setCustomClaudePath("");
      setCustomPathError(null);

      // Show success message
      setToast({ message: t('generalSettings.restoredAutoDetect'), type: "success" });

      // Trigger status refresh
      window.dispatchEvent(new CustomEvent('validate-claude-installation'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('generalSettings.clearCustomPathFailed');
      setToast({ message: errorMessage, type: "error" });
    }
  };

  /**
   * Validate Codex path and update status
   */
  const handleValidateCodexPath = async (path: string) => {
    if (!path.trim()) {
      setCodexPathValid(null);
      return;
    }

    setValidatingCodexPath(true);
    try {
      const isValid = await api.validateCodexPath(path.trim());
      setCodexPathValid(isValid);
      if (!isValid) {
        setCodexPathError(t('generalSettings.codexPathInvalid'));
      } else {
        setCodexPathError(null);
      }
    } catch (error) {
      setCodexPathValid(false);
      setCodexPathError(t('generalSettings.codexPathValidationError'));
    } finally {
      setValidatingCodexPath(false);
    }
  };

  /**
   * Handle setting custom Codex path
   */
  const handleSetCodexCustomPath = async () => {
    if (!customCodexPath.trim()) {
      setCodexPathError(t('generalSettings.enterValidPath'));
      return;
    }

    // First validate the path
    setValidatingCodexPath(true);
    try {
      const isValid = await api.validateCodexPath(customCodexPath.trim());
      if (!isValid) {
        setCodexPathError(t('generalSettings.codexPathInvalid'));
        setCodexPathValid(false);
        return;
      }

      // Path is valid, save it
      await api.setCodexCustomPath(customCodexPath.trim());

      // Update state
      setCodexPathValid(true);
      setCodexPathError(null);
      setIsCodexCustomPathMode(false);
      setCustomCodexPath("");

      // Show success message
      setToast({ message: t('generalSettings.codexPathSuccess'), type: "success" });

      // Trigger Codex status refresh
      window.dispatchEvent(new CustomEvent('refresh-codex-status'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('generalSettings.setCustomPathFailed');
      setCodexPathError(errorMessage);
    } finally {
      setValidatingCodexPath(false);
    }
  };

  /**
   * Handle clearing custom Codex path
   */
  const handleClearCodexCustomPath = async () => {
    try {
      await api.setCodexCustomPath(null);

      // Exit custom mode
      setIsCodexCustomPathMode(false);
      setCustomCodexPath("");
      setCodexPathError(null);
      setCodexPathValid(null);

      // Show success message
      setToast({ message: t('generalSettings.codexRestoredAutoDetect'), type: "success" });

      // Trigger Codex status refresh
      window.dispatchEvent(new CustomEvent('refresh-codex-status'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('generalSettings.clearCustomPathFailed');
      setToast({ message: errorMessage, type: "error" });
    }
  };

  /**
   * Handle Prompt Suggestions toggle
   */
  const handlePromptSuggestionToggle = (checked: boolean) => {
    setEnablePromptSuggestion(checked);
    try {
      localStorage.setItem('enable_prompt_suggestion', checked.toString());
      // Dispatch custom event to sync with FloatingPromptInput
      window.dispatchEvent(new CustomEvent('prompt-suggestion-toggle', { detail: { enabled: checked } }));
    } catch {
      // Ignore localStorage errors
    }
  };

  /**
   * Handle SiliconFlow toggle
   */
  const handleSiliconFlowToggle = async (checked: boolean) => {
    try {
      setSiliconFlowEnabled(checked);

      // 读取当前设置
      const currentSettings = await api.getClaudeSettings();
      const mcpServers = (currentSettings as any)?.mcpServers || {};

      // 更新所有 SiliconFlow 相关的 MCP 服务器状态
      const updatedMcpServers = { ...mcpServers };

      ['siliconflow', 'siliconflow-vision', 'siliconflow-r1'].forEach(name => {
        if (updatedMcpServers[name]) {
          updatedMcpServers[name] = {
            ...updatedMcpServers[name],
            disabled: !checked
          };
        }
      });

      // 保存更新后的设置
      await api.saveClaudeSettings({
        ...currentSettings,
        mcpServers: updatedMcpServers
      });

      setToast({
        message: checked
          ? 'SiliconFlow 辅助模式已启用'
          : 'SiliconFlow 辅助模式已禁用',
        type: 'success'
      });
    } catch (error) {
      logger.error('GeneralSettings', 'Failed to toggle SiliconFlow:', error);
      setSiliconFlowEnabled(!checked); // 恢复状态
      setToast({
        message: `切换失败: ${error}`,
        type: 'error'
      });
    }
  };

  /**
   * Handle reset all settings
   * 重置所有设置：清除环境变量中的模型配置，禁用所有 Hook 和 MCP
   */
  const handleResetSettings = async () => {
    setIsResetting(true);
    try {
      // 1. 读取当前设置
      const currentSettings = await api.getClaudeSettings();

      // 2. 过滤掉所有 ANTHROPIC_MODEL、ANTHROPIC_PLAN_MODEL、ANTHROPIC_SUBAGENT_MODEL 等模型相关变量
      const filteredEnv = Object.fromEntries(
        Object.entries(currentSettings?.env || {}).filter(([key]) =>
          !key.includes('MODEL') &&
          !key.startsWith('ANTHROPIC_MODEL') &&
          !key.startsWith('ANTHROPIC_PLAN_MODEL') &&
          !key.startsWith('ANTHROPIC_SUBAGENT_MODEL')
        )
      );

      // 3. 保存更新后的设置（不包含模型环境变量）
      await api.saveClaudeSettings({
        ...currentSettings,
        env: filteredEnv,
      });

      // 4. 禁用所有用户 Hook
      try {
        await api.updateHooksConfig('user', {} as HooksConfiguration);
      } catch (err) {
        logger.warn('GeneralSettings', 'Failed to disable hooks:', err);
      }

      // 5. 禁用所有 MCP 服务器 (暂时跳过 - API 未实现)
      // TODO: 实现 getMcpServers 和 saveMcpServers API
      // try {
      //   const mcpConfig = await api.getMcpServers();
      //   const disabledMcp: Record<string, any> = {};
      //   for (const [name, config] of Object.entries(mcpConfig || {})) {
      //     disabledMcp[name] = { ...config, disabled: true };
      //   }
      //   await api.saveMcpServers(disabledMcp);
      // } catch (err) {
      //   logger.warn('GeneralSettings', 'Failed to disable MCP servers:', err);
      // }

      setShowResetDialog(false);
      setToast({ message: '所有设置已重置成功！', type: 'success' });

      // 刷新页面以应用更改
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      logger.error('GeneralSettings', 'Failed to reset settings:', error);
      setToast({ message: `重置设置失败: ${error}`, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-4">{t('settings.general')}</h3>
        
        <div className="space-y-4">
          {/* Language Selector */}
          <LanguageSelector />

          {/* Theme Selector */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="theme">{t('settings.theme')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.themeDescription')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                {t('settings.themeLight')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                {t('settings.themeDark')}
              </Button>
            </div>
          </div>

          {/* Show System Initialization Info */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="showSystemInit">{t('generalSettings.showSystemInit')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.showSystemInitDescription')}
              </p>
            </div>
            <Switch
              id="showSystemInit"
              checked={settings?.showSystemInitialization !== false}
              onCheckedChange={(checked) => updateSetting("showSystemInitialization", checked)}
            />
          </div>

          {/* Hide Warmup Messages */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="hideWarmup">{t('generalSettings.hideWarmup')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.hideWarmupDescription')}
              </p>
            </div>
            <Switch
              id="hideWarmup"
              checked={settings?.hideWarmupMessages === true}
              onCheckedChange={(checked) => updateSetting("hideWarmupMessages", checked)}
            />
          </div>

          {/* Hide Startup Warnings */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="hideStartupWarnings">隐藏启动警告</Label>
              <p className="text-xs text-muted-foreground">
                隐藏系统启动期间的警告消息（如 MCP 初始化日志）
              </p>
            </div>
            <Switch
              id="hideStartupWarnings"
              checked={settings?.hideStartupWarnings !== false}
              onCheckedChange={(checked) => updateSetting("hideStartupWarnings", checked)}
            />
          </div>

          {/* Hide Auto Continue Messages */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="hideAutoContinue">隐藏自动继续消息</Label>
              <p className="text-xs text-muted-foreground">
                隐藏系统自动发送的继续执行消息及其回复
              </p>
            </div>
            <Switch
              id="hideAutoContinue"
              checked={settings?.hideAutoContinueMessages !== false}
              onCheckedChange={(checked) => updateSetting("hideAutoContinueMessages", checked)}
            />
          </div>

          {/* Show All Tool Results */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="showAllToolResults">显示所有工具结果</Label>
              <p className="text-xs text-muted-foreground">
                显示所有工具执行结果，即使有专用的 Widget 显示（用于调试）
              </p>
            </div>
            <Switch
              id="showAllToolResults"
              checked={settings?.showAllToolResults === true}
              onCheckedChange={(checked) => updateSetting("showAllToolResults", checked)}
            />
          </div>

          {/* Include Co-authored By */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="coauthored">{t('generalSettings.includeCoauthored')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.includeCoauthoredDescription')}
              </p>
            </div>
            <Switch
              id="coauthored"
              checked={settings?.includeCoAuthoredBy !== false}
              onCheckedChange={(checked) => updateSetting("includeCoAuthoredBy", checked)}
            />
          </div>

          {/* Verbose Output */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="verbose">{t('generalSettings.verboseOutput')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.verboseOutputDescription')}
              </p>
            </div>
            <Switch
              id="verbose"
              checked={settings?.verbose === true}
              onCheckedChange={(checked) => updateSetting("verbose", checked)}
            />
          </div>

          {/* Prompt Suggestions */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="promptSuggestion">{t('generalSettings.promptSuggestion')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.promptSuggestionDescription')}
              </p>
            </div>
            <Switch
              id="promptSuggestion"
              checked={enablePromptSuggestion}
              onCheckedChange={handlePromptSuggestionToggle}
            />
          </div>

          {/* SiliconFlow 辅助模式 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="siliconflow" className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  SiliconFlow 辅助模式
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm">
                      <div className="space-y-2">
                        <p className="font-medium">如何使用 SiliconFlow</p>
                        <p className="text-xs">在提示词中使用以下指令调用 SiliconFlow 模型：</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li><code className="bg-muted px-1 rounded">@siliconflow</code> - 通用文本模型</li>
                          <li><code className="bg-muted px-1 rounded">@siliconflow-vision</code> - 视觉模型（支持图片）</li>
                          <li><code className="bg-muted px-1 rounded">@siliconflow-r1</code> - 推理模型</li>
                        </ul>
                        <div className="pt-1 border-t">
                          <p className="text-xs text-muted-foreground">
                            示例: "@siliconflow 帮我分析这段代码"
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            适用场景: 简单查询、代码分析、图片识别等，节省 Claude API 额度
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                启用后可在提示词中通过 @siliconflow 调用替代模型，节省 API 额度
              </p>
            </div>
            <Switch
              id="siliconflow"
              checked={siliconFlowEnabled}
              onCheckedChange={handleSiliconFlowToggle}
            />
          </div>

          {/* Disable Rewind Git Operations */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="disableRewindGitOps">{t('generalSettings.disableRewindGitOps')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('generalSettings.disableRewindGitOpsDescription')}
              </p>
            </div>
            <Switch
              id="disableRewindGitOps"
              checked={disableRewindGitOps}
              onCheckedChange={handleRewindGitOpsToggle}
            />
          </div>

          {/* Cleanup Period */}
          <div className="space-y-2">
            <Label htmlFor="cleanup">{t('generalSettings.chatRetentionDays')}</Label>
            <Input
              id="cleanup"
              type="number"
              min="1"
              placeholder="30"
              value={settings?.cleanupPeriodDays || ""}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                updateSetting("cleanupPeriodDays", value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('generalSettings.chatRetentionDaysDescription')}
            </p>
          </div>
          

          {/* Custom Claude Path Configuration */}
          <div className="space-y-4">
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-sm font-medium">{t('generalSettings.customClaudePath')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('generalSettings.customClaudePathDescription')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCustomPathMode(!isCustomPathMode);
                    setCustomPathError(null);
                    setCustomClaudePath("");
                  }}
                >
                  {isCustomPathMode ? t('buttons.cancel') : t('generalSettings.setCustomPath')}
                </Button>
              </div>

              <AnimatePresence>
                {isCustomPathMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <Input
                        placeholder={t('common.pathToClaudeCli')}
                        value={customClaudePath}
                        onChange={(e) => {
                          setCustomClaudePath(e.target.value);
                          setCustomPathError(null);
                        }}
                        className={cn(customPathError && "border-red-500")}
                      />
                      {customPathError && (
                        <p className="text-xs text-red-500">{customPathError}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSetCustomPath}
                        disabled={!customClaudePath.trim()}
                      >
                        {t('generalSettings.setPath')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearCustomPath}
                      >
                        {t('generalSettings.restoreAutoDetect')}
                      </Button>
                    </div>

                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            <strong>{t('generalSettings.currentPath')}:</strong> {t('generalSettings.notSet')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('generalSettings.pathValidationHint')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Custom Codex Path Configuration */}
          <div className="space-y-4">
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-sm font-medium">{t('generalSettings.customCodexPath')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('generalSettings.customCodexPathDescription')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCodexCustomPathMode(!isCodexCustomPathMode);
                    setCodexPathError(null);
                    setCustomCodexPath("");
                    setCodexPathValid(null);
                  }}
                >
                  {isCodexCustomPathMode ? t('buttons.cancel') : t('generalSettings.setCustomPath')}
                </Button>
              </div>

              <AnimatePresence>
                {isCodexCustomPathMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('generalSettings.codexPathPlaceholder')}
                          value={customCodexPath}
                          onChange={(e) => {
                            setCustomCodexPath(e.target.value);
                            setCodexPathError(null);
                            setCodexPathValid(null);
                          }}
                          onBlur={() => {
                            if (customCodexPath.trim()) {
                              handleValidateCodexPath(customCodexPath);
                            }
                          }}
                          className={cn(
                            "flex-1",
                            codexPathError && "border-red-500",
                            codexPathValid === true && "border-green-500"
                          )}
                        />
                        {validatingCodexPath && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                        {!validatingCodexPath && codexPathValid === true && (
                          <span className="text-green-500 text-sm flex items-center">✓ {t('common.valid')}</span>
                        )}
                        {!validatingCodexPath && codexPathValid === false && (
                          <span className="text-red-500 text-sm flex items-center">✗ {t('common.invalid')}</span>
                        )}
                      </div>
                      {codexPathError && (
                        <p className="text-xs text-red-500">{codexPathError}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSetCodexCustomPath}
                        disabled={!customCodexPath.trim() || validatingCodexPath}
                      >
                        {validatingCodexPath ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            {t('messages.validating')}
                          </>
                        ) : (
                          t('generalSettings.setPath')
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearCodexCustomPath}
                      >
                        {t('generalSettings.restoreAutoDetect')}
                      </Button>
                    </div>

                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            <strong>{t('generalSettings.codexPathHint')}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('generalSettings.codexCommonPaths')}
                          </p>
                          <ul className="text-xs text-muted-foreground mt-1 ml-3 list-disc">
                            <li>C:\Users\username\AppData\Roaming\npm\codex.ps1</li>
                            <li>D:\nodejs\node_global\codex.ps1</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Session Storage Path */}
          <div className="border-t pt-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">智能会话存储路径</Label>
                  <p className="text-xs text-muted-foreground">
                    自定义智能会话续接系统的存储位置（留空使用默认路径）
                  </p>
                </div>
                <Switch
                  checked={isSessionPathCustom}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      handleResetSessionPath();
                    }
                    setIsSessionPathCustom(checked);
                  }}
                />
              </div>

              <AnimatePresence>
                {isSessionPathCustom && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={sessionStoragePath}
                        onChange={(e) => setSessionStoragePath(e.target.value)}
                        placeholder="例如: E:\FangyuCode\Sessions"
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSetSessionPath}
                        size="sm"
                        disabled={!sessionStoragePath.trim()}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        保存
                      </Button>
                    </div>

                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            <strong>提示：</strong>会话文件将存储在指定目录的 sessions 子目录下
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            默认路径：{"{AppData}"}/sessions/
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Check for Updates */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">检查更新</Label>
                <p className="text-xs text-muted-foreground">
                  手动检查 Fangyu Code 的最新版本
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const { checkForUpdates } = (window as any).__updateHook || {};
                  if (checkForUpdates) {
                    checkForUpdates(true);
                  }
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                检查更新
              </Button>
            </div>
          </div>

          {/* Reset All Settings */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-destructive">重置所有设置</Label>
                <p className="text-xs text-muted-foreground">
                  清除所有环境配置（ANTHROPIC_MODEL 等），禁用所有 Hook 和 MCP
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetDialog(true)}
                className="gap-2"
              >
                <RotateCcw className="h-3 w-3" />
                重置设置
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ 确认重置所有设置</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>此操作将执行以下重置：</p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li className="text-destructive">
                  <strong>删除所有环境变量配置</strong>
                  <br />
                  包括 ANTHROPIC_MODEL、ANTHROPIC_PLAN_MODEL、ANTHROPIC_SUBAGENT_MODEL 等
                </li>
                <li className="text-destructive">
                  <strong>禁用所有 Hook</strong>
                  <br />
                  用户自定义的 Hook 将全部被禁用
                </li>
                <li className="text-destructive">
                  <strong>禁用所有 MCP 服务器</strong>
                  <br />
                  所有 MCP 服务器将被标记为禁用状态
                </li>
              </ul>
              <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                ⚠️ 重置后页面将自动刷新以应用更改
              </p>
              <p className="font-medium">确定要重置所有设置吗？</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetSettings}
              disabled={isResetting}
              className="gap-2"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  确认重置
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
