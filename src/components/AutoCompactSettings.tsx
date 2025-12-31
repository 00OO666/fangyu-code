/**
 * AutoCompactSettings - Configuration UI for automatic context compaction
 *
 * This component provides a comprehensive interface for configuring Claude Code SDK's
 * auto-compact functionality with intelligent threshold management and real-time monitoring.
 */

import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Zap,
  Clock,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Loader2,
  Info,
  Activity,
  Brain,
  Gauge,
  Timer,
  MessageSquare,
  TrendingUp,
  Sparkles,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api, AutoCompactConfig, AutoCompactStatus, SessionContext, CompactionStrategy } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface AutoCompactSettingsProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const AutoCompactSettings: React.FC<AutoCompactSettingsProps> = ({
  open,
  onOpenChange,
  className,
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AutoCompactConfig | null>(null);
  const [status, setStatus] = useState<AutoCompactStatus | null>(null);
  const [sessions, setSessions] = useState<SessionContext[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  // Load initial data
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize auto-compact manager if not already done
      try {
        await api.initAutoCompactManager();
      } catch (e) {
        // Manager might already be initialized, ignore error
        console.debug("Auto-compact manager might already be initialized");
      }

      // Load configuration and status
      const [configData, statusData, sessionsData] = await Promise.all([
        api.getAutoCompactConfig(),
        api.getAutoCompactStatus(),
        api.getAllMonitoredSessions(),
      ]);

      setConfig(configData);
      setStatus(statusData);
      setSessions(sessionsData);
    } catch (err) {
      console.error("Failed to load auto-compact data:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<AutoCompactConfig>) => {
    if (!config) return;

    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setError(null);

    try {
      await api.updateAutoCompactConfig(config);
      setHasChanges(false);

      // Reload data to show updated values
      await loadData();
    } catch (err) {
      console.error("Failed to save config:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualCompaction = async (sessionId: string) => {
    try {
      await api.triggerManualCompaction(sessionId);
      // Reload sessions to show updated status
      await loadData();
    } catch (err) {
      console.error("Failed to trigger compaction:", err);
      setError(err instanceof Error ? err.message : "Failed to trigger compaction");
    }
  };

  const getStrategyIcon = (strategy: CompactionStrategy) => {
    if (strategy === 'Smart') return <Brain className="h-4 w-4" />;
    if (strategy === 'Aggressive') return <Zap className="h-4 w-4" />;
    if (strategy === 'Conservative') return <Shield className="h-4 w-4" />;
    return <Settings2 className="h-4 w-4" />;
  };

  const getStrategyDescription = (strategy: CompactionStrategy) => {
    if (strategy === 'Smart') return t('autoCompact.smartCompressionDescription');
    if (strategy === 'Aggressive') return t('autoCompact.aggressiveCompressionDescription');
    if (strategy === 'Conservative') return t('autoCompact.conservativeCompressionDescription');
    return t('autoCompact.customCompressionDescription');
  };

  const getSessionStatusIcon = (status: SessionContext['status']) => {
    if (status === 'Active') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'Compacting') return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    if (status === 'Idle') return <Clock className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getSessionStatusText = (status: SessionContext['status']) => {
    if (status === 'Active') return t('autoCompact.active');
    if (status === 'Compacting') return t('autoCompact.compacting');
    if (status === 'Idle') return t('autoCompact.idle');
    if (typeof status === 'object' && 'CompactionFailed' in status) {
      return `${t('autoCompact.compactionFailed')}: ${status.CompactionFailed}`;
    }
    return t('autoCompact.idle');
  };

  const formatTokenCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  if (isLoading || !config) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-muted-foreground">{t('autoCompact.loading')}</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-4xl max-h-[85vh] overflow-hidden", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            {t('autoCompact.title')}
          </DialogTitle>
          <DialogDescription>
            {t('autoCompact.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <Tabs value={activeTab} className="flex-1 overflow-hidden"
              onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('autoCompact.config')}
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('autoCompact.statusMonitor')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('autoCompact.sessionManagement')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6 overflow-auto max-h-[calc(85vh-200px)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t('autoCompact.basicSettings')}
                </CardTitle>
                <CardDescription>
                  {t('autoCompact.basicSettingsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">{t('autoCompact.enableAutoCompact')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('autoCompact.enableAutoCompactDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) => handleConfigChange({ enabled })}
                  />
                </div>

                <hr className="border-t border-border my-4" />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-blue-500" />
                    <Label className="text-base">{t('autoCompact.maxContextTokens')}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('autoCompact.maxContextTokensHint')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="number"
                    value={config.max_context_tokens}
                    onChange={(e) => handleConfigChange({
                      max_context_tokens: parseInt(e.target.value) || 120000
                    })}
                    min={10000}
                    max={200000}
                    step={1000}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <Label className="text-base">{t('autoCompact.compactionThreshold')}</Label>
                    <Badge variant="secondary">{Math.round(config.compaction_threshold * 100)}%</Badge>
                  </div>
                  <div className="px-2">
                    <input
                      type="range"
                      value={config.compaction_threshold}
                      onChange={(e) => handleConfigChange({ compaction_threshold: parseFloat(e.target.value) })}
                      max={1.0}
                      min={0.5}
                      step={0.05}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>50%</span>
                      <span>{t('autoCompact.conservative')}</span>
                      <span>{t('autoCompact.aggressive')}</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-green-500" />
                    <Label className="text-base">{t('autoCompact.compactionInterval')}</Label>
                  </div>
                  <Input
                    type="number"
                    value={config.min_compaction_interval}
                    onChange={(e) => handleConfigChange({
                      min_compaction_interval: parseInt(e.target.value) || 300
                    })}
                    min={60}
                    max={3600}
                    step={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('autoCompact.compactionIntervalHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  {t('autoCompact.strategy')}
                </CardTitle>
                <CardDescription>
                  {t('autoCompact.strategyDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base">{t('autoCompact.strategyType')}</Label>
                  <Select
                    value={typeof config.compaction_strategy === 'string' ? config.compaction_strategy : 'Custom'}
                    onValueChange={(value) => {
                      if (value === 'Custom') {
                        handleConfigChange({ compaction_strategy: { Custom: config.custom_instructions || "" } });
                      } else {
                        handleConfigChange({
                          compaction_strategy: value as 'Smart' | 'Aggressive' | 'Conservative'
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {getStrategyIcon(config.compaction_strategy)}
                          {typeof config.compaction_strategy === 'string' ? config.compaction_strategy : 'Custom'}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Smart">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{t('autoCompact.smartCompression')}</p>
                            <p className="text-xs text-muted-foreground">{t('autoCompact.smartCompressionShort')}</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Aggressive">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{t('autoCompact.aggressiveCompression')}</p>
                            <p className="text-xs text-muted-foreground">{t('autoCompact.aggressiveCompressionShort')}</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Conservative">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{t('autoCompact.conservativeCompression')}</p>
                            <p className="text-xs text-muted-foreground">{t('autoCompact.conservativeCompressionShort')}</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Custom">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{t('autoCompact.customCompression')}</p>
                            <p className="text-xs text-muted-foreground">{t('autoCompact.customCompressionShort')}</p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {getStrategyDescription(config.compaction_strategy)}
                  </p>
                </div>

                {(typeof config.compaction_strategy === 'object' || config.custom_instructions) && (
                  <div className="space-y-3">
                    <Label className="text-base">{t('autoCompact.customInstructions')}</Label>
                    <Textarea
                      value={config.custom_instructions || ""}
                      onChange={(e) => handleConfigChange({ custom_instructions: e.target.value })}
                      placeholder={t('autoCompact.customInstructionsPlaceholder')}
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('autoCompact.customInstructionsHint')}
                    </p>
                  </div>
                )}

                <hr className="border-t border-border my-4" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">{t('autoCompact.preserveRecentMessages')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('autoCompact.preserveRecentMessagesDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={config.preserve_recent_messages}
                      onCheckedChange={(preserve_recent_messages) =>
                        handleConfigChange({ preserve_recent_messages })}
                    />
                  </div>

                  {config.preserve_recent_messages && (
                    <div className="space-y-2">
                      <Label>{t('autoCompact.preserveMessageCount')}</Label>
                      <Input
                        type="number"
                        value={config.preserve_message_count}
                        onChange={(e) => handleConfigChange({
                          preserve_message_count: parseInt(e.target.value) || 10
                        })}
                        min={1}
                        max={50}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => loadData()}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                {t('buttons.refresh')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  "bg-blue-600 hover:bg-blue-700",
                  "transition-all duration-200",
                  isSaving && "scale-95 opacity-80"
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                {isSaving ? t('common.saving') : t('autoCompact.saveSettingsButton')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4 overflow-auto max-h-[calc(85vh-200px)]">
            {status && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {t('autoCompact.systemStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('autoCompact.statusLabel')}</p>
                      <div className="flex items-center gap-2">
                        {status.enabled ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {status.enabled ? t('autoCompact.statusEnabled') : t('autoCompact.statusDisabled')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('autoCompact.monitoringSessions')}</p>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">{status.sessions_count}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('autoCompact.totalCompactions')}</p>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">{status.total_compactions}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('autoCompact.compactionThresholdLabel')}</p>
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">
                          {formatTokenCount(Math.round(status.max_context_tokens * status.compaction_threshold))}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4 overflow-auto max-h-[calc(85vh-200px)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('autoCompact.activeSessions')}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {t('autoCompact.activeSessionsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>{t('autoCompact.noActiveSessions')}</p>
                    <p className="text-sm">{t('autoCompact.noActiveSessionsHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.session_id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getSessionStatusIcon(session.status)}
                            <div>
                              <p className="font-medium text-sm">
                                {session.session_id.slice(0, 8)}...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {session.model}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {getSessionStatusText(session.status)}
                            </Badge>
                            {session.status === 'Active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleManualCompaction(session.session_id)}
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                {t('autoCompact.compress')}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">{t('autoCompact.currentTokens')}</p>
                            <p className="font-medium">
                              {formatTokenCount(session.current_tokens)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t('autoCompact.messageCount')}</p>
                            <p className="font-medium">{session.message_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t('autoCompact.compactionCount')}</p>
                            <p className="font-medium">{session.compaction_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t('autoCompact.projectPath')}</p>
                            <p className="font-medium text-xs truncate">
                              ...{session.project_path.slice(-20)}
                            </p>
                          </div>
                        </div>

                        {session.current_tokens > 0 && config && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{t('autoCompact.usageLabel')}</span>
                              <span>
                                {Math.round((session.current_tokens / config.max_context_tokens) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all duration-300",
                                  session.current_tokens / config.max_context_tokens > config.compaction_threshold
                                    ? "bg-red-500"
                                    : session.current_tokens / config.max_context_tokens > 0.7
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                )}
                                style={{
                                  width: `${Math.min(
                                    (session.current_tokens / config.max_context_tokens) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AutoCompactSettings;