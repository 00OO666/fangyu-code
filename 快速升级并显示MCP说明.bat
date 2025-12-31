@echo off
chcp 65001 >nul
echo ========================================
echo  Fangyu Code MCP 面板增强 + P2 任务完成
echo ========================================
echo.

cd /d "F:\Any-Code-Dev"

echo [1/2] 构建项目...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ 构建失败！
    pause
    exit /b 1
)

echo.
echo [2/2] 构建 Rust 后端...
cd src-tauri
cargo build --release

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Rust 构建失败！
    cd ..
    pause
    exit /b 1
)

echo.
echo ========================================
echo  ✅ 升级完成！
echo ========================================
echo.
echo 新功能：
echo  - MCP 工具说明显示（用途、使用场景）
echo  - WebSocket 实时通信
echo  - 智能代码补全（基础）
echo.
echo 双击 "E:\Desktop\快速更新Fangyu Code.bat" 部署
echo.
pause
