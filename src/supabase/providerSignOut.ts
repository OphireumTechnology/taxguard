export interface SignOutCapableClient {
  auth: {
    signOut: () => Promise<{ error?: unknown } | void>;
  };
}

/**
 * Safely signs out any active Supabase Auth provider session in the browser.
 * Returns true if sign-out completed without error, false otherwise.
 */
export async function signOutProviderSession(
  client: SignOutCapableClient | null | undefined
): Promise<boolean> {
  if (!client) return true;
  try {
    const result = await client.auth.signOut();
    return !(result && typeof result === 'object' && 'error' in result && result.error);
  } catch {
    return false;
  }
}
