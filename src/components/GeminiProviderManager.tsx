import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  Globe,
  Check,
  AlertCircle,
  RefreshCw,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api, type GeminiProviderConfig, type CurrentGeminiProviderConfig } from '@/lib/api';
import { Toast } from '@/components/ui/toast';
import GeminiProviderForm from './GeminiProviderForm';
import {
  geminiProviderPresets,
  extractApiKeyFromEnv,
  extractBaseUrlFromEnv,
  extractModelFromEnv,
  getCategoryKey,
} from '@/config/geminiProviderPresets';
import { useTranslation } from "@/hooks/useTranslation";

interface GeminiProviderManagerProps {
  onBack?: () => void;
}

export default function GeminiProviderManager({ onBack }: GeminiProviderManagerProps) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<GeminiProviderConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<CurrentGeminiProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCurrentConfig, setShowCurrentConfig] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<GeminiProviderConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<GeminiProviderConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 尝试加载自定义预设和当前配置
      let customPresets: GeminiProviderConfig[] = [];
      let config: CurrentGeminiProviderConfig | null = null;

      try {
        customPresets = await api.getGeminiProviderPresets();
      } catch (error) {
        console.warn('Failed to load custom Gemini presets, using defaults:', error);
      }

      try {
        config = await api.getCurrentGeminiProviderConfig();
      } catch (error) {
        console.warn('Failed to load current Gemini config:', error);
      }

      // 合并内置预设和自定义预设
      const builtInPresets: GeminiProviderConfig[] = geminiProviderPresets
        .filter(p => !p.isCustomTemplate) // 排除自定义模板
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          websiteUrl: p.websiteUrl,
          category: p.category,
          env: p.env,
          isOfficial: p.category === 'official',
          isPartner: p.isPartner,
        }));

      // 自定义预设放在内置预设后面
      setPresets([...builtInPresets, ...customPresets]);
      setCurrentConfig(config);
    } catch (error) {
      console.error('Failed to load Gemini provider data:', error);
      setToastMessage({ message: t('provider.loadGeminiConfigFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const switchProvider = async (config: GeminiProviderConfig) => {
    try {
      setSwitching(config.id);
      const message = await api.switchGeminiProvider(config);
      setToastMessage({ message, type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Failed to switch Gemini provider:', error);
      setToastMessage({ message: t('provider.switchGeminiFailed'), type: 'error' });
    } finally {
      setSwitching(null);
    }
  };

  const clearProvider = async () => {
    try {
      setSwitching('clear');
      const message = await api.clearGeminiProviderConfig();
      setToastMessage({ message, type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Failed to clear Gemini provider:', error);
      setToastMessage({ message: t('provider.clearGeminiConfigFailed'), type: 'error' });
    } finally {
      setSwitching(null);
    }
  };

  const testConnection = async (config: GeminiProviderConfig) => {
    try {
      setTesting(config.id);
      const baseUrl = extractBaseUrlFromEnv(config.env);
      const apiKey = extractApiKeyFromEnv(config.env);
      const message = await api.testGeminiProviderConnection(baseUrl, apiKey);
      setToastMessage({ message, type: 'success' });
    } catch (error) {
      console.error('Failed to test Gemini connection:', error);
      setToastMessage({ message: t('provider.connectionTestFailed'), type: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowForm(true);
  };

  const handleEditProvider = (config: GeminiProviderConfig) => {
    setEditingProvider(config);
    setShowForm(true);
  };

  const handleDeleteProvider = (config: GeminiProviderConfig) => {
    setProviderToDelete(config);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProvider = async () => {
    if (!providerToDelete) return;

    try {
      setDeleting(providerToDelete.id);
      await api.deleteGeminiProviderConfig(providerToDelete.id);
      setToastMessage({ message: t('provider.geminiDeleteSuccess'), type: 'success' });
      await loadData();
      setDeleteDialogOpen(false);
      setProviderToDelete(null);
    } catch (error) {
      console.error('Failed to delete Gemini provider:', error);
      setToastMessage({ message: t('provider.geminiDeleteFailed'), type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const cancelDeleteProvider = () => {
    setDeleteDialogOpen(false);
    setProviderToDelete(null);
  };

  const handleFormSubmit = async (formData: Omit<GeminiProviderConfig, 'id'>) => {
    try {
      if (editingProvider) {
        const updatedConfig = { ...formData, id: editingProvider.id };
        await api.updateGeminiProviderConfig(updatedConfig);

        // 如果编辑的是当前活跃的代理商，同步更新配置文件
        if (isCurrentProvider(editingProvider)) {
          try {
            await api.switchGeminiProvider(updatedConfig);
            setToastMessage({ message: t('provider.geminiUpdateSyncSuccess'), type: 'success' });
          } catch (switchError) {
            console.error('Failed to sync Gemini provider config:', switchError);
            setToastMessage({ message: t('provider.geminiUpdateSyncFailed'), type: 'error' });
          }
        } else {
          setToastMessage({ message: t('provider.geminiUpdateSuccess'), type: 'success' });
        }
      } else {
        await api.addGeminiProviderConfig(formData);
        setToastMessage({ message: t('provider.geminiAddSuccess'), type: 'success' });
      }
      setShowForm(false);
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save Gemini provider:', error);
      setToastMessage({ message: editingProvider ? t('provider.geminiUpdateFailed') : t('provider.geminiAddFailed'), type: 'error' });
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingProvider(null);
  };

  // 判断是否为当前使用的供应商
  const isCurrentProvider = (config: GeminiProviderConfig): boolean => {
    if (!currentConfig) return false;

    // 官方供应商：检查 selectedAuthType 是否为 oauth-personal 且没有 baseUrl
    if (config.isOfficial || config.category === 'official') {
      return currentConfig.selectedAuthType === 'oauth-personal' && !currentConfig.baseUrl;
    }

    // 第三方供应商：通过 baseUrl 判断
    const configBaseUrl = extractBaseUrlFromEnv(config.env);
    const currentBaseUrl = currentConfig.baseUrl || '';
    return configBaseUrl === currentBaseUrl && !!configBaseUrl;
  };

  // 判断是否为内置预设（不能删除）
  const isBuiltInPreset = (config: GeminiProviderConfig): boolean => {
    return geminiProviderPresets.some(p => p.id === config.id);
  };

  const maskToken = (token: string): string => {
    if (!token || token.length <= 10) return token;
    const start = token.substring(0, 8);
    const end = token.substring(token.length - 4);
    return `${start}${'*'.repeat(Math.min(token.length - 12, 20))}${end}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{t('provider.loadingGeminiConfig')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8" aria-label={t('provider.backToSettings')}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t('provider.geminiProviderManager')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('provider.switchGeminiProvider')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleAddProvider}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
            {t('provider.addProvider')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCurrentConfig(true)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
            {t('provider.viewCurrentConfig')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearProvider}
            disabled={switching === 'clear'}
            className="text-xs"
          >
            {switching === 'clear' ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
            )}
            {t('provider.resetToOfficial')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {presets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{t('provider.noGeminiProviders')}</p>
                <Button onClick={handleAddProvider} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('provider.addFirstProvider')}
                </Button>
              </div>
            </div>
          ) : (
            presets.map((config) => (
              <Card key={config.id} className={`p-4 ${isCurrentProvider(config) ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium">{config.name}</h3>
                      </div>
                      {isCurrentProvider(config) && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          {t('provider.currentUsing')}
                        </Badge>
                      )}
                      {config.isOfficial && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                          {t('provider.official')}
                        </Badge>
                      )}
                      {config.isPartner && (
                        <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950">
                          {t('provider.partner')}
                        </Badge>
                      )}
                      {config.category && (
                        <Badge variant="outline" className="text-xs">
                          {t(getCategoryKey(config.category))}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {config.description && (
                        <p><span className="font-medium">{t('provider.description')}</span>{config.description.startsWith('provider.') ? t(config.description) : config.description}</p>
                      )}
                      {config.websiteUrl && (
                        <p className="flex items-center gap-1">
                          <span className="font-medium">{t('provider.website')}</span>
                          <a
                            href={config.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {config.websiteUrl}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </p>
                      )}
                      {!config.isOfficial && (
                        <>
                          {extractApiKeyFromEnv(config.env) && (
                            <p><span className="font-medium">{t('provider.apiKey')}</span>
                              {showTokens ? extractApiKeyFromEnv(config.env) : maskToken(extractApiKeyFromEnv(config.env))}
                            </p>
                          )}
                          {extractBaseUrlFromEnv(config.env) && (
                            <p><span className="font-medium">{t('provider.apiUrl')}</span>{extractBaseUrlFromEnv(config.env)}</p>
                          )}
                          {extractModelFromEnv(config.env) && (
                            <p><span className="font-medium">{t('provider.model')}</span>{extractModelFromEnv(config.env)}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!config.isOfficial && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(config)}
                        disabled={testing === config.id}
                        className="text-xs"
                        aria-label={t('tooltips.testConnection')}
                      >
                        {testing === config.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <TestTube className="h-3 w-3" aria-hidden="true" />
                        )}
                      </Button>
                    )}

                    {!isBuiltInPreset(config) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProvider(config)}
                          className="text-xs"
                          aria-label={t('provider.editProvider')}
                        >
                          <Edit className="h-3 w-3" aria-hidden="true" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProvider(config)}
                          disabled={deleting === config.id}
                          className="text-xs text-red-600 hover:text-red-700"
                          aria-label={t('dialogs.confirmDelete')}
                        >
                          {deleting === config.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash className="h-3 w-3" aria-hidden="true" />
                          )}
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      onClick={() => switchProvider(config)}
                      disabled={switching === config.id || isCurrentProvider(config)}
                      className="text-xs"
                    >
                      {switching === config.id ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                      )}
                      {isCurrentProvider(config) ? t('provider.alreadySelected') : t('provider.switchToConfig')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}

          {/* Toggle tokens visibility */}
          {presets.length > 0 && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTokens(!showTokens)}
                className="text-xs"
              >
                {showTokens ? (
                  <EyeOff className="h-3 w-3 mr-1" aria-hidden="true" />
                ) : (
                  <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
                )}
                {showTokens ? t('provider.hideApiKey') : t('provider.showApiKey')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Current Config Dialog */}
      <Dialog open={showCurrentConfig} onOpenChange={setShowCurrentConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('provider.currentGeminiConfig')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentConfig ? (
              <div className="space-y-3">
                {currentConfig.selectedAuthType && (
                  <div>
                    <p className="font-medium text-sm">{t('provider.authMethod')}</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.selectedAuthType === 'oauth-personal' ? t('provider.googleOAuthOfficial') :
                       currentConfig.selectedAuthType === 'gemini-api-key' ? t('provider.apiKeyThirdParty') :
                       currentConfig.selectedAuthType}
                    </p>
                  </div>
                )}
                {currentConfig.apiKey && (
                  <div>
                    <p className="font-medium text-sm">API Key</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {showTokens ? currentConfig.apiKey : maskToken(currentConfig.apiKey)}
                    </p>
                  </div>
                )}
                {currentConfig.baseUrl && (
                  <div>
                    <p className="font-medium text-sm">Base URL</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.baseUrl}
                    </p>
                  </div>
                )}
                {currentConfig.model && (
                  <div>
                    <p className="font-medium text-sm">Model</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.model}
                    </p>
                  </div>
                )}

                {/* .env content */}
                <div>
                  <p className="font-medium text-sm">~/.gemini/.env</p>
                  <pre className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded overflow-auto max-h-32">
                    {Object.keys(currentConfig.env).length > 0
                      ? Object.entries(currentConfig.env).map(([k, v]) => `${k}=${showTokens ? v : maskToken(v)}`).join('\n')
                      : t('provider.empty')}
                  </pre>
                </div>

                {/* settings.json */}
                {currentConfig.settings && Object.keys(currentConfig.settings).length > 0 && (
                  <div>
                    <p className="font-medium text-sm">~/.gemini/settings.json {t('provider.settingsSummary')}</p>
                    <pre className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(currentConfig.settings.security || {}, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Show/hide tokens toggle in dialog */}
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTokens(!showTokens)}
                    className="text-xs"
                  >
                    {showTokens ? (
                      <EyeOff className="h-3 w-3 mr-1" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
                    )}
                    {showTokens ? t('provider.hideApiKey') : t('provider.showApiKey')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('provider.noGeminiConfig')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('provider.selectProviderOrOAuth')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Provider Form Dialog */}
      <Dialog open={showForm} onOpenChange={handleFormCancel}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProvider ? t('provider.editGeminiProvider') : t('provider.addGeminiProvider')}</DialogTitle>
          </DialogHeader>
          <GeminiProviderForm
            initialData={editingProvider || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('provider.confirmDeleteGeminiProvider')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>{t('provider.confirmDeleteGeminiMessage', { name: providerToDelete?.name })}</p>
            {providerToDelete && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm"><span className="font-medium">{t('provider.name')}</span>{providerToDelete.name}</p>
                {providerToDelete.description && (
                  <p className="text-sm"><span className="font-medium">{t('provider.description')}</span>{providerToDelete.description}</p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('provider.deleteCannotUndo')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={cancelDeleteProvider}
              disabled={deleting === providerToDelete?.id}
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProvider}
              disabled={deleting === providerToDelete?.id}
            >
              {deleting === providerToDelete?.id ? t('provider.deleting') : t('buttons.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
