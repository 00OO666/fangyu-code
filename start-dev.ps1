# Fangyu Code 开发模式启动脚本
# 自动处理环境变量和依赖检查

Write-Host "🚀 正在启动 Fangyu Code 开发模式..." -ForegroundColor Cyan
Write-Host ""

# 设置位置
Set-Location "F:\Any-Code-Dev"

# 检查 Node.js
Write-Host "📦 检查环境..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Node.js" -ForegroundColor Red
    pause
    exit 1
}

# 强制添加 Rust 到 PATH（放在最前面以确保优先级）
$rustPath = "$env:USERPROFILE\.cargo\bin"
if (Test-Path $rustPath) {
    $env:Path = "$rustPath;$env:Path"
    Write-Host "✅ 已添加 Rust 到 PATH" -ForegroundColor Green
}

# 验证 Rust
$rustVersion = rustc --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Rust: $rustVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Rust 未正确安装" -ForegroundColor Red
    Write-Host "   请重新打开终端或重启电脑以加载 Rust 环境变量" -ForegroundColor Yellow
    pause
    exit 1
}

# 检查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "📥 正在安装依赖..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "✨ 启动中..." -ForegroundColor Green
Write-Host "   提示: 首次启动需要编译 Rust 代码，可能需要 5-10 分钟" -ForegroundColor Cyan
Write-Host "   编译完成后会自动弹出应用窗口" -ForegroundColor Cyan
Write-Host ""

# 启动开发服务器
npm run tauri:dev
