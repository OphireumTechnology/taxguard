# Secure document management (Batch 2, Module 1)

**PRODUCTION STATUS: NO-GO.** Proposal 027 is **not applied**. `/api/vault` is development-only (503 unless `TAXGUARD_PRACTICE_STORE=durable` against a non-production project; absent from `createProductionApp`). No malware scanner or OCR provider is commissioned, so in any configured environment uploads stay quarantined (`SCAN_PENDING`) and are never downloadable. Synthetic documents only.

## Architecture

```
browser ──(raw bytes + metadata query, Idempotency-Key)──▶ /api/vault ──▶ DocumentVaultStore
  1. taxguard_doc_begin_upload  → actor + engagement-year checks, type / size / category / file name, private path computed in SQL
  2. server verifies bytes: size ≤ 25 MB, allowed type, content signature (PDF / PNG / JPEG / XLSX / CSV without formulas), SHA-256
  3. VaultStorage.put → private bucket 'taxguard-vault' (refuses a missing or public bucket)
  4. taxguard_doc_complete_upload → hash and size must equal the registration
  5. MalwareScanner (if commissioned) → taxguard_doc_record_scan: CLEAN → PENDING_REVIEW, INFECTED → REJECTED_MALWARE
  6. OcrProvider (if commissioned, CLEAN only) → taxguard_doc_propose_extraction (proposals only)
```

Existing tables are extended, not duplicated: `taxguard_documents` (category, uploader role, declared size, review fields, `row_version`; `case_id` nullable for engagement-level documents; unique version per document) and `taxguard_extracted_data` (client, document version, OCR provider, decision, verified value).

## Rules (database-enforced)

| Area | Rule |
| --- | --- |
| Actors | Clients: only their own client (member `client_id`). Staff: practice managers or current ACTIVE assignment (proposal 025). Recruiters, other tenants, unknown users refused; other clients' and tenants' records are indistinguishable from absent |
| Uploads | Active engagement tax year required; case (optional) must match engagement and year; one in-flight version per document; idempotent registration by key and hash |
| Review | Staff only; reviewer ≠ uploader; reject / replacement need a note; optimistic `row_version`; approving a version supersedes earlier verified versions |
| Download | Only CLEAN files; staff: pending review, verified or superseded; clients: verified, plus their own clean uploads; every grant audited; signed URL lifetime 60 s |
| OCR | Proposals only (`is_ai_proposed_only`); staff accept / correct / reject each field once; clients never see proposals or extraction history |
| Audit | `DOCUMENT_*` events per document and version |

## API

`GET /review-queue`, `GET /clients/:id/upload-targets`, `GET|POST /clients/:id/documents`, `GET /clients/:id/documents/:doc`, `POST /clients/:id/documents/:doc/versions/:v/review|download`, `POST /clients/:id/extractions/:field/verify`.

## UI

Client dashboard → Documents: *Secure document upload* (engagement-year selection, category, file, status list, download) — hidden where the vault is not enabled. Practice Manager → *Document Review*: queue, short-lived open link, field verification, accept / request replacement / reject.

## Tests

`documentVaultHttp.test.ts` (10: private path, validation and content signatures before storage, idempotency, EICAR quarantine, unscanned refusal, independent review, signed-URL scope and TTL, audit trail, OCR verification, versioning / supersession, SQL-level authority, public-bucket refusal; mutation-checked: maker-checker, clean-only download, client scoping), `documentVaultPanels.test.tsx` (4), composition test extended to proposal 027.

## Limitations

No commissioned scanner (E02) or OCR provider; retention / deletion policy execution not implemented (deletion is intentionally absent); preview rendering and watermarking not integrated; legacy `/api/documents` (in-memory) remains for existing views; browser NOT VERIFIED.
