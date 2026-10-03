# TaxGuard AI — Production Security Architecture & Specification
**Firm:** A/R Tax Services, LLC  
**Scope:** TaxGuard AI Operations Engine & Client Tax Center  
**Security Model:** Zero-Trust, Server-Authoritative, Circular 230 / NIST AI RMF 1.0 Aligned  

---

## 1. Authentication & Session Management
- **Durable Server Sessions:** Client and staff sessions use cryptographically random 64-character hex tokens (`tg_live_[a-f0-9]{64}`).
- **SHA-256 Token Storage:** Raw session tokens are never stored plaintext in the database; only SHA-256 hashed digests (`taxguard_sessions.session_token_hash`) are persisted.
- **Session Expiration:** Default 2-hour sliding window; expired or revoked tokens immediately fail closed with `401 Unauthorized`.
- **Seed Credential Hardening:** Seed development passwords (`initSeedPasswords`) are disabled in production runtime (`process.env.NODE_ENV === 'production'`).

---

## 2. Multi-Tenant Isolation & Row-Level Security (RLS)
- **Authoritative Tenant Scoping:** Every query, case, task, document, and accounting record requires an explicit `tenant_id` validated via `safeId()`.
- **Server Authority:** The browser cannot supply or override its own `tenant_id` or `role`. Role and tenant bindings are retrieved solely from authoritative database records (`taxguard_members` and `taxguard_identities`).
- **PostgreSQL RLS:** All 58 database tables enforce tenant isolation policies ensuring cross-tenant queries return zero records.

---

## 3. Object-Level Authorization (IDOR / BOLA Prevention)
- **Dual-Key Enforcement:** Access to cases, documents, workpapers, invoices, and messages requires matching both the authenticated `tenant_id` and the user's bound `clientId` or assigned staff ID (`user_id`).
- **Maker-Checker Controls:** Preparers cannot review or sign off on their own workpapers. Stage 06 and Stage 10 require distinct `reviewer` or `cpa` assignments.

---

## 4. Secure Document Processing Pipeline
1. **Upload & Quarantine:** Uploaded files enter an encrypted quarantine vault with UUID filenames.
2. **Signature & MIME Validation:** Magic byte signatures are verified against whitelist (`PDF`, `PNG`, `JPEG`, `TIFF`, `DOCX`, `XLSX`). Extension alone is never trusted.
3. **Path Traversal & Shell Defense:** Filenames are sanitized; double extensions, null bytes, and path traversal sequences (`../`) are stripped.
4. **Malware Boundary:** Files undergo malware scanner evaluation. If the scanner is offline, files remain quarantined (`NOT_CONFIGURED`) and are never marked clean.
5. **OCR & Extraction:** OCR output is treated strictly as untrusted candidate text. Verified taxpayer facts require human review and sign-off.

---

## 5. AI Reasoning & Governance Boundary (OpenAI)
- **Proposal-Only:** OpenAI model output (`TaxGuardOpenAIService`) is strictly advisory. AI cannot independently approve tax positions, alter General Ledger balances, sign returns, or file with the government.
- **PII Stripping:** Social Security Numbers, employer identification numbers, and bearer credentials are automatically scrubbed (`sanitizeText`) before transmission to AI gateways.
- **No Client-Side Calls:** All AI interactions originate exclusively from authenticated server proxy routes (`/api/taxguard-ai/*`).

---

## 6. Accounting Ledger & Write-Back Controls
- **Double-Entry Invariant:** No journal entry may be posted unless `Total Debits == Total Credits` exactly.
- **Accounting Period Locks:** Finalized periods reject further transaction mutations or reconciliation adjustments.
- **Write-Back Gate:** External ledger write-backs (QuickBooks / Xero) require explicit client authorization, preparatory sign-off, reviewer approval, and an exact `CONFIRM_WRITE_TO_LEDGER` phrase.

---

## 7. Webhook & Payment Security (Stripe)
- **Raw Body Signature Verification:** Stripe webhooks verify HMAC-SHA256 signatures against the raw unparsed request payload.
- **Idempotency & Deduplication:** Webhook event IDs are stored in `taxguard_mutation_idempotency`. Replayed callbacks return cached acknowledgments without duplicate invoicing or ledger balance adjustments.
- **Browser State Immunity:** Invoices are never marked `PAID` from browser redirection URLs alone; authoritative payment status requires verified webhook delivery.

---

## 8. Logging, Error Handling & PII Redaction
- **Centralized Redaction:** Logging wrappers automatically scrub Authorization headers, Cookie headers, passwords, JWTs, API keys, and full SSNs.
- **Safe Production Errors:** Production API endpoints return uniform JSON error objects (`code`, `message`, `correlationId`) without exposing stack traces, SQL snippets, database hostnames, or filesystem paths.
- **Security Event Auditing:** Failed authentication attempts, unauthorized IDOR probes, and signature validation failures write immutable audit records to `taxguard_audit_log`.

---

## 9. Regulatory & Legal Hold Enforcement
- **Configurable Retention:** Data retention periods are managed as firm-configured and jurisdiction-sensitive policy rather than arbitrary static statutory assertions.
- **Legal Hold Override:** An active legal hold (`legalHoldActive: true`) unconditionally overrides scheduled automated document deletion or archive purging.
- **Archive Cryptography:** Stage 16 archives generate an immutable SHA-256 manifest. Any tampering invalidates the verification check.
