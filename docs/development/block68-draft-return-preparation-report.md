# Block 68: draft return preparation

Branch `claude/taxguard-block68-return-preparation`, from `main` `58aeef8` (Blocks 66 and 67 merged). Review-only
proposals `20261019115000_taxguard_tax_approval_authority.sql` and `20261019120000_taxguard_tax_returns.sql`; nothing
applied to a hosted database. Design: `block68-return-preparation-design.md`. Draft output is never authoritative:
every version reads `returnUse: BLOCKED`, production refuses the routes, and Stage 10 final authorization is separate.

## Chain

```
source document (version, SHA-256) -> verified evidence -> tax conclusion (66) -> calculation run -> mapping rule ->
form line (67) -> return version (68): template forms, each a CURRENT non-stale mapping -> preparer submit ->
independent reviewer approval (Stage 09 draft review) -> Stage 09 facts
```

## Approval authority (20261019115000, shared)

Three separate facts, never inferred from a role or from each other: verified professional eligibility (credential,
issuing jurisdiction, scope, validity, independent verification, revocation), function designation (one function,
one policy version, made by someone else, revocable) and the case reviewer assignment. A versioned, owner-approved
policy per function (`RETURN_TEMPLATE_APPROVAL`, `FORM_RULE_APPROVAL`, `RETURN_DRAFT_REVIEW`, `RETURN_QC_REVIEW`)
states which are required; content approvals must require eligibility and designation, case decisions the case
assignment. Refusals name the missing element. No RPC writes the tables; history only gains revocations; nobody is
authorized by the proposal.

## Return preparation (20261019120000)

- Templates: versioned, maker-checker, verified source, supported jurisdiction, effective dates; approval needs
  `RETURN_TEMPLATE_APPROVAL` for the template's jurisdiction and records its basis.
- Prepare (case preparer only): refused, nothing written, for a missing required form mapping, a stale mapping, a
  mapping whose rule is no longer approved, blocking case diagnostics, or a template not approved, out of scope or
  out of effect. Identical forms replay; otherwise a new version supersedes the open one.
- Submit (preparer), approve or return (live case reviewer, never the preparer); approval also needs the
  `RETURN_DRAFT_REVIEW` policy and records its basis. A stale version can be neither submitted nor approved.
- Versions are immutable except forward status moves; staleness is derived on every read.
- Stage 09 facts (`draftReturnGenerated`, `preparerReviewComplete`, `provenanceComplete`) from durable records.

## API and interface

`/api/tax-engine/return-templates[...]`, `/cases/:caseId/returns`, `/cases/:caseId/returns/stage-facts`,
`/returns/:id`, `/returns/:id/(submit|approve|return)`; staff only; production answers `API_NOT_RELEASED` and the
cutover requires `20261019115000` and `20261019120000`. Case Workflow -> Draft return panel: template choice, prepare,
versions with status in words, stale reasons, forms with mapping versions, submit / approve / return, lineage tables.
The panel refreshes from the server before announcing a result; a failed refresh is announced as an alert, never as
an assumed status.

## Tests

- `taxReturnPreparation.db.test.ts` (11, PostgreSQL over HTTP): template governance; approval authority (every
  refusal reason, basis recorded, revocation, new policy version, immutability, no privileges, self-verification and
  self-designation refused); every preparation refusal; blocking diagnostics; lineage to the document SHA-256;
  submit / approve / return with maker-checker and the draft review policy; Stage 09 facts; immutability; isolation by
  tenant, client, assignment and year; staleness from a revised conclusion and from a superseded mapping rule;
  re-preparation and returned versions.
- Mutation checks (test database only, not kept): authority always granted fails 3 cases; mapping staleness ignored
  fails 2.
- `caseDraftReturnPanel.test.tsx` (5), `routeCutover.test.ts` (production refusal and cutover requirement).
- Suite 07 browser journey: template approval, preparer refusal shown to the reviewer, prepare, submit, keyboard
  lineage, approval with the badge checked as soon as each result is announced, staleness after a revision,
  re-preparation, client refused, 375 px.

## Known gaps and owner decisions

- Synthetic template and forms only; no real federal or state template content.
- Approval policies, eligibility records and designations are not configured anywhere: all approvals fail closed
  until the owner approves them (reviewed database change).
- Stage 09 facts are available from the database; wiring them into the Stage 09 gate's callers is a follow-up.
- Block 67 mapping-rule approval gets the same authority only through the separate enhancement
  `20261019130000` (branch `claude/taxguard-form-rule-approval-authority`).
- The Block 68 reference package named in the directive was not found on this machine; reconciliation is against the
  directive's requirements.
