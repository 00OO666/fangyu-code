import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface EnvironmentSettingsProps {
  envVars: EnvironmentVariable[];
  addEnvVar: () => void;
  updateEnvVar: (id: string, field: "key" | "value" | "enabled", value: string | boolean) => void;
  removeEnvVar: (id: string) => void;
}

export const EnvironmentSettings: React.FC<EnvironmentSettingsProps> = ({
  envVars,
  addEnvVar,
  updateEnvVar,
  removeEnvVar
}) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{t('environmentSettings.title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('environmentSettings.subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addEnvVar}
            className="gap-2"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t('environmentSettings.addVariable')}
          </Button>
        </div>

        <div className="space-y-3">
          {envVars.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {t('environmentSettings.noVariables')}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {t('environmentSettings.variableHint')}
              </p>
              {envVars.map((envVar) => (
                <motion.div
                  key={envVar.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  {/* Enable/Disable Switch */}
                  <div className="flex items-center">
                    <Switch
                      checked={envVar.enabled}
                      onCheckedChange={(checked) => updateEnvVar(envVar.id, "enabled", checked)}
                      title={envVar.enabled ? t('environmentSettings.disableVariable') : t('environmentSettings.enableVariable')}
                      className="scale-75"
                    />
                  </div>
                  
                  <Input
                    placeholder="KEY"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(envVar.id, "key", e.target.value)}
                    className={`flex-1 font-mono text-sm ${!envVar.enabled ? 'opacity-50' : ''}`}
                    disabled={!envVar.enabled}
                  />
                  <span className={`text-muted-foreground ${!envVar.enabled ? 'opacity-50' : ''}`}>=</span>
                  <Input
                    placeholder="value"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(envVar.id, "value", e.target.value)}
                    className={`flex-1 font-mono text-sm ${!envVar.enabled ? 'opacity-50' : ''}`}
                    disabled={!envVar.enabled}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEnvVar(envVar.id)}
                    className="h-8 w-8 hover:text-destructive"
                    aria-label={t('environmentSettings.deleteVariable')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </motion.div>
              ))}
            </>
          )}
        </div>
        
        <div className="pt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>{t('environmentSettings.commonVariables')}</strong>
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
            <li>- <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">CLAUDE_CODE_ENABLE_TELEMETRY</code> - {t('environmentSettings.varTelemetry')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">ANTHROPIC_MODEL</code> - {t('environmentSettings.varModel')}</li>
            <li>- <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">DISABLE_COST_WARNINGS</code> - {t('environmentSettings.varCostWarnings')}</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};