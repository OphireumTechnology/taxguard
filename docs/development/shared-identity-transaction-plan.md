# Shared identity provisioning transaction plan

Production status: NO-GO. No migration or provider operation is authorized by this plan. Next dependency after administrator staff management.

## Current defects confirmed from source

SupabaseDurableSessions.create selects/upserts a global counter and separately inserts identity/member/client rows, ignoring four write errors. The process-local mutex only serializes one tenant/UID; different users/processes can collide. Invitation history is checked outside that write sequence. Invitation issuance and acceptance use separate lock namespaces/order and do not synchronize with client creation.

ClientOnboardingProvisioner and LiveWorkflowRepository maintain process-local maps. Making identity rows atomic will not make tenant/engagement/year/case/stage hierarchy durable. CanonicalOnboardingStageStates is a legacy seven-code intake projection; it must not replace the authoritative 18-stage definition. Core cases currently require non-null preparer/reviewer identifiers, so durable case initialization must not fabricate staff assignments to satisfy those columns.

## Next identity boundary

A service-only taxguard_provision_client_identity RPC receives configured tenant and verified external uid/email/name only. Never accept role/clientId/user JSON from the browser. Before issuance, require confirmed provider email. SQL validates active existing tenant and canonical input. Acquire common global normalized-email advisory lock, then global UID lock, then durable rows. All invitation creation/acceptance paths must use that same order.

For an existing complete consistent active client mapping, return the permanent ID/resumed result without allocating or adding audit again. Deny partial, mismatched, cross-tenant or staff rows; do not silently repair, downgrade or create another client. Under the same transaction, deny same-tenant invitation history (including accepted/revoked/expired records, preserving the staff-reservation policy).

Allocate the global primary counter by atomic UPDATE RETURNING under row lock, and insert identity/member/client plus audit in that same transaction. Formatting must exactly match formatTaxGuardClientId for the numeric and all alphabetic nine-character namespaces; use integer arithmetic and explicit exhaustion/collision checks. Owner uniqueness requires audited existing-data preflight before the proposed constraint is applied. No allocation or rows survive a failed audit/insert. Session mint follows successful mapping; if session persistence fails, retry resumes the same mapping. Strict durable mode must never fall back to demonstration rows or a partial write.

Invitation creation must lock the same global email before checking existing identity; acceptance must lock verified email then UID before invitation row. Revocation can retain its row lock as it does not wait on email/UID. Cursors are not authority and directory reads remain separate.

## Validation

Compose all proposals with actual core migrations in isolated synthetic PostgreSQL. Cover replay, different UID allocation, formatter boundary/exhaustion/corrupted counter, collision, audit-trigger rollback, partial/cross-tenant mapping, invitation-vs-client competing paths and server failure without a session. Adapt existing shared and inline Supabase fixtures to the RPC contract; assert no strict direct multi-write provisioning path remains. PGlite serial scheduling alone cannot prove distributed connection lock races; true multi-connection local Postgres verification remains an explicit integration gate.

## Separate durable hierarchy work

Design an authorized client-owned onboarding case with legitimately unassigned professional slots, preserving all18 canonical stages and server gate evidence. Add durable tenant/client/engagement/year/case/stage creation and idempotent reads from the same authority. Preserve prior ownership and completed evidence. Do not derive completion from cached profile hints. Case professional assignment/review must remain independent and human approved.

## Session bridge review corrections

Strict client resumes must call the same transaction RPC, not the former spread/overwrite branch: otherwise retry could replace stored names from mutable provider display metadata and skip client/identity/member coherence. Staff resume retains independent AAL2 and active membership enforcement. Strict verification must not promote onboarding from LiveWorkflowRepository's process-local hints. The HTTP bridge now omits volatile hierarchy initialization for durable clients and reports DURABLE_ONBOARDING_PROVIDER_REQUIRED explicitly; isolated demonstration onboarding remains separate.

## Next security dependency: profile persistence and revocation

SupabaseDurableSessions.updateUser currently changes caches before confirming persistence, reads by UID without checking identity tenant, ignores returned database errors, upserts missing identities and may advance all client cases from a profile completion flag. These behaviours cannot constitute durable profile/workflow success. Next slice must use a tenant-scoped, whitelisted transactional update; reject missing/conflicting mappings, preserve immutable role/UID/tenant/client/status and require authoritative case gate evidence before workflow transitions. Name/phone/company updates and dossier/completion updates need distinct contracts. Existing route call sites sometimes swallow failure; update them to explicit unavailable/conflict responses.

Session revoke currently ignores returned write/audit errors and lacks a tenant match in the mutation. Require tenant-scoped, atomic revoke/audit and fail-closed reporting. SESSION_CREATED audit persistence also needs transaction/session authority review. No unit success here establishes durable onboarding or production readiness.

## Implemented write corrections and remaining authorization work

Strict updateUser now delegates only phone/companyName to a whitelisted transaction and publishes the validated DTO after success; no strict upsert, cache fallback or case advancement. Unsupported profile/workflow changes are denied. Strict session mint and revoke use atomic session/audit transactions; logout failure is explicit503. New recovery mutations additionally bind and recheck the CURRENT actor app session inside SQL.

Existing invitation issuance/activation/lifecycle mutations still recheck member authority rather than passing actor-session proof into their SQL functions. Audit late authenticated requests against actor revocation/reactivation and adopt the stronger transaction-bound proof where needed. Do not infer application-wide revocation-race safety from the new recovery tests alone. Other production-mounted process-local workflow/document/accounting handlers remain to be audited.
