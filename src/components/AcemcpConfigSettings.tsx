import { useState, useEffect } from "react";
import { Database, Save, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useTranslation } from "@/hooks/useTranslation";

interface AcemcpConfigSettingsProps {
  className?: string;
}

interface AcemcpConfig {
  baseUrl: string;
  token: string;
  batchSize?: number;
  maxLinesPerBlob?: number;
}

export function AcemcpConfigSettings({ className }: AcemcpConfigSettingsProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AcemcpConfig>({
    baseUrl: '',
    token: '',
    batchSize: 10,
    maxLinesPerBlob: 800,
  });

  const [showToken, setShowToken] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const loaded = await api.loadAcemcpConfig();
      setConfig(loaded);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load acemcp config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.saveAcemcpConfig(
        config.baseUrl,
        config.token,
        config.batchSize,
        config.maxLinesPerBlob
      );
      setHasChanges(false);
      setTestStatus('idle');
    } catch (error) {
      console.error('Failed to save acemcp config:', error);
      alert(t('errors.saveFailed') + ': ' + (error instanceof Error ? error.message : t('errors.generic')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      baseUrl: '',
      token: '',
      batchSize: 10,
      maxLinesPerBlob: 800,
    });
    setHasChanges(true);
  };

  const handleTest = async () => {
    if (!config.baseUrl || !config.token) {
      setTestStatus('error');
      setTestMessage(t('acemcp.configureBaseUrl'));
      return;
    }

    setTestStatus('testing');
    setTestMessage(t('messages.testing'));

    try {
      const available = await api.testAcemcpAvailability();
      if (available) {
        setTestStatus('success');
        setTestMessage(t('acemcp.acemcpAvailable'));
      } else {
        setTestStatus('error');
        setTestMessage(t('acemcp.acemcpUnavailable'));
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : t('errors.testFailed'));
    }
  };

  const handleChange = (field: keyof AcemcpConfig, value: any) => {
    setConfig({ ...config, [field]: value });
    setHasChanges(true);
    setTestStatus('idle');
  };

  const handleExportSidecar = async () => {
    try {
      const exportPath = await api.exportAcemcpSidecar('~/.acemcp');
      alert(t('acemcp.exportSuccess').replace('{path}', exportPath));
    } catch (error) {
      alert(t('errors.generic') + ': ' + (error instanceof Error ? error.message : t('errors.generic')));
    }
  };

  const handleCopyCliConfig = async () => {
    const extractedPath = await api.getExtractedSidecarPath();

    let sidecarPath = extractedPath;
    if (!sidecarPath) {
      sidecarPath = '~/.acemcp/acemcp-mcp-server.cjs';
    }

    const cliConfig = `{
  "mcpServers": {
    "acemcp": {
      "command": "node",
      "args": ["${sidecarPath.replace(/\\/g, '\\\\')}"]
    }
  }
}`;

    try {
      await copyTextToClipboard(cliConfig);
      alert(t('acemcp.configCopied'));
    } catch (error) {
      alert(t('errors.generic') + ':\n\n' + cliConfig);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('acemcp.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('acemcp.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              {t('acemcp.unsaved')}
            </Badge>
          )}
          <Button onClick={handleReset} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('acemcp.reset')}
          </Button>
          <Button onClick={handleSave} size="sm" disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('common.saving') : t('acemcp.saveConfig')}
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">{t('acemcp.loadingConfig')}</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* API Base URL */}
            <div>
              <Label htmlFor="acemcp-base-url">{t('acemcp.apiEndpoint')} *</Label>
              <Input
                id="acemcp-base-url"
                value={config.baseUrl}
                onChange={(e) => handleChange('baseUrl', e.target.value)}
                placeholder="https://api.example.com"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('acemcp.apiEndpointDescription')}
              </p>
            </div>

            {/* API Token */}
            <div>
              <Label htmlFor="acemcp-token">{t('acemcp.apiToken')} *</Label>
              <div className="relative">
                <Input
                  id="acemcp-token"
                  type={showToken ? "text" : "password"}
                  value={config.token}
                  onChange={(e) => handleChange('token', e.target.value)}
                  placeholder="your-api-token-here"
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Advanced Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acemcp-batch-size">{t('acemcp.batchSize')}</Label>
                <Input
                  id="acemcp-batch-size"
                  type="number"
                  min="1"
                  max="50"
                  value={config.batchSize || 10}
                  onChange={(e) => handleChange('batchSize', parseInt(e.target.value) || 10)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acemcp.batchSizeDefault')}
                </p>
              </div>

              <div>
                <Label htmlFor="acemcp-max-lines">{t('acemcp.maxFileLines')}</Label>
                <Input
                  id="acemcp-max-lines"
                  type="number"
                  min="100"
                  max="5000"
                  value={config.maxLinesPerBlob || 800}
                  onChange={(e) => handleChange('maxLinesPerBlob', parseInt(e.target.value) || 800)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acemcp.maxFileLinesDefault')}
                </p>
              </div>
            </div>

            {/* Test Connection */}
            <div className="pt-2">
              <Button
                onClick={handleTest}
                variant="outline"
                size="sm"
                disabled={testStatus === 'testing' || !config.baseUrl || !config.token}
              >
                {testStatus === 'testing' ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t('messages.testing')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('acemcp.testConnection')}
                  </>
                )}
              </Button>

              {testStatus === 'success' && (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {testMessage}
                </Badge>
              )}

              {testStatus === 'error' && (
                <Badge variant="outline" className="ml-2 text-red-600 border-red-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {testMessage}
                </Badge>
              )}
            </div>

            {/* CLI Configuration */}
            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                    {t('acemcp.cliUsage')}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t('acemcp.cliDescription')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportSidecar}
                    size="sm"
                    variant="outline"
                    className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-500 dark:hover:bg-amber-400 border-amber-300 dark:border-amber-400 text-amber-950 dark:text-gray-900"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {t('acemcp.exportButton')}
                  </Button>
                  <Button
                    onClick={handleCopyCliConfig}
                    size="sm"
                    variant="outline"
                    className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-500 dark:hover:bg-amber-400 border-amber-300 dark:border-amber-400 text-amber-950 dark:text-gray-900"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {t('acemcp.copyConfig')}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Info */}
            <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('acemcp.configSaved')}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {t('acemcp.projectContextHint')}
              </p>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
