import { useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';
import type { ProviderReadinessInfo } from '../server/taxguard/persistence.types';

export type ReportedProvider = Pick<ProviderReadinessInfo, 'provider' | 'status' | 'description' | 'lastChecked'>;
const providerTypes = new Set(['DATABASE', 'AUTHENTICATION', 'DOCUMENT_STORAGE', 'STORAGE', 'MALWARE_SCANNER', 'OCR', 'AI', 'E_SIGNATURE', 'FILING', 'QUICKBOOKS', 'XERO']);
const statuses = new Set(['CONFIGURED', 'DEGRADED', 'NOT_CONFIGURED', 'DISABLED', 'ERROR']);

export function useAdminProviderReadiness(user: User | null, auth: string, refresh: number) {
  const allowed = auth === 'AUTHENTICATED' && user?.status === 'active' && ['admin', 'super_admin'].includes(user.role) && Boolean(user.tenantId && getStoredToken());
  const key = JSON.stringify([user?.id, user?.tenantId, user?.role, user?.status, auth, getStoredToken(), refresh]);
  const [state, setState] = useState<{key: string; status: 'loading' | 'ready' | 'error'; providers: ReportedProvider[]}>({key: '', status: 'loading', providers: []});
  useEffect(() => {
    if (!allowed) { setState({key: '', status: 'loading', providers: []}); return; }
    const controller = new AbortController(); setState({key, status: 'loading', providers: []});
    api.caseAuthority.getProviderReadiness(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const seen = new Set<string>();
      if (!Array.isArray(result.providers) || result.providers.length > providerTypes.size) throw new Error('Invalid readiness response');
      const providers = result.providers.map((row: any): ReportedProvider => {
        if (!row || !providerTypes.has(row.provider) || !statuses.has(row.status) || seen.has(row.provider) || typeof row.description !== 'string' || typeof row.lastChecked !== 'string' || !Number.isFinite(Date.parse(row.lastChecked))) throw new Error('Invalid readiness record');
        seen.add(row.provider);
        return {provider: row.provider, status: row.status, description: row.description, lastChecked: row.lastChecked};
      });
      setState({key, status: 'ready', providers});
    }).catch(() => { if (!controller.signal.aborted) setState({key, status: 'error', providers: []}); });
    return () => controller.abort();
  }, [key, allowed]);
  return { allowed, status: allowed && state.key === key ? state.status : 'loading' as const,
    providers: allowed && state.key === key ? state.providers : [] };
}
