import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export interface LiveWorkflowEligibility {
  clientId: string;
  taxYear: number;

  revision: number;
  activeStage: 1 | 2 | 3;

  eligibility: {
    stage1: boolean;
    stage2: boolean;
    stage3: boolean;
  };

  status: {
    stage1: string;
    stage2: string;
    stage3: string;
  };

  externalSubmissionEnabled: false;
}

export interface LiveWorkflowStageState {
  stage: 1 | 2 | 3;

  status:
    | 'LOCKED'
    | 'IN_PROGRESS'
    | 'READY_FOR_REVIEW'
    | 'COMPLETED';

  completedAt?: string;
  completedBy?: string;
}

export interface LiveWorkflowState {
  clientId: string;
  taxYear: number;

  environment: 'live';

  revision: number;

  activeStage: 1 | 2 | 3;

  stage1: LiveWorkflowStageState;
  stage2: LiveWorkflowStageState;
  stage3: LiveWorkflowStageState;

  externalSubmissionEnabled: false;

  createdAt: string;
  updatedAt: string;
}

export interface ScopedOnboardingWorkflowResponse {
  environment: 'live';
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  caseId: string;
  activeStage: 1 | 2 | 3;
  stageStates: {
    STAGE_01_IDENTITY: string;
    STAGE_02_DOCUMENTS: string;
    STAGE_03_EXTRACTION: string;
    STAGE_04_PREPARATION: string;
    STAGE_05_REVIEW: string;
    STAGE_06_APPROVAL: string;
    STAGE_07_FILING: string;
  };
  resumed: boolean;
  workflow: LiveWorkflowState;
  eligibility: LiveWorkflowEligibility;
}

function requireSessionToken(): string {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      'Authenticated TaxGuard session required.'
    );
  }

  return token;
}

async function requestLiveWorkflow<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const token = requireSessionToken();

  const response = await fetch(
    apiEndpoint(endpoint),
    {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        'x-session-token': token
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    }
  );

  const payload = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error ||
      payload?.message ||
      `LIVE workflow request failed with status ${response.status}.`
    ) as Error & {
      status?: number;
      code?: string;
    };

    error.status = response.status;
    error.code = payload?.code;

    throw error;
  }

  return payload as T;
}

export class LiveWorkflowApi {
  static async provisionClientOnboarding(
    taxYear: number = 2025
  ): Promise<ScopedOnboardingWorkflowResponse> {
    return requestLiveWorkflow<ScopedOnboardingWorkflowResponse>(
      '/api/case-authority/client-onboarding/provision',
      'POST',
      { taxYear }
    );
  }

  static async getScopedWorkflowBundle(
    taxYear: number
  ): Promise<ScopedOnboardingWorkflowResponse> {
    return requestLiveWorkflow<ScopedOnboardingWorkflowResponse>(
      `/api/case-authority/client-onboarding/workflow?taxYear=${encodeURIComponent(
        String(taxYear)
      )}`
    );
  }

  static async getState(
    taxYear: number
  ): Promise<LiveWorkflowState> {
    try {
      const scoped = await this.getScopedWorkflowBundle(taxYear);
      if (scoped?.workflow) {
        return scoped.workflow;
      }
    } catch {
      // Fall back to legacy workflow route in non-production environments if needed
    }

    const payload =
      await requestLiveWorkflow<{
        workflow: LiveWorkflowState;
      }>(
        `/api/live-workflow/state?taxYear=${encodeURIComponent(
          String(taxYear)
        )}`
      );

    if (!payload.workflow) {
      throw new Error(
        'Authoritative LIVE workflow state was not returned by the server.'
      );
    }

    return payload.workflow;
  }

  static async getEligibility(
    taxYear: number
  ): Promise<LiveWorkflowEligibility> {
    try {
      const scoped = await this.getScopedWorkflowBundle(taxYear);
      if (scoped?.eligibility) {
        return scoped.eligibility;
      }
    } catch {
      // Fall back to legacy workflow route in non-production environments if needed
    }

    return requestLiveWorkflow<LiveWorkflowEligibility>(
      `/api/live-workflow/eligibility?taxYear=${encodeURIComponent(
        String(taxYear)
      )}`
    );
  }
}
