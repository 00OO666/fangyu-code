/**
 * 代理商列表组件 - 简化版（移除拖拽排序）
 */

import type { UnifiedProviderConfig } from "../../types/provider";
import { ProviderItem } from "./ProviderItem";

interface ProviderListProps {
  providers: UnifiedProviderConfig[];
  activeProviderId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onEdit: (id: string, updates: Partial<UnifiedProviderConfig>) => Promise<void>;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onModelSelect?: (providerId: string, modelId: string) => void;
}

export function ProviderList({
  providers,
  activeProviderId,
  onSelect,
  onEdit,
  onDelete,
  onTest,
  onModelSelect,
}: ProviderListProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <ProviderItem
          key={provider.id}
          provider={provider}
          isActive={provider.id === activeProviderId}
          onSelect={() => onSelect(provider.id)}
          onEdit={(updates) => onEdit(provider.id, updates)}
          onTest={() => onTest(provider.id)}
          onDelete={() => onDelete(provider.id)}
          onModelSelect={
            onModelSelect ? (modelId) => onModelSelect(provider.id, modelId) : undefined
          }
        />
      ))}
    </div>
  );
}

export default ProviderList;
