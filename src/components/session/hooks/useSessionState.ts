/**
 * Session State Management Hook
 *
 * 使用 useReducer 替代 40+ useState，统一管理会话状态
 */

import { useReducer, Dispatch } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";
import type { Session } from "@/lib/api";
import type { TranslationResult } from "@/lib/translationMiddleware";
import type { CodexRateLimits } from "@/types/codex";

// ============================================================================
// State Types
// ============================================================================

export interface SessionState {
  // Session Info
  projectPath: string;
  claudeSessionId: string | null;
  effectiveSession: Session | null;
  extractedSessionInfo: { sessionId: string; projectId: string; engine?: string } | null;

  // Messages
  messages: ClaudeStreamMessage[];
  rawJsonlOutput: string[];

  // UI State
  isLoading: boolean;
  error: string | null;
  showCanvas: boolean;
  showUsageDashboard: boolean;
  showMCPConfig: boolean;

  // Translation
  lastTranslationResult: TranslationResult | null;

  // Codex
  codexRateLimits: CodexRateLimits | null;

  // Flags
  isFirstPrompt: boolean;
  userScrolled: boolean;
  shouldAutoScroll: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

export type SessionAction =
  | { type: "SET_PROJECT_PATH"; payload: string }
  | { type: "SET_SESSION_ID"; payload: string | null }
  | { type: "SET_EFFECTIVE_SESSION"; payload: Session | null }
  | { type: "SET_EXTRACTED_SESSION_INFO"; payload: SessionState["extractedSessionInfo"] }
  | { type: "SET_MESSAGES"; payload: ClaudeStreamMessage[] }
  | { type: "ADD_MESSAGE"; payload: ClaudeStreamMessage }
  | { type: "SET_RAW_JSONL"; payload: string[] }
  | { type: "ADD_RAW_JSONL"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "TOGGLE_CANVAS" }
  | { type: "TOGGLE_USAGE_DASHBOARD" }
  | { type: "TOGGLE_MCP_CONFIG" }
  | { type: "SET_TRANSLATION_RESULT"; payload: TranslationResult | null }
  | { type: "SET_CODEX_RATE_LIMITS"; payload: CodexRateLimits | null }
  | { type: "SET_IS_FIRST_PROMPT"; payload: boolean }
  | { type: "SET_USER_SCROLLED"; payload: boolean }
  | { type: "SET_SHOULD_AUTO_SCROLL"; payload: boolean }
  | { type: "RESET_SESSION" };

// ============================================================================
// Reducer
// ============================================================================

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "SET_PROJECT_PATH":
      return { ...state, projectPath: action.payload };

    case "SET_SESSION_ID":
      return { ...state, claudeSessionId: action.payload };

    case "SET_EFFECTIVE_SESSION":
      return { ...state, effectiveSession: action.payload };

    case "SET_EXTRACTED_SESSION_INFO":
      return { ...state, extractedSessionInfo: action.payload };

    case "SET_MESSAGES":
      return { ...state, messages: action.payload };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };

    case "SET_RAW_JSONL":
      return { ...state, rawJsonlOutput: action.payload };

    case "ADD_RAW_JSONL":
      return { ...state, rawJsonlOutput: [...state.rawJsonlOutput, action.payload] };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "TOGGLE_CANVAS":
      return { ...state, showCanvas: !state.showCanvas };

    case "TOGGLE_USAGE_DASHBOARD":
      return { ...state, showUsageDashboard: !state.showUsageDashboard };

    case "TOGGLE_MCP_CONFIG":
      return { ...state, showMCPConfig: !state.showMCPConfig };

    case "SET_TRANSLATION_RESULT":
      return { ...state, lastTranslationResult: action.payload };

    case "SET_CODEX_RATE_LIMITS":
      return { ...state, codexRateLimits: action.payload };

    case "SET_IS_FIRST_PROMPT":
      return { ...state, isFirstPrompt: action.payload };

    case "SET_USER_SCROLLED":
      return { ...state, userScrolled: action.payload };

    case "SET_SHOULD_AUTO_SCROLL":
      return { ...state, shouldAutoScroll: action.payload };

    case "RESET_SESSION":
      return {
        ...state,
        messages: [],
        rawJsonlOutput: [],
        isLoading: false,
        error: null,
        isFirstPrompt: true,
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSessionStateReturn {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
}

export function useSessionState(initialProjectPath: string = ""): UseSessionStateReturn {
  const [state, dispatch] = useReducer(sessionReducer, {
    projectPath: initialProjectPath,
    claudeSessionId: null,
    effectiveSession: null,
    extractedSessionInfo: null,
    messages: [],
    rawJsonlOutput: [],
    isLoading: false,
    error: null,
    showCanvas: false,
    showUsageDashboard: false,
    showMCPConfig: false,
    lastTranslationResult: null,
    codexRateLimits: null,
    isFirstPrompt: true,
    userScrolled: false,
    shouldAutoScroll: true,
  });

  return { state, dispatch };
}
