param(
    [switch]$SkipBuild,
    [switch]$SkipInstall,
    [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $repoRoot

try {
    if (-not $SkipBuild) {
        & pwsh -File ".\\build.ps1" -Target $Target
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    $bundleDir = Join-Path $repoRoot "src-tauri\\target\\$Target\\release\\bundle\\nsis"
    $installer = Get-ChildItem $bundleDir -Filter "*-setup.exe" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $installer) {
        throw "找不到 NSIS 安装包: $bundleDir"
    }

    Write-Host "Installer ready: $($installer.FullName)" -ForegroundColor Green

    if ($SkipInstall) {
        return
    }

    Start-Process -FilePath $installer.FullName -Wait
}
finally {
    Pop-Location
}
