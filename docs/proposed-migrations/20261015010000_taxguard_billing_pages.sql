-- PROPOSAL 048 ONLY. NOT APPLIED. Depends on 028. No billing arithmetic changed.
-- Bounded, scoped keyset pagination with the existing database client allow-list.
-- Compatibility list refuses oversized results rather than silently truncating balances.
-- Rollback: disable billing reads; preserve database confidentiality; do not restore leaking functions.
CREATE INDEX IF NOT EXISTS taxguard_bill_page_index ON public.taxguard_invoices(tenant_id,client_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION public.taxguard_bill_page(p_tenant text,p_client text,p_actor text,p_after_at timestamptz DEFAULT NULL,p_after_id text DEFAULT NULL,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET statement_timeout='5s' AS $$
DECLARE k text; rows jsonb; last_row jsonb; summary jsonb;
BEGIN
 k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR ((p_after_at IS NULL)<>(p_after_id IS NULL)) OR length(p_after_id)>128 THEN RAISE EXCEPTION 'BILLING_PAGE_INVALID' USING ERRCODE='P0001'; END IF;
 SELECT COALESCE(jsonb_agg(CASE WHEN k='client' THEN public.taxguard_bill_client_invoice_json(i) ELSE public.taxguard_bill_invoice_json(i) END ORDER BY i.created_at DESC,i.id DESC),'[]'::jsonb) INTO rows
 FROM (SELECT * FROM public.taxguard_invoices WHERE tenant_id=p_tenant AND client_id=p_client
   AND (k<>'client' OR (approved_at IS NOT NULL AND status IN ('ISSUED','PARTIALLY_PAID','PAID','PAST_DUE','VOID')))
   AND (p_after_at IS NULL OR (created_at,id)<(p_after_at,p_after_id)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1) i;
 SELECT jsonb_build_object('balanceDue',public.taxguard_bill_text(COALESCE(sum(balance_due),0)),'invoiceCount',count(*)) INTO summary
 FROM public.taxguard_invoices WHERE tenant_id=p_tenant AND client_id=p_client
   AND (k<>'client' OR (approved_at IS NOT NULL AND status IN ('ISSUED','PARTIALLY_PAID','PAID','PAST_DUE','VOID')));
 last_row:=rows->(p_limit-1);
 RETURN jsonb_build_object('items',(SELECT COALESCE(jsonb_agg(value ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(rows) WITH ORDINALITY a(value,ord) WHERE ord<=p_limit),
   'next',CASE WHEN jsonb_array_length(rows)>p_limit THEN jsonb_build_object('at',last_row->'createdAt','id',last_row->'invoiceId') END,'summary',summary);
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_list(p_tenant text,p_client text,p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE page jsonb;
BEGIN
 page:=public.taxguard_bill_page(p_tenant,p_client,p_actor,NULL,NULL,100);
 IF page->'next'<>'null'::jsonb THEN RAISE EXCEPTION 'BILLING_PAGINATION_REQUIRED' USING ERRCODE='P0001'; END IF;
 RETURN page->'items';
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_page(text,text,text,timestamptz,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_page(text,text,text,timestamptz,text,integer) TO service_role;
