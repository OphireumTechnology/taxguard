# Stops the TaxGuard AI Inference Engine. Models and knowledge are not touched.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
$running = @(Get-Process -Name $script:RuntimeProcesses -ErrorAction SilentlyContinue)
if ($running.Count -eq 0) { Write-TaxGuardLine "the Inference Engine is not running." "Green"; exit 0 }
try { $running | Stop-Process -Confirm:$false }
catch { Write-TaxGuardLine "the Inference Engine could not be stopped: $($_.Exception.Message)" "Red"; exit 1 }
Write-TaxGuardLine "the Inference Engine has stopped." "Green"
