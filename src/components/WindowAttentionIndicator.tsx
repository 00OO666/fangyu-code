/**
 * WindowAttentionIndicator - 窗口注意力状态指示器
 *
 * 显示当前窗口的注意力状态（可见性、节流级别）
 */

import { useWindowAttention } from "@/hooks/useWindowAttention";

export function WindowAttentionIndicator() {
  const state = useWindowAttention();

  // 只在有问题时显示（不可见、节流），正常状态不显示
  if (state.isVisible && state.throttleLevel === "none") {
    return null;
  }

  const getStatusColor = () => {
    if (!state.isVisible) return "bg-red-500";
    if (state.throttleLevel === "heavy") return "bg-orange-500";
    if (state.throttleLevel === "light") return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusText = () => {
    if (!state.isVisible) return "窗口不可见";
    if (state.throttleLevel === "heavy") return "严重节流";
    if (state.throttleLevel === "light") return "轻度节流";
    return "正常";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-xs text-white backdrop-blur-sm">
      <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
      <span>{getStatusText()}</span>
    </div>
  );
}
