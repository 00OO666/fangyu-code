/**
 * useDependencyStateMachine Hook 单元测试
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDependencyStateMachine,
  isDependenciesSatisfied,
  type DependencyStatus,
} from "./useDependencyStateMachine";

const baseDependencies: DependencyStatus = {
  nodejs: { installed: true, version: "v18.0.0", meetsRequirement: true },
  npm: { installed: true, version: "9.0.0" },
  cli: { installed: true, version: "1.0.0" },
};

const withCliInstalled = (installed: boolean): DependencyStatus => ({
  ...baseDependencies,
  cli: { ...baseDependencies.cli, installed },
});

describe("useDependencyStateMachine", () => {
  it("should start in IDLE state", () => {
    const { result } = renderHook(() => useDependencyStateMachine());

    expect(result.current.state.phase).toBe("IDLE");
    expect(result.current.state.context.dependencies).toBeNull();
    expect(result.current.state.context.retryCount).toBe(0);
    expect(result.current.state.context.maxRetries).toBe(2);
    expect(result.current.state.context.requiresCli).toBe(true);
  });

  it("should transition to DONE when dependencies are satisfied", () => {
    const { result } = renderHook(() => useDependencyStateMachine());

    act(() => {
      result.current.actions.startCheck();
    });

    act(() => {
      result.current.actions.checkSuccess(baseDependencies);
    });

    expect(result.current.state.phase).toBe("DONE");
    expect(result.current.state.context.dependencies?.cli.installed).toBe(true);
  });

  it("should transition to INSTALLING when CLI is missing but prerequisites are ok", () => {
    const { result } = renderHook(() => useDependencyStateMachine());

    act(() => {
      result.current.actions.startCheck();
    });

    act(() => {
      result.current.actions.checkSuccess(withCliInstalled(false));
    });

    expect(result.current.state.phase).toBe("INSTALLING");
  });

  it("should remain DONE when prerequisites are not met", () => {
    const { result } = renderHook(() => useDependencyStateMachine());
    const invalidDeps: DependencyStatus = {
      ...baseDependencies,
      nodejs: { installed: false, meetsRequirement: false },
    };

    act(() => {
      result.current.actions.checkSuccess(invalidDeps);
    });

    expect(result.current.state.phase).toBe("DONE");
    expect(isDependenciesSatisfied(invalidDeps, true)).toBe(false);
  });

  it("should retry install until max retries and allow manual retry reset", () => {
    const { result } = renderHook(() => useDependencyStateMachine({ maxRetries: 2 }));

    act(() => {
      result.current.actions.checkSuccess(withCliInstalled(false));
    });

    act(() => {
      result.current.actions.installFailure("fail");
    });

    act(() => {
      result.current.actions.retryInstall();
    });
    expect(result.current.state.phase).toBe("INSTALLING");
    expect(result.current.state.context.retryCount).toBe(1);

    act(() => {
      result.current.actions.installFailure("fail again");
    });

    act(() => {
      result.current.actions.retryInstall();
    });
    expect(result.current.state.context.retryCount).toBe(2);

    act(() => {
      result.current.actions.installFailure("fail again");
    });

    act(() => {
      result.current.actions.retryInstall();
    });
    expect(result.current.state.phase).toBe("ERROR");
    expect(result.current.state.context.retryCount).toBe(2);

    act(() => {
      result.current.actions.manualRetry();
    });
    expect(result.current.state.phase).toBe("INSTALLING");
    expect(result.current.state.context.retryCount).toBe(0);
  });

  it("should allow skipping installation", () => {
    const { result } = renderHook(() => useDependencyStateMachine());

    act(() => {
      result.current.actions.skipInstall();
    });

    expect(result.current.state.phase).toBe("DONE");
    expect(result.current.state.context.skipped).toBe(true);
  });
});
