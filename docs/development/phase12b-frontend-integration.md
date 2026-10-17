# Phase 12B frontend ↔ Phase 12 backend integration (coordination with Codex)

Claude branch: `claude/taxguard-phase12b-frontend-completion` (frontend, UX, browser acceptance).
Codex branch: `codex/taxguard-phase12-staging-acceptance` (backend, database, infrastructure,
migrations, security, governed AI). Base for both: `main` at `dc9c96c` (Phase 11, PR #17).

Rules followed: no backend contract was invented or changed; no proposal, route or server module was
edited; Codex's branch and worktree were not read or modified during implementation. Where a
capability is missing the UI shows a truthful unavailable state.

## Existing contracts the Phase 12B UI relies on (committed in `main`)

| UI | Contract | Source |
|---|---|---|
| Client notifications module | `GET /api/vault/clients/:clientId/notifications`, `POST …/notifications/:id/read` → `{ unread, items: [{ notificationId, kind, requestId, title, channel, deliveryStatus, createdAt, readAt }] }`; kinds as in proposal 031 | `vault.routes.ts`, proposal 031 |
| Stage 02 collection | `GET /api/stage-two-three/questionnaire/:year?engagementId=`, `…/requests/:year`, `POST …/requirements/:year/:code/not-applicable`, `POST …/requests/:year/:id/respond`; reason 5–500, reply 2–4000 characters | proposals 053 / 054, `collection-durable.routes.ts` |
| Client stage views | Server stage policy (`taxguard_case_stage_policy`, proposal 026) mirrored in `src/taxguard/stageCapabilities.ts`; drift test parses the SQL | proposal 026 |
| Accountant / reviewer case and document panels | `/api/cases` (queue, detail, advance, return, hold), `/api/vault/review-queue`; staff of any active role, scoped in the database | `cases.routes.ts`, `vault.routes.ts` |
| Bookkeeper book-to-tax | `/api/book-to-tax/*` | proposal 029 |
| AI commissioning tab | `GET /api/provider-readiness` (AI provider status); agent gates from `src/ai/commissioningMatrix.ts` (build evidence) | `productionApp.ts`, Phase 10 |

**Integration risk for Codex:** if Phase 12 changes any of the shapes above (notification `kind`
values, collection length limits, stage policy, provider readiness record), the frontend tests named
in the completion matrix fail by design (`stageCapabilities.test.ts`, `phase12bFrontend.test.tsx`,
E2E 13 / 14). Please flag such changes so the UI can be updated in the same integration step.

## Required backend contracts (not invented; UI stays unavailable until they exist)

> Phase 13A update: C1–C8 are now implemented, partially implemented or prepared-but-disabled on
> `claude/taxguard-phase13a-contract-completion`. Current status, blockers and owner decisions are in
> `phase13a-contract-register.md`. The table below records the Phase 12B starting point.

| ID | Contract needed | Current UI behaviour |
|---|---|---|
| C1 | Client-scoped consultation history: the client's own consultation requests / converted appointments, read-only, tenant and client scoped | Not shown (appointments are shown) |
| C2 | Client MFA management (enrol / reset own factor) with recent-sign-in rules | Status displayed only |
| C3 | Client-scoped read of recorded stage evidence for stages 04–08 (status, attestation time, no staff identities) | "This stage workspace is unavailable" |
| C4 | Durable staff onboarding dossier (replaces in-memory `/api/onboarding/staff/*`) | Legacy route retained |
| C5 | Durable virtual consultation rooms (replaces in-memory `/api/consultation-rooms`); the legacy route still fabricates default participants (`'Michael Perotti'`, `'Desmond Hinds'` in `consultationRoom.routes.ts`) — backend fix needed | Legacy route retained; the UI no longer displays fabricated names |
| C6 | Client notification delivery preferences — only meaningful once e-mail / SMS delivery is commissioned | "E-mail and text delivery are not offered" |
| C7 | Server-side per-agent commissioning record (provider binding, approval, staging / production validation) so the AI commissioning view can show live state instead of build evidence | Build evidence, labelled as such |
| C8 | Contact enquiries received by the practice (an authenticated-delivery endpoint or a commissioned mail transport) | Hand-off to the visitor's own e-mail application |

## Conflicts and overlaps

- Read-only comparison at checkpoint time (no merge): Codex's branch at `ae9eaa5` changes 9 files
  (CI workflows, release-candidate migration guard, Phase 12 docs, `package.json`). The only file both
  branches change is the generated `docs/taxguard-master-traceability.json`: after either branch
  merges, rebase the other and run `node scripts/build-local-traceability.mjs`.
- None found with `main`. Files touched by Phase 12B are frontend components, services' consumers,
  CSS, tests, one E2E update (`13-durable-collection` now uses the inline reply form instead of a
  native dialog) and documentation.
- If Codex modifies `DurableClientCollectionWorkspace.tsx` or `AuthenticatedClientDashboard.tsx`,
  expect a merge conflict; resolve in favour of the durable APIs and keep the Phase 12B guards
  (`frontendReachabilityGuard.test.ts`).

## Recommended integration order

1. Merge Phase 12 backend (Codex) first if it changes any contract listed above; otherwise either order.
2. Rebase Phase 12B on the new `main`; run `npm run test`, the default and provider E2E profiles,
   and `node scripts/frontend/reachability-audit.mjs`.
3. Implement C3, C1 and C7 next (largest client-visible and AI-visibility gaps), then C4 / C5 so the
   last legacy in-memory routes can be retired.
