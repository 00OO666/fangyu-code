@echo off
echo Starting Claude Workbench with debug logging...
echo.
echo Backend logs will show:
echo - [INFO] Recording prompt sent
echo - [INFO] Auto-committed changes
echo - [INFO] Reverting to prompt
echo - [DEBUG] Line scanning details
echo.
echo Log level config:
echo - Default: debug
echo - Codex/Claude/Gemini output: trace (hidden by default)
echo.
REM Fine-grained log configuration:
REM - Default level: debug
REM - Suppress high-frequency output logs from codex/claude/gemini sessions
REM - Use RUST_LOG=trace to see everything including raw output
set RUST_LOG=debug,claude_workbench::commands::codex::session=info,claude_workbench::commands::claude::cli_runner=info,claude_workbench::commands::gemini::session=info
npm run tauri dev

