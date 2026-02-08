/**
 * ImageGenerateDialog - 图像生成对话框
 * 
 * 功能：
 * 1. 文生图 - 输入提示词生成图片
 * 2. 图生图 - 上传参考图片进行编辑
 * 3. 模型选择 - Flash (快速) / Pro (高质量)
 * 4. 生成结果预览和下载
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Loader2, Download, Copy, Trash2, Upload, Sparkles, Zap, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    geminiImageService,
    type GeminiImageModel,
    type GeneratedImage,
    type ImageGenerationResult,
    fileToBase64,
    downloadImage,
    getImageModels,
} from '@/services/geminiImageService';

interface ImageGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImageGenerated?: (imageBase64: string, mimeType: string) => void;
    isServiceAvailable: boolean;
}

export const ImageGenerateDialog: React.FC<ImageGenerateDialogProps> = ({
    open,
    onOpenChange,
    onImageGenerated,
    isServiceAvailable,
}) => {
    // 状态
    const [prompt, setPrompt] = useState('');
    const [selectedModel, setSelectedModel] = useState<GeminiImageModel>('gemini-2.5-flash-image');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [responseText, setResponseText] = useState<string | null>(null);
    const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const models = getImageModels();

    // 生成图片
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) {
            setError('请输入图片描述');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        setResponseText(null);

        try {
            let result: ImageGenerationResult;

            if (referenceImage) {
                // 图生图模式
                result = await geminiImageService.editImage(prompt, {
                    model: selectedModel,
                    referenceImages: [referenceImage],
                });
            } else {
                // 文生图模式
                result = await geminiImageService.generateImage(prompt, {
                    model: selectedModel,
                });
            }

            if (result.success) {
                if (result.images && result.images.length > 0) {
                    setGeneratedImages(result.images);
                }
                if (result.text) {
                    setResponseText(result.text);
                }
                if (!result.images?.length && !result.text) {
                    setError('未生成任何内容');
                }
            } else {
                setError(result.error || '生成失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成失败');
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, selectedModel, referenceImage]);

    // 上传参考图片
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('请上传图片文件');
            return;
        }

        try {
            const imageData = await fileToBase64(file);
            setReferenceImage(imageData);
            setError(null);
        } catch (err) {
            setError('图片读取失败');
        }
    }, []);

    // 移除参考图片
    const handleRemoveReference = useCallback(() => {
        setReferenceImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // 下载图片
    const handleDownload = useCallback((image: GeneratedImage) => {
        downloadImage(image, `nano-banana-${Date.now()}.png`);
    }, []);

    // 复制到剪贴板
    const handleCopy = useCallback(async (image: GeneratedImage) => {
        try {
            const blob = await fetch(`data:${image.mimeType};base64,${image.data}`).then(r => r.blob());
            await navigator.clipboard.write([
                new ClipboardItem({ [image.mimeType]: blob }),
            ]);
        } catch (err) {
            logger.error('ImageGenerateDialog', '复制失败:', err);
        }
    }, []);

    // 使用生成的图片
    const handleUseImage = useCallback((image: GeneratedImage) => {
        onImageGenerated?.(image.data, image.mimeType);
        onOpenChange(false);
    }, [onImageGenerated, onOpenChange]);

    // 清空结果
    const handleClear = useCallback(() => {
        setGeneratedImages([]);
        setResponseText(null);
        setError(null);
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ImagePlus className="h-5 w-5" />
                        AI 图像生成
                        <Badge variant="outline" className="ml-2">
                            Nano Banana
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        使用 Google Gemini 生成高质量图片
                    </DialogDescription>
                </DialogHeader>

                {!isServiceAvailable ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">未配置 Gemini API Key</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            请在设置中配置 Google AI API Key 以使用图像生成功能
                        </p>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            关闭
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* 输入区域 */}
                        <div className="space-y-4">
                            {/* 模型选择 */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">模型</Label>
                                    <Select
                                        value={selectedModel}
                                        onValueChange={(v) => setSelectedModel(v as GeminiImageModel)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {models.map((model) => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    <div className="flex items-center gap-2">
                                                        {model.id.includes('flash') ? (
                                                            <Zap className="h-4 w-4 text-yellow-500" />
                                                        ) : (
                                                            <Sparkles className="h-4 w-4 text-purple-500" />
                                                        )}
                                                        <span>{model.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {models.find(m => m.id === selectedModel)?.description}
                                </div>
                            </div>

                            {/* 参考图片 */}
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                    参考图片（可选，用于图生图）
                                </Label>
                                <div className="flex items-center gap-2">
                                    {referenceImage ? (
                                        <div className="relative group">
                                            <img
                                                src={`data:${referenceImage.mimeType};base64,${referenceImage.data}`}
                                                alt="参考图片"
                                                className="h-20 w-20 object-cover rounded-lg border"
                                            />
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={handleRemoveReference}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            上传图片
                                        </Button>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            </div>

                            {/* 提示词输入 */}
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                    图片描述
                                </Label>
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={referenceImage
                                        ? "描述你想要的修改，例如：把背景改成星空"
                                        : "描述你想要生成的图片，例如：一只可爱的橘猫在阳光下打盹"
                                    }
                                    className="min-h-[100px] resize-none"
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* 生成按钮 */}
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="flex-1"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            生成图片
                                        </>
                                    )}
                                </Button>
                                {generatedImages.length > 0 && (
                                    <Button variant="outline" onClick={handleClear}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* 错误提示 */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                                >
                                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                    <span className="text-sm text-red-600">{error}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto h-6 w-6 p-0"
                                        onClick={() => setError(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 生成结果 */}
                        {(generatedImages.length > 0 || responseText) && (
                            <ScrollArea className="flex-1 border rounded-lg">
                                <div className="p-4 space-y-4">
                                    {/* AI 文字回复 */}
                                    {responseText && (
                                        <div className="p-3 bg-muted/50 rounded-lg">
                                            <p className="text-sm">{responseText}</p>
                                        </div>
                                    )}

                                    {/* 生成的图片 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {generatedImages.map((image, index) => (
                                            <div
                                                key={index}
                                                className="group relative border rounded-lg overflow-hidden bg-muted/30"
                                            >
                                                <img
                                                    src={`data:${image.mimeType};base64,${image.data}`}
                                                    alt={`生成的图片 ${index + 1}`}
                                                    className="w-full h-auto"
                                                />

                                                {/* 操作按钮 */}
                                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        onClick={() => handleDownload(image)}
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>下载</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        onClick={() => handleCopy(image)}
                                                                    >
                                                                        <Copy className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>复制</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        {onImageGenerated && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="default"
                                                                            size="sm"
                                                                            onClick={() => handleUseImage(image)}
                                                                        >
                                                                            使用
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>添加到对话</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 模型标签 */}
                                                <Badge
                                                    variant="secondary"
                                                    className="absolute top-2 right-2 text-xs"
                                                >
                                                    {image.model.includes('flash') ? 'Flash' : 'Pro'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ImageGenerateDialog;
