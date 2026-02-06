/**
 * 依赖检测状态视图组件
 */

import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { cn } from '../../../lib/utils';
import type { DependencyStatus } from '../../../hooks/useDependencyStateMachine';

interface CheckingViewProps {
    message?: string;
}

export function CheckingView({ message = '正在检测环境...' }: CheckingViewProps) {
    return (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>{message}</span>
        </div>
    );
}

interface InstallingViewProps {
    logs: string[];
}

export function InstallingView({ logs }: InstallingViewProps) {
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>正在安装 CLI，请稍候...</span>
            </div>
            {lastLog && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    当前步骤：{lastLog}
                </p>
            )}
            {logs.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg bg-gray-900 p-2">
                    {logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono text-gray-300">
                            {log}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ErrorViewProps {
    error: string;
    logs?: string[];
    canRetry: boolean;
    onRetry: () => void;
    onManualRetry?: () => void;
    onSkip?: () => void;
    retryLabel?: string;
    retryCount?: number;
    maxRetries?: number;
}

export function ErrorView({
    error,
    logs = [],
    canRetry,
    onRetry,
    onManualRetry,
    onSkip,
    retryLabel = '重试',
    retryCount = 0,
    maxRetries,
}: ErrorViewProps) {
    const showRetryMeta = typeof maxRetries === 'number' && maxRetries > 0;

    return (
        <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onRetry}
                    disabled={!canRetry}
                    className={cn(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        canRetry
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    )}
                >
                    {retryLabel}
                </button>
                {onManualRetry && !canRetry && (
                    <button
                        onClick={onManualRetry}
                        className="px-3 py-1.5 text-sm rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                    >
                        手动重试
                    </button>
                )}
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="px-3 py-1.5 text-sm rounded-lg text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                    >
                        跳过
                    </button>
                )}
            </div>

            {showRetryMeta && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    已自动重试 {retryCount} / {maxRetries}
                </p>
            )}

            {logs.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg bg-gray-900 p-2">
                    {logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono text-gray-300">
                            {log}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface DependencyItemProps {
    name: string;
    installed: boolean;
    version?: string;
    meetsRequirement?: boolean;
    requirementText?: string;
}

function DependencyItem({
    name,
    installed,
    version,
    meetsRequirement,
    requirementText,
}: DependencyItemProps) {
    const isOk = installed && (meetsRequirement === undefined || meetsRequirement);

    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
                {isOk ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {name}
                </span>
            </div>
            <div className="flex items-center gap-2">
                {version && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {version}
                    </span>
                )}
                {!installed && (
                    <span className="text-xs text-red-500">未安装</span>
                )}
                {installed && meetsRequirement === false && (
                    <span className="text-xs text-yellow-500">
                        {requirementText || '版本不满足'}
                    </span>
                )}
            </div>
        </div>
    );
}

interface DoneViewProps {
    dependencies: DependencyStatus;
    requiresCli: boolean;
    cliName: string;
    onDownloadNode: () => void;
    showSuccess?: boolean;
}

export function DoneView({
    dependencies,
    requiresCli,
    cliName,
    onDownloadNode,
    showSuccess = false,
}: DoneViewProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <DependencyItem
                    name="Node.js"
                    installed={dependencies.nodejs.installed}
                    version={dependencies.nodejs.version}
                    meetsRequirement={dependencies.nodejs.meetsRequirement}
                    requirementText="需要 18+"
                />
                <DependencyItem
                    name="npm"
                    installed={dependencies.npm.installed}
                    version={dependencies.npm.version}
                />
                {requiresCli && (
                    <DependencyItem
                        name={cliName}
                        installed={dependencies.cli.installed}
                        version={dependencies.cli.version}
                    />
                )}
            </div>

            {!dependencies.nodejs.installed && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                未检测到 Node.js，请先安装 Node.js 18 或更高版本。
                            </p>
                            <button
                                onClick={onDownloadNode}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                            >
                                <ExternalLink className="w-3 h-3" />
                                下载 Node.js
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {dependencies.nodejs.installed && !dependencies.nodejs.meetsRequirement && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Node.js 版本过低（当前 {dependencies.nodejs.version}），需要 18 或更高版本。
                            </p>
                            <button
                                onClick={onDownloadNode}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                            >
                                <ExternalLink className="w-3 h-3" />
                                升级 Node.js
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
                        <p className="text-sm text-green-700 dark:text-green-300">
                            环境检测通过，可以继续配置
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
