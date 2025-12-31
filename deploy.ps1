# ========================================
# Fangyu Code 自动化部署脚本
# ========================================
# 功能：
# 1. 自动读取 package.json 版本号
# 2. 清理旧版本安装包（只保留最新）
# 3. 自动安装最新版本
# 4. 清除图标缓存
# 5. 重建桌面快捷方式
# ========================================

param(
    [switch]$SkipBuild,      # 跳过构建，只部署
    [switch]$SkipInstall,    # 跳过自动安装
    [switch]$KeepOldVersions # 保留旧版本安装包
)

$ErrorActionPreference = "Stop"

# ========================================
# 1. 读取版本号
# ========================================
Write-Host "`n========== 检查版本号 ==========" -ForegroundColor Cyan

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "当前版本: v$version" -ForegroundColor Green

# ========================================
# 2. 关闭现有进程
# ========================================
Write-Host "`n========== 关闭现有进程 ==========" -ForegroundColor Cyan

Get-Process | Where-Object {$_.Name -like '*fangyu*'} | ForEach-Object {
    Write-Host "关闭进程: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep 2

# ========================================
# 3. 构建项目（可选）
# ========================================
if (-not $SkipBuild) {
    Write-Host "`n========== 构建项目 ==========" -ForegroundColor Cyan

    Write-Host "构建前端..."
    npm run build

    Write-Host "`n构建 Tauri..."
    npm run tauri build

    Write-Host "✅ 构建完成" -ForegroundColor Green
} else {
    Write-Host "`n⏭️  跳过构建" -ForegroundColor Yellow
}

# ========================================
# 4. 定位最新安装包
# ========================================
Write-Host "`n========== 定位安装包 ==========" -ForegroundColor Cyan

$nsisDir = "src-tauri\target\release\bundle\nsis"
$installerPattern = "Fangyu Code_${version}_x64-setup.exe"
$installerPath = Join-Path $nsisDir $installerPattern

if (-not (Test-Path $installerPath)) {
    Write-Host "❌ 未找到安装包: $installerPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 找到安装包: $installerPattern" -ForegroundColor Green
$installerSize = (Get-Item $installerPath).Length / 1MB
Write-Host "   大小: $([math]::Round($installerSize, 2)) MB"

# ========================================
# 5. 部署到目标目录
# ========================================
Write-Host "`n========== 部署文件 ==========" -ForegroundColor Cyan

$deployDir = "F:\软件\一级重要软件\Fangyu Code"

# 复制 exe
$exeSrc = "src-tauri\target\release\fangyu-code.exe"
$exeDst = Join-Path $deployDir "fangyu-code.exe"
Copy-Item $exeSrc $exeDst -Force
Write-Host "✅ 已复制 exe → $exeDst" -ForegroundColor Green

# 复制安装包（使用固定名称 latest）
$installerDst = Join-Path $deployDir "Fangyu-Code-latest-setup.exe"
Copy-Item $installerPath $installerDst -Force
Write-Host "✅ 已复制安装包 → $installerDst" -ForegroundColor Green

# 可选：清理旧版本
if (-not $KeepOldVersions) {
    Write-Host "`n清理旧版本安装包..."
    Get-ChildItem $deployDir -Filter "Fangyu Code_*_x64-setup.exe" | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem $deployDir -Filter "Fangyu-Code-v*-setup.exe" | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "✅ 旧版本已清理" -ForegroundColor Green
}

# ========================================
# 6. 安装最新版本（可选）
# ========================================
if (-not $SkipInstall) {
    Write-Host "`n========== 安装最新版本 ==========" -ForegroundColor Cyan

    Write-Host "运行安装程序..."
    Start-Process $installerDst -Wait

    Write-Host "✅ 安装完成" -ForegroundColor Green
} else {
    Write-Host "`n⏭️  跳过自动安装" -ForegroundColor Yellow
    Write-Host "请手动运行: $installerDst"
}

# ========================================
# 7. 清除图标缓存
# ========================================
Write-Host "`n========== 清除图标缓存 ==========" -ForegroundColor Cyan

ie4uinit.exe -show | Out-Null
taskkill /IM explorer.exe /F | Out-Null
Start-Sleep 1

Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*" -Force -ErrorAction SilentlyContinue

Start-Process explorer.exe
Start-Sleep 3

Write-Host "✅ 图标缓存已清除" -ForegroundColor Green

# ========================================
# 8. 重建桌面快捷方式
# ========================================
Write-Host "`n========== 重建快捷方式 ==========" -ForegroundColor Cyan

$desktopPath = "E:\Desktop\Fangyu Code.lnk"
Remove-Item $desktopPath -Force -ErrorAction SilentlyContinue

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($desktopPath)
$Shortcut.TargetPath = $exeDst
$Shortcut.WorkingDirectory = $deployDir
$Shortcut.IconLocation = "$exeDst,0"
$Shortcut.Description = "Fangyu Code v$version"
$Shortcut.Save()

Write-Host "✅ 快捷方式已创建: $desktopPath" -ForegroundColor Green

# ========================================
# 9. 完成
# ========================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "🎉 部署完成！v$version" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n安装包位置: $installerDst"
Write-Host "可执行文件: $exeDst"
Write-Host "桌面快捷方式: $desktopPath"
Write-Host ""
