import { useCallback, useMemo, useReducer } from "react";

export interface DependencyStatus {
  nodejs: {
    installed: boolean;
    version?: string;
    meetsRequirement: boolean;
  };
  npm: {
    installed: boolean;
    version?: string;
  };
  cli: {
    installed: boolean;
    version?: string;
    path?: string;
  };
}

export type DependencyPhase = "IDLE" | "CHECKING" | "INSTALLING" | "ERROR" | "DONE";

export interface StateContext {
  dependencies: DependencyStatus | null;
  error: string | null;
  logs: string[];
  retryCount: number;
  maxRetries: number;
  skipped: boolean;
  requiresCli: boolean;
}

export interface DependencyState {
  phase: DependencyPhase;
  context: StateContext;
}

export interface UseDependencyStateMachineOptions {
  maxRetries?: number;
  requiresCli?: boolean;
}

export type DependencyAction =
  | { type: "RESET" }
  | { type: "START_CHECK" }
  | { type: "CHECK_SUCCESS"; payload: { dependencies: DependencyStatus } }
  | { type: "CHECK_FAILURE"; payload: { error: string } }
  | { type: "START_INSTALL" }
  | { type: "INSTALL_SUCCESS"; payload?: { dependencies?: DependencyStatus } }
  | { type: "INSTALL_FAILURE"; payload: { error: string } }
  | { type: "RETRY_INSTALL" }
  | { type: "MANUAL_RETRY" }
  | { type: "SKIP_INSTALL" }
  | { type: "APPEND_LOG"; payload: { message: string } }
  | { type: "CLEAR_LOGS" };

const DEFAULT_MAX_RETRIES = 2;
const MAX_LOG_ENTRIES = 200;

const createInitialState = (options?: UseDependencyStateMachineOptions): DependencyState => {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const requiresCli = options?.requiresCli ?? true;

  return {
    phase: "IDLE",
    context: {
      dependencies: null,
      error: null,
      logs: [],
      retryCount: 0,
      maxRetries,
      skipped: false,
      requiresCli,
    },
  };
};

const hasInstallPrereqs = (dependencies: DependencyStatus | null): boolean => {
  if (!dependencies) return false;
  return (
    dependencies.nodejs.installed &&
    dependencies.nodejs.meetsRequirement &&
    dependencies.npm.installed
  );
};

export const isDependenciesSatisfied = (
  dependencies: DependencyStatus | null,
  requiresCli: boolean
): boolean => {
  if (!dependencies) return false;

  const nodeOk = dependencies.nodejs.installed && dependencies.nodejs.meetsRequirement;
  const npmOk = dependencies.npm.installed;
  const cliOk = !requiresCli || dependencies.cli.installed;

  return nodeOk && npmOk && cliOk;
};

export const dependencyReducer = (
  state: DependencyState,
  action: DependencyAction
): DependencyState => {
  switch (action.type) {
    case "RESET":
      return {
        phase: "IDLE",
        context: {
          ...state.context,
          dependencies: null,
          error: null,
          logs: [],
          retryCount: 0,
          skipped: false,
        },
      };
    case "START_CHECK":
      return {
        phase: "CHECKING",
        context: {
          ...state.context,
          error: null,
          logs: [],
          retryCount: 0,
          skipped: false,
        },
      };
    case "CHECK_SUCCESS": {
      const dependencies = action.payload.dependencies;
      const shouldInstall =
        state.context.requiresCli && hasInstallPrereqs(dependencies) && !dependencies.cli.installed;

      return {
        phase: shouldInstall ? "INSTALLING" : "DONE",
        context: {
          ...state.context,
          dependencies,
          error: null,
          retryCount: 0,
          skipped: false,
        },
      };
    }
    case "CHECK_FAILURE":
      return {
        phase: "ERROR",
        context: {
          ...state.context,
          error: action.payload.error,
          retryCount: 0,
        },
      };
    case "START_INSTALL":
      return {
        phase: "INSTALLING",
        context: {
          ...state.context,
          error: null,
          skipped: false,
        },
      };
    case "INSTALL_SUCCESS": {
      const nextDependencies = action.payload?.dependencies ?? state.context.dependencies;

      return {
        phase: "DONE",
        context: {
          ...state.context,
          dependencies: nextDependencies ?? state.context.dependencies,
          error: null,
          retryCount: 0,
        },
      };
    }
    case "INSTALL_FAILURE":
      return {
        phase: "ERROR",
        context: {
          ...state.context,
          error: action.payload.error,
        },
      };
    case "RETRY_INSTALL": {
      if (state.context.retryCount >= state.context.maxRetries) {
        return state;
      }

      return {
        phase: "INSTALLING",
        context: {
          ...state.context,
          error: null,
          retryCount: state.context.retryCount + 1,
          skipped: false,
        },
      };
    }
    case "MANUAL_RETRY":
      return {
        phase: "INSTALLING",
        context: {
          ...state.context,
          error: null,
          retryCount: 0,
          skipped: false,
        },
      };
    case "SKIP_INSTALL":
      return {
        phase: "DONE",
        context: {
          ...state.context,
          error: null,
          skipped: true,
        },
      };
    case "APPEND_LOG":
      if (!action.payload.message.trim()) {
        return state;
      }

      if (
        state.context.logs.length > 0 &&
        state.context.logs[state.context.logs.length - 1] === action.payload.message
      ) {
        return state;
      }

      return {
        phase: state.phase,
        context: {
          ...state.context,
          logs: [...state.context.logs.slice(-MAX_LOG_ENTRIES + 1), action.payload.message],
        },
      };
    case "CLEAR_LOGS":
      return {
        phase: state.phase,
        context: {
          ...state.context,
          logs: [],
        },
      };
    default:
      return state;
  }
};

export const useDependencyStateMachine = (options?: UseDependencyStateMachineOptions) => {
  const [state, dispatch] = useReducer(dependencyReducer, options, createInitialState);

  const startCheck = useCallback(() => {
    dispatch({ type: "START_CHECK" });
  }, []);

  const checkSuccess = useCallback((dependencies: DependencyStatus) => {
    dispatch({ type: "CHECK_SUCCESS", payload: { dependencies } });
  }, []);

  const checkFailure = useCallback((error: string) => {
    dispatch({ type: "CHECK_FAILURE", payload: { error } });
  }, []);

  const startInstall = useCallback(() => {
    dispatch({ type: "START_INSTALL" });
  }, []);

  const installSuccess = useCallback((dependencies?: DependencyStatus) => {
    dispatch({ type: "INSTALL_SUCCESS", payload: { dependencies } });
  }, []);

  const installFailure = useCallback((error: string) => {
    dispatch({ type: "INSTALL_FAILURE", payload: { error } });
  }, []);

  const retryInstall = useCallback(() => {
    dispatch({ type: "RETRY_INSTALL" });
  }, []);

  const manualRetry = useCallback(() => {
    dispatch({ type: "MANUAL_RETRY" });
  }, []);

  const skipInstall = useCallback(() => {
    dispatch({ type: "SKIP_INSTALL" });
  }, []);

  const appendLog = useCallback((message: string) => {
    dispatch({ type: "APPEND_LOG", payload: { message } });
  }, []);

  const clearLogs = useCallback(() => {
    dispatch({ type: "CLEAR_LOGS" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const canRetry = state.context.retryCount < state.context.maxRetries;

  const actionHandlers = useMemo(
    () => ({
      startCheck,
      checkSuccess,
      checkFailure,
      startInstall,
      installSuccess,
      installFailure,
      retryInstall,
      manualRetry,
      skipInstall,
      appendLog,
      clearLogs,
      reset,
    }),
    [
      appendLog,
      checkFailure,
      checkSuccess,
      clearLogs,
      installFailure,
      installSuccess,
      manualRetry,
      reset,
      retryInstall,
      skipInstall,
      startCheck,
      startInstall,
    ]
  );

  return {
    state,
    actions: actionHandlers,
    canRetry,
    isIdle: state.phase === "IDLE",
    isChecking: state.phase === "CHECKING",
    isInstalling: state.phase === "INSTALLING",
    isError: state.phase === "ERROR",
    isDone: state.phase === "DONE",
  };
};
