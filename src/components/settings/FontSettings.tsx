/**
 * 字体设置组件
 * 允许用户选择不同的字体组合
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useFont } from '@/contexts/FontContext';
import { FontConfig } from '@/types/fonts';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface FontSettingsProps {
  className?: string;
}

export const FontSettings: React.FC<FontSettingsProps> = ({ className }) => {
  const { currentFont, setFont, fontConfigs } = useFont();

  const handleFontSelect = (fontConfig: FontConfig) => {
    setFont(fontConfig.id);
  };

  return (
    <Card className={`p-6 space-y-6 ${className || ''}`}>
      <div>
        <h3 className="text-base font-semibold mb-2">字体设置</h3>
        <p className="text-sm text-muted-foreground mb-6">
          选择你喜欢的字体组合，立即生效无需保存
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fontConfigs.map((fontConfig) => {
            const isActive = currentFont.id === fontConfig.id;

            return (
              <motion.div
                key={fontConfig.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={() => handleFontSelect(fontConfig)}
                  className={`
                    w-full p-4 rounded-lg border-2 transition-all duration-200
                    text-left relative overflow-hidden
                    ${
                      isActive
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }
                  `}
                >
                  {/* 选中标记 */}
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {/* 字体名称 */}
                  <div className="mb-3">
                    <Label className="text-base font-semibold cursor-pointer">
                      {fontConfig.name}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fontConfig.description}
                    </p>
                  </div>

                  {/* 预览文本 */}
                  <div className="space-y-2 mt-4">
                    <div
                      className="text-sm"
                      style={{
                        fontFamily: `"${fontConfig.englishFont}", ${fontConfig.fallback}`,
                      }}
                    >
                      {fontConfig.preview.english}
                    </div>
                    <div
                      className="text-sm"
                      style={{
                        fontFamily: `"${fontConfig.chineseFont}", ${fontConfig.fallback}`,
                      }}
                    >
                      {fontConfig.preview.chinese}
                    </div>
                  </div>

                  {/* 字体信息 */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>英文: {fontConfig.englishFont}</span>
                      <span>•</span>
                      <span>中文: {fontConfig.chineseFont}</span>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="mt-6 p-4 rounded-lg bg-accent/30 border border-border">
          <p className="text-sm text-muted-foreground">
            💡 <strong>提示</strong>: 字体切换会立即应用到整个应用，无需刷新页面。
            你的选择会自动保存。
          </p>
        </div>
      </div>
    </Card>
  );
};
