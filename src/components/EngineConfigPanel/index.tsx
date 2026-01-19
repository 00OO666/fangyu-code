/**
 * 引擎配置面板 - 主组件
 */

import React, { useState, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useEngineConfig } from '../../hooks/useEngineConfig';
import type { UnifiedProviderConfig, PresetProvider } from '../../types/provider';
import { ENGINE_DISPLAY_NAMES } from '../../types/provider';
import { EngineCardGrid } from './EngineCardGrid';
import { ProviderList } from './ProviderList';
import { ProviderForm } from './ProviderForm';
import { EmptyState } from './EmptyState';
import { AdvancedSettings } from './AdvancedSettings';
import { ConfigActions } from './ConfigActions';
import { KiroSettings } from './KiroSettings';
import { cn } from '../../lib/utils';
import { applyModelToClaudeCode } from '../../services/engineConfigService';
import { notify } from '../notifications';

type FormMode = 'closed' | 'add' | 'edit';

interface FormState {
    mode: FormMode;
    editingId?: string;
    presetData?: Partial<UnifiedProviderConfig>;
}

export function EngineConfigPanel() {
    const {
        currentEngine,
        engines,
        providers,
        currentProvider,
        runtimeConfig,
        isLoading,
        error,
        setCurrentEngine,
        refreshEngineStatus,
        addProvider,
        updateProvider,
        deleteProvider,
        setCurrentProvider,
        reorderProviders,
        testConnection,
        exportConfig,
        importConfig,
        updateRuntimeConfig,
    } = useEngineConfig();

    const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    
    // Kiro 配置状态
    const [kiroTokenPath, setKiroTokenPath] = useState('');
    const [kiroModelId, setKiroModelId] = useState('');


    // 打开添加表单
    const handleOpenAddForm = useCallback(() => {
        setFormState({ mode: 'add' });
    }, []);

    // 选择预设
    const handleSelectPreset = useCallback((preset: PresetProvider) => {
        setFormState({
            mode: 'add',
            presetData: {
                name: preset.name,
                baseUrl: preset.baseUrl,
                isOfficial: preset.isOfficial,
                isPartner: preset.isPartner,
            },
        });
    }, []);

    // 内嵌编辑代理商
    const handleEditProvider = useCallback(async (id: string, updates: Partial<UnifiedProviderConfig>) => {
        await updateProvider(id, updates);
    }, [updateProvider]);

    // 关闭表单
    const handleCloseForm = useCallback(() => {
        setFormState({ mode: 'closed' });
    }, []);

    // 保存新代理商
    const handleSaveProvider = useCallback(async (config: Partial<UnifiedProviderConfig>) => {
        await addProvider({
            ...config,
            engine: currentEngine,
            enabled: true,
        } as Omit<UnifiedProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>);
        handleCloseForm();
    }, [currentEngine, addProvider, handleCloseForm]);

    // 删除代理商
    const handleDeleteProvider = useCallback(async (id: string) => {
        await deleteProvider(id);
        setDeleteConfirm(null);
    }, [deleteProvider]);

    // 测试连接
    const handleTestProvider = useCallback(async (id: string) => {
        const provider = providers.find(p => p.id === id);
        if (!provider) return;

        const result = await testConnection(provider);
        // 更新测试结果
        await updateProvider(id, { lastTestResult: result });
    }, [providers, testConnection, updateProvider]);

    // 选择代理商
    const handleSelectProvider = useCallback(async (id: string) => {
        await setCurrentProvider(id);
    }, [setCurrentProvider]);

    // 选择模型（全局应用到 Claude Code）
    const handleModelSelect = useCallback(async (providerId: string, modelId: string) => {
        try {
            // 只对 Claude 引擎应用全局模型
            if (currentEngine === 'claude') {
                await applyModelToClaudeCode(providerId, modelId);
                notify.success(`已将 ${modelId} 设为默认模型`, {
                    position: 'top-center',
                    duration: 3000,
                });
                // 刷新状态
                await refreshEngineStatus();
            } else {
                // 其他引擎只更新本地配置
                await updateProvider(providerId, { model: modelId });
                notify.success(`已更新默认模型`, {
                    position: 'top-center',
                    duration: 2000,
                });
            }
        } catch (error) {
            console.error('设置默认模型失败:', error);
            notify.error('设置默认模型失败', {
                position: 'top-center',
                duration: 3000,
            });
        }
    }, [currentEngine, refreshEngineStatus, updateProvider]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }


    return (
        <div className="space-y-6">
            {/* 错误提示 */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
                </div>
            )}

            {/* 引擎选择卡片 */}
            <section>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    选择引擎
                </h3>
                <EngineCardGrid
                    engines={engines}
                    currentEngine={currentEngine}
                    onEngineSelect={setCurrentEngine}
                    onRefreshStatus={refreshEngineStatus}
                />
            </section>

            {/* 代理商管理 */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {ENGINE_DISPLAY_NAMES[currentEngine]} {currentEngine === 'kiro' ? '配置' : '代理商'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <ConfigActions
                            onExport={exportConfig}
                            onImport={importConfig}
                            onRefresh={refreshEngineStatus}
                        />
                        {currentEngine !== 'kiro' && providers.length > 0 && formState.mode === 'closed' && (
                            <button
                                type="button"
                                onClick={handleOpenAddForm}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                                    'bg-blue-500 text-white hover:bg-blue-600',
                                    'transition-colors'
                                )}
                            >
                                <Plus className="w-4 h-4" />
                                添加
                            </button>
                        )}
                    </div>
                </div>

                {/* Kiro 引擎特殊配置 */}
                {currentEngine === 'kiro' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <KiroSettings
                            tokenPath={kiroTokenPath}
                            modelId={kiroModelId}
                            onTokenPathChange={setKiroTokenPath}
                            onModelChange={setKiroModelId}
                        />
                    </div>
                ) : (
                    /* 代理商列表或空状态 */
                    providers.length === 0 && formState.mode === 'closed' ? (
                        <EmptyState
                            engine={currentEngine}
                            onAddProvider={handleOpenAddForm}
                            onSelectPreset={handleSelectPreset}
                        />
                    ) : (
                        <div className="space-y-3">
                            <ProviderList
                                providers={providers}
                                activeProviderId={currentProvider?.id || null}
                                onSelect={handleSelectProvider}
                                onReorder={reorderProviders}
                                onEdit={handleEditProvider}
                                onDelete={(id) => setDeleteConfirm(id)}
                                onTest={handleTestProvider}
                                onModelSelect={handleModelSelect}
                            />

                            {/* 添加表单 */}
                            {formState.mode === 'add' && (
                                <ProviderForm
                                    engine={currentEngine}
                                    onSave={handleSaveProvider}
                                    onCancel={handleCloseForm}
                                    onTest={testConnection}
                                />
                            )}
                        </div>
                    )
                )}
            </section>

            {/* 高级设置 */}
            <section>
                <AdvancedSettings
                    engine={currentEngine}
                    runtimeConfig={runtimeConfig}
                    onUpdateRuntimeConfig={updateRuntimeConfig}
                />
            </section>

            {/* 删除确认对话框 */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            确认删除
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            确定要删除这个代理商配置吗？此操作无法撤销。
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteProvider(deleteConfirm)}
                                className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EngineConfigPanel;
