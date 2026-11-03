# Shows the state of the scheduled learning tasks. Read-only: it never enables anything.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
$enabled = 0
foreach ($name in $script:LearningTasks) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if (-not $task) { Write-TaxGuardLine "${name}: not registered" "Yellow"; continue }
    Write-TaxGuardLine "${name}: $($task.State)"
    if ($task.State -ne "Disabled") { $enabled++ }
}
if ($enabled -gt 0) { Write-TaxGuardLine "$enabled task(s) are not disabled." "Red"; exit 1 }
