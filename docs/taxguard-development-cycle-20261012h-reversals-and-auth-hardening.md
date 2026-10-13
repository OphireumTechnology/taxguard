# TaxGuard development cycle — 2026-10-12 (h) — controlled ledger reversals; MFA, lockout and reset hardening

**PRODUCTION STATUS: NO-GO.** Completion matrix: [taxguard-master-development-completion-matrix.md](taxguard-master-development-completion-matrix.md) (rows ACC-01, P1-09, P1-13).

## Synchronization performed at the start of this cycle (approved)

| Item | Result |
| --- | --- |
| Pre-commit checks | 11 files (an earlier report miscounted 12); no credentials or taxpayer data; typecheck, lint, 193 files / 3,684 tests, traceability, build and `git diff --check` PASS |
| Commits | `ef8c127`, `1d13189`, `f086a83`, `00b73bd`, `052a218` (exact scopes) |
| Push | `b04a25c..052a218`, no force; GitHub `sync/taxguard-development-20261011` = local HEAD `052a218` |
| `main` | Unchanged at `fc36cac` |
| PR #10 | Still an open **draft**, marked production NO-GO |
| Checkpoint | `.taxguard-backups/cycle-h-start-20261012-002423/` (git-ignored) |

## 1. Controlled reversing-entry workflow (ACC-01)

Previously a posted staging record could not be corrected at all: rollback was refused to avoid a duplicate ledger entry.

| Step | Behaviour |
| --- | --- |
| Post | Records `postedTransactionId` on the staging record (legacy records resolve the transaction from the `POSTED_TO_LEDGER` audit note) |
| `POST /api/staging/records/:id/reversal/request` | Accountant or administrator with access to the record. Reason of 10–1,000 characters required. Only `posted` records: `locked` gives 400, `reconciled` gives 409, other states give 409. One pending request at a time. The original transaction must resolve and must not already be reversed. Audited (warning). |
| `POST …/reversal/approve` | Senior reviewer or administrator with access to the record, **not the requester** (maker-checker). Re-checks state at approval time. Creates an offsetting `tx_rev_…` transaction (opposite side, same amount, `reversesTransactionId`). The original transaction's amount, type, date, status and description are **unchanged**; only `reversedByTransactionId` is added. The record returns to `needs_review` with its `reversals[]` history and audit trail kept. |
| `POST …/reversal/reject` | Same approver rules; the posting is unchanged |

Verified: the ledger nets to zero after reversal; re-posting and a second reversal keep each reversal tied to its own posting; cross-tenant, unassigned, wrong-role and self-approval attempts are refused with no ledger change (23 tests).

## 2. Authentication audit (P1-09) — confirmed gaps fixed

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| H-1 | **Critical (dev / staging)** | `POST /api/auth/login`: for MFA-enabled users, **any non-empty `mfaCode` signed in**; no code was ever verified | With a code: 503 `MFA_VERIFICATION_UNAVAILABLE` and a security event; no session is issued (no verifier exists for local sessions). Without a code: the existing MFA prompt. |
| H-2 | **Critical (dev / staging)** | `POST /api/auth/forgot-password` returned `devResetToken` to any caller in every non-production environment, so **anyone could reset any account's password** in staging | Exposed only with `NODE_ENV=development` **and** `TAXGUARD_DEV_EXPOSE_RESET_TOKEN=true` |
| H-3 | Medium | No throttle on reset requests | 3 per address per hour; responses identical and neutral (no enumeration) |
| H-4 | Medium | Lockout keyed only on IP + e-mail: rotating IPs gave unlimited guesses | Account-wide lockout at 15 failures from any IP, alongside per-IP lockout at 5; both cleared on success |
| H-5 | Low | Non-string credentials were not rejected up front | 400 |

**Audited, not changed (blocked):** production sessions come from Supabase via `/supabase-session`. The server does not check MFA assurance level (AAL2). Enforcing it needs a decision on which roles require MFA (H06 / H09) and the Supabase project's MFA configuration (E03). No general request rate limiter was verified on the legacy development routes. A production hardening rate-limit check exists separately (M15.13).

## Files changed

| File | Change |
| --- | --- |
| `src/types/intake.ts` | `postedTransactionId`, `reversalRequest`, `reversals` on staging records |
| `src/types/index.ts` | `reversesTransactionId`, `reversedByTransactionId` on ledger transactions |
| `src/server/routes/staging.routes.ts` | Posting link; reversal request / approve / reject; rollback message points to the workflow |
| `src/server/auth.ts` | `maxAttempts` parameter; `MAX_FAILED_ATTEMPTS_PER_ACCOUNT` |
| `src/server/routes/auth.routes.ts` | H-1 – H-5 |
| `src/tests/stagingReversalWorkflow.test.ts` | **New**, 23 tests |
| `src/tests/authBruteForceAndMfa.test.ts` | **New**, 13 tests |
| Docs | Completion matrix, this report, traceability |

## Validation

| Check | Result |
| --- | --- |
| Typecheck / lint | PASS / PASS |
| Full suite | **195 files / 3,720 tests PASS** (+2 files, +36 tests vs. 3,684; 0 failures) |
| Traceability | Regenerated; hash delta only `src/server/auth.ts`; integrity tests PASS; evidence references no git-ignored files |
| Build / `git diff --check` | PASS / PASS |
| Secrets / taxpayer data | None |
| Browser / deployed database / Supabase MFA | NOT VERIFIED (E06, E01, E03) |

## Remaining blockers (unchanged)

- **Decisions:** H10, H11, H06, H01a.
- **Platform conflict:** Supabase vs Firebase on `main`.
- **Dependencies:** E01–E08. Production MFA additionally needs H06 / H09 + E03.

## Next cycle

1. Production MFA (AAL2) enforcement once the role → MFA policy is decided.
2. General API rate limiting for unauthenticated legacy endpoints (registration, invitation acceptance).
3. Reversal workflow for accountant journal entries (`/journal-entries/:id/post` has the same "posted is final" property).
