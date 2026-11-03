# Restricted technical diagnostics for administrators. It names the real runtime and models on purpose, because provenance must stay accurate.
# Writes one local report and prints where it is. It contains no secrets, prompts or client data, and environment variable values are not recorded except the runtime's settings.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add("TaxGuard AI restricted diagnostics, $(Get-Date -Format s). Developed and operated by Ophireum Technology.")
[void]$lines.Add("Inference runtime: Ollama (Ollama Inc., MIT License). Model weights: Qwen3 8B (Qwen team, Alibaba Cloud, Apache License 2.0). See docs/THIRD_PARTY_AI_NOTICES.md.")
if (Test-TaxGuardInference) {
    [void]$lines.Add("Runtime version: $((Invoke-RestMethod -Uri "$script:Endpoint/api/version" -TimeoutSec 5).version)")
    foreach ($model in (Invoke-RestMethod -Uri "$script:Endpoint/api/tags" -TimeoutSec 15).models) { [void]$lines.Add("Model: $($model.name) digest $($model.digest)") }
    foreach ($model in (Invoke-RestMethod -Uri "$script:Endpoint/api/ps" -TimeoutSec 15).models) { [void]$lines.Add("Loaded: $($model.name)") }
} else { [void]$lines.Add("Runtime: not answering at $script:Endpoint") }
foreach ($name in @("OLLAMA_HOST", "OLLAMA_MODELS", "OLLAMA_NO_CLOUD", "OLLAMA_NUM_PARALLEL", "OLLAMA_MAX_LOADED_MODELS")) { [void]$lines.Add("${name}: $([Environment]::GetEnvironmentVariable($name, 'User'))") }
foreach ($task in (Get-ScheduledTask | Where-Object { $_.TaskName -match "TaxGuard|Ophir" })) { [void]$lines.Add("Task $($task.TaskName): $($task.State)") }
$path = Join-Path $script:Autonomous "reports\taxguard_ai_diagnostics_latest.txt"
$lines | Set-Content -LiteralPath $path -Encoding UTF8
Write-TaxGuardLine "restricted diagnostics written to $path" "Green"
