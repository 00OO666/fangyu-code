import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

interface PermissionRule {
  id: string;
  value: string;
}

interface PermissionsSettingsProps {
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  addPermissionRule: (type: "allow" | "deny") => void;
  updatePermissionRule: (type: "allow" | "deny", id: string, value: string) => void;
  removePermissionRule: (type: "allow" | "deny", id: string) => void;
}

export const PermissionsSettings: React.FC<PermissionsSettingsProps> = ({
  allowRules,
  denyRules,
  addPermissionRule,
  updatePermissionRule,
  removePermissionRule
}) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold mb-2">{t('permissionsSettings.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('permissionsSettings.subtitle')}
          </p>
        </div>

        {/* Allow Rules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-green-500">{t('permissionsSettings.allowRules')}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPermissionRule("allow")}
              className="gap-2 hover:border-green-500/50 hover:text-green-500"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {t('permissionsSettings.addRule')}
            </Button>
          </div>
          <div className="space-y-2">
            {allowRules.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {t('permissionsSettings.noAllowRules')}
              </p>
            ) : (
              allowRules.map((rule) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder={t('common.bashExample')}
                    value={rule.value}
                    onChange={(e) => updatePermissionRule("allow", rule.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePermissionRule("allow", rule.id)}
                    className="h-8 w-8"
                    aria-label={t('permissionsSettings.deleteRule')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>
        </div>
        
        {/* Deny Rules */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-red-500">{t('permissionsSettings.denyRules')}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPermissionRule("deny")}
              className="gap-2 hover:border-red-500/50 hover:text-red-500"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {t('permissionsSettings.addRule')}
            </Button>
          </div>
          <div className="space-y-2">
            {denyRules.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {t('permissionsSettings.noDenyRules')}
              </p>
            ) : (
              denyRules.map((rule) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="e.g., Bash(curl:*)"
                    value={rule.value}
                    onChange={(e) => updatePermissionRule("deny", rule.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePermissionRule("deny", rule.id)}
                    className="h-8 w-8"
                    aria-label={t('permissionsSettings.deleteRule')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>
        </div>
        
        <div className="pt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>{t('permissionsSettings.examples')}</strong>
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
            <li>- <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - {t('permissionsSettings.exampleBashAll')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - {t('permissionsSettings.exampleBashExact')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run test:*)</code> - {t('permissionsSettings.exampleBashPrefix')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Read(~/.zshrc)</code> - {t('permissionsSettings.exampleReadFile')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Edit(docs/**)</code> - {t('permissionsSettings.exampleEditDir')}</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};