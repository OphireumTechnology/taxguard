# Block 66: existing traceability inventory

Inspected on `claude/taxguard-block66-evidence-conclusion-traceability`, base `3ec878c` (Phase 15 integration head).
Every structure below is a review-only proposal or a core migration on the integration branch.

| Link in the chain | Existing structure | Decision |
|---|---|---|
| Source document, versions, hash | `taxguard_documents` (core; vault proposal 027): `(document_id, version)`, `hash`, `status`, `quarantine_status`, uploader, scan | REUSE. Replacement is already a new version, never an overwrite |
| OCR/AI extraction proposal | `taxguard_extracted_data` (core + 027): `is_ai_proposed_only`, `decision` NULL | REUSE. A proposal is never evidence |
| Extraction decision | 027 `taxguard_doc_verify_extraction`: ACCEPTED / CORRECTED / REJECTED, `verified_value`, `verified_by` | REUSE. Stage 03 gate (20261018180000) unchanged |
| Evidence identity and resolution | 20261018190000 `taxguard_tax_evidence_resolve`: `extraction:<id>` / `document:<id>` against the case scope, current version, reviewed state | EXTEND: a NULL value now means "identity only" for conclusions |
| Workpaper | 029 `taxguard_b2t_workpapers`: snapshot and `snapshot_sha256`, DRAFT/APPROVED/REJECTED/SUPERSEDED, maker-checker | REUSE as a conclusion source |
| Research memo and authority citations | 20261018150000 `taxguard_tax_research_memos`, `..._citations` (AUTHORITATIVE / SECONDARY / INTERNAL_GUIDANCE / AI_INFERENCE) | REUSE as a conclusion source; levels shown in the trace |
| Tax rule (rule set, hash, sources) | 033 `taxguard_tax_rule_sets` (`content_sha256`, `source_ids`, verified sources), verification cases 036/038 | REUSE, through the calculation run |
| Calculation run and input lineage | 033 `taxguard_tax_calc_runs` (rule set id and hash, engine version, input/output hashes, trace); 20261018190000 `taxguard_tax_calc_input_lineage` | REUSE as a conclusion source; its input evidence is re-checked for staleness |
| Diagnostics, risk | 20261018160000, 20261018170000 | REUSE (Block 70/71 integrate conclusions) |
| Tax conclusion | none | MISSING → `taxguard_tax_conclusions` (20261019100000) |
| Conclusion ↔ sources | none | MISSING → `taxguard_tax_conclusion_links` with per-link snapshots |
| Staleness | none (Block 65 re-resolves calculation evidence at approval only) | MISSING → derived per link from snapshots |
| Form / schedule / line | `src/taxForms` catalogue only | MISSING lineage → `taxguard_tax_form_line_sources` (foundation; Block 67 fills it) |
| Review / maker-checker | per entity (runs, memos, workpapers); live case slots (20261018090000) | REUSE for conclusions |
| Authoritative action | `ai_authoritative_actions` (AI registry); human decisions are the reviewer's approval records | REUSE; the approved conclusion version is the authoritative human action, audited |
| Audit | `taxguard_audit_log` via `taxguard_case_audit` (case-scoped) | REUSE |
| Process-local authority | `authority.repository.ts` case-authority adapter, refused in production (Block 39) | SUPERSEDED for this domain: conclusions exist only in the durable store |
| `ai_run` | AI registry foundation | REUSE (no AI proposes conclusions yet; agents stay DRAFT) |
