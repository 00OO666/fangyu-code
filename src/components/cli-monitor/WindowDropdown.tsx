/**
 * 窗口下拉菜单组件
 * 用于选择和切换 Claude CLI 窗口
 */

import React, { useState, useEffect, useCallback } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronDown, Monitor, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowInfo } from "@/types/cli-monitor";
import { scanWindows, focusWindow } from "@/lib/api/cli-monitor";
import { logger } from "@/lib/logger";

interface WindowDropdownProps {
  onSelect: (window: WindowInfo) => void;
  className?: string;
}

export const WindowDropdown: React.FC<WindowDropdownProps> = ({
  onSelect,
  className,
}) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载窗口列表
  const loadWindows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await scanWindows();
      setWindows(result.windows);
      logger.info(`[WindowDropdown] Loaded ${result.windows.length} windows`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error("[WindowDropdown] Failed to load windows:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载窗口列表
  useEffect(() => {
    loadWindows();
  }, []);

  // 处理窗口选择（带防抖）
  const handleSelect = useCallback(
    async (window: WindowInfo) => {
      setSelectedWindow(window);
      setIsFocusing(true);
      setError(null);
      setSuccessMessage(null);

      try {
        // 调用 focusWindow API
        await focusWindow(window.hwnd);

        // 显示成功消息
        setSuccessMessage(`已切换到窗口: ${window.title}`);
        logger.info(`[WindowDropdown] Successfully focused window: ${window.title}`);

        // 3秒后清除成功消息
        setTimeout(() => setSuccessMessage(null), 3000);

        // 调用父组件的回调
        onSelect(window);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`切换窗口失败: ${errorMessage}`);
        logger.error("[WindowDropdown] Failed to focus window:", err);

        // 5秒后清除错误消息
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsFocusing(false);
      }
    },
    [onSelect]
  );

  return (
    <div className={cn("relative", className)}>
      {/* 成功消息 */}
      {successMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-green-500/20 border border-green-500/30 px-3 py-2 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 错误消息 */}
      {error && !isLoading && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <Listbox value={selectedWindow} onChange={handleSelect} disabled={isFocusing}>
        {({ open }) => (
          <>
            <Listbox.Button
              className={cn(
                "relative w-full cursor-pointer rounded-lg",
                "bg-[#141824] backdrop-blur-xl",
                "border border-white/10",
                "px-4 py-3",
                "text-left text-sm text-white",
                "shadow-lg shadow-black/20",
                "transition-all duration-200",
                "hover:border-blue-500/50 hover:shadow-blue-500/20",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                open && "border-blue-500/50 shadow-blue-500/20"
              )}
              onClick={loadWindows}
              disabled={isFocusing}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  <span>
                    {isFocusing
                      ? "切换中..."
                      : isLoading
                      ? "加载中..."
                      : selectedWindow
                      ? selectedWindow.title
                      : windows.length > 0
                      ? "选择窗口"
                      : "无可用窗口"}
                  </span>
                </div>
                {isFocusing || isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-gray-400 transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  />
                )}
              </div>
            </Listbox.Button>

            <Listbox.Options
              className={cn(
                "absolute z-50 mt-2 w-full",
                "rounded-lg bg-[#141824] backdrop-blur-xl",
                "border border-white/10",
                "shadow-2xl shadow-black/40",
                "max-h-60 overflow-auto",
                "py-1"
              )}
            >
              {error ? (
                <div className="px-4 py-3 text-sm text-red-400">
                  错误: {error}
                </div>
              ) : windows.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">
                  未找到 Claude CLI 窗口
                </div>
              ) : (
                windows.map((window) => (
                  <Listbox.Option
                    key={window.hwnd}
                    value={window}
                    className={({ active, selected }) =>
                      cn(
                        "relative cursor-pointer select-none",
                        "px-4 py-3",
                        "transition-colors duration-150",
                        active && "bg-blue-500/20",
                        selected && "bg-blue-500/30"
                      )
                    }
                  >
                    {({ selected }) => (
                      <div className="flex flex-col gap-1">
                        <div
                          className={cn(
                            "text-sm font-medium",
                            selected ? "text-blue-300" : "text-white"
                          )}
                        >
                          {window.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>PID: {window.process_id}</span>
                          {window.project_path && (
                            <>
                              <span>•</span>
                              <span className="truncate">
                                {window.project_path}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </Listbox.Option>
                ))
              )}
            </Listbox.Options>
          </>
        )}
      </Listbox>
    </div>
  );
};
