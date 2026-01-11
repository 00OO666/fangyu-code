/**
 * FileDropZone - 文件拖拽区域组件
 * 
 * 支持拖拽上传图片、PDF、Word、PPT、Excel 等文件
 * 集成到聊天输入框，支持多模态对话
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    X,
    FileText,
    Image as ImageIcon,
    FileSpreadsheet,
    Presentation,
    File,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    parseFile,
    detectFileType,
    isFileSupported,
    formatFileSize,
    type ParsedFile,
    type SupportedFileType,
} from '@/services/fileParserService';

// =============================================================================
// 类型定义
// =============================================================================

export interface FileAttachment {
    id: string;
    file: File;
    parsed?: ParsedFile;
    status: 'pending' | 'parsing' | 'ready' | 'error';
    error?: string;
}

export interface FileDropZoneProps {
    /** 已附加的文件列表 */
    attachments: FileAttachment[];
    /** 文件变更回调 - 支持直接值或函数式更新 */
    onAttachmentsChange: (attachments: FileAttachment[] | ((prev: FileAttachment[]) => FileAttachment[])) => void;
    /** 最大文件数量 */
    maxFiles?: number;
    /** 最大单文件大小（字节） */
    maxFileSize?: number;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义类名 */
    className?: string;
    /** 紧凑模式（只显示图标） */
    compact?: boolean;
}

// =============================================================================
// 图标映射
// =============================================================================

const FILE_TYPE_ICONS: Record<SupportedFileType, React.ReactNode> = {
    image: <ImageIcon className="h-4 w-4 text-blue-500" />,
    pdf: <FileText className="h-4 w-4 text-red-500" />,
    word: <FileText className="h-4 w-4 text-blue-600" />,
    excel: <FileSpreadsheet className="h-4 w-4 text-green-500" />,
    powerpoint: <Presentation className="h-4 w-4 text-orange-500" />,
    text: <FileText className="h-4 w-4 text-gray-500" />,
    unknown: <File className="h-4 w-4 text-gray-400" />,
};

// =============================================================================
// 主组件
// =============================================================================

export const FileDropZone: React.FC<FileDropZoneProps> = ({
    attachments,
    onAttachmentsChange,
    maxFiles = 10,
    maxFileSize = 20 * 1024 * 1024, // 20MB
    disabled = false,
    className,
    compact = false,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    // 处理文件
    const handleFiles = useCallback(async (files: FileList | File[]) => {
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
                setError(`文件 "${file.name}" 超过大小限制 (${formatFileSize(maxFileSize)})`);
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

        // 先添加到列表（显示 pending 状态）
        const updatedAttachments = [...attachments, ...newAttachments];
        onAttachmentsChange(updatedAttachments);

        // 异步解析文件
        for (const attachment of newAttachments) {
            // 更新状态为 parsing
            onAttachmentsChange(
                attachments.map((a: FileAttachment) => a.id === attachment.id ? { ...a, status: 'parsing' as const } : a)
            );

            try {
                const parsed = await parseFile(attachment.file, {
                    maxTextLength: 50000,
                    maxPdfPages: 30,
                });

                // 更新为 ready 状态
                onAttachmentsChange(
                    attachments.map((a: FileAttachment) => a.id === attachment.id
                        ? { ...a, status: 'ready' as const, parsed }
                        : a
                    )
                );
            } catch (err) {
                // 更新为 error 状态
                onAttachmentsChange(
                    attachments.map((a: FileAttachment) => a.id === attachment.id
                        ? { ...a, status: 'error' as const, error: err instanceof Error ? err.message : '解析失败' }
                        : a
                    )
                );
            }
        }
    }, [attachments, maxFiles, maxFileSize, onAttachmentsChange]);

    // 拖拽事件处理
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    }, [disabled, handleFiles]);

    // 粘贴事件处理
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            }

            if (files.length > 0) {
                handleFiles(files);
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled, handleFiles]);

    // 删除附件
    const handleRemove = useCallback((id: string) => {
        onAttachmentsChange(attachments.filter(a => a.id !== id));
    }, [attachments, onAttachmentsChange]);

    // 清空所有
    const handleClearAll = useCallback(() => {
        onAttachmentsChange([]);
        setError(null);
    }, [onAttachmentsChange]);

    return (
        <div
            className={cn('relative', className)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* 拖拽覆盖层 */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg"
                    >
                        <div className="text-center">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <p className="text-sm font-medium text-primary">释放以上传文件</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 隐藏的文件输入 */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                disabled={disabled}
            />

            {/* 附件列表 */}
            {attachments.length > 0 && (
                <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                            已附加 {attachments.length} 个文件
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleClearAll}
                        >
                            清空
                        </Button>
                    </div>

                    <ScrollArea className="max-h-32">
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((attachment) => (
                                <AttachmentChip
                                    key={attachment.id}
                                    attachment={attachment}
                                    onRemove={() => handleRemove(attachment.id)}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* 错误提示 */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2"
                    >
                        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                            <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            <span className="text-red-600 flex-1">{error}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => setError(null)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 上传按钮（紧凑模式） */}
            {compact && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={disabled || attachments.length >= maxFiles}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>上传文件（支持图片、PDF、Word、Excel、PPT）</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
};

// =============================================================================
// 附件标签组件
// =============================================================================

interface AttachmentChipProps {
    attachment: FileAttachment;
    onRemove: () => void;
}

const AttachmentChip: React.FC<AttachmentChipProps> = ({ attachment, onRemove }) => {
    const fileType = detectFileType(attachment.file);
    const icon = FILE_TYPE_ICONS[fileType];

    return (
        <Badge
            variant="secondary"
            className={cn(
                'flex items-center gap-1.5 pr-1 max-w-[200px]',
                attachment.status === 'error' && 'bg-red-500/10 border-red-500/20'
            )}
        >
            {attachment.status === 'parsing' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                icon
            )}

            <span className="truncate text-xs">{attachment.file.name}</span>

            <span className="text-[10px] text-muted-foreground">
                {formatFileSize(attachment.file.size)}
            </span>

            {attachment.status === 'error' && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <AlertCircle className="h-3 w-3 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{attachment.error}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={onRemove}
            >
                <X className="h-3 w-3" />
            </Button>
        </Badge>
    );
};

export default FileDropZone;
