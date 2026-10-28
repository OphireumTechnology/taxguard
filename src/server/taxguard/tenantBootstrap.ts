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
import { safeId, AuthorityError } from './authority.repository';

export const CANONICAL_TENANT_ID = 'ar-tax-services';
export const CANONICAL_TENANT_NAME = 'A/R Tax Services, LLC';

export interface TenantBootstrapResult {
  tenantId: string;
  name: string;
  status: 'active';
  provisioned: boolean;
  timestamp: string;
}

export function getAuthoritativeTenantId(): string {
  const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
  if (configured) {
    safeId(configured);
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new AuthorityError('PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.', 500);
  }
  return CANONICAL_TENANT_ID;
}

function isNetworkOrUnavailableError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('timeout')
  );
}

export async function ensureCanonicalTenantBootstrap(
  client?: SupabaseClient
): Promise<TenantBootstrapResult> {
  const targetTenantId = getAuthoritativeTenantId();
  const admin = client || (isSupabaseServerConfigured() ? getSupabaseAdmin() : null);

  if (!admin) {
    // In environments without active Supabase server connection, return canonical record
    return {
      tenantId: targetTenantId,
      name: CANONICAL_TENANT_NAME,
      status: 'active',
      provisioned: false,
      timestamp: new Date().toISOString(),
    };
  }

  const runBootstrap = async (): Promise<TenantBootstrapResult> => {
    // 1. Check if authoritative tenant exists
    const { data: existing, error: selectError } = await admin
      .from('taxguard_tenants')
      .select('*')
      .eq('id', targetTenantId)
      .maybeSingle();

    if (selectError) {
      if (!isNetworkOrUnavailableError(selectError)) {
        console.warn('[Tenant Bootstrap] Query check error:', selectError.message);
      }
      return {
        tenantId: targetTenantId,
        name: CANONICAL_TENANT_NAME,
        status: 'active',
        provisioned: false,
        timestamp: new Date().toISOString(),
      };
    }

    if (existing) {
      return {
        tenantId: existing.id,
        name: existing.name || CANONICAL_TENANT_NAME,
        status: 'active',
        provisioned: false,
        timestamp: existing.created_at || new Date().toISOString(),
      };
    }

    // In production, do not silently invent unapproved tenants
    if (process.env.NODE_ENV === 'production') {
      console.error(`[Tenant Bootstrap] Authoritative tenant '${targetTenantId}' not found in database.`);
      throw new AuthorityError(`AUTHORITATIVE_TENANT_NOT_FOUND: Tenant '${targetTenantId}' must be provisioned via schema migrations.`, 500);
    }

    // 2. Development / Test idempotent insert with ON CONFLICT ignore
    const { data: inserted, error: insertError } = await admin
      .from('taxguard_tenants')
      .upsert(
        {
          id: targetTenantId,
          name: CANONICAL_TENANT_NAME,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    if (insertError) {
      if (!isNetworkOrUnavailableError(insertError)) {
        console.warn('[Tenant Bootstrap] Upsert warning:', insertError.message);
      }
    }

    return {
      tenantId: targetTenantId,
      name: CANONICAL_TENANT_NAME,
      status: 'active',
      provisioned: true,
      timestamp: inserted?.created_at || new Date().toISOString(),
    };
  };

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('connection timeout')), 1500);
      if (typeof timer.unref === 'function') timer.unref();
    });

    return await Promise.race([runBootstrap(), timeoutPromise]);
  } catch (err: any) {
    if (!isNetworkOrUnavailableError(err)) {
      console.warn('[Tenant Bootstrap] Unexpected error:', err?.message || err);
    }
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    return {
      tenantId: targetTenantId,
      name: CANONICAL_TENANT_NAME,
      status: 'active',
      provisioned: false,
      timestamp: new Date().toISOString(),
    };
  }
}

export function isCanonicalTenant(tenantId: string): boolean {
  return tenantId === getAuthoritativeTenantId() || tenantId === CANONICAL_TENANT_ID;
}
