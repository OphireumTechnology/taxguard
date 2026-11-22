import { useSyncExternalStore } from 'react';
import { supabase } from '../supabase/config';
export type ProviderIdentityEvent = string;
export interface ProviderIdentitySession { access_token: string; user: {id: string; email?: string} }
export type ProviderIdentitySubscribe = (listener: (event: ProviderIdentityEvent, session: ProviderIdentitySession | null) => void) => () => void;
/** UI privacy boundary only. Server token verification remains authoritative. */
export function createProviderIdentityBoundary(subscribeProvider: ProviderIdentitySubscribe) {
  let generation = 0, uid: string | null = null, token: string | null = null;
  let initialized = false, email: string | null = null;
  let snapshot = {key: '0', uid, email, initialized};
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  const receive = (event: string, session: ProviderIdentitySession | null) => {
    const nextUid = session?.user?.id ?? null, nextToken = session?.access_token ?? null, nextEmail = session?.user?.email?.trim().toLowerCase() ?? null;
    const sameUserRefresh = ['TOKEN_REFRESHED', 'MFA_CHALLENGE_VERIFIED', 'USER_UPDATED'].includes(event);
    const changed = !initialized || nextUid !== uid || nextEmail !== email || (event === 'SIGNED_IN' && nextToken !== token && !sameUserRefresh);
    initialized = true; uid = nextUid; token = nextToken; email = nextEmail;
    if (changed) {generation++; snapshot = {key: String(generation), uid, email, initialized}; listeners.forEach(listener => listener());}
  };
  return {
    subscribe(listener: () => void) {listeners.add(listener); if (!stop) stop = subscribeProvider(receive); return () => {listeners.delete(listener); if (!listeners.size) {stop?.();stop=undefined;}};},
    getSnapshot: () => snapshot,
    capture: () => snapshot.key,
    isCurrent: (proof: string) => snapshot.key === proof,
  };
}
const boundary = createProviderIdentityBoundary(listener => {
  const {data} = supabase.auth.onAuthStateChange((event, session) => listener(event, session));
  return () => data.subscription.unsubscribe();
});
export function useProviderIdentityBoundary(source = boundary) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return {...snapshot, current: source.getSnapshot, capture: source.capture, isCurrent: source.isCurrent};
}
