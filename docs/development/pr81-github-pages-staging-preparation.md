# PR #81 — Isolated GitHub Pages staging preparation (review only)

Source: PR #81 commit `a36341a599d79484fcf77f69d7058e34f84c48cf`.
Target staging repository (not yet created): `OphireumTechnology/taxguard-staging`.
Proposed public URL (not yet active): `https://ophireumtechnology.github.io/taxguard-staging/`.
Staging Supabase project: `kypaordrnbziagfuxnet`.
Production GitHub Pages site and workflow are out of scope.

## Release gates (all mandatory)
- [ ] Create a separate GitHub repository and explicitly configure its Pages source.
- [ ] Review repository visibility and ensure staging contains no real customer data.
- [ ] Use an immutable PR #81-derived reviewed commit; do not merge PR #81 or PR #83.
- [ ] Implement an explicit staging origin and path policy, with fail-closed validation of the host and Supabase project reference.
- [ ] Make Vite's base `/taxguard-staging/` in staging builds only; preserve production's root base.
- [ ] Route `/taxguard-staging/admin/reset-password` through the static Pages fallback, preserving Supabase PKCE query and recovery fragment without exposing tokens to logs.
- [ ] Validate all generated JS/CSS assets under the staging base; ensure no production CNAME is included.
- [ ] Require `VITE_SUPABASE_URL=https://kypaordrnbziagfuxnet.supabase.co` and a staging publishable/anon key, supplied securely in the staging repository. Do not copy production keys.
- [ ] Validate all API origins are explicitly approved staging services, or disable API-dependent features. Never fall back to production.
- [ ] Configure Supabase staging Site URL and exact callback allowlist only after the staging site is live; do not add production callbacks to staging.
- [ ] Configure and verify staging SMTP, reset-password template, email rate limits, and delivery logs.
- [ ] Run typecheck, full tests, admin recovery tests, static artifact scan, deep-link/callback tests, and authorization/MFA checks.
- [ ] Explicit owner approval required before first staging deployment or sending a recovery test email from the new frontend.
- [ ] Independently review staging evidence before requesting separate production merge/deploy approval.

## Safeguards
No workflow in this preparation branch deploys anything. Do not run the existing `.github/workflows/deploy-pages.yml`, change DNS, production variables, secrets, production Supabase settings, or merge any PR. The staging project is a separate Supabase project, not a GitHub deployment environment.
