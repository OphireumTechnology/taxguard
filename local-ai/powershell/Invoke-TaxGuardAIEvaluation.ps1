# Runs the staged-knowledge evaluation by hand. It can recommend and can never approve. Uses the GPU; defers while TaxGuard tests run.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
if (-not (Test-TaxGuardInference)) { Write-TaxGuardLine "the Inference Engine is not running. Start it with Start-TaxGuardAI.ps1." "Yellow"; exit 1 }
& $script:Python (Join-Path $script:Autonomous "scripts\evaluate_knowledge.py") --execute
if ($LASTEXITCODE -eq 0) { Write-TaxGuardLine "the evaluation finished. Nothing was approved." "Green" } else { Write-TaxGuardLine "the evaluation did not finish (exit code $LASTEXITCODE)." "Red" }
exit $LASTEXITCODE
