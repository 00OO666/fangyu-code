import { logger } from "@/lib/logger";

// Keep storage/event wiring in one place so different UI surfaces stay in sync.
const DUAL_API_STORAGE_KEY = "enable_dual_api_enhancement";
const DUAL_API_TOGGLE_EVENT = "dual-api-enhancement-toggle";

export function getDualApiEnhancementEnabled(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const saved = localStorage.getItem(DUAL_API_STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch (error) {
    logger.warn(
      "contextExtractionToggle",
      "[DualAPI] Failed to read enable_dual_api_enhancement from localStorage:",
      error
    );
  }

  // Default OFF: avoid surprising behavior changes unless the user explicitly opts in.
  return false;
}

export function setDualApiEnhancementEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DUAL_API_STORAGE_KEY, String(enabled));
    }
  } catch (error) {
    logger.warn(
      "contextExtractionToggle",
      "[DualAPI] Failed to persist enable_dual_api_enhancement to localStorage:",
      error
    );
  }

  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DUAL_API_TOGGLE_EVENT, { detail: { enabled } }));
    }
  } catch (error) {
    logger.warn("contextExtractionToggle", "[DualAPI] Failed to dispatch toggle event:", error);
  }
}

export function subscribeDualApiEnhancementToggle(
  handler: (enabled: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (evt: Event) => {
    const enabled = (evt as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
    if (typeof enabled === "boolean") handler(enabled);
  };

  window.addEventListener(DUAL_API_TOGGLE_EVENT, listener as EventListener);
  return () => window.removeEventListener(DUAL_API_TOGGLE_EVENT, listener as EventListener);
}

