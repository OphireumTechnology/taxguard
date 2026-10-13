# Phase 9 reviews: administration, integrations, AI, tax engine (2026-10-14)

Status vocabulary per feature: **source complete** · **locally validated** · **staging validated**
(none: no staging project) · **production commissioned** (none).

## Administrator user management (Block 4)

Reused, not duplicated: the Administrator dashboard's "Practice Staff & Roles" is the durable
`StaffAccessManagementPanel` — staff directory, membership status, roles, invitations, MFA recovery
(request, independent approval, reset, re-enrolment, independent reactivation, audit history),
sessions and session revocation, suspension / reactivation with the 15-minute recent sign-in. The
super-administrator console no longer shows the in-memory user list or counts; it points to that
panel. The staff-access rate limit (20 requests a minute per address) is unchanged pending the
owner's policy decision. No parallel authentication system was created.

## Security events (Block 7)

Authoritative sources are rows in `taxguard_audit_log` (sessions, staff access and MFA, sign-in,
AI governance and kill switches, which must reference an audit row). Proposal 046 adds a category
filter so the audit center and the super-administrator console show a security view. The legacy
`db.logSecurityEvent` list is memory-only and lost on restart, so it is no longer displayed as a
record. Document-access denials and permission denials of the legacy routes are only logged in
memory today; making them durable is a follow-up (they are not fabricated).

## Integrations (Block 8)

| Integration | State | Notes |
|---|---|---|
| Database / authentication / storage | configuration reported; connectivity not verified by the registry | non-production project **B** |
| Malware scanner | not configured | documents stay quarantined |
| OCR | fail-safe only | `TAXGUARD_OCR_PROVIDER_MODE=FAIL_SAFE` |
| AI model provider | not commissioned | governance gateway ready |
| E-signature | not configured | no signing |
| Electronic filing | not configured | no filing |
| QuickBooks / Xero | not configured | legacy `/api/integrations` is in-memory and has no reachable UI |
| Payments | sandbox only (028) | no live charges |
| Bank connections, e-mail, SMS | not implemented | no automatic client communications |

Adapter boundaries already exist for each (provider readiness registry, MFA reset adapter, vault
storage and scanner interfaces, billing payment provider interface). Nothing was connected.

## AI workforce (Block 9) — unchanged

61 canonical agents (A00–A60) are registered; none is operational outside tests. Two read-only
advisory tasks are routed (A10 duplicate check, A34 workflow read) with test-injected handlers only.
No provider commissioned; AI-16 material actions remain blocked; no autonomous filing, accounting
changes, signatures, payments or client communications.

## Tax engine (Block 10) — unchanged

Approved, versioned rule sets with maker-checker review (033), verification cases (036) and
structural coverage (038) gate submission and approval; synthetic fixtures are labelled; missing
approved rules fail closed; stages 9–18 remain blocked; no return generation, filing or tax-signature
workflow exists. No rule was added.

## Open owner decisions recorded in Phase 9

- Retention period for consultation requests (prospect personal data).
- Reassignment requests: limits on concurrent requests; reviewer independence from the current advisor.
- Legal coordination: who approves a referral to outside counsel.
- Whether to delete the unreachable `LiveCalendarModule` (external calendar connection UI).
- Staff-access rate-limit policy; `trust proxy` setting behind a staging load balancer (affects the
  per-address limits of the public consultation endpoint).
