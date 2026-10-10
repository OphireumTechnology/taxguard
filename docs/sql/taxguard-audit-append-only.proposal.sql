-- REVIEW PROPOSAL ONLY: not a migration and never applied to shared databases.
-- Create an official migration with the Supabase CLI after authorized review.
-- Table owners/superusers can disable triggers; independent custody is still required.
CREATE FUNCTION public.taxguard_reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'TAXGUARD_AUDIT_IMMUTABLE';
END;
$$;

CREATE TRIGGER taxguard_audit_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.taxguard_audit_log
FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_reject_audit_mutation();

REVOKE ALL ON FUNCTION public.taxguard_reject_audit_mutation() FROM PUBLIC;
