# Block 73: Stage 10 final authorization of a return version (design)

Status: **design only.** Stacked on Block 72. All database changes are review-only proposals; nothing is applied to
a hosted database. Synthetic data only. Owner decisions are **[OWNER]**.

## Purpose

Stage 10 is the separate final authorization of a draft return by an appropriately authorized tax professional
(Block 68 design, policy baseline 2). Block 72 ends with final readiness, which reports
`stage10: FINAL_AUTHORIZATION_REQUIRED`. Block 73 records that human decision durably.

It is a protected professional decision:

- Only a person can make it.
- No AI agent, service account or background job can call it.
- It never signs, files, transmits or takes payment. Signatures are Stage 11 and filing is Stage 12, and neither is
  built here.

## Reuses

| Component | Use |
|---|---|
| Approval authority (proposal 20261019115000) | A new function code, `RETURN_FINAL_AUTHORIZATION`. It needs an owner-approved policy, verified eligibility in scope and a designation. |
| Final readiness (proposal 20261019170000) | Recomputed inside the authorizing transaction; it must report no reasons. |
| Privileged session proof (proposal 20261012340000) | `taxguard_privileged_session(tenant, actor, session hash, roles)`: an active, non-suspended member in one of the given staff roles, with a live AAL2 session whose sign-in is fresh and within `taxguard_privileged_max_age_seconds()` (900 s), re-checked in the same transaction. Its refusals keep their codes (`STAFF_RECENT_SIGN_IN_REQUIRED`, `STAFF_FRESH_SIGN_IN_REQUIRED`). |
| Audit (`taxguard_case_audit`) | `TAX_RETURN_FINAL_AUTHORIZED` and `TAX_RETURN_FINAL_DECLINED`. |
| `stageTenServerGate.ts` | Fed from the durable record. Today its snapshot comes from callers. |

## Adds

- **Policy CHECK.** `RETURN_FINAL_AUTHORIZATION` is added to the function-code CHECK. A new constraint is added; the
  accepted proposal is not edited. The policy must require both eligibility and designation, the way template and
  form-rule approval do.
- **Attestation texts.** `taxguard_tax_final_attestations` holds versioned attestation wording: tenant, version, text,
  created by, and approved by someone else.
  - It is written only by a reviewed database change, and it is immutable.
  - With no approved text, authorization is refused with `TAX_RETURN_ATTESTATION_REQUIRED`.
- **Authorizations.** `taxguard_tax_return_final_authorizations` is immutable. It records:
  - the return version, case, forms SHA-256 and attestation version;
  - the readiness inputs it was computed from (latest verification, diagnostics run, risk assessment and QC review);
  - the outcome, `AUTHORIZED` or `DECLINED`, with a note required for `DECLINED`;
  - the authorizer, the authority basis, the session hash and the time.
- **Authorize function.** `taxguard_tax_return_final_authorize(p_tenant, p_actor, p_session_hash, p_version, p_input)`
  checks, in order:
  1. the privileged session;
  2. case access (not found is mapped to not found);
  3. independence (below);
  4. final readiness with no reasons (`TAX_RETURN_NOT_READY` with the reasons in DETAIL);
  5. the `RETURN_FINAL_AUTHORIZATION` authority (`TAX_RETURN_FINAL_AUTHORITY_REQUIRED`);
  6. the attestation text, whose version must equal the version the caller displayed and accepted
     (`TAX_RETURN_ATTESTATION_CHANGED` otherwise).
- **Currency.** An authorization is current only while all of these hold:
  - the version is not stale;
  - its forms SHA-256 is unchanged;
  - no newer verification, diagnostics run, risk assessment or QC review exists;
  - the attestation version is still the latest.

  Currency is derived, never stored. Readiness for Stage 11 then reports `stage11: CLIENT_SIGNATURE_REQUIRED`, and
  `returnUse` stays `BLOCKED`.
- **Routes:**
  - `POST /api/tax-engine/returns/:id/final-authorization`: human staff session only. An AI or service actor is
    refused before the database is called.
  - `GET /api/tax-engine/returns/:id/final-authorizations`.

  Production cutover refuses both routes until the proposal is approved.
- **Interface.** On a ready version, the panel shows the attestation text and the readiness inputs. The professional
  ticks an explicit acknowledgement before "Authorize" or "Decline" is enabled. There is no default, and nothing is
  pre-checked.

## Independence

The fail-closed default: the final authorizer must differ from:

- the version's preparer and Stage 09 reviewer;
- the case's preparer and reviewer;
- the live QC assignee and the QC reviewer of record;
- the manager who assigned QC.

**[OWNER]** may relax this, for example by allowing the Stage 09 reviewer to give final authorization in a small
practice. That would be a reviewed database change, never a caller option.

## Tests

- **PostgreSQL acceptance:**
  - fail closed with no policy, attestation or designation;
  - authorized under synthetic configuration;
  - each refusal, in check order;
  - independence for each excluded person;
  - not ready, with each Block 72 reason propagated;
  - session too old;
  - attestation changed between display and submit;
  - currency lost when the return is re-prepared, a newer risk assessment or QC review is recorded, or a new
    attestation version is approved;
  - immutability and no truncate;
  - isolation;
  - no table privileges.
- **Privileges:** checked in execution order by the composition test.
- **Mutation checks:** skipping the readiness recompute, the independence check and the session check must each
  fail a test.
- **Unit tests:** store, routes (AI actor refused), production refusal, and the panel (acknowledgement required, no
  pre-checked state).
- **Browser:** a suite 07 journey under a synthetic policy and attestation, with keyboard, live regions and 375 px.
- **Full matrix.**

## [OWNER] decisions required before anything here can authorize a real return

1. The eligibility policy for final authorization: which credentials (CPA, EA, attorney) and which jurisdictions.
2. The attestation wording. It needs legal review, and it is related to the open IRC § 7216 consent wording.
3. Independence: whether the Stage 09 reviewer may also authorize.
4. Whether `DECLINED` routes the case back to preparation automatically or only records the decision. Default: it
   only records; a person prepares a new version.
5. The maximum age of the recent sign-in for this action, if it should differ from the existing privileged-session
   setting.

## Not in scope

Client signature (Form 8879) and any e-file rendering (Stage 11), filing and transmission (Stage 12), and payments.
No AI agent is given any capability here.
