# ===================================================
# Git 代理配置脚本
# ===================================================
# 使用方法：
# 1. 打开 PowerShell，运行：
#    powershell -ExecutionPolicy Bypass -File "配置Git代理.ps1"
# 2. 输入你的代理地址和端口
# ===================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Git 代理配置工具" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  请输入你的代理信息：" -ForegroundColor Yellow
Write-Host ""

Write-Host "常见代理端口：" -ForegroundColor Gray
Write-Host "  - Clash: 7890 (HTTP) / 7891 (SOCKS5)" -ForegroundColor Gray
Write-Host "  - V2Ray: 10809 (SOCKS5)" -ForegroundColor Gray
Write-Host "  - Shadowsocks: 1080 (SOCKS5)" -ForegroundColor Gray
Write-Host "  - Proxifier: 8888" -ForegroundColor Gray
Write-Host ""

$proxyHost = Read-Host "代理地址 (默认: 127.0.0.1)"
if ([string]::IsNullOrWhiteSpace($proxyHost)) {
    $proxyHost = "127.0.0.1"
}

$proxyPort = Read-Host "代理端口 (例: 7890)"
if ([string]::IsNullOrWhiteSpace($proxyPort)) {
    Write-Host "❌ 端口不能为空" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

$proxyUrl = "http://${proxyHost}:${proxyPort}"

Write-Host ""
Write-Host "配置代理信息：" -ForegroundColor Green
Write-Host "  HTTP Proxy:  $proxyUrl" -ForegroundColor White
Write-Host "  HTTPS Proxy: $proxyUrl" -ForegroundColor White
Write-Host ""

Write-Host "正在配置..." -ForegroundColor Green

# 配置全局代理
git config --global http.proxy $proxyUrl
git config --global https.proxy $proxyUrl

# 验证配置
Write-Host ""
Write-Host "✅ 代理配置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "当前配置：" -ForegroundColor Cyan
git config --global --get http.proxy  | ForEach-Object { Write-Host "  http.proxy: $_" -ForegroundColor White }
git config --global --get https.proxy | ForEach-Object { Write-Host "  https.proxy: $_" -ForegroundColor White }
Write-Host ""

Write-Host "📋 接下来的步骤：" -ForegroundColor Yellow
Write-Host "  1. 关闭所有代理程序（Clash/V2Ray 等）" -ForegroundColor White
Write-Host "  2. 运行推送脚本：推送v1.5.0到GitHub.ps1" -ForegroundColor White
Write-Host ""

Write-Host "❌ 如果还是无法连接，可以尝试：" -ForegroundColor Yellow
Write-Host "  1. 更换代理工具或代理节点" -ForegroundColor White
Write-Host "  2. 手动检查代理是否正在运行" -ForegroundColor White
Write-Host "  3. 测试代理连接：curl -x $proxyUrl https://github.com" -ForegroundColor White
Write-Host ""

Write-Host "🔧 查看 Git 代理配置文件：" -ForegroundColor Cyan
Write-Host "  cat ~/.gitconfig" -ForegroundColor Gray
Write-Host ""

Write-Host "✂️  删除代理配置（恢复默认）：" -ForegroundColor Cyan
Write-Host "  git config --global --unset http.proxy" -ForegroundColor Gray
Write-Host "  git config --global --unset https.proxy" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 键退出"
