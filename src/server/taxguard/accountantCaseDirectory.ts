/**
 * Durable, tenant-scoped Accountant case discovery (production read model).
 *
 * Source of truth: Supabase tables taxguard_cases (preparer_uid = the signed-in accountant),
 * taxguard_clients (display name) and taxguard_engagements (title). A case is returned only when
 *   - it belongs to the session's tenant,
 *   - the signed-in user is its recorded preparer, and
 *   - its client is among the user's currently effective staff assignments
 *     (authorizedClientIds, attached server-side from taxguard_staff_assignments).
 * Nothing is read from the request except the authenticated session. No case is fabricated:
 * fields the durable model does not record are reported as unavailable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthorityError } from './authority.repository';

export interface AccountantCaseRow {
  id: string; tenantId: string; clientId: string; authorityClientId: string; engagementId: string;
  taxYear: number; clientName: string; status: string; priority: string; dueDate?: string;
  serviceTitle: string; documents: never[]; activeStage?: number; openExceptions: number;
}

/** Fields the durable case model does not record; the dashboard must show them as unavailable. */
export const DURABLE_UNAVAILABLE_FIELDS = ['dueDate', 'priority', 'documents'] as const;

export class SupabaseAccountantCaseDirectory {
  constructor(private readonly client: SupabaseClient) {}

  async listPreparerCases(tenantId: string, uid: string, authorizedClientIds: readonly string[] | undefined): Promise<AccountantCaseRow[]> {
    if (!tenantId || !uid) throw new AuthorityError('ACCOUNTANT_SCOPE_REQUIRED', 403);
    const granted = new Set((authorizedClientIds || []).filter(id => typeof id === 'string' && id.length > 0));
    if (!granted.size) return [];

    const { data: cases, error } = await this.client
      .from('taxguard_cases')
      .select('case_id, tenant_id, client_id, engagement_id, tax_year, status, active_stage, preparer_uid, open_exceptions')
      .eq('tenant_id', tenantId)
      .eq('preparer_uid', uid);
    if (error) throw new AuthorityError('CASE_STORE_UNAVAILABLE', 503);

    const scoped = (cases || []).filter((c: any) =>
      c.tenant_id === tenantId && c.preparer_uid === uid && granted.has(c.client_id) &&
      Number.isInteger(c.tax_year) && c.tax_year >= 2022 && typeof c.engagement_id === 'string' && c.engagement_id);
    if (!scoped.length) return [];

    const clientIds = Array.from(new Set(scoped.map((c: any) => c.client_id as string)));
    const [{ data: clients, error: clientError }, { data: engagements, error: engagementError }] = await Promise.all([
      this.client.from('taxguard_clients').select('tenant_id, client_id, name').eq('tenant_id', tenantId).in('client_id', clientIds),
      this.client.from('taxguard_engagements').select('tenant_id, client_id, engagement_id, title').eq('tenant_id', tenantId).in('client_id', clientIds),
    ]);
    if (clientError || engagementError) throw new AuthorityError('CASE_STORE_UNAVAILABLE', 503);

    const clientName = new Map((clients || []).filter((c: any) => c.tenant_id === tenantId).map((c: any) => [c.client_id, c.name]));
    const engagementTitle = new Map((engagements || []).filter((e: any) => e.tenant_id === tenantId).map((e: any) => [`${e.client_id}:${e.engagement_id}`, e.title]));

    return scoped.map((c: any): AccountantCaseRow => ({
      id: `${c.client_id}:${c.engagement_id}:${c.tax_year}`,
      tenantId,
      clientId: c.client_id,
      authorityClientId: c.client_id,
      engagementId: c.engagement_id,
      taxYear: c.tax_year,
      clientName: clientName.get(c.client_id) || 'Client name not recorded',
      status: String(c.status || '').toLowerCase(),
      priority: '',
      serviceTitle: engagementTitle.get(`${c.client_id}:${c.engagement_id}`) || 'Engagement title not recorded',
      documents: [],
      activeStage: Number.isInteger(c.active_stage) && c.active_stage >= 1 && c.active_stage <= 18 ? c.active_stage : undefined,
      openExceptions: Number(c.open_exceptions) || 0,
    }));
  }
}
