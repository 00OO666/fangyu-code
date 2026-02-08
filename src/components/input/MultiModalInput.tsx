/**
 * MultiModalInput - 多模态输入组件
 *
 * 功能：
 * 1. 截图粘贴/屏幕捕获
 * 2. 图片上传/拖拽
 * 3. PDF 文件上传和文本提取
 * 4. 图片预览和编辑
 * 5. 文件管理（删除、重新上传）
 * 6. OCR 文本识别（可选）
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, FileText, X, Eye, Download, Copy, AlertCircle, Loader2, Camera, ClipboardPaste, Trash2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ============================================
// 类型定义
// ============================================

export type MediaType = 'image' | 'pdf' | 'screenshot';

export interface MediaFile {
  id: string;
  type: MediaType;
  name: string;
  size: number;
  url: string;
  thumbnail?: string;
  extractedText?: string;
  metadata?: {
    width?: number;
    height?: number;
    pages?: number;
    mimeType?: string;
  };
  uploadedAt: Date;
}

export interface MultiModalInputProps {
  /** 已上传的文件列表 */
  files?: MediaFile[];
  /** 文件变更回调 */
  onChange?: (files: MediaFile[]) => void;
  /** 最大文件数量 */
  maxFiles?: number;
  /** 最大文件大小（字节） */
  maxFileSize?: number;
  /** 支持的文件类型 */
  acceptedTypes?: string[];
  /** 是否启用 OCR */
  enableOCR?: boolean;
  /** 是否启用屏幕捕获 */
  enableScreenCapture?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * 生成缩略图
 */
const generateThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('不是图片文件'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 提取 PDF 文本（模拟）
 */
const extractPDFText = async (file: File): Promise<string> => {
  // 实际应该使用 pdf.js 或调用 Tauri 后端
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `[PDF 文本提取]\n文件名: ${file.name}\n大小: ${formatFileSize(file.size)}\n\n这里是提取的PDF文本内容...`;
};

/**
 * OCR 识别（模拟）
 */
const performOCR = async (_imageUrl: string): Promise<string> => {
  // 实际应该调用 Tesseract.js 或云端 OCR API
  await new Promise(resolve => setTimeout(resolve, 1500));
  return `[OCR 识别结果]\n这里是图片中识别出的文本内容...`;
};

// ============================================
// 文件预览组件
// ============================================

interface FilePreviewProps {
  file: MediaFile;
  onClose: () => void;
  onDelete?: () => void;
  enableOCR?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose, onDelete, enableOCR }) => {
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isOCRing, setIsOCRing] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [activeTab, setActiveTab] = useState('preview');

  const handleOCR = useCallback(async () => {
    if (file.type !== 'image') return;
    setIsOCRing(true);
    try {
      const text = await performOCR(file.url);
      setOcrText(text);
    } catch (err) {
      logger.error('MultiModalInput', 'OCR failed:', err);
    } finally {
      setIsOCRing(false);
    }
  }, [file]);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
  }, [file]);

  const handleCopy = useCallback(async () => {
    if (file.extractedText || ocrText) {
      await navigator.clipboard.writeText(file.extractedText || ocrText || '');
    }
  }, [file.extractedText, ocrText]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {file.type === 'image' ? (
                <Image className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              {file.name}
            </DialogTitle>

            <div className="flex items-center gap-1">
              {file.type === 'image' && enableOCR && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOCR}
                        disabled={isOCRing}
                      >
                        {isOCRing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>OCR 文本识别</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>下载</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {onDelete && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={onDelete}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>删除</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">预览</TabsTrigger>
            <TabsTrigger value="text" disabled={!file.extractedText && !ocrText}>
              文本内容
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            {file.type === 'image' || file.type === 'screenshot' ? (
              <div className="space-y-3">
                {/* 图片控制 */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-16 text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(400, zoom + 25))}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((rotation + 90) % 360)}
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* 图片展示 */}
                <ScrollArea className="h-[500px] border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="max-w-full h-auto"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s'
                      }}
                    />
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[500px] border rounded-lg bg-muted/30">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    PDF 文件预览
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {file.metadata?.pages} 页 · {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
            )}

            {/* 元数据 */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t text-xs">
              <div>
                <span className="text-muted-foreground">大小：</span>
                <span className="font-medium">{formatFileSize(file.size)}</span>
              </div>
              {file.metadata?.width && file.metadata?.height && (
                <div>
                  <span className="text-muted-foreground">尺寸：</span>
                  <span className="font-medium">
                    {file.metadata.width} × {file.metadata.height}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">类型：</span>
                <span className="font-medium">{file.type}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="text" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {ocrText ? 'OCR 识别结果' : '提取的文本'}
                </span>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  复制文本
                </Button>
              </div>
              <Textarea
                value={file.extractedText || ocrText || ''}
                readOnly
                className="h-[500px] font-mono text-xs"
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// 文件卡片组件
// ============================================

interface FileCardProps {
  file: MediaFile;
  onPreview: () => void;
  onDelete: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onPreview, onDelete }) => {
  return (
    <Card className="group relative overflow-hidden hover:shadow-md transition-shadow">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="destructive"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      <CardContent className="p-0 cursor-pointer" onClick={onPreview}>
        {/* 预览区 */}
        <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
          {file.type === 'image' || file.type === 'screenshot' ? (
            <img
              src={file.thumbnail || file.url}
              alt={file.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <FileText className="w-12 h-12 text-muted-foreground" />
          )}
        </div>

        {/* 信息区 */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            {file.type === 'image' ? (
              <Image className="w-4 h-4 text-blue-500" />
            ) : file.type === 'pdf' ? (
              <FileText className="w-4 h-4 text-red-500" />
            ) : (
              <Camera className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-medium truncate flex-1">
              {file.name}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(file.size)}</span>
            {file.metadata?.pages && (
              <Badge variant="outline" className="text-[10px]">
                {file.metadata.pages} 页
              </Badge>
            )}
            {file.extractedText && (
              <Badge variant="outline" className="text-[10px] bg-green-500/10">
                已提取文本
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// 主组件
// ============================================

export const MultiModalInput: React.FC<MultiModalInputProps> = ({
  files: propFiles = [],
  onChange,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['image/*', 'application/pdf'],
  enableOCR = true,
  enableScreenCapture = true,
  className
}) => {
  const [files, setFiles] = useState<MediaFile[]>(propFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 同步外部 files
  useEffect(() => {
    setFiles(propFiles);
  }, [propFiles]);

  // 处理文件上传
  const handleFiles = useCallback(async (fileList: FileList) => {
    setError(null);

    if (files.length + fileList.length > maxFiles) {
      setError(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    setIsUploading(true);

    const newFiles: MediaFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // 验证文件大小
      if (file.size > maxFileSize) {
        setError(`文件 ${file.name} 超过大小限制 (${formatFileSize(maxFileSize)})`);
        continue;
      }

      // 验证文件类型
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });

      if (!isValidType) {
        setError(`文件 ${file.name} 类型不支持`);
        continue;
      }

      // 创建 MediaFile 对象
      const url = URL.createObjectURL(file);
      const mediaFile: MediaFile = {
        id: `${Date.now()}-${i}`,
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        name: file.name,
        size: file.size,
        url,
        uploadedAt: new Date(),
        metadata: {
          mimeType: file.type
        }
      };

      // 生成缩略图
      if (file.type.startsWith('image/')) {
        try {
          mediaFile.thumbnail = await generateThumbnail(file);

          // 获取图片尺寸
          const img = new Image();
          img.src = url;
          await new Promise((resolve) => {
            img.onload = () => {
              mediaFile.metadata!.width = img.width;
              mediaFile.metadata!.height = img.height;
              resolve(null);
            };
          });
        } catch (err) {
          logger.error('MultiModalInput', 'Failed to generate thumbnail:', err);
        }
      }

      // 提取 PDF 文本
      if (file.type === 'application/pdf') {
        try {
          mediaFile.extractedText = await extractPDFText(file);
        } catch (err) {
          logger.error('MultiModalInput', 'Failed to extract PDF text:', err);
        }
      }

      newFiles.push(mediaFile);
    }

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
    setIsUploading(false);
  }, [files, maxFiles, maxFileSize, acceptedTypes, onChange]);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // 粘贴处理
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            imageItems.push(new File([file], `screenshot-${Date.now()}.png`, { type: file.type }));
          }
        }
      }

      if (imageItems.length > 0) {
        // 直接处理文件数组，避免 DataTransfer 兼容性问题
        const fileList = {
          length: imageItems.length,
          item: (i: number) => imageItems[i],
          [Symbol.iterator]: function* () {
            for (let i = 0; i < imageItems.length; i++) {
              yield imageItems[i];
            }
          }
        } as unknown as FileList;
        for (let i = 0; i < imageItems.length; i++) {
          (fileList as unknown as Record<number, File>)[i] = imageItems[i];
        }
        handleFiles(fileList);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  // 删除文件
  const handleDelete = useCallback((fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
  }, [files, onChange]);

  // 屏幕捕获（模拟）
  const handleScreenCapture = useCallback(async () => {
    // 实际应该调用 Tauri 的截图 API
    alert('屏幕捕获功能需要在 Tauri 环境中实现');
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* 上传区域 */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          isUploading && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {isUploading ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">处理中...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  拖拽文件到此处，或{' '}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    点击上传
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  支持图片、PDF 文件，最大 {formatFileSize(maxFileSize)}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" />
                  选择文件
                </Button>

                {enableScreenCapture && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScreenCapture}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    截图
                  </Button>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ClipboardPaste className="w-4 h-4 mr-2" />
                        粘贴
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Ctrl+V 粘贴截图
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-600">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 w-6 p-0"
              onClick={() => setError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              已上传文件 ({files.length}/{maxFiles})
            </span>
            {files.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiles([]);
                  onChange?.([]);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清空
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map(file => (
              <FileCard
                key={file.id}
                file={file}
                onPreview={() => setPreviewFile(file)}
                onDelete={() => handleDelete(file.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 文件预览对话框 */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDelete={() => {
            handleDelete(previewFile.id);
            setPreviewFile(null);
          }}
          enableOCR={enableOCR}
        />
      )}
    </div>
  );
};

export default MultiModalInput;
