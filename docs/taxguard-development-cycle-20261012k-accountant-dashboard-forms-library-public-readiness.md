# TaxGuard development cycle — 2026-10-12 (k) — Accountant dashboard redesign, Tax Forms Library, public-access readiness

**PRODUCTION STATUS: NO-GO.** Nothing in this cycle was deployed. The public website (https://artaxserv.com) is unchanged.

**Open issue (carried forward):** the owner's personal local Super Administrator sign-in remains **UNVERIFIED**.

- Sign-in reliability fixes: [taxguard-development-cycle-20261012j-super-admin-login-troubleshooting.md](taxguard-development-cycle-20261012j-super-admin-login-troubleshooting.md) (J-4 to J-9).
- Completion matrix rows: ACC-DASH-01, FORMS-01.

## 1. Accountant / Tax Preparer dashboard redesign

| Area | Implementation |
| --- | --- |
| Sidebar | My Work, Clients, Tax Workflow, Tools, Reports expand independently; icon-only mode (accessible names, hover and keyboard-focus tooltips); remembered per viewer; sticky; mobile drawer |
| KPI cards | Assigned Cases, Due Today, Overdue, Waiting on Client, Ready for Review, Client Approval, Ready to File. Unavailable metrics show "—" with the reason; real zeros show 0 |
| Workflow pipeline | Compact view of the existing 18 stages (unchanged); "—" when no case has a verified stage |
| Work queue | Search, quick filters, tax-year and stage filters, sortable columns (`aria-sort`), distinct empty states |
| Deadlines / Quick Actions | Recorded due dates only; actions limited to existing capabilities |
| Unchanged | Data hook, authorization, tenant isolation, Super Administrator inspection (layout only, figures unavailable) |

Verified in the browser at 1440 / 768 / 375 px with a synthetic accountant on a separate local server; colour contrast at least 5.3:1 for all new text pairs.

## 2. Tax Forms Library (`/staff/forms`)

| Item | Result |
| --- | --- |
| Federal forms | 63 entries; all forms and schedules in the directive plus Schedule 8812, Schedules A / B (Form 990), K-2 / K-3 (Form 1065), 1041-ES, 1120-X, 8868, 4768 |
| Eight core categories | 1040, 1041, 1065, 1120, 1120-S, 990, 706, 709 |
| Official sources | 59 verified on 2026-10-12 from official irs.gov pages (number and official name); 4 cataloged / reference only (1040-SR and K-1 (1041): number only; K-2 / K-3 and 1120-W: not confirmed) |
| States | 50 states + D.C., 15 tax categories each, year-aware (NH, IA, WA). No state form numbers; no income-tax return for the nine states without a general income tax; federal 706 / 709 separate from state taxes. All applicability **unverified** pending agency confirmation |
| Capabilities | Single source of truth (`src/taxForms/capabilities.ts`). Form 1040 and Schedule 1: prototype only (not authoritative). No form shows PDF, e-file or filing readiness as available (enforced by tests) |
| Access | `GET /api/tax-forms` — practice staff roles only; clients and recruiters refused; Super Administrator read-only; no write endpoints; no tenant or taxpayer data |

## 3. Why public Accountant access is not available (investigation, read-only)

| Layer | Finding |
| --- | --- |
| Public website | GitHub Pages (static), last deployed 2026-10-07 from `main`. `deploy-pages.yml` runs only by manual dispatch from `main`; the development branch never deploys. The deployed bundle predates the dashboard redesign and the library |
| Static vs backend | The UI (dashboard layout, library interface) is static code and can be served by GitHub Pages. Sign-in, role and tenant authorization, case data and the library catalog API require the hosted backend |
| Production API host | `api.artaxserv.com` → Render (via Cloudflare). On 2026-10-12, `/` and `/api/health` did not respond (timeout) |
| Production routes | `src/server/productionApp.ts` mounts auth (Supabase session only), AI governance, case authority, profile, stage workflow, bookkeeping and operations. **Not mounted:** `/api/accountant` (dashboard data), `/api/tax-forms`, `/api/super-admin` |
| Case data | The accountant dashboard read model uses the in-memory development store; production has no durable discovery source for accountant cases (E01) |
| Authentication | Production sign-in is Supabase only; the local server login returns 410 in production builds and is never offered by them. The server does not yet enforce MFA assurance level (AAL2) on Supabase sessions (P1-09; H06 / H09 / E03) |
| Staff identity | Requires a Supabase user plus an active `taxguard_members` row (tenant, role `accountant`); no production staff identity exists for this purpose and none was created |
| CORS / sessions | Production app allows only `https://artaxserv.com` and `https://www.artaxserv.com`; durable sessions via `SupabaseDurableSessions` |

## 4. Production plan (awaiting explicit approval — nothing executed)

1. **Backend (code, development branch):** mount the read-only `taxFormsRouter` in `productionApp.ts`; add a production accountant dashboard read route backed by durable case authority (not the in-memory store); keep `/api/super-admin` and all local-login routes unmounted in production.
2. **MFA:** enforce Supabase AAL2 for staff roles on `/supabase-session` and every staff API (decision H06 / H09; Supabase MFA configuration E03).
3. **Identity:** create the first production Accountant through Supabase invitation with enforced TOTP enrolment and a `taxguard_members` row bound to the tenant; never reuse local passwords, hashes or TOTP secrets.
4. **Database:** confirm the durable case / member schema on the production project with a reviewed migration plan and backups.
5. **Backend hosting:** restore and verify the Render service health, environment configuration (secrets in the host's secret store), logging, monitoring and alerting.
6. **Frontend:** merge the reviewed branch to `main` and run `deploy-pages.yml` manually.
7. **Verification:** independent security review (authorization, tenant isolation, MFA, §7216 consent), acceptance tests against production with a test staff account, and rollback rehearsal (redeploy the previous Pages artifact; revert the backend release).

## 5. Validation

Recorded with the synchronization of this cycle (see the final report).
