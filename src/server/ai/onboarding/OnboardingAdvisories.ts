type Reader<T> = (value: unknown) => T;
function invalid(): never { throw new Error('AI_ONBOARDING_METADATA_INVALID'); }
function record<S extends Record<string, Reader<unknown>>>(shape: S) {
  return (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const input = value as Record<string, unknown>;
    if (Object.keys(input).length !== Object.keys(shape).length) return invalid();
    const result: Record<string, unknown> = {};
    for (const [key, read] of Object.entries(shape)) {
      if (!Object.hasOwn(input, key)) return invalid();
      result[key] = read(input[key]);
    }
    return result as { [K in keyof S]: ReturnType<S[K]> };
  };
}
function list<T>(read: Reader<T>, limit: number): Reader<T[]> {
  return value => Array.isArray(value) && value.length <= limit ? Array.from(value, read) : invalid();
}
function choice<const T extends string>(allowed: T[]): Reader<T> {
  return value => allowed.includes(value as T) ? value as T : invalid();
}
const flag = (value: unknown) => typeof value === 'boolean' ? value : invalid();
const nullableFlag = (value: unknown) => value === null ? null : flag(value);
const id = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(value) ? value : invalid();
const year = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2200 ? value : invalid();
const readScope = record({ tenantId: id, clientId: id, caseId: id, taxYear: year });
type Scope = ReturnType<typeof readScope>;

function scoped<T>(scope: Scope, snapshot: unknown, read: Reader<T>) {
  const expected = readScope(scope);
  const input = record({ scope: readScope, data: read })(snapshot);
  if (input.scope.tenantId !== expected.tenantId || input.scope.clientId !== expected.clientId ||
      input.scope.caseId !== expected.caseId || input.scope.taxYear !== expected.taxYear) {
    throw new Error('AI_ONBOARDING_SCOPE_INVALID');
  }
  return input.data;
}

function advisory<A extends string, T>(agent_id: A, findings: T) {
  return { agent_id, status: 'ADVISORY', human_review_required: true, authoritative_mutation: false, findings } as const;
}

// Inputs are metadata projections from an authorized server-side case reader.
export function inspectOnboarding(scope: Scope, snapshot: unknown) {
  const data = scoped(scope, snapshot, record({
    contactComplete: flag, checklistComplete: flag, consentReceiptCurrent: flag,
  }));
  const outstanding = [];
  if (!data.contactComplete) outstanding.push('COMPLETE_CONTACT_DETAILS');
  if (!data.checklistComplete) outstanding.push('COMPLETE_INTAKE_CHECKLIST');
  if (!data.consentReceiptCurrent) outstanding.push('REVIEW_CONSENT_RECEIPT');
  return advisory('A01', outstanding);
}

export function inspectIdentity(scope: Scope, snapshot: unknown) {
  const data = scoped(scope, snapshot, record({
    evidenceStatus: choice(['PENDING', 'VERIFIED', 'REJECTED']),
    nameConsistent: nullableFlag, duplicateFlag: flag,
  }));
  const referrals = [];
  if (data.evidenceStatus !== 'VERIFIED') referrals.push('REVIEW_IDENTITY_EVIDENCE');
  if (data.evidenceStatus === 'REJECTED') referrals.push('RESOLVE_REJECTED_IDENTITY_EVIDENCE');
  if (data.nameConsistent !== true) referrals.push('CHECK_NAME_CONSISTENCY');
  if (data.duplicateFlag) referrals.push('REVIEW_POSSIBLE_DUPLICATE');
  return advisory('A02', referrals);
}

export function draftEngagement(scope: Scope, snapshot: unknown) {
  const data = scoped(scope, snapshot, record({
    requestedServices: list(id, 128), approvedServices: list(id, 128),
    engagementStatus: choice(['PENDING', 'ACTIVE', 'CLOSED']),
  }));
  const requested = [...new Set(data.requestedServices)];
  const approved = new Set(data.approvedServices);
  const unlistedServices = requested.filter(key => !approved.has(key));
  return advisory('A03', {
    taxYear: scope.taxYear, engagementStatus: data.engagementStatus,
    proposedServices: data.engagementStatus === 'CLOSED' ? [] : requested.filter(key => approved.has(key)),
    unlistedServices, unlistedServiceCount: unlistedServices.length,
    requiresScopeConfirmation: data.engagementStatus !== 'PENDING' || requested.length === 0 || unlistedServices.length > 0,
  });
}

export function draftOrganizerFollowups(scope: Scope, snapshot: unknown) {
  const data = scoped(scope, snapshot, record({
    questions: list(record({ questionId: id, applicable: flag,
      answerStatus: choice(['MISSING', 'CONFLICTING', 'COMPLETE']) }), 512),
  }));
  if (new Set(data.questions.map(row => row.questionId)).size !== data.questions.length) {
    throw new Error('AI_ORGANIZER_DUPLICATE_QUESTION');
  }
  return advisory('A04', data.questions.filter(row => row.applicable && row.answerStatus !== 'COMPLETE')
    .map(row => ({ questionId: row.questionId, reason: row.answerStatus })));
}
