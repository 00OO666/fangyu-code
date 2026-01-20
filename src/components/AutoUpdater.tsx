/**
 * 自动更新组件
 *
 * 功能：
 * 1. 检测开发目录的新构建
 * 2. 显示版本信息对比
 * 3. 一键重启到新版本
 */

import { logger } from '@/lib/logger';
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface VersionInfo {
  current_version: string;
  current_build_time: string | null;
  latest_version: string;
  latest_build_time: string | null;
  update_available: boolean;
  dev_build_path: string | null;
}

interface AutoUpdaterProps {
  onUpdateComplete?: () => void;
  className?: string;
}

export const AutoUpdater: React.FC<AutoUpdaterProps> = ({
  onUpdateComplete,
  className = ''
}) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // 检查更新
  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const info = await invoke<VersionInfo>('check_for_updates');
      setVersionInfo(info);

      if (info.update_available) {
        setUpdateMessage('发现新版本！点击下方按钮更新。');
      } else {
        setUpdateMessage('当前已是最新版本');
      }
    } catch (err) {
      setError(`检查更新失败: ${err}`);
    } finally {
      setIsChecking(false);
    }
  };

  // 应用更新（重启到新版本）
  const applyUpdate = async () => {
    if (!versionInfo?.update_available) return;

    setIsUpdating(true);
    setError(null);
    setUpdateMessage('正在重启到新版本...');

    try {
      await invoke('restart_to_new_version');
      // 如果成功，应用会自动退出
      onUpdateComplete?.();
    } catch (err) {
      setError(`更新失败: ${err}`);
      setIsUpdating(false);
      setUpdateMessage(null);
    }
  };

  // 启动时自动检查
  useEffect(() => {
    checkForUpdates();

    // 每5分钟自动检查一次
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`auto-updater ${className}`}>
      {/* 版本信息显示 */}
      <div className="version-info">
        <div className="current-version">
          <span className="label">当前版本:</span>
          <span className="value">
            v{versionInfo?.current_version || '...'}
            {versionInfo?.current_build_time && (
              <span className="build-time">({versionInfo.current_build_time})</span>
            )}
          </span>
        </div>

        {versionInfo?.update_available && (
          <div className="latest-version">
            <span className="label">最新版本:</span>
            <span className="value highlight">
              v{versionInfo.latest_version}
              {versionInfo.latest_build_time && (
                <span className="build-time">({versionInfo.latest_build_time})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 状态消息 */}
      {(updateMessage || error) && (
        <div className={`status-message ${error ? 'error' : 'info'}`}>
          {error ? (
            <><AlertCircle size={16} /> {error}</>
          ) : versionInfo?.update_available ? (
            <><Download size={16} /> {updateMessage}</>
          ) : (
            <><CheckCircle size={16} /> {updateMessage}</>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="actions">
        <button
          onClick={checkForUpdates}
          disabled={isChecking || isUpdating}
          className="btn-check"
        >
          {isChecking ? (
            <><Loader2 size={16} className="spin" /> 检查中...</>
          ) : (
            <><RefreshCw size={16} /> 检查更新</>
          )}
        </button>

        {versionInfo?.update_available && (
          <button
            onClick={applyUpdate}
            disabled={isUpdating}
            className="btn-update"
          >
            {isUpdating ? (
              <><Loader2 size={16} className="spin" /> 更新中...</>
            ) : (
              <><Download size={16} /> 立即更新</>
            )}
          </button>
        )}
      </div>

      <style>{`
        .auto-updater {
          padding: 16px;
          background: var(--bg-secondary, #1e1e1e);
          border-radius: 8px;
          border: 1px solid var(--border-color, #333);
        }

        .version-info {
          margin-bottom: 12px;
        }

        .version-info > div {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .label {
          color: var(--text-secondary, #888);
          font-size: 13px;
        }

        .value {
          color: var(--text-primary, #fff);
          font-weight: 500;
        }

        .value.highlight {
          color: #4ade80;
        }

        .build-time {
          font-size: 11px;
          color: var(--text-tertiary, #666);
          margin-left: 4px;
        }

        .status-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .status-message.info {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
        }

        .status-message.error {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .actions button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-check {
          background: var(--bg-tertiary, #2a2a2a);
          color: var(--text-primary, #fff);
        }

        .btn-check:hover:not(:disabled) {
          background: var(--bg-hover, #333);
        }

        .btn-update {
          background: #22c55e;
          color: #fff;
        }

        .btn-update:hover:not(:disabled) {
          background: #16a34a;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// 紧凑版本更新指示器（用于状态栏）
export const UpdateIndicator: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const info = await invoke<VersionInfo>('check_for_updates');
        setHasUpdate(info.update_available);
        if (info.update_available) {
          setLatestVersion(info.latest_version);
        }
      } catch (err) {
        logger.error('AutoUpdater', '检查更新失败:', err);
      }
    };

    checkUpdate();
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!hasUpdate) return null;

  return (
    <button
      onClick={onClick}
      className="update-indicator"
      title={`新版本 v${latestVersion} 可用`}
    >
      <Download size={14} />
      <span>更新</span>

      <style>{`
        .update-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .update-indicator:hover {
          background: rgba(34, 197, 94, 0.3);
        }
      `}</style>
    </button>
  );
};

export default AutoUpdater;
