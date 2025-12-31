@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   Fangyu Code 本地构建并发布
echo ========================================
echo.

REM 检查 PowerShell 版本
where pwsh >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    pwsh -ExecutionPolicy Bypass -File ".\scripts\local-release.ps1" %*
) else (
    powershell -ExecutionPolicy Bypass -File ".\scripts\local-release.ps1" %*
)

pause
