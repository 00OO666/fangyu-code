/**
 * CLI Installer 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installCli } from './cliInstaller';
import {
    executeCommand,
    type CommandResult,
} from '@/core/tauri/SuperAgentBridge';

vi.mock('@/core/tauri/SuperAgentBridge', () => ({
    executeCommand: vi.fn(),
}));

const successResult = (stdout: string): CommandResult => ({
    success: true,
    stdout,
    stderr: '',
    duration_ms: 5,
});

const failureResult = (stderr: string): CommandResult => ({
    success: false,
    stdout: '',
    stderr,
    duration_ms: 5,
});

describe('installCli', () => {
    const executeCommandMock = vi.mocked(executeCommand);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should install globally and verify successfully', async () => {
        executeCommandMock
            .mockResolvedValueOnce(successResult('installed'))
            .mockResolvedValueOnce(successResult('1.2.3'));

        const progressStages: string[] = [];
        const result = await installCli('claude', {
            onProgress: (progress) => progressStages.push(progress.stage),
        });

        expect(result.success).toBe(true);
        expect(result.scope).toBe('global');
        expect(result.version).toBe('1.2.3');
        expect(executeCommandMock.mock.calls[0]?.[0]).toBe(
            'npm install -g @anthropic-ai/claude-code'
        );
        expect(executeCommandMock.mock.calls[1]?.[0]).toBe('claude --version');
        expect(progressStages).toContain('global_install');
        expect(progressStages).toContain('verify');
    });

    it('should fallback to local install when global fails', async () => {
        executeCommandMock
            .mockResolvedValueOnce(failureResult('EACCES'))
            .mockResolvedValueOnce(successResult('local install ok'))
            .mockResolvedValueOnce(successResult('2.0.0'));

        const result = await installCli('claude');

        expect(result.success).toBe(true);
        expect(result.scope).toBe('local');
        expect(result.manualGlobalInstallSuggested).toBe(true);
        expect(result.globalError).toBe('EACCES');
        expect(result.version).toBe('2.0.0');
        expect(executeCommandMock.mock.calls[1]?.[0]).toBe(
            'npm install @anthropic-ai/claude-code'
        );
    });

    it('should return warning when verification fails', async () => {
        executeCommandMock
            .mockResolvedValueOnce(successResult('installed'))
            .mockResolvedValueOnce(failureResult('not found'));

        const result = await installCli('claude');

        expect(result.success).toBe(true);
        expect(result.verificationWarning).toBeDefined();
    });

    it('should report error when both global and local install fail', async () => {
        executeCommandMock
            .mockResolvedValueOnce(failureResult('EACCES'))
            .mockResolvedValueOnce(failureResult('ENOENT'));

        const result = await installCli('claude');

        expect(result.success).toBe(false);
        expect(result.globalError).toBe('EACCES');
        expect(result.localError).toBe('ENOENT');
        expect(result.error).toBeDefined();
    });
});
