import { executeCommand } from '@/core/tauri/SuperAgentBridge';
import { logger } from '@/lib/logger';
import type { EngineType } from '@/types/provider';

export type CliInstallScope = 'global' | 'local';

export type CliInstallStage =
    | 'start'
    | 'global_install'
    | 'local_install'
    | 'verify'
    | 'complete'
    | 'error';

export interface CliInstallProgress {
    stage: CliInstallStage;
    message: string;
    detail?: string;
}

export type CliInstallProgressCallback = (progress: CliInstallProgress) => void;

export interface CliInstallResult {
    success: boolean;
    engine: EngineType;
    scope?: CliInstallScope;
    version?: string;
    logs: string[];
    error?: string;
    detail?: string;
    globalError?: string;
    localError?: string;
    verificationWarning?: string;
    manualGlobalInstallSuggested?: boolean;
}

export interface CliInstallOptions {
    onProgress?: CliInstallProgressCallback;
    cwd?: string;
    timeoutMs?: number;
    verifyTimeoutMs?: number;
}

interface CliConfig {
    name: string;
    packageName: string;
    command: string;
    versionArg: string;
}

export const CLI_CONFIG: Record<EngineType, CliConfig> = {
    claude: {
        name: 'Claude Code',
        packageName: '@anthropic-ai/claude-code',
        command: 'claude',
        versionArg: '--version',
    },
    codex: {
        name: 'Codex CLI',
        packageName: '@openai/codex',
        command: 'codex',
        versionArg: '--version',
    },
    gemini: {
        name: 'Gemini CLI',
        packageName: '@google/gemini-cli',
        command: 'gemini',
        versionArg: '--version',
    },
};

export const getCliConfig = (engine: EngineType) => CLI_CONFIG[engine];

const DEFAULT_INSTALL_TIMEOUT = 5 * 60 * 1000;
const DEFAULT_VERIFY_TIMEOUT = 15 * 1000;

const buildInstallCommand = (packageName: string, scope: CliInstallScope) => {
    return scope === 'global'
        ? `npm install -g ${packageName}`
        : `npm install ${packageName}`;
};

const buildVerifyCommands = (config: CliConfig, scope: CliInstallScope) => {
    if (scope === 'local') {
        return [
            `${config.command} ${config.versionArg}`,
            `npx ${config.command} ${config.versionArg}`,
        ];
    }

    return [`${config.command} ${config.versionArg}`];
};

const resolveCommandError = (stdout: string, stderr: string) => {
    const trimmedStdErr = stderr.trim();
    if (trimmedStdErr) return trimmedStdErr;
    return stdout.trim() || '未知错误';
};

export async function installCli(
    engine: EngineType,
    options: CliInstallOptions = {}
): Promise<CliInstallResult> {
    const config = CLI_CONFIG[engine];
    const logs: string[] = [];
    const timeoutMs = options.timeoutMs ?? DEFAULT_INSTALL_TIMEOUT;
    const verifyTimeoutMs = options.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT;

    const report = (stage: CliInstallStage, message: string, detail?: string) => {
        logs.push(message);
        options.onProgress?.({ stage, message, detail });
    };

    report('start', `开始安装 ${config.name}`);

    let globalError: string | undefined;
    let localError: string | undefined;

    // 1) 尝试全局安装
    report('global_install', `尝试全局安装: ${config.packageName}`);
    try {
        const globalResult = await executeCommand(buildInstallCommand(config.packageName, 'global'), {
            timeoutMs,
        });

        if (!globalResult.success) {
            globalError = resolveCommandError(globalResult.stdout, globalResult.stderr);
            report('global_install', `全局安装失败: ${globalError}`);
        } else {
            if (globalResult.stdout.trim()) {
                report('global_install', globalResult.stdout.trim());
            }

            const verification = await verifyCli(config, 'global', verifyTimeoutMs, undefined, report);
            if (verification.success) {
                report('complete', `${config.name} 安装成功（全局）`);
                return {
                    success: true,
                    engine,
                    scope: 'global',
                    version: verification.version,
                    logs,
                    verificationWarning: verification.warning,
                };
            }

            report('complete', `${config.name} 安装完成，但无法验证版本`);
            return {
                success: true,
                engine,
                scope: 'global',
                logs,
                verificationWarning: verification.warning ?? '无法验证版本',
            };
        }
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        globalError = detail;
        report('global_install', `全局安装异常: ${detail}`);
        logger.error('cliInstaller', 'Global install failed', error);
    }

    // 2) 降级为本地安装
    report('local_install', `尝试本地安装: ${config.packageName}`);
    try {
        const localResult = await executeCommand(buildInstallCommand(config.packageName, 'local'), {
            timeoutMs,
            cwd: options.cwd,
        });

        if (!localResult.success) {
            localError = resolveCommandError(localResult.stdout, localResult.stderr);
            report('local_install', `本地安装失败: ${localError}`);
        } else {
            if (localResult.stdout.trim()) {
                report('local_install', localResult.stdout.trim());
            }

            const verification = await verifyCli(
                config,
                'local',
                verifyTimeoutMs,
                options.cwd,
                report
            );

            report(
                'complete',
                `${config.name} 安装成功（本地）。建议稍后使用管理员权限全局安装。`
            );

            return {
                success: true,
                engine,
                scope: 'local',
                version: verification.version,
                logs,
                globalError,
                verificationWarning: verification.warning,
                manualGlobalInstallSuggested: true,
            };
        }
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        localError = detail;
        report('local_install', `本地安装异常: ${detail}`);
        logger.error('cliInstaller', 'Local install failed', error);
    }

    const errorMessage = `安装 ${config.name} 失败，请检查网络或 npm 权限，或稍后手动执行全局安装。`;
    const detailMessage = `global: ${globalError ?? 'n/a'}; local: ${localError ?? 'n/a'}`;
    report('error', errorMessage, detailMessage);

    return {
        success: false,
        engine,
        logs,
        error: errorMessage,
        detail: detailMessage,
        globalError,
        localError,
        manualGlobalInstallSuggested: Boolean(globalError),
    };
}

async function verifyCli(
    config: CliConfig,
    scope: CliInstallScope,
    timeoutMs: number,
    cwd: string | undefined,
    report: (stage: CliInstallStage, message: string, detail?: string) => void
): Promise<{ success: boolean; version?: string; warning?: string }> {
    report('verify', `验证 ${config.name} 安装...`);

    const commands = buildVerifyCommands(config, scope);

    for (const command of commands) {
        try {
            const result = await executeCommand(command, { timeoutMs, cwd });
            if (result.success) {
                const version = result.stdout.trim();
                report('verify', `检测到版本: ${version || '未知'}`);
                return { success: true, version };
            }
        } catch (error) {
            logger.warn('cliInstaller', `Verify failed for command: ${command}`, error);
        }
    }

    return {
        success: false,
        warning: '安装可能成功，但无法验证版本',
    };
}
