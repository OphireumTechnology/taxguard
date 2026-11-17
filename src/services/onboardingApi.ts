/** Browser client for /api/stage-one (durable Stage 01 onboarding). The server derives every requirement. */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class OnboardingRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'ONBOARDING_REQUEST_FAILED'); }
}
export type OnboardingStatus = 'DRAFT' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED';
export interface OnboardingRequirements { profile: boolean; tin: boolean; address: boolean; representative: boolean; identityDocument: boolean; consentAvailable: boolean }
export interface OnboardingView {
  clientId: string; status: OnboardingStatus; revision: number; taxpayerType: 'individual' | 'entity' | null; legalName: string | null;
  address: { street: string | null; city: string | null; state: string | null; postalCode: string | null };
  representative: { fullName: string; title: string } | null; tinType: 'SSN' | 'ITIN' | 'EIN' | null; tinMasked: string | null;
  consentVersion: string | null; consentSigner: string | null; consentAt: string | null; submittedAt: string | null; decidedAt: string | null;
  clientReason: string | null; requirements: OnboardingRequirements; consent: { version: string; text: string } | null;
  // Staff view only.
  ownerUid?: string; decidedBy?: string | null; internalNote?: string | null; duplicateDecision?: string | null; possibleDuplicates?: string[]; consentTextSha256?: string | null;
}
export interface OnboardingFields {
  taxpayerType?: string; legalName?: string; street?: string; city?: string; state?: string; postalCode?: string; repName?: string; repTitle?: string; tinType?: string; tinLast4?: string;
}
export interface OnboardingQueueItem { clientId: string; legalName: string | null; submittedAt: string; revision: number; possibleDuplicates: number; identityDocument: boolean }

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new OnboardingRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/stage-one' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  // A response for a previous session must never be applied to the current one.
  if (getStoredToken() !== token) throw new OnboardingRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new OnboardingRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
export const onboardingApi = {
  mine: () => request<OnboardingView>('GET', '/me'),
  save: (revision: number, fields: OnboardingFields) => request<OnboardingView>('POST', '/me', { revision, fields }),
  submit: (revision: number, consentVersion: string, signer: string) => request<OnboardingView>('POST', '/me/submit', { revision, consentVersion, signer }),
  queue: () => request<{ items: OnboardingQueueItem[] }>('GET', '/queue'),
  client: (clientId: string) => request<OnboardingView>('GET', c(clientId)),
  decide: (clientId: string, revision: number, decision: 'approve' | 'request_changes', input: { clientReason?: string; internalNote?: string; duplicateOverride?: boolean }) =>
    request<OnboardingView>('POST', c(clientId) + '/decision', { revision, decision, ...input }),
};

const MESSAGES: Record<string, string> = {
  ONBOARDING_VERSION_CONFLICT: 'This onboarding record changed since it was loaded. Refresh and try again.',
  ONBOARDING_NOT_EDITABLE: 'This onboarding record is with the practice and cannot be edited now.',
  ONBOARDING_INCOMPLETE: 'Complete every section before submitting.',
  ONBOARDING_CONSENT_NOT_APPROVED: 'The consent wording is not approved for use yet, so onboarding cannot be submitted or approved.',
  ONBOARDING_FULL_TIN_REFUSED: 'Enter only the last four digits of the identification number.',
  ONBOARDING_INPUT_INVALID: 'Check the highlighted information and try again.',
  ONBOARDING_IDENTITY_DOCUMENT_REQUIRED: 'An identification document must be verified by the practice before approval.',
  ONBOARDING_DUPLICATE_REVIEW_REQUIRED: 'A possible duplicate client was found. Confirm the override and record a reason of at least 10 characters.',
  ONBOARDING_REASON_REQUIRED: 'Enter a reason for the client (at least 5 characters).',
  ONBOARDING_NOT_SUBMITTED: 'This onboarding record is not awaiting a decision.',
  PRACTICE_MANAGER_REQUIRED: 'Only a practice manager or administrator can decide onboarding.',
  ONBOARDING_STORE_UNAVAILABLE: 'Online onboarding is not available in this environment.',
  SESSION_CHANGED: 'Your session changed. Reload the page.',
};
export function onboardingMessage(error: unknown): string {
  if (error instanceof OnboardingRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof OnboardingRequestError && (error.status === 403 || error.status === 404)) return 'You are not authorized for this onboarding record.';
  return 'The onboarding service did not confirm this action. Refresh and try again.';
}
