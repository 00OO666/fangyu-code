@echo off
REM 启动 Kiro 并让它走 Fiddler 代理
REM Fiddler 默认监听 127.0.0.1:8888

set HTTP_PROXY=http://127.0.0.1:8888
set HTTPS_PROXY=http://127.0.0.1:8888
set NODE_TLS_REJECT_UNAUTHORIZED=0

echo Starting Kiro with Fiddler proxy...
echo HTTP_PROXY=%HTTP_PROXY%
echo HTTPS_PROXY=%HTTPS_PROXY%

REM 修改为你的 Kiro 安装路径
start "" "C:\Users\666\AppData\Local\Programs\Kiro\Kiro.exe"

echo Kiro started. Check Fiddler for traffic.
pause
