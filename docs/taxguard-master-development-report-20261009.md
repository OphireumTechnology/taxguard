# TaxGuard master development execution — 2026-10-09

Subsequent verified state: see [2026-10-10 release-readiness report](taxguard-release-readiness-20261010.md). Latest integration suite is 164 files / 3,098 tests PASS, exit 0; the original master evidence below remains preserved history. Production recommendation remains NO-GO with external/governance/browser dependencies.

This directive supersedes the earlier independent-task scope limit. The product is unfinished; safe synthetic preparation is now authorized. No production readiness or external commissioning is inferred from local passing tests. Existing work through Cycle 7 and the later continuous resume is preserved. Original repository and preservation backup are excluded from all work.

## Baseline and audit

Canonical source: `taxguard-ai-canonical-architecture.md`, its registry/mapping, LEGACY_18_V1 contracts, dashboard gate reports and current checkpoint. The supplied architecture workflow image was inspected: its illustrative post-stage-04 labels do not supersede persisted stage identities. The multipage architecture/page-9 per-agent authorization matrix remains absent. Individual unmapped agents cannot be implemented as authorized specialists by copying group capabilities.

Actual baseline: `npm.cmd test`, 142 files / 2,709 tests PASS, exit 0, 69.72 seconds. Targeted execution was attempted once for the first increment and failed before tests with esbuild `spawn EPERM`; subsequent increments use the permitted full-suite path without repeated retries or escalation. Existing migrations remain unapplied outside disposable test databases.

## Increment 1 — AI-16 preparation and request replay integrity

Added `MaterialActionPreparation.ts`: strict draft-only policy shape, exact scope, workflow identity, bounded unique field/evidence references and ordered PREPARER/REVIEWER/CPA_EA requirements. Deeply detached/frozen design artifacts never certify evidence, identities, credentials or attestations. Assessment always denies authorization and execution. No route, target handler, migration, activation flag or production write is introduced.

Repaired legacy `DurableIdempotencyService`: binds reservations to request fingerprint and provider, rejects scoped-key delimiter collisions, retains ambiguous/completed reservations after expiry, prevents terminal-history rewriting and detaches returned/internal results. Explicit failed reservations may retry only the same request. This remains a process-local simulation, not durable production idempotency.

Validation: 144 files / 2,752 tests PASS, exit 0, 70.33 seconds; typecheck and frontend/server build PASS. 43 new tests. Main bundle remains 1,355.37 kB / 304.01 kB gzip at this milestone. Final diff integrity checks recorded at integration milestones.

## Increment 2 — SQL metadata reader preparation

Added a disabled-by-default SQL adapter with synthetic-test-only execution. Exact tenant/client/case/engagement/year, active durable membership/client/engagement/year, canonical preparer/reviewer identity and effective dual assignments are required. Assignment locks, repeated session/authority checks, minimized metadata and transactional synthetic audit are enforced. Only known rolled-back serialization failures retry once. No production connection factory, HTTP integration, new role grant, provider activation or material action exists. Disposable SQL regressions cover revocation, scope mismatch, audit outage, disabled production and retry boundaries. Validation: 145 files / 2,775 tests PASS, exit 0, 69.54 seconds; typecheck/build/diff PASS. 23 new regressions. This is metadata-reader preparation, not a complete durable case/artifact replacement.

## Increment 3 — unknown workflow evidence

Nine stage gates (04/05/06/07/09/10/13/14/15) previously treated missing, null, false, empty or NaN exception counts as zero. Each now requires explicit numeric zero; missing counts remain unknown in evidence metadata. Stage 03 requires an explicit boolean required-review policy and rejects malformed AI-only indicators while preserving its documented optional absent indicator. No transition/role/approval chain is added. 119 new regressions include all approvals present with missing evidence. Full suite: 146 files / 2,894 tests PASS, exit 0, 99.38 seconds; typecheck/build/diff PASS.

## Increment 4 — OCR preparation

Untrusted cloud OCR response parsing preserves zero confidence, represents absent confidence conservatively at zero, validates field/value/page shapes and bounds response/entity/text sizes. Native preparatory transport binds actual nonproduction bytes to the supplied hash, limits source size, validates processor endpoints, refuses redirects, bounds request/body consumption and sanitizes failures. Production native filesystem export is refused until a commissioned authorized released-vault source exists. Existing injected synthetic provider tests remain; no live call or provider activation. See the official [Document model](https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/Document) and [process endpoint](https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors/process) for field/page/resource representations. Validation in progress; no extracted candidate is verified by parsing alone.

## Remaining work and evidence limitations

The traceability matrix and companion JSON cover every available A00-A60 identity, all 18 canonical stages (gate and product separately), role experiences and shared controls. They classify bounded implementations separately from unfinished products and identify absent architecture authority. Full local development completion and production readiness are not established. Durable artifact hydration, specialist policy, regulated proof, browser acceptance and real services remain blocked as itemized in `taxguard-master-remaining-decisions.md`.

## Increment 5 — role loading and session boundaries

Role workspaces/public routing now load through lazy boundaries. Initial main JavaScript fell from 1,355.37 kB / 304.01 kB gzip to 316.14 kB / 72.94 kB gzip; largest lazy client chunk is 783.65 kB. No bundle warning at the existing 850 kB threshold; no user latency claim. Active authenticated staff and client checks precede rendering, unknown roles return login, and loading status is accessible. Nineteen SSR regressions cover roles, initialization, missing IDs and inactive/expired/unknown sessions. New fixtures required two corrections (React streaming comments and omitted active status); controls were retained.

## Increment 6 — truthful readiness and claim ownership

Configuration alone now reports nonoperational provider status; synthetic overrides operate only in tests and cannot commission production. Six-table core schema reachability is explicitly insufficient for full migration/RLS verification. Legacy job completion/failure requires an active claim owned by the exact worker; unclaimed, wrong-worker and terminal mutations are refused. This does not add distributed fencing or durable queues. Full suite at this milestone: 150 files / 2,956 tests PASS, 82.81 seconds; typecheck/build/diff PASS.

## Increment 7 — isolated QA preparation and traceability

Prepared a synthetic shell with fake context, CSP network denial, module isolation guards, localhost-only static serving and isolated environment configuration. Six negative module tests and fixture TypeScript pass. Separate fixture build failed before compilation with sandbox esbuild `spawn EPERM`; no retry, elevation, browser launch or interaction acceptance claim. Added four traceability coverage regressions. Full suite: 152 files / 2,966 tests PASS, 75.32 seconds. Root and fixture typecheck PASS. Integration/security/commissioning reports and nonloaded disabled configuration template are prepared.

## Increment 8 — core audit guard proposal and strict bridge evidence

The existing core audit migration labels history append-only but has no mutation trigger. Prepared SQL outside the migration chain because the required Supabase CLI is unavailable. Disposable PostgreSQL tests permit inserts and reject owner/server-role UPDATE, DELETE and TRUNCATE CASCADE; failed transactions preserve history. Test-only broad truncate grants deliberately challenge the trigger; no application grants change. Trigger owners can disable protection; independent custody and reviewed official migration remain required. Workflow bridge now requires literal boolean true before forwarding; downstream authority is unchanged. Seven malformed-value regressions accompany eight audit tests. Initial full run identified two fixture FK-before-trigger errors and an obsolete source-text assertion; corrected without relaxing protection. Final results are recorded below and in the checkpoint.

## Acceptance status

LOCAL DEVELOPMENT COMPLETE: **not established for the full product**. Bounded increments are locally validated; remaining product rows require the identified policy, infrastructure or execution dependencies. EXTERNAL COMMISSIONING REQUIRED and GOVERNANCE APPROVAL REQUIRED. PRODUCTION READY: **not established**. No commit, push, merge, deployment, shared migration, production access, original-repository/backup access or AI-16 material write occurred.

## Final validation evidence

`npm.cmd test`: **154 files / 2,981 tests PASS**, exit 0, 72.26 seconds. Increase from verified master baseline: 12 test files / 272 tests. Root TypeScript and `npm.cmd run lint` PASS (lint currently invokes TypeScript); synthetic fixture TypeScript PASS. Frontend and backend build PASS, 6.17 seconds frontend, no bundle warning; main 316.14 kB / 72.94 kB gzip, lazy client 783.65 kB / 169.50 kB gzip. `git diff --check` PASS with non-failing line-ending warnings. Targeted and separate fixture builds were blocked before execution by sandbox spawn EPERM; full suite covers the new regressions, while browser acceptance remains unavailable. These results do not verify deployed RLS, external provider behavior or production readiness.

Increment 4 OCR milestone passed 147 files / 2,922 tests, exit 0, 76.12 seconds; earlier “validation in progress” text above is historical and superseded by this evidence. Every bounded increment has passed the final integration suite. Final source inventory/matrix regenerated after reporting. No new authorized transition, role grant, human attestation or successful external delivery is inferred from a test fixture.

Execution stops at the documented authority/infrastructure/sandbox dependencies. Completing their dependent features would require inventing authority, certifying unverified durability or bypassing the recorded environment restriction. The isolated browser fixture and SQL proposal remain explicitly uncommissioned. This is a development and gap report, not a statement that all product functionality is implemented.
