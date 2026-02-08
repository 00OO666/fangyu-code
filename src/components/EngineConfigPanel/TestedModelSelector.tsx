/**
 * 已测试模型选择器组件
 * 显示测试成功的模型列表，支持点击选择默认模型
 */

import { CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TestedModel {
    id: string;
    name: string;
    status: 'success' | 'replaced' | 'error';
    actualModel?: string;
    latency?: number;
    isThinking?: boolean;
}

interface TestedModelSelectorProps {
    models: TestedModel[];
    selectedModel: string | null;
    onSelect: (modelId: string) => void;
    disabled?: boolean;
}

export function TestedModelSelector({
    models,
    selectedModel,
    onSelect,
    disabled = false,
}: TestedModelSelectorProps) {
    // 只显示成功或被替换的模型（可用的模型）
    const availableModels = models.filter(m => m.status === 'success' || m.status === 'replaced');

    if (availableModels.length === 0) {
        return (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
                暂无可用模型，请先测试连接
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-2">
                <Zap className="w-3 h-3" />
                <span>选择默认模型（点击切换）</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                {availableModels.map(model => {
                    const isSelected = selectedModel === model.id ||
                        (model.actualModel && selectedModel === model.actualModel);
                    const displayId = model.status === 'replaced' ? model.actualModel : model.id;

                    return (
                        <button
                            key={model.isThinking ? `${model.id}-thinking` : model.id}
                            type="button"
                            onClick={() => onSelect(displayId || model.id)}
                            disabled={disabled}
                            className={cn(
                                'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all',
                                'border hover:border-blue-400 dark:hover:border-blue-500',
                                isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
                                disabled && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {model.status === 'success' ? (
                                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            ) : (
                                <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                            )}
                            <span className="truncate font-medium">
                                {model.name}
                                {model.isThinking && ' 🧠'}
                            </span>
                            {isSelected && (
                                <span className="ml-auto text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">
                                    默认
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {selectedModel && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                    当前默认: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{selectedModel}</code>
                </div>
            )}
        </div>
    );
}

export default TestedModelSelector;
