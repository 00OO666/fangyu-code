# Fangyu Code 本地构建并发布到 GitHub Release
# 用法: .\scripts\local-release.ps1 -Version "1.3.0"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始本地构建并发布 Fangyu Code v$Version" -ForegroundColor Cyan
Write-Host ""

# 1. 检查工作目录
Write-Host "📁 检查工作目录..." -ForegroundColor Yellow
if (-not (Test-Path ".\src-tauri\tauri.conf.json")) {
    Write-Host "❌ 错误：请在项目根目录执行此脚本" -ForegroundColor Red
    exit 1
}

# 2. 检查是否有未提交的更改
Write-Host "🔍 检查 Git 状态..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  警告：有未提交的更改，是否继续？(y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne 'y') {
        Write-Host "❌ 取消发布" -ForegroundColor Red
        exit 1
    }
}

# 3. 检查签名密钥
Write-Host "🔑 检查签名密钥..." -ForegroundColor Yellow
$keyPath = "$env:USERPROFILE\.tauri\fangyu-code.key"
if (-not (Test-Path $keyPath)) {
    Write-Host "❌ 错误：签名密钥不存在: $keyPath" -ForegroundColor Red
    exit 1
}

# 4. 清理旧的构建产物
Write-Host "🧹 清理旧构建产物..." -ForegroundColor Yellow
if (Test-Path ".\src-tauri\target\release\bundle") {
    Remove-Item ".\src-tauri\target\release\bundle" -Recurse -Force
}

# 5. 开始构建
Write-Host ""
Write-Host "🔨 开始构建（预计 6 分钟）..." -ForegroundColor Green
Write-Host ""
$buildStart = Get-Date

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

pnpm tauri build --target x86_64-pc-windows-msvc

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}

$buildEnd = Get-Date
$buildDuration = ($buildEnd - $buildStart).TotalMinutes
Write-Host ""
Write-Host "✅ 构建完成！用时: $([math]::Round($buildDuration, 1)) 分钟" -ForegroundColor Green

# 6. 检查构建产物
Write-Host ""
Write-Host "📦 检查构建产物..." -ForegroundColor Yellow
$bundleDir = ".\src-tauri\target\release\bundle\nsis"
$exeFile = Get-ChildItem "$bundleDir\*.exe" | Where-Object { $_.Name -notlike "*-setup.nsis.exe" } | Select-Object -First 1
$sigFile = "$($exeFile.FullName).sig"

if (-not $exeFile) {
    Write-Host "❌ 错误：找不到安装包" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $sigFile)) {
    Write-Host "❌ 错误：找不到签名文件" -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ 安装包: $($exeFile.Name)" -ForegroundColor Green
Write-Host "  ✅ 签名文件: $(Split-Path $sigFile -Leaf)" -ForegroundColor Green

# 7. 生成 latest.json
Write-Host ""
Write-Host "📝 生成 latest.json..." -ForegroundColor Yellow
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$signature = Get-Content $sigFile -Raw

$latestJson = @{
    version = $Version
    notes = "## 🎉 Fangyu Code v$Version`n`n详见 [CHANGELOG.md](https://github.com/00OO666/fangyu-code/blob/main/CHANGELOG.md)"
    pub_date = $timestamp
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature.Trim()
            url = "https://github.com/00OO666/fangyu-code/releases/download/v$Version/$($exeFile.Name)"
        }
    }
} | ConvertTo-Json -Depth 10

$latestJsonPath = "$bundleDir\latest.json"
$latestJson | Out-File -FilePath $latestJsonPath -Encoding UTF8
Write-Host "  ✅ latest.json 已生成" -ForegroundColor Green

# 8. 创建 Git 标签
Write-Host ""
Write-Host "🏷️  创建 Git 标签..." -ForegroundColor Yellow
git tag -d "v$Version" 2>$null
git tag "v$Version"
Write-Host "  ✅ 标签 v$Version 已创建" -ForegroundColor Green

# 9. 推送代码和标签
Write-Host ""
Write-Host "⬆️  推送到 GitHub..." -ForegroundColor Yellow
git push origin main
git push origin "v$Version"
Write-Host "  ✅ 代码和标签已推送" -ForegroundColor Green

# 10. 创建 GitHub Release
Write-Host ""
Write-Host "📢 创建 GitHub Release..." -ForegroundColor Yellow
$releaseBody = @"
## 🎉 Fangyu Code v$Version

### 安装方式

1. **首次安装**：下载 `$($exeFile.Name)` 并运行
2. **自动更新**：已安装用户会自动收到更新提示

### 更新内容

详见 [CHANGELOG.md](https://github.com/00OO666/fangyu-code/blob/main/CHANGELOG.md)

---

**构建信息**：
- 构建时间: $buildDuration 分钟
- 构建方式: 本地构建 + 自动发布
"@

gh release create "v$Version" `
    --repo 00OO666/fangyu-code `
    --title "Fangyu Code v$Version" `
    --notes $releaseBody `
    "$($exeFile.FullName)" `
    "$sigFile" `
    "$latestJsonPath"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 创建 Release 失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 发布成功！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 发布信息:" -ForegroundColor Cyan
Write-Host "  版本: v$Version" -ForegroundColor White
Write-Host "  构建用时: $([math]::Round($buildDuration, 1)) 分钟" -ForegroundColor White
Write-Host "  Release: https://github.com/00OO666/fangyu-code/releases/tag/v$Version" -ForegroundColor White
Write-Host ""
Write-Host "✅ 用户现在可以自动收到更新提示！" -ForegroundColor Green
