/**
 * ImageGenerateButton - 图像生成按钮组件
 * 
 * 在聊天输入框旁边显示，点击打开图像生成对话框
 */

import React, { useState } from 'react';
import ImagePlus from 'lucide-react/dist/esm/icons/image-plus'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ImageGenerateDialog } from './ImageGenerateDialog';
import { geminiImageService } from '@/services/geminiImageService';

interface ImageGenerateButtonProps {
    /** 是否禁用 */
    disabled?: boolean;
    /** 生成的图片回调 */
    onImageGenerated?: (imageBase64: string, mimeType: string) => void;
    /** 自定义类名 */
    className?: string;
}

export const ImageGenerateButton: React.FC<ImageGenerateButtonProps> = ({
    disabled = false,
    onImageGenerated,
    className,
}) => {
    const [showDialog, setShowDialog] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // 检查服务是否可用
    const checkAvailability = async () => {
        if (isAvailable === null) {
            const available = await geminiImageService.initialize();
            setIsAvailable(available);
        }
    };

    const handleClick = async () => {
        await checkAvailability();
        setShowDialog(true);
    };

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={className}
                            disabled={disabled}
                            onClick={handleClick}
                        >
                            {isAvailable === null ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ImagePlus className="h-4 w-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>AI 图像生成 (Nano Banana)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <ImageGenerateDialog
                open={showDialog}
                onOpenChange={setShowDialog}
                onImageGenerated={onImageGenerated}
                isServiceAvailable={isAvailable ?? false}
            />
        </>
    );
};

export default ImageGenerateButton;
