/**
 * DependencyChecker 集成测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DependencyChecker } from './DependencyChecker';
import { checkBinary, executeCommand } from '@/core/tauri/SuperAgentBridge';
import { installCli } from '@/lib/cliInstaller';
import type { EngineType } from '@/types/provider';

vi.mock('@/core/tauri/SuperAgentBridge', () => ({
    executeCommand: vi.fn(),
    checkBinary: vi.fn(),
}));

vi.mock('@/lib/cliInstaller', () => ({
    installCli: vi.fn(),
    getCliConfig: (engine: EngineType) => ({
        name: `${engine} CLI`,
        command: engine,
        versionArg: '--version',
    }),
}));

const successResult = (stdout: string) => ({
    success: true,
    stdout,
    stderr: '',
    duration_ms: 5,
});

const failureResult = (stderr: string) => ({
    success: false,
    stdout: '',
    stderr,
    duration_ms: 5,
});

describe('DependencyChecker Integration', () => {
    const executeCommandMock = vi.mocked(executeCommand);
    const checkBinaryMock = vi.mocked(checkBinary);
    const installCliMock = vi.mocked(installCli);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should complete check when all dependencies are installed', async () => {
        checkBinaryMock.mockImplementation(async (tool) => {
            if (tool === 'node') {
                return { installed: true, version: 'v18.0.0' };
            }
            if (tool === 'npm') {
                return { installed: true, version: '9.0.0' };
            }
            if (tool === 'claude') {
                return { installed: true, version: '1.0.0' };
            }
            return { installed: false };
        });

        executeCommandMock.mockResolvedValue(successResult('noop'));

        const onCheckComplete = vi.fn();

        render(<DependencyChecker engine="claude" onCheckComplete={onCheckComplete} />);

        await waitFor(() => {
            expect(onCheckComplete).toHaveBeenCalled();
        });

        expect(
            screen.getByText('环境检测通过，可以继续配置')
        ).toBeTruthy();
    });

    it('should auto install CLI when missing', async () => {
        checkBinaryMock.mockImplementation(async (tool) => {
            if (tool === 'node') {
                return { installed: true, version: 'v18.0.0' };
            }
            if (tool === 'npm') {
                return { installed: true, version: '9.0.0' };
            }
            return { installed: false };
        });

        executeCommandMock
            .mockResolvedValueOnce(failureResult('not found'))
            .mockResolvedValueOnce(successResult('1.0.1'));

        installCliMock.mockResolvedValue({
            success: true,
            engine: 'claude',
            scope: 'global',
            logs: ['install ok'],
            version: '1.0.1',
        });

        const onCheckComplete = vi.fn();

        render(<DependencyChecker engine="claude" onCheckComplete={onCheckComplete} />);

        await waitFor(() => {
            expect(installCliMock).toHaveBeenCalled();
        });

        await waitFor(() => {
            const lastCall = onCheckComplete.mock.calls.at(-1)?.[0];
            expect(lastCall?.cli.installed).toBe(true);
        });

        expect(
            screen.getByText('环境检测通过，可以继续配置')
        ).toBeTruthy();
    });

    it('should show error and manual retry after retries exhausted', async () => {
        checkBinaryMock.mockImplementation(async (tool) => {
            if (tool === 'node') {
                return { installed: true, version: 'v18.0.0' };
            }
            if (tool === 'npm') {
                return { installed: true, version: '9.0.0' };
            }
            return { installed: false };
        });

        executeCommandMock.mockResolvedValueOnce(failureResult('not found'));

        installCliMock.mockResolvedValue({
            success: false,
            engine: 'claude',
            logs: ['install failed'],
            error: '安装失败',
        });

        const onCheckComplete = vi.fn();

        render(<DependencyChecker engine="claude" onCheckComplete={onCheckComplete} />);

        await waitFor(() => {
            expect(installCliMock).toHaveBeenCalledTimes(3);
        });

        expect(screen.getByText('安装失败')).toBeTruthy();
        expect(screen.getByText('手动重试')).toBeTruthy();
        expect(screen.getByText('跳过')).toBeTruthy();
    });
});
