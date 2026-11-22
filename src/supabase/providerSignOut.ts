/**
 * Provider session revocation helper.
 * Ends this device's provider session in every case and resolves true only
 * when the authentication provider confirms server-side session revocation.
 */
export interface SignOutProviderClient {
  auth: {
    signOut: (options?: {
      scope?: 'global' | 'local' | 'others';
    }) => Promise<{ error: unknown | null }>;
  };
}

export async function signOutProviderSession(
  client: SignOutProviderClient | null | undefined
): Promise<boolean> {
  if (!client?.auth?.signOut) {
    return false;
  }

  let serverRevoked = false;
  try {
    const result = await client.auth.signOut();
    serverRevoked = !result?.error;
  } catch {
    serverRevoked = false;
  }

  if (!serverRevoked) {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // Best-effort local session removal when remote revocation failed.
    }
  }

  return serverRevoked;
}
