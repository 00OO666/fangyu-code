# Kiro 抓包启动脚本
# 使用前确保 Fiddler 已启动并监听 8888 端口

Write-Host "=== Kiro 抓包模式 ===" -ForegroundColor Cyan
Write-Host ""

# 检查 Fiddler 是否在运行
$fiddler = Get-Process -Name "Fiddler*" -ErrorAction SilentlyContinue
if (-not $fiddler) {
    Write-Host "[警告] Fiddler 未运行！请先启动 Fiddler" -ForegroundColor Yellow
    Write-Host "下载地址: https://www.telerik.com/download/fiddler" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "是否继续启动 Kiro？(y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

# 设置代理环境变量
$env:HTTP_PROXY = 'http://127.0.0.1:8888'
$env:HTTPS_PROXY = 'http://127.0.0.1:8888'
$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'

Write-Host "[√] 代理已设置: http://127.0.0.1:8888" -ForegroundColor Green
Write-Host "[√] SSL 验证已禁用" -ForegroundColor Green
Write-Host ""

# 关闭现有 Kiro 进程
$kiro = Get-Process -Name "Kiro" -ErrorAction SilentlyContinue
if ($kiro) {
    Write-Host "[!] 正在关闭现有 Kiro 进程..." -ForegroundColor Yellow
    Stop-Process -Name "Kiro" -Force
    Start-Sleep -Seconds 2
}

# 启动 Kiro
$kiroPath = 'F:\软件\一级重要软件\Kiro\Kiro.exe'
Write-Host "[>] 正在启动 Kiro..." -ForegroundColor Cyan
Start-Process -FilePath $kiroPath

Write-Host ""
Write-Host "=== 抓包提示 ===" -ForegroundColor Cyan
Write-Host "1. 在 Kiro 中发送一条消息"
Write-Host "2. 在 Fiddler 中查找 bedrock-runtime.*.amazonaws.com 请求"
Write-Host "3. 查看 Authorization 头的认证方式"
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
