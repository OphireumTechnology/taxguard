import type { Express, RequestHandler } from 'express';

/**
 * Production cutover gate for the durable routers that today run only on the development server.
 *
 * A router is reachable in production only when ALL of these hold, and otherwise is not mounted at all (the
 * production /api boundary answers 404):
 *   1. it is requested explicitly in TAXGUARD_PRODUCTION_ROUTE_CUTOVER (comma-separated keys);
 *   2. every proposal it depends on is listed in OWNER_APPROVED_PROPOSALS, which only an owner-approved,
 *      reviewed change may extend (empty: no review-only proposal is approved);
 *   3. a schema probe confirms each sentinel RPC exists in the connected database; until verified the route
 *      answers 503 ROUTE_CUTOVER_SCHEMA_UNVERIFIED and never reaches the router.
 * Each router keeps its own store gate (practiceStoreConfigured), which is still closed in production: opening it
 * for the protected project is a separate owner decision at cutover time. Fails closed at every step.
 */
export const OWNER_APPROVED_PROPOSALS: readonly string[] = Object.freeze([]);

export interface CutoverRoute {
  key: string;
  path: string;
  /** Review-only proposals (version prefixes) whose functions the router calls. */
  proposals: readonly string[];
  /** RPCs that must exist before any request is passed on. */
  sentinelRpcs: readonly string[];
}

export const ROUTE_CUTOVER_CATALOG: readonly CutoverRoute[] = Object.freeze([
  { key: 'practice', path: '/api/practice', proposals: ['20261012250000', '20261018100000', '20261019230000'], sentinelRpcs: ['taxguard_practice_client_detail'] },
  { key: 'stage-one', path: '/api/stage-one', proposals: ['20261018030000'], sentinelRpcs: ['taxguard_onb_get'] },
  { key: 'cases', path: '/api/cases', proposals: ['20261012260000', '20261018090000', '20261018105000', '20261019230000'], sentinelRpcs: ['taxguard_case_detail', 'taxguard_case_restaff'] },
  { key: 'vault', path: '/api/vault', proposals: ['20261012270000', '20261015030851', '20261018060000', '20261018080000'], sentinelRpcs: ['taxguard_doc_list'] },
  { key: 'billing', path: '/api/billing', proposals: ['20261012280000', '20261015070000'], sentinelRpcs: ['taxguard_bill_list'] },
  { key: 'book-to-tax', path: '/api/book-to-tax', proposals: ['20261012290000', '20261018070000'], sentinelRpcs: ['taxguard_b2t_overview'] },
  { key: 'tax-engine', path: '/api/tax-engine', proposals: ['20261012330000', '20261018090000', '20261018150000', '20261018160000', '20261018170000', '20261018190000', '20261019100000', '20261019110000', '20261019115000', '20261019120000', '20261019130000', '20261019140000', '20261019150000', '20261019160000', '20261019170000', '20261019180000', '20261019190000', '20261019200000', '20261019210000', '20261019220000'],
    sentinelRpcs: ['taxguard_tax_run_list', 'taxguard_tax_research_list', 'taxguard_case_diagnostics_list', 'taxguard_case_risk_list', 'taxguard_tax_run_lineage', 'taxguard_tax_conclusion_list', 'taxguard_tax_form_mapping_list', 'taxguard_tax_return_list', 'taxguard_tax_return_verification_list', 'taxguard_tax_return_risk_list', 'taxguard_tax_return_final_readiness', 'taxguard_tax_return_final_list', 'taxguard_tax_return_signature_list', 'taxguard_tax_return_comparison', 'taxguard_tax_return_review_queue'] },
  { key: 'communications', path: '/api/communications', proposals: ['20261013390000'], sentinelRpcs: ['taxguard_comm_threads'] },
  { key: 'scheduling', path: '/api/scheduling', proposals: ['20261014400000'], sentinelRpcs: ['taxguard_apt_list_client'] },
  { key: 'legal-matters', path: '/api/legal-matters', proposals: ['20261014420000'], sentinelRpcs: ['taxguard_legal_list'] },
  { key: 'audit-center', path: '/api/audit-center', proposals: ['20261014410000', '20261014460000'], sentinelRpcs: ['taxguard_audit_center_list'] },
  { key: 'consultations', path: '/api/consultations', proposals: ['20261014430000'], sentinelRpcs: ['taxguard_consult_list'] },
  { key: 'client-portal', path: '/api/client-portal', proposals: ['20261014440000', '20261019230000'], sentinelRpcs: ['taxguard_portal_engagements'] },
  { key: 'client-signatures', path: '/api/client-signatures', proposals: ['20261012270000', '20261019180000', '20261019190000', '20261019231000'], sentinelRpcs: ['taxguard_portal_signature_packages'] },
  { key: 'reassignment', path: '/api/reassignment', proposals: ['20261014450000'], sentinelRpcs: ['taxguard_rar_queue'] },
  { key: 'jobs', path: '/api/jobs', proposals: ['20261012250000', '20261018100000', '20261019240000'], sentinelRpcs: ['taxguard_job_list'] },
]);

export type CutoverRefusal = 'NOT_REQUESTED' | 'UNKNOWN_ROUTE' | 'PROPOSAL_NOT_APPROVED';
export interface CutoverPlan {
  eligible: CutoverRoute[];
  refused: Array<{ key: string; reason: CutoverRefusal; missingProposals?: string[] }>;
}

/** Pure decision: which catalogued routes may be offered for schema verification. */
export function planCutover(requested: string | undefined, approved: readonly string[] = OWNER_APPROVED_PROPOSALS,
  catalog: readonly CutoverRoute[] = ROUTE_CUTOVER_CATALOG): CutoverPlan {
  const asked = new Set((requested ?? '').split(',').map(s => s.trim()).filter(Boolean));
  const known = new Set(catalog.map(r => r.key));
  const plan: CutoverPlan = { eligible: [], refused: [] };
  for (const key of asked) if (!known.has(key)) plan.refused.push({ key, reason: 'UNKNOWN_ROUTE' });
  for (const route of catalog) {
    if (!asked.has(route.key)) { plan.refused.push({ key: route.key, reason: 'NOT_REQUESTED' }); continue; }
    const missing = route.proposals.filter(p => !approved.includes(p));
    if (missing.length) plan.refused.push({ key: route.key, reason: 'PROPOSAL_NOT_APPROVED', missingProposals: missing });
    else plan.eligible.push(route);
  }
  return plan;
}

export type SchemaProbe = (rpc: string) => Promise<boolean>;
export interface CutoverStatus { key: string; path: string; state: 'NOT_CUT_OVER' | 'VERIFYING' | 'VERIFIED' | 'SCHEMA_UNVERIFIED'; reason?: string }

/**
 * Mounts eligible routes behind a verification gate. Routes that are not eligible are not mounted at all.
 * The schema probe runs once per route; any failure, error or missing RPC keeps the route at 503.
 */
export function mountCutoverRoutes(app: Express, plan: CutoverPlan, factories: Readonly<Record<string, () => RequestHandler>>, probe: SchemaProbe | null) {
  const status = new Map<string, CutoverStatus>();
  for (const r of plan.refused) {
    const route = ROUTE_CUTOVER_CATALOG.find(c => c.key === r.key);
    if (route) status.set(r.key, { key: r.key, path: route.path, state: 'NOT_CUT_OVER', reason: r.reason });
  }
  for (const route of plan.eligible) {
    const factory = factories[route.key];
    if (!factory) { status.set(route.key, { key: route.key, path: route.path, state: 'SCHEMA_UNVERIFIED', reason: 'ROUTER_UNAVAILABLE' }); continue; }
    status.set(route.key, { key: route.key, path: route.path, state: 'VERIFYING' });
    const verified: Promise<boolean> = probe
      ? Promise.all(route.sentinelRpcs.map(rpc => probe(rpc).catch(() => false))).then(found => found.every(Boolean))
      : Promise.resolve(false);
    void verified.then(ok => status.set(route.key, { key: route.key, path: route.path, state: ok ? 'VERIFIED' : 'SCHEMA_UNVERIFIED',
      ...(ok ? {} : { reason: probe ? 'SENTINEL_RPC_MISSING' : 'NO_SCHEMA_PROBE' }) }));
    const router = factory();
    app.use(route.path, (req, res, next) => {
      verified.then(ok => ok ? router(req, res, next) : res.status(503).json({ code: 'ROUTE_CUTOVER_SCHEMA_UNVERIFIED' }), () => res.status(503).json({ code: 'ROUTE_CUTOVER_SCHEMA_UNVERIFIED' }));
    });
  }
  return { status: () => [...status.values()].sort((a, b) => a.key.localeCompare(b.key)) };
}
