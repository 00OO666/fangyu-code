/**
 * 背景设置组件
 * 允许用户上传自定义背景图片
 */

import React, { useEffect, useMemo, useState } from 'react';
import { open, message, confirm } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, exists, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Upload, RotateCcw, Image as ImageIcon, Trash2 } from 'lucide-react';

interface BackgroundSettingsProps {
  className?: string;
}

interface BackgroundEntry {
  id: string;
  fileName: string;
  addedAt: number;
  label: string;
}

const BACKGROUND_LIST_KEY = 'custom-backgrounds';
const BACKGROUND_ACTIVE_KEY = 'custom-background-active';
const BACKGROUND_STORAGE_KEY = 'custom-background-path';
const BACKGROUND_FILE_KEY = 'custom-background-file';
const BACKGROUND_BLUR_KEY = 'custom-background-blur';
const DEFAULT_BLUR = 12;
const MAX_BLUR = 30;
const BACKGROUND_FILE_PREFIX = 'custom-background';

export const BackgroundSettings: React.FC<BackgroundSettingsProps> = ({ className }) => {
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);
  const [backgroundPreviews, setBackgroundPreviews] = useState<Record<string, string>>({});
  const [activeBackgroundId, setActiveBackgroundId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [blurAmount, setBlurAmount] = useState(DEFAULT_BLUR);

  const activePreviewUrl = activeBackgroundId ? backgroundPreviews[activeBackgroundId] : null;
  const activeLabel = useMemo(() => {
    if (!activeBackgroundId) return null;
    return backgrounds.find((bg) => bg.id === activeBackgroundId)?.label ?? null;
  }, [activeBackgroundId, backgrounds]);

  // 加载已保存的背景图片
  useEffect(() => {
    loadCustomBackground();
  }, []);

  const loadCustomBackground = async () => {
    try {
      // 模糊度
      const savedBlur = localStorage.getItem(BACKGROUND_BLUR_KEY);
      const parsedBlur = savedBlur ? Number(savedBlur) : NaN;
      const nextBlur = Number.isFinite(parsedBlur)
        ? Math.min(Math.max(parsedBlur, 0), MAX_BLUR)
        : DEFAULT_BLUR;
      setBlurAmount(nextBlur);

      let parsedList: BackgroundEntry[] = [];
      const storedList = localStorage.getItem(BACKGROUND_LIST_KEY);
      if (storedList) {
        try {
          const decoded = JSON.parse(storedList);
          if (Array.isArray(decoded)) {
            parsedList = decoded
              .filter((item) => item && typeof item === 'object')
              .map((item) => ({
                id: String(item.id || ''),
                fileName: String(item.fileName || ''),
                addedAt: Number(item.addedAt || Date.now()),
                label: String(item.label || item.fileName || '背景'),
              }))
              .filter((item) => item.id && item.fileName);
          }
        } catch (error) {
          console.warn('背景列表解析失败，将重置', error);
        }
      }

      const storedActiveId = localStorage.getItem(BACKGROUND_ACTIVE_KEY);
      const activeDisabled = storedActiveId === 'none';
      let activeId = activeDisabled ? null : storedActiveId;

      // 兼容旧版单图模式
      if (parsedList.length === 0) {
        let legacyFileName = localStorage.getItem(BACKGROUND_FILE_KEY);
        if (!legacyFileName) {
          const legacyPath = localStorage.getItem(BACKGROUND_STORAGE_KEY);
          if (legacyPath) {
            legacyFileName = legacyPath.split(/[\\/]/).pop() || null;
          }
        }

        if (legacyFileName) {
          const fileExists = await exists(legacyFileName, {
            baseDir: BaseDirectory.AppData,
          });

          if (fileExists) {
            const legacyId = `legacy-${Date.now()}`;
            parsedList = [{
              id: legacyId,
              fileName: legacyFileName,
              addedAt: Date.now(),
              label: legacyFileName,
            }];
            activeId = legacyId;
            localStorage.setItem(BACKGROUND_LIST_KEY, JSON.stringify(parsedList));
            localStorage.setItem(BACKGROUND_ACTIVE_KEY, legacyId);
          }
        }

        localStorage.removeItem(BACKGROUND_STORAGE_KEY);
        localStorage.removeItem(BACKGROUND_FILE_KEY);
      }

      if (parsedList.length > 0) {
        const existsList = await Promise.all(
          parsedList.map((bg) => exists(bg.fileName, { baseDir: BaseDirectory.AppData }))
        );
        const filteredList = parsedList.filter((_, index) => existsList[index]);
        if (filteredList.length !== parsedList.length) {
          parsedList = filteredList;
          localStorage.setItem(BACKGROUND_LIST_KEY, JSON.stringify(parsedList));
        }
      }

      if (parsedList.length === 0) {
        localStorage.removeItem(BACKGROUND_ACTIVE_KEY);
        setBackgrounds([]);
        setBackgroundPreviews({});
        setActiveBackgroundId(null);
        return;
      }

      if (!activeDisabled) {
        if (!activeId || !parsedList.some((bg) => bg.id === activeId)) {
          activeId = parsedList[0].id;
          localStorage.setItem(BACKGROUND_ACTIVE_KEY, activeId);
        }
      }

      const appDataPath = await appDataDir();
      const previewEntries = await Promise.all(
        parsedList.map(async (bg) => {
          const fullPath = await join(appDataPath, bg.fileName);
          return [bg.id, `${convertFileSrc(fullPath)}?v=${bg.addedAt}`] as const;
        })
      );

      setBackgroundPreviews(Object.fromEntries(previewEntries));
      setBackgrounds(parsedList);
      setActiveBackgroundId(activeId);
    } catch (error) {
      console.error('加载自定义背景失败:', error);
    }
  };

  const handleUploadBackground = async () => {
    try {
      setIsUploading(true);

      // 打开文件选择对话框
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: '图片',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          },
        ],
      });

      if (!selected) {
        setIsUploading(false);
        return;
      }

      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      if (!selectedPath) {
        setIsUploading(false);
        return;
      }

      const extensionMatch = /(\.[^./\\]+)$/.exec(selectedPath);
      const safeExt = extensionMatch ? extensionMatch[1].toLowerCase() : '.jpg';
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `${BACKGROUND_FILE_PREFIX}-${uniqueId}${safeExt}`;
      const label = selectedPath.split(/[\\/]/).pop() || fileName;

      // 读取选中的文件
      const fileContent = await readFile(selectedPath);

      // 保存到应用数据目录
      await writeFile(fileName, fileContent, {
        baseDir: BaseDirectory.AppData,
      });

      // 构建完整路径
      const appDataPath = await appDataDir();
      const fullPath = await join(appDataPath, fileName);
      const addedAt = Date.now();

      const newEntry: BackgroundEntry = {
        id: uniqueId,
        fileName,
        addedAt,
        label,
      };

      const nextBackgrounds = [newEntry, ...backgrounds];
      setBackgrounds(nextBackgrounds);
      localStorage.setItem(BACKGROUND_LIST_KEY, JSON.stringify(nextBackgrounds));

      setActiveBackgroundId(uniqueId);
      localStorage.setItem(BACKGROUND_ACTIVE_KEY, uniqueId);
      localStorage.removeItem(BACKGROUND_STORAGE_KEY);
      localStorage.removeItem(BACKGROUND_FILE_KEY);

      // 更新预览
      const assetUrl = `${convertFileSrc(fullPath)}?v=${addedAt}`;
      setBackgroundPreviews((prev) => ({ ...prev, [uniqueId]: assetUrl }));

      window.dispatchEvent(new Event('background-settings-changed'));
    } catch (error) {
      console.error('上传背景图片失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await message(`上传失败：${errorMessage}`, { title: '背景设置', kind: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetBackground = () => {
    localStorage.setItem(BACKGROUND_ACTIVE_KEY, 'none');
    setActiveBackgroundId(null);

    window.dispatchEvent(new Event('background-settings-changed'));
  };

  const handleSelectBackground = (id: string) => {
    setActiveBackgroundId(id);
    localStorage.setItem(BACKGROUND_ACTIVE_KEY, id);
    window.dispatchEvent(new Event('background-settings-changed'));
  };

  const handleRemoveBackground = async (id: string) => {
    const target = backgrounds.find((bg) => bg.id === id);
    if (!target) return;

    const confirmed = await confirm(`确定删除背景「${target.label}」吗？`, {
      title: '背景设置',
      kind: 'warning',
    });
    if (!confirmed) return;

    let removeFailed = false;
    try {
      await remove(target.fileName, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      removeFailed = true;
      console.warn('删除背景文件失败:', error);
    }

    const nextBackgrounds = backgrounds.filter((bg) => bg.id !== id);
    setBackgrounds(nextBackgrounds);
    localStorage.setItem(BACKGROUND_LIST_KEY, JSON.stringify(nextBackgrounds));

    setBackgroundPreviews((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (activeBackgroundId === id) {
      const nextActive = nextBackgrounds[0]?.id ?? null;
      setActiveBackgroundId(nextActive);
      if (nextActive) {
        localStorage.setItem(BACKGROUND_ACTIVE_KEY, nextActive);
      } else {
        localStorage.setItem(BACKGROUND_ACTIVE_KEY, 'none');
      }
    }

    if (removeFailed) {
      await message('背景文件删除失败，但已从列表移除。', { title: '背景设置', kind: 'warning' });
    }

    window.dispatchEvent(new Event('background-settings-changed'));
  };

  const handleBlurChange = (values: number[]) => {
    const nextBlur = values[0] ?? 0;
    setBlurAmount(nextBlur);
    localStorage.setItem(BACKGROUND_BLUR_KEY, String(nextBlur));
    window.dispatchEvent(new Event('background-settings-changed'));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 标题 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">背景图片设置</h3>
        <p className="text-sm text-gray-400">
          上传自定义背景图片，支持 PNG、JPG、WEBP 等格式
        </p>
      </div>

      {/* 当前预览 */}
      {activePreviewUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-white/10">
          <img
            src={activePreviewUrl}
            alt="背景预览"
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-white text-sm font-medium">
              当前背景{activeLabel ? `：${activeLabel}` : ''}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-gray-400">
          当前未使用自定义背景
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleUploadBackground}
          disabled={isUploading}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? '上传中...' : '上传背景图片'}
        </Button>

        {activeBackgroundId && (
          <Button
            variant="outline"
            onClick={handleResetBackground}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            恢复默认背景
          </Button>
        )}
      </div>

      {/* 背景列表 */}
      {backgrounds.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-300">已上传背景</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {backgrounds.map((bg) => {
              const preview = backgroundPreviews[bg.id];
              const isActive = bg.id === activeBackgroundId;
              return (
                <div
                  key={bg.id}
                  className={cn(
                    'rounded-lg border overflow-hidden bg-black/20',
                    isActive ? 'border-primary/60 ring-1 ring-primary/40' : 'border-white/10'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectBackground(bg.id)}
                    className="w-full text-left"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={bg.label}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="h-28 w-full flex items-center justify-center text-xs text-gray-500">
                        预览生成中...
                      </div>
                    )}
                  </button>
                  <div className="p-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-300 truncate" title={bg.label}>
                      {bg.label}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={isActive ? 'secondary' : 'ghost'}
                        onClick={() => handleSelectBackground(bg.id)}
                        className="px-2"
                      >
                        {isActive ? '当前' : '使用'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveBackground(bg.id)}
                        className="px-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 模糊度调节 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">背景模糊度</span>
          <span className="text-xs text-gray-400">{blurAmount}px</span>
        </div>
        <Slider
          min={0}
          max={MAX_BLUR}
          step={1}
          value={[blurAmount]}
          onValueChange={handleBlurChange}
        />
        <p className="text-xs text-gray-400">0 为不模糊，数值越大越“磨砂”。</p>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex gap-3">
          <ImageIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300 space-y-1">
            <p className="font-medium text-blue-300">使用提示：</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>推荐使用 1920x1080 或更高分辨率的图片</li>
              <li>图片会自动适配屏幕大小</li>
              <li>上传后会立即应用新背景</li>
              <li>图片保存在应用数据目录中</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
