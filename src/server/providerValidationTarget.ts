/**
 * Destination guard for the provider MFA admin validation (scripts/provider-validation).
 *
 * The validation creates and deletes a synthetic user and factor, so it may only ever run against a
 * separately authorized NON-production project. It reads its own variables (never the application's
 * SUPABASE_* settings or a .env file) and refuses unless every condition holds. Values are never echoed.
 */
import { isProtectedIdentityDestination } from '../supabase/protectedDestination';

export type ValidationTarget = { ok: true; url: string; serviceKey: string; anonKey: string } | { ok: false; reason: string };
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validationTarget(env: NodeJS.ProcessEnv): ValidationTarget {
  if (env.NODE_ENV === 'production') return { ok: false, reason: 'REFUSED_PRODUCTION_RUNTIME' };
  if (env.TAXGUARD_VALIDATION_CONFIRM !== 'non-production') return { ok: false, reason: 'CONFIRMATION_MISSING' };
  const raw = (env.TAXGUARD_VALIDATION_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceKey = (env.TAXGUARD_VALIDATION_SERVICE_ROLE_KEY || '').trim(), anonKey = (env.TAXGUARD_VALIDATION_ANON_KEY || '').trim();
  if (!raw || !serviceKey || !anonKey) return { ok: false, reason: 'NON_PRODUCTION_PROJECT_NOT_CONFIGURED' };
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, reason: 'URL_INVALID' }; }
  if (url.username || url.password || url.search || url.hash) return { ok: false, reason: 'URL_INVALID' };
  if (isProtectedIdentityDestination(raw) || raw.includes('cvrlhixxczerytiocxid')) return { ok: false, reason: 'REFUSED_PROTECTED_PROJECT' };
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) return { ok: false, reason: 'URL_INSECURE' };
  // The application's own project must not double as the validation target.
  if (env.SUPABASE_URL && env.SUPABASE_URL.trim().replace(/\/+$/, '') === raw) return { ok: false, reason: 'REFUSED_APPLICATION_PROJECT' };
  if (serviceKey === anonKey) return { ok: false, reason: 'KEYS_INVALID' };
  return { ok: true, url: raw, serviceKey, anonKey };
}
