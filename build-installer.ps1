# Fangyu Code 构建安装包脚本
# 一键生成可安装的 .exe 文件

Write-Host "🎨 Fangyu Code 构建脚本" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

# 添加 Rust 到 PATH
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# 检查环境
Write-Host "📦 检查环境..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Node.js" -ForegroundColor Red
    pause
    exit 1
}

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Rust" -ForegroundColor Red
    Write-Host "   请重启终端以加载 Rust 环境变量" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green
Write-Host "✅ Rust: $(rustc --version)" -ForegroundColor Green
Write-Host ""

# 设置工作目录
Set-Location "F:\Any-Code-Dev"

# 构建前端
Write-Host "📦 构建前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 前端构建完成" -ForegroundColor Green
Write-Host ""

# 构建 Tauri 应用
Write-Host "🦀 构建 Rust 后端..." -ForegroundColor Yellow
Write-Host "   首次编译需要 10-20 分钟，请耐心等待..." -ForegroundColor Cyan
Write-Host ""

npx tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 构建失败" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "✅ 构建成功！" -ForegroundColor Green
Write-Host ""

# 查找生成的安装包
$installerPath = Get-ChildItem "F:\Any-Code-Dev\src-tauri\target\release\bundle\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installerPath) {
    $size = [math]::Round($installerPath.Length / 1MB, 2)
    Write-Host "📦 安装包位置:" -ForegroundColor Cyan
    Write-Host "   $($installerPath.FullName)" -ForegroundColor White
    Write-Host "   大小: $size MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🎉 下一步:" -ForegroundColor Yellow
    Write-Host "   1. 双击安装包进行安装" -ForegroundColor White
    Write-Host "   2. 安装后桌面会有 'Fangyu Code' 快捷方式" -ForegroundColor White
    Write-Host "   3. 和原版 Any-Code 可以同时安装，互不影响" -ForegroundColor White
    Write-Host ""

    # 询问是否立即打开安装包所在文件夹
    $openFolder = Read-Host "是否打开安装包所在文件夹? (Y/N)"
    if ($openFolder -eq 'Y' -or $openFolder -eq 'y') {
        explorer.exe "/select,`"$($installerPath.FullName)`""
    }
} else {
    Write-Host "⚠️ 未找到安装包，请检查构建日志" -ForegroundColor Yellow
}

Write-Host ""
pause
