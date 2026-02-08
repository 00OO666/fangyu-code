/**
 * 空状态组件 - 快速开始引导和预设代理商
 */

import { Plus, Sparkles, Building2, Globe } from "lucide-react";
import type { EngineType, PresetProvider } from "../../types/provider";
import { PRESET_PROVIDERS, ENGINE_DISPLAY_NAMES } from "../../types/provider";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  engine: EngineType;
  onAddProvider: () => void;
  onSelectPreset: (preset: PresetProvider) => void;
}

export function EmptyState({ engine, onAddProvider, onSelectPreset }: EmptyStateProps) {
  const presets = PRESET_PROVIDERS[engine] || [];

  return (
    <div className="text-center py-8 px-4">
      {/* 图标和标题 */}
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        开始配置 {ENGINE_DISPLAY_NAMES[engine]}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        添加一个代理商配置来开始使用。你可以选择预设配置快速开始，或手动添加自定义配置。
      </p>

      {/* 预设代理商 */}
      {presets.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            快速开始
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {presets.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border",
                  "text-sm font-medium transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5",
                  preset.isOfficial
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:border-green-300"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                )}
              >
                {preset.isOfficial ? (
                  <Building2 className="w-4 h-4" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                {preset.name}
                {preset.isOfficial && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-800 rounded">
                    官方
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 手动添加按钮 */}
      <button
        type="button"
        onClick={onAddProvider}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
          "bg-blue-500 text-white font-medium text-sm",
          "hover:bg-blue-600 transition-colors"
        )}
      >
        <Plus className="w-4 h-4" />
        手动添加配置
      </button>
    </div>
  );
}

export default EmptyState;
