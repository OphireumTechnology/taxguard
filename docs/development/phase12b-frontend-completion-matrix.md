# Phase 12B frontend completion matrix (2026-10-15)

Evidence-based status of every user journey. A screen that renders is **not** counted as complete:
"Complete (local)" means the journey uses authorized durable APIs, shows server-returned state, has
loading / empty / error states, and is covered by a component test and/or a real-server browser test.
Nothing here is validated against staging or commissioned for production (no staging project exists).

Method: `node scripts/frontend/reachability-audit.mjs` traces every file reachable from
`src/main.tsx` and scans it for retired / legacy API calls, fabricated status claims, simulated
latency, native dialogs, mojibake, random identifiers and unlabelled controls. The guard test
`src/tests/frontendReachabilityGuard.test.ts` fails on any new violation. Findings were then
reviewed by hand; the defects fixed in this phase are listed at the end.

Status vocabulary: **Complete (local)** · **Partial** · **Truthfully unavailable** (blocked by a
missing backend capability or commissioning; the UI says so) · **Legacy (retained)** · **Gap**.

## Client portal

| Journey | Status | Evidence | Notes |
|---|---|---|---|
| Overview | Complete (local) | `clientDashboardMasterplan.test.tsx` | Server-reported workflow; unavailable values shown as unavailable |
| Engagement status / My Tax Returns | Complete (local) | client-portal reads (044); `clientPortalReadsAndReassignment.test.ts` | Draft / cancelled engagements hidden |
| Stage 01 onboarding | Complete (local) | `stageOneOnboarding.test.ts` | Badge now reflects the server status (was always "COMPLETED") |
| Stage 02 collection (questionnaire draft, requirements, applicability claims, clarification replies, uploads) | Complete (local) | E2E 13, E2E 14; `phase12bFrontend.test.tsx` | Now the only Stage 02 view; claims/replies use inline forms with server limits (no `window.prompt`) |
| Stage 03 validation | Truthfully unavailable to clients | `TaxStageStatusView`; `stageCapabilities.test.ts` | Performed by staff; client answers clarifications in Stage 02 |
| Stages 04–08 | Truthfully unavailable | `clientStageActionTruthfulness.test.tsx` | No client-scoped read of recorded evidence (contract C3) |
| Stages 09–18 | Truthfully unavailable (by policy) | `stageCapabilities.test.ts` (mirrors server policy 026), E2E 14 | No figures, signatures, filing or acknowledgements; explains why and what to do |
| Document uploads and vault | Complete (local) | `documentVaultHttp.test.ts`, E2E 04 / 14 | Quarantined documents not downloadable; legacy `/api/documents` list removed from the view |
| Document requests | Complete (local) | `documentRequestsHttp.test.ts`, `documentRequestsPanels.test.tsx`, E2E 05 | |
| Notifications | Complete (local) | `phase12bFrontend.test.tsx`, E2E 14 | New module; mark-read persists; no claim of e-mail/SMS delivery |
| Secure messages | Complete (local) | E2E 10 | |
| Appointments | Complete (local) | E2E 11 | |
| Consultation history | Gap | — | No client-scoped consultation history API (contract C1) |
| Advisor reassignment | Complete (local) | E2E 12 | |
| Legal coordination | Complete (local) | E2E 12 | Counsel hidden until the referral is recorded |
| Billing and invoices | Complete (local) | `billingHttp.test.ts`, `billingClientProjection.test.ts` | Database and router allow-lists; no live payments ("Invoices", not "Payments") |
| Account and security settings | Partial | `ProfileSecurityView` | MFA status displayed; client MFA management and notification preferences need contracts C2 / C6 |
| Refresh / re-authentication | Complete (local) | E2E 14 (`#nav=` restoration, token removal) | Unknown views in the hash are ignored |
| Phone / tablet layout | Complete (local, automated) | E2E 14 (no horizontal overflow at 375 px) | Manual assistive-technology audit not performed |

## Staff workspaces

| Workspace | Status | Evidence | Notes |
|---|---|---|---|
| Accountant | Complete (local) | E2E 04 / 06 / 14 | Added durable Case Workflow and Document Review panels (previously only on the manager dashboard); case tabs remain honest about unavailable integrations |
| Reviewer | Complete (local) | E2E 04 / 06 / 14 | Added Case Workflow (attestation) and Document Review |
| Practice manager | Complete (local) | E2E 02 / 04 / 11 / 12 / 13 | Clients, engagements, cases, documents, requests, billing, appointments, consultations, reassignment, legal |
| Bookkeeper | Complete (local) | E2E 03 | Book-to-tax workpapers (proposal 029) now reachable in the ledger workspace |
| Administrator | Complete (local) | E2E 01 / 08 / 11 / 14 | Staff invitations, MFA recovery, sessions, audit center, AI emergency stop, AI control center |
| Operations (client service) | Partial | `clientServiceAuthority.test.ts` | Read projections; no durable task queue contract |
| Staff onboarding wizard | Legacy (retained) | — | Uses in-memory `/api/onboarding` (contract C4) |
| Virtual consultation room | Legacy (retained) | — | Uses in-memory `/api/consultation-rooms` (contract C5); hardcoded participant names removed from the UI |

## AI Control Center

| Capability | Status | Evidence |
|---|---|---|
| A00–A60 inventory, registry status, emergency-stop state | Complete (local, live API) | `aiControlCenterRead.test.ts` |
| Commissioning readiness (registered, handler, tested, provider, approval, staging, production) | Complete (build evidence) | `phase12bFrontend.test.tsx`, E2E 14 | New tab; shows 0 provider-configured / approved / commissioned; AI-16 blocked; no enable / run controls |
| Execution history, decisions, security events, usage and human-review counts | Complete (local, live API) | existing tests |
| Live per-agent commissioning records | Gap | — | Contract C7 |

## Tax case interface

The client stage list and every stage view now come from `src/taxguard/stageCapabilities.ts`, which
mirrors the server stage policy (proposal 026) and is drift-tested against it. Stages 09–18 are
always shown as unavailable with the reason (verified tax engine, e-signature integration, filing
authorization, or upstream stages). The locked-stage screen reports the server's active stage instead
of the previous hardcoded "Stage 01 Cleared & Certified / Stage 02 In Progress".

## Public website

| Page | Status | Notes |
|---|---|---|
| Pricing | Fixed | Simulated "Stripe" checkout with a pre-filled fictitious customer and card and a "Payment Confirmed" screen replaced by an honest plan-request dialog (no payment, no card fields) |
| Contact | Fixed | Fake 800 ms "Message Transmitted … routed to Desmond Hinds" replaced by a hand-off to the visitor's own e-mail application; the never-uploaded attachment field removed |
| Book consultation | Complete (local) | Durable consultation requests (043), E2E 12 |
| `/public-v2/*` preview | Gap | Labelled demonstration forms generate local `AR-DEMO-…` codes; must not be released as-is |

## Defects fixed in Phase 12B

1. Client Stage 02 rendered a browser-local workspace (localStorage records, random identifiers) — now the durable workspace.
2. Client workflow router overrode server authority (Stage 01 → COMPLETED, Stage 02 → IN_PROGRESS / eligible) from browser hints.
3. Server Stage 03 rendered the browser-local validation workspace.
4. Stages 10–13 and 17 showed fabricated content (named CPA, "Filing Integrity 100% Certified", e-file pipeline claims); stage 16 had no view.
5. Locked-stage panel and Stage 01 badge made hardcoded completion claims; stage list used a mojibake separator.
6. Documents view mixed the durable vault with the legacy in-memory list.
7. Native `prompt` dialogs for applicability claims and replies.
8. Fake checkout and fake contact delivery on the public site.
9. Hardcoded consultation participants (fictitious client fallback).
10. Accountant / reviewer lacked case workflow and document review; book-to-tax was unreachable.
11. Client portal view was lost on refresh; navigation lacked a landmark and button types.

## Remaining frontend gaps

- 69 unreachable legacy components (listed by the audit) await an owner deletion decision; they are not reachable from any route.
- `/public-v2/*` demonstration forms.
- Client notification preferences, client MFA management, consultation history (contracts C1, C2, C6).
- Stages 04–08 client reads (contract C3).
- No DOM test library: interactive behaviour is verified in the real-server browser suite, not in unit tests.
- No manual screen-reader or colour-contrast audit has been performed; automated checks only.
