import { createFailClosedRouter } from './_failClosedRouter';

export interface AccountantDashboardDeps {
  tenantId?: string;
}

export function createAccountantDashboardRouter(_deps?: AccountantDashboardDeps) {
  return createFailClosedRouter('ACCOUNTANT_DASHBOARD');
}
