[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://127.0.0.1:3000'
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SyncDir = Join-Path $ProjectRoot 'pc-sync'
$StateFile = Join-Path $SyncDir '.last-sync'
$OutputFile = Join-Path $SyncDir 'captured-text.md'

if (-not (Test-Path $SyncDir)) {
    New-Item -ItemType Directory -Path $SyncDir -Force | Out-Null
}

$since = ''
if (Test-Path $StateFile) {
    $since = (Get-Content $StateFile -Raw -Encoding utf8).Trim()
}

$queryUrl = "$BaseUrl/api/entries"
if ($since) {
    $queryUrl += "?since=$([Uri]::EscapeDataString($since))"
}

Write-Host "동기화 요청 중: $queryUrl"
try {
    $res = Invoke-RestMethod -Uri $queryUrl -Method Get -TimeoutSec 15
} catch {
    Write-Error "서버 연결 실패: $_"
    exit 1
}

$entries = $res.entries
if (-not $entries -or $entries.Count -eq 0) {
    Write-Host "새로운 새 기록이 없습니다." -ForegroundColor Yellow
    exit 0
}

Write-Host "총 $($entries.Count)개의 기록을 가져왔습니다." -ForegroundColor Green

$sb = [System.Text.StringBuilder]::new()
$latestTime = $since

foreach ($entry in $entries) {
    [void]$sb.AppendLine("## [$($entry.createdAt)] $($entry.source)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($entry.text)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("")

    if (-not $latestTime -or $entry.createdAt -gt $latestTime) {
        $latestTime = $entry.createdAt
    }
}

[System.IO.File]::AppendAllText($OutputFile, $sb.ToString(), [System.Text.Encoding]::UTF8)

if ($latestTime) {
    [System.IO.File]::WriteAllText($StateFile, $latestTime, [System.Text.Encoding]::UTF8)
}

Write-Host "동기화 완료: $OutputFile" -ForegroundColor Cyan