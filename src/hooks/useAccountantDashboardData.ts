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
  const [state, setState] = useState<{ key: string; rows: AccountantCase[]; loading: boolean; error: string; unavailableFields?: string[] }>({ key: '', rows: [], loading: true, error: '' });

  useEffect(() => {
    if (!allowed) { setState({ key: '', rows: [], loading: true, error: '' }); return; }
    const abort = new AbortController();
    setState({ key, rows: [], loading: true, error: '' });
    api.accountant.getDashboard(abort.signal).then(data => {
      if (abort.signal.aborted) return;
      const scoped = safeCases(data.cases, user!.tenantId!);
      // Block 103: the durable rows carry the recorded stage; nothing is read from the in-memory case authority.
      // The durable production read model reports which fields it does not record.
      if (!abort.signal.aborted) setState({ key, rows: scoped, loading: false, error: '', unavailableFields: Array.isArray(data.unavailableFields) ? data.unavailableFields : [] });
    }).catch(() => {
      if (!abort.signal.aborted) setState({ key, rows: [], loading: false, error: 'Authorized cases could not be loaded. Retry to restore your work queue.' });
    });
    return () => abort.abort();
  }, [key, allowed]);

  const visible = allowed && state.key === key ? state : { key, rows: [], loading: true, error: '' };
  return { allowed, session, rows: visible.rows, loading: visible.loading, error: visible.error, unavailableFields: visible.unavailableFields ?? [] };
}
