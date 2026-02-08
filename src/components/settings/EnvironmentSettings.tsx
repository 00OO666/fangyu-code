import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { EngineSelector } from "./EngineSelector";
import { EngineType, ENGINE_INFO } from "@/types/multiEngineSettings";

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
  /** 当前选中的引擎（多引擎模式） */
  selectedEngine?: EngineType;
  /** 引擎切换回调（多引擎模式） */
  onEngineChange?: (engine: EngineType) => void;
  /** 是否显示引擎选择器 */
  showEngineSelector?: boolean;
}

/** 引擎特定的常用环境变量提示 */
const ENGINE_ENV_HINTS: Record<EngineType, { key: string; desc: string }[]> = {
  claude: [
    { key: "ANTHROPIC_API_KEY", desc: "Anthropic API 密钥" },
    { key: "ANTHROPIC_BASE_URL", desc: "API 代理地址" },
    { key: "MAX_THINKING_TOKENS", desc: "最大思考 Token 数" },
    { key: "CLAUDE_CODE_ENABLE_TELEMETRY", desc: "启用遥测" },
  ],
  codex: [
    { key: "OPENAI_API_KEY", desc: "OpenAI API 密钥" },
    { key: "OPENAI_BASE_URL", desc: "API 代理地址" },
    { key: "OPENAI_MODEL", desc: "默认模型" },
  ],
  gemini: [
    { key: "GOOGLE_API_KEY", desc: "Google API 密钥" },
    { key: "GOOGLE_BASE_URL", desc: "API 代理地址" },
    { key: "GEMINI_MODEL", desc: "默认模型" },
  ],
};

export const EnvironmentSettings: React.FC<EnvironmentSettingsProps> = ({
  envVars,
  addEnvVar,
  updateEnvVar,
  removeEnvVar,
  selectedEngine = "claude",
  onEngineChange,
  showEngineSelector = false,
}) => {
  const { t } = useTranslation();
  const engineInfo = ENGINE_INFO[selectedEngine];
  const envHints = ENGINE_ENV_HINTS[selectedEngine];

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* 引擎选择器 */}
        {showEngineSelector && onEngineChange && (
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="text-sm text-muted-foreground">
              配置 <span className="font-medium text-foreground">{engineInfo.name}</span> 的环境变量
            </div>
            <EngineSelector
              selectedEngine={selectedEngine}
              onEngineChange={onEngineChange}
              size="sm"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("environmentSettings.title")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("environmentSettings.subtitle")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addEnvVar} className="gap-2">
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("environmentSettings.addVariable")}
          </Button>
        </div>

        <div className="space-y-3">
          {envVars.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {t("environmentSettings.noVariables")}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {t("environmentSettings.variableHint")}
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
                      title={
                        envVar.enabled
                          ? t("environmentSettings.disableVariable")
                          : t("environmentSettings.enableVariable")
                      }
                      className="scale-75"
                    />
                  </div>

                  <Input
                    placeholder="KEY"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(envVar.id, "key", e.target.value)}
                    className={`flex-1 font-mono text-sm ${!envVar.enabled ? "opacity-50" : ""}`}
                    disabled={!envVar.enabled}
                  />
                  <span className={`text-muted-foreground ${!envVar.enabled ? "opacity-50" : ""}`}>
                    =
                  </span>
                  <Input
                    placeholder="value"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(envVar.id, "value", e.target.value)}
                    className={`flex-1 font-mono text-sm ${!envVar.enabled ? "opacity-50" : ""}`}
                    disabled={!envVar.enabled}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEnvVar(envVar.id)}
                    className="h-8 w-8 hover:text-destructive"
                    aria-label={t("environmentSettings.deleteVariable")}
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
            <strong>{engineInfo.shortName} 常用变量</strong>
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
            {envHints.map((hint) => (
              <li key={hint.key}>
                -{" "}
                <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {hint.key}
                </code>{" "}
                - {hint.desc}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};
