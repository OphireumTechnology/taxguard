export async function portalRead<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal
    });
    if (!res.ok) {
      // Fallback empty items if api not populated yet
      return { items: [] } as unknown as T;
    }
    return await res.json();
  } catch (e) {
    return { items: [] } as unknown as T;
  }
}

export const clientPortalReads = {
  getOverview: async (clientId?: string) => ({ status: 'ACTIVE', unreadMessages: 0 }),
  getStatusSummary: async (clientId?: string) => ({ stage: 1, stageLabel: 'Onboarding & Intake' })
};
