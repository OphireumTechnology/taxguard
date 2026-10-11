import { useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';
import { safeCases, type AccountantCase } from '../components/workspace/accountantDashboardModel';

export function accountantAccess(user: { role: string; status: string; tenantId?: string } | null, auth: string) {
  return auth === 'AUTHENTICATED' && user?.status === 'active' && user.role === 'accountant' && Boolean(user.tenantId);
}

export function useAccountantDashboardData(user: User | null, auth: string, refresh: number) {
  const allowed = accountantAccess(user, auth);
  const session = [user?.id, user?.tenantId, user?.role, user?.status, auth, getStoredToken(), JSON.stringify(user?.authorizedClientIds)].join(':');
  const key = JSON.stringify([session, refresh]);
  const [state, setState] = useState<{ key: string; rows: AccountantCase[]; loading: boolean; error: string }>({ key: '', rows: [], loading: true, error: '' });

  useEffect(() => {
    if (!allowed) { setState({ key: '', rows: [], loading: true, error: '' }); return; }
    const abort = new AbortController();
    setState({ key, rows: [], loading: true, error: '' });
    api.accountant.getDashboard(abort.signal).then(async data => {
      if (abort.signal.aborted) return;
      const scoped = safeCases(data.cases, user!.tenantId!);
      const enriched = await Promise.all(scoped.map(async row => {
        if (abort.signal.aborted) return row;
        try {
          const current = await api.caseAuthority.getCase(row.tenantId, row.authorityClientId, row.engagementId, row.taxYear);
          return current.tenantId === row.tenantId && current.clientId === row.authorityClientId && current.engagementId === row.engagementId && current.taxYear === row.taxYear && Number.isInteger(current.activeStage) && current.activeStage >= 1 && current.activeStage <= 18
            ? { ...row, activeStage: current.activeStage } : row;
        } catch { return row; }
      }));
      if (!abort.signal.aborted) setState({ key, rows: enriched, loading: false, error: '' });
    }).catch(() => {
      if (!abort.signal.aborted) setState({ key, rows: [], loading: false, error: 'Authorized cases could not be loaded. Retry to restore your work queue.' });
    });
    return () => abort.abort();
  }, [key, allowed]);

  const visible = allowed && state.key === key ? state : { key, rows: [], loading: true, error: '' };
  return { allowed, session, rows: visible.rows, loading: visible.loading, error: visible.error };
}
