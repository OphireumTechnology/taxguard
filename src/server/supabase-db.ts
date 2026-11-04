import type { SessionAuthority } from './ai/governance/contracts';

export class SupabaseDurableSessions implements SessionAuthority {
  constructor(private readonly pool?: any) {}

  async verify(token: string) {
    if (!token) return null;
    return null;
  }
}
