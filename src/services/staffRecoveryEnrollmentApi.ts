import { apiRequest, ApiRequestError } from './api';

export class RecoveryEnrollmentError extends ApiRequestError {}

export type RecoveryStep = 'lookup' | 'authenticate' | 'enroll' | 'verify' | 'complete' | string;

export interface RecoveryEnrollmentApi {
  status: (token?: string) => Promise<any>;
  begin: (payload?: any) => Promise<any>;
  verifyCode: (payload: any) => Promise<any>;
  cancel: (payload?: any) => Promise<any>;
  [key: string]: any;
}

export function createRecoveryEnrollmentApi(): RecoveryEnrollmentApi {
  return {
    status: (token?: string) =>
      apiRequest(`/api/staff-access/recovery-enrollment/status${token ? `?token=${encodeURIComponent(token)}` : ''}`),
    begin: (payload?: any) =>
      apiRequest('/api/staff-access/recovery-enrollment/begin', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),
    verifyCode: (payload: any) =>
      apiRequest('/api/staff-access/recovery-enrollment/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    cancel: (payload?: any) =>
      apiRequest('/api/staff-access/recovery-enrollment/cancel', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),
  };
}
