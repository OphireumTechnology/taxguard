import { getStoredToken } from './api';

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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/+$/, '');

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
  endpoint: string
): Promise<T> {
  const token = requireSessionToken();

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-session-token': token
      }
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
  static async getState(
    taxYear: number
  ): Promise<LiveWorkflowState> {
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
    return requestLiveWorkflow<LiveWorkflowEligibility>(
      `/api/live-workflow/eligibility?taxYear=${encodeURIComponent(
        String(taxYear)
      )}`
    );
  }
}