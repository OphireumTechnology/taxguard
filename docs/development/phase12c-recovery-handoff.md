# Phase 12C interruption recovery — 2026-10-15

## Inspected state and preservation

Claude worktree: `D:/TaxGuard/Development/123-claude`.
Original branch: `claude/taxguard-phase12c-frontend-integration` at
`da72b3d39c957c90205c5a912925ff889fa80cc9`. This is the Phase 12B commit,
published on `claude/taxguard-phase12b-frontend-completion` and merged through PR #19.
The Phase 12C branch has no unique committed changes, no staged changes and no remote branch
of the same name (`git ls-remote` returned no matching ref).

Six modified files and one untracked file were present:

- `src/components/admin/PracticeAdminWorkspace.tsx`
- `src/components/documents/ClientDocumentVaultPanel.tsx`
- `src/components/portal/AuthenticatedClientDashboard.tsx`
- `src/components/portal/dashboard/ClientNotificationsPanel.tsx`
- `src/components/workspace/BookkeeperDashboard.tsx`
- `src/components/workspace/PracticeManagerDashboard.tsx`
- `src/hooks/useHashView.ts` (untracked)

These are local unfinished files, not GitHub contents. Before continuation, all seven files
were copied byte-for-byte to the ignored Codex directory
`.taxguard-backups/phase12c-claude-20261015/`, with SHA-256/size manifest, original Git status,
binary-capable tracked patch, and a verified Git bundle for the committed branch history.
The bundle requires the already preserved Phase 11 baseline `dc9c96c`.

The exact recovered bytes were checked against the manifest, then committed locally as
`c7138f5` on `codex/taxguard-phase12c-claude-snapshot`, explicitly labelled **unvalidated**.
The continuation branch `codex/taxguard-phase12c-frontend-recovery` starts from that snapshot,
on current `origin/main` merge `6c3390c`. No mutating Git operation or source-file write was made to Claude's
worktree. Original Codex Phase 12 branch remains at `bbbd592`.

The original Codex Phase 12 branch and committed Phase 12B work overlap only in generated
`docs/taxguard-master-traceability.json`. None of Claude's seven unfinished paths overlap the
Codex Phase 12 branch. This continuation intentionally uses the current merged frontend base;
PR #18's backend/recovery changes remain on their existing branch.

## Continued implementation

- Client notifications: supported kind descriptions, unread filter, persisted read receipts,
  request navigation, neutral unknown-kind text and explicit loading/error/unavailable/session
  states. Malformed successful responses fail closed. Failed receipts retain unread state.
- Session protection: a token-change event contains no token payload; the dashboard subscribes
  so its read caches also reset on token changes. Client notification,
  request and vault panels remount across token, identity, tenant, role/status and lifecycle
  changes. Read sequences and mutation locks prevent stale completions. Multi-step upload/link
  checks session continuity before the next mutation. Expired vault/request responses clear
  only the session that made the request; a late 401 cannot revoke its replacement.
  Cross-tab logout clears matching stale sessionStorage copies and expires the visible identity;
  delayed events from an older login cannot clear a newer session.
- Navigation: allowlisted staff hashes for administrator, practice manager and bookkeeper,
  with Back/Forward/reload restoration, no duplicate selection history and guarded setters.
  Client views listen for both history and hash changes.
- Replacement UX: latest actionable version only, locked original engagement/year/category,
  empty file selection on start/cancel/success, input focus, mutation lock, retry feedback and
  existing server idempotency/version authorization. New versions remain quarantined.
- Accessibility: named replacement category control, keyboard-focusable scroll regions for wide document
  tables, labelled action column, live confirmation, explicit unread state, focus restoration
  and mobile navigation regression coverage. Notification text contrast is measured from
  browser-converted sRGB colors (including Tailwind OKLCH), with a 4.5:1 minimum.
- Windows browser fixture configurations use installed Edge instead of requiring an absent
  cached Chromium binary. Generated acceptance artifacts are retained locally and ignored by Git.

## C9 — document-review metadata confidentiality (OPEN)

`taxguard_doc_json` in proposal 027 returns `uploadedBy`, `uploaderRole`, `reviewedBy`,
`reviewNote` and review timestamps without an audience distinction. Both `taxguard_doc_list`
and `taxguard_doc_detail` call it for client actors. Detail also exposes audit action/actor
history. `src/server/routes/vault.routes.ts` forwards store results without a client projection.
Client authorization and tenant isolation do not establish that these staff metadata fields
are appropriate for disclosure to the authorized client.

This increment suppresses review notes in client presentation and shows neutral replacement
guidance. **C9 is not fixed:** data remains observable in API responses, and the frontend
cannot enforce confidentiality. Do not use internal confidential review notes in a client
environment until the backend projection is corrected and reviewed.

Required follow-up: define an explicit client-safe list/detail projection, omit staff identities
and internal review/history metadata, separately define client-addressed replacement guidance,
preserve the authorized staff projection, and add HTTP plus real PostgreSQL tests for both
audiences, versions, statuses and tenant boundaries. Use a new reviewed migration proposal if
the RPC projection changes; preserve existing migration history and do not apply externally.
C9 remains a staging acceptance blocker.

## Integration order and boundaries

1. Phase 12B is already merged through PR #19; do not reapply its commit.
2. Review and integrate Codex Phase 12 PR #18 first (offline backend/recovery readiness).
3. Then review this dedicated Phase 12C continuation against updated main. The shared generated
   traceability JSON must be regenerated with `node scripts/build-local-traceability.mjs`,
   rather than selecting one branch's generated file. Rerun integrity/unit/database/browser gates.
4. Close C9 in a separate backend confidentiality change before hosted client acceptance.

No automatic merge, deployment, external migration, production Supabase access, live provider
commissioning or material AI action is authorized. The original Claude branch remains unchanged.
Automated local accessibility evidence does not certify manual screen-reader usability or
product-wide WCAG conformance. Staging and production remain NO-GO.

## Validation

| Check | Result |
|---|---|
| Full frontend/unit/security suite | PASS; 327 files / 5,575 tests |
| New Phase 12C unit regressions | PASS; 30 tests |
| Focused cross-tab/expiry/storage check | PASS; 3 files / 41 tests |
| Full disposable PostgreSQL suite | PASS; 15 files / 51 tests |
| Phase 12C browser regression file | PASS; 10 tests on a fresh server, including cross-tab logout |
| Full E2E default profile (frozen source, fresh server) | PASS; 14 files / 79 tests; command exited 0 after both profiles |
| Full E2E provider profile | PASS; 1 file / 8 tests; loopback emulation only |
| Dashboard fixture browser/accessibility checks | PASS; 36/36 at 390, 768 and 1280 px; zero skipped/flaky/unexpected |
| Frontend/server build and synthetic fixture build | PASS; build artifacts only |
| TypeScript/lint | PASS |
| Traceability | PASS; 220 requirements, 61 agents, 18 stages; broader release browser acceptance remains NOT VERIFIED |
| Secret scan | PASS; 1,397 files / 108 binary skips, zero findings |
| Whitespace and preservation checks | PASS; all seven original/snapshot file hashes still match |

Dashboard fixture evidence: `qa/acceptance-results/browser-cd0d3a04-7919-42f3-9a7a-733dfc6ff30d/results.json`
(ignored local output).

Failures and corrections were retained as evidence: three initial Phase 12C browser harness/selector
failures (browser import transformed by Vite, exact category name, manager navigation label);
one unit assertion that assumed the old expiry-event order; missing cached Chromium prevented the
first 36 fixture checks from launching; and the first full default E2E run exposed the contrast
test's incorrect treatment of OKLCH as RGB. The browser converts colors to sRGB now; all nine
Phase 12C contrast checks pass with the original 4.5:1 requirement. A second full run passed
78/79 default tests, with the cross-tab check failing on a server started before that fix was
added; the fresh-server ten-test run then passed. The final fresh full run on frozen source
passed all 79 default and eight provider tests, exit 0. No safety assertion was removed or skipped.

The snapshot is preservation evidence, not a passing implementation claim. Final commit and
remote PR/CI evidence are recorded in the delivery response and review description.
