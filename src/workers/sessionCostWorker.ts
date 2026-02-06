import { calculatePromptCostSummary } from "@/lib/promptCostCalculator";
import type { PromptCostSummary } from "@/lib/promptCostTypes";
import type { ClaudeStreamMessage } from "@/types/claude";

interface SessionCostWorkerRequest {
  type: "recompute";
  sessionKey: string;
  fingerprint?: string;
  messages: ClaudeStreamMessage[];
}

interface SessionCostWorkerResponse {
  type: "result";
  sessionKey: string;
  fingerprint?: string;
  cached: boolean;
  summary: PromptCostSummary;
}

const cache = new Map<
  string,
  {
    fingerprint?: string;
    summary: PromptCostSummary;
  }
>();

self.onmessage = (event: MessageEvent<SessionCostWorkerRequest>) => {
  const payload = event.data;
  if (payload.type !== "recompute") return;

  const { sessionKey, fingerprint, messages } = payload;
  const cached = cache.get(sessionKey);

  if (cached && fingerprint && cached.fingerprint === fingerprint) {
    const response: SessionCostWorkerResponse = {
      type: "result",
      sessionKey,
      fingerprint,
      cached: true,
      summary: cached.summary,
    };
    self.postMessage(response);
    return;
  }

  const summary = calculatePromptCostSummary(messages);
  cache.set(sessionKey, { fingerprint, summary });

  const response: SessionCostWorkerResponse = {
    type: "result",
    sessionKey,
    fingerprint,
    cached: false,
    summary,
  };
  self.postMessage(response);
};
