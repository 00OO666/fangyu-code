/**
 * 引擎配置状态服务
 * 管理引擎一键配置的进度和状态
 * 
 * 注意：使用 localStorage 存储配置进度（Tauri 后端没有通用的 app_setting 命令）
 */

import type { EngineType } from '../types/provider';

// 配置步骤定义
export interface SetupStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped';
    optional?: boolean;
    errorMessage?: string;
}

// 引擎配置进度
export interface EngineSetupProgress {
    engine: EngineType;
    status: 'not_started' | 'in_progress' | 'completed';
    currentStep: number;
    completedSteps: string[];
    configData?: Record<string, unknown>;
    lastUpdated: number;
}

// 引擎配置状态
export interface ConfigStatus {
    isFullyConfigured: boolean;
    incompleteSteps: string[];
    lastConfigured?: number;
}

// 各引擎的配置步骤定义
export const ENGINE_SETUP_STEPS: Record<EngineType, Omit<SetupStep, 'status'>[]> = {
    claude: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Claude Code CLI' },
        { id: 'config_api', title: '配置 API', description: '设置 API Key 或选择代理商' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
        { id: 'select_model', title: '选择模型', description: '设置默认模型', optional: true },
    ],
    codex: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Codex CLI' },
        { id: 'login', title: '登录账号', description: '使用 ChatGPT 账号登录' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
    ],
    gemini: [
        { id: 'check_deps', title: '检查环境', description: '检测 Node.js 和 npm' },
        { id: 'install_cli', title: '安装 CLI', description: '安装 Gemini CLI' },
        { id: 'login', title: '登录账号', description: '使用 Google 账号登录' },
        { id: 'verify', title: '验证安装', description: '验证 CLI 可用' },
    ],
    siliconflow: [
        { id: 'register', title: '注册账号', description: '打开 SiliconFlow 注册页面', optional: true },
        { id: 'get_api_key', title: '获取 API Key', description: '从控制台获取 API Key' },
        { id: 'verify', title: '验证连接', description: '测试 API 连接' },
        { id: 'select_model', title: '选择模型', description: '设置默认模型' },
    ],
    kiro: [
        { id: 'check_kiro', title: '检查 Kiro', description: '检测 Kiro IDE 是否安装' },
        { id: 'login', title: '登录账号', description: '使用 AWS Builder ID 登录' },
        { id: 'verify', title: '验证连接', description: '验证 Token 可用' },
        { id: 'select_model', title: '选择模型', description: '设置默认模型', optional: true },
    ],
};

// 存储键前缀
const STORAGE_KEY_PREFIX = 'engine_setup_progress_';

/**
 * 保存配置进度
 */
export async function saveSetupProgress(progress: EngineSetupProgress): Promise<void> {
    const key = `${STORAGE_KEY_PREFIX}${progress.engine}`;
    const data = {
        ...progress,
        lastUpdated: Date.now(),
    };
    
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save setup progress:', error);
    }
}

/**
 * 获取配置进度
 */
export async function getSetupProgress(engine: EngineType): Promise<EngineSetupProgress | null> {
    const key = `${STORAGE_KEY_PREFIX}${engine}`;
    
    try {
        const localValue = localStorage.getItem(key);
        if (localValue) {
            return JSON.parse(localValue) as EngineSetupProgress;
        }
    } catch (error) {
        console.error('Failed to get setup progress:', error);
    }
    
    return null;
}

/**
 * 重置配置进度
 */
export async function resetSetupProgress(engine: EngineType): Promise<void> {
    const key = `${STORAGE_KEY_PREFIX}${engine}`;
    
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Failed to reset setup progress:', error);
    }
}

/**
 * 获取引擎配置状态
 */
export async function getEngineConfigStatus(engine: EngineType): Promise<ConfigStatus> {
    const progress = await getSetupProgress(engine);
    const steps = ENGINE_SETUP_STEPS[engine];
    
    if (!progress) {
        return {
            isFullyConfigured: false,
            incompleteSteps: steps.filter(s => !s.optional).map(s => s.id),
        };
    }
    
    // 计算未完成的必要步骤
    const requiredSteps = steps.filter(s => !s.optional);
    const incompleteSteps = requiredSteps
        .filter(s => !progress.completedSteps.includes(s.id))
        .map(s => s.id);
    
    return {
        isFullyConfigured: incompleteSteps.length === 0,
        incompleteSteps,
        lastConfigured: progress.lastUpdated,
    };
}

/**
 * 获取步骤的显示状态
 */
export function getStepDisplayStatus(
    stepId: string,
    currentStep: number,
    completedSteps: string[],
    steps: Omit<SetupStep, 'status'>[]
): SetupStep['status'] {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    if (completedSteps.includes(stepId)) {
        return 'completed';
    }
    
    if (stepIndex === currentStep) {
        return 'in_progress';
    }
    
    if (stepIndex < currentStep) {
        // 如果在当前步骤之前但未完成，可能是跳过的可选步骤
        const step = steps[stepIndex];
        if (step.optional) {
            return 'skipped';
        }
        return 'error';
    }
    
    return 'pending';
}

/**
 * 初始化引擎配置进度
 */
export function createInitialProgress(engine: EngineType): EngineSetupProgress {
    return {
        engine,
        status: 'not_started',
        currentStep: 0,
        completedSteps: [],
        lastUpdated: Date.now(),
    };
}

/**
 * 更新步骤完成状态
 */
export async function completeStep(
    engine: EngineType,
    stepId: string,
    configData?: Record<string, unknown>
): Promise<EngineSetupProgress> {
    let progress = await getSetupProgress(engine);
    
    if (!progress) {
        progress = createInitialProgress(engine);
    }
    
    const steps = ENGINE_SETUP_STEPS[engine];
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    // 添加到已完成步骤
    if (!progress.completedSteps.includes(stepId)) {
        progress.completedSteps.push(stepId);
    }
    
    // 更新当前步骤
    if (stepIndex >= progress.currentStep) {
        progress.currentStep = stepIndex + 1;
    }
    
    // 合并配置数据
    if (configData) {
        progress.configData = {
            ...progress.configData,
            ...configData,
        };
    }
    
    // 检查是否全部完成
    const requiredSteps = steps.filter(s => !s.optional);
    const allRequiredCompleted = requiredSteps.every(s => 
        progress!.completedSteps.includes(s.id)
    );
    
    progress.status = allRequiredCompleted ? 'completed' : 'in_progress';
    progress.lastUpdated = Date.now();
    
    await saveSetupProgress(progress);
    
    return progress;
}

/**
 * 跳过可选步骤
 */
export async function skipStep(
    engine: EngineType,
    stepId: string
): Promise<EngineSetupProgress> {
    let progress = await getSetupProgress(engine);
    
    if (!progress) {
        progress = createInitialProgress(engine);
    }
    
    const steps = ENGINE_SETUP_STEPS[engine];
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const step = steps[stepIndex];
    
    // 只能跳过可选步骤
    if (!step?.optional) {
        throw new Error(`Step ${stepId} is not optional and cannot be skipped`);
    }
    
    // 更新当前步骤
    if (stepIndex >= progress.currentStep) {
        progress.currentStep = stepIndex + 1;
    }
    
    progress.status = 'in_progress';
    progress.lastUpdated = Date.now();
    
    await saveSetupProgress(progress);
    
    return progress;
}

/**
 * 验证步骤完成顺序
 * 确保已完成的步骤是连续的（没有跳过必要步骤）
 */
export function validateStepOrder(
    completedSteps: string[],
    steps: Omit<SetupStep, 'status'>[]
): boolean {
    const requiredSteps = steps.filter(s => !s.optional);
    
    // 找到最后一个已完成的必要步骤的索引
    let lastCompletedIndex = -1;
    for (let i = requiredSteps.length - 1; i >= 0; i--) {
        if (completedSteps.includes(requiredSteps[i].id)) {
            lastCompletedIndex = i;
            break;
        }
    }
    
    // 检查所有之前的必要步骤是否都已完成
    for (let i = 0; i < lastCompletedIndex; i++) {
        if (!completedSteps.includes(requiredSteps[i].id)) {
            return false;
        }
    }
    
    return true;
}

/**
 * 获取配置状态显示文本
 */
export function getConfigStatusText(status: ConfigStatus): string {
    if (status.isFullyConfigured) {
        return '已配置';
    }
    
    if (status.incompleteSteps.length === ENGINE_SETUP_STEPS.claude.length) {
        return '未配置';
    }
    
    return '配置中';
}

export default {
    saveSetupProgress,
    getSetupProgress,
    resetSetupProgress,
    getEngineConfigStatus,
    getStepDisplayStatus,
    createInitialProgress,
    completeStep,
    skipStep,
    validateStepOrder,
    getConfigStatusText,
    ENGINE_SETUP_STEPS,
};
