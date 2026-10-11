import React, { createContext, useContext, useState } from 'react';
import type { User } from '../../src/types';
const Context = createContext<any>(null);
export const useApp = () => useContext(Context);
export function SyntheticProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState('accountant');
  const [active, setActive] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const value = { currentUser: { id: 'synthetic_user', name: 'Synthetic QA User', email: 'synthetic@example.invalid', tenantId: 'synthetic_tenant', clientId: 'synthetic_client', role, status: active ? 'active' : 'suspended' } as User,
    authLifecycleState: authenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
    notifications: [], markNotificationRead: () => {}, clearAllNotifications: () => {}, setCurrentPage: () => {},
    logout: async () => setAuthenticated(false), role, setRole, active, setActive, authenticated, setAuthenticated };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
