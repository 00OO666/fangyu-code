/**
 * API 健康诊断面板
 *
 * 显示 API 连接状态、错误日志和诊断结果
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Activity, AlertCircle, CheckCircle, XCircle, RefreshCw, Stethoscope, Trash2, ChevronDown, ChevronUp, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiHealthCheck, type ConnectionStatus } from '@/hooks/useApiHealthCheck';

interface ApiHealthPanelProps {
  /** 当前会话 ID */
  sessionId?: string;
  /** 当前引擎 */
  engine?: 'claude' | 'codex' | 'gemini';
  /** 紧凑模式（仅显示状态指示器） */
  compact?: boolean;
}

export const ApiHealthPanel: React.FC<ApiHealthPanelProps> = ({
  sessionId,
  engine = 'claude',
  compact = false,
}) => {
  const {
    status,
    lastSuccessTime,
    consecutiveFailures,
    isReconnecting,
    errorLog,
    diagnosticResult,
    triggerReconnect,
    runDiagnostics,
    clearErrorLog,
  } = useApiHealthCheck({ sessionId, engine });

  const [expanded, setExpanded] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // 状态图标和颜色
  const getStatusInfo = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/50',
          label: '已连接',
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/50',
          label: '已断开',
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/50',
          label: '重连中',
        };
      default:
        return {
          icon: Activity,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/50',
          label: '未知',
        };
    }
  };

  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  // 运行诊断
  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      await runDiagnostics();
      if (!expanded) setExpanded(true);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // 紧凑模式：仅显示状态指示器
  if (compact) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 h-8 cursor-pointer transition-all",
          statusInfo.borderColor,
          statusInfo.bgColor
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon className={cn("h-3.5 w-3.5", statusInfo.color, isReconnecting && "animate-spin")} />
        <span className={cn("font-mono text-xs", statusInfo.color)}>
          {statusInfo.label}
        </span>
        {consecutiveFailures > 0 && (
          <span className="text-xs text-muted-foreground">
            ({consecutiveFailures})
          </span>
        )}
      </Badge>
    );
  }

  // 完整面板
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-5 w-5", statusInfo.color, isReconnecting && "animate-spin")} />
          <h3 className="font-semibold text-sm">API 连接状态</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* 状态 Badge */}
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1",
              statusInfo.borderColor,
              statusInfo.bgColor,
              statusInfo.color
            )}
          >
            {statusInfo.label}
          </Badge>

          {/* 展开/折叠按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {lastSuccessTime && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>最后成功: {formatTimeSince(lastSuccessTime)}</span>
          </div>
        )}
        {consecutiveFailures > 0 && (
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            <span>连续失败: {consecutiveFailures} 次</span>
          </div>
        )}
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden"
          >
            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerReconnect()}
                disabled={isReconnecting || status === 'connected'}
                className="flex-1"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isReconnecting && "animate-spin")} />
                {isReconnecting ? '重连中...' : '重新连接'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="flex-1"
              >
                <Stethoscope className={cn("h-3.5 w-3.5 mr-1.5", isRunningDiagnostics && "animate-pulse")} />
                {isRunningDiagnostics ? '诊断中...' : '运行诊断'}
              </Button>
            </div>

            {/* 诊断结果 */}
            {diagnosticResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">诊断结果</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      diagnosticResult.overallStatus === 'healthy' && "border-green-500/50 bg-green-500/10 text-green-600",
                      diagnosticResult.overallStatus === 'degraded' && "border-orange-500/50 bg-orange-500/10 text-orange-600",
                      diagnosticResult.overallStatus === 'unhealthy' && "border-red-500/50 bg-red-500/10 text-red-600"
                    )}
                  >
                    {diagnosticResult.overallStatus === 'healthy' && '健康'}
                    {diagnosticResult.overallStatus === 'degraded' && '部分异常'}
                    {diagnosticResult.overallStatus === 'unhealthy' && '不健康'}
                  </Badge>
                </div>

                {/* 检查项 */}
                <div className="space-y-1">
                  {diagnosticResult.checks.map((check, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-xs p-2 rounded bg-muted/30"
                    >
                      {check.status === 'ok' && <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />}
                      {check.status === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-orange-600 mt-0.5 flex-shrink-0" />}
                      {check.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{check.name}</div>
                        <div className="text-muted-foreground">{check.message}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 建议 */}
                {diagnosticResult.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold">建议</h5>
                    <ul className="text-xs space-y-1">
                      {diagnosticResult.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-1.5">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span className="text-muted-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 错误日志 */}
            {errorLog.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">错误日志 ({errorLog.length})</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearErrorLog}
                    className="h-6 px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {errorLog.map((entry, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 rounded bg-red-500/5 border border-red-500/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-red-600">{entry.type}</div>
                            <div className="text-muted-foreground break-words">{entry.message}</div>
                          </div>
                        </div>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatTimeSince(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// 格式化时间差
function formatTimeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  return `${Math.floor(seconds / 86400)}天前`;
}
