# AI-10 Tax Intelligence authority review

Explicit identities: A18 Federal Tax Analysis, A19 State Tax Analysis, A28 Calculation Verification, A30 Form Mapping, A31 Diagnostics. Other A17-A31 names remain category/ID labels and UNMAPPED / DENIED. Naming a function is not an executable permission.

Existing deterministic TaxDecimal, TaxCalculationGuard, TaxYearCalculationRegistry and federal income/AGI/remaining-calculation contracts are preserved. They are calculation building blocks, not independently verified source authority. The current server has no durable governed adapter binding these contracts to immutable reviewed facts and verified rule/authority versions.

Core taxguard_extracted_data has tenant/document/case and JSON values/provenance plus mutable verified_by/verified_at flags. It lacks an immutable review/evidence-version relationship sufficient to promote its flags into agent authority. taxguard_draft_returns stores mutable calculation JSON. Neither a caller's validated=true nor an arbitrary rule/authority ID establishes verified source provenance. BookkeepingEngine also uses process-local Maps and cannot be a silent durable fallback.

Current ai_evidence_sources supports CALCULATION/AUTHORITY/RULE classifications structurally, but runtime governance deliberately verifies DOCUMENT evidence only. Relaxing that check would require genuine independent authority verification, not relabeling document metadata or trusting model citations.

Minimum safe AI-10 scope: preserve deterministic engines, explicitly deny calculation/tax-law/form/diagnostic execution without reviewed facts and versioned verified authority, and test that named agents, fabricated facts/authority, high confidence and SQL ALLOW cannot bypass these requirements. Do not grant tax-data export, LLM arithmetic, fake completed forms, universal jurisdiction support or workflow/record mutations. All agents remain DRAFT.

Durable human-validation and authoritative-action foundations must be implemented later without backfilling invented reviews. A future narrow calculation adapter can consume those sources when available. Missing optional authority stays denied; development can continue to other legitimate non-production controls.
