# Staff invitations, activation and membership hardening (proposal 035)

**PRODUCTION STATUS: NO-GO.** Proposal 035 (`20261012350000_taxguard_staff_access_hardening.sql`) is
**not applied**. It supersedes five functions from proposals 002-004 (files unchanged) using
generated, anchor-checked patches; behaviour is otherwise identical.

| Finding | Fix |
| --- | --- |
| `taxguard_accept_staff_invitation`, `taxguard_approve_staff_activation`, `taxguard_create_staff_invitation`, `taxguard_revoke_staff_invitation` and `taxguard_change_staff_membership_status` were SECURITY DEFINER with `search_path = public`, which lets a session's temporary schema be searched first for tables | pinned to `pg_catalog, public, pg_temp`; a composition invariant now rejects any SECURITY DEFINER function whose path is not one of the safe forms |
| Administrator actions checked the actor's role and status only | also require the actor not to be under MFA re-enrolment and to have a consistent identity record (id, role, status, tenant), as recovery already did |
| Invitations stayed valid after their issuer lost authority | acceptance requires the issuing administrator to still be an active, ungated administrator; otherwise `INVITATION_INVALID` |
| Activation trusted the pending member's identity record | requires a consistent `pending_approval` identity with the member's role and tenant, and no MFA re-enrolment gate |
| Two administrators suspending each other at the same moment ended in a deadlock abort surfaced as "store unavailable" | administrator membership changes are serialized per tenant (advisory lock): one wins, the other is refused cleanly (`STAFF_ADMIN_REQUIRED`); a last-active-administrator check is kept as defence in depth. Verified on real PostgreSQL over 15 rounds; removing the lock reproduces `40P01` |
| Super administrators | already outside this RPC for everyone (target role list); unchanged, now tested |

Together with proposal 034 the service requires a **recent AAL2 sign-in** (15 minutes) before
invitation create / revoke, activation approval and membership changes.

## Tests

`staffAccessHardening.test.ts` (6), real PostgreSQL `staffAccess.db.test.ts` (mutual suspension race,
mutation-checked), `proposalCompositionSecurity` (035 included; safe-search_path invariant).

## Not changed (policy, recorded as decision HC7)

Any administrator may invite another administrator; activation already needs a second, independent
administrator. Restricting administrator invitations to super administrators would lock out tenants
without one, so it is left for decision.
