# Block 68: authoritative draft return preparation (design)

Status: **implementation in progress** on `claude/taxguard-block68-return-preparation` (from `main` `58aeef8`).
PostgreSQL and browser validation are pending; the branch is not pushed. Owner decisions are marked **[OWNER]**.

## 1. Purpose and boundary

Assemble a versioned draft return for a case and tax year from **current, approved form mappings** (Block 67), with
reviewer approval, and supply the Stage 09 server gate with durable facts it currently has no source for.

```
source document -> verified evidence -> tax conclusion (66) -> calculation run -> mapping rule -> form line (67)
  -> return version (68: forms, completeness, readiness) -> preparer submit -> reviewer approve -> Stage 09 gate
```

Out of scope: real federal or state form content (synthetic templates only until professionally verified), PDF or
e-file rendering, signatures (Stage 11), filing (Stage 12), CPA/EA final approval (Stage 10), AI preparation of any
value. Returns are deterministic assemblies of reviewed inputs; nothing is recalculated or guessed.

## 2. What exists and is reused

| Existing | Reuse |
|---|---|
| Block 67 `taxguard_tax_form_mappings` / `_values` (immutable, CURRENT/SUPERSEDED, derived staleness, lineage) | The only source of form values; a return references mapping versions, never copies values it could alter |
| Block 66 conclusion staleness and traces; Block 65 calculation lineage | Lineage reported through, not reimplemented |
| `stageNineServerGate.ts` (`draftReturnGenerated`, `preparerReviewComplete`, `provenanceComplete`, `unresolvedBlockingDiagnostics`, `deterministicCalculationsComplete`) | Fed from the durable return version |
| Case readiness diagnostics `20261018160000` | Blocking diagnostics refuse preparation |
| `Federal1040Preparation.ts`, `StateTaxPreparation.ts` (in-memory contracts: line bindings, immutable versions, `aiPrepared: false`) | Contract vocabulary and invariants; not used as authority (process-local) |
| `taxguard_case_actor`, `taxguard_tax_actor`, `taxguard_case_audit`, maker-checker pattern | Same authority model |

## 3. Data model (review-only proposal `20261019120000_taxguard_tax_returns.sql`)

Depends on `20261019110000` (form mapping), `20261019100000` (conclusions), `20261018160000` (diagnostics),
`20261018090000` (live case actor).

- `taxguard_tax_return_templates`: which forms make up a return, per jurisdiction (federal US / supported state),
  return family and tax year: `forms: [{formId, formVersion, required, condition?}]`, effective dates, cited verified
  source, content hash, version; DRAFT -> PENDING_REVIEW -> APPROVED / REJECTED, SUPERSEDED; maker-checker; frozen
  once submitted. Same governance as Block 67 mapping rules. **[OWNER]** template content needs professional
  verification; tests use synthetic templates.
- `taxguard_tax_returns`: one per case, jurisdiction and template family (tenant, case, client, engagement, tax
  year, jurisdiction, code).
- `taxguard_tax_return_versions`: version, template id/version/hash, status DRAFT -> SUBMITTED -> APPROVED /
  RETURNED, SUPERSEDED; `forms` = [{formId, formVersion, mappingId, mappingVersion, valuesSha256}]; content hash of
  that set; `missing` (optional forms without a mapping); prepared_by, submitted_at, reviewed_by (<> prepared_by),
  review note; immutable except status moves; no delete/truncate.
- RLS on, no table privileges; only the RPCs write (as Blocks 66-67).

## 4. Behaviour

- **Prepare** (case preparer only): template APPROVED, in effect, same year/family/jurisdiction as the case. For
  each required form, exactly one CURRENT mapping that is not stale. Refused, nothing written, with reasons:
  `RETURN_FORM_MISSING`, `RETURN_MAPPING_STALE`, `RETURN_MAPPING_RULE_NOT_APPROVED`, `RETURN_BLOCKING_DIAGNOSTICS`,
  `RETURN_TEMPLATE_NOT_EFFECTIVE`, `RETURN_SCOPE_MISMATCH`. Identical form set replays; otherwise a new version
  supersedes the current one.
- **Submit** (preparer) and **approve / return** (live case reviewer, not the preparer; a return needs a note).
- **Staleness** (derived on read, as in 66-67): a referenced mapping superseded or stale, the template superseded,
  a new blocking diagnostic. A STALE version cannot be submitted or approved; the preparer prepares again.
- **Stage 09 facts**: `draftReturnGenerated` = an APPROVED, non-stale current version exists for every required
  return of the case; `preparerReviewComplete` = it was submitted by the preparer and approved by the reviewer;
  `provenanceComplete` = every line of every referenced mapping has at least one source (guaranteed by Block 67).
  **[OWNER]** whether reviewer approval here satisfies Stage 09 alone, with CPA/EA approval remaining Stage 10.
- **Lineage read**: return version -> forms -> mapping values -> conclusion trace -> calculation -> rule set ->
  evidence -> document version and SHA-256.

## 5. API (`/api/tax-engine`, staff only; production refuses: `API_NOT_RELEASED`)

| Method | Path |
|---|---|
| GET / POST | `/return-templates`, `/return-templates/:id`, `/return-templates/:id/(submit|approve|reject)` |
| GET / POST | `/cases/:caseId/returns` (list; prepare with `{ templateId }`) |
| GET | `/returns/:returnId`, `/returns/:returnId/versions/:version` (with lineage) |
| POST | `/returns/:returnId/versions/:version/(submit|approve|return)` |

Cutover requires `20261019120000` and a sentinel RPC; manager read access as for Block 67.

## 6. Interface

Case Workflow -> "Draft return" panel (server-backed): template choice, prepare, version list with
CURRENT / STALE / SUPERSEDED and review state in words, missing optional forms, per-form mapping links, submit /
approve / return with maker-checker messages, keyboard and 375 px support. Google AI Studio may restyle it against
this contract; it must not keep local state as authority.

## 7. Security controls

Tenant, client, case-assignment and tax-year isolation (not found outside scope); preparer-only preparation;
reviewer <> preparer; templates maker-checker on a verified source; immutable versions; no direct table writes;
production fail-closed; no AI-produced values; no external transmission.

## 8. Acceptance tests

- PostgreSQL (HTTP): template governance; every refusal reason; replay and supersession; maker-checker; isolation by
  tenant, client, assignment and year; immutability (UPDATE/DELETE/TRUNCATE refused, no privileges); staleness from a
  revised conclusion propagating through the mapping to the return; Stage 09 facts; lineage to document hash.
- Mutation checks: ignore mapping staleness; allow a missing required form (each must fail tests).
- Unit: store/route contracts, panel, production refusal and cutover requirement.
- Browser (suite 07): prepare, refusal shown, submit, reviewer approves, conclusion revised -> STALE, re-prepare,
  keyboard, 375 px, client refused.
- Full matrix: unit, lint, typecheck, PostgreSQL, both browser profiles, build, release candidate, constraint review,
  secrets, diff check, contamination.

## 9. Policy baseline (proposed 2026-10-28, pending formal owner and tax-professional approval)

1. **Templates**: versioned, source-verified, and approved by a designated qualified tax professional. Implemented
   as maker-checker on a verified source; which reviewers count as "qualified tax professional" is not yet encoded
   (any reviewer role can approve today) and needs the owner's designation.
2. **Stage 09 / Stage 10**: Stage 09 requires independent draft review (implemented: the case's live reviewer, never
   the preparer, approves the return version). Stage 10 requires separate final authorization by an appropriately
   authorized tax professional (not part of this block).
3. **Scope**: federal Form 1040 first; a state only once its authoritative rules, templates and test fixtures are
   verified. Implemented as jurisdiction validation plus approved templates; no real federal or state template is
   encoded yet (synthetic only).

Draft output is not authoritative: every version reads `returnUse: BLOCKED`, production refuses the routes, and the
proposal stays review-only until approved.
