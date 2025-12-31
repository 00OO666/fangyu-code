# 加载 .env.local 中的环境变量
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
            Write-Host "Loaded: $key"
        }
    }
} else {
    Write-Host "Warning: .env.local not found"
}

# 执行构建
Write-Host "`nBuilding Tauri application..."
npm run tauri:build-ci -- $args
