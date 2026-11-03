# Lists the TaxGuard models installed for the Inference Engine. Read-only. Other tags are listed only in Get-TaxGuardAIDiagnostics.ps1.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
if (-not (Test-TaxGuardInference)) { Write-TaxGuardLine "the Inference Engine is not running. Start it with Start-TaxGuardAI.ps1." "Yellow"; exit 1 }
$models = @(Get-TaxGuardModelNames | Where-Object { $_ -like "taxguard-model*" })
if ($models.Count -eq 0) { Write-TaxGuardLine "no TaxGuard model is installed." "Red"; exit 1 }
foreach ($name in $models) { Write-TaxGuardLine "model $name" "Green" }
