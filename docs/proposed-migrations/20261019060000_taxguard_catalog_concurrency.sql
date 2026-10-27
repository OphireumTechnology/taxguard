-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on billing 028 and access overlay 058.
-- Serialize natural catalog identity before the original missing-row lookup. Preserve prices,
-- reason requirements and history logic; do not infer financial intent from equal amounts.
-- Rollback: disable catalog writes pending review; preserve price history.
CREATE OR REPLACE FUNCTION public.taxguard_bill_upsert_service_serialized(p_tenant text,p_actor text,p_code text,p_name text,p_category text,p_method text,p_fee numeric,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r text;
BEGIN
  r:=public.taxguard_practice_actor(p_tenant,p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_code IS NULL OR p_code !~ '^[A-Z0-9_-]{2,64}$' THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-catalog',p_tenant,p_code)::text,0));
  -- The original implementation rechecks membership and manager authority after waiting.
  RETURN public.taxguard_bill_upsert_service(p_tenant,p_actor,p_code,p_name,p_category,p_method,p_fee,p_reason);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_upsert_service(text,text,text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_upsert_service_serialized(text,text,text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_upsert_service_serialized(text,text,text,text,text,text,numeric,text) TO service_role;
