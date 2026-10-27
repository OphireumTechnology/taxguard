# Phase 15 integration (2026-10-27)

Branch `integration/taxguard-phase15`, cut from the consolidation branch and merged with `main` at `51358ae`
(PR #35). Owner instruction of 2026-10-27: integrate Codex's Phase 15 work without losing or duplicating any of it,
keep Phase 14/`main` as the authority for refunds, rename only unmerged Phase 15 migrations that collide, and stop
at policy or security conflicts. Review-only proposals stay review-only; nothing was applied to a hosted database,
deployed or activated. Codex's checkouts were read, never modified; everything local-only is preserved in
`D:\TaxGuard\Backups\consolidation-20261027\`.

## Packages

Classification: DUPLICATE, SUPERSEDED, PHASE15_CAPABILITY_TO_PORT, TRUE_SCHEMA_CONFLICT, POLICY_DECISION_REQUIRED,
SECURITY_CONFLICT, plus INCORPORATED, EXPERIMENTAL, TEST_ONLY, PROCESS_RECORD.

### Published Phase 15 stack (PRs #24-#34)

| Source | Change | Result |
|---|---|---|
| PR #24 `b4c048a` / `c196884` | ledger balances before detail limits, edited in place in proposal 024 on an older base | SUPERSEDED by #25 (same fix as an additive migration) |
| PR #25 `b1ce7d6` | complete general-ledger reporting | INCORPORATED; proposal renamed `20261018000000` → `20261018110000` (collision) |
| PR #26 `93de71e` | exact report cents | INCORPORATED; proposal renamed `20261018010000` → `20261018120000` (collision) |
| (integration) | general ledger had no tax-year guard (handoff item 6) | SECURITY_CONFLICT resolved: new `20261018130000` applies `taxguard_ledger_year_guard`; test failed first |
| PR #27 `19d710c` | report year and cutoff validation | INCORPORATED |
| PR #28 `c05e152` | invoice creation retries | INCORPORATED |
| PR #29 `99f9623` | adjustment creation retries | INCORPORATED |
| PR #30 `af34972` | second refund design (own table shape, seven-argument function) | TRUE_SCHEMA_CONFLICT; PHASE15_CAPABILITY_TO_PORT: ported into the canonical keyed function (below) |
| PR #31 `9831c81`, `5f4276a` | keyed line and credit retries; recovery rehearsal key | INCORPORATED (canonical refund route and client kept) |
| PR #32 `378255e` | coordinated ledger retries | INCORPORATED |
| (integration) | replay returned stored records without a year check (handoff item 5) | SECURITY_CONFLICT resolved: new `20261019080000` for posting, reversal and adjustment replay; test failed first |
| PR #33 `a8bc4fe` | keyed line removal | INCORPORATED |
| PR #34 `a27159f` | serialized catalog pricing | INCORPORATED (canonical refund kept in `BillingStore`) |
| PR #23 (Copilot) | CI path-filter coverage | not Phase 15; left for its owner |

### Refund architecture decision

One implementation: `taxguard_bill_refund_keyed` (proposal `20261018010000`), hardened by
`20261019020000_taxguard_refund_idempotency.sql`, which replaces Codex's version of that file. This reverses the
2026-10-19 decision recorded in `phase14-phase15-migration-integration-plan.md` (Phase 15 canonical), per the owner's
2026-10-27 instruction.

| Area | Phase 14 (kept) | Phase 15 | Canonical result |
|---|---|---|---|
| Authorization | manager via `taxguard_bill_actor` | same, re-checked after the lock | re-checked after the lock (ported) |
| Tenant/client isolation | tenant/client filters, tenant FK | composite payment FK | both (FK ported) |
| Idempotency binding | client, payment, amount | + reason, recording manager | + reason, recording manager (ported) |
| Replay result | invoice as it is now | stored original result | stored result + `replayed: true` (ported) |
| Lock key | 32-bit `hashtext` with delimiters | 64-bit `hashtextextended` of a JSON array | 64-bit (ported) |
| Amount and reason validation | money check; reason 5-500, also a DB CHECK | money check; reason 5-500 | unchanged (Phase 14) |
| Immutability | row trigger on UPDATE/DELETE | statement trigger incl. TRUNCATE (in unpublished `070000`) | row trigger + statement TRUNCATE trigger |
| Audit | reason, amount | before/after amounts, no reason (`070000` restores it) | reason + exact before/after amounts |
| Unkeyed six-argument function | revoked from `service_role` | kept, fails closed | fails closed and stays revoked |
| Reused key error | `IDEMPOTENCY_KEY_REUSED` | `BILLING_IDEMPOTENCY_CONFLICT` | `IDEMPOTENCY_KEY_REUSED` (API contract and UI message) |
| Payment provider | none (record only) | none | none |
| Maker-checker | none (single manager) | none | unchanged; not decided here |
| Tests | `billingRefunds.db` contract | `refundIdempotency.db` (HTTP) | both run against the canonical function |

Codex's unpublished `20261019070000_taxguard_refund_reconciliation.sql` is SUPERSEDED: its trigger, reason audit and
replay rules are in the canonical function; its schema guard protected the Phase 15 table layout, which no longer
exists. The same applies to its `BillingStore` result check and refund test edits.

### Migration renames

Collisions checked against every proposal on `main` (versions `20261018000000`-`20261018190000`):

| Phase 15 (unmerged) | Collided with (on `main`) | Renamed to | Dependency |
|---|---|---|---|
| `20261018000000_taxguard_financial_reporting` | `20261018000000_taxguard_case_validate_replacement_evidence` | `20261018110000_…` | 024 |
| `20261018010000_taxguard_report_cent_transport` | `20261018010000_taxguard_billing_refund_records` | `20261018120000_…` | `110000` |

Both targets were unoccupied (also verified in the integration plan) and are Codex's own proposed labels. Contents
unchanged. References updated: execution order, `pgliteRpc.ts`, `phase15-financial-reporting-integration.md`,
`phase15-monetary-precision.md`, regenerated manifests. `20261019000000`-`060000` did not collide. New integration
proposals: `20261018130000`, `20261019080000`, `20261019090000`. No `main` migration was renamed.

### Codex unpublished and uncommitted work

| Source | Change | Result |
|---|---|---|
| `backend-completion` `1544608` | refuse malformed rule-set and input records before evaluation | INCORPORATED |
| `backend-completion` `1395c5b` | refuse relative backup-tool search paths | INCORPORATED |
| `backend-completion` `29dd4b1` + uncommitted | schema fingerprint: ownership and effective privileges | INCORPORATED and completed (Codex could not run its tests; they pass here) |
| `backend-completion` `ca3c6a5`, `e26894b`, checkpoint doc | sandbox environment diagnosis | PROCESS_RECORD, excluded |
| `phase14-continuation` | invoice documents: every line, full line numbers | INCORPORATED |
| `phase14-continuation` `onboardingAuthorizationWait` (untracked) | authority after lock wait; 4 cases for an unbuilt design | 3 cases reproduced a real defect → fixed by `20261019090000`; 4 cases EXPERIMENTAL, excluded |
| `phase14-continuation` readiness doc, matrix edits | 2026-10-19 status | PROCESS_RECORD, excluded (stale) |
| `phase15` checkout: job queue service, practice-operations routes, job tests | tenant-scoped retry/cancel, query validation | INCORPORATED |
| `phase15` checkout: sessions panel, shell link, tests | account status, session assurance, refresh | INCORPORATED |
| `phase15` checkout: AI, security-event, reviewer tests | regression additions | TEST_ONLY, incorporated |
| `phase15` checkout: `aiGovernanceControlPlane` list | 33 agents | DUPLICATE (`main` covers all 58) |
| `phase15` checkout: `case-authority.routes` refusals | production 503 for reviewer workspace/actions | SUPERSEDED (`main` refuses every volatile authority handler) |
| `phase15` checkout: `reviewerDashboardHttp` test | — | DUPLICATE (identical) |
| `phase15` checkout: `SqlCaseReadPreparation`, cursor test | signed reviewer-queue pagination, synthetic mode only | EXPERIMENTAL, excluded (unwired; awaits DEC-P16-REVIEWER-CONSISTENCY) |
| `phase15` checkout: `traceabilityEvidenceIntegrity` rewrite | asserts Codex's own working-tree drift | excluded (fails on any clean tree) |
| `phase15` checkout: `20261019070000`, `BillingStore`/refund test edits | refund reconciliation | SUPERSEDED (above) |
| `phase15` checkout: 40+ documents, `qa/phase15-billing-callers` | handoffs, sync inventories, owner packages | PROCESS_RECORD, excluded; open decisions listed below |

## Open decisions (not made by this integration)

From Codex's owner packages and the integration plan:
1. Independent SQL review of every proposal, including the refund port and the three integration proposals.
2. Migration history of every environment, before any hosted application (no shared database was queried).
3. Prior-year opening balances in year-scoped ledger reports; ledger engagement attribution.
4. Reviewer queue consistency model and production cutover (DEC-P16-REVIEWER-*).
5. A durable database-backed job queue: the queue is process-local (DEC-P16-JOB-DURABILITY).
6. Account-security production provider and cutover (DEC-P16-ACCOUNT-SECURITY-CUTOVER).
7. Native PostgreSQL 17 and backup acceptance; the 5 pre-existing version inversions in the `20261015…` series.
8. Whether refunds need maker-checker; whether refund reasons are visible in the audit center.
9. Earlier items still open: proposal approvals, IRC §7216 wording, materiality, providers, document-level calculation
   citations (Block 65), the Stage 02/03 placement of the extraction gate.

## Fixture cleanup

The demo client persona "Comfort Dondo" (since the M16 baseline `557d238`) was replaced by the synthetic
"Taylor Example" in a separate commit (`90efb7f`). It was TaxGuard demo data, not Phumulani content.

## Contamination scan (2026-10-27)

Terms: Phumulani, ORG-AI, FUND-AI, VAWA, Comfort Dondo, fundraising agent, survivor services, donor pipeline,
`phase29_` (case-insensitive, whole repository excluding dependencies and build output).

| Match | Classification |
|---|---|
| `docs/development/local-consolidation-20261027.md` (the consolidation search note) | LEGITIMATE HISTORICAL REFERENCE |
| "Comfort Dondo" demo persona (19 lines in demo data, demo seed, role switcher, a comment) | FALSE POSITIVE as contamination (TaxGuard fixture); replaced anyway |

No Phumulani implementation, agents, workflows or reports exist in TaxGuard.

## Local inventory (refreshed 2026-10-27, read-only)

All 11 TaxGuard checkouts in 4 Git stores (see `local-consolidation-20261027.md`) were re-checked: HEADs, dirty
counts and stashes (none) are unchanged since the consolidation. Additionally classified: the 2026-10-11 merge
snapshot in `D:\TaxGuard\Backups` (frozen mid-merge; every staged path exists in `main`; preservation only) and
`D:\TaxGuard\Development\taxguard-current-872.zip` (2026-09-28, before the M16 baseline; preservation only).

## Validation (integration branch, before the fixture commit; affected checks re-run after it)

| Check | Result |
|---|---|
| Unit | 6,193 passed (377 files); baseline 6,062 |
| PostgreSQL | 258 passed (49 files); baseline 171 |
| Browser, default | 133 passed (18 files) |
| Browser, provider | 44 passed (7 files) |
| Lint, typecheck, build | pass |
| Release candidate (ordering, clean replay, composition, re-application, fingerprint, RLS, definer paths) | PASS, 99 manifest entries, 74 replay-safe proposals |
| Constraint review | PASS, 13 NOT VALID constraints reported |
| Secrets | PASS, 1,606 files, no findings |
| `git diff --check` | PASS after removing a trailing blank line in `20261019090000` |
| Traceability integrity | PASS |
