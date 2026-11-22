import type { User } from '../types';

const fallbackSessions = new Map<string, User>();

export function hasFallbackSupabaseSession(token: string): boolean {
  return fallbackSessions.has(token);
}

export function registerFallbackSupabaseSession(token: string, user: User): void {
  fallbackSessions.set(token, user);
}

export class SupabaseDurableSessions {
  async verify(token: string): Promise<User | null> {
    if (fallbackSessions.has(token)) {
      return fallbackSessions.get(token) || null;
    }
    return null;
  }

  async create(_user: User, _options?: Record<string, any>): Promise<string> {
    return `tg_live_${Date.now().toString(36)}`;
  }

  async revoke(token: string): Promise<void> {
    fallbackSessions.delete(token);
  }
}
