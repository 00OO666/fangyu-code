/**
 * APIConfigPanel - API 配置面板
 * 
 * 支持配置 HiAPI 和其他 AI 提供商
 * 
 * Requirements: 2.4, 2.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  APIConfigManager,
  APIProvider,
  ProviderConfig,
  ValidationResult,
  createAPIConfigManager,
  getProviderDisplayName,
  getSupportedProviders,
} from '../../core/api/APIConfigManager';

// =============================================================================
// 类型定义
// =============================================================================

interface APIConfigPanelProps {
  onConfigChange?: (manager: APIConfigManager) => void;
  className?: string;
}

interface ProviderCardProps {
  config: ProviderConfig;
  isActive: boolean;
  validationResult?: ValidationResult;
  onUpdate: (config: Partial<ProviderConfig>) => void;
  onValidate: () => void;
  onSetActive: () => void;
  isValidating: boolean;
}

// =============================================================================
// 子组件
// =============================================================================

const ProviderCard: React.FC<ProviderCardProps> = ({
  config,
  isActive,
  validationResult,
  onUpdate,
  onValidate,
  onSetActive,
  isValidating,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(config.apiKey);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const handleApiKeyBlur = () => {
    if (apiKey !== config.apiKey) {
      onUpdate({ apiKey });
    }
  };

  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ enabled: e.target.checked });
  };

  return (
    <div
      className={`
        border rounded-lg p-4 mb-4 transition-all
        ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
        ${config.enabled ? 'opacity-100' : 'opacity-60'}
      `}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleEnabledChange}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {config.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.baseUrl}
            </p>
          </div>
        </div>
        
        {isActive && (
          <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded dark:bg-blue-900 dark:text-blue-300">
            当前使用
          </span>
        )}
      </div>

      {/* API 密钥输入 */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API 密钥
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              onBlur={handleApiKeyBlur}
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded-md text-sm
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
          <button
            onClick={onValidate}
            disabled={!apiKey || isValidating}
            className={`
              px-3 py-2 text-sm font-medium rounded-md transition-colors
              ${isValidating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }
            `}
          >
            {isValidating ? '验证中...' : '验证'}
          </button>
        </div>
      </div>

      {/* 验证结果 */}
      {validationResult && (
        <div
          className={`
            p-2 rounded text-sm mb-3
            ${validationResult.valid
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span>{validationResult.valid ? '✓' : '✗'}</span>
            <span>{validationResult.message}</span>
            {validationResult.latency && (
              <span className="text-xs opacity-70">
                ({validationResult.latency}ms)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {config.enabled && config.apiKey && !isActive && (
        <button
          onClick={onSetActive}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
        >
          设为当前使用
        </button>
      )}

      {/* 支持的模型 */}
      {config.models && config.models.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            支持的模型:
          </p>
          <div className="flex flex-wrap gap-1">
            {config.models.slice(0, 5).map((model) => (
              <span
                key={model}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
              >
                {model}
              </span>
            ))}
            {config.models.length > 5 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{config.models.length - 5} 更多
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 主组件
// =============================================================================

export const APIConfigPanel: React.FC<APIConfigPanelProps> = ({
  onConfigChange,
  className = '',
}) => {
  const [manager] = useState(() => createAPIConfigManager());
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<APIProvider>('hiapi');
  const [validationResults, setValidationResults] = useState<Record<APIProvider, ValidationResult>>({} as Record<APIProvider, ValidationResult>);
  const [validatingProviders, setValidatingProviders] = useState<Set<APIProvider>>(new Set());
  const [defaultModel, setDefaultModel] = useState('gpt-4o');

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      await manager.loadFromStorage();
      refreshConfigs();
    };
    loadConfig();
  }, [manager]);

  const refreshConfigs = useCallback(() => {
    setConfigs(manager.getAllConfigs());
    setActiveProvider(manager.getActiveProvider());
    setDefaultModel(manager.getDefaultModel());
  }, [manager]);

  const handleUpdateProvider = useCallback(async (provider: APIProvider, update: Partial<ProviderConfig>) => {
    manager.configureProvider(provider, update);
    await manager.saveToStorage();
    refreshConfigs();
    onConfigChange?.(manager);
  }, [manager, refreshConfigs, onConfigChange]);

  const handleValidate = useCallback(async (provider: APIProvider) => {
    setValidatingProviders(prev => new Set(prev).add(provider));
    
    try {
      const result = await manager.validateCredentials(provider);
      setValidationResults(prev => ({ ...prev, [provider]: result }));
    } finally {
      setValidatingProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    }
  }, [manager]);

  const handleSetActive = useCallback(async (provider: APIProvider) => {
    try {
      manager.setActiveProvider(provider);
      await manager.saveToStorage();
      refreshConfigs();
      onConfigChange?.(manager);
    } catch (error) {
      console.error('Failed to set active provider:', error);
    }
  }, [manager, refreshConfigs, onConfigChange]);

  const handleDefaultModelChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    manager.setDefaultModel(model);
    await manager.saveToStorage();
    setDefaultModel(model);
    onConfigChange?.(manager);
  }, [manager, onConfigChange]);

  const handleValidateAll = useCallback(async () => {
    const providers = configs.filter(c => c.apiKey).map(c => c.provider);
    
    for (const provider of providers) {
      await handleValidate(provider);
    }
  }, [configs, handleValidate]);

  // 获取所有可用模型
  const allModels = React.useMemo(() => {
    const models = new Set<string>();
    for (const config of configs) {
      if (config.enabled && config.models) {
        for (const model of config.models) {
          models.add(model);
        }
      }
    }
    return Array.from(models);
  }, [configs]);

  return (
    <div className={`api-config-panel ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          API 配置
        </h2>
        <button
          onClick={handleValidateAll}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
        >
          验证全部
        </button>
      </div>

      {/* 默认模型选择 */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          默认模型
        </label>
        <select
          value={defaultModel}
          onChange={handleDefaultModelChange}
          className="w-full px-3 py-2 border rounded-md text-sm
            border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-gray-100"
        >
          {allModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* 提供商列表 */}
      <div className="space-y-2">
        {configs
          .sort((a, b) => a.priority - b.priority)
          .map((config) => (
            <ProviderCard
              key={config.provider}
              config={config}
              isActive={config.provider === activeProvider}
              validationResult={validationResults[config.provider]}
              onUpdate={(update) => handleUpdateProvider(config.provider, update)}
              onValidate={() => handleValidate(config.provider)}
              onSetActive={() => handleSetActive(config.provider)}
              isValidating={validatingProviders.has(config.provider)}
            />
          ))}
      </div>

      {/* 提示信息 */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 推荐使用 HiAPI 中转服务，支持多种模型，价格优惠。
        </p>
      </div>
    </div>
  );
};

export default APIConfigPanel;
