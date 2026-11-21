# Multi-agent development integration and release pipeline

**Status:** proposed with release candidate `rc` (2026-11-22). The workflows and guard in this repository take
effect once they are merged into `main`. The repository settings in section 5 are recommendations and need the owner's
approval; nothing here changes GitHub settings, Railway or Supabase.

GitHub is the single source of truth for code.
- **Frontend:** GitHub Pages serves the static site at `destriataxservices.com`.
- **Backend:** Railway hosts the API server (`npm run build` → `node build/server.cjs`).
- **Database and storage:** Supabase PostgreSQL and private Storage.

Railway and Supabase follow reviewed `main` releases and version-controlled migrations. Neither is a source of
application logic.

## 1. Branches

| Branch | Owner | Purpose | Deploys |
|---|---|---|---|
| `aistudio/**` (for example `aistudio/frontend`) | Google AI Studio | Frontend, branding, responsive design, UI | never |
| `claude/**` | Claude Code | Backend, security, workflow, database, integration | never |
| `chatgpt/**` | ChatGPT | Source-code repairs and audits | never |
| `integration/taxguard` | integrating agent, owner review | Unified integration: each agent branch arrives by pull request | never |
| `rc/taxguard-YYYYMMDD` | integrating agent | Release candidate: frozen, fully accepted, then a pull request to `main` | never |
| `main` | owner | Protected production source | only through `deploy-pages.yml` (section 4) |
| `sync/**` | existing convention | Exact-head validation pushes | never |

Development CI (`taxguard-development-ci.yml`) runs on every push to all of these branches, on pull requests to
`main`, `integration/**` and `rc/**`, and on every push to `main` with no path filter.

**Do not use `release/**` for new work.** The legacy `release/destria-verified-pages` branch carries its own
push-triggered Pages deployment workflow (section 5).

## 2. Google AI Studio

**Preferred:** point the AI Studio GitHub sync at `aistudio/frontend`, then open a pull request
`aistudio/frontend → integration/taxguard`.

**If AI Studio can only sync the default branch of a repository** (isolated synchronization), use this, subject to
owner approval:
1. Connect AI Studio to a separate repository (for example `OphireumTechnology/taxguard-aistudio`) that contains only
   what AI Studio edits.
2. An import step (a manual `git fetch` by the integrating agent, or a reviewed workflow) brings that repository's
   `main` into `aistudio/frontend` here.
3. Integration proceeds by pull request as above.

**Until one of these is in place,** AI Studio pushes directly to `main`:
- Development CI and the integration guard now run on every such push.
- A failing push never reaches production, because the deploy workflow needs a successful CI push run for the exact
  commit.
- A damaging push still changes `main`'s content. The integrating agent reconciles its legitimate changes on a
  `claude/**` or `integration/**` branch, as was done for `75775a1`.

**Before AI Studio's next edit after a release candidate is merged,** its workspace must be refreshed from GitHub
`main`. Otherwise its next sync writes its old tree back, and the guard flags every recovered file it would remove.

## 3. Source protection (`scripts/integration-guard.mjs`, run by Development CI)

The guard compares every update with its base: the pre-push commit for a push, the base branch for a pull request.
It fails when:

| Rule | Meaning |
|---|---|
| `MIGRATION_IMMUTABLE` | An existing file under `supabase/migrations/` is modified, renamed or deleted. Corrections are new migrations. |
| `PROTECTED_DELETION` | A file is deleted under a protected path and its exact path is not listed in `docs/development/approved-deletions.json`. <br>**Protected paths:** `supabase/`, `docs/proposed-migrations/`, `docs/development/`, `src/server/`, `src/services/`, `src/supabase/`, `src/taxguard/`, `src/types/`, `src/tests/`, `src/tests-db/`, `src/tests-e2e/`, `tests/`, `scripts/`, `.github/workflows/`, `server.ts`, and the master traceability matrix. |
| `SERVICE_STUBBED` | A browser service client, Supabase client or server route that called the API or the database at the base no longer contains any such call. This is the "real service replaced by a mock" pattern. |

These checks run alongside the existing ones:
- lint, typecheck and build;
- the unit suite (which includes the real-contract service tests, the D1 stage-verdict retirement tests and the release workflow contract tests);
- the branding check;
- offline migration and readiness integrity;
- the evidence-hash verifier, which flags any unreviewed change to a pinned evidence file;
- the secrets scan;
- the disposable PostgreSQL suite, which includes the 18-stage gate engine security tests.

Measured on this repository:
- the damaging 2026-11-16 sync (`1ad03a5 → c5bc3e4`) gives 858 violations;
- replacing the release candidate with AI Studio's `main` (`75775a1`) gives 485 violations;
- the release candidate against `main`'s base passes.

**Approving a deletion:** add the exact path, reason and owner decision to `approved-deletions.json` in the same pull
request. The file is reviewed like code (section 5).

## 4. Release pipeline (`deploy-pages.yml`)

1. **Validate.** A commit reaches `main` through an approved pull request, or an AI Studio push until section 2
   applies. Development CI validates that exact commit.
2. **Release candidate.** When that CI push run succeeds, `deploy-pages` builds a release candidate artifact. It
   requires the commit to be on `main` with a successful CI push run, then:
   - checks out exactly that SHA;
   - repeats typecheck, tests, the branding check and the production configuration check, then builds;
   - stamps the release.

   The stamp:
   - appends the commit to every public brand asset URL, which invalidates cached logos and icons;
   - writes `CNAME` `destriataxservices.com`;
   - writes `dist/version.json` with the commit, ref, workflow run, build time, the validating CI run and the checks
     repeated.

   A failure at any step stops the release.
3. **Deploy (approval).** Run `Deploy TaxGuard Production to GitHub Pages` manually with the exact 40-character SHA.
   Automatic deployment of validated `main` commits happens only if the owner sets the repository variable
   `PAGES_AUTO_DEPLOY=true`.
4. **Record.** The published commit is shown in the deployment summary and at `https://destriataxservices.com/version.json`.

### Rollback

1. Find the last good release commit: GitHub → Environments → `github-pages` deployment history, or that release's
   `version.json`.
2. Run `deploy-pages` manually with that SHA. It is on `main` and has its successful CI run, so it qualifies.
3. Confirm `version.json` shows the rolled-back commit.

The frontend rollback does not touch Railway or Supabase. Backend and database rollback follow
`docs/development/backup-restore-runbook.md`.

## 5. Settings for owner approval (not applied by any agent)

1. **Branch protection for `main`:**
   - require a pull request with at least one approving review;
   - require the status check **Build and test (synthetic data only)** (Development CI) to pass, on an up-to-date branch;
   - block force pushes and branch deletion;
   - restrict direct pushes. This also blocks AI Studio's direct `main` sync, so decide section 2 first.
2. **Branch protection for `integration/taxguard` and `rc/**`:** require Development CI.
3. **Code owners (owner's GitHub handle):** require code-owner review for the protected paths in section 3, for
   `docs/development/approved-deletions.json` and for `.github/workflows/`.
4. **The `github-pages` environment:**
   - add required reviewers (an approval step on every deployment);
   - restrict deployment branches to `main`;
   - leave `PAGES_AUTO_DEPLOY` unset unless automatic deployment is wanted.
5. **Legacy release branch:** retire or protect `release/destria-verified-pages`. Its own workflow deploys Pages on
   pushes to it, outside this pipeline.
6. **Domain transition:**
   - remove the legacy `artaxserv.com` hosts from the CORS, recovery and static-host lists once that domain is retired;
   - set the GitHub variable `VITE_PASSWORD_RESET_CONTINUE_URL` and the Supabase Auth redirect allow-list to `destriataxservices.com`;
   - set the API server's allowed origins on Railway accordingly;
   - confirm the `contact@` mailbox domain.
