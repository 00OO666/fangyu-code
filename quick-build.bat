@echo off
cd /d F:\Any-Code-Dev

echo ========================================
echo    Fangyu Code 构建脚本
echo ========================================
echo.

REM 添加 Rust 到 PATH
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo 检查环境...
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Rust，请重启电脑
    pause
    exit /b 1
)

echo [OK] Rust 已安装
echo.

echo 正在构建...
echo 提示: 首次编译需要 10-20 分钟
echo.

npx tauri build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    构建成功！
    echo ========================================
    echo.
    echo 安装包位置:
    dir /b F:\Any-Code-Dev\src-tauri\target\release\bundle\nsis\*.exe
    echo.
    echo 按任意键打开安装包所在文件夹...
    pause >nul
    explorer /select,"F:\Any-Code-Dev\src-tauri\target\release\bundle\nsis"
) else (
    echo.
    echo [错误] 构建失败
    pause
)
