import { useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';

export function useAuthoritativeClientProfile(user: User | null, auth: string, refresh: number) {
  const allowed = auth === 'AUTHENTICATED' && user?.status === 'active' && ['client', 'prospective_client'].includes(user.role) && Boolean(getStoredToken());
  const clientId = user?.clientId || user?.id;
  const key = JSON.stringify([user?.id, clientId, user?.tenantId, user?.role, user?.status, auth, getStoredToken(), refresh]);
  const [state, setState] = useState<{ key: string; data: any; status: 'loading' | 'ready' | 'error' }>({ key: '', data: null, status: 'loading' });
  useEffect(() => {
    if (!allowed) { setState({ key: '', data: null, status: 'loading' }); return; }
    const controller = new AbortController();
    setState({ key, data: null, status: 'loading' });
    api.profile.getAuthoritative(undefined, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (data.clientId !== clientId) throw new Error('Profile scope mismatch');
      setState({ key, data, status: 'ready' });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, data: null, status: 'error' }); });
    return () => controller.abort();
  }, [key, allowed]);
  return { allowed, key, data: allowed && state.key === key ? state.data : null,
    status: allowed && state.key === key ? state.status : 'loading' as const };
}
