import React from "react";
import { Card } from "@/components/ui/card";
import { HooksEditor } from "../HooksEditor";
import { useTranslation } from "@/hooks/useTranslation";

interface HooksSettingsProps {
  activeTab: string;
  setUserHooksChanged: (changed: boolean) => void;
  getUserHooks: React.MutableRefObject<(() => any) | null>;
}

export const HooksSettings: React.FC<HooksSettingsProps> = ({
  activeTab,
  setUserHooksChanged,
  getUserHooks
}) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold mb-2">{t('hooks.userHooks')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('hooks.userHooksDescription')}
            <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code>
          </p>
        </div>
        
        <HooksEditor
          key={activeTab}
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