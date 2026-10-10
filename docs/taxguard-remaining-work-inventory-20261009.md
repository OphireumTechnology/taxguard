# TaxGuard remaining-work inventory — 2026-10-09

This is a source-grounded local inventory, not a production-readiness certificate. COMPLETE means the stated bounded implementation is present and locally verified, not that the entire role or agent is finished. APPROVED AND ACTIONABLE covers independent local corrections within existing scope. BLOCKED identifies a technical, environment or policy dependency. REQUIRES HUMAN APPROVAL identifies commissioning, provisioning or new privileges forbidden in this session. No approval is inferred from a passing suite.

## Verified starting state and sources

No applicable AGENTS.md was found by workspace search excluding dependencies, Git internals and the protected backup. Existing tracked/untracked changes were inspected and retained. Current baseline verification: `npm.cmd test` 133 files / 2,567 tests PASS, exit 0, 63.11 seconds; `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` PASS. Existing calendar import and 850 kB chunk warnings remain.

Sources: canonical architecture, checkpoint, autonomous reports through Cycle 7, dashboard Gates 1–8, AI Gates 1–16 pre-review, legacy mapping, role hooks/components/projections/routes, production app, profile route, provider registry and current regression suites. Historical gate “next” statements are superseded by subsequent implementations; incomplete commissioning statements remain applicable. Later rows must be updated against new evidence as work proceeds. Unspecified product requirements cannot be declared complete from this repository.

## Role workflows and user experience

| Requirement | Classification | Evidence / remaining dependency |
| --- | --- | --- |
| Client authenticated shell, scoped records/checklist/actions/year selection | COMPLETE | Client dashboard/model/hooks and access/masterplan/session tests; bounded recorded data only. |
| Client one-time onboarding and versioned profile reads | COMPLETE | Existing onboarding/profile flows and local HTTP tests; see separate consent/provenance correction below. |
| Client account-wide appointments/messages/invoices and state requirements | BLOCKED | Contracts lack some engagement/year/timezone semantics; state advice needs verified rules; no inferred year association. |
| Accountant assigned-case queue and exact-scope projections | COMPLETE | Accountant route/projection/API tests; authority outages sanitized as 503. |
| Accountant session-token invalidation and selected-artifact cache recovery | COMPLETE | Corrected full-session/assignment keys and artifact clearing; 11 new hook tests pass in the full suite. |
| Accountant AI preparation, complete lineage, original-file preview, revision/version comparison, filing-readiness telemetry | BLOCKED | No commissioned scoped assistant, evidence discovery or filing timestamps; protected mutation controls need durable authority. |
| Reviewer bounded queue/workspace, recorded evidence, maker-checker UI | COMPLETE | Reviewer projection/routes/tests, Cycle 6 session recovery; production queue guard refuses volatile discovery. |
| Durable reviewer queue discovery and professional decisions | BLOCKED | Requires verified durable discovery/hydration adapter and cutover; no in-memory production fallback. |
| Bookkeeper scoped ledger/transaction/journal/period read projection and session recovery | COMPLETE | Gate 6 and Cycle 5 tests; no claim of live bank feeds or posted financial statements. |
| Bookkeeper categorization/reconciliation/adjustments/period close/audit feed | BLOCKED | Durable accounting adapter, immutable audit, scoped human controls and reporting contracts required. |
| Practice Manager bounded authorized operational queue/KPIs | COMPLETE | Gate 7 projections/HTTP tests and Cycle 7 recovery; missing metrics shown unavailable. |
| Practice Manager capacity/SLA/history/reassignment | BLOCKED | No authoritative capacity/SLA/event contract or released durable mutation service. |
| Client Service scoped queues, explicit client-visible selected content, identifier search | COMPLETE | Gate 8 projection/authority/HTTP tests; internal-only messages omitted. |
| Client Service selected-content/search cache clearing and invalid-year denial | COMPLETE | Corrected child scope, invalidation, tenant/year search eligibility and stale reads; 22 new hook tests pass. |
| Client Service booking/send/read receipts/escalation/response-time reports | BLOCKED | Exact scope, ownership/SLA, durable provider and audited mutation contracts absent. |
| Administrative screen truthful operational state | COMPLETE | Removed fabricated records and commissioning claims; authorized provider-configuration read and unavailable modules covered by 24 new tests. |
| Administrative durable tenant staff/job/billing/audit/retention integrations | BLOCKED | Existing admin HTTP isolation tests do not establish durable UI providers, production policy or per-record grants. |
| Billing/Finance dashboard and later unimplemented role experiences | REQUIRES HUMAN APPROVAL | Gate 8 explicitly leaves new Gate 9 scope unapproved; no financial action privilege inferred. |
| Shared role-aware navigation, mobile background inert and responsive CSS | COMPLETE | Shell/access/render tests and accessibility report; bounded markup behavior. |
| Authenticated mobile/tablet/browser/screen-reader interaction QA | BLOCKED | No isolated synthetic authenticated browser fixture established; render tests do not prove interaction or screenshot fidelity. |
| Loading/empty/error/sanitized retry states | COMPLETE | Bounded role read-state and HTTP tests; continue correcting independently confirmed gaps. |

## Canonical 18-stage workflow

Persisted identities are LEGACY_18_V1, not the visual reference numbering. Existing stage gate/lifecycle/durable-authority tests cover local server controls, not real external operations.

| Stage | Classification of remaining product work | Remaining dependency |
| --- | --- | --- |
| 01 Onboard | BLOCKED | Independent provenance/minimization and strict supplied-boolean corrections COMPLETE with HTTP/hook/render regressions. Durable commissioning and consent sufficiency still require authoritative approval; existing absent-flag compatibility is not a new attestation policy. |
| 02 Collect | BLOCKED | Production document release depends on durable intake/storage and commissioned clean malware transport; quarantine must remain closed. |
| 03 Validate | BLOCKED | OCR/extracted-fact approval/semantic evidence integrations must be verified; no fixed-sample extraction release. Narrow A10 duplicate metadata advisory is locally complete. |
| 04 Record | BLOCKED | Durable reviewed-fact/accounting adapter and lineage; no AI material recording allowed. |
| 05 Reconcile | BLOCKED | Durable accounting/evidence adapters and scoped human reconciliation controls. |
| 06 Review | BLOCKED | Complete source/calculation/form lineage and durable professional decision provider; bounded advisory and human rejection/return infrastructure complete. |
| 07 Report | BLOCKED | Verified period/journal/return reporting and durable history, no invented balances. |
| 08 Plan | BLOCKED | Reviewed facts, independently verified authority/rules and commissioned advisory policy. |
| 09 Prepare Taxes | BLOCKED | Deterministic local libraries exist; full reviewed-fact/rule binding and production specialist integration not established. |
| 10 Approve | BLOCKED | Required independent attestations and authoritative material action profile unresolved. |
| 11 Sign | REQUIRES HUMAN APPROVAL | Verified signature provider, immutable proof and taxpayer authorization commissioning. |
| 12 File | REQUIRES HUMAN APPROVAL | Filing/transmitter credentials, approved package and human transmit authorization. |
| 13 Government Feedback | REQUIRES HUMAN APPROVAL | Commissioned receipt transport and durable scoped association. |
| 14 Resolve | BLOCKED | Authoritative notices/response evidence and independent human/provider action contracts. |
| 15 Monitor | BLOCKED | Durable status/receipt and deadline/SLA history, no autonomous contact. |
| 16 Archive | REQUIRES HUMAN APPROVAL | Durable archive verification, approved retention/legal holds and production commissioning. |
| 17 Renew | BLOCKED | Durable scoped engagement/consent renewal and authorized human operations. |
| 18 Repeat | BLOCKED | Safe annual rollover contracts; prior-year facts/expired consent must not become current-year authority. |

Local transition validation, evidence refusals, maker-checker and provider fail-closed controls across these stages are COMPLETE within tested scope. No end-to-end production lifecycle completion is claimed.

## AI, security and persistence

| Requirement | Classification | Evidence / remaining dependency |
| --- | --- | --- |
| Exact A00–A60 registry and identity mapping inventory | COMPLETE | 61 preserved identities; DRAFT registrations and default denial. |
| A00 bounded routing, independent authorization, no inherited grants | COMPLETE | A00 orchestration/governance tests; only established A10/A34 purposes, isolated handlers. |
| Gateway/model/prompt/capability/usage/immutable execution ledger infrastructure | COMPLETE | AI-1–6 local SQL/provider-double tests; no commissioned production execution. |
| A01–A04, A05–A09/A11, A12–A33/A35, A36–A60 specialist implementation | BLOCKED | Missing individual mappings, stages, evidence/action authority; category names are not permissions. |
| A10 duplicate-byte advisory and A34 two counts-only review purposes | COMPLETE | Bounded compatibility only; no fraud/OCR/tax fact verification or full specialist completion. |
| Human A34 RETURN/REJECT service | COMPLETE | AI-15 strict scope/evidence/role/reason/replay/atomic-transition tests; final APPROVED unavailable. |
| AI-16 material actions and PREPARER → REVIEWER → CPA/EA attestation | BLOCKED | Exact action/target/roles/stage/evidence/idempotency, distinct attestation source/chain and durable adapter unresolved. No material write allowed. |
| Dependent AI-17–20 gates (W-2, control center, adversarial release, final release) | BLOCKED | Canonical sequential pre-review requires AI-16; independent existing security regressions may be maintained without claiming these gates complete. |
| Authentication, server roles, assignment/tenant/client/year denial controls | COMPLETE | Auth/access/durable-authority and role HTTP regression suites; bounded local evidence. |
| RLS default deny, private storage and immutable record constraints | COMPLETE | Existing local/disposable SQL tests; actual deployed roles/grants/RLS not verified. |
| Cross-role session/cache isolation | COMPLETE | Accountant/child Client Service gaps corrected; Reviewer/Practice Manager/Client Service parent keys now invalidate changed assignment context within the same token. Regression coverage passes locally. |
| Recorded consent/profile truthfulness | COMPLETE | Server projection preserves supplied evidence, avoids generated documents/default classifications, filters document metadata by exact tenant/client; live profile/security/audit UI no longer substitutes sample records or fabricated successes. |
| Consent validity for new sensitive-data use/disclosure/provider export | BLOCKED | No approved broader data-use/consent mapping; counts-only paths must remain narrow and raw taxpayer export denied. No legal sufficiency claim from a boolean. |
| Sensitive-data minimization, quarantined evidence, protected-data denial | COMPLETE | Scoped read/gateway/document tests; no tokens/raw documents/secrets in new audit records. |
| Durable role read adapters, volatile legacy service replacement | BLOCKED | Exact schema association/cutover contracts absent; local Maps must not become production authority. |
| Distributed dispatch fencing, PostgreSQL failover and real receipt reconciliation | REQUIRES HUMAN APPROVAL | Commissioned infrastructure and deployment verification; PGlite cannot prove distributed guarantees. |
| Live memberships/assignments, agent/model/prompt/pricing/provider activation | REQUIRES HUMAN APPROVAL | Provisioning/credentials/commissioning prohibited in this session. |
| Schema installation/migrations, deployment/publication and release review | REQUIRES HUMAN APPROVAL | Explicitly prohibited; generated migration files are not applied. |

## Validation and operations

| Requirement | Classification | Evidence / next action |
| --- | --- | --- |
| Reverify Cycle 7 baseline | COMPLETE | Current 133 files / 2,567 tests, typecheck/build/diff PASS, exit 0. |
| Regression tests for independently confirmed read/UI gaps | COMPLETE | Added synthetic real-hook, authenticated HTTP and render regressions; see consolidated report for exact completed runs. |
| Targeted subprocess execution | BLOCKED | Targeted commands intermittently fail esbuild `spawn EPERM`; record actual execution results. Existing full-suite command currently works without elevation. |
| Historical AI-12–14 “validation in progress” status reconciliation | COMPLETE | Reports now record PASS WITH RESTRICTIONS for executed denial controls; specialists remain unbuilt and denied. |
| Current checkpoint, consolidated evidence and remaining-work tracking | COMPLETE | This inventory, canonical checkpoint and one dated continuous report maintained; no separate duplicate cycle reports. |
| Calendar mixed static/dynamic import warning | COMPLETE | App import aligned with existing static consumers; warning absent in completed build. |
| Oversized frontend bundle and measured loading-performance work | BLOCKED | Build succeeds with main bundle above 850 kB; performance thresholds/browser fixture and scoped bundle work remain unspecified. Do not raise the limit to conceal the warning. |
| Operational monitoring/recovery/runbooks and deployed least privilege | REQUIRES HUMAN APPROVAL | Local infrastructure tests are available; commissioning/incident procedures and real environment verification require responsible humans. |

## Additional live-stage findings and disposition

Approval (10) and renewal (17) previously reported success using local state without a server action. Those forms are now explicitly unavailable; they cannot submit, commission a year or fabricate approval. Existing server routes and policies are unchanged.

Stages 04/05/07/09/16/18 legacy components construct reads with hard-coded tenantA and inferred engagement IDs. Stage 06 seeds reviewed checklist items and fictional professional names; Stage 08 seeds planning savings; Stage 14 claims zero exceptions without a provider; Stage 15 invents applicable deadlines and monitoring/retention claims. Live client routing now uses a controlled unavailable surface for these ten stages and their aliases. Stage 03 and independent signature/filing/feedback routes remain under their existing controls. Legacy templates are retained as existing work and are not evidence of integrated functionality. Connecting these stages is BLOCKED on exact authorized scope, durable providers, recorded evidence and applicable approved policy; no broader grants or tax advice are invented.

Discovered independent corrections above are COMPLETE after the recorded integrated validation. No currently identified APPROVED AND ACTIONABLE implementation item remains in this inventory. New requirements or authoritative contract/policy evidence can establish future work; this is not a claim that all product requirements are implemented. Remaining BLOCKED and REQUIRES HUMAN APPROVAL items remain unresolved and must not be bypassed.
