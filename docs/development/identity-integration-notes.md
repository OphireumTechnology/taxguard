# Staff identity integration notes

Development branch: sync/taxguard-development-20261011. Production status remains NO-GO.

## Implemented boundary

The browser enrolls and verifies TOTP through Supabase Auth. The server independently verifies the external identity, confirmed email, enrolled factor count and AAL2 before invitation acceptance. Acceptance stores only the invitation token hash and creates pending_approval membership without a client identifier or an application session. Administrator activation uses an active, AAL2 session in the deployment tenant and a transaction that rejects the invitation maker and the target as approver.

The proposed acceptance RPC is service-role only, has a fixed public search path, locks the invitation row, serializes staff acceptance by external UID, and writes audit in the same transaction. The browser cannot execute it. SQL fixture tests use synthetic in-memory PostgreSQL and never apply migrations to Supabase.

The existing production session bridge blocks invited email addresses before client auto-provisioning. If the invitation table is unavailable, new-client provisioning fails closed with STAFF_INVITATION_STORE_UNAVAILABLE. This is an intentional dependency and must be accounted for before any future release.

## Remaining implementation

1. Invitation creation: validate canonical email and allowed staff role server-side; cryptographic 32-byte tokens, hash-only persistence, expiry, bounded administrator issuance and audit. Expose the token only to the authorized administrator once; no email sending without a commissioned delivery adapter.
2. Lookup and acceptance HTTP API: avoid token-in-URL logging, require verified provider identity and confirmed email, bound rate-limit storage, return neutral invalid-token errors. No application session before activation.
3. Signup UI: validate password policy, preserve the invitation during email confirmation without placing it in query strings or telemetry, enroll TOTP, submit acceptance, display pending approval. Replace the legacy in-memory acceptance path.
4. Lifecycle: suspend/deactivate and revoke durable sessions transactionally; reactivation requires independent approval and a fresh provider AAL2 login. Never reuse the prior application session.
5. Concurrency: client auto-provisioning and invitation acceptance need a shared database transaction/lock contract. The current client provisioning path is not atomic with staff acceptance and invitation creation; this remains a release blocker.
6. MFA recovery: require independent administrator approval, record reason and audit, suspend membership and revoke sessions before removing a provider factor. Provider factor deletion must be handled by an idempotent recovery job with retryable failure state. Leave access suspended on any provider failure; activate only after verified re-enrollment and fresh AAL2 proof. No staff self-service factor-removal bypass.

## Verification limits

Passing unit, HTTP and SQL fixture tests establish local synthetic behavior. They do not validate browser interaction, delivery, a commissioned non-production Supabase project, recovery operations, or production readiness. No production credentials or services were used.

## Development HTTP integration

The development server mounts /api/staff-access. The production app does not. Default access is 503 unless TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED=true, an approved non-production Supabase URL/service credential and authoritative tenant are configured. The protected project is explicitly rejected. No credentials or environment files were changed. Tests inject synthetic clients and verified identities.

POST /invitation/lookup and /invitation/accept require providerAccessToken and token in the JSON body; no raw invitation token in URLs. Administrator POST /invitations, /invitations/:id/revoke and /members/:uid/approve require durable application authority with AAL2. Responses are no-store; local abuse limits are bounded, and SQL separately enforces distributed administrator issuance limits.

Issuance and HTTP services are implemented locally. Staff signup/acceptance UI replacement, membership suspension/reactivation, shared client provisioning transaction, integration browser testing and MFA recovery remain open. Historical invitation records intentionally keep an email staff-reserved after expiry/revocation; reissue is supported, conversion to client needs explicit lifecycle policy.

## Security review corrections

All four identity proposals are composition-tested against actual core migrations. Epoch proof is primaryAuthTime from the verified JWT AMR, never refreshed iat or mutable user.last_sign_in_at; missing/invalid/stale proof fails closed after status changes. Database auth_time stores that token-bound primary time when available. Same-second epoch proofs are denied because provider timestamps have second resolution.

The shared provider-only coordinator stays active until outstanding parent and child MFA promises finish and provider logout succeeds. Failed logout keeps suppression active; no secret is retained by that coordinator. Canonical administrator aliases use the same tenant/AAL2 authorization.

New TOTP enrollment, signup, and provider-only invitation operations are disabled in production builds and require VITE_TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED=true with a non-protected browser project. Existing verified staff AAL2 challenge enforcement remains unchanged. No project flags or credentials were configured in this session.

## Staff administration directory

GET /api/staff-access/members and /invitations require active same-tenant AAL2 administrator authority through the existing development-only router. Reads return explicit DTOs and source=durable; never invitation hashes or provider/factor metadata. Limit defaults25/max50; keyset cursors bind tenant, directory kind and status but do not grant permission. Raw microseconds are preserved and ID ordering uses C collation consistently.

The existing users tab now consumes these APIs, showing loading/empty/unavailable/error/ready states. Mutations require server confirmation and refresh rather than optimistic access grants. All sensitive forms, pending actions/reasons, response notices and once-only invitation tokens are session keyed and cleared on account changes/unmount. Directory response parsing strips additional fields. New operations are refused before transport outside explicitly approved development configuration or when the configured target is a protected public API.

### Durable identity/intake boundary

Default configured sessions now require durable authority even without the staff development flag. New and returning client identities use the same atomic RPC/DTO; confirmed provider email is required, permanent ID/profile/onboarding progress cannot be replaced by mutable provider metadata. RPC errors/partial mappings fail closed. The session bridge and client-onboarding routes cannot initialize/promote a process-local hierarchy in durable configurations; they report DURABLE_ONBOARDING_PROVIDER_REQUIRED.

Proposal006 requires audited client-owner uniqueness/counter commissioning and real PostgreSQL concurrency verification. Proposed007 intake drafts require an existing real active engagement/year; submission records client input only, never review approval/stage completion. Intake services remain unmounted. Provider identity generations now hide invitation/MFA secrets and reject stale operations; live browser/provider integration remains unverified.
