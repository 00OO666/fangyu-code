import { ModelType, ThinkingMode } from "./types";

export interface InputState {
  prompt: string;
  selectedModel: ModelType;
  selectedThinkingMode: ThinkingMode;
  isExpanded: boolean;
  showCostPopover: boolean;
  cursorPosition: number;
  enableProjectContext: boolean;
}

export type InputAction =
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_MODEL"; payload: ModelType }
  | { type: "SET_THINKING_MODE"; payload: ThinkingMode }
  | { type: "SET_EXPANDED"; payload: boolean }
  | { type: "SET_SHOW_COST_POPOVER"; payload: boolean }
  | { type: "SET_CURSOR_POSITION"; payload: number }
  | { type: "SET_ENABLE_PROJECT_CONTEXT"; payload: boolean }
  | { type: "RESET_INPUT" };

export const initialState: InputState = {
  prompt: "",
  selectedModel: "sonnet",
  selectedThinkingMode: "on",
  isExpanded: false,
  showCostPopover: false,
  cursorPosition: 0,
  enableProjectContext: false,
};

export function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case "SET_PROMPT":
      return { ...state, prompt: action.payload };
    case "SET_MODEL":
      return { ...state, selectedModel: action.payload };
    case "SET_THINKING_MODE":
      return { ...state, selectedThinkingMode: action.payload };
    case "SET_EXPANDED":
      return { ...state, isExpanded: action.payload };
    case "SET_SHOW_COST_POPOVER":
      return { ...state, showCostPopover: action.payload };
    case "SET_CURSOR_POSITION":
      return { ...state, cursorPosition: action.payload };
    case "SET_ENABLE_PROJECT_CONTEXT":
      return { ...state, enableProjectContext: action.payload };
    case "RESET_INPUT":
      return { ...state, prompt: "", isExpanded: false };
    default:
      return state;
  }
}