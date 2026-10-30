# Block 74: Stage 11 signature package preparation, without signing (design)

Status: **design only.** Stacked on Block 73. All database changes are review-only proposals; nothing is applied to
a hosted database. Synthetic data only. Owner decisions are **[OWNER]**.

## Purpose

Stage 11 is the client's signature on an authorized return (`STAGE_11_SIGN_GATE`). Block 73 ends with a current
`AUTHORIZED` Stage 10 decision, and readiness reports `stage11: CLIENT_SIGNATURE_REQUIRED`.

Block 74 builds only the first, provider-independent part of Stage 11. It records the release of exactly one
authorized, current return version for client signature as an immutable **signature package**, bound to that
decision. It does not:

- render Form 8879 or any other form;
- contact an e-signature provider, send an invitation or collect a signature;
- verify a signer's identity;
- file, transmit or take payment.

Each of those needs owner decisions listed below, and Stage 11 signing stays inactive (directive: "Do not activate
Stage 11 signing or live filing").

## Reuses

| Component | Use |
|---|---|
| Stage 10 status (proposal 20261019180000) | `taxguard_tax_return_final_status` must report a current `AUTHORIZED` decision, recomputed inside the releasing transaction. |
| Approval authority (proposal 20261019115000) | A new function code, `RETURN_SIGNATURE_RELEASE`. It needs an owner-approved policy; whether it needs eligibility, a designation or a case assignment is the policy's choice, and the CHECK requires at least a designation. |
| Privileged session proof (proposal 20261012340000) | Releasing is a client-facing material action: a recent multi-factor staff session, re-checked in the transaction, as for Stage 10. |
| Attestation pattern (Block 73) | Versioned **signature consent texts**, created by one person and approved by another, written only by a reviewed database change. None is seeded. |
| Audit (`taxguard_case_audit`) | `TAX_RETURN_SIGNATURE_PACKAGE_RELEASED` and `TAX_RETURN_SIGNATURE_PACKAGE_WITHDRAWN`. |
| `stageElevenServerGate.ts` | Fed from the durable record: `stageTenComplete` and `signaturePackageCreated` come from the package; `allSignaturesObtained` and `providerConfigured` stay false, so the gate never passes. |

## Adds

- **Policy CHECK.** `RETURN_SIGNATURE_RELEASE` is added to the function-code CHECK through a new constraint; accepted
  proposals are not edited.
- **Consent texts.** `taxguard_tax_signature_consents`: tenant, version, text, rationale, created by and approved by
  someone else; immutable. With no approved text, release is refused with `TAX_RETURN_SIGNATURE_CONSENT_REQUIRED`.
- **Packages.** `taxguard_tax_return_signature_packages` records:
  - the return version, case, forms SHA-256, the Stage 10 authorization it releases and the consent version;
  - the signer accounts invited (one or more active client-portal members of the case's client, chosen by the
    releaser; see [OWNER] 3);
  - the releaser, the authority basis, the session hash and the time;
  - a single withdrawal (by, at, reason of at least 10 characters). Nothing else ever changes.

  At most one live (not withdrawn) package exists per return version.
- **Currency.** A package is current only while the Stage 10 decision it pins is still current and its consent
  version is still the latest. Currency is derived, never stored. A package that is not current can only be
  withdrawn; a new one is released after a new Stage 10 decision.
- **Release function.** `taxguard_tax_return_signature_release(p_tenant, p_actor, p_session_hash, p_version, p_input)`
  checks, in order: the privileged session; case access (not found is mapped to not found); a current `AUTHORIZED`
  Stage 10 decision (`TAX_RETURN_SIGNATURE_NOT_AUTHORIZED` with the reasons in DETAIL); the `RETURN_SIGNATURE_RELEASE`
  authority; the consent version the caller displayed (`..._CONSENT_CHANGED` otherwise); the signers (`..._SIGNER_INVALID`);
  no live package (`..._ALREADY_RELEASED`).
- **Readiness.** `stage11` reports `SIGNATURE_PACKAGE_RELEASED` while a current package exists, otherwise
  `CLIENT_SIGNATURE_REQUIRED`; a `signature` field reports `NOT_AVAILABLE` (no provider). `returnUse` stays `BLOCKED`.
- **Routes:**
  - `POST /api/tax-engine/returns/:id/signature-package` and `.../signature-package/withdraw`: human staff with a
    durable multi-factor session only; an AI or service actor is refused before the database is called.
  - `GET /api/tax-engine/returns/:id/signature-packages`.
  - Client portal: `GET /api/client/signature-packages` lists the client's own current packages with status only
    (see [OWNER] 4). No figures, forms or signing action.

  Production cutover refuses all of them until the proposal is approved.
- **Interface.** On a version with a current authorization, the draft return panel shows the consent text, the
  client-portal members to choose from (none pre-selected), and an explicit acknowledgement before "Release for
  signature" is enabled. The client portal says that the return is awaiting signature and that signing is not
  available yet.

## Independence and separation

- Releasing is not a professional decision about the return; it is a client-facing action. The fail-closed default:
  the releaser holds the `RETURN_SIGNATURE_RELEASE` authority and is not the version's preparer. **[OWNER]** may
  restrict it further (for example, only the final authorizer of record).
- No AI agent, service account or background job can release or withdraw a package.

## Tests

- **PostgreSQL acceptance:** fail closed with no policy, consent text or designation; released under synthetic
  configuration; each refusal in check order; not authorized (no decision, declined, lapsed) with reasons; session
  too old; consent changed between display and submit; signer not a member of the case's client, inactive or in
  another tenant; one live package; withdrawal once only; currency lost when the Stage 10 decision lapses or a new
  consent version is approved; immutability and no truncate; isolation; no table privileges.
- **Privileges:** checked in execution order by the composition test.
- **Mutation checks:** skipping the Stage 10 currency check, the session check and the signer check must each fail a
  test.
- **Unit tests:** store, routes (AI actor refused), production refusal, the panel (acknowledgement required, no
  pre-selected signer) and the client status view.
- **Browser:** suite 07, after the positive Stage 10 step, with the durable authorizer's session: release, the client
  sees the status only, and the package lapses with the decision. Keyboard, live regions, 375 px.
- **Full matrix.**

## [OWNER] decisions required before anything here can release a real return

1. The release policy: who may release (credentials, designation, case assignment), and whether only the final
   authorizer of record may.
2. The signature consent wording shown to staff and later to the client. It needs legal review and relates to the
   IRC section 7216 consent wording and the Form 8879 process; TaxGuard does not draft it.
3. Who must sign: how the taxpayer and, for a joint return, the spouse are identified from the return and the client
   record. Until then the releaser chooses from the client's portal members.
4. What the client may see before signing (status only, a summary, or the full return) and how it is delivered.
5. The e-signature provider and the signer identity verification method. Out of scope here; both are needed before
   Stage 11 signing can be built.

## Not in scope

Form 8879 rendering, invitations, signature collection and identity verification (the rest of Stage 11); filing and
transmission (Stage 12); payments. No AI agent is given any capability here.
