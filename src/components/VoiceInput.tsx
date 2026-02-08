import React, { useState, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFlashSpeechService } from "@/services/flashSpeechService";
import { toast } from "sonner";

interface VoiceInputProps {
  onTextRecognized: (text: string) => void;
  disabled?: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTextRecognized, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // 录音计时器
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // 快捷键 Ctrl+Shift+V
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        e.preventDefault();
        if (!disabled) {
          handleToggleRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, isRecording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      // 停止录音
      setIsProcessing(true);
      try {
        const service = getFlashSpeechService();
        const text = await service.stopRecording();
        setIsRecording(false);
        setIsProcessing(false);

        if (text) {
          onTextRecognized(text);
          toast.success("语音识别成功", {
            description: `识别结果：${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
          });
        } else {
          toast.warning("未识别到语音内容");
        }
      } catch (error) {
        setIsRecording(false);
        setIsProcessing(false);
        toast.error("语音识别失败", {
          description: error instanceof Error ? error.message : "未知错误",
        });
      }
    } else {
      // 开始录音
      try {
        const service = getFlashSpeechService();
        await service.startRecording();
        setIsRecording(true);
        toast.info("开始录音", {
          description: "再次点击或按 Ctrl+Shift+V 停止录音",
        });
      } catch (error) {
        toast.error("无法开始录音", {
          description: error instanceof Error ? error.message : "请检查麦克风权限",
        });
      }
    }
  }, [isRecording, onTextRecognized]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            onClick={handleToggleRecording}
            disabled={disabled || isProcessing}
            className={isRecording ? "animate-pulse" : ""}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{isRecording ? "停止录音" : "语音输入"}</p>
            {isRecording && (
              <p className="text-xs text-muted-foreground mt-1">
                录音中：{formatTime(recordingTime)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">快捷键：Ctrl+Shift+V</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
