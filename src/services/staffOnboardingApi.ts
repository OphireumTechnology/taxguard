import { apiRequest, ApiRequestError } from './api';

export class StaffOnboardingError extends ApiRequestError {}

export interface StaffOnboardingStatus {
  status: string;
  step?: string;
  role?: string;
  mfaEnrolled?: boolean;
  approved?: boolean;
  updatedAt?: string;
  [key: string]: any;
}

export const STEP_TEXT: Record<string, { title: string; detail: string }> = {
  invited: { title: 'Invitation Issued', detail: 'Accept your staff invitation to begin onboarding.' },
  accepted: { title: 'Invitation Accepted', detail: 'Complete multi-factor authentication setup.' },
  mfa_pending: { title: 'Multi-Factor Enrollment Required', detail: 'Enroll an authenticator app before administrator approval.' },
  pending_approval: { title: 'Pending Administrator Approval', detail: 'An independent administrator must approve your staff membership.' },
  active: { title: 'Active Staff Member', detail: 'Your staff workspace is active.' },
  suspended: { title: 'Access Suspended', detail: 'Contact your practice administrator for assistance.' },
};

export const staffOnboardingApi: any = {
  getStatus: () => apiRequest('/api/staff-access/onboarding-status'),
  status: () => apiRequest('/api/staff-access/onboarding-status'),
  submit: (payload: any) =>
    apiRequest('/api/staff-access/onboarding-status', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
