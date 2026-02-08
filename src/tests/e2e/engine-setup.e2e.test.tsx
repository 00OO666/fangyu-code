/**
 * E2E Tests: Engine Setup
 * 覆盖依赖检测、自动安装、失败场景
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SetupWizard } from "@/components/EngineConfigPanel/OneClickSetup/SetupWizard";
import { DependencyChecker } from "@/components/EngineConfigPanel/OneClickSetup/DependencyChecker";
import { executeCommand, type CommandResult } from "@/core/tauri/SuperAgentBridge";

vi.mock("@/core/tauri/SuperAgentBridge", () => ({
  executeCommand: vi.fn(),
}));

const successResult = (stdout: string): CommandResult => ({
  success: true,
  stdout,
  stderr: "",
  duration_ms: 5,
});

const failureResult = (stderr: string): CommandResult => ({
  success: false,
  stdout: "",
  stderr,
  duration_ms: 5,
});

describe("E2E: Engine Setup", () => {
  const executeCommandMock = vi.mocked(executeCommand);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should complete setup flow when CLI is already installed", async () => {
    executeCommandMock
      .mockResolvedValueOnce(successResult("v18.0.0"))
      .mockResolvedValueOnce(successResult("9.0.0"))
      .mockResolvedValueOnce(successResult("1.0.0"));

    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const stepTitles = ["检查环境", "安装 CLI", "配置 API", "验证安装", "选择模型"];

    render(<SetupWizard engine="claude" onComplete={onComplete} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText("环境检测通过，可以继续配置")).toBeTruthy();
    });

    for (let i = 0; i < stepTitles.length - 1; i += 1) {
      const nextButton = screen.getByRole("button", { name: "下一步" });
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: stepTitles[i + 1] })).toBeTruthy();
      });
    }

    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("should auto install CLI with global fallback to local", async () => {
    executeCommandMock
      .mockResolvedValueOnce(successResult("v18.0.0"))
      .mockResolvedValueOnce(successResult("9.0.0"))
      .mockResolvedValueOnce(failureResult("not found"))
      .mockResolvedValueOnce(failureResult("EACCES"))
      .mockResolvedValueOnce(successResult("local install ok"))
      .mockResolvedValueOnce(successResult("1.0.1"))
      .mockResolvedValueOnce(successResult("1.0.1"));

    const onCheckComplete = vi.fn();

    render(<DependencyChecker engine="claude" onCheckComplete={onCheckComplete} />);

    await waitFor(() => {
      const lastCall = onCheckComplete.mock.calls.at(-1)?.[0];
      expect(lastCall?.cli.installed).toBe(true);
    });

    expect(screen.getByText("环境检测通过，可以继续配置")).toBeTruthy();
  });

  it("should surface installation failure after retries", async () => {
    executeCommandMock
      .mockResolvedValueOnce(successResult("v18.0.0"))
      .mockResolvedValueOnce(successResult("9.0.0"))
      .mockResolvedValueOnce(failureResult("not found"))
      .mockResolvedValueOnce(failureResult("EACCES"))
      .mockResolvedValueOnce(failureResult("ENOENT"))
      .mockResolvedValueOnce(failureResult("EACCES"))
      .mockResolvedValueOnce(failureResult("ENOENT"))
      .mockResolvedValueOnce(failureResult("EACCES"))
      .mockResolvedValueOnce(failureResult("ENOENT"));

    const onCheckComplete = vi.fn();

    render(<DependencyChecker engine="claude" onCheckComplete={onCheckComplete} />);

    await waitFor(() => {
      expect(screen.getByText("手动重试")).toBeTruthy();
    });

    expect(screen.getAllByText(/安装 Claude Code 失败/).length).toBeGreaterThan(0);
    expect(screen.getByText("跳过")).toBeTruthy();
  });
});
