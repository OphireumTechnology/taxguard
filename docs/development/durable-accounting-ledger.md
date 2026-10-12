# Durable accounting ledger and bookkeeping workflows (Modules 1–2)

**PRODUCTION STATUS: NO-GO.** Proposal 024 is **not applied** anywhere. No production Supabase access. Synthetic data only. Branch `claude/taxguard-dev-20261012`.

## Architecture

```
/api/bookkeeping (existing paths and response shapes)
  └─ ledgerDispatch.routes.ts ── selectLedger()
        memory      → existing in-memory BookkeepingEngine handlers (development / tests only)
        durable     → SqlLedgerStore → service-role RPCs (proposal 024)
        unavailable → 503 DURABLE_ACCOUNTING_PROVIDER_REQUIRED (never falls back to memory)
```

| Environment | Selection |
| --- | --- |
| Development / test (default) | memory |
| Development with `TAXGUARD_LEDGER_STORE=durable` and a non-production Supabase project | durable (protected project refused) |
| Production | durable only when `TAXGUARD_LEDGER_STORE=durable` (set after the migration is applied); otherwise every ledger route returns 503 |

Responses carry `X-TaxGuard-Ledger-Store: memory | durable`.

## Schema (`docs/proposed-migrations/20261012240000_taxguard_durable_ledger.sql`)

Tables: `taxguard_ledger_counters`, `_accounts`, `_periods`, `_entries`, `_lines`, `_bank_transactions`, `_reconciliations`, `_reconciliation_items`. Money is `BIGINT` cents. Every table is keyed by `(tenant_id, client_id, …)` and every reference is a composite foreign key within that pair (a line cannot reference another client's account; an entry cannot reference another client's period). RLS enabled; no grants to `anon` / `authenticated`.

| Guarantee | Enforcement |
| --- | --- |
| Entry balances with ≥ 2 lines | Early check in the insert function and a `DEFERRABLE INITIALLY DEFERRED` constraint trigger (also blocks direct service-role writes) |
| One side per line, non-negative | `CHECK ((debit_cents > 0) <> (credit_cents > 0))` |
| Posted data immutable | Lines: insert only with their entry, no update / delete. Entries: only `PREPARED → POSTED / REJECTED / CORRECTION_REQUIRED`, reviewer fields, and a one-time reversal link; `version` increments on every change |
| Maker-checker | `CHECK (reviewer_uid <> creator_uid)`; review / close / reopen require reviewer roles; reopening a hard close requires a different person |
| Period locks | By posting date against every period of the client (not the supplied period ID): hard close accepts nothing, soft close only reviewed entries. Posting takes `FOR SHARE` on covering periods; closing takes `FOR UPDATE` |
| Close prerequisites | No `PREPARED` entry in the period |
| No overlap, immutable dates | Period trigger; creation serialized per client |
| Authority | Each RPC verifies: active tenant and client, active non-client staff member, and either administrator or a currently effective `ACTIVE` staff assignment for the client |
| Idempotency | `(tenant, client, idempotency_key)` unique with a request hash: same key + same body replays; different body → `LEDGER_IDEMPOTENCY_CONFLICT` |
| Bank duplicates | External ID unique per account (re-imports skipped); fingerprint matches flagged `POSSIBLE_DUPLICATE`; a transaction posts once (`journal_entry_id` unique, row lock) and is cleared into one reconciliation |
| Reconciliation | Variance computed in cents in SQL; finalize refuses unresolved variance; closed reconciliations immutable |
| Audit | Every mutation writes `taxguard_audit_log` (`LEDGER_*`, client in metadata); `taxguard_ledger_history` reads it per client |

Rollback (development, before any production data): drop the `taxguard_ledger_*` functions, then the eight tables (listed in the proposal header). Audit rows are retained.

## API additions (both modes unless noted)

`POST /chart-of-accounts/standard`, `POST /chart-of-accounts/:id/status`, `GET /journal-entries?q=&status=&fromDate=&toDate=&accountId=&limit=`, `POST /journal-entries` with `replacesEntryId`, `POST /journal-entries/:id/reject`, `POST /journal-entries/:id/request-correction`, `GET /reconciliations`, `GET /general-ledger`, `GET /history` (durable only). Durable mode additionally requires an `Idempotency-Key` header for postings and reversals and the entry `version` for review decisions.

## UI

Accountant → Bookkeeping → Ledger tab: *Periods & corrections* (periods, approve / return for correction / reject with recorded note, returned entries with reviewer note, reversal with a stable idempotency key) and *Search, general ledger & history*.

## Tests

`durableLedgerSql.test.ts` (22, includes simulated restart with on-disk PGlite; three database guarantees mutation-checked), `durableLedgerHttp.test.ts` (4, full synthetic cycle: chart → period → owner contribution → bank import and categorization → accrual returned for correction → replacement approved → reversal rejected → reconciliation → hard close → locked posting refused → trial balance, statements, general ledger, search, history; idempotent replay; client and unassigned-client refusals; production fail-closed), `ledgerMemoryWorkflows.test.ts` (6), UI tests (12).

## Limitations

- PGlite is single-connection: lock ordering and `FOR SHARE` / `FOR UPDATE` serialization are designed but **not** exercised under true concurrency. Needs a commissioned non-production PostgreSQL.
- Book-to-tax, document matching, provider sync and the bookkeeper dashboard are not on the durable store (503 in durable mode).
- Clients cannot read the durable ledger (the database refuses client actors); a client-facing projection is not built.
- In durable mode the chart of accounts is not auto-created on read; use *standard chart* (UI button not yet added).
- No year-end closing entries; prior-year income-statement activity is presented as "Retained earnings (prior years, unclosed)".
