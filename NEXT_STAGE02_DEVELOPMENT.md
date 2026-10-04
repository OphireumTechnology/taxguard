# TaxGuard Stage 02 Development Specification
## Stage 02 Live Cloud Document-Intelligence Pipeline & Collection Engine

### Mandatory Regression Invariants (TG-COL-R01 to TG-COL-R20)
- TG-COL-R01: recognized required document updates requirement status to RECEIVED
- TG-COL-R02: requirement update recalculates progress truthfully
- TG-COL-R03: wrong-year document cannot satisfy current engagement and preserves progress
- TG-COL-R04: wrong taxpayer document cannot satisfy requirement and creates blocking exception
- TG-COL-R05: duplicate document cannot increase progress twice
- TG-COL-R06: optional requirement does not reduce mandatory completion percentage
- TG-COL-R07: unclassified document enters Stage 02 review queue and generates exception
- TG-COL-R08: AI classification is proposed only and does not mark requirement validated
- TG-COL-R09: new collection fact reruns requirement determination and manifests new source
- TG-COL-R10: state requirements are tax-year and jurisdiction aware
- TG-COL-R11: corrected W-2C preserves original document and links versions
- TG-COL-R12: requirement matching logs an authoritative audit event
- TG-COL-R13: evidence invalidation reopens requirement to MISSING
- TG-COL-R14: reopened requirement recalculates Stage 02 gate and blocks exit
- TG-COL-R15: Stage 02 gate cannot pass with unresolved material exceptions
- TG-COL-R16: CLOUD mode cannot silently fall back to LOCAL when provider is unconfigured
- TG-COL-R17: unconfigured provider throws fail-closed rather than fabricating results
- TG-COL-R18: OCR service failure cannot satisfy requirement or increase progress
- TG-COL-R19: retry of a document upload is idempotent and retains one active relationship
- TG-COL-R20: real cloud OCR provenance is distinguishable from LOCAL heuristic output

### Additional Features:
- Section 24: Prior-Year Source Intelligence (evaluatePriorYearSources, respondToPriorYearInquiry)
- Section 25: Exceptions (POTENTIAL_NEW_INCOME_SOURCE, POTENTIAL_NEW_ENTITY, POTENTIAL_MISSING_PRIOR_YEAR_SOURCE)
- Section 32: Stage 02 Collection Snapshot (createStageTwoSnapshot, getStageTwoSnapshot)
