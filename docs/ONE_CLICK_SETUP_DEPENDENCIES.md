# OneClickSetup 依赖检测与安装

> 更新日期: 2026-02-05

## 概述

本模块为“三引擎一键配置”提供统一的依赖检测与自动安装流程，核心目标是：

- 统一依赖检测逻辑（Node.js / npm / CLI）
- 自动安装 CLI（全局优先，本地兜底）
- 状态机驱动 UI，支持自动重试与跳过

## 核心文件

- `src/hooks/useDependencyStateMachine.ts`
- `src/lib/cliInstaller.ts`
- `src/components/EngineConfigPanel/OneClickSetup/DependencyChecker.tsx`
- `src/components/EngineConfigPanel/OneClickSetup/StateViews.tsx`

## 状态机 Hook

`useDependencyStateMachine` 负责状态流转与重试控制。

状态流转：

```
IDLE -> CHECKING -> (INSTALLING) -> DONE
                   -> ERROR -> (RETRY) -> INSTALLING
                   -> DONE (skip)
```

关键点：

- `CHECK_SUCCESS`：当满足 Node.js + npm 且 CLI 未安装时进入 `INSTALLING`
- `RETRY_INSTALL`：自动重试时递增 `retryCount`
- `MANUAL_RETRY`：手动重试时重置 `retryCount`
- `SKIP_INSTALL`：跳过安装，进入 `DONE`

辅助函数：

- `isDependenciesSatisfied(deps, requiresCli)`：判断是否满足继续配置的最低条件

## CLI 安装器

`cliInstaller` 负责执行安装命令与验证版本。

安装策略：

1. 全局安装 `npm install -g <package>`
2. 失败则自动降级本地安装 `npm install <package>`
3. 安装完成尝试验证版本，失败则返回警告

示例：

```ts
const result = await installCli('claude', {
  onProgress: (progress) => console.log(progress.message),
});
```

`CliInstallResult` 包含：

- `success` / `scope` / `version`
- `logs` / `error` / `detail`
- `manualGlobalInstallSuggested`

## DependencyChecker

`DependencyChecker` 是 UI 层入口组件，职责包括：

- 自动检测 Node.js / npm / CLI
- CLI 缺失时自动触发安装
- 错误时显示重试与跳过
- 成功时展示依赖清单和提示

## State Views

`StateViews.tsx` 统一管理状态视图：

- `CheckingView`：检测中
- `InstallingView`：安装中 + 实时日志
- `ErrorView`：错误提示 + 重试/跳过按钮
- `DoneView`：依赖清单 + 成功提示

## 重试机制

- 自动重试最多 2 次
- 达到上限后展示“手动重试”
- “跳过”会进入 `DONE`，允许继续向导流程

## 测试

相关测试：

- `src/hooks/useDependencyStateMachine.test.ts`
- `src/lib/cliInstaller.test.ts`
- `src/components/EngineConfigPanel/OneClickSetup/DependencyChecker.integration.test.tsx`
- `src/tests/e2e/engine-setup.e2e.test.tsx`

运行命令：

```bash
npm test -- src/hooks/useDependencyStateMachine.test.ts \
  src/lib/cliInstaller.test.ts \
  src/components/EngineConfigPanel/OneClickSetup/DependencyChecker.integration.test.tsx \
  src/tests/e2e/engine-setup.e2e.test.tsx
```
