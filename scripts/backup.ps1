[CmdletBinding()]
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DataDir = Join-Path $ProjectRoot 'data'
$EntriesFile = Join-Path $DataDir 'entries.jsonl'
$BackupsDir = Join-Path $ProjectRoot 'backups'

if (-not (Test-Path $EntriesFile)) {
    Write-Warning "No entries file to backup ($EntriesFile)."
    exit 0
}

if (-not (Test-Path $BackupsDir)) {
    New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipPath = Join-Path $BackupsDir "backup-$timestamp.zip"

try {
    Compress-Archive -Path $EntriesFile -DestinationPath $zipPath -Force
    Write-Host "Backup complete: $zipPath" -ForegroundColor Green
} catch {
    Write-Error "Backup failed: $_"
    exit 1
}