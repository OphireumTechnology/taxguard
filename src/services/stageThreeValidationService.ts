import { apiRequest } from './api';

export type AuthoritativeSourceTier = 'tier_1_primary' | 'tier_2_corroborating' | 'tier_3_client_supplied' | string;

export interface ValidationSourceRecord {
  id: string;
  documentId?: string;
  tier?: AuthoritativeSourceTier;
  label?: string;
  value?: any;
  [key: string]: any;
}

export interface CrossDocumentRule {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
  [key: string]: any;
}

export interface MathematicalValidationResult {
  id: string;
  formula?: string;
  expected?: number;
  actual?: number;
  passed: boolean;
  [key: string]: any;
}

export interface PeriodConsistencyFinding {
  id: string;
  period?: string;
  status: string;
  message?: string;
  [key: string]: any;
}

export interface IdentityEntityValidationFinding {
  id: string;
  field: string;
  status: string;
  message?: string;
  [key: string]: any;
}

export interface ValidationConflict {
  id: string;
  field: string;
  severity?: string;
  sources?: ValidationSourceRecord[];
  status: string;
  [key: string]: any;
}

export interface ValidationException {
  id: string;
  title: string;
  severity: string;
  status: string;
  message?: string;
  [key: string]: any;
}

export interface HumanValidationQueueItem {
  id: string;
  clientId?: string;
  documentId?: string;
  title: string;
  status: string;
  severity?: string;
  [key: string]: any;
}

export interface StageThreeWorkspaceContext {
  clientId: string;
  taxYear: number;
  conflicts: ValidationConflict[];
  exceptions: ValidationException[];
  queue: HumanValidationQueueItem[];
  rules: CrossDocumentRule[];
  mathResults: MathematicalValidationResult[];
  periodFindings: PeriodConsistencyFinding[];
  identityFindings: IdentityEntityValidationFinding[];
  [key: string]: any;
}

export const StageThreeValidationService: any = new Proxy(
  {
    getWorkspace: (clientId: string, taxYear: number) =>
      apiRequest(`/api/stage-two-three/validation?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({ success: true, items: [] });
    },
  }
);
