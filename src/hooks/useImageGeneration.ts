/**
 * useImageGeneration - 图像生成 Hook
 * 
 * 封装 Gemini 图像生成服务的状态管理
 */

import { useState, useCallback, useEffect } from 'react';
import {
    geminiImageService,
    type GeminiImageModel,
    type GeneratedImage,
    type ImageGenerationOptions,
    type ImageEditOptions,
} from '@/services/geminiImageService';

export interface UseImageGenerationOptions {
    /** 默认模型 */
    defaultModel?: GeminiImageModel;
    /** 自动初始化 */
    autoInit?: boolean;
}

export interface UseImageGenerationReturn {
    /** 服务是否可用 */
    isAvailable: boolean;
    /** 是否正在生成 */
    isGenerating: boolean;
    /** 生成的图片列表 */
    images: GeneratedImage[];
    /** AI 返回的文字 */
    responseText: string | null;
    /** 错误信息 */
    error: string | null;
    /** 当前选择的模型 */
    selectedModel: GeminiImageModel;
    /** 设置模型 */
    setSelectedModel: (model: GeminiImageModel) => void;
    /** 文生图 */
    generateImage: (prompt: string, options?: ImageGenerationOptions) => Promise<void>;
    /** 图生图 */
    editImage: (prompt: string, options?: ImageEditOptions) => Promise<void>;
    /** 清空结果 */
    clearResults: () => void;
    /** 初始化服务 */
    initialize: () => Promise<boolean>;
}

export function useImageGeneration(
    options: UseImageGenerationOptions = {}
): UseImageGenerationReturn {
    const { defaultModel = 'gemini-2.5-flash-image', autoInit = true } = options;

    const [isAvailable, setIsAvailable] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [responseText, setResponseText] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<GeminiImageModel>(defaultModel);

    // 初始化服务
    const initialize = useCallback(async () => {
        const available = await geminiImageService.initialize();
        setIsAvailable(available);
        return available;
    }, []);

    // 自动初始化
    useEffect(() => {
        if (autoInit) {
            initialize();
        }
    }, [autoInit, initialize]);

    // 文生图
    const generateImage = useCallback(async (
        prompt: string,
        genOptions?: ImageGenerationOptions
    ) => {
        if (!isAvailable) {
            setError('图像生成服务不可用，请配置 Gemini API Key');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setImages([]);
        setResponseText(null);

        try {
            const result = await geminiImageService.generateImage(prompt, {
                model: selectedModel,
                ...genOptions,
            });

            if (result.success) {
                if (result.images) {
                    setImages(result.images);
                }
                if (result.text) {
                    setResponseText(result.text);
                }
            } else {
                setError(result.error || '生成失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成失败');
        } finally {
            setIsGenerating(false);
        }
    }, [isAvailable, selectedModel]);

    // 图生图
    const editImage = useCallback(async (
        prompt: string,
        editOptions?: ImageEditOptions
    ) => {
        if (!isAvailable) {
            setError('图像生成服务不可用，请配置 Gemini API Key');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setImages([]);
        setResponseText(null);

        try {
            const result = await geminiImageService.editImage(prompt, {
                model: selectedModel,
                ...editOptions,
            });

            if (result.success) {
                if (result.images) {
                    setImages(result.images);
                }
                if (result.text) {
                    setResponseText(result.text);
                }
            } else {
                setError(result.error || '编辑失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '编辑失败');
        } finally {
            setIsGenerating(false);
        }
    }, [isAvailable, selectedModel]);

    // 清空结果
    const clearResults = useCallback(() => {
        setImages([]);
        setResponseText(null);
        setError(null);
    }, []);

    return {
        isAvailable,
        isGenerating,
        images,
        responseText,
        error,
        selectedModel,
        setSelectedModel,
        generateImage,
        editImage,
        clearResults,
        initialize,
    };
}

export default useImageGeneration;
