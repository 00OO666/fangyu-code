/**
 * FirstLaunchChangelogDialog - 首次启动更新日志对话框
 *
 * 在每次更新后首次打开 Fangyu Code 时显示
 * 展示新版本的改进内容
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Bug from 'lucide-react/dist/esm/icons/bug'
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import type { ChangelogData } from '@/hooks/useFirstLaunchChangelog';

interface FirstLaunchChangelogDialogProps {
  open: boolean;
  onClose: () => void;
  changelog: ChangelogData | null;
}

export const FirstLaunchChangelogDialog: React.FC<FirstLaunchChangelogDialogProps> = React.memo(({
  open,
  onClose,
  changelog,
}) => {
  if (!changelog) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                欢迎使用 Fangyu Code {changelog.version}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {changelog.date}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {/* 新功能 */}
            {changelog.features && changelog.features.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <h3 className="font-semibold text-sm">新功能</h3>
                  <Badge variant="secondary" className="text-xs">
                    {changelog.features.length} 项
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {changelog.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 改进 */}
            {changelog.improvements && changelog.improvements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-semibold text-sm">改进优化</h3>
                  <Badge variant="secondary" className="text-xs">
                    {changelog.improvements.length} 项
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {changelog.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bug 修复 */}
            {changelog.bugFixes && changelog.bugFixes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bug className="h-4 w-4 text-orange-500" />
                  <h3 className="font-semibold text-sm">Bug 修复</h3>
                  <Badge variant="secondary" className="text-xs">
                    {changelog.bugFixes.length} 项
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {changelog.bugFixes.map((fix, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              此提示仅在每次更新后首次打开时显示
            </p>
            <Button onClick={onClose}>
              <Sparkles className="h-4 w-4 mr-2" />
              开始使用
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default FirstLaunchChangelogDialog;
