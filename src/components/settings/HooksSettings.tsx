import React from "react";
import { Card } from "@/components/ui/card";
import { HooksEditor } from "../HooksEditor";
import { useTranslation } from "@/hooks/useTranslation";
import { EngineSelector } from "./EngineSelector";
import { EngineType, ENGINE_INFO } from "@/types/multiEngineSettings";

interface HooksSettingsProps {
  activeTab: string;
  setUserHooksChanged: (changed: boolean) => void;
  getUserHooks: React.MutableRefObject<(() => any) | null>;
  /** 当前选中的引擎（多引擎模式） */
  selectedEngine?: EngineType;
  /** 引擎切换回调（多引擎模式） */
  onEngineChange?: (engine: EngineType) => void;
  /** 是否显示引擎选择器 */
  showEngineSelector?: boolean;
}

export const HooksSettings: React.FC<HooksSettingsProps> = ({
  activeTab,
  setUserHooksChanged,
  getUserHooks,
  selectedEngine = 'claude-code',
  onEngineChange,
  showEngineSelector = false,
}) => {
  const { t } = useTranslation();
  const engineInfo = ENGINE_INFO[selectedEngine];

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* 引擎选择器 */}
        {showEngineSelector && onEngineChange && (
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="text-sm text-muted-foreground">
              配置 <span className="font-medium text-foreground">{engineInfo.name}</span> 的钩子
            </div>
            <EngineSelector
              selectedEngine={selectedEngine}
              onEngineChange={onEngineChange}
              size="sm"
            />
          </div>
        )}

        <div>
          <h3 className="text-base font-semibold mb-2">{t('hooks.userHooks')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('hooks.userHooksDescription')}
            <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code>
          </p>
        </div>

        <HooksEditor
          key={`${activeTab}-${selectedEngine}`}
          scope="user"
          className="border-0"
          hideActions={true}
          onChange={(hasChanges, getHooks) => {
            setUserHooksChanged(hasChanges);
            getUserHooks.current = getHooks;
          }}
        />
      </div>
    </Card>
  );
};