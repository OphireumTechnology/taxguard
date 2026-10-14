import { useCallback, useEffect, useState } from 'react';

/**
 * Deep link to a view inside a workspace through the URL hash (`#<key>=<view>`), without a routing
 * library. Only values in `allowed` are honoured; anything else falls back, so a link cannot open a
 * view the current role does not have (the server still authorizes every request the view makes).
 * Selecting a view adds a history entry, so browser Back / Forward move between views; a refresh
 * reopens the same view.
 */
export function readHashView(hash: string, key: string, allowed: readonly string[]): string | null {
  const m = new RegExp('^#' + key + '=([A-Za-z0-9_-]{1,48})$').exec(hash);
  if (!m) return null;
  const wanted = decodeURIComponent(m[1]).toLowerCase();
  return allowed.find(v => slug(v) === wanted) ?? null;
}
export const slug = (view: string) => view.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function useHashView<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (view: T) => void] {
  const read = useCallback((): T => (typeof window === 'undefined' ? null : readHashView(window.location.hash, key, allowed) as T | null) ?? fallback,
    // `allowed` is a role-dependent constant list; its contents define validity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, fallback, allowed.join('|')]);
  const [view, setView] = useState<T>(read);
  useEffect(() => {
    // The allowed list may change (role change after re-authentication): re-validate.
    setView(read());
    const sync = () => setView(read());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, [read]);
  const select = useCallback((next: T) => {
    setView(next);
    if (typeof window === 'undefined') return;
    const hash = '#' + key + '=' + slug(next);
    if (window.location.hash !== hash) window.history.pushState(window.history.state, '', window.location.pathname + window.location.search + hash);
  }, [key]);
  return [view, select];
}
