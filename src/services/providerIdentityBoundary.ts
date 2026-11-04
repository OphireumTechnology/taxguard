export function useProviderIdentityBoundary() {
  return {
    key: 'provider-session-active',
    capture: () => 'provider-session-active',
    isCurrent: (k?: string) => true,
    current: () => ({ email: '' })
  };
}

export const providerIdentityBoundary = {
  checkProviderSession: async () => ({ authenticated: false })
};
