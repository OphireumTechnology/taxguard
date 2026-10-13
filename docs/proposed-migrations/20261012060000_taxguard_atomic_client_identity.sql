-- PROPOSAL ONLY. NOT APPLIED. Requires every preceding staff identity proposal.
-- Preflight: resolve existing duplicate (tenant_id,owner_uid) client rows through a
-- separately approved review. This migration deliberately refuses to repair them.
-- Commissioning preflight: the core schema does NOT seed the primary counter.
-- Before enabling this RPC, separately review/bootstrap id='primary' from the
-- reconciled permanent global ID issuance history. Never default a missing counter
-- to zero, infer only from the largest visible ID, decrement, or reuse an issued ID.
-- Missing/negative/unsafe counters fail closed; existing identities are not repaired.
-- Verify all writers use the shared normalized email -> UID advisory lock protocol.
-- Before any approved release, use an isolated real PostgreSQL multi-connection
-- harness with overlapping transactions to verify: same-email different-UID and
-- same-UID different-email races; provision versus invitation create/accept; replay
-- versus activation/lifecycle; distinct-email allocations; rollback after row/audit
-- failure. Assert no duplicate mapping, gaps after rollback, privilege escalation,
-- or deadlock, and inspect blocked transactions and lock release after rollback.
-- PGlite execution does not establish that these concurrency checks passed.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.taxguard_clients GROUP BY tenant_id,owner_uid HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'CLIENT_OWNER_DUPLICATES_EXIST';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_clients_tenant_owner ON public.taxguard_clients(tenant_id,owner_uid);

-- PGlite's queued execution tests transaction rollback and ordering, not concurrent
-- multi-connection PostgreSQL advisory lock behavior; no production calls are made.
CREATE OR REPLACE FUNCTION public.taxguard_provision_client_identity(
  p_tenant text,p_uid text,p_email text,p_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  identity_row public.taxguard_identities%ROWTYPE;
  member_row public.taxguard_members%ROWTYPE;
  client_row public.taxguard_clients%ROWTYPE;
  identity_found boolean; member_found boolean; client_found boolean;
  current_counter bigint; sequence_value bigint; remaining bigint;
  suffix_capacity bigint; prefix_capacity bigint; block_capacity bigint;
  prefix_index bigint; suffix_index bigint; prefix_text text; client_id_value text;
  prefix_length integer; suffix_length integer; position integer; user_value jsonb; completion_time timestamptz;
BEGIN
  IF p_tenant IS NULL OR length(p_tenant) NOT BETWEEN 1 AND 128 OR p_tenant <> btrim(p_tenant)
    OR p_tenant ~ '[[:cntrl:]]'
    OR p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 128 OR p_uid <> btrim(p_uid) OR p_uid ~ '[[:cntrl:]]'
    OR p_email IS NULL OR length(p_email) NOT BETWEEN 3 AND 255 OR p_email <> lower(btrim(p_email))
    OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR p_email ~ '[[:cntrl:]]'
    OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 255 OR p_name <> btrim(p_name) OR p_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'CLIENT_IDENTITY_INPUT_INVALID' USING ERRCODE='P0001';
  END IF;
  -- Shared global email -> global UID -> rows order across all identity creation.
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:identity-email:' || p_email));
  PERFORM pg_advisory_xact_lock(hashtext(p_uid));
  PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_IDENTITY_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  -- Activation and lifecycle lock the target member before its identity. Match
  -- that order even for rejected staff/partial mappings to avoid an inversion.
  SELECT * INTO member_row FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_uid FOR UPDATE;
  member_found := FOUND;
  SELECT * INTO identity_row FROM public.taxguard_identities WHERE uid=p_uid FOR UPDATE;
  identity_found := FOUND;
  SELECT * INTO client_row FROM public.taxguard_clients WHERE tenant_id=p_tenant AND owner_uid=p_uid FOR UPDATE;
  client_found := FOUND;
  IF EXISTS (SELECT 1 FROM public.taxguard_identities WHERE lower(btrim(user_data->>'email'))=p_email AND uid<>p_uid)
    OR EXISTS (SELECT 1 FROM public.taxguard_members WHERE uid=p_uid AND tenant_id<>p_tenant)
    OR EXISTS (SELECT 1 FROM public.taxguard_clients WHERE owner_uid=p_uid AND tenant_id<>p_tenant) THEN
    RAISE EXCEPTION 'CLIENT_IDENTITY_CONFLICT' USING ERRCODE='P0001';
  END IF;
  IF identity_found OR member_found OR client_found THEN
    IF NOT (identity_found AND member_found AND client_found)
      OR identity_row.tenant_id IS DISTINCT FROM p_tenant
      OR identity_row.user_data->>'id' IS DISTINCT FROM p_uid
      OR identity_row.user_data->>'tenantId' IS DISTINCT FROM p_tenant
      OR identity_row.user_data->>'email' IS DISTINCT FROM p_email
      OR identity_row.user_data->>'role' IS DISTINCT FROM 'client'
      OR identity_row.user_data->>'status' IS DISTINCT FROM 'active'
      OR identity_row.user_data->'isVerified' IS DISTINCT FROM 'true'::jsonb
      OR identity_row.user_data->>'onboardingStatus' IS NULL
      OR identity_row.user_data->>'onboardingStatus' NOT IN ('not_started','in_progress','submitted','approved','completed','NOT_STARTED','IN_PROGRESS','COMPLETED')
      OR identity_row.user_data->>'name' IS NULL
      OR length(btrim(identity_row.user_data->>'name')) NOT BETWEEN 1 AND 255
      OR identity_row.user_data->>'name' ~ '[[:cntrl:]]'
      OR client_row.name IS DISTINCT FROM identity_row.user_data->>'name'
      OR identity_row.user_data->>'clientId' IS DISTINCT FROM client_row.client_id
      OR member_row.role IS DISTINCT FROM 'client' OR member_row.status IS DISTINCT FROM 'active'
      OR member_row.client_id IS DISTINCT FROM client_row.client_id OR client_row.status IS DISTINCT FROM 'active'
      OR client_row.email IS DISTINCT FROM p_email
      OR client_row.client_id !~ '^[A-Z0-9]{3,9}$' OR client_row.client_id ~ '^0+$'
      OR NOT isfinite(identity_row.created_at) THEN
      RAISE EXCEPTION 'CLIENT_IDENTITY_CONFLICT' USING ERRCODE='P0001';
    END IF;
    IF identity_row.user_data->'onboardingCompletedAt' IS NOT NULL
      AND identity_row.user_data->'onboardingCompletedAt' <> 'null'::jsonb THEN
      IF jsonb_typeof(identity_row.user_data->'onboardingCompletedAt') <> 'string'
        OR identity_row.user_data->>'onboardingCompletedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
        RAISE EXCEPTION 'CLIENT_IDENTITY_CONFLICT' USING ERRCODE='P0001';
      END IF;
      BEGIN
        completion_time := (identity_row.user_data->>'onboardingCompletedAt')::timestamptz;
        IF NOT isfinite(completion_time) THEN RAISE EXCEPTION 'invalid completion time'; END IF;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLIENT_IDENTITY_CONFLICT' USING ERRCODE='P0001'; END;
    END IF;
    -- Optional contacts remain whitelisted on replay; do not drop saved profile data.
    IF (identity_row.user_data ? 'phone' AND (jsonb_typeof(identity_row.user_data->'phone')<>'string'
      OR length(identity_row.user_data->>'phone')>64 OR identity_row.user_data->>'phone' ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']')
      OR identity_row.user_data->>'phone' IS DISTINCT FROM coalesce(client_row.phone,'')))
      OR (identity_row.user_data ? 'companyName' AND (jsonb_typeof(identity_row.user_data->'companyName')<>'string'
      OR length(identity_row.user_data->>'companyName')>255 OR identity_row.user_data->>'companyName' ~ ('[[:cntrl:]]|['||chr(127)||'-'||chr(159)||']'))) THEN
      RAISE EXCEPTION 'CLIENT_IDENTITY_CONFLICT' USING ERRCODE='P0001';
    END IF;
    user_value := jsonb_build_object('id',p_uid,'tenantId',p_tenant,'email',p_email,
      'name',identity_row.user_data->>'name','role','client','status','active','isVerified',true,
      'onboardingStatus',identity_row.user_data->>'onboardingStatus',
      'onboardingCompletedAt',identity_row.user_data->'onboardingCompletedAt',
      'createdAt',identity_row.created_at,'clientId',client_row.client_id) ||
      CASE WHEN identity_row.user_data ? 'phone' THEN jsonb_build_object('phone',identity_row.user_data->'phone') ELSE '{}'::jsonb END ||
      CASE WHEN identity_row.user_data ? 'companyName' THEN jsonb_build_object('companyName',identity_row.user_data->'companyName') ELSE '{}'::jsonb END;
    RETURN jsonb_build_object('user',user_value,'clientId',client_row.client_id,'resumed',true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_staff_invitations WHERE tenant_id=p_tenant AND email=p_email) THEN
    RAISE EXCEPTION 'CLIENT_INVITATION_EXISTS' USING ERRCODE='P0001';
  END IF;
  SELECT current_sequence INTO current_counter FROM public.taxguard_client_id_sequence WHERE id='primary' FOR UPDATE;
  IF NOT FOUND OR current_counter < 0 OR current_counter > 9007199254740990 THEN
    RAISE EXCEPTION 'CLIENT_COUNTER_CORRUPT' USING ERRCODE='P0001';
  END IF;
  UPDATE public.taxguard_client_id_sequence SET current_sequence=current_sequence+1,updated_at=now()
    WHERE id='primary' RETURNING current_sequence INTO sequence_value;
  IF sequence_value <= 999999999 THEN
    client_id_value := CASE WHEN sequence_value<1000 THEN lpad(sequence_value::text,3,'0') ELSE sequence_value::text END;
  ELSE
    remaining := sequence_value-1000000000;
    FOR prefix_length IN 1..9 LOOP
      suffix_length := 9-prefix_length;
      suffix_capacity := power(10::numeric,suffix_length)::bigint;
      prefix_capacity := power(26::numeric,prefix_length)::bigint;
      block_capacity := suffix_capacity*prefix_capacity;
      IF remaining < block_capacity THEN
        prefix_index := remaining/suffix_capacity;
        suffix_index := remaining%suffix_capacity;
        prefix_text := '';
        FOR position IN 1..prefix_length LOOP
          prefix_text := chr(65+(prefix_index%26)::integer)||prefix_text;
          prefix_index := prefix_index/26;
        END LOOP;
        client_id_value := prefix_text || CASE WHEN suffix_length=0 THEN '' ELSE lpad(suffix_index::text,suffix_length,'0') END;
        EXIT;
      END IF;
      remaining := remaining-block_capacity;
    END LOOP;
    IF client_id_value IS NULL THEN RAISE EXCEPTION 'CLIENT_ID_NAMESPACE_EXHAUSTED' USING ERRCODE='P0001'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_clients WHERE client_id=client_id_value)
    OR EXISTS (SELECT 1 FROM public.taxguard_members WHERE client_id=client_id_value)
    OR EXISTS (SELECT 1 FROM public.taxguard_identities WHERE user_data->>'clientId'=client_id_value) THEN
    RAISE EXCEPTION 'CLIENT_ID_COLLISION' USING ERRCODE='P0001';
  END IF;
  user_value := jsonb_build_object('id',p_uid,'tenantId',p_tenant,'email',p_email,'name',p_name,
    'role','client','status','active','isVerified',true,'onboardingStatus','NOT_STARTED',
    'onboardingCompletedAt',NULL,'createdAt',now(),'clientId',client_id_value);
  INSERT INTO public.taxguard_identities(uid,tenant_id,user_data) VALUES(p_uid,p_tenant,user_value);
  INSERT INTO public.taxguard_members(tenant_id,uid,role,status,client_id) VALUES(p_tenant,p_uid,'client','active',client_id_value);
  INSERT INTO public.taxguard_clients(tenant_id,client_id,owner_uid,name,email,status) VALUES(p_tenant,client_id_value,p_uid,p_name,p_email,'active');
  UPDATE public.taxguard_client_id_sequence SET last_issued_client_id=client_id_value WHERE id='primary';
  INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
    VALUES(p_tenant,'CLIENT_IDENTITY_PROVISIONED',p_uid,'client',jsonb_build_object('clientId',client_id_value));
  RETURN jsonb_build_object('user',user_value,'clientId',client_id_value,'resumed',false);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_provision_client_identity(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_provision_client_identity(text,text,text,text) TO service_role;

-- Replacements preserve invitation lifecycle behavior and share identity locks.
CREATE OR REPLACE FUNCTION taxguard_create_staff_invitation(
 p_tenant text, p_actor text, p_id text, p_email text, p_role text, p_first text, p_last text, p_token_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text; expiry timestamptz := NOW() + interval '7 days';
BEGIN
 IF p_email IS NULL OR p_email <> lower(trim(p_email)) OR length(p_email) NOT BETWEEN 3 AND 255 OR p_email ~ '[[:cntrl:]]' THEN
   RAISE EXCEPTION 'INVITATION_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('taxguard:identity-email:' || p_email));
 SELECT role INTO actor_role FROM taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor
   AND status='active' AND role IN ('admin','administrator','super_admin','super_administrator') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_ADMIN_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF p_email IS NULL OR p_email <> lower(trim(p_email)) OR length(p_email) > 255
   OR p_first IS NULL OR length(trim(p_first)) NOT BETWEEN 1 AND 128
   OR p_last IS NULL OR length(trim(p_last)) NOT BETWEEN 1 AND 128
   OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR p_role IS NULL OR p_role NOT IN ('accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin') THEN
   RAISE EXCEPTION 'INVITATION_INPUT_INVALID' USING ERRCODE='P0001';
 END IF;
 -- Bound issuance across server processes and prevent simultaneous duplicates/expiry replacement.
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant || ':staff-invite-actor:' || p_actor));
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant || ':staff-invite-email:' || p_email));
 IF (SELECT count(*) FROM taxguard_staff_invitations WHERE tenant_id=p_tenant AND invited_by=p_actor
   AND created_at > NOW()-interval '1 hour') >= 10 THEN
   RAISE EXCEPTION 'INVITATION_RATE_LIMITED' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (SELECT 1 FROM taxguard_identities WHERE lower(user_data->>'email')=p_email) THEN
   RAISE EXCEPTION 'IDENTITY_ALREADY_PROVISIONED' USING ERRCODE='P0001';
 END IF;
 -- Expired invitations remain historical, revoked records; only new issuance returns a new secret.
 WITH expired AS (
   UPDATE taxguard_staff_invitations SET status='revoked', revoked_by=p_actor, revoked_at=NOW()
     WHERE tenant_id=p_tenant AND email=p_email AND status='pending' AND expires_at<=NOW() RETURNING id
 ) INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   SELECT p_tenant,'STAFF_INVITATION_EXPIRED',p_actor,actor_role,jsonb_build_object('invitationId',id) FROM expired;
 INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,expires_at,invited_by)
   VALUES(p_id,p_tenant,p_email,p_role,trim(p_first),trim(p_last),p_token_hash,expiry,p_actor);
 INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata)
   VALUES(p_tenant,'STAFF_INVITATION_CREATED',p_actor,actor_role,jsonb_build_object('invitationId',p_id,'role',p_role,'expiresAt',expiry));
 RETURN jsonb_build_object('id',p_id,'expiresAt',expiry);
END $$;
REVOKE ALL ON FUNCTION taxguard_create_staff_invitation(text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION taxguard_create_staff_invitation(text,text,text,text,text,text,text,text) TO service_role;


CREATE OR REPLACE FUNCTION taxguard_accept_staff_invitation(
  p_tenant text, p_token_hash text, p_uid text, p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE invitation taxguard_staff_invitations%ROWTYPE; result jsonb;
BEGIN
  IF p_email IS NULL OR p_email <> lower(btrim(p_email)) OR length(p_email) NOT BETWEEN 3 AND 255 OR p_email ~ '[[:cntrl:]]'
    OR p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 128 OR p_uid <> btrim(p_uid) OR p_uid ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'INVITATION_INVALID' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:identity-email:' || p_email));
  PERFORM pg_advisory_xact_lock(hashtext(p_uid));
  SELECT * INTO invitation FROM taxguard_staff_invitations
    WHERE tenant_id = p_tenant AND token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR invitation.status <> 'pending' OR invitation.expires_at <= NOW()
    OR lower(invitation.email) <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'INVITATION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Serialize competing invitations for the same external identity across all tenants.
  IF EXISTS (SELECT 1 FROM taxguard_identities WHERE uid = p_uid)
    OR EXISTS (SELECT 1 FROM taxguard_members WHERE uid = p_uid)
    OR EXISTS (SELECT 1 FROM taxguard_clients WHERE owner_uid = p_uid)
    OR EXISTS (SELECT 1 FROM taxguard_identities WHERE lower(btrim(user_data->>'email')) = p_email) THEN
    RAISE EXCEPTION 'IDENTITY_ALREADY_PROVISIONED' USING ERRCODE = 'P0001';
  END IF;
  result := jsonb_build_object('id', p_uid, 'tenantId', p_tenant, 'email', lower(trim(p_email)),
    'name', invitation.legal_first_name || ' ' || invitation.legal_last_name,
    'role', invitation.role, 'status', 'pending_approval', 'isVerified', true, 'mfaEnabled', true);
  INSERT INTO taxguard_identities(uid, tenant_id, user_data) VALUES(p_uid, p_tenant, result);
  INSERT INTO taxguard_members(tenant_id, uid, role, status, invited_by)
    VALUES(p_tenant, p_uid, invitation.role, 'pending_approval', invitation.invited_by);
  UPDATE taxguard_staff_invitations SET status = 'accepted', accepted_uid = p_uid, accepted_at = NOW()
    WHERE id = invitation.id;
  INSERT INTO taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
    VALUES(p_tenant, 'STAFF_INVITATION_ACCEPTED', p_uid, invitation.role,
      jsonb_build_object('invitationId', invitation.id, 'status', 'pending_approval'));
  RETURN jsonb_build_object('status', 'pending_approval');
END $$;
REVOKE ALL ON FUNCTION taxguard_accept_staff_invitation(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION taxguard_accept_staff_invitation(text,text,text,text) TO service_role;

