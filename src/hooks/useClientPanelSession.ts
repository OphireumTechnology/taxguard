import { useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import { getStoredToken, reconcileSessionStorageEvent, SESSION_TOKEN_CHANGED_EVENT } from '../services/api';

function subscribe(changed: () => void) {
  const storage = (event: StorageEvent) => { reconcileSessionStorageEvent(event); changed(); };
  window.addEventListener('storage', storage);
  window.addEventListener(SESSION_TOKEN_CHANGED_EVENT, changed);
  window.addEventListener('taxguard:session-expired', changed);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(SESSION_TOKEN_CHANGED_EVENT, changed);
    window.removeEventListener('taxguard:session-expired', changed);
  };
}

/** A React key, held only in memory, to discard client panel state across authority changes. */
export function useClientPanelSession(clientId: string) {
  const { currentUser, authLifecycleState } = useApp();
  const token = useSyncExternalStore(subscribe, getStoredToken, () => null);
  return JSON.stringify([clientId, token, authLifecycleState, currentUser?.id, currentUser?.tenantId,
    currentUser?.clientId, currentUser?.role, currentUser?.status, currentUser?.updatedAt]);
}
