/**
 * 代理商表单组件 - 动态字段渲染
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Zap, CheckCircle, XCircle } from 'lucide-react';
import type { EngineType, UnifiedProviderConfig } from '../../types/provider';
import { FORM_FIELDS } from '../../types/provider';
import { ApiKeyInput } from './ApiKeyInput';
import { cn } from '../../lib/utils';
import type { ConnectionTestResult } from '../../services/connectionTester';

interface ProviderFormProps {
    engine: EngineType;
    provider?: UnifiedProviderConfig;
    onSave: (config: Partial<UnifiedProviderConfig>) => Promise<void>;
    onCancel: () => void;
    onTest: (config: Partial<UnifiedProviderConfig>) => Promise<ConnectionTestResult>;
}

interface FormData {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    [key: string]: string;
}

interface FormErrors {
    [key: string]: string;
}

export function ProviderForm({
    engine,
    provider,
    onSave,
    onCancel,
    onTest,
}: ProviderFormProps) {
    const fields = FORM_FIELDS[engine] || [];
    const isEditing = !!provider;

    const [formData, setFormData] = useState<FormData>(() => {
        if (provider) {
            return {
                name: provider.name || '',
                baseUrl: provider.baseUrl || '',
                apiKey: '', // 不显示已保存的 API Key
                model: provider.model || '',
            };
        }
        return { name: '', baseUrl: '', apiKey: '', model: '' };
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);


    // 验证表单
    const validate = useCallback((): boolean => {
        const newErrors: FormErrors = {};

        fields.forEach(field => {
            if (field.required && !formData[field.name]?.trim()) {
                // 编辑模式下，如果没有输入新的 API Key，不报错
                if (field.name === 'apiKey' && isEditing) {
                    return;
                }
                newErrors[field.name] = `${field.label}不能为空`;
            }

            if (field.type === 'url' && formData[field.name]) {
                try {
                    new URL(formData[field.name]);
                } catch {
                    newErrors[field.name] = '请输入有效的 URL';
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [fields, formData, isEditing]);

    // 处理字段变化
    const handleChange = useCallback((name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        // 清除该字段的错误
        if (errors[name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
        // 清除测试结果
        setTestResult(null);
    }, [errors]);

    // 测试连接
    const handleTest = useCallback(async () => {
        if (!validate()) return;

        setIsTesting(true);
        setTestResult(null);

        try {
            const config: Partial<UnifiedProviderConfig> = {
                engine,
                name: formData.name,
                baseUrl: formData.baseUrl,
                apiKey: formData.apiKey || (provider?.apiKey ? undefined : ''),
                model: formData.model,
            };

            // 如果是编辑模式且没有输入新的 API Key，使用原来的
            if (isEditing && !formData.apiKey && provider) {
                config.apiKey = provider.apiKey;
                config.apiKeyIv = provider.apiKeyIv;
            }

            const result = await onTest(config);
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                timestamp: Date.now(),
                errorMessage: error instanceof Error ? error.message : '测试失败',
            });
        } finally {
            setIsTesting(false);
        }
    }, [validate, engine, formData, provider, isEditing, onTest]);

    // 保存
    const handleSave = useCallback(async () => {
        if (!validate()) return;

        setIsSaving(true);

        try {
            const config: Partial<UnifiedProviderConfig> = {
                engine,
                name: formData.name,
                baseUrl: formData.baseUrl,
                model: formData.model,
                enabled: true,
            };

            // 只有输入了新的 API Key 才更新
            if (formData.apiKey) {
                config.apiKey = formData.apiKey;
            }

            await onSave(config);
        } catch (error) {
            setErrors({ _form: error instanceof Error ? error.message : '保存失败' });
        } finally {
            setIsSaving(false);
        }
    }, [validate, engine, formData, onSave]);


    // 渲染字段
    const renderField = (field: typeof fields[0]) => {
        const value = formData[field.name] || '';
        const error = errors[field.name];

        if (field.type === 'secret') {
            return (
                <div key={field.name} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.required && !isEditing && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <ApiKeyInput
                        value={value}
                        onChange={(v) => handleChange(field.name, v)}
                        error={error}
                        placeholder={isEditing ? '留空保持不变' : field.placeholder}
                    />
                </div>
            );
        }

        if (field.type === 'select' && field.options) {
            return (
                <div key={field.name} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        className={cn(
                            'w-full px-3 py-2 rounded-lg border text-sm',
                            'bg-white dark:bg-gray-800',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        )}
                    >
                        <option value="">选择模型...</option>
                        {field.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>
            );
        }

        return (
            <div key={field.name} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type={field.type === 'url' ? 'url' : 'text'}
                    value={value}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        'bg-white dark:bg-gray-800',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    )}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
        );
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* 表单字段 */}
            <div className="space-y-3">
                {fields.map(renderField)}
            </div>

            {/* 测试结果 */}
            {testResult && (
                <div className={cn(
                    'flex items-center gap-2 p-3 rounded-lg text-sm',
                    testResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                )}>
                    {testResult.success ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>
                        {testResult.success
                            ? `连接成功${testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ''}`
                            : testResult.errorMessage || '连接失败'}
                    </span>
                </div>
            )}

            {/* 表单错误 */}
            {errors._form && (
                <p className="text-sm text-red-500">{errors._form}</p>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={isTesting || isSaving}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                        'border border-yellow-500 text-yellow-600 dark:text-yellow-400',
                        'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                    )}
                >
                    {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Zap className="w-4 h-4" />
                    )}
                    测试连接
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    取消
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isTesting}
                    className={cn(
                        'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium',
                        'bg-blue-500 text-white hover:bg-blue-600',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                    )}
                >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isEditing ? '保存' : '添加'}
                </button>
            </div>
        </div>
    );
}

export default ProviderForm;
