-- PROPOSAL ONLY. NOT APPLIED. Requires core schema and preceding identity proposals.
-- Durable intake is client input awaiting review, not stage completion, staff
-- assignment, engagement/year creation, or a second seven-stage workflow.
-- Existing real active engagement/year scope is required for every operation.
-- PGlite verifies transactions, not multi-connection advisory lock contention.

CREATE TABLE public.taxguard_client_intake_drafts (
  tenant_id varchar(128) NOT NULL,
  client_id varchar(64) NOT NULL,
  engagement_id varchar(128) NOT NULL,
  tax_year integer NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  owner_uid varchar(128) NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version=1),
  revision integer NOT NULL CHECK (revision>0),
  status varchar(16) NOT NULL CHECK (status IN ('DRAFT','SUBMITTED')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16384),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  PRIMARY KEY(tenant_id,client_id,engagement_id,tax_year),
  FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year)
    REFERENCES public.taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year),
  FOREIGN KEY(tenant_id,owner_uid) REFERENCES public.taxguard_members(tenant_id,uid),
  CHECK ((status='DRAFT' AND submitted_at IS NULL) OR (status='SUBMITTED' AND submitted_at IS NOT NULL))
);
CREATE TABLE public.taxguard_client_intake_requests (
  tenant_id varchar(128) NOT NULL,
  client_id varchar(64) NOT NULL,
  engagement_id varchar(128) NOT NULL,
  tax_year integer NOT NULL,
  request_id varchar(128) NOT NULL,
  owner_uid varchar(128) NOT NULL,
  request_input jsonb NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,client_id,engagement_id,tax_year,request_id),
  FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year)
    REFERENCES public.taxguard_client_intake_drafts(tenant_id,client_id,engagement_id,tax_year)
);
ALTER TABLE public.taxguard_client_intake_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_client_intake_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_client_intake_drafts,public.taxguard_client_intake_requests FROM PUBLIC,anon,authenticated;
-- No browser policies or direct table grants. Security definer RPCs own the boundary.

CREATE OR REPLACE FUNCTION public.taxguard_client_intake_operation(
  p_action text,p_tenant text,p_actor text,p_client text,p_engagement text,p_tax_year integer,
  p_schema_version integer,p_expected_revision integer,p_request_id text,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  member_row public.taxguard_members%ROWTYPE;
  identity_row public.taxguard_identities%ROWTYPE;
  client_row public.taxguard_clients%ROWTYPE;
  draft_row public.taxguard_client_intake_drafts%ROWTYPE;
  prior_request public.taxguard_client_intake_requests%ROWTYPE;
  has_draft boolean; request_value jsonb; draft_value jsonb; result_value jsonb;
  field_name text; field_value jsonb; service_value jsonb;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('GET','SAVE','SUBMIT')
    OR p_tenant IS NULL OR length(p_tenant) NOT BETWEEN 1 AND 128 OR p_tenant<>btrim(p_tenant) OR p_tenant ~ '[[:cntrl:]]'
    OR p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 128 OR p_actor<>btrim(p_actor) OR p_actor ~ '[[:cntrl:]]'
    OR p_client IS NULL OR length(p_client) NOT BETWEEN 1 AND 64 OR p_client<>btrim(p_client) OR p_client ~ '[[:cntrl:]]'
    OR p_engagement IS NULL OR length(p_engagement) NOT BETWEEN 1 AND 128 OR p_engagement<>btrim(p_engagement) OR p_engagement ~ '[[:cntrl:]]'
    OR p_tax_year IS NULL OR p_tax_year NOT BETWEEN 2000 AND 2200 THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  IF p_action<>'GET' AND (p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>=2147483647
    OR p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{8,128}$') THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  IF p_action='SAVE' THEN
    IF p_schema_version IS DISTINCT FROM 1 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
      OR octet_length(p_payload::text)>16384 THEN
      RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
    END IF;
    FOR field_name,field_value IN SELECT key,value FROM jsonb_each(p_payload) LOOP
      IF field_name NOT IN ('clientCategory','preferredContactMethod','phone','selectedServices','intakeNotes') THEN
        RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
      END IF;
      IF field_name='selectedServices' THEN
        IF jsonb_typeof(field_value)<>'array' OR jsonb_array_length(field_value)>20 THEN
          RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
        END IF;
        FOR service_value IN SELECT value FROM jsonb_array_elements(field_value) LOOP
          IF jsonb_typeof(service_value)<>'string' OR service_value#>>'{}' !~ '^[a-z][a-z0-9_]{0,63}$' THEN
            RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
          END IF;
        END LOOP;
        IF (SELECT count(*) FROM jsonb_array_elements(field_value)) <>
          (SELECT count(DISTINCT value) FROM jsonb_array_elements(field_value)) THEN
          RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
        END IF;
      ELSE
        IF jsonb_typeof(field_value)<>'string' OR field_value#>>'{}' ~ '[[:cntrl:]]' THEN
          RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
        END IF;
        IF (field_name='clientCategory' AND field_value#>>'{}' NOT IN ('individual_taxpayer','married_household','sole_proprietor','independent_contractor','partnership','corporation','scorporation','llc','nonprofit','estate_trust'))
          OR (field_name='preferredContactMethod' AND field_value#>>'{}' NOT IN ('email','phone','sms','portal'))
          OR (field_name='phone' AND length(field_value#>>'{}')>32)
          OR (field_name='intakeNotes' AND length(field_value#>>'{}')>2000) THEN
          RAISE EXCEPTION 'CLIENT_INTAKE_INPUT_INVALID' USING ERRCODE='P0001';
        END IF;
      END IF;
    END LOOP;
  END IF;
  -- Match identity lifecycle's member -> identity row lock order. All scope rows
  -- remain locked until the transaction returns so ownership cannot change midway.
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_INTAKE_ACCESS_DENIED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO member_row FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE;
  IF NOT FOUND OR member_row.role<>'client' OR member_row.status<>'active' OR member_row.client_id IS DISTINCT FROM p_client THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO identity_row FROM public.taxguard_identities WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE;
  IF NOT FOUND OR identity_row.user_data->>'id' IS DISTINCT FROM p_actor
    OR identity_row.user_data->>'tenantId' IS DISTINCT FROM p_tenant
    OR identity_row.user_data->>'role' IS DISTINCT FROM 'client'
    OR identity_row.user_data->>'status' IS DISTINCT FROM 'active'
    OR identity_row.user_data->>'clientId' IS DISTINCT FROM p_client
    OR identity_row.user_data->'isVerified' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO client_row FROM public.taxguard_clients WHERE tenant_id=p_tenant AND client_id=p_client FOR SHARE;
  IF NOT FOUND OR client_row.owner_uid IS DISTINCT FROM p_actor OR client_row.status<>'active'
    OR client_row.email IS DISTINCT FROM identity_row.user_data->>'email'
    OR client_row.name IS DISTINCT FROM identity_row.user_data->>'name' THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_engagements WHERE tenant_id=p_tenant AND client_id=p_client
    AND engagement_id=p_engagement AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_INTAKE_SCOPE_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_years WHERE tenant_id=p_tenant AND client_id=p_client
    AND engagement_id=p_engagement AND tax_year=p_tax_year AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_INTAKE_SCOPE_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  -- Scope-wide serialization also covers the absent-draft creation race.
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:client-intake:'||p_tenant||':'||p_client||':'||p_engagement||':'||p_tax_year::text));
  SELECT * INTO draft_row FROM public.taxguard_client_intake_drafts WHERE tenant_id=p_tenant AND client_id=p_client
    AND engagement_id=p_engagement AND tax_year=p_tax_year FOR UPDATE;
  has_draft := FOUND;
  IF has_draft AND draft_row.owner_uid IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'CLIENT_INTAKE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  IF p_action<>'GET' THEN
    request_value := jsonb_build_object('action',p_action,'ownerUid',p_actor,'expectedRevision',p_expected_revision,
      'schemaVersion',p_schema_version,'payload',p_payload);
    SELECT * INTO prior_request FROM public.taxguard_client_intake_requests
      WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=p_engagement
        AND tax_year=p_tax_year AND request_id=p_request_id FOR UPDATE;
    IF FOUND THEN
      IF prior_request.owner_uid IS DISTINCT FROM p_actor OR prior_request.request_input IS DISTINCT FROM request_value THEN
        RAISE EXCEPTION 'CLIENT_INTAKE_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';
      END IF;
      RETURN jsonb_set(prior_request.response,'{resumed}','true'::jsonb);
    END IF;
    IF (NOT has_draft AND p_expected_revision<>0) OR (has_draft AND draft_row.revision<>p_expected_revision) THEN
      RAISE EXCEPTION 'CLIENT_INTAKE_REVISION_CONFLICT' USING ERRCODE='P0001';
    END IF;
    IF has_draft AND draft_row.status='SUBMITTED' THEN
      RAISE EXCEPTION 'CLIENT_INTAKE_SUBMITTED' USING ERRCODE='P0001';
    END IF;
    IF p_action='SUBMIT' THEN
      IF NOT has_draft OR NOT (draft_row.payload ?& ARRAY['clientCategory','preferredContactMethod','phone','selectedServices'])
        OR length(btrim(draft_row.payload->>'phone'))=0 OR jsonb_array_length(draft_row.payload->'selectedServices')=0 THEN
        RAISE EXCEPTION 'CLIENT_INTAKE_INCOMPLETE' USING ERRCODE='P0001';
      END IF;
      UPDATE public.taxguard_client_intake_drafts SET status='SUBMITTED',revision=revision+1,
        submitted_at=now(),updated_at=now() WHERE tenant_id=p_tenant AND client_id=p_client
        AND engagement_id=p_engagement AND tax_year=p_tax_year RETURNING * INTO draft_row;
    ELSIF NOT has_draft THEN
      INSERT INTO public.taxguard_client_intake_drafts(tenant_id,client_id,engagement_id,tax_year,owner_uid,schema_version,revision,status,payload)
        VALUES(p_tenant,p_client,p_engagement,p_tax_year,p_actor,1,1,'DRAFT',p_payload) RETURNING * INTO draft_row;
    ELSE
      UPDATE public.taxguard_client_intake_drafts SET payload=p_payload,revision=revision+1,updated_at=now()
        WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=p_engagement AND tax_year=p_tax_year RETURNING * INTO draft_row;
    END IF;
    INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
      VALUES(p_tenant,'CLIENT_INTAKE_'||CASE WHEN p_action='SAVE' THEN 'SAVED' ELSE 'SUBMITTED' END,p_actor,'client',
        jsonb_build_object('clientId',p_client,'engagementId',p_engagement,'taxYear',p_tax_year,'revision',draft_row.revision));
    has_draft := true;
  END IF;
  draft_value := CASE WHEN NOT has_draft THEN NULL ELSE jsonb_build_object(
    'tenantId',draft_row.tenant_id,'clientId',draft_row.client_id,'engagementId',draft_row.engagement_id,
    'taxYear',draft_row.tax_year,'ownerUid',draft_row.owner_uid,'schemaVersion',draft_row.schema_version,
    'revision',draft_row.revision,'status',draft_row.status,'payload',draft_row.payload,
    'createdAt',draft_row.created_at,'updatedAt',draft_row.updated_at,'submittedAt',draft_row.submitted_at) END;
  result_value := jsonb_build_object('draft',draft_value,'resumed',false);
  IF p_action<>'GET' THEN
    INSERT INTO public.taxguard_client_intake_requests(tenant_id,client_id,engagement_id,tax_year,request_id,owner_uid,request_input,response)
      VALUES(p_tenant,p_client,p_engagement,p_tax_year,p_request_id,p_actor,request_value,result_value);
  END IF;
  RETURN result_value;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_client_intake_operation(text,text,text,text,text,integer,integer,integer,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.taxguard_save_client_intake(p_tenant text,p_actor text,p_client text,p_engagement text,p_tax_year integer,p_schema_version integer,p_expected_revision integer,p_request_id text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT public.taxguard_client_intake_operation('SAVE',p_tenant,p_actor,p_client,p_engagement,p_tax_year,p_schema_version,p_expected_revision,p_request_id,p_payload);
$$;
CREATE OR REPLACE FUNCTION public.taxguard_submit_client_intake(p_tenant text,p_actor text,p_client text,p_engagement text,p_tax_year integer,p_expected_revision integer,p_request_id text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT public.taxguard_client_intake_operation('SUBMIT',p_tenant,p_actor,p_client,p_engagement,p_tax_year,NULL,p_expected_revision,p_request_id,NULL);
$$;
CREATE OR REPLACE FUNCTION public.taxguard_get_client_intake(p_tenant text,p_actor text,p_client text,p_engagement text,p_tax_year integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT public.taxguard_client_intake_operation('GET',p_tenant,p_actor,p_client,p_engagement,p_tax_year,NULL,NULL,NULL,NULL);
$$;
REVOKE ALL ON FUNCTION public.taxguard_save_client_intake(text,text,text,text,integer,integer,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_submit_client_intake(text,text,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_get_client_intake(text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_save_client_intake(text,text,text,text,integer,integer,integer,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_submit_client_intake(text,text,text,text,integer,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_get_client_intake(text,text,text,text,integer) TO service_role;
