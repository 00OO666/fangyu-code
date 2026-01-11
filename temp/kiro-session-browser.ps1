# Kiro 会话浏览器 v1.0
# 用于查看和搜索 Kiro 聊天记录（解决 History 面板不显示的问题）

param(
    [string]$Workspace = "ZjpcRmFuZ3l1LUNvZGUtRGV2",  # 默认 Fangyu-Code-Dev
    [string]$Search = "",
    [switch]$ListAll,
    [string]$SessionId = ""
)

$baseDir = "$env:APPDATA\Kiro\User\globalStorage\kiro.kiroagent\workspace-sessions"

# 列出所有工作区
function List-Workspaces {
    Write-Host "`n=== 可用工作区 ===" -ForegroundColor Cyan
    Get-ChildItem -Path $baseDir -Directory | ForEach-Object {
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_.Name.Replace('_', '/')))
        Write-Host "  $($_.Name) -> $decoded" -ForegroundColor Yellow
    }
}

# 列出工作区的所有会话
function List-Sessions {
    param([string]$ws)
    $sessionsFile = "$baseDir\$ws\sessions.json"
    if (-not (Test-Path $sessionsFile)) {
        Write-Host "工作区不存在: $ws" -ForegroundColor Red
        return
    }
    
    $sessions = Get-Content -Path $sessionsFile -Raw | ConvertFrom-Json
    Write-Host "`n=== 会话列表 ($($sessions.Count) 个) ===" -ForegroundColor Cyan
    
    $sessions | Sort-Object -Property dateCreated -Descending | ForEach-Object {
        $date = [DateTimeOffset]::FromUnixTimeMilliseconds($_.dateCreated).LocalDateTime.ToString("yyyy-MM-dd HH:mm")
        $title = $_.title.Substring(0, [Math]::Min(60, $_.title.Length))
        Write-Host "[$date] $title" -ForegroundColor Green
        Write-Host "  ID: $($_.sessionId)" -ForegroundColor DarkGray
    }
}

# 搜索会话内容
function Search-Sessions {
    param([string]$ws, [string]$keyword)
    $sessionsFile = "$baseDir\$ws\sessions.json"
    $sessions = Get-Content -Path $sessionsFile -Raw | ConvertFrom-Json
    
    Write-Host "`n=== 搜索: '$keyword' ===" -ForegroundColor Cyan
    $found = 0
    
    foreach ($session in $sessions) {
        $sessionFile = "$baseDir\$ws\$($session.sessionId).json"
        if (Test-Path $sessionFile) {
            $content = Get-Content -Path $sessionFile -Raw
            if ($content -match $keyword) {
                $found++
                $date = [DateTimeOffset]::FromUnixTimeMilliseconds($session.dateCreated).LocalDateTime.ToString("yyyy-MM-dd HH:mm")
                Write-Host "`n[$date] $($session.title)" -ForegroundColor Green
                Write-Host "  ID: $($session.sessionId)" -ForegroundColor Yellow
            }
        }
    }
    Write-Host "`n找到 $found 个匹配的会话" -ForegroundColor Cyan
}

# 查看单个会话内容
function View-Session {
    param([string]$ws, [string]$id)
    $sessionFile = "$baseDir\$ws\$id.json"
    if (-not (Test-Path $sessionFile)) {
        Write-Host "会话不存在: $id" -ForegroundColor Red
        return
    }
    
    $session = Get-Content -Path $sessionFile -Raw | ConvertFrom-Json
    Write-Host "`n=== 会话内容 ===" -ForegroundColor Cyan
    Write-Host "标题: $($session.title)" -ForegroundColor Yellow
    Write-Host "消息数: $($session.history.Count)" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($msg in $session.history) {
        $role = $msg.message.role
        $color = if ($role -eq "user") { "Green" } else { "Cyan" }
        Write-Host "[$role]" -ForegroundColor $color
        
        if ($msg.message.content -is [string]) {
            Write-Host $msg.message.content.Substring(0, [Math]::Min(500, $msg.message.content.Length))
        } elseif ($msg.message.content -is [array]) {
            foreach ($part in $msg.message.content) {
                if ($part.text) {
                    Write-Host $part.text.Substring(0, [Math]::Min(500, $part.text.Length))
                }
            }
        }
        Write-Host ""
    }
}

# 主逻辑
if ($ListAll) {
    List-Workspaces
    List-Sessions -ws $Workspace
} elseif ($Search) {
    Search-Sessions -ws $Workspace -keyword $Search
} elseif ($SessionId) {
    View-Session -ws $Workspace -id $SessionId
} else {
    Write-Host @"

Kiro 会话浏览器 - 使用方法:

  # 列出所有会话
  .\kiro-session-browser.ps1 -ListAll

  # 搜索包含关键词的会话
  .\kiro-session-browser.ps1 -Search "KiroProxy"

  # 查看特定会话内容
  .\kiro-session-browser.ps1 -SessionId "2c7a93b9-3949-496b-8b7a-c78a8c9aa15b"

  # 切换工作区
  .\kiro-session-browser.ps1 -Workspace "ZjpcS2lyb1wy" -ListAll

工作区编码对照:
  ZjpcRmFuZ3l1LUNvZGUtRGV2 = F:\Fangyu-Code-Dev
  ZjpcS2lyb1wy = F:\Kiro\2

"@ -ForegroundColor Yellow
}
