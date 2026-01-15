/**
 * useSummaryGenerator Hook
 * 
 * 封装摘要生成逻辑，整合配置存储、生成服务、UI 状态
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { getSummaryGeneratorService } from '@/services/summaryGeneratorService';
import { getSummaryConfigStore } from '@/services/summaryConfigStore';
import { tokenExtractor } from '@/lib/tokenExtractor';
import type {
    SummaryAPIConfig,
    SummaryResult,
    GenerationProgress,
    SessionStats,
    GenerationOptions,
} from '@/types/summary';
import type { ClaudeStreamMessage } from '@/types/claude';

interface UseSummaryGeneratorOptions {
    /** 当前会话消息 */
    messages: ClaudeStreamMessage[];
    /** 最大上下文 token 数 */
    maxContextTokens?: number;
    /** 每 1K token 成本（美元） */
    costPer1kTokens?: number;
}

interface UseSummaryGeneratorReturn {
    /** 会话统计信息 */
    sessionStats: SessionStats;
    /** 生成进度 */
    progress: GenerationProgress;
    /** 生成结果 */
    result: SummaryResult | null;
    /** 当前配置 */
    config: SummaryAPIConfig | null;
    /** 是否正在生成 */
    isGenerating: boolean;
    /** 生成摘要 */
    generateSummary: (options?: GenerationOptions) => Promise<SummaryResult>;
    /** 取消生成 */
    cancelGeneration: () => void;
    /** 更新配置 */
    updateConfig: (config: Partial<SummaryAPIConfig>) => Promise<void>;
    /** 复制到剪贴板 */
    copyToClipboard: () => Promise<boolean>;
    /** 重置状态 */
    reset: () => void;
}

const DEFAULT_MAX_CONTEXT_TOKENS = 200000;
const DEFAULT_COST_PER_1K = 0.003; // Claude 3 Sonnet 默认价格

/**
 * useSummaryGenerator - 摘要生成 Hook
 */
export function useSummaryGenerator(
    options: UseSummaryGeneratorOptions
): UseSummaryGeneratorReturn {
    const {
        messages,
        maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS,
        costPer1kTokens = DEFAULT_COST_PER_1K,
    } = options;

    // 状态
    const [config, setConfig] = useState<SummaryAPIConfig | null>(null);
    const [progress, setProgress] = useState<GenerationProgress>({
        status: 'idle',
        percentage: 0,
    });
    const [result, setResult] = useState<SummaryResult | null>(null);

    // 服务实例
    const service = useMemo(() => getSummaryGeneratorService(), []);
    const configStore = useMemo(() => getSummaryConfigStore(), []);

    // 加载配置
    useEffect(() => {
        configStore.loadConfig().then(setConfig);
    }, [configStore]);

    // 订阅进度更新
    useEffect(() => {
        const unsubscribe = service.onProgress(setProgress);
        return unsubscribe;
    }, [service]);

    // 计算会话统计
    const sessionStats = useMemo<SessionStats>(() => {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let userMessageCount = 0;
        let assistantMessageCount = 0;

        for (const msg of messages) {
            if (msg.type === 'user') {
                userMessageCount++;
            } else if (msg.type === 'assistant') {
                assistantMessageCount++;
            }

            // 使用 tokenExtractor 提取实际的 usage 数据
            const tokens = tokenExtractor.extract(msg);
            totalInputTokens += tokens.input_tokens;
            totalOutputTokens += tokens.output_tokens;
        }

        const tokenCount = totalInputTokens + totalOutputTokens;

        // 如果没有 usage 数据，使用字符估算
        const estimatedTokenCount = tokenCount > 0 ? tokenCount : estimateTokensFromMessages(messages);

        const tokenPercentage = estimatedTokenCount / maxContextTokens;
        const estimatedCost = (estimatedTokenCount / 1000) * costPer1kTokens;

        return {
            messageCount: messages.length,
            tokenCount: estimatedTokenCount,
            tokenPercentage,
            estimatedCost,
            userMessageCount,
            assistantMessageCount,
        };
    }, [messages, maxContextTokens, costPer1kTokens]);

    // 生成摘要
    const generateSummary = useCallback(async (
        genOptions?: GenerationOptions
    ): Promise<SummaryResult> => {
        const summaryResult = await service.generateSummary(
            messages,
            config || undefined,
            genOptions
        );
        setResult(summaryResult);
        return summaryResult;
    }, [service, messages, config]);

    // 取消生成
    const cancelGeneration = useCallback(() => {
        service.cancelGeneration();
    }, [service]);

    // 更新配置
    const updateConfig = useCallback(async (
        partial: Partial<SummaryAPIConfig>
    ): Promise<void> => {
        const updated = await configStore.updateConfig(partial);
        setConfig(updated);
    }, [configStore]);

    // 复制到剪贴板
    const copyToClipboard = useCallback(async (): Promise<boolean> => {
        if (!result?.summary) return false;

        try {
            await navigator.clipboard.writeText(result.summary);
            return true;
        } catch (error) {
            console.error('[useSummaryGenerator] Failed to copy:', error);
            return false;
        }
    }, [result]);

    // 重置状态
    const reset = useCallback(() => {
        setResult(null);
        setProgress({ status: 'idle', percentage: 0 });
        service.reset();
    }, [service]);

    const isGenerating = progress.status === 'generating' || progress.status === 'preparing';

    return {
        sessionStats,
        progress,
        result,
        config,
        isGenerating,
        generateSummary,
        cancelGeneration,
        updateConfig,
        copyToClipboard,
        reset,
    };
}

/**
 * 从消息估算 token 数（备用方法）
 */
function estimateTokensFromMessages(messages: ClaudeStreamMessage[]): number {
    let totalTokens = 0;

    for (const msg of messages) {
        if (msg.type === 'user' || msg.type === 'assistant') {
            const content = extractTextContent(msg);
            // 中文：1 字符 ≈ 2 tokens，其他：4 字符 ≈ 1 token
            const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
            const otherChars = content.length - chineseChars;
            totalTokens += chineseChars * 2 + Math.ceil(otherChars / 4);
        }
    }

    return totalTokens;
}

/**
 * 提取消息文本内容
 */
function extractTextContent(msg: ClaudeStreamMessage): string {
    const message = msg.message;
    if (!message) return '';

    if (typeof message === 'string') return message;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
        return message.content
            .map((c: any) => (c.type === 'text' ? c.text : ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

export default useSummaryGenerator;
