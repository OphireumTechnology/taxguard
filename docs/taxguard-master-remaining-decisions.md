# Remaining human decisions and external dependencies

The product remains incomplete. These are dependencies, not invented approvals. Safe bounded preparations and negative tests do not complete the dependent product feature.

Continuation evidence: 175 files / 3,255 local tests PASS; core RLS policies now have 12 executable disposable non-owner role regressions, not deployed acceptance. Anonymous real-product coverage is now 21 prepared checks, NOT VERIFIED. Remote GitHub CI status was not independently retrieved. H01-H09/E01-E08 remain unresolved; authorized QA/platform owners must supply actual isolated identities/provider fixtures for authenticated journeys. No new approval is inferred.

| ID | Required authoritative decision or evidence | Dependent functionality |
| --- | --- | --- |
| H01 | Supply the missing multipage/page-9 per-ID responsibility, stage, tool, data and evidence mapping for A00-A60; reconcile illustrative numbering with LEGACY_18_V1 | All unapproved specialist implementations and dispatch |
| H02 | Approve versioned model, prompt, purpose, pricing, budgets, risk and human-review policies for each agent | Activation of DRAFT registrations and provider dispatch |
| H03 | Define AI-16 exact action, service, target fields, stage, prerequisites, maker/checker identities, CPA/EA distinctness, completed attestation proof and idempotency | Material writes; AI-17 through AI-20 dependent release gates |
| H04 | Counsel/practitioner approval of §7216 purpose, recipient, disclosure/use, duration, revocation and acceptable evidence | Sensitive-data transport and provider exports |
| H05 | Approve durable source-to-target artifact/version/scope associations, reconciliation and cutover ownership | Full SQL role workspace hydration and process-local replacement |
| H06 | Define missing Billing/Finance, Security/Compliance, Executive/Owner role visibility, audit visibility and endpoint capabilities | Illustrative administrative dashboards and financial operations |
| H07 | Approve jurisdiction/year tax rule coverage, licensed practitioner review, signature/transmission and authoritative receipt contracts | Full 18-stage regulated product completion |
| H08 | Define engagement/year ownership, communication visibility, booking/timezone/SLA and retention/legal holds | Calendar, communications, archival and operations |
| H09 | Select incident owners, recovery objectives, monitoring thresholds and independent acceptance reviewers | Operational runbooks, backup/recovery and release signoff |
| E01 | Authorized isolated Supabase/PostgreSQL environment, least-privilege roles and schema review; available CLI to create reviewed migration | Durable cutover and core audit append-only proposal installation |
| E02 | Private released vault, malware scanner and verified byte/hash/region/consent-bound OCR source | End-to-end document pipeline |
| E03 | Approved identity, authentication/session revocation and provider credentials supplied outside this session | Real provider health and authorization acceptance |
| E04 | Commission accounting OAuth, payments, signatures, filing, messaging/calendar with durable receipts | Real integrations; local simulations cannot certify delivery |
| E05 | Durable atomic idempotency, distributed leases/fencing, audit custody and replay reconciliation | Restart/failover-safe jobs and irreversible external actions |
| E06 | Windows synthetic-shell Chromium evidence verifies 36/36; 18 partial anonymous actual-product checks are prepared but NOT VERIFIED; independent authenticated browser/screen-reader/mobile acceptance still required | Infrastructure/QA owners supply reviewed isolated synthetic actual application at 127.0.0.1:4180 for partial checks, then scoped identity/durable fixtures and full workflow automation. All 29 full-product journeys remain NOT VERIFIED; known Codex build/browser restrictions are not bypassed |
| E07 | Isolated platform-role RLS/storage tests, backup/PITR/vault restore drills and adversarial security review | Release acceptance and deployed isolation evidence |
| E08 | Authorized deployment environment, artifact/configuration review, migration/cutover and rollback approval | Deployment; never performed here |

No production service, credential, original repository or preservation backup is required to read these artifacts. Do not resolve dependencies by assigning permissive defaults. Existing migration definitions, adapters and synthetic fixtures are preparation evidence only.

## Decisions raised on the Claude branch (2026-10-12)

| ID | Decision needed | Current conservative default |
| --- | --- | --- |
| HC1 | Which canonical stages may be completed by human attestation, by whom, and with which checklist items (proposal 026 `taxguard_case_stage_policy`) | Stages 02, 03, 06, 07, 08 attestable by the case's independent reviewer only; 01, 04, 05 system-verified; 09-18 blocked |
| HC2 | Staff-initiated client creation before the client has a portal identity, and how it allocates the permanent client ID (must align with proposal 006) | Not implemented; only existing client records are managed |
| HC3 | Whether authorized representatives / additional contacts are stored, with what consent and retention | Not modelled |
| HC4 | Which durable practice endpoints a practice manager may call through the global capability list | Explicit list (clients/engagements/team/tasks/deadlines/notes, cases, document review, billing except card payment), only while the development-only durable routers are configured; never production |
| HC5 | Who may maintain tax content (register sources, draft and submit rule sets) and who may verify / approve it; whether any rule set may ever unblock stage 9 | Maintain: admin, practice manager, senior reviewer, reviewer, accountant. Verify sources / approve rule sets: senior reviewer, reviewer, admin, never the author. Run review: the case reviewer only. Stage 9-18 stay blocked; no rule set unblocks them |
| HC6 | Recent-sign-in window for privileged staff actions; who may reactivate after MFA recovery; reset retry policy | 15 minutes; any administrator other than the target (maker and checker may also reactivate); 5 attempts with exponential back-off, then administrator re-queue |
| HC7 | Whether only super administrators may invite administrators | Unchanged: any administrator may invite; activation requires a different administrator |
