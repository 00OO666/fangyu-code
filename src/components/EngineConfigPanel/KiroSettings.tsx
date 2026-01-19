/**
 * Kiro 引擎配置组件
 * 
 * 配置 Kiro (Amazon Q Developer) API 设置
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Cloud, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  User,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { KIRO_MODELS, DEFAULT_KIRO_TOKEN_PATH } from '../../services/kiro/types';
import type { KiroTokenStatus } from '../../services/kiro/types';

interface KiroSettingsProps {
  tokenPath: string;
  modelId: string;
  onTokenPathChange: (path: string) => void;
  onModelChange: (modelId: string) => void;
  onValidate?: (valid: boolean) => void;
}

interface TokenStatusDisplay {
  status: 'loading' | 'valid' | 'expired' | 'not-found' | 'error';
  message: string;
  details?: KiroTokenStatus;
}

export function KiroSettings({
  tokenPath,
  modelId,
  onTokenPathChange,
  onModelChange,
  onValidate,
}: KiroSettingsProps) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatusDisplay>({
    status: 'loading',
    message: '检查 Token 状态...',
  });
  const [isValidating, setIsValidating] = useState(false);

  // 检查 Token 状态
  const checkTokenStatus = useCallback(async () => {
    setIsValidating(true);
    setTokenStatus({ status: 'loading', message: '检查 Token 状态...' });

    try {
      const path = tokenPath || DEFAULT_KIRO_TOKEN_PATH;
      const status = await invoke<{
        valid: boolean;
        expires_in: number;
        region: string;
        account_type: string;
        masked_token: string;
      }>('get_kiro_token_status', { path });

      const tokenStatusData: KiroTokenStatus = {
        isValid: status.valid,
        expiresIn: status.expires_in,
        region: status.region,
        accountType: status.account_type as 'builders-id' | 'iam-identity-center',
      };

      if (status.valid) {
        const hours = Math.floor(status.expires_in / 3600);
        const minutes = Math.floor((status.expires_in % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
        
        setTokenStatus({
          status: 'valid',
          message: `Token 有效，${timeStr}后过期`,
          details: tokenStatusData,
        });
        onValidate?.(true);
      } else {
        setTokenStatus({
          status: 'expired',
          message: 'Token 已过期，请重新登录 Kiro IDE',
          details: tokenStatusData,
        });
        onValidate?.(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('不存在') || message.includes('not found')) {
        setTokenStatus({
          status: 'not-found',
          message: 'Token 文件不存在，请先登录 Kiro IDE',
        });
      } else {
        setTokenStatus({
          status: 'error',
          message: `检查失败: ${message}`,
        });
      }
      onValidate?.(false);
    } finally {
      setIsValidating(false);
    }
  }, [tokenPath, onValidate]);

  // 初始检查
  useEffect(() => {
    checkTokenStatus();
  }, [checkTokenStatus]);

  // 获取状态图标和颜色
  const getStatusDisplay = () => {
    switch (tokenStatus.status) {
      case 'loading':
        return { icon: RefreshCw, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30' };
      case 'valid':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950/30' };
      case 'expired':
        return { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30' };
      case 'not-found':
        return { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  // 获取当前模型是否可用
  const isModelAvailable = (mid: string) => {
    if (!mid) return true; // Auto 模式总是可用
    if (!tokenStatus.details) return true;
    
    const model = KIRO_MODELS.find(m => m.id === mid);
    if (!model) return true;
    
    return model.supportedBy.includes(tokenStatus.details.accountType);
  };

  return (
    <div className="space-y-4">
      {/* Token 状态卡片 */}
      <div className={cn('rounded-lg p-4 border', statusDisplay.bgColor)}>
        <div className="flex items-start gap-3">
          <StatusIcon className={cn('w-5 h-5 mt-0.5', statusDisplay.color, isValidating && 'animate-spin')} />
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium', statusDisplay.color)}>
              {tokenStatus.message}
            </p>
            
            {tokenStatus.details && (
              <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  <span>Region: {tokenStatus.details.region}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    账户类型: {tokenStatus.details.accountType === 'builders-id' ? 'Builders ID (免费)' : 'IAM Identity Center (Pro)'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={checkTokenStatus}
            disabled={isValidating}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="刷新状态"
          >
            <RefreshCw className={cn('w-4 h-4', isValidating && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Token 路径配置 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Token 文件路径
        </label>
        <input
          type="text"
          value={tokenPath}
          onChange={(e) => onTokenPathChange(e.target.value)}
          placeholder={DEFAULT_KIRO_TOKEN_PATH}
          className={cn(
            'w-full px-3 py-2 rounded-lg border',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'text-sm'
          )}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          留空使用默认路径。Token 由 Kiro IDE 自动管理。
        </p>
      </div>

      {/* 模型选择 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          默认模型
        </label>
        <select
          value={modelId}
          onChange={(e) => onModelChange(e.target.value)}
          className={cn(
            'w-full px-3 py-2 rounded-lg border',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'text-sm'
          )}
        >
          <option value="">Auto (自动选择)</option>
          {KIRO_MODELS.map((model) => {
            const available = isModelAvailable(model.id);
            return (
              <option 
                key={model.id} 
                value={model.id}
                disabled={!available}
              >
                {model.name} - {model.description}
                {!available && ' (不支持)'}
              </option>
            );
          })}
        </select>
        
        {/* Opus 4.5 提示 */}
        {tokenStatus.details?.accountType === 'iam-identity-center' && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>IAM Identity Center 账户暂不支持 Claude Opus 4.5</span>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
        <h4 className="font-medium mb-2">使用说明</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>Kiro 使用 AWS Builder ID 认证，无需 API Key</li>
          <li>首次使用请先打开 Kiro IDE 并登录</li>
          <li>Token 有效期约 8 小时，过期后需重新登录 Kiro IDE</li>
          <li>Builders ID (免费) 支持所有模型包括 Opus 4.5</li>
        </ul>
      </div>
    </div>
  );
}

export default KiroSettings;
