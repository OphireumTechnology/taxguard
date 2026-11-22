import type { Express, RequestHandler } from 'express';

export interface CutoverPlanItem {
  key: string;
  requested: boolean;
  approved: boolean;
  mounted: boolean;
  reason?: string;
}

export function planCutover(rawEnv?: string): CutoverPlanItem[] {
  const requestedKeys = (rawEnv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return requestedKeys.map((key) => ({
    key,
    requested: true,
    approved: false,
    mounted: false,
    reason: 'OWNER_APPROVAL_REQUIRED',
  }));
}

export function mountCutoverRoutes(
  _app: Express,
  plan: CutoverPlanItem[],
  _factories: Readonly<Record<string, () => RequestHandler>>,
  _schemaProbe: unknown
) {
  return {
    status: () => plan,
  };
}
