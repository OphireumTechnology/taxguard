import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabase/config';

export interface ProviderIdentitySnapshot {
  key: string;
  email: string | null;
  uid: string | null;
}

export function useProviderIdentityBoundary() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured());
  const snapshotRef = useRef<ProviderIdentitySnapshot>({ key: 'anon', email: null, uid: null });

  const computeSnapshot = (nextSession: any): ProviderIdentitySnapshot => {
    const uid = nextSession?.user?.id ?? null;
    const email = nextSession?.user?.email ? String(nextSession.user.email).trim().toLowerCase() : null;
    return { key: uid ? `${uid}:${email || ''}` : 'anon', email, uid };
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          const s = data?.session ?? null;
          snapshotRef.current = computeSnapshot(s);
          setSession(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        snapshotRef.current = computeSnapshot(nextSession);
        setSession(nextSession);
      }
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const current = useCallback(() => snapshotRef.current, []);
  const capture = useCallback(() => snapshotRef.current.key, []);
  const isCurrent = useCallback((proof: string) => snapshotRef.current.key === proof, []);

  return {
    key: snapshotRef.current.key,
    capture,
    isCurrent,
    current,
    configured: isSupabaseConfigured(),
    loading,
    session,
    accessToken: session?.access_token ?? null,
    user: session?.user ?? null,
  };
}
