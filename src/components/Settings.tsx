import { logger } from '@/lib/logger';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Save from 'lucide-react/dist/esm/icons/save'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import Cpu from 'lucide-react/dist/esm/icons/cpu'
import Languages from 'lucide-react/dist/esm/icons/languages'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Database from 'lucide-react/dist/esm/icons/database'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Wrench from 'lucide-react/dist/esm/icons/wrench';
import { notify } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  type ClaudeSettings,
  type ClaudeExecutionConfig
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { StorageTab } from "./StorageTab";
import { PromptEnhancementSettings } from "./PromptEnhancementSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigation } from "@/contexts/NavigationContext";
// 新统一组件（v2.8.0+ 全面重构）
import { EngineConfigPanel } from "./EngineConfigPanel";
import { TranslationSettings } from "./TranslationSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { ConfigManagerEmbedded } from "./ConfigManager";
import { OutputDisplaySettings } from "./settings/OutputDisplaySettings";
import { SuperAgentSettings } from "./settings/SuperAgentSettings";

interface SettingsProps {
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Optional initial tab to display
   */
  initialTab?: string;
  /**
   * Optional callback when back is triggered
   */
  onBack?: () => void;
}

interface PermissionRule {
  id: string;
  value: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * 全面的设置界面，用于管理 Claude Code 设置
 * 提供无代码界面来编辑 settings.json 文件
 * Comprehensive Settings UI for managing Claude Code settings
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  className,
  initialTab,
}) => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab || "general");

  // ⚡ 监听切换到提示词API标签的事件（内部事件）
  useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab("prompt-api");
    };

    window.addEventListener('switch-to-prompt-api-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-to-prompt-api-tab', handleSwitchTab);
  }, []);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);

  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);

  // Execution config state
  const [executionConfig, setExecutionConfig] = useState<ClaudeExecutionConfig | null>(null);
  const [disableRewindGitOps, setDisableRewindGitOps] = useState(false);
  const [showRewindGitConfirmDialog, setShowRewindGitConfirmDialog] = useState(false);

  // Provider sub-tabs state - 已废弃，使用新的 EngineConfigPanel
  // const [providerSubTab, setProviderSubTab] = useState("claude");

  // 挂载时加载设置
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Loads the current Claude settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();

      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        logger.warn('Settings', "Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }

      setSettings(loadedSettings);

      // Load execution config
      try {
        const execConfig = await api.getClaudeExecutionConfig();
        setExecutionConfig(execConfig);
        setDisableRewindGitOps(execConfig.disable_rewind_git_operations || false);
      } catch (err) {
        logger.error('Settings', "Failed to load execution config:", err);
        // Continue with default values
      }

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
            enabled: true, // 默认启用所有现有的环境变量
          }))
        );
      }

    } catch (err) {
      logger.error('Settings', "Failed to load settings:", err);
      setError(t('errors.loadFailed'));
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v.trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v.trim()),
        },
        env: {
          // UI 中配置的环境变量完全由用户管理（支持删除）
          ...envVars
            .filter(envVar => envVar.enabled) // 只保存启用的环境变量
            .reduce((acc, { key, value }) => {
              if (key.trim() && value.trim()) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
        },
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save execution config if changed
      if (executionConfig) {
        const updatedExecConfig = {
          ...executionConfig,
          disable_rewind_git_operations: disableRewindGitOps,
        };
        await api.updateClaudeExecutionConfig(updatedExecConfig);
        setExecutionConfig(updatedExecConfig);
      }

      // 🆕 使用顶部居中通知
      notify.success(t('settings.saved') || "设置已保存", {
        position: "top-center",
        duration: 3000,
      });
    } catch (err) {
      logger.error('Settings', "Failed to save settings:", err);
      setError(t('errors.saveFailed'));
      notify.error(t('errors.saveFailed') || "设置保存失败", {
        position: "top-center",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Handle rewind git operations toggle with confirmation
   */
  const handleRewindGitOpsToggle = (checked: boolean) => {
    if (checked) {
      // Show confirmation dialog when enabling
      setShowRewindGitConfirmDialog(true);
    } else {
      // Directly disable without confirmation
      setDisableRewindGitOps(false);
    }
  };

  /**
   * Confirm enabling disable rewind git operations
   */
  const confirmEnableRewindGitOpsDisable = () => {
    setDisableRewindGitOps(true);
    setShowRewindGitConfirmDialog(false);
  };

  /**
   * Cancel enabling disable rewind git operations
   */
  const cancelEnableRewindGitOpsDisable = () => {
    setShowRewindGitConfirmDialog(false);
  };

  /**
   * Adds a new permission rule
   */
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };

    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule =>
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setDenyRules(prev => prev.map(rule =>
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a permission rule
   */
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
      enabled: true, // 默认启用新的环境变量
    };
    setEnvVars(prev => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (id: string, field: "key" | "value" | "enabled", value: string | boolean) => {
    setEnvVars(prev => prev.map(envVar =>
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ));
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id));
  };

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/20 text-foreground", className)}>
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
        {/* Premium Header with Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative flex items-center justify-between p-5 border-b border-border/50 backdrop-blur-xl bg-background/80"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 hover:scale-105"
              aria-label="返回"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-primary/20">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{t('settings.title')}</h2>
                <p className="text-xs text-muted-foreground">
                  {t('common.configureClaudePreferences')}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={saveSettings}
            disabled={saving || loading}
            size="sm"
            className={cn(
              "gap-2 px-5 rounded-xl font-medium",
              "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
              "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
              "transition-all duration-300 hover:scale-[1.02]",
              saving && "scale-95 opacity-80"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('common.savingSettings')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                {t('common.saveSettings')}
              </>
            )}
          </Button>
        </motion.div>

        {/* Error message with premium styling */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mx-5 mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3 text-sm text-destructive backdrop-blur-sm"
            >
              <div className="p-1.5 rounded-lg bg-destructive/20">
                <AlertCircle className="h-4 w-4" />
              </div>
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content with enhanced loading state */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">加载设置中...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Premium Tab Navigation */}
              <TabsList className="grid grid-cols-7 w-full h-auto p-1.5 bg-muted/50 rounded-2xl backdrop-blur-sm border border-border/50 gap-1">
                <TabsTrigger
                  value="general"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5 transition-all duration-200"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden lg:inline">{t('settings.general')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="engines"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5 transition-all duration-200"
                >
                  <Cpu className="h-4 w-4" />
                  <span className="hidden lg:inline">引擎配置</span>
                </TabsTrigger>
                <TabsTrigger
                  value="translation"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5 transition-all duration-200"
                >
                  <Languages className="h-4 w-4" />
                  <span className="hidden lg:inline">{t('settings.translation')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="prompt-api"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5 transition-all duration-200"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden lg:inline">{t('settings.promptApi')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="storage"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5 transition-all duration-200"
                >
                  <Database className="h-4 w-4" />
                  <span className="hidden lg:inline">{t('settings.storage')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="super-agent"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-purple-500/10 data-[state=active]:shadow-lg transition-all duration-200 text-primary"
                >
                  <Bot className="h-4 w-4" />
                  <span className="hidden lg:inline">Super Agent</span>
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  className="gap-2 py-2.5 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/10 data-[state=active]:to-red-500/10 data-[state=active]:shadow-lg transition-all duration-200 text-orange-500"
                >
                  <Wrench className="h-4 w-4" />
                  <span className="hidden lg:inline">配置管理</span>
                </TabsTrigger>
              </TabsList>

              {/* General Settings with Card Design */}
              <TabsContent value="general" className="space-y-6 mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <OutputDisplaySettings />
                  <GeneralSettings
                    settings={settings}
                    updateSetting={updateSetting}
                    disableRewindGitOps={disableRewindGitOps}
                    handleRewindGitOpsToggle={handleRewindGitOpsToggle}
                    setToast={setToast}
                  />
                </motion.div>
              </TabsContent>

              {/* 🆕 引擎配置 - 使用新的统一面板 */}
              <TabsContent value="engines" className="space-y-6 mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <EngineConfigPanel />
                </motion.div>
              </TabsContent>

              {/* Translation Tab */}
              <TabsContent value="translation">
                <TranslationSettings />
              </TabsContent>

              {/* Prompt Enhancement API Tab */}
              <TabsContent value="prompt-api">
                <PromptEnhancementSettings />
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage">
                <StorageTab />
              </TabsContent>

              {/* Super Agent Tab - Super Agent 配置 */}
              <TabsContent value="super-agent">
                <SuperAgentSettings />
              </TabsContent>

              {/* Config Manager Tab - 配置管理中心 */}
              <TabsContent value="config">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    全面诊断和管理配置，优化 Token 消耗
                  </div>
                  <ConfigManagerEmbedded />
                </div>
              </TabsContent>

            </Tabs>
          </div >
        )}
      </div >

      {/* Confirmation Dialog for Disabling Rewind Git Operations */}
      < Dialog open={showRewindGitConfirmDialog} onOpenChange={setShowRewindGitConfirmDialog} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ {t('dialogs.confirmGitOps')}</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>{t('dialogs.gitOpsWarning')}</p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li className="text-green-600 dark:text-green-400">
                  <strong>{t('dialogs.gitOpsCanDo')}</strong>
                </li>
                <li className="text-red-600 dark:text-red-400">
                  <strong>{t('dialogs.gitOpsCannotDo')}</strong>
                </li>
              </ul>
              <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                ⚠️ {t('dialogs.gitOpsNote')}
              </p>
              <p className="text-muted-foreground">
                {t('dialogs.gitOpsUseCase')}
              </p>
              <p className="font-medium">{t('dialogs.confirmDeleteMessage')}</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelEnableRewindGitOpsDisable}
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmEnableRewindGitOpsDisable}
            >
              {t('dialogs.confirmEnable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Toast Notification */}
      <ToastContainer>
        {
          toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )
        }
      </ToastContainer >
    </div >
  );
};  
