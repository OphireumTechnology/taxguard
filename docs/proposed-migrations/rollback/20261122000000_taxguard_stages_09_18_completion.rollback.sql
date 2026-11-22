-- ============================================================================
-- ROLLBACK PROPOSAL FOR 20261122000000_taxguard_stages_09_18_completion.sql
-- REVIEW ONLY — DEVELOPMENT / STAGING REHEARSAL USE ONLY.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.taxguard_annual_cycle_generations;
DROP TABLE IF EXISTS public.taxguard_tax_year_carryforwards;
DROP TABLE IF EXISTS public.taxguard_engagement_renewals;
DROP TRIGGER IF EXISTS trg_taxguard_archive_legal_hold_guard ON public.taxguard_archive_packages;
DROP FUNCTION IF EXISTS public.taxguard_prevent_legal_hold_deletion();
DROP TABLE IF EXISTS public.taxguard_legal_holds;
DROP TABLE IF EXISTS public.taxguard_archive_packages;
DROP TABLE IF EXISTS public.taxguard_archive_retention_policies;
DROP TABLE IF EXISTS public.taxguard_notification_outbox;
DROP TABLE IF EXISTS public.taxguard_monitoring_obligations;
DROP TABLE IF EXISTS public.taxguard_return_amendments;
DROP TABLE IF EXISTS public.taxguard_resolution_cases;
DROP TABLE IF EXISTS public.taxguard_transcript_requests;
DROP TABLE IF EXISTS public.taxguard_government_notices;
DROP TABLE IF EXISTS public.taxguard_filing_acknowledgments;
DROP TABLE IF EXISTS public.taxguard_filing_transmissions;
DROP TABLE IF EXISTS public.taxguard_signature_webhook_nonces;
DROP TABLE IF EXISTS public.taxguard_signature_envelopes;
DROP TABLE IF EXISTS public.taxguard_return_approval_records;
DROP TABLE IF EXISTS public.taxguard_return_review_findings;
DROP TABLE IF EXISTS public.taxguard_book_to_tax_schedules;
DROP TABLE IF EXISTS public.taxguard_calculation_evidence_lineage;
DROP TABLE IF EXISTS public.taxguard_form_field_values;
DROP TABLE IF EXISTS public.taxguard_form_definitions;
DROP TABLE IF EXISTS public.taxguard_taxpayer_profiles;

COMMIT;
