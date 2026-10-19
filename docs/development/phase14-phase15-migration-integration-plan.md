# Phase 14 / Phase 15 migration integration plan (for owner approval)

2026-10-19. **Plan only.** No migration was renamed, removed or applied, and no Codex branch or checkout was
modified. Staging NO-GO, production NO-GO.

Sources compared:
- Phase 14: PR #22 at `acb2086` (`claude/taxguard-phase14-full-platform-development`).
- Phase 15: `origin/codex/taxguard-phase15-catalog-concurrency` at `a27159f`, the newest published Codex head,
  which carries all nine published Phase 15 migrations.
- Codex's unpublished, uncommitted `20261019070000_taxguard_refund_reconciliation.sql`, read without changes from
  Codex's checkout.

## 1. The collision (verified)

| Version | Phase 14 | Phase 15 |
|---|---|---|
| `20261018000000` | `taxguard_case_validate_replacement_evidence` (added `d24120f`) | `taxguard_financial_reporting` (added `b1ce7d6`, on 10 Codex branches) |
| `20261018010000` | `taxguard_billing_refund_records` (added `8d76945`) | `taxguard_report_cent_transport` (on 9 Codex branches) |

The contents are different files with different purposes. Two concrete consequences:
- Runners that key on the version, such as the Supabase CLI `schema_migrations`, would treat the second file of
  each pair as already applied, or refuse it.
- Several Phase 14 tests select proposals by version prefix (`/^20261018000000_/` and `/^20261018010000_/` in
  `billingHttp`, `caseValidateReplacementEvidence` and `documentRequestsHttp`). On a merged branch, those patterns
  would also load Codex's reporting migrations.

## 2. Preconditions for renumbering the two Phase 15 reporting migrations

| Check | Result | Evidence |
|---|---|---|
| Target versions `20261018110000` and `20261018120000` are unoccupied | **Verified** | No file or reference on any remote branch, in either checkout, or in `supabase/migrations` |
| Not applied to a shared database | **Verified locally; owner confirmation required** | Both files' headers say "development only / no hosted execution authorized"; `supabase/migrations` ends at `20261008060000`; staging manifests record `externalApplication:false`. Hosted databases were not queried (not permitted). The owner should confirm that neither version appears in `supabase_migrations.schema_migrations` of any shared project. |
| Dependencies satisfied | **Verified** | Merged order: 89 entries (90 with Codex's reconciliation). The manifest builder computes positions 81 and 82 for the renumbered pair, after every Phase 14 proposal (72–80) and before Codex's `20261019…` series (83–89). `report_cent_transport` depends only on `financial_reporting`, and nothing depends on either. |
| No new version-order inversion | **Verified** | The merged order has the same 5 inversions as `main` (`20261015000000`, `010000` and `030851` depend on later `20261015…` versions). The renumbering adds none. Those 5 inversions predate both phases, and version-keyed runners would apply them in the wrong order: see §6. |
| Manifests and history consistent | **Verified with the steps in §4** | Neither side has rollback files for these versions. References are in five generated files (both manifests, the execution order, the staging manifest and the review bundle), two documents and `src/tests/helpers/pgliteRpc.ts`. |

## 3. Decision matrix

| Option | What changes | Effect on reviewed evidence | Version-order safety | Recommendation |
|---|---|---|---|---|
| **A. Codex renumbers its two reporting migrations to `20261018110000` / `20261018120000`** | 2 file renames, 1 `dependsOn`, 2 documents and `pgliteRpc.ts`, regenerated manifests (Codex branch) | Phase 14 evidence, manifests, dossier and 11 reviewed proposals are unchanged. Codex's reporting files keep their bytes (only the names change). | Composes and re-applies cleanly (§5). No new inversion. | **Recommended** |
| B. Phase 14 renumbers `20261018000000` | 1 rename plus regex updates in 3 tests; manifests, traceability and dossier | Invalidates part of Phase 14's review record | A slot after `20261018050000` breaks version order, because `050000` depends on `000000`. A slot before `000000` is needed (for example `20261017500000`). | Workable but costlier |
| C. Keep both versions | none | none | Unsafe with version-keyed runners | Rejected |

`20261018010000` needs no renumbering under any option if Phase 14's refund records are withdrawn (§4.2), which
the owner's earlier decision (Phase 15 refunds are canonical) implies.

## 4. Exact steps (Option A), after owner approval

### 4.1 Codex branch (Codex executes; Phase 14 does not touch Codex branches)
1. Rename `docs/proposed-migrations/20261018000000_taxguard_financial_reporting.sql` to
   `20261018110000_taxguard_financial_reporting.sql`, and `20261018010000_taxguard_report_cent_transport.sql` to
   `20261018120000_taxguard_report_cent_transport.sql`. Do not change file contents.
2. `docs/development/migration-execution-order.json`: rename both entries and the `report_cent_transport`
   `dependsOn`.
3. `src/tests/helpers/pgliteRpc.ts` lines 29–30: update both paths.
4. `docs/development/phase15-financial-reporting-integration.md` and `phase15-monetary-precision.md`: update the
   names.
5. Regenerate:
   - `node scripts/migrations/build-migration-manifest.mjs`
   - `node scripts/staging/migration-manifest.mjs --write`
   - `node scripts/staging/migration-review-bundle.mjs --write`
   - traceability
6. Run the release candidate, `composition.db`, `phase15Reporting` and the full suites, then publish for review.

### 4.2 Phase 14 branch (only after the owner confirms the refund decision)
1. Withdraw `20261018010000_taxguard_billing_refund_records.sql` from the execution order. Codex's
   reconciliation refuses to compose with it (§5), and the owner made the Phase 15 refund design canonical.
2. Replace the Phase 14 refund adapter in `billingRefunds.db` with Codex's adapter against the same
   `refundContract.ts`. Move `BillingStore.refund` to the keyed seven-argument function. Remove `^20261018010000_`
   from `billingHttp`.

### 4.3 Merged branch
1. Take Codex's replay set (`…|^20261018|^20261019`) in `composition.db.test.ts` and
   `scripts/staging/migration-release-candidate.ts`. Without it, re-applying `20261012290000` silently reverts
   Codex's `taxguard_b2t_prepare_adjustment` and the replay check fails (`MIGRATION_CANDIDATE_REPLAY_DRIFT`).
2. Take Codex's billing application layer: keyed `createInvoice`, `addLine`, `requestCredit` and refund.
   Phase 14's `BillingStore` calls the unkeyed RPCs, and `phase10Security.db` fails with
   `BILLING_STORE_UNAVAILABLE` on the merged schema.
3. Run every suite on the merged order before requesting approval.

## 5. Reproduction (disposable loopback PostgreSQL, scratch worktree, since deleted)

| Merged order | Release candidate | `composition.db` | Phase 14 DB suite |
|---|---|---|---|
| Phase 14 + Phase 15 published (A), Phase 14 replay set | **FAIL**: `MIGRATION_CANDIDATE_REPLAY_DRIFT` (`taxguard_b2t_prepare_adjustment`) | 5/6 (re-apply drift) | not run |
| Same, with Codex's replay set (§4.3.1) | PASS, 89 entries | 6/6 | 123/125. Refund contract unkeyed check differs: Codex keeps `EXECUTE` on a fail-closed six-argument overload. `phase10Security`: billing app layer (§4.3.2). |
| Same, plus Codex's reconciliation `20261019070000` | **FAIL**: `REFUND_SCHEMA_INCOMPATIBLE: result`, the reconciliation's intended refusal | not run | not run |
| Phase 14 refund records withdrawn, plus the reconciliation | PASS, 89 entries, 64 replay-safe proposals | not run | 119/125. The 6 failures are the Phase 14 refund adapter (5) and `phase10Security` (billing app layer); all are expected under §4.2 and §4.3. |

On the merged schema, `ledgerYearScope.db`, `caseAssignmentRevocation.db`, `practiceClientDetailScope.db` and
every other Phase 14 security suite pass. That includes Codex's redefined ledger write paths running against the
Phase 14 ledger insert triggers.

| Merged order, Phase 14 refund records withdrawn, Codex replay set | Release candidate | `ledgerYearScope.db` plus the exact-wrapper cases (scratch copy) | `composition.db` |
|---|---|---|---|
| Amended `070000` (as-of bound) | PASS, 88 entries | 10/10. The wrapper refuses as-of dates before and after the requested year for the scoped member, managers, administrators and client-wide staff, refuses an out-of-scope year, and allows in-year dates. | 6/6 |
| Unamended `070000` (`acb2086`) | not run | 8/10. **Both the base trial balance and Codex's `taxguard_ledger_trial_balance_exact` return 2024 "as of" 2025 to a 2024-only member.** | not run |

**Composition is not behavioural integration.** Composition passing (the release candidate and `composition.db`)
shows only that every file applies, re-applies and keeps its privileges in the merged order. It does not show
that the application and the database still agree. Behavioural integration currently fails in two known places:
1. **Billing application layer:** Phase 14's `BillingStore` calls the unkeyed RPCs (`phase10Security.db`,
   `BILLING_STORE_UNAVAILABLE`).
2. **Refund contract:** the Phase 14 adapter targets `taxguard_bill_refund_keyed` from the withdrawn proposal
   (5 cases in `billingRefunds.db`).

Both are resolved by §4.2 and §4.3, not by changing assertions.

## 6. Pre-existing finding (not caused by either phase)

`main`'s execution order has 5 version inversions in the `20261015…` series. The manifest's topological order
handles them, but a runner applying files by version would not. Before any hosted migration, either renumber
those files or apply only through the reviewed manifest order. This is an owner decision, recorded here.

## 7. Financial integration findings

**Canonical refund (Codex `20261019020000` and the unpublished `20261019070000`).** Reviewed against the agreed
requirements:
- **Immutability:** a statement-level BEFORE UPDATE / DELETE / TRUNCATE trigger refuses every change, and table
  privileges are revoked from every API role. Satisfied.
- **Reason:** required (5–500 characters) and recorded both in the refund row and in the audit, with before and
  after amounts. Satisfied.
- **Incompatible schema:** an explicit guard checks every column type, NOT NULL, and the payment FK and the
  `(tenant_id, idempotency_key)` unique constraint. It refuses before replacing anything; reproduced in §5.
  Satisfied.
- **Replay authorization:**
  - The actor is checked before and again after the per-key advisory lock.
  - A replay returns the stored result only when the client, payment, amount, reason and recording manager all
    match; anything else raises `BILLING_IDEMPOTENCY_CONFLICT`.
  - Keys are tenant-unique.
  - Satisfied.
- **Concurrency:** a per-key advisory lock plus `FOR UPDATE` on the payment before the over-refund check, so
  distinct keys on one payment serialize. Satisfied.
- **Tenant isolation:** every lookup filters on tenant and client. Satisfied.
- **Note:** the six-argument overload keeps `EXECUTE` for `service_role` but always raises
  `IDEMPOTENCY_KEY_REQUIRED` after the manager check, so no unkeyed refund can be recorded. Codex's contract
  adapter should declare `unkeyedRevoked: false` with this explanation.
- **Remaining:** `taxguard_bill_actor` is client-level, so refunds are not engagement-scoped. This needs the
  financial-reporting authorization decision below.

**General ledger and reports.**
- **Fixed in this package (Phase 14, `20261018070000`):** `taxguard_ledger_trial_balance` accepted any
  `as of` date. A member assigned only for 2024 could request 2024 "as of" a 2025 date and receive 2025 activity
  summed into the period. The as-of date must now fall inside the requested year (`LEDGER_INPUT_INVALID`).
  `ledgerYearScope.db` failed first. Codex's `trial_balance_exact` delegates to this function, so it inherits the
  fix without any change to Codex's code. Boundary cases cover 1 January and 31 December (allowed) and the day
  before and after (refused), for the scoped member, managers, administrators and client-wide staff. The period
  debits for 2024 equal the database's 2024 posted debits while a 2025 posting exists. The wrapper was verified
  on the merged schema (§5).
- **Open (Codex, reproduced in its `qa/phase15-scope` contract):**
  - The posting-replay year check.
  - The general-ledger requested-year guard (`taxguard_ledger_general_ledger` uses `taxguard_ledger_actor` only).
  - Reversal and adjustment replay.
- **Owner decision needed: prior-year balances.** Both reports fold all prior posted activity into opening or
  beginning balances. A year-scoped member therefore sees aggregate prior-year totals per account. Filtering them
  out would produce wrong balances. Choose one:
  1. Opening balances are part of the authorized year's statement. This is the accounting norm, and the
     recommended option.
  2. Year-scoped staff are refused statements with prior activity, which leaves managers, administrators and
     client-wide staff only.
- **Owner decision needed: engagement attribution.** Ledger records carry no engagement, so ledger authority is
  by client and year (the owner's 2026-10-19 "scoped grant" decision). Confirm this, or commission reviewed
  engagement attribution.

## 8. Codex handoff: exact changes (Codex executes; nothing here was applied to Codex branches)

| # | Area | Affected (Codex) | Expected behaviour | Evidence or test |
|---|---|---|---|---|
| 1 | Version collision | `20261018000000_taxguard_financial_reporting.sql`, `20261018010000_taxguard_report_cent_transport.sql`, `migration-execution-order.json`, `src/tests/helpers/pgliteRpc.ts` (lines 29–30), `phase15-financial-reporting-integration.md`, `phase15-monetary-precision.md`, regenerated manifests | Renamed to `20261018110000` and `20261018120000`; contents unchanged | §2, §5 (merged release candidate PASS) |
| 2 | Replay set | `composition.db.test.ts`, `migration-release-candidate.ts` | Keep `…|^20261019` in the merged branch | §5, row 1: `MIGRATION_CANDIDATE_REPLAY_DRIFT` without it |
| 3 | Canonical refund | `20261019020000`, the unpublished `20261019070000`, `src/tests-db/refundContract.ts` | Publish `070000`; add a Codex adapter (`unkeyedRevoked: false`, with the fail-closed overload explained); never compose with Phase 14's `20261018010000` | §5: `REFUND_SCHEMA_INCOMPATIBLE: result`; 5 Phase 14 adapter cases fail once withdrawn |
| 4 | Billing application layer | `BillingStore` and the billing routes | The merged branch uses Codex's keyed `createInvoice`, `addLine`, `requestCredit` and refund | `phase10Security.db`: `BILLING_STORE_UNAVAILABLE` on the merged schema |
| 5 | Posting, reversal and adjustment replay | `taxguard_ledger_post_entry(_once)`, `reverse_entry(_once)`, `b2t_prepare_adjustment` (Phase 15 definitions) | After the key lock and actor re-check, a replay checks `taxguard_ledger_year_scope(..., <stored>.tax_year)` and refuses as not found | Codex `qa/phase15-scope`: stored 2024 posting replay returned after narrowing (baseline FAIL) |
| 6 | General-ledger year | `taxguard_ledger_general_ledger(_exact)` | `taxguard_ledger_year_guard(..., p_tax_year)` after `taxguard_ledger_actor` | Codex `qa/phase15-scope`: direct 2024 request returned $7 lines (baseline FAIL) |
| 7 | Ledger insert triggers | Every Phase 15 insert into `taxguard_ledger_entries` or `taxguard_b2t_adjustments` | `creator_uid` or `prepared_by` is the acting member; no system uid | Compatible today: `ledgerYearScope.db` passes on the merged schema |
| 8 | Prior-year balances | GL opening and trial-balance beginning balances | Owner policy (§7). Never filter balances silently. | Codex `qa/phase15-scope`: 2 cases pending a policy |
| 9 | Engagement and financial authorization | `taxguard_bill_*`, ledger reports | Owner confirms client-and-year ledger authority or commissions engagement attribution; invoices follow `taxguard_staff_record_scope` once decided | dossier, Codex handoff item 6 |
| 10 | Case-team reassignment | new reviewed operation (Phase 14 can deliver it) | Manager-only, audited, live assignment required, segregation kept | dossier, Codex handoff item 7 |

## 9. Remaining approvals (exact)

1. **Owner:** choose Option A (recommended) or B for the version collision, and confirm that neither colliding
   version was applied to any shared database.
2. **Owner:** confirm withdrawal of Phase 14's `20261018010000` refund records in favour of the canonical Phase 15
   refund (consistent with the earlier decision).
3. **Codex:** execute §4.1. Publish `20261019070000`, the replay and general-ledger corrections, and its refund
   adapter.
4. **Owner:** the prior-year balance policy and ledger engagement attribution (§7).
5. **Owner:** the 5 pre-existing version inversions (§6).
6. **Codex review and owner approval** of Phase 14 proposals `20261018020000` to `20261018100000`. The amended
   `070000` includes the as-of bound.
7. **Owner:** the messaging, appointments and legal-matters policy (`phase14-remaining-domain-access-policy.md`).
8. **Counsel or practitioner:** IRC § 7216 consent wording.
