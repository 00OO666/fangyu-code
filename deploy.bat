@echo off
echo ========================================
echo Fangyu Code 部署脚本
echo ========================================
echo.
echo 正在复制最新构建...
echo.

REM 复制 exe 文件
copy /Y "F:\Any-Code-Dev\src-tauri\target\release\fangyu-code.exe" "F:\软件\一级重要软件\Fangyu Code\fangyu-code.exe"

if %errorlevel% == 0 (
    echo.
    echo ✓ 部署成功！
    echo.
    echo 可以启动 Fangyu Code 测试新功能
) else (
    echo.
    echo ✗ 部署失败！请确保：
    echo   1. Fangyu Code 已关闭
    echo   2. 没有其他进程占用文件
    echo.
)

pause
