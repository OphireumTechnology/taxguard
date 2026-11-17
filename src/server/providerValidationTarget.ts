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
  // A hosted project must be named twice: by URL and by an explicit project-ref confirmation, and a
  // production ref must be given so the two can be proven different (loopback emulators excepted).
  if (!LOOPBACK.has(url.hostname)) {
    const ref = /^([a-z]{20})\.supabase\.co$/.exec(url.hostname)?.[1];
    if (!ref || url.pathname !== '/') return { ok: false, reason: 'HOSTED_PROJECT_URL_REQUIRED' };
    if ((env.TAXGUARD_VALIDATION_PROJECT_REF || '').trim() !== ref) return { ok: false, reason: 'PROJECT_CONFIRMATION_MISMATCH' };
    const production = (env.TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF || '').trim();
    if (!/^[a-z]{20}$/.test(production)) return { ok: false, reason: 'PRODUCTION_REFERENCE_REQUIRED' };
    if (production === ref) return { ok: false, reason: 'REFUSED_PRODUCTION_OVERLAP' };
  }
  return { ok: true, url: raw, serviceKey, anonKey };
}

/**
 * Readiness of the real-provider MFA validation without contacting anything: BLOCKED with the
 * guard's reason code, or READY_TO_RUN (the owner still decides whether to run it). Never returns values.
 */
export function mfaValidationReadiness(env: NodeJS.ProcessEnv): { status: 'BLOCKED'; reason: string } | { status: 'READY_TO_RUN'; target: 'LOOPBACK_EMULATOR' | 'HOSTED_NON_PRODUCTION_PROJECT' } {
  const t = validationTarget(env);
  if ('reason' in t) return { status: 'BLOCKED', reason: t.reason };
  return { status: 'READY_TO_RUN', target: LOOPBACK.has(new URL(t.url).hostname) ? 'LOOPBACK_EMULATOR' : 'HOSTED_NON_PRODUCTION_PROJECT' };
}
