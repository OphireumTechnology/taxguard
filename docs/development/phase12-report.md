# Phase 12 local development report

## Baseline and scope

- Repository: `OphireumTechnology/taxguard`
- Baseline: merged Phase 11 commit `dc9c96c072031e8949aeb07be2691664361675c2` on `origin/main`
- Development branch: `codex/taxguard-phase12-staging-acceptance`
- Scope delivered in this checkpoint: source-backed feature-gap inventory and an offline staging migration release-candidate verifier with a tested external-target refusal boundary.

## Implemented in code

`npm run staging:migration:release-candidate` verifies the canonical migration manifest and
source checksums, composes the full 61-entry dependency-ordered set and its review packet on two
independent disposable loopback PostgreSQL instances, checks selected row-level security and
`SECURITY DEFINER` search-path invariants, replays the 36 proposal files already covered by the
PostgreSQL replay contract, and compares schema fingerprints. The command fails closed when
arguments, Supabase/provider variables, PostgreSQL/libpq variables or a custom disposable-database
directory are inherited. It does not grant proposal approval, run Supabase CLI validation or
access an external database. The 13 `NOT VALID` constraints are surfaced for human/data review;
they are not counted as validated.

The verifier is also included in the Linux pull-request CI workflow and the Windows offline
release-readiness workflow. The final GitHub run for the workflow change is tracked in the PR.

`phase12-feature-gap-matrix.md` records implementation classifications, code/test evidence and
remaining policy, professional or commissioning boundaries for 22 requested domains. It
distinguishes local workflow foundations from full business acceptance and production release.

## Locally validated

| Gate | Result |
|---|---|
| Clean `npm ci` | PASS; 244 packages added, zero reported vulnerabilities |
| Unit and security suite | PASS; 323 files / 5,485 tests |
| New migration-command safety tests | PASS; 11 tests |
| Disposable local PostgreSQL | PASS; 15 files / 51 tests |
| Browser default profile | PASS; 12 files / 58 tests |
| Browser provider-emulator profile | PASS; 1 file / 8 tests; emulator only |
| TypeScript and repository lint | PASS; both run `tsc --noEmit` |
| Production build | PASS; build artifact only, no deployment |
| Migration release candidate | PASS; 61 manifest and review entries; 36 replay-safe proposals; matching schema fingerprint `bd422820b1f04ed6b0bf10306ebae0f2bb2b9587946a3bea10a880f9ca964458` |
| Database smoke checks | PASS; loopback `127.0.0.1`; 0 public tables without RLS; 0 matching `taxguard_%` security definers without pinned search paths; 13 unvalidated constraints reported |
| Manifest and review packet | PASS; 61 entries, review-only, no external application |
| Traceability | PASS; 208 requirements, 61 agents, 18 stages; traceability still marks broad browser acceptance unverified |
| Secret scan | PASS; 1,384 files scanned, 108 binary files skipped, no findings |
| Git whitespace check | PASS |

## Not validated or commissioned

Staging and production remain **NO-GO**. No staging project, API host, domain, managed secrets,
real identity provider, storage, malware scanner, AI provider, bank feed, calendar, payment
processor, e-signature service or filing provider was accessed or commissioned. No external
migration or deployment occurred. Real-provider MFA, Supabase CLI validation, external backup
recovery, independent deployed tenant acceptance and production operations are not validated.

The feature matrix preserves the existing safety boundaries: stages 09–18, live filing,
signatures, live payments and AI-16 material actions remain disabled pending their technical,
owner and professional prerequisites. Current local emulator/browser results are not staging
validation and do not imply production commissioning.

## Resume checkpoint — 2026-10-15

The repository was clean on `codex/taxguard-phase12-staging-acceptance` at `ae9eaa5`.
After fetching origin, `origin/main` remained the Phase 11 merge `dc9c96c`; the existing
Phase 12 branch was three commits ahead with no missing main commits. Existing PR #18 is
being resumed. No history was rewritten and all existing development was preserved.

Implemented this increment:

- Both recovery commands now reject caller arguments, ambient Supabase/database/libpq settings
  (including service and password files, even empty values) and custom database directories
  before importing the disposable database harness. Errors expose no configured values.
- Added 20 safety regressions, including execution of both real command entry points with
  a forbidden service-file environment. Explicit backup utility paths remain supported.
- Added `npm run staging:recovery:local` and included it in Linux PR CI and Windows offline
  readiness. The rehearsal uses durable local servers, an independently approved synthetic
  invoice, security audit, restore, and actual PostgreSQL restart. It verifies all restored
  rows/schema, the exact issued invoice client projection, explicit tenant denial, and
  audit immutability after restart. Cleanup attempts both owned servers even on failure.
- Physical backup cleanup now attempts server and owned archive cleanup even when connection
  shutdown fails. Updated the recovery runbook and traceability evidence.

Current local verification (exit 0 unless explicitly stated):

| Gate | Result |
|---|---|
| Full unit/security suite | PASS; 325 files / 5,516 tests |
| Added recovery command regressions | PASS; 1 file / 20 tests |
| Disposable PostgreSQL suite | PASS; 15 files / 51 tests |
| Browser default profile | PASS; 12 files / 58 tests |
| Browser provider profile | PASS; 1 file / 8 tests; loopback emulator, not real MFA commissioning |
| TypeScript and lint | PASS |
| Frontend/server build | PASS; build only |
| Migration release candidate | PASS; 61 entries, 36 replay-safe proposals, unchanged matching fingerprint; 13 NOT VALID constraints still reported |
| Strengthened logical recovery | PASS; 141 tables / 7,193 synthetic rows; export 613 ms, restore 2,719 ms; restart persistence, billing projection, tenant isolation and security audit immutability PASS |
| Physical utility recovery | BLOCKED; command refused with BACKUP_TOOLS_REQUIRED, exit 1; neither pg_dump nor pg_restore discovered |
| AI readiness inventory | PASS; 61 identities, 3 bounded handlers, 0 commissioned; material actions disabled |
| Manifest/review bundle and remaining-work inventory | PASS; review-only; 0 staging-validated and 0 production-commissioned areas |
| Final traceability, secrets and whitespace | PASS; 208 requirements / 61 agents / 18 stages; 1,387 files scanned, 108 binaries skipped, no findings |

Windows sandbox attempts initially failed with `spawn EPERM`; the safety test and validation
commands were rerun through the escalation mechanism. No assertion was weakened or skipped.

This increment is recovery and acceptance tooling, not completion of missing professional
workflows. Full client intake-to-filing acceptance, real-provider MFA, scanner detection,
approved tax content, specialist AI handlers, hosted storage/restore and staging infrastructure
remain unvalidated or uncommissioned as recorded in the feature matrix. No external migration,
production access, live provider call, deployment, merge or material AI action occurred.

## Delivery checkpoint

This report is updated before the feature-branch commit. The final commit SHA, PR URL and
GitHub Actions conclusion are recorded in the delivery response after branch publication and
CI completion. No automatic merge is authorized.
