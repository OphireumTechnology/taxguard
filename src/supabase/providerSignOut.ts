/**
 * Provider sign-out that always ends this device's provider session.
 *
 * `auth.signOut()` (scope `global`) revokes every session of the user on the server, but when that request fails
 * for a reason other than an already-ended session (offline, a 5xx, a blocked request), supabase-js keeps the
 * session in storage and returns the error (auth-js 2.119.0 `_signOut`: "With `global` the session is then kept").
 * A kept provider session restores on the next page load and the session bridge signs the person back in, so
 * a sign-out that looked complete is undone. When the global sign-out is not confirmed, the local sign-out removes
 * this device's session before it sends its own request, so it does not depend on the network.
 *
 * Returns whether the server confirmed the global revocation. The local session is removed either way.
 */
export interface ProviderAuthSignOut {
  auth: { signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: unknown | null }> };
}

export async function signOutProviderSession(provider: ProviderAuthSignOut): Promise<boolean> {
  let revoked = false;
  try {
    const result = await provider.auth.signOut();
    revoked = !result?.error;
  } catch {
    revoked = false;
  }
  if (!revoked) {
    try { await provider.auth.signOut({ scope: 'local' }); } catch { /* the local session is removed before the request */ }
  }
  return revoked;
}
