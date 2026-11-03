# Reports Knowledge Memory and research pipeline counts. Refreshes the counts-only status file; changes no knowledge.
. "$PSScriptRoot\TaxGuardAI.Common.ps1"
& $script:Python (Join-Path $script:Autonomous "scripts\knowledge_status_export.py") --execute | Out-Null
if ($LASTEXITCODE -ne 0) { Write-TaxGuardLine "the knowledge status could not be read." "Red"; exit 1 }
$status = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $script:Autonomous "reports\knowledge_status_latest.json") | ConvertFrom-Json
Write-TaxGuardLine "Knowledge Engine: $($status.extraction.documents) documents, $($status.chunks.total) chunks, $($status.chunks.embeddings) embeddings, all staging."
Write-TaxGuardLine "Review queue: $($status.review.queue_awaiting) items awaiting a person."
Write-TaxGuardLine "Knowledge Memory: $($status.review.production.approved) approved, $($status.review.production.pending) pending, $($status.review.production.rejected) rejected."
