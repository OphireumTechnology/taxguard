# Phase 7 reviews: MFA recovery, AI agents, tax engine (2026-10-13)

## MFA recovery and staff security (Block 5) — confirmed, no change needed

| Control | Where enforced | Evidence |
|---|---|---|
| Independent approval (requester ≠ approver ≠ target) | 010/011 superseded by 034 | `mfaRecoveryCompletion.test.ts`; E2E provider 09 (requester's approval refused) |
| Recent AAL2 sign-in (900 s) for privileged actions | `taxguard_privileged_session` (034) | stale (20 min) approval refused in the browser, E2E provider 09 |
| Factor reset only through the fenced job; success only from an empty fresh inventory | 034, `mfaResetProvider.ts` | `mfaResetProvider.test.ts`, `mfaRecovery.db.test.ts` |
| Session revocation on approval and on reactivation | 034 | E2E provider 09 (open staff session gets 401) |
| Provider-only recovery sign-in, never bridged into a TaxGuard session | `StaffMfaRecoveryEnrollmentFlow` holds the provider-only lease | E2E provider 09 (no `/api/auth/supabase-session` call) |
| Tenant membership verification | membership in the configured tenant | E2E provider 09 (other tenant / non-member refused) |
| Audit history without reasons or factor material | 037 | `mfaRecoveryHistory.test.ts` |
| Replay / idempotency | same-actor replay resumes (`resumed`/`replayed`), others refused | E2E provider 09 |
| Fail-closed errors | P0001 codes mapped; unknown → unavailable | unit suites |

**Blocker:** no separate non-production provider project is configured, so the real-provider
validation (`scripts/provider-validation/mfa-admin-validation.ts`, procedure in
`provider-mfa-validation.md`) has not been run; it refuses with `NON_PRODUCTION_PROJECT_NOT_CONFIGURED`.
Emulated coverage continues (E2E provider profile).

## AI agents A00–A60 (Block 6) — audit only; nothing newly enabled

- Implemented and tested: governance control plane (kill switches GLOBAL/AGENT/MODEL/TOOL/WORKFLOW),
  governed AI gateway (model/prompt/schema/budget/pricing/usage validation), scoped capability
  executor (`document.read`, `workflow.read`; READ only), A00 orchestrator with an immutable
  orchestration ledger and execution ledger, human proposal review, and one supervised document
  workflow: **A10 document duplicate check** (`DocumentDuplicateAdvisory.ts`) — deterministic hash
  comparison over selected, released, scan-clean documents; output is ADVISORY,
  `human_review_required: true`, `authoritative_mutation: false`, no model call.
- Routed tasks: two (A10 duplicate check, A34 workflow read). Advisory handlers are injected only in
  test executions; the server registers none, so no agent executes outside tests.
- Not operational: the other registered agents (registration ≠ operation), any live model provider
  (none commissioned), model-backed classification or extraction, and every material action.
- **AI-16 material-action chain remains blocked** (`taxguard-ai-agent-gate-ai-16-pre-review.md`): it
  needs an explicit governance decision on the first record-writing operation, the
  preparer → reviewer → CPA/EA attestation chain and the durable target adapter. Not bypassed.
- Next safe step (needs owner decisions first): commission a non-production model provider through
  the gateway, then extend the A10 workflow with a model-backed classification proposal reviewed in
  the existing human review service — with prompt-injection tests on document text, cost/usage
  records and the kill switches. No autonomous filing, ledger mutation or client communication.

## Tax engine (Block 7) — confirmed

- Rule sets are explicitly versioned and content-hashed (033); approval needs a different
  authorized reviewer (maker-checker) and verified sources for the tax year.
- Verification cases (036) and coverage (038): every declared output and every filing-status
  variant plus the default path must be covered by a passing run of the current cases before
  submission or approval.
- Synthetic fixtures are labelled (`syntheticFixtures.ts`, jurisdiction `ZZ`, `synthetic_test`
  authorities, "not tax law"). TaxGuard ships no rules or cases.
- Without an approved rule set a calculation run is refused; staff work queues show stages 9–18 as
  "Blocked until a verified tax engine exists". No result is presented as authoritative.
