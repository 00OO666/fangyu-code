import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { Info, ExternalLink, Sparkles } from 'lucide-react';
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { AutoUpdater } from "@/components/AutoUpdater";
import { CHANGELOGS } from "@/hooks/useFirstLaunchChangelog";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  onViewNewFeatures?: () => void;
}

export function AboutDialog({ open, onClose, onViewNewFeatures }: AboutDialogProps) {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState<string>(t('messages.loading'));
  const PROJECT_URL = "https://github.com/anyme123/Any-code";

  // 动态获取应用版本号
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (err) {
        logger.error('AboutDialog', "Failed to get version:", err);
        setAppVersion(t('dialogs.unknown'));
      }
    };

    if (open) {
      fetchVersion();
    }
  }, [open]);

  const handleOpenProject = async () => {
    try {
      await openUrl(PROJECT_URL);
    } catch (err) {
      logger.error('AboutDialog', t('dialogs.openProjectPageFailed'), err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Info className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Fangyu Code</DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-2">
            <span>{t('about.version')}:</span>
            <span className="font-mono font-semibold text-primary">
              v{appVersion}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Description */}
        <div className="p-4 light-glass rounded-lg">
          <p className="text-sm text-white/70 text-center">
            {t('about.description')}
          </p>
        </div>

        {/* Auto Updater */}
        <AutoUpdater onUpdateComplete={onClose} />

        {/* Actions */}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {/* 查看新功能按钮 */}
          {onViewNewFeatures && (
            <Button
              variant="default"
              onClick={() => {
                onClose();
                onViewNewFeatures();
              }}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              v{Object.keys(CHANGELOGS)[0]} 新功能
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleOpenProject}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('about.visitProject')}
          </Button>
        </DialogFooter>

        {/* Footer */}
        <div className="pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Fangyu Code. All rights reserved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
