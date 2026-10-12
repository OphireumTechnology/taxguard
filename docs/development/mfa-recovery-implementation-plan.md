# Staff MFA recovery implementation boundary

Production NO-GO. Request/independent approval/pending-outbox foundation is now implemented locally; end-to-end recovery and provider authorization remain absent. Existing AAL2 staff gate and mfa_reenrollment_required denial remain mandatory. No factor deletion or production operation has occurred.

## Next coherent transaction and adapter

A request is tenant/target bound and starts only from an active AAL2 administrator session with bounded reason. Its maker cannot be the target. An independent active AAL2 administrator approves; checker differs from maker and target. If no independently authorized administrator exists, recovery stays externally blocked rather than bypassing MFA. The browser cannot choose identity/provider tenant/factor authority or assert successful reset.

Approval must atomically suspend the target, set mfa_reenrollment_required, invalidate every durable session, record a primary-authentication epoch and immutable audit, and insert a uniquely identified recovery job. Existing invitation/activation/lifecycle locks must share member-to-identity order; outbox creation and suspension cannot partially succeed. Normal reactivation cannot clear the gate.

A provider adapter is disabled by default. Commissioned nonproduction configuration must reject the protected production project before any operation. An unconfigured adapter returns unavailable and leaves suspension/gate intact. Provider factor inventory and reset use server-only authority and bounded opaque factor identifiers, never setup secrets/codes in storage or logs. No direct self-service factor-removal path. The real provider interface and administrative factor replacement permissions require verification against official SDK documentation before implementation.

A leased/fenced job records attempts and retryable failure; no concurrent worker may claim completion without owning the current fence. Provider already-removed responses require documented idempotency semantics, not fabricated success. Failed/partial reset cannot reactivate access. Audit contains recovery/job state and reason category rather than authenticator secrets.

After reset, a separately gated provider-only enrollment flow binds current identity and recovery generation. Complete only after server-verified confirmed identity, fresh primary proof and AAL2 with a newly enrolled verified factor consistent with the approved job. Require independent final activation approval and a new server session; no old session token restoration. Provider inventory/call semantics remain an integration dependency.

## Synthetic development checks

Test tenant mismatch, client/platform targets, inactive/AAL1 admins, self-request/self-approval/same-maker-checker, stale approvals, malformed IDs/reasons, audit rollback, job failure/retry/fence loss, concurrent lifecycle changes, old sessions/old factor/stale primary proof, unconfigured/protected provider, new factor proof mismatch and ordinary-reactivation gate denial. Use synthetic provider adapters only. PGlite rollback fixtures do not establish multi-connection PostgreSQL concurrency or real provider recovery correctness.

Recovery follows durable profile/session write corrections; live integration/browser evidence and production approval remain separate.

## Foundation implementation status

Proposed010 and mfaRecoveryRequests.ts implement request and independent approval. Both mutations hash the verified application bearer and atomically recheck the actor's current durable AAL2 session, expiry/revocation/tenant/UID/epoch. Approval suspends and gates the target, revokes sessions, records audit and creates a pending job. No raw bearer/factor/seed/code fields are accepted or audited; administrative free-text reason is stored in the protected request, while audit retains its category only. Job execution is unavailable. No HTTP/UI mounting, provider operation, enrollment verification, gate clearing, recovery completion, cancellation or retention implementation yet. SQL contention uses NOWAIT and requires real multi-connection PostgreSQL verification.
