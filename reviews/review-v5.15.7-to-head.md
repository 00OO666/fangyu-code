# Review: v5.15.7..HEAD

Scope: local commits after tag v5.15.7 (11 commits).

Findings:
- HIGH: Global claude-complete payload changed to {tab_id,payload} but some listeners still expect boolean; refresh logic will stop firing.
  - src/hooks/useGlobalEvents.ts
  - src/components/layout/ViewRouter.tsx
  - src-tauri/src/commands/claude/cli_runner.rs
- MEDIUM: Cancel before session_id is known no longer kills the process because ClaudeProcessState no longer stores child; fallback cancel will not find a handle.
  - src-tauri/src/commands/claude/cli_runner.rs
- LOW: updateTabEngine creates a placeholder Session with empty id and ms timestamp; tooltip may show empty id and a far-future date.
  - src/hooks/useTabs.tsx
  - src/components/TabManager.tsx

Notes:
- Consider adding tests for event payload shape changes and early cancellation behavior.
