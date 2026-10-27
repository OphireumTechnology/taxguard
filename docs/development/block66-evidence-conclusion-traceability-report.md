# Block 66: durable evidence-to-conclusion traceability

Branch `claude/taxguard-block66-evidence-conclusion-traceability` from `3ec878c`. Review-only proposal
`20261019100000_taxguard_tax_conclusions.sql`; nothing applied to a hosted database. Inventory:
`block66-existing-traceability-inventory.md`.

## Chain

```
source document (version, hash) → extraction decision → verified evidence ─┐
approved workpaper (snapshot hash) ─────────────────────────────────────────┤
approved research memo → authority citations (level, verified source) ──────┤→ tax conclusion (version) → review → audit
approved rule set (hash, verified sources) → calculation run → input lineage ┘        ↓
                                                                      form line (Block 67 foundation)
```

## Schema (new)

- `taxguard_tax_conclusions`: tenant, case, client, engagement, tax year; lineage id and version (supersedes link);
  type (income inclusion, deduction, depreciation, credit eligibility, filing status, entity classification, basis,
  capital gain/loss, carryforward, state allocation, book-to-tax adjustment, other); statement; amount; status DRAFT →
  READY_FOR_REVIEW → APPROVED / RETURNED / REJECTED, SUPERSEDED; preparer, reviewer, timestamps, note. Identity and
  content are immutable; only review fields move forward; no delete or truncate.
- `taxguard_tax_conclusion_links`: (conclusion, type, ref) with a snapshot of the source when linked. Types EVIDENCE
  (`extraction:` / `document:`), CALCULATION (run of the same case), RESEARCH (memo of the same case), WORKPAPER (same
  client and year). At least one evidence link. Immutable.
- `taxguard_tax_form_line_sources`: form, version, line → approved conclusion. Foundation only; nothing writes it yet.
- Modified: `taxguard_tax_evidence_resolve` (NULL value = identity resolution). No existing table changed.

## Staleness

Derived on every read, never stored as a flag that can drift. Each link is resolved again and compared with its
snapshot (identity fields; forward status moves are allowed). Reasons: `DOCUMENT_SUPERSEDED`, `DOCUMENT_NOT_REVIEWED`,
`NOT_DECIDED`, `VALUE_REJECTED`, `SOURCE_CHANGED`, `CALCULATION_REJECTED`, `CALCULATION_EVIDENCE_STALE` (the run's own
input evidence no longer resolves), `RESEARCH_REJECTED`, `WORKPAPER_REJECTED` / `WORKPAPER_SUPERSEDED`. Effects: a stale
draft cannot be submitted; a stale conclusion cannot be approved; readiness lists it as a blocker; an approved
conclusion keeps its status (no silent change) but shows STALE. The preparer revises it into a new version on
revalidated sources; the old version becomes SUPERSEDED with its links preserved.

## API (`/api/tax-engine`, staff only; managers read only)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/cases/:caseId/conclusions` | list / propose (preparer) |
| POST | `/conclusions/:id/revise`, `/submit` | new version / submit (preparer) |
| POST | `/conclusions/:id/approve|return|reject` | reviewer decision (note required to return or reject) |
| GET | `/conclusions/:id/trace` | backward trace: sources with snapshot and current state, calculation inputs and outputs, research citations, versions, audit, form lines |
| GET | `/cases/:caseId/evidence-trace?ref=` | forward trace: runs and conclusions depending on a piece of evidence, with staleness |
| GET | `/cases/:caseId/conclusions/readiness` | finalization readiness (every current conclusion approved and current) |

Authorization is resolved in the database for every call (`taxguard_case_actor`: tenant, live case assignment,
manager); the request never supplies scope. The production cutover for `/api/tax-engine` now requires this proposal.

## UI

Case Workflow → Tax conclusions: propose/revise form, list with STALE / APPROVED / REVIEW REQUIRED / BLOCKED / DRAFT
badges, stale reasons, readiness line, review form, and a lineage view (calculation and rule, research and authority,
workpaper, verified evidence and original document, review history, audit, form lines).

## Tests

- `taxConclusions.db.test.ts` (6, PostgreSQL, HTTP) and `taxCalcInputLineage.db.test.ts` (Block 65, resolver change).
- `caseConclusionsPanel.test.tsx`, `routeCutover.test.ts` (production refusal, cutover requirement).
- Suite 07 browser journey (see `block66-browser-verification.md`).

## Known gaps and dependencies

- Form mapping (Block 67) writes `taxguard_tax_form_line_sources`; Stage 09 return preparation (Block 68) will require
  readiness.
- Diagnostics (Block 70) and risk (Block 71) do not yet read conclusion staleness.
- Workpaper links are accepted for the same client and year; book-to-tax workpapers are not case-bound in 029.
- Materiality of a conclusion is not decided here (no threshold is configured; owner policy).
- Owner review points: whether document-level evidence is acceptable for conclusions (as for calculation inputs);
  whether a returned conclusion should be revisable by anyone but the original preparer (today: the case preparer).
