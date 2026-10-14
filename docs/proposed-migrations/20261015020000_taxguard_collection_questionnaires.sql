-- PROPOSAL 053 ONLY. NOT APPLIED. Depends on 025/027/049 and the core engagement/year schema.
-- Client-reported collection drafts and waiver CLAIMS only; no facts verified, no stage completed.
-- Rollback: disable collection writes, preserve records/history; never fall back to memory authority.
CREATE TABLE IF NOT EXISTS public.taxguard_collection_questionnaires (
 tenant_id varchar(128) NOT NULL,client_id varchar(64) NOT NULL,engagement_id varchar(128) NOT NULL,tax_year integer NOT NULL,
 revision integer NOT NULL CHECK(revision>0),answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=16384),
 requirements jsonb NOT NULL CHECK(jsonb_typeof(requirements)='array' AND jsonb_array_length(requirements)<=100),
 updated_by varchar(128) NOT NULL,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,client_id,engagement_id,tax_year),
 FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year) REFERENCES public.taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year)
);
CREATE TABLE IF NOT EXISTS public.taxguard_collection_history (
 tenant_id varchar(128) NOT NULL,client_id varchar(64) NOT NULL,engagement_id varchar(128) NOT NULL,tax_year integer NOT NULL,
 revision integer NOT NULL,request_id varchar(128) NOT NULL,actor_uid varchar(128) NOT NULL,request_input jsonb NOT NULL,response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,client_id,engagement_id,tax_year,request_id),
 UNIQUE(tenant_id,client_id,engagement_id,tax_year,revision),
 FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year) REFERENCES public.taxguard_collection_questionnaires(tenant_id,client_id,engagement_id,tax_year)
);
CREATE TABLE IF NOT EXISTS public.taxguard_collection_waiver_claims (
 tenant_id varchar(128) NOT NULL,client_id varchar(64) NOT NULL,engagement_id varchar(128) NOT NULL,tax_year integer NOT NULL,
 questionnaire_revision integer NOT NULL,requirement_code varchar(64) NOT NULL,reason varchar(500) NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 actor_uid varchar(128) NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),requires_professional_review boolean NOT NULL DEFAULT true CHECK(requires_professional_review),
 PRIMARY KEY(tenant_id,client_id,engagement_id,tax_year,questionnaire_revision,requirement_code),
 FOREIGN KEY(tenant_id,client_id,engagement_id,tax_year) REFERENCES public.taxguard_collection_questionnaires(tenant_id,client_id,engagement_id,tax_year)
);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['taxguard_collection_questionnaires','taxguard_collection_history','taxguard_collection_waiver_claims'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;END $$;

CREATE OR REPLACE FUNCTION public.taxguard_collection_scope(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text; ids text[]:=ARRAY[]::text[]; e record;
BEGIN
 IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2200 THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.taxguard_tenants WHERE id=p_tenant FOR SHARE;
 PERFORM 1 FROM public.taxguard_members WHERE tenant_id=p_tenant AND uid=p_actor FOR SHARE;
 PERFORM 1 FROM public.taxguard_clients WHERE tenant_id=p_tenant AND client_id=p_client FOR SHARE;
 PERFORM 1 FROM public.taxguard_staff_assignments WHERE tenant_id=p_tenant AND client_id=p_client AND user_id=p_actor FOR SHARE;
 k:=public.taxguard_doc_actor(p_tenant,p_client,p_actor);
 IF k='client' AND NOT EXISTS(SELECT 1 FROM public.taxguard_clients WHERE tenant_id=p_tenant AND client_id=p_client AND owner_uid=p_actor) THEN RAISE EXCEPTION 'COLLECTION_ACCESS_DENIED' USING ERRCODE='P0001'; END IF;
 FOR e IN SELECT y.engagement_id FROM public.taxguard_tax_years y JOIN public.taxguard_engagements g ON g.tenant_id=y.tenant_id AND g.client_id=y.client_id AND g.engagement_id=y.engagement_id
  WHERE y.tenant_id=p_tenant AND y.client_id=p_client AND y.tax_year=p_year AND y.status='active' AND g.status='active'
   AND (p_engagement IS NULL OR y.engagement_id=p_engagement) LIMIT 2 FOR SHARE OF y,g LOOP ids:=array_append(ids,e.engagement_id);END LOOP;
 IF cardinality(ids)<>1 THEN RAISE EXCEPTION 'COLLECTION_SCOPE_REQUIRED' USING ERRCODE='P0001'; END IF;
 RETURN ids[1];
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_collection_get(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE eng text; q public.taxguard_collection_questionnaires;
BEGIN
 eng:=public.taxguard_collection_scope(p_tenant,p_client,p_actor,p_year,p_engagement);
 SELECT * INTO q FROM public.taxguard_collection_questionnaires WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year;
 RETURN jsonb_build_object('tenantId',p_tenant,'clientId',p_client,'engagementId',eng,'taxYear',p_year,'hasQuestionnaire',FOUND,
  'questionnaire',CASE WHEN q.revision IS NOT NULL THEN jsonb_build_object('id','collection_'||p_client||'_'||p_year,'tenantId',p_tenant,'clientId',p_client,'engagementId',eng,'taxYear',p_year,
  'version',q.revision,'answers',q.answers,'updatedAt',q.updated_at,'source','CLIENT_REPORTED','professionalReviewRequired',true) END,
  'requirements',COALESCE(q.requirements,'[]'::jsonb),'waiverClaims',(SELECT COALESCE(jsonb_agg(jsonb_build_object('requirementCode',requirement_code,'requiresProfessionalReview',true)),'[]'::jsonb)
   FROM public.taxguard_collection_waiver_claims WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year AND questionnaire_revision=q.revision));
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_collection_save(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text,p_revision integer,p_request text,p_answers jsonb,p_requirements jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE eng text; q public.taxguard_collection_questionnaires; prior public.taxguard_collection_history; input jsonb; response jsonb; key text; value jsonb;
BEGIN
 eng:=public.taxguard_collection_scope(p_tenant,p_client,p_actor,p_year,p_engagement);
 IF p_revision IS NULL OR p_revision<0 OR p_revision>=2147483646 OR p_request IS NULL OR p_request !~ '^[A-Za-z0-9_-]{8,128}$'
  OR p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' OR octet_length(p_answers::text)>16384
  OR p_requirements IS NULL OR jsonb_typeof(p_requirements)<>'array' OR jsonb_array_length(p_requirements)>100 THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
 FOR key,value IN SELECT * FROM jsonb_each(p_answers) LOOP
  IF key IN ('filingStatus','stateOfResidency','additionalStates','dependentCount','materialTaxEventsDescription') THEN
   IF (key='filingStatus' AND (jsonb_typeof(value)<>'string' OR value#>>'{}' NOT IN ('single','married_filing_jointly','married_filing_separately','head_of_household','qualifying_surviving_spouse')))
    OR (key='stateOfResidency' AND (jsonb_typeof(value)<>'string' OR value#>>'{}' !~ '^[A-Z]{2}$'))
    OR (key='dependentCount' AND (jsonb_typeof(value)<>'number' OR value#>>'{}' !~ '^[0-9]{1,4}$'))
    OR (key='materialTaxEventsDescription' AND (jsonb_typeof(value)<>'string' OR length(value#>>'{}')>2000))
    OR (key='additionalStates' AND (jsonb_typeof(value)<>'array' OR jsonb_array_length(value)>60)) THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  ELSIF key IN ('hasDependents','hasW2Employment','hasMultipleEmployers','hasSelfEmployment','hasScheduleCActivity','hasPartnershipInterests','hasSCorporationInterests','hasCCorporationInterests','hasRentalProperties','hasBusinessAccountingRecords','hasInterestIncome','hasDividendIncome','hasSecuritiesTrades','hasCapitalGainsOrLosses','hasDigitalAssetsOrCrypto','hasRetirementDistributions','hasSocialSecurityBenefits','hasMarketplaceInsurance','hasHSA','hasEducationExpenses','hasMortgageOrRealEstateTaxes','hasItemizedDeductions','hasEstimatedTaxPayments','hasPriorYearFederalReturn','hasPriorYearStateReturn','hasForeignIncomeOrAssets','hasForeignBankAccounts','hasMultiStateIncome','hasPartYearResidency','hasOtherMaterialTaxEvents') THEN
   IF jsonb_typeof(value)<>'boolean' THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  ELSE RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
 END LOOP;
 IF NOT(p_answers?'filingStatus' AND p_answers?'stateOfResidency') OR EXISTS(SELECT 1 FROM unnest(ARRAY['hasDependents','hasW2Employment','hasSelfEmployment','hasInterestIncome','hasDividendIncome','hasSecuritiesTrades','hasCapitalGainsOrLosses','hasDigitalAssetsOrCrypto','hasRetirementDistributions','hasSocialSecurityBenefits','hasMarketplaceInsurance','hasHSA','hasEducationExpenses','hasMortgageOrRealEstateTaxes','hasItemizedDeductions','hasEstimatedTaxPayments','hasPriorYearFederalReturn','hasPriorYearStateReturn','hasForeignIncomeOrAssets','hasForeignBankAccounts','hasMultiStateIncome','hasPartYearResidency']) AS required(field) WHERE jsonb_typeof(p_answers->required.field) IS DISTINCT FROM 'boolean')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_answers->'additionalStates','[]'::jsonb)) s WHERE jsonb_typeof(s)<>'string' OR s#>>'{}' !~ '^[A-Z]{2}$') THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_requirements) r WHERE jsonb_typeof(r)<>'object' OR COALESCE(r->>'requirementCode','') !~ '^[A-Z0-9_-]{1,64}$') THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
 p_requirements:=(SELECT COALESCE(jsonb_agg(r||jsonb_build_object('status','Required','reviewStatus','PENDING','source','CLIENT_REPORTED')),'[]'::jsonb) FROM jsonb_array_elements(p_requirements) r);
 PERFORM pg_advisory_xact_lock(hashtextextended('collection:'||p_tenant||':'||p_client||':'||eng||':'||p_year,0));
 input:=jsonb_build_object('answers',p_answers,'revision',p_revision);
 SELECT * INTO prior FROM public.taxguard_collection_history WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year AND request_id=p_request;
 IF FOUND THEN IF prior.actor_uid<>p_actor OR prior.request_input<>input THEN RAISE EXCEPTION 'COLLECTION_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';END IF;RETURN prior.response;END IF;
 SELECT * INTO q FROM public.taxguard_collection_questionnaires WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year FOR UPDATE;
 IF COALESCE(q.revision,0)<>p_revision THEN RAISE EXCEPTION 'COLLECTION_VERSION_CONFLICT' USING ERRCODE='P0001';END IF;
 INSERT INTO public.taxguard_collection_questionnaires(tenant_id,client_id,engagement_id,tax_year,revision,answers,requirements,updated_by)
  VALUES(p_tenant,p_client,eng,p_year,p_revision+1,p_answers,p_requirements,p_actor)
  ON CONFLICT(tenant_id,client_id,engagement_id,tax_year) DO UPDATE SET revision=EXCLUDED.revision,answers=EXCLUDED.answers,requirements=EXCLUDED.requirements,updated_by=p_actor,updated_at=clock_timestamp();
 INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,metadata) VALUES(p_tenant,'COLLECTION_QUESTIONNAIRE_SAVED',p_actor,jsonb_build_object('clientId',p_client,'engagementId',eng,'taxYear',p_year,'revision',p_revision+1));
 response:=public.taxguard_collection_get(p_tenant,p_client,p_actor,p_year,eng)||jsonb_build_object('success',true);
 INSERT INTO public.taxguard_collection_history(tenant_id,client_id,engagement_id,tax_year,revision,request_id,actor_uid,request_input,response)
  VALUES(p_tenant,p_client,eng,p_year,p_revision+1,p_request,p_actor,input,response);
 RETURN response;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_collection_claim(p_tenant text,p_client text,p_actor text,p_year integer,p_engagement text,p_revision integer,p_code text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE eng text; q public.taxguard_collection_questionnaires; previous public.taxguard_collection_waiver_claims;
BEGIN
 eng:=public.taxguard_collection_scope(p_tenant,p_client,p_actor,p_year,p_engagement);
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 OR p_code IS NULL OR p_code !~ '^[A-Z0-9_-]{1,64}$' THEN RAISE EXCEPTION 'COLLECTION_INPUT_INVALID' USING ERRCODE='P0001';END IF;
 SELECT * INTO q FROM public.taxguard_collection_questionnaires WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year FOR UPDATE;
 IF q.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'COLLECTION_VERSION_CONFLICT' USING ERRCODE='P0001';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.requirements) r WHERE r->>'requirementCode'=p_code) THEN RAISE EXCEPTION 'COLLECTION_REQUIREMENT_NOT_FOUND' USING ERRCODE='P0001';END IF;
 SELECT * INTO previous FROM public.taxguard_collection_waiver_claims WHERE tenant_id=p_tenant AND client_id=p_client AND engagement_id=eng AND tax_year=p_year AND questionnaire_revision=p_revision AND requirement_code=p_code;
 IF FOUND THEN IF previous.reason<>btrim(p_reason) OR previous.actor_uid<>p_actor THEN RAISE EXCEPTION 'COLLECTION_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';END IF;
 ELSE
 INSERT INTO public.taxguard_collection_waiver_claims(tenant_id,client_id,engagement_id,tax_year,questionnaire_revision,requirement_code,reason,actor_uid) VALUES(p_tenant,p_client,eng,p_year,p_revision,p_code,btrim(p_reason),p_actor);
 INSERT INTO public.taxguard_audit_log(tenant_id,action,actor_uid,metadata) VALUES(p_tenant,'COLLECTION_WAIVER_CLAIMED',p_actor,jsonb_build_object('clientId',p_client,'requirementCode',p_code,'professionalReviewRequired',true));
 END IF;
 RETURN jsonb_build_object('success',true,'requiresProfessionalReview',true,'requirementCode',p_code,'status','CLAIM_PENDING');
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_collection_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'COLLECTION_HISTORY_IMMUTABLE' USING ERRCODE='55000';END $$;
DROP TRIGGER IF EXISTS collection_history_immutable ON public.taxguard_collection_history;
CREATE TRIGGER collection_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.taxguard_collection_history FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_collection_history_guard();
DROP TRIGGER IF EXISTS collection_claims_immutable ON public.taxguard_collection_waiver_claims;
CREATE TRIGGER collection_claims_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.taxguard_collection_waiver_claims FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_collection_history_guard();
DO $$DECLARE f record;BEGIN FOR f IN SELECT oid::regprocedure sig,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'taxguard_collection_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);
 IF f.proname IN('taxguard_collection_get','taxguard_collection_save','taxguard_collection_claim') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);END IF;END LOOP;END $$;
