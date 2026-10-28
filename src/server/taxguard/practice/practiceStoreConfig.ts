import { isSupabaseServerConfigured } from '../../supabase';

/**
 * The development-only durable practice routers (/api/practice, /api/cases, /api/vault,
 * /api/billing, /api/book-to-tax) answer only when TAXGUARD_PRACTICE_STORE=durable points at a
 * non-production project. Never in production; never the protected production project.
 */
export function practiceStoreConfigured(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.TAXGUARD_PRACTICE_STORE !== 'durable' || !isSupabaseServerConfigured()) return false;
  return !(process.env.SUPABASE_URL || '').includes('cvrlhixxczerytiocxid');
}
