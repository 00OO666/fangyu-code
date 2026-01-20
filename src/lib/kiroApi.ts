/**
 * Kiro CLI API 接口
 * 
 * 调用 Tauri 后端的 Kiro CLI 命令
 */

import { logger } from '@/lib/logger';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// =============================================================================
// 类型定义
// =============================================================================

export interface KiroModel {
    id: string;
    name: string;
    multiplier: number;
    description: string;
}

export interface KiroOutputPayload {
    tab_id: string | null;
    type: 'text' | 'error';
    content: string;
}

export interface KiroCompletePayload {
    tab_id: string | null;
    success: boolean;
    error?: string;
}

export interface KiroCancelledPayload {
    tab_id: string | null;
    cancelled: boolean;
}

// =============================================================================
// API 函数
// =============================================================================

/**
 * 检查 Kiro CLI 是否已安装
 */
export async function checkKiroCliInstalled(): Promise<boolean> {
    try {
        return await invoke<boolean>('check_kiro_cli_installed');
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to check CLI installation:', error);
        return false;
    }
}

/**
 * 检查 Kiro CLI 是否已登录
 */
export async function checkKiroCliLoggedIn(): Promise<boolean> {
    try {
        return await invoke<boolean>('check_kiro_cli_logged_in');
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to check login status:', error);
        return false;
    }
}

/**
 * 获取 Kiro CLI 版本
 */
export async function getKiroCliVersion(): Promise<string> {
    try {
        return await invoke<string>('get_kiro_cli_version');
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to get CLI version:', error);
        throw error;
    }
}

/**
 * 获取 Kiro 支持的模型列表
 */
export async function getKiroModels(): Promise<KiroModel[]> {
    try {
        return await invoke<KiroModel[]>('get_kiro_models');
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to get models:', error);
        return [];
    }
}

/**
 * 执行 Kiro CLI 对话
 */
export async function executeKiroChat(params: {
    prompt: string;
    model?: string;
    projectPath?: string;
    tabId?: string;
}): Promise<void> {
    try {
        await invoke('execute_kiro_chat', {
            prompt: params.prompt,
            model: params.model,
            projectPath: params.projectPath,
            tabId: params.tabId,
        });
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to execute chat:', error);
        throw error;
    }
}

/**
 * 取消 Kiro CLI 执行
 */
export async function cancelKiroExecution(tabId?: string): Promise<void> {
    try {
        await invoke('cancel_kiro_execution', { tabId });
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to cancel execution:', error);
        throw error;
    }
}

/**
 * 打开 Kiro CLI 登录
 */
export async function openKiroLogin(): Promise<string> {
    try {
        return await invoke<string>('open_kiro_login');
    } catch (error) {
        logger.error('kiroApi', '[Kiro] Failed to open login:', error);
        throw error;
    }
}

// =============================================================================
// 事件监听
// =============================================================================

/**
 * 监听 Kiro 输出事件
 */
export async function onKiroOutput(
    callback: (payload: KiroOutputPayload) => void
): Promise<UnlistenFn> {
    return listen<KiroOutputPayload>('kiro-output', (event) => {
        callback(event.payload);
    });
}

/**
 * 监听 Kiro 错误事件
 */
export async function onKiroError(
    callback: (payload: KiroOutputPayload) => void
): Promise<UnlistenFn> {
    return listen<KiroOutputPayload>('kiro-error', (event) => {
        callback(event.payload);
    });
}

/**
 * 监听 Kiro 完成事件
 */
export async function onKiroComplete(
    callback: (payload: KiroCompletePayload) => void
): Promise<UnlistenFn> {
    return listen<KiroCompletePayload>('kiro-complete', (event) => {
        callback(event.payload);
    });
}

/**
 * 监听 Kiro 取消事件
 */
export async function onKiroCancelled(
    callback: (payload: KiroCancelledPayload) => void
): Promise<UnlistenFn> {
    return listen<KiroCancelledPayload>('kiro-cancelled', (event) => {
        callback(event.payload);
    });
}

// =============================================================================
// 状态管理
// =============================================================================

export interface KiroStatus {
    installed: boolean;
    loggedIn: boolean;
    version: string | null;
}

/**
 * 获取 Kiro CLI 完整状态
 */
export async function getKiroStatus(): Promise<KiroStatus> {
    const installed = await checkKiroCliInstalled();

    if (!installed) {
        return {
            installed: false,
            loggedIn: false,
            version: null,
        };
    }

    const [loggedIn, version] = await Promise.all([
        checkKiroCliLoggedIn(),
        getKiroCliVersion().catch(() => null),
    ]);

    return {
        installed,
        loggedIn,
        version,
    };
}
