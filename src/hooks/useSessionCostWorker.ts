import { useEffect, useMemo, useRef, useState } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { PromptCostSummary } from "@/lib/promptCostTypes";

const EMPTY_SUMMARY: PromptCostSummary = {
  items: [],
  promptsTotalCost: 0,
  sessionTotalCost: 0,
  sessionTotals: {
    totalCost: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
};

interface UseSessionCostWorkerOptions {
  messages: ClaudeStreamMessage[];
  sessionId?: string | null;
  projectPath?: string | null;
}

export function useSessionCostWorker({
  messages,
  sessionId,
  projectPath,
}: UseSessionCostWorkerOptions) {
  const [summary, setSummary] = useState<PromptCostSummary>(EMPTY_SUMMARY);
  const workerRef = useRef<Worker | null>(null);
  const sessionKeyRef = useRef<string>("");

  const sessionKey = useMemo(() => {
    if (sessionId) return `session:${sessionId}`;
    if (projectPath) return `project:${projectPath}`;
    return "session:unknown";
  }, [sessionId, projectPath]);

  const fingerprint = useMemo(() => {
    if (messages.length === 0) {
      return "len:0";
    }
    const lastMessages = messages.slice(-5);
    const signal = lastMessages
      .map((msg) => {
        const cost =
          (msg as any).costUSD ??
          (msg as any).totalCostUSD ??
          (msg as any).cost_usd ??
          (msg as any).total_cost_usd ??
          0;
        const id = (msg as any)?.message?.id || (msg as any).id || (msg as any).uuid || "unknown";
        return `${id}:${cost}`;
      })
      .join("|");
    return `len:${messages.length}|${signal}`;
  }, [messages]);

  useEffect(() => {
    sessionKeyRef.current = sessionKey;
    setSummary(EMPTY_SUMMARY);
  }, [sessionKey]);

  useEffect(() => {
    if (workerRef.current) return;

    workerRef.current = new Worker(new URL("../workers/sessionCostWorker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event) => {
      const payload = event.data as {
        type: string;
        sessionKey: string;
        summary: PromptCostSummary;
      };

      if (payload.type !== "result") return;
      if (payload.sessionKey !== sessionKeyRef.current) return;
      setSummary(payload.summary);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: "recompute",
      sessionKey,
      fingerprint,
      messages,
    });
  }, [messages, sessionKey, fingerprint]);

  return { summary };
}
