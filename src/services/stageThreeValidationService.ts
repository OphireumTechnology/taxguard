export type AuthoritativeSourceTier = 'tier_1_government' | 'tier_2_institution' | 'tier_3_client_provided' | string;

export interface ValidationSourceRecord {
  id: string;
  documentId?: string;
  tier: AuthoritativeSourceTier;
  name: string;
  status: string;
  [key: string]: any;
}

export interface CrossDocumentRule {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | string;
  details?: string;
  [key: string]: any;
}

export interface ValidationConflict {
  id: string;
  field: string;
  severity: string;
  description: string;
  status: string;
  [key: string]: any;
}

export interface MathematicalValidationResult {
  id: string;
  expression?: string;
  expected: number;
  actual: number;
  variance: number;
  passed: boolean;
  [key: string]: any;
}

export interface IdentityEntityValidationFinding {
  id: string;
  field: string;
  status: string;
  message: string;
  [key: string]: any;
}

export interface PeriodConsistencyFinding {
  id: string;
  period: string;
  status: string;
  message: string;
  [key: string]: any;
}

export interface ValidationException {
  id: string;
  title: string;
  severity: string;
  status: string;
  [key: string]: any;
}

export interface HumanValidationQueueItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  [key: string]: any;
}

export interface StageThreeWorkspaceContext {
  clientId: string;
  taxYear: number;
  sources: ValidationSourceRecord[];
  rules: CrossDocumentRule[];
  conflicts: ValidationConflict[];
  mathResults: MathematicalValidationResult[];
  identityFindings: IdentityEntityValidationFinding[];
  periodFindings: PeriodConsistencyFinding[];
  exceptions: ValidationException[];
  humanQueue: HumanValidationQueueItem[];
  ready: boolean;
  [key: string]: any;
}

export const StageThreeValidationService: any = {
  getWorkspaceContext(clientId: string, taxYear = 2025): StageThreeWorkspaceContext {
    return {
      clientId,
      taxYear,
      sources: [],
      rules: [],
      conflicts: [],
      mathResults: [],
      identityFindings: [],
      periodFindings: [],
      exceptions: [],
      humanQueue: [],
      ready: false,
    };
  },
};
