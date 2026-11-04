export const isSupabaseConfigured = (): boolean => {
  const env = (import.meta as any)?.env || {};
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
};

export const isStaffIdentityDevelopmentConfigured = (): boolean => {
  return true;
};

// Lightweight mock supabase client for client-side when not connecting to external service
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), data: [] }) }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  }),
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: '#' }, error: null }),
      upload: async () => ({ data: { path: '' }, error: null }),
    }),
  },
};
