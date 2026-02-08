/**
 * 快速代理商切换器 - 类似 cc switch 的快速切换界面
 */

import { useState, useEffect, useCallback } from "react";
import { X, Check, Zap, Globe, Clock, Search, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import type { UnifiedProviderConfig } from "../types/provider";
import { useEngineConfig } from "../hooks/useEngineConfig";

interface ProviderQuickSwitchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

function formatLastUsed(timestamp?: number): string {
  if (!timestamp) return "从未使用";
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return "超过30天";
}

export function ProviderQuickSwitch({ isOpen, onClose, onOpenSettings }: ProviderQuickSwitchProps) {
  const { currentEngine, providers, currentProvider, setCurrentProvider } = useEngineConfig();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 过滤代理商
  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.baseUrl?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredProviders.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredProviders[selectedIndex];
        if (selected) {
          handleSelect(selected.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredProviders, onClose]);

  const handleSelect = useCallback(
    async (id: string) => {
      await setCurrentProvider(id);
      onClose();
    },
    [setCurrentProvider, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* 头部 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Zap className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">快速切换代理商</h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {currentEngine.toUpperCase()}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索代理商名称或地址..."
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-lg border text-sm",
                "bg-white dark:bg-gray-900",
                "border-gray-300 dark:border-gray-600",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                "placeholder:text-gray-400"
              )}
              autoFocus
            />
          </div>
        </div>

        {/* 代理商列表 */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredProviders.length === 0 ? (
            <div className="py-12 text-center">
              <Globe className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? "未找到匹配的代理商" : "暂无代理商配置"}
              </p>
              {onOpenSettings && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="mt-4 text-sm text-blue-500 hover:text-blue-600 font-medium"
                >
                  前往设置添加
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredProviders.map((provider, index) => {
                const isActive = provider.id === currentProvider?.id;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSelect(provider.id)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 transition-colors text-left",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20",
                      !isSelected && "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    {/* 选中标记 */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {isActive && <Check className="w-5 h-5 text-blue-500" />}
                    </div>

                    {/* 代理商信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "font-medium text-sm truncate",
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-900 dark:text-gray-100"
                          )}
                        >
                          {provider.name}
                        </span>
                        {provider.isOfficial && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                            官方
                          </span>
                        )}
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono truncate">{provider.baseUrl}</span>
                        {provider.lastUsed && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatLastUsed(provider.lastUsed)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 测试状态 */}
                    {provider.lastTestResult && (
                      <div
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          provider.lastTestResult.success
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                      >
                        {provider.lastTestResult.success
                          ? `${provider.lastTestResult.latencyMs}ms`
                          : "失败"}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  ↑↓
                </kbd>{" "}
                导航
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  Enter
                </kbd>{" "}
                选择
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  Esc
                </kbd>{" "}
                关闭
              </span>
            </div>
            {onOpenSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium"
              >
                <Plus className="w-3 h-3" />
                管理代理商
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProviderQuickSwitch;
