@echo off
chcp 65001 >nul
echo ========================================
echo Git Push 多方案切换工具
echo ========================================
echo.
echo 当前可用方案：
echo [1] HTTP 代理方式 (origin)
echo [2] SSH 方式 (origin-ssh)
echo [3] 修改代理端口
echo [4] 取消代理
echo [5] 测试连接
echo [0] 退出
echo.
set /p choice="请选择方案 (0-5): "

if "%choice%"=="1" goto http_push
if "%choice%"=="2" goto ssh_push
if "%choice%"=="3" goto change_proxy
if "%choice%"=="4" goto disable_proxy
if "%choice%"=="5" goto test_connection
if "%choice%"=="0" exit
goto end

:http_push
echo.
echo [方案1] 使用 HTTP 代理推送...
git push origin
goto end

:ssh_push
echo.
echo [方案2] 使用 SSH 推送...
echo 注意：需要先添加 SSH key 到 GitHub
git push origin-ssh
goto end

:change_proxy
echo.
echo 当前代理: 127.0.0.1:7890
set /p port="输入新的代理端口 (如 1080, 10809): "
git config --global http.proxy http://127.0.0.1:%port%
git config --global https.proxy http://127.0.0.1:%port%
echo ✓ 代理已更改为 127.0.0.1:%port%
pause
goto end

:disable_proxy
echo.
echo 取消 Git 代理...
git config --global --unset http.proxy
git config --global --unset https.proxy
echo ✓ 代理已取消
pause
goto end

:test_connection
echo.
echo 测试 GitHub 连接...
echo.
echo [测试 HTTP]
git ls-remote https://github.com/00OO666/fangyu-code.git HEAD
echo.
echo [测试 SSH]
ssh -T git@github.com
pause
goto end

:end
echo.
pause
