import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, FileQuestion, Terminal, AlertCircle } from "lucide-react";

interface ClaudeBinaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function ClaudeBinaryDialog({ open, onOpenChange }: ClaudeBinaryDialogProps) {
  const { t } = useTranslation();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            {t('claudeBinaryDialog.title')}
          </DialogTitle>
          <DialogDescription className="space-y-3 mt-4">
            <p>
              {t('claudeBinaryDialog.description')}
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{t('claudeBinaryDialog.searchLocations')}：</span> PATH, /usr/local/bin,
                /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.claude/local, ~/.local/bin
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{t('claudeBinaryDialog.installCommand')}：</span>
                <code className="ml-2 px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded">
                  npm install -g @claude
                </code>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => window.open("https://docs.claude.ai/claude/how-to-install", "_blank")}
            className="mr-auto"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('claudeBinaryDialog.installGuide')}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
          >
            {t('claudeBinaryDialog.gotIt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
