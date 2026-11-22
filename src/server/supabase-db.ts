import type { User } from '../types';

export function hasFallbackSupabaseSession(_token: string): boolean {
  return false;
}

export class SupabaseDurableSessions {
  async verify(_token: string): Promise<User | null> {
    return null;
  }
}
