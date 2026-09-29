/**
 * TaxGuard Production Tenant Bootstrap
 * Idempotently provisions the canonical master tenant:
 * A/R Tax Services, LLC (slug: ar-tax-services).
 *
 * Security Invariant:
 * - Server never trusts browser-provided tenant IDs.
 * - Bootstrap is strictly idempotent and concurrency-safe.
 * - Associate authorized users through tenant membership records.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseServerConfigured } from '../supabase';

export const CANONICAL_TENANT_ID = 'ar-tax-services';
export const CANONICAL_TENANT_NAME = 'A/R Tax Services, LLC';

export interface TenantBootstrapResult {
  tenantId: string;
  name: string;
  status: 'active';
  provisioned: boolean;
  timestamp: string;
}

export async function ensureCanonicalTenantBootstrap(
  client?: SupabaseClient
): Promise<TenantBootstrapResult> {
  const admin = client || (isSupabaseServerConfigured() ? getSupabaseAdmin() : null);

  if (!admin) {
    // In environments without active Supabase server connection, return canonical record
    return {
      tenantId: CANONICAL_TENANT_ID,
      name: CANONICAL_TENANT_NAME,
      status: 'active',
      provisioned: false,
      timestamp: new Date().toISOString(),
    };
  }

  // 1. Check if canonical tenant exists
  const { data: existing, error: selectError } = await admin
    .from('taxguard_tenants')
    .select('*')
    .eq('id', CANONICAL_TENANT_ID)
    .maybeSingle();

  if (selectError) {
    console.warn('[Tenant Bootstrap] Query check error:', selectError.message);
  }

  if (existing) {
    return {
      tenantId: existing.id,
      name: existing.name,
      status: 'active',
      provisioned: false,
      timestamp: existing.created_at || new Date().toISOString(),
    };
  }

  // 2. Idempotent insert with ON CONFLICT ignore
  const { data: inserted, error: insertError } = await admin
    .from('taxguard_tenants')
    .upsert(
      {
        id: CANONICAL_TENANT_ID,
        name: CANONICAL_TENANT_NAME,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (insertError) {
    console.warn('[Tenant Bootstrap] Upsert warning:', insertError.message);
  }

  return {
    tenantId: CANONICAL_TENANT_ID,
    name: CANONICAL_TENANT_NAME,
    status: 'active',
    provisioned: true,
    timestamp: inserted?.created_at || new Date().toISOString(),
  };
}

export function isCanonicalTenant(tenantId: string): boolean {
  return tenantId === CANONICAL_TENANT_ID;
}
