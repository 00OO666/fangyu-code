param(
    [string]$Target = "x86_64-pc-windows-msvc",
    [switch]$SkipSigning,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $repoRoot

try {
    if (-not (Test-Path ".\\src-tauri\\tauri.conf.json")) {
        throw "请在项目根目录执行 build.ps1"
    }

    if (-not $SkipSigning) {
        $keyPath = Join-Path $env:USERPROFILE ".tauri\\fangyu-code.key"
        if (-not (Test-Path $keyPath)) {
            throw "找不到签名私钥: $keyPath。若只想本地测试，请使用 -SkipSigning。"
        }

        $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
        if (-not (Test-Path Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD)) {
            $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
        }

        Write-Host "Using updater signing key from $keyPath" -ForegroundColor Cyan
    }

    $tauriArgs = @("tauri", "build", "--target", $Target)
    if ($ExtraArgs) {
        $tauriArgs += $ExtraArgs
    }

    & npx @tauriArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
