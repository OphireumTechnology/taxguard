# Block 67: deterministic form mapping

Branch `claude/taxguard-block67-deterministic-form-mapping`, stacked on Block 66 (`8e3f2f5`, not yet merged into
`main`). Review-only proposal `20261019110000_taxguard_tax_form_mapping.sql`; nothing applied to a hosted database.
Completes the mapping part of `TAX-FORM-MAPPING`; no AI decides where a value is written.

## Chain

```
approved, current tax conclusion (Block 66) ─ calculation run (rule set id, version, hash) ─ evidence links (snapshots)
        │
        ▼  approved mapping rule (form id, form version, version, hash, verified source)
form → schedule → line → field = value (value type), with every contributing source
        │
        ▼
form-line foundation (Block 66 taxguard_tax_form_line_sources) → conclusion trace lists the form lines
```

## Schema (new)

- `taxguard_tax_form_rules`: versioned mapping rule per jurisdiction, return family, tax year, form id and form
  version; definition (lines), content hash, cited source; DRAFT → PENDING_REVIEW → APPROVED / REJECTED, SUPERSEDED
  by a newer approval. Preparer and reviewer must differ. Content frozen once submitted; no delete or truncate.
- `taxguard_tax_form_mappings`: one mapping version of one case and form: rule id, version and hash, values hash,
  optional lines without a source, CURRENT / SUPERSEDED (at most one CURRENT per case and form), mapper, time.
  Only CURRENT → SUPERSEDED may change.
- `taxguard_tax_form_values`: tax year, form id and version, schedule, line, field, value type (MONEY / INTEGER),
  value, mapping rule id, version and hash, timestamp, and `sources`: per contributing conclusion its id, version and
  type, its value, calculation run and output hash, rule set id, version and hash, and its evidence links with their
  snapshots. A CHECK refuses a value without a source; values never change.
- No privileges for anon, authenticated or service_role on any table; only the RPCs write.
- No existing table changed. Mapping also writes `taxguard_tax_form_line_sources` (Block 66 foundation).

## Mapping rule definition

```
{ jurisdiction, jurisdictionCode, returnFamily, taxYear, formId, formVersion, sourceId,
  lines: [{ schedule, line, field, valueType: MONEY|INTEGER, required, aggregate: SINGLE|SUM,
            source: { conclusionType, value: AMOUNT | OUTPUT, outputKey? } }] }
```

Validated in the database (unknown conclusion types, an output line without an output key, an amount line with
one, and duplicate schedule/line/field are refused); the hash is computed in the database.

## Derivation (deterministic, refuses instead of guessing)

For each rule line, the case's APPROVED conclusions of the named type, in id order. A line is refused, and the whole
mapping with it, when:

| Reason | Condition |
|---|---|
| `SOURCE_MISSING` | a required line has no approved conclusion (optional lines are listed as missing) |
| `AMBIGUOUS_SOURCE` | a SINGLE line has more than one approved conclusion |
| `SOURCE_STALE` | a candidate conclusion is stale (Block 66 staleness) |
| `CALCULATION_SOURCE_REQUIRED` | a candidate does not have exactly one calculation run |
| `CALCULATION_NOT_APPROVED` | its run is not review-approved |
| `VALUE_MISSING` | the conclusion has no amount, or the run no such output |
| `VALUE_TYPE` | an INTEGER line receives a fractional value |

The rule must be APPROVED and match the case's tax year and return family; only the case's live preparer maps.
Mapping identical values again returns the current mapping (`replayed`); otherwise a new version supersedes it.

## Staleness

Derived on every read: the mapping is derived again and compared with what was stored. Reasons: the derivation's
problems above, `SOURCE_CHANGED` (a source conclusion was revised and re-approved, or its run output changed),
`SOURCE_WITHDRAWN`, `SOURCE_ADDED` (a newly approved conclusion would fill a line), `MAPPING_RULE_SUPERSEDED`. Nothing
is recomputed or overwritten: the stored values stay as mapped and read STALE until the preparer maps again.

## API (`/api/tax-engine`, staff only)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/form-rules`, `/form-rules/:ruleId` | list (by tax year), read, draft |
| POST | `/form-rules/:ruleId/submit|approve|reject` | maker-checker transitions (reviewer approves) |
| GET/POST | `/cases/:caseId/form-mappings` | list mappings (with staleness) / map (preparer, body `{ ruleId }` only) |
| GET | `/form-mappings/:mappingId` | one mapping with its values and provenance |

Managers read mappings and rules and may draft and submit rules; they cannot map or approve. Production: the
`/api/tax-engine` prefix answers `API_NOT_RELEASED`; the cutover now also requires `20261019110000` and the sentinel
`taxguard_tax_form_mapping_list`.

## UI

Case Workflow → Form mapping: choose an approved rule for the case's year and return family, map, list of mapping
versions with CURRENT / STALE / SUPERSEDED in words, stale reasons as a named list, optional lines without a source,
and a values table (caption, column and row headers) with each value's conclusion, run, rule set and evidence. Mapping
rules are authored through the API in this block; there is no rule editor.

## Tests

- `taxFormMapping.db.test.ts` (7, PostgreSQL, HTTP): rule governance; every refusal above; provenance of every value;
  idempotent re-mapping; the conclusion trace reaches the form lines; no injection, edit or removal (CHECK, triggers,
  privileges); isolation by tenant, client, case assignment, tax year and role; revised conclusion → STALE → version 2
  with version 1 kept; stale document and superseded rule → STALE, mapping refused.
- Mutation checks (test database only, not kept): ignoring conclusion staleness in the derivation fails 1 case;
  summing an ambiguous SINGLE line fails 4 cases.
- `caseFormMappingPanel.test.tsx`, `routeCutover.test.ts` (production refusal, cutover requirement).
- Suite 07 browser journey (`block67-browser-verification.md`).

## Known gaps and dependencies

- Synthetic form only. No real form's lines are encoded; real mapping rules need verified form instructions and an
  owner-approved content process.
- Values are MONEY and INTEGER; text and checkbox fields (for example filing status) are not mapped yet.
- Selection is by conclusion type; two conclusions of one type for different lines need either SUM or a finer
  selector (owner decision: a conclusion subtype or explicit line tag).
- No review step for a mapping itself: it is a pure derivation from reviewed inputs; Stage 09 (Block 68) adds return
  versions, reviewer status and rework.
- Diagnostics (Block 70) do not yet read mapping staleness.
