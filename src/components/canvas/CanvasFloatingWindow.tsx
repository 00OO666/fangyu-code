/**
 * Canvas 悬浮窗 - 独立实现
 *
 * 特性:
 * - 全局悬浮，可拖拽
 * - 快捷键调出: Ctrl+Shift+C
 * - 自动提取聊天消息中的代码
 * - 实时预览
 */

import React, { useState, useEffect } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasPanel } from "./CanvasPanel";

interface CanvasFloatingWindowProps {
  isOpen: boolean;
  onClose: () => void;
  extractedCode?: string;
  language?: string;
}

export const CanvasFloatingWindow: React.FC<CanvasFloatingWindowProps> = ({
  isOpen,
  onClose,
  extractedCode = "",
  language = "tsx",
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 监听快捷键 Ctrl+Shift+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setIsMinimized(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".drag-handle")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
    if (isResizing) {
      const newWidth = Math.max(600, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(400, resizeStart.height + (e.clientY - resizeStart.y));
      setSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // 开始缩放
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height });
  };

  // 重置位置和大小
  const handleReset = () => {
    setPosition({ x: 0, y: 0 });
    setSize({ width: 1200, height: 800 });
  };

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setIsMinimized(false)} className="gap-2 shadow-lg">
          <Maximize2 size={16} />
          Canvas
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        className="absolute bg-[#0f0f0f] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-[#2a2a2a]"
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          transform: `translate(${position.x}px, ${position.y}px)`,
          maxWidth: "95vw",
          maxHeight: "95vh",
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 标题栏 (可拖拽) */}
        <div className="drag-handle flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] cursor-move">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Canvas</span>
            <span className="text-xs text-gray-500">Ctrl+Shift+C · 拖拽移动</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8 text-gray-400 hover:text-white"
              title="重置位置和大小"
            >
              <Maximize2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(true)}
              className="h-8 w-8 text-gray-400 hover:text-white"
            >
              <Minimize2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-red-500/20"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Canvas 面板 */}
        <div className="flex-1 overflow-hidden">
          <CanvasPanel
            isOpen={true}
            onClose={onClose}
            code={extractedCode}
            language={language}
            title="实时预览"
          />
        </div>

        {/* 缩放手柄 (右下角) */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={handleResizeStart}
          style={{
            background: "linear-gradient(135deg, transparent 50%, #666 50%)",
          }}
          title="拖拽缩放"
        />
      </div>
    </div>
  );
};

export default CanvasFloatingWindow;
