# Shared helpers for the TaxGuard AI commands. Output names the TaxGuard AI service. Genuine errors are shown, not hidden.
# The runtime's own name stays in this file and the restricted diagnostics, because Windows and its API need it.
$ErrorActionPreference = "Stop"

$script:LocalAi = Split-Path -Parent $PSScriptRoot
$script:Autonomous = Join-Path $script:LocalAi "rag\autonomous"
$script:Python = Join-Path $script:LocalAi "rag\.venv\Scripts\python.exe"
$script:ModelId = "taxguard-model:8b"
$script:Endpoint = "http://127.0.0.1:11434"
$script:TrayPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
$script:RuntimeProcesses = @("ollama app", "ollama")
$script:LearningTasks = @("TaxGuardAutonomousLearning", "TaxGuardStagingLearning")

function Write-TaxGuardLine([string]$Message, [string]$Color = "Gray") { Write-Host "TaxGuard AI: $Message" -ForegroundColor $Color }

function Test-TaxGuardInference {
    try { Invoke-RestMethod -Uri "$script:Endpoint/api/version" -TimeoutSec 5 | Out-Null; return $true } catch { return $false }
}

function Get-TaxGuardModelNames {
    (Invoke-RestMethod -Uri "$script:Endpoint/api/tags" -TimeoutSec 15).models | ForEach-Object { $_.name }
}

function Invoke-TaxGuardChat([string]$Prompt, [int]$TimeoutSec = 180) {
    $body = @{ model = $script:ModelId; stream = $false; think = $false; messages = @(@{ role = "user"; content = $Prompt }) } | ConvertTo-Json -Depth 5
    (Invoke-RestMethod -Uri "$script:Endpoint/api/chat" -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec $TimeoutSec).message.content
}
