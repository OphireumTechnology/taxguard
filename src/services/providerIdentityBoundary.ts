import { useCallback, useRef, useState } from 'react';

export interface ProviderIdentitySnapshot {
  email: string | null;
  uid: string | null;
}

export function useProviderIdentityBoundary() {
  const [key, setKey] = useState<string>(() => `pid_${Date.now().toString(36)}`);
  const keyRef = useRef(key);
  keyRef.current = key;

  const capture = useCallback(() => keyRef.current, []);
  const isCurrent = useCallback((proof: string) => keyRef.current === proof, []);
  const reset = useCallback(() => {
    const next = `pid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    keyRef.current = next;
    setKey(next);
    return next;
  }, []);
  const current = useCallback((): ProviderIdentitySnapshot => {
    return { email: null, uid: null };
  }, []);

  return { key, capture, isCurrent, reset, current };
}
