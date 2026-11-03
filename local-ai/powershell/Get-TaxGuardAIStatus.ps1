# Reports service health: the Inference Engine, the model and the learning tasks. Read-only.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
$healthy = $true
if (Test-TaxGuardInference) {
    Write-TaxGuardLine "Inference Engine: running" "Green"
    $installed = @(Get-TaxGuardModelNames) -contains $script:ModelId
    if ($installed) { Write-TaxGuardLine "Model ${script:ModelId}: installed" "Green" } else { Write-TaxGuardLine "Model ${script:ModelId}: not installed" "Red"; $healthy = $false }
} else {
    Write-TaxGuardLine "Inference Engine: not running. Start it with Start-TaxGuardAI.ps1." "Yellow"
    $healthy = $false
}
foreach ($name in $script:LearningTasks) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if (-not $task) { Write-TaxGuardLine "${name}: not registered" "Yellow" }
    elseif ($task.State -eq "Disabled") { Write-TaxGuardLine "${name}: disabled" "Green" }
    else { Write-TaxGuardLine "${name}: $($task.State). It should be disabled." "Red"; $healthy = $false }
}
if ($healthy) { exit 0 } else { exit 1 }
