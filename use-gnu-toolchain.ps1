# 使用 Rust GNU 工具链（不需要 Visual Studio）
# 这是一个快速替代方案

Write-Host "🦀 切换到 Rust GNU 工具链" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "   优点: 无需 Visual Studio，安装更快" -ForegroundColor Gray
Write-Host "   缺点: 生成的 exe 可能稍大" -ForegroundColor Gray
Write-Host ""

# 添加 Rust 到 PATH
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# 检查当前工具链
Write-Host "📦 当前 Rust 工具链:" -ForegroundColor Yellow
rustup show

Write-Host ""
Write-Host "📥 安装 GNU 工具链..." -ForegroundColor Yellow

# 安装 stable-x86_64-pc-windows-gnu
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu

Write-Host "✅ 已切换到 GNU 工具链" -ForegroundColor Green
Write-Host ""
Write-Host "📝 下一步:" -ForegroundColor Cyan
Write-Host "   运行构建脚本: .\build-installer.ps1" -ForegroundColor White
Write-Host ""

pause
