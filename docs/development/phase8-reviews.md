# Phase 8 reviews: AI document-review readiness, tax engine, database guarantees (2026-10-14)

Status vocabulary: **implemented in code** · **validated in local tests** · **validated in isolated
staging** (nothing yet: no staging project) · **commissioned for production** (nothing).

## Database security and concurrency guarantees added in Phase 8

| Guarantee | Mechanism | Local evidence |
|---|---|---|
| No overlapping active appointments per staff member or per client | transaction-scoped advisory locks (staff key, then client key — fixed order) + overlap re-check in the same transaction; half-open `[start, end)` ranges | ten simultaneous overlapping bookings across two clients on real PostgreSQL: exactly one succeeds (`appointments.db.test.ts`); unit mutant without the staff check fails |
| Idempotent create and every change | caller-derived IDs; per-record `request_key` unique in the event table; replay returns the recorded state | concurrent identical retries record one row (DB test); replay tests (unit) |
| Lost updates prevented | `version` must match; trigger enforces `version = old + 1` | version-conflict tests |
| Valid state transitions only | state machines in the functions; terminal rows frozen by trigger | invalid-transition and direct-UPDATE tests |
| History and evidence integrity | append-only event / evidence tables (triggers); appointments and matters never deleted | immutability tests |
| Tenant / client isolation | every function derives scope from membership (`taxguard_doc_actor`, `taxguard_practice_can_see`); other tenants, unassigned staff, other clients refused | unit, DB and E2E negative tests |
| Audit disclosure | audit center returns allow-listed identifiers/codes only, counts withheld fields; never IP addresses, reasons, bodies, amounts, secrets | redaction tests with deliberately sensitive synthetic payloads; mutant allowing `reason` fails |
| Privileges | every new function service_role-only, pinned `search_path`; tables revoked from anon/authenticated, RLS enabled | composition security tests (PGlite and real PostgreSQL) |

## AI governance — readiness assessment for supervised document review (Block 8)

Target flow: document received → validated → evidence associated with a case → advisory analysis →
authorized human review → auditable decision. **Not activated.**

| Element | State |
|---|---|
| Document received / validated | implemented and validated locally: vault upload, scan quarantine, staff review (027) |
| Evidence associated with a case | implemented: document requests (031), case evidence checks (026), legal evidence links (042) |
| Agent scopes and tool allow-lists | implemented: capability registry; only `document.read` / `workflow.read` (READ) for A10 / A34 |
| Model gateway | implemented: model / prompt / schema / budget / pricing / usage validation; no provider commissioned (**B**) |
| Provider selection | not started — owner decision |
| Human review and proposal lifecycle | implemented: human proposal review; AI-15 correction / rejection only |
| Material actions (AI-16) | **blocked by design** until the action, attestation chain and durable target adapter are decided |
| Audit trails | implemented: orchestration and execution ledgers, audit log |
| Kill switches | implemented: GLOBAL / AGENT / MODEL / TOOL / WORKFLOW |
| Tenant isolation | implemented: scoped read repository, per-tenant capability grants |
| Prompt-injection protection | implemented for structured output (untrusted document text cannot grant tools/actions); no live-model red-team run (no provider) |
| Token and cost controls | implemented in the gateway (budget, pricing, usage); never exercised against a live model |
| Error handling | deterministic failure codes; fail closed |

Operational agents: **none** outside tests. Registered agents (61) are not operational because they
are registered. No autonomous filing, signatures, payments, client communications or accounting
mutations exist or were enabled.

## Tax engine (Block 9) — confirmed unchanged

Rule sets are versioned and content-hashed (033); approval needs a different authorized reviewer;
verification cases (036) and structural coverage of every output and filing-status variant (038)
gate submission and approval; synthetic fixtures are labelled (`synthetic_test`, jurisdiction `ZZ`,
"not tax law"); without an approved rule set calculation runs are refused; stages 9–18 remain
blocked and are labelled "Blocked until a verified tax engine exists". Return generation and
electronic filing are not implemented and are not presented as operational. No tax rule was added.
