/**
 * A/R Tax Services, LLC - Demonstration Authentication Service
 * Strictly manages role-based temporary demonstration credentials and sessions.
 * Enforces rate-limiting simulation, lockout windows, and role-session isolation.
 */

import { DemoRole, DEMO_ROLES } from '../types';

interface FailedAttemptRecord {
  count: number;
  lockedUntil: number; // timestamp
}

interface DemoSession {
  role: DemoRole;
  user: {
    id: string;
    name: string;
    title: string;
    email: string;
  };
  token: string;
  loginTime: string;
  expiresAt: number;
}

const SESSION_PREFIX = 'artax_demo_session_';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

// In-memory rate limiting tracker (per role)
const failedAttemptsMap: Record<string, FailedAttemptRecord> = {};

// In-memory fallback if sessionStorage is blocked
const memorySessions: Record<string, DemoSession> = {};

export class DemoAuthService {
  /**
   * Check if role is currently locked out
   */
  public static isLockedOut(role: DemoRole): boolean {
    const record = failedAttemptsMap[role];
    if (!record) return false;
    if (Date.now() < record.lockedUntil) {
      return true;
    }
    // Lockout expired
    if (record.lockedUntil > 0 && Date.now() >= record.lockedUntil) {
      delete failedAttemptsMap[role];
    }
    return false;
  }

  /**
   * Get remaining lockout seconds
   */
  public static getRemainingLockoutSeconds(role: DemoRole): number {
    const record = failedAttemptsMap[role];
    if (!record || Date.now() >= record.lockedUntil) return 0;
    return Math.ceil((record.lockedUntil - Date.now()) / 1000);
  }

  /**
   * Authenticate role with credentials
   * Uses fixed demo credentials: 'artest2026' / 'artest2026'
   * Credentials are never displayed in DOM, errors, or helpers.
   */
  public static async authenticate(
    role: DemoRole, 
    loginIdInput: string, 
    passwordInput: string
  ): Promise<{ success: boolean; error?: string; session?: DemoSession }> {
    // Artificial small delay to simulate network security handshake
    await new Promise(res => setTimeout(res, 200));

    if (this.isLockedOut(role)) {
      const remaining = this.getRemainingLockoutSeconds(role);
      return {
        success: false,
        error: `Account locked due to consecutive failed attempts. Please retry in ${remaining} seconds or contact developer support.`
      };
    }

    const trimmedId = (loginIdInput || '').trim();
    const cleanPassword = passwordInput || '';

    // Verify demo credentials
    const isIdValid = trimmedId === 'artest2026';
    const isPasswordValid = cleanPassword === 'artest2026';

    if (!isIdValid || !isPasswordValid) {
      const current = failedAttemptsMap[role] || { count: 0, lockedUntil: 0 };
      current.count += 1;
      
      if (current.count >= MAX_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        failedAttemptsMap[role] = current;
        return {
          success: false,
          error: `Invalid Login ID or password. Maximum attempts exceeded. Account is locked for 60 seconds.`
        };
      }

      failedAttemptsMap[role] = current;
      const remainingAttempts = MAX_ATTEMPTS - current.count;
      return {
        success: false,
        error: `Invalid Login ID or password. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout).`
      };
    }

    // Success: reset failed attempts
    delete failedAttemptsMap[role];

    const roleConfig = DEMO_ROLES[role];
    const session: DemoSession = {
      role,
      user: roleConfig.sampleUser,
      token: `demo_tok_${role}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginTime: new Date().toISOString(),
      expiresAt: Date.now() + 4 * 60 * 60 * 1000 // 4 hours
    };

    this.saveSession(role, session);

    return {
      success: true,
      session
    };
  }

  /**
   * Save session to storage
   */
  private static saveSession(role: DemoRole, session: DemoSession): void {
    const key = `${SESSION_PREFIX}${role}`;
    memorySessions[role] = session;
    try {
      sessionStorage.setItem(key, JSON.stringify(session));
    } catch {
      // Storage unavailable in sandbox; memory fallback active
    }
  }

  /**
   * Get active session for role
   */
  public static getSession(role: DemoRole): DemoSession | null {
    const key = `${SESSION_PREFIX}${role}`;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as DemoSession;
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          this.logout(role);
          return null;
        }
        return parsed;
      }
    } catch {
      // fallback to memory
    }

    const mem = memorySessions[role];
    if (mem && mem.expiresAt && Date.now() > mem.expiresAt) {
      delete memorySessions[role];
      return null;
    }
    return mem || null;
  }

  /**
   * Validate if user is authenticated in this role
   */
  public static isAuthenticated(role: DemoRole): boolean {
    return this.getSession(role) !== null;
  }

  /**
   * Check if any demonstration session is active across any role
   */
  public static hasAnyActiveSession(): boolean {
    const roles = Object.keys(DEMO_ROLES) as DemoRole[];
    return roles.some(r => this.isAuthenticated(r));
  }

  /**
   * Get all roles that currently have an active session
   */
  public static getActiveRoles(): DemoRole[] {
    const roles = Object.keys(DEMO_ROLES) as DemoRole[];
    return roles.filter(r => this.isAuthenticated(r));
  }

  /**
   * Sign out role
   */
  public static logout(role: DemoRole): void {
    const key = `${SESSION_PREFIX}${role}`;
    delete memorySessions[role];
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Clear all demonstration sessions across all roles
   */
  public static clearAllSessions(): void {
    Object.keys(DEMO_ROLES).forEach(r => {
      this.logout(r as DemoRole);
    });
  }
}
