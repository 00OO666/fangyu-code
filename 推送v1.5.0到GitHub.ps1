# ===================================================
# Fangyu Code v1.5.0 一键推送脚本
# ===================================================
# 使用方法：右键 -> "使用 PowerShell 运行"
# 或在终端执行：powershell -ExecutionPolicy Bypass -File "推送v1.5.0到GitHub.ps1"
# ===================================================

Set-Location "F:\Any-Code-Dev"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fangyu Code v1.5.0 推送到 GitHub" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Git 状态
Write-Host "[1/4] 检查 Git 状态..." -ForegroundColor Green
git status --short
Write-Host ""

# 2. 确认本地提交和标签
Write-Host "[2/4] 确认本地提交和标签..." -ForegroundColor Green
Write-Host "  最新提交: " -NoNewline
git log -1 --format="%C(yellow)%h%Creset %s"
Write-Host "  本地标签: " -NoNewline
git tag -l v1.5.0
Write-Host ""

# 3. 推送代码到 main 分支
Write-Host "[3/4] 推送代码到 main 分支..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 推送失败！可能的原因：" -ForegroundColor Red
    Write-Host "  1. 网络连接问题（无法访问 github.com:443）" -ForegroundColor Yellow
    Write-Host "  2. 需要配置代理（运行下面的代理配置命令）" -ForegroundColor Yellow
    Write-Host "  3. 需要开启 VPN" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 代理配置示例（根据你的代理端口调整）：" -ForegroundColor Cyan
    Write-Host "  git config --global http.proxy http://127.0.0.1:7890" -ForegroundColor White
    Write-Host "  git config --global https.proxy http://127.0.0.1:7890" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 配置完成后重新运行此脚本" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "✅ main 分支推送成功" -ForegroundColor Green
Write-Host ""

# 4. 推送 v1.5.0 标签（触发 GitHub Actions 自动构建）
Write-Host "[4/4] 推送 v1.5.0 标签（触发自动构建）..." -ForegroundColor Green
git push origin v1.5.0

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 标签推送失败" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "✅ v1.5.0 标签推送成功" -ForegroundColor Green
Write-Host ""

# 5. 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✨ 推送完成！GitHub Actions 已触发" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 GitHub Actions 将自动：" -ForegroundColor Cyan
Write-Host "  1. 构建 Tauri 应用（约 5-10 分钟）" -ForegroundColor White
Write-Host "  2. 生成安装包和便携版" -ForegroundColor White
Write-Host "  3. 创建 GitHub Release v1.5.0" -ForegroundColor White
Write-Host "  4. 上传更新文件（latest.json + setup.exe）" -ForegroundColor White
Write-Host ""
Write-Host "🔗 查看构建进度：" -ForegroundColor Cyan
Write-Host "  https://github.com/00OO666/fangyu-code/actions" -ForegroundColor Blue
Write-Host ""
Write-Host "🎉 Release 页面：" -ForegroundColor Cyan
Write-Host "  https://github.com/00OO666/fangyu-code/releases/tag/v1.5.0" -ForegroundColor Blue
Write-Host ""

Read-Host "按 Enter 键退出"
