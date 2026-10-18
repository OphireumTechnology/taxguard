-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on durable ledger 024.
-- Preserve original business implementations, scoped uniqueness, hashes, integer cents,
-- period rules, reversal posting dates and independent review. Serialize before replay lookup.
-- Rollback: disable affected writes pending review; do not expose uncoordinated entry points.
-- Deferred checks execute at COMMIT, after RPC definer context has ended. Keep their existing
-- pinned path and invariant logic, but give the private trigger its owner's read authority.
ALTER FUNCTION public.taxguard_ledger_assert_balanced() SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.taxguard_ledger_assert_balanced() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.taxguard_ledger_retry_lock(p_tenant text,p_client text,p_actor text,p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.taxguard_ledger_actor(p_tenant,p_client,p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  -- Posting and reversal share the same durable key namespace, so they share this lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('ledger-entry',p_tenant,p_client,p_key)::text,0));
  PERFORM public.taxguard_ledger_actor(p_tenant,p_client,p_actor);
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_ledger_post_entry_once(p_tenant text,p_client text,p_actor text,p_key text,p_hash text,p_entry jsonb,p_replaces uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.taxguard_ledger_retry_lock(p_tenant,p_client,p_actor,p_key);
  RETURN public.taxguard_ledger_post_entry(p_tenant,p_client,p_actor,p_key,p_hash,p_entry,p_replaces);
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_ledger_reverse_entry_once(p_tenant text,p_client text,p_actor text,p_key text,p_hash text,p_entry uuid,p_posting_date date,p_period text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.taxguard_ledger_retry_lock(p_tenant,p_client,p_actor,p_key);
  RETURN public.taxguard_ledger_reverse_entry(p_tenant,p_client,p_actor,p_key,p_hash,p_entry,p_posting_date,p_period,p_reason);
END $$;
-- Internal implementations remain available to their definer, not the external service role.
REVOKE ALL ON FUNCTION public.taxguard_ledger_post_entry(text,text,text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_ledger_reverse_entry(text,text,text,text,text,uuid,date,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_ledger_retry_lock(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_ledger_post_entry_once(text,text,text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_ledger_reverse_entry_once(text,text,text,text,text,uuid,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_post_entry_once(text,text,text,text,text,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_reverse_entry_once(text,text,text,text,text,uuid,date,text,text) TO service_role;
