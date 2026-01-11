/**
 * useFileAttachments - 文件附件管理 Hook
 * 
 * 管理聊天输入框的文件附件状态
 */

import { useState, useCallback } from 'react';
import {
    parseFile,
    isFileSupported,
    parsedFileToAIContent,
    type ParsedFile,
} from '@/services/fileParserService';

export interface FileAttachment {
    id: string;
    file: File;
    parsed?: ParsedFile;
    status: 'pending' | 'parsing' | 'ready' | 'error';
    error?: string;
}

export interface UseFileAttachmentsOptions {
    /** 最大文件数量 */
    maxFiles?: number;
    /** 最大单文件大小（字节） */
    maxFileSize?: number;
    /** 解析选项 */
    parseOptions?: {
        maxTextLength?: number;
        maxPdfPages?: number;
        extractImages?: boolean;
    };
}

export interface UseFileAttachmentsReturn {
    /** 附件列表 */
    attachments: FileAttachment[];
    /** 是否有附件 */
    hasAttachments: boolean;
    /** 是否正在解析 */
    isParsing: boolean;
    /** 添加文件 */
    addFiles: (files: FileList | File[]) => Promise<void>;
    /** 移除文件 */
    removeFile: (id: string) => void;
    /** 清空所有 */
    clearAll: () => void;
    /** 获取 AI 消息内容 */
    getAIContents: () => Array<
        | { type: 'text'; content: string }
        | { type: 'image'; data: string; mimeType: string }
    >;
    /** 错误信息 */
    error: string | null;
    /** 清除错误 */
    clearError: () => void;
}

export function useFileAttachments(
    options: UseFileAttachmentsOptions = {}
): UseFileAttachmentsReturn {
    const {
        maxFiles = 10,
        maxFileSize = 20 * 1024 * 1024, // 20MB
        parseOptions = {
            maxTextLength: 50000,
            maxPdfPages: 30,
        },
    } = options;

    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 计算状态
    const hasAttachments = attachments.length > 0;
    const isParsing = attachments.some(a => a.status === 'parsing');

    // 添加文件
    const addFiles = useCallback(async (files: FileList | File[]) => {
        setError(null);
        const fileArray = Array.from(files);

        // 检查数量限制
        if (attachments.length + fileArray.length > maxFiles) {
            setError(`最多只能上传 ${maxFiles} 个文件`);
            return;
        }

        const newAttachments: FileAttachment[] = [];

        for (const file of fileArray) {
            // 检查大小限制
            if (file.size > maxFileSize) {
                setError(`文件 "${file.name}" 超过大小限制`);
                continue;
            }

            // 检查类型支持
            if (!isFileSupported(file)) {
                setError(`文件 "${file.name}" 类型不支持`);
                continue;
            }

            const attachment: FileAttachment = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                status: 'pending',
            };

            newAttachments.push(attachment);
        }

        if (newAttachments.length === 0) return;

        // 先添加到列表
        setAttachments(prev => [...prev, ...newAttachments]);

        // 异步解析
        for (const attachment of newAttachments) {
            // 更新状态为 parsing
            setAttachments(prev =>
                prev.map(a => a.id === attachment.id ? { ...a, status: 'parsing' as const } : a)
            );

            try {
                const parsed = await parseFile(attachment.file, parseOptions);

                // 更新为 ready 状态
                setAttachments(prev =>
                    prev.map(a => a.id === attachment.id
                        ? { ...a, status: 'ready' as const, parsed }
                        : a
                    )
                );
            } catch (err) {
                // 更新为 error 状态
                setAttachments(prev =>
                    prev.map(a => a.id === attachment.id
                        ? { ...a, status: 'error' as const, error: err instanceof Error ? err.message : '解析失败' }
                        : a
                    )
                );
            }
        }
    }, [attachments.length, maxFiles, maxFileSize, parseOptions]);

    // 移除文件
    const removeFile = useCallback((id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    }, []);

    // 清空所有
    const clearAll = useCallback(() => {
        setAttachments([]);
        setError(null);
    }, []);

    // 获取 AI 消息内容
    const getAIContents = useCallback(() => {
        const contents: Array<
            | { type: 'text'; content: string }
            | { type: 'image'; data: string; mimeType: string }
        > = [];

        for (const attachment of attachments) {
            if (attachment.status !== 'ready' || !attachment.parsed) continue;

            const content = parsedFileToAIContent(attachment.parsed);
            if (content) {
                contents.push(content);
            }
        }

        return contents;
    }, [attachments]);

    // 清除错误
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        attachments,
        hasAttachments,
        isParsing,
        addFiles,
        removeFile,
        clearAll,
        getAIContents,
        error,
        clearError,
    };
}

export default useFileAttachments;
