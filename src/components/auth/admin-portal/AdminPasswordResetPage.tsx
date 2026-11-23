/**
 * Administrator password recovery callback.
 * Password recovery never assigns roles, provisions memberships, or bypasses MFA.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabase/config';

const RESET_PATH = '/admin/reset-password';
const LOGIN_PATH = '/admin/login';

export function isAdminRecoveryCallback(location: Pick<Location, 'pathname' | 'hash'>): boolean {
  if (location.pathname === RESET_PATH) return true;
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('type') === 'recovery' && Boolean(params.get('access_token'));
}

export default function AdminPasswordResetPage() {
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'saving' | 'complete'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setState('invalid');
      return;
    }
    // Supabase SDK consumes recovery fragments during initialization. Never log or store the tokens.
    const callback = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackAccessToken = callback.get('type') === 'recovery' ? callback.get('access_token') : null;
    const hasRecoveryFragment = Boolean(callbackAccessToken);
    const hasRecoveryCode = new URLSearchParams(window.location.search).get('type') === 'recovery';
    let recoveryEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEvent = true;
        setState('ready');
        window.history.replaceState(null, '', RESET_PATH);
      }
    });
    void (async () => {
      // Let the SDK process the callback. A generic signed-in session is not recovery authorization.
      const { data, error } = await supabase.auth.getSession();
      if (!mounted || recoveryEvent) return;
      if (!error && data.session && ((hasRecoveryFragment && data.session.access_token === callbackAccessToken) || (hasRecoveryCode && recoveryEvent))) {
        setState('ready');
        window.history.replaceState(null, '', RESET_PATH);
      } else {
        setState('invalid');
      }
    })();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || state !== 'ready') return;
    if (password.length < 16 || password !== confirm) {
      setMessage('Use a unique password of at least 16 characters and confirm it exactly.');
      return;
    }
    setState('saving');
    const { error } = await supabase.auth.updateUser({ password });
    setPassword('');
    setConfirm('');
    if (error) {
      setMessage('Unable to update the password. Request a fresh recovery link and try again.');
      setState('invalid');
      return;
    }
    await supabase.auth.signOut();
    window.history.replaceState(null, '', RESET_PATH);
    setState('complete');
    setMessage('Password updated. Sign in again; administrator authorization and MFA are still required.');
  }

  return (
    <main className="min-h-screen bg-[#07182b] text-white flex items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0b223b] p-8 shadow-2xl" aria-live="polite">
        <p className="text-amber-400 text-xs uppercase tracking-widest">Destria secure administration</p>
        <h1 className="text-2xl font-bold mt-3 mb-5">Set administrator password</h1>
        {state === 'checking' && <p>Verifying your recovery link…</p>}
        {state === 'invalid' && <p role="alert">This recovery link is invalid, expired, or already used. Request a new password recovery email from the authorized account recovery process.</p>}
        {state === 'complete' && <p role="status">{message}</p>}
        {(state === 'ready' || state === 'saving') && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm">New password
              <input className="mt-1 w-full rounded border border-slate-500 bg-slate-950 p-3 text-white" type="password" autoComplete="new-password" minLength={16} required value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <label className="block text-sm">Confirm new password
              <input className="mt-1 w-full rounded border border-slate-500 bg-slate-950 p-3 text-white" type="password" autoComplete="new-password" minLength={16} required value={confirm} onChange={e => setConfirm(e.target.value)} />
            </label>
            {message && <p role="alert" className="text-amber-200">{message}</p>}
            <button disabled={state === 'saving'} className="w-full rounded bg-amber-400 p-3 font-semibold text-slate-950 disabled:opacity-60" type="submit">Save new password</button>
          </form>
        )}
        <a href={LOGIN_PATH} className="mt-6 inline-block text-sm underline text-amber-200">Return to administrator login</a>
      </section>
    </main>
  );
}
