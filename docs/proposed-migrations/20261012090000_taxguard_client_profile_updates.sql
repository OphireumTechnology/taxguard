-- PROPOSAL 009 ONLY. NOT APPLIED. Requires core schema and proposal 006 atomic identity; not intake/session proposals.
-- Company display name is ordinary contact data. Legal name changes require an independent amendment flow.
-- No onboarding, dossier, membership, case, workflow or authority writes. No repair or upsert.
-- No historical company-name backfill: commissioning must separately reconcile legacy contact JSON
-- with client columns. PGlite tests prove single-transaction rollback, not multi-connection contention.
-- Before release verify profile writes against lifecycle/provision/session changes in isolated PostgreSQL.
ALTER TABLE public.taxguard_clients ADD COLUMN IF NOT EXISTS company_name varchar(255);
CREATE OR REPLACE FUNCTION public.taxguard_update_client_profile(p_tenant text,p_uid text,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.taxguard_members%ROWTYPE; i public.taxguard_identities%ROWTYPE; c public.taxguard_clients%ROWTYPE;
  k text; v jsonb; u jsonb; stamp timestamptz := now();
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_uid IS NULL OR p_uid !~ '^[A-Za-z0-9_-]{1,128}$'
    OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR p_patch='{}'::jsonb THEN
    RAISE EXCEPTION 'CLIENT_PROFILE_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_patch) LOOP
    IF k NOT IN ('phone','companyName') OR jsonb_typeof(v)<>'string'
      OR length(v #>> '{}') > (CASE WHEN k='phone' THEN 64 ELSE 255 END)
      OR (v #>> '{}') ~ '[[:cntrl:]]' OR (v #>> '{}') ~ ('['||chr(127)||'-'||chr(159)||']') THEN
      RAISE EXCEPTION 'CLIENT_PROFILE_INPUT_INVALID' USING ERRCODE='P0001';
    END IF;
  END LOOP;
  -- Match identity/lifecycle member -> identity -> client row ordering.
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO m FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_uid FOR UPDATE;
  IF NOT FOUND OR m.role<>'client' OR m.status<>'active' OR m.client_id IS NULL THEN
    RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO i FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_clients WHERE tenant_id=p_tenant AND owner_uid=p_uid AND client_id=m.client_id FOR UPDATE;
  IF NOT FOUND OR c.status<>'active' OR c.client_id !~ '^[A-Z0-9]{3,9}$' OR c.client_id ~ '^0+$'
    OR i.user_data->>'id' IS DISTINCT FROM p_uid OR i.user_data->>'tenantId' IS DISTINCT FROM p_tenant
    OR i.user_data->>'clientId' IS DISTINCT FROM c.client_id OR i.user_data->>'role' IS DISTINCT FROM 'client'
    OR i.user_data->>'status' IS DISTINCT FROM 'active' OR i.user_data->'isVerified' IS DISTINCT FROM 'true'::jsonb
    OR i.user_data->>'email' IS DISTINCT FROM c.email OR c.email IS NULL OR c.email ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']') OR c.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR i.user_data->>'name' IS DISTINCT FROM c.name OR c.name IS NULL OR length(c.name) NOT BETWEEN 1 AND 255 OR c.name ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']')
    OR i.user_data->>'onboardingStatus' IS NULL OR i.user_data->>'onboardingStatus' NOT IN ('not_started','in_progress','submitted','approved','completed','NOT_STARTED','IN_PROGRESS','COMPLETED')
    OR EXISTS(SELECT 1 FROM public.taxguard_members WHERE uid=p_uid AND tenant_id<>p_tenant)
    OR EXISTS(SELECT 1 FROM public.taxguard_clients WHERE owner_uid=p_uid AND (tenant_id<>p_tenant OR client_id<>c.client_id)) THEN
    RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END IF;
  -- Unpatched contacts must agree across identity JSON and client columns.
  -- Absent/JSON-null legacy values mean empty; no silent backfill or dropping.
  FOR k IN SELECT unnest(ARRAY['phone','companyName']) LOOP
    IF NOT (p_patch ? k) THEN
      v := i.user_data->k;
      IF (v IS NOT NULL AND v <> 'null'::jsonb AND jsonb_typeof(v)<>'string')
        OR coalesce(i.user_data->>k,'') IS DISTINCT FROM
          (CASE WHEN k='phone' THEN coalesce(c.phone,'') ELSE coalesce(c.company_name,'') END) THEN
        RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001';
      END IF;
    END IF;
  END LOOP;
  -- Validate existing fields used in the safe client DTO before mutating anything.
  IF (NOT (p_patch ? 'phone') AND coalesce(c.phone,'') ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']'))
    OR (NOT (p_patch ? 'companyName') AND coalesce(c.company_name,'') ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']'))
    OR NOT isfinite(i.created_at) OR (i.user_data->'onboardingCompletedAt' IS NOT NULL AND i.user_data->'onboardingCompletedAt'<>'null'::jsonb AND
    (jsonb_typeof(i.user_data->'onboardingCompletedAt')<>'string' OR i.user_data->>'onboardingCompletedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$')) THEN
    RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END IF;
  IF i.user_data->>'onboardingCompletedAt' IS NOT NULL THEN
    BEGIN
      IF NOT isfinite((i.user_data->>'onboardingCompletedAt')::timestamptz) THEN RAISE EXCEPTION 'invalid'; END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLIENT_PROFILE_DENIED' USING ERRCODE='P0001'; END;
  END IF;
  UPDATE public.taxguard_clients SET
    phone=CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE phone END,
    company_name=CASE WHEN p_patch ? 'companyName' THEN p_patch->>'companyName' ELSE company_name END,
    updated_at=stamp WHERE id=c.id RETURNING * INTO c;
  UPDATE public.taxguard_identities SET user_data=user_data||p_patch||jsonb_build_object('updatedAt',stamp),updated_at=stamp
    WHERE tenant_id=p_tenant AND uid=p_uid;
  INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
    VALUES(p_tenant,'CLIENT_PROFILE_UPDATED',p_uid,'client',jsonb_build_object('clientId',c.client_id,'fields',(SELECT jsonb_agg(key ORDER BY key) FROM jsonb_object_keys(p_patch) key)));
  u:=jsonb_build_object('id',p_uid,'tenantId',p_tenant,'clientId',c.client_id,'email',c.email,'name',c.name,
    'role','client','status','active','isVerified',true,'phone',coalesce(c.phone,''),'companyName',coalesce(c.company_name,''),
    'onboardingStatus',i.user_data->'onboardingStatus','onboardingCompletedAt',i.user_data->'onboardingCompletedAt','createdAt',i.created_at,'updatedAt',stamp);
  RETURN jsonb_build_object('user',u);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_update_client_profile(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_update_client_profile(text,text,jsonb) TO service_role;
