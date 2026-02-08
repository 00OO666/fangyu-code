/**
 * useWindowAttention - 窗口注意力检测
 *
 * 功能:
 * - 检测窗口是否可见
 * - 检测窗口是否被节流
 * - 提供窗口状态信息
 */

import { useEffect, useState, useRef } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface WindowAttentionState {
  isVisible: boolean;
  isThrottled: boolean;
  isFocused: boolean;
  lastHeartbeat: number;
  throttleLevel: "none" | "light" | "heavy";
}

export function useWindowAttention() {
  const [state, setState] = useState<WindowAttentionState>({
    isVisible: !document.hidden,
    isThrottled: false,
    isFocused: document.hasFocus(),
    lastHeartbeat: Date.now(),
    throttleLevel: "none",
  });

  const workerRef = useRef<Worker | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const windowIdRef = useRef<string>("");

  useEffect(() => {
    const initWindowId = async () => {
      const window = getCurrentWebviewWindow();
      windowIdRef.current = window.label;
    };
    initWindowId();

    workerRef.current = new Worker(
      new URL("../workers/windowHeartbeat.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current.postMessage({
      type: "START",
      payload: {
        interval: 1000,
        windowId: windowIdRef.current,
      },
    });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === "HEARTBEAT") {
        const now = Date.now();
        const delay = now - lastHeartbeatRef.current;
        lastHeartbeatRef.current = now;

        let throttleLevel: "none" | "light" | "heavy" = "none";
        if (delay > 2000) {
          throttleLevel = "heavy";
        } else if (delay > 1500) {
          throttleLevel = "light";
        }

        setState((prev) => ({
          ...prev,
          lastHeartbeat: now,
          isThrottled: throttleLevel !== "none",
          throttleLevel,
        }));
      }
    };

    const handleVisibilityChange = () => {
      setState((prev) => ({
        ...prev,
        isVisible: !document.hidden,
      }));
    };

    const handleFocus = () => {
      setState((prev) => ({ ...prev, isFocused: true }));
    };

    const handleBlur = () => {
      setState((prev) => ({ ...prev, isFocused: false }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      workerRef.current?.postMessage({ type: "STOP" });
      workerRef.current?.terminate();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return state;
}
