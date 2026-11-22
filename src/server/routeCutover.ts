import type { Express, RequestHandler } from 'express';

export interface PlannedCutoverRoute {
  key: string;
  mountPath: string;
  requested: boolean;
  approved: boolean;
  mounted: boolean;
  reason: string;
}

const ROUTE_PATHS: Record<string, string> = {
  practice: '/api/practice',
  'stage-one': '/api/stage-one',
  cases: '/api/cases',
  vault: '/api/vault',
  billing: '/api/billing',
  'book-to-tax': '/api/book-to-tax',
  'tax-engine': '/api/tax-engine',
  communications: '/api/communications',
  scheduling: '/api/scheduling',
  'legal-matters': '/api/legal-matters',
  'audit-center': '/api/audit-center',
  consultations: '/api/consultations',
  'client-portal': '/api/client-portal',
  'client-signatures': '/api/client-signatures',
  reassignment: '/api/reassignment',
  jobs: '/api/jobs',
  'public-consultations': '/api/public/consultation-requests',
};

export function planCutover(rawSetting?: string): PlannedCutoverRoute[] {
  const requested = new Set(
    (rawSetting || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return Object.entries(ROUTE_PATHS).map(([key, mountPath]) => ({
    key,
    mountPath,
    requested: requested.has(key),
    approved: false,
    mounted: false,
    reason: requested.has(key) ? 'PROPOSAL_NOT_OWNER_APPROVED' : 'NOT_REQUESTED',
  }));
}

export function mountCutoverRoutes(
  _app: Express,
  plan: PlannedCutoverRoute[],
  _factories: Readonly<Record<string, () => RequestHandler>>,
  _schemaProbe: (() => Promise<boolean>) | null
): { status: () => PlannedCutoverRoute[] } {
  // Fail-closed: no proposal is owner-approved or schema-verified in this build, so no cutover route is mounted.
  const snapshot = plan.map((item) => ({ ...item, mounted: false }));
  return {
    status: () => snapshot.map((item) => ({ ...item })),
  };
}
