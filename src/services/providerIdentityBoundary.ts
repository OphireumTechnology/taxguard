import { useMemo, useRef, useState } from 'react';

export interface ProviderIdentitySnapshot {
  key: string;
  email: string | null;
  capture: () => string;
  isCurrent: (capturedKey: string) => boolean;
  current: () => { email: string | null };
}

export function useProviderIdentityBoundary(): ProviderIdentitySnapshot {
  const [key, setKey] = useState(() => 'id_' + Math.random().toString(36).substring(2, 9));
  const emailRef = useRef<string | null>(null);

  return useMemo(() => ({
    key,
    email: emailRef.current,
    capture(): string {
      const nextKey = 'id_' + Math.random().toString(36).substring(2, 9);
      setKey(nextKey);
      return nextKey;
    },
    isCurrent(capturedKey: string): boolean {
      return capturedKey === key;
    },
    current(): { email: string | null } {
      return { email: emailRef.current };
    }
  }), [key]);
}
