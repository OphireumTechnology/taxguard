# Starts the TaxGuard AI Inference Engine and waits until it answers. Learning tasks are not touched.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
if (Test-TaxGuardInference) { Write-TaxGuardLine "the Inference Engine is already running." "Green"; exit 0 }
if (-not (Test-Path -LiteralPath $script:TrayPath)) { Write-TaxGuardLine "the Inference Engine is not installed where expected. See Get-TaxGuardAIDiagnostics.ps1." "Red"; exit 1 }
# Started through Explorer: started directly from a shell, the runtime's tray does not start its server.
Start-Process -FilePath "explorer.exe" -ArgumentList "`"$script:TrayPath`""
for ($second = 0; $second -lt 60; $second += 2) {
    if (Test-TaxGuardInference) { Write-TaxGuardLine "the Inference Engine is running." "Green"; exit 0 }
    Start-Sleep -Seconds 2
}
Write-TaxGuardLine "the Inference Engine did not answer within 60 seconds. See Get-TaxGuardAIDiagnostics.ps1." "Red"
exit 1
