import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientCategory, User } from '../types';
import { AuthorityError } from './taxguard/authority.repository';

export interface ClientIntakeScope { tenantId: string; clientId: string; engagementId: string; taxYear: number }
export interface ClientIntakePayloadV1 {
  clientCategory?: Exclude<ClientCategory, 'prospective_client'>;
  preferredContactMethod?: 'email' | 'phone' | 'sms' | 'portal';
  phone?: string;
  selectedServices?: string[];
  intakeNotes?: string;
}
export interface ClientIntakeDraft extends ClientIntakeScope {
  ownerUid: string;
  schemaVersion: 1;
  revision: number;
  status: 'DRAFT' | 'SUBMITTED';
  payload: ClientIntakePayloadV1;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}
export interface ClientIntakeResult { draft: ClientIntakeDraft | null; resumed: boolean }
const categories = ['individual_taxpayer','married_household','sole_proprietor','independent_contractor','partnership','corporation','scorporation','llc','nonprofit','estate_trust'];
const payloadKeys = ['clientCategory','preferredContactMethod','phone','selectedServices','intakeNotes'];
const invalid = () => new AuthorityError('CLIENT_INTAKE_INPUT_INVALID', 400);
const denied = () => new AuthorityError('CLIENT_INTAKE_ACCESS_DENIED', 403);
const unavailable = () => new AuthorityError('CLIENT_INTAKE_STORE_UNAVAILABLE', 503);
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function identifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function revision(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647; }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value); }
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1,7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && hour <= 23 && minute <= 59 && second <= 59 &&
    (parts[7] === undefined || (Number(parts[7]) <= 23 && Number(parts[8]) <= 59)) && Number.isFinite(Date.parse(value));
}
function payload(value: unknown): ClientIntakePayloadV1 {
  if (!object(value) || Object.keys(value).some(key => !payloadKeys.includes(key))) throw invalid();
  const result: ClientIntakePayloadV1 = {};
  if ('clientCategory' in value) {
    if (typeof value.clientCategory !== 'string' || !categories.includes(value.clientCategory)) throw invalid();
    result.clientCategory = value.clientCategory as ClientIntakePayloadV1['clientCategory'];
  }
  if ('preferredContactMethod' in value) {
    if (typeof value.preferredContactMethod !== 'string' || !['email','phone','sms','portal'].includes(value.preferredContactMethod)) throw invalid();
    result.preferredContactMethod = value.preferredContactMethod as ClientIntakePayloadV1['preferredContactMethod'];
  }
  if ('phone' in value) {
    if (!text(value.phone,32)) throw invalid();
    result.phone = value.phone;
  }
  if ('intakeNotes' in value) {
    if (!text(value.intakeNotes,2000)) throw invalid();
    result.intakeNotes = value.intakeNotes;
  }
  if ('selectedServices' in value) {
    if (!Array.isArray(value.selectedServices) || value.selectedServices.length > 20 ||
      value.selectedServices.some(service => typeof service !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(service)) ||
      new Set(value.selectedServices).size !== value.selectedServices.length) throw invalid();
    result.selectedServices = [...value.selectedServices] as string[];
  }
  if (Buffer.byteLength(JSON.stringify(result),'utf8') > 16384) throw invalid();
  return result;
}
function scopeInput(tenant: string, actor: User, scope: ClientIntakeScope) {
  if (!identifier(tenant) || !object(scope) || !identifier(scope.tenantId) || !identifier(scope.clientId) || scope.clientId.length > 64 || !identifier(scope.engagementId) ||
    !Number.isInteger(scope.taxYear) || scope.taxYear < 2000 || scope.taxYear > 2200) throw invalid();
  if (!actor || !identifier(actor.id) || actor.role !== 'client' || actor.status !== 'active' || actor.tenantId !== tenant ||
    scope.tenantId !== tenant || actor.clientId !== scope.clientId) throw denied();
  return { p_tenant: tenant, p_actor: actor.id, p_client: scope.clientId, p_engagement: scope.engagementId, p_tax_year: scope.taxYear };
}
function mutationInput(input: unknown, save: boolean) {
  const allowed = save ? ['schemaVersion','expectedRevision','requestId','payload'] : ['expectedRevision','requestId'];
  if (!object(input) || Object.keys(input).some(key => !allowed.includes(key)) || !revision(input.expectedRevision) || input.expectedRevision > 2147483646 || !identifier(input.requestId) || input.requestId.length < 8 ||
    (save && input.schemaVersion !== 1)) throw invalid();
  return { p_expected_revision: input.expectedRevision, p_request_id: input.requestId,
    ...(save ? { p_schema_version: 1, p_payload: payload(input.payload) } : {}) };
}
function decode(data: unknown, actor: User, scope: ClientIntakeScope, operation: 'get' | 'save' | 'submit', expectedRevision?: number): ClientIntakeResult {
  if (!object(data) || typeof data.resumed !== 'boolean' || (operation === 'get' && data.resumed)) throw unavailable();
  if (data.draft === null) {
    if (operation !== 'get' || data.resumed) throw unavailable();
    return { draft: null, resumed: false };
  }
  const row = data.draft;
  if (!object(row) || row.tenantId !== scope.tenantId || row.clientId !== scope.clientId || row.engagementId !== scope.engagementId ||
    row.taxYear !== scope.taxYear || row.ownerUid !== actor.id || row.schemaVersion !== 1 || !revision(row.revision) || row.revision < 1 || (operation !== 'get' && row.revision !== expectedRevision! + 1) ||
    !['DRAFT','SUBMITTED'].includes(row.status as string) || (operation === 'submit' && row.status !== 'SUBMITTED') || (operation === 'save' && row.status !== 'DRAFT') ||
    !timestamp(row.createdAt) || !timestamp(row.updatedAt) || Date.parse(row.updatedAt) < Date.parse(row.createdAt) ||
    (row.status === 'DRAFT' ? row.submittedAt !== null : !timestamp(row.submittedAt) || Date.parse(row.submittedAt) < Date.parse(row.createdAt) || Date.parse(row.submittedAt) > Date.parse(row.updatedAt))) throw unavailable();
  let cleanPayload: ClientIntakePayloadV1;
  try { cleanPayload = payload(row.payload); } catch { throw unavailable(); }
  if (row.status === 'SUBMITTED' && (!cleanPayload.clientCategory || !cleanPayload.preferredContactMethod || !cleanPayload.phone?.trim() || !cleanPayload.selectedServices?.length || Date.parse(row.submittedAt as string) !== Date.parse(row.updatedAt))) throw unavailable();
  return { draft: { tenantId: scope.tenantId, clientId: scope.clientId, engagementId: scope.engagementId, taxYear: scope.taxYear,
    ownerUid: actor.id, schemaVersion: 1, revision: row.revision, status: row.status as ClientIntakeDraft['status'], payload: cleanPayload,
    createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt as string | null }, resumed: data.resumed };
}
async function call(client: SupabaseClient, tenant: string, actor: User, scope: ClientIntakeScope, operation: 'get' | 'save' | 'submit', input?: unknown) {
  const parameters = scopeInput(tenant, actor, scope);
  const mutation = operation === 'get' ? {} : mutationInput(input, operation === 'save');
  let response;
  try { response = await client.rpc('taxguard_' + operation + '_client_intake', { ...parameters, ...mutation }); }
  catch { throw unavailable(); }
  if (response?.error) {
    if (response.error.code === 'P0001') {
      const code = response.error.message;
      if (code === 'CLIENT_INTAKE_INPUT_INVALID') throw invalid();
      if (code === 'CLIENT_INTAKE_INCOMPLETE') throw new AuthorityError('CLIENT_INTAKE_INCOMPLETE',400);
      if (code === 'CLIENT_INTAKE_SCOPE_UNAVAILABLE') throw new AuthorityError('CLIENT_INTAKE_SCOPE_UNAVAILABLE',403);
      if (code !== 'CLIENT_INTAKE_ACCESS_DENIED' && !['CLIENT_INTAKE_REVISION_CONFLICT','CLIENT_INTAKE_IDEMPOTENCY_CONFLICT','CLIENT_INTAKE_SUBMITTED'].includes(code)) throw unavailable();
      if (['CLIENT_INTAKE_REVISION_CONFLICT','CLIENT_INTAKE_IDEMPOTENCY_CONFLICT','CLIENT_INTAKE_SUBMITTED'].includes(code)) throw new AuthorityError(code,409);
      throw denied();
    }
    throw unavailable();
  }
  return decode(response?.data, actor, scope, operation, 'p_expected_revision' in mutation && typeof mutation.p_expected_revision === 'number' ? mutation.p_expected_revision : undefined);
}
/** Tenant and actor must be supplied by durable server session authority, never browser metadata. */
export function getClientIntakeDraft(client: SupabaseClient, tenant: string, actor: User, scope: ClientIntakeScope) {
  return call(client,tenant,actor,scope,'get');
}
export function saveClientIntakeDraft(client: SupabaseClient, tenant: string, actor: User, scope: ClientIntakeScope, input: unknown) {
  return call(client,tenant,actor,scope,'save',input);
}
export function submitClientIntakeDraft(client: SupabaseClient, tenant: string, actor: User, scope: ClientIntakeScope, input: unknown) {
  return call(client,tenant,actor,scope,'submit',input);
}
