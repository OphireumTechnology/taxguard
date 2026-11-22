import { LiveWorkflowApi } from './liveWorkflowApi';

export interface LiveWorkflowAuthoritySnapshot {
  clientId: string;
  taxYear: number;
  currentStage: number;
  completedStages: number[];
  status: string;
  loading?: boolean;
  error?: string | null;
  workflow?: any;
  eligibility?: any;
  stages?: Array<{ stage: number; label?: string; status: string; updatedAt?: string; completedAt?: string }>;
  [key: string]: any;
}

type Listener = (snapshot: LiveWorkflowAuthoritySnapshot) => void;

let currentSnapshot: LiveWorkflowAuthoritySnapshot = {
  clientId: '',
  taxYear: new Date().getFullYear() - 1,
  currentStage: 1,
  completedStages: [],
  status: 'IDLE',
  loading: false,
  error: null,
  workflow: null,
  eligibility: null,
  stages: [],
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener(currentSnapshot);
    } catch {
      // isolate subscriber failures
    }
  }
}

export const LiveWorkflowAuthority = {
  createInitialSnapshot(clientId: string, taxYear = 2025): LiveWorkflowAuthoritySnapshot {
    return {
      clientId,
      taxYear,
      currentStage: 1,
      completedStages: [],
      status: 'ACTIVE',
      loading: false,
      error: null,
      workflow: null,
      eligibility: null,
      stages: Array.from({ length: 18 }, (_, i) => ({
        stage: i + 1,
        status: i === 0 ? 'IN_PROGRESS' : 'LOCKED',
      })),
    };
  },
  getSnapshot(): LiveWorkflowAuthoritySnapshot {
    return currentSnapshot;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  clear(): void {
    currentSnapshot = {
      clientId: '',
      taxYear: new Date().getFullYear() - 1,
      currentStage: 1,
      completedStages: [],
      status: 'IDLE',
      loading: false,
      error: null,
      workflow: null,
      eligibility: null,
      stages: [],
    };
    emit();
  },
  seedFromServerBundle(bundle: any, ..._rest: any[]): LiveWorkflowAuthoritySnapshot {
    const wf = bundle?.workflow ?? bundle ?? null;
    const elig = bundle?.eligibility ?? null;
    currentSnapshot = {
      ...this.normalize(wf, bundle?.clientId || wf?.clientId || '', bundle?.taxYear || wf?.taxYear || 2025),
      loading: false,
      error: null,
      workflow: wf,
      eligibility: elig,
    };
    emit();
    return currentSnapshot;
  },
  async hydrate(taxYearOrBundle?: any, ..._rest: any[]): Promise<LiveWorkflowAuthoritySnapshot> {
    if (taxYearOrBundle && typeof taxYearOrBundle === 'object') {
      return this.seedFromServerBundle(taxYearOrBundle);
    }
    currentSnapshot = { ...currentSnapshot, loading: true, error: null };
    emit();
    try {
      const bundle = await LiveWorkflowApi.getScopedWorkflowBundle(taxYearOrBundle);
      return this.seedFromServerBundle(bundle);
    } catch (err: any) {
      currentSnapshot = {
        ...currentSnapshot,
        loading: false,
        error: err?.message || 'Unable to load workflow authority.',
      };
      emit();
      throw err;
    }
  },
  canEnterStage(stage: number): boolean {
    return this.isStageAccessible(currentSnapshot, stage);
  },
  getActiveStage(): number {
    return currentSnapshot.workflow?.currentStage || currentSnapshot.currentStage || 1;
  },
  isStageAccessible(snapshot: LiveWorkflowAuthoritySnapshot | null | undefined, stage: number): boolean {
    if (!snapshot) return stage === 1;
    if (snapshot.eligibility?.stages?.[stage]?.eligible === true) return true;
    return stage <= (snapshot.currentStage || 1) || (snapshot.completedStages || []).includes(stage);
  },
  normalize(raw: any, fallbackClientId = '', fallbackTaxYear = 2025): LiveWorkflowAuthoritySnapshot {
    return {
      clientId: raw?.clientId || fallbackClientId,
      taxYear: Number(raw?.taxYear) || fallbackTaxYear,
      currentStage: Number(raw?.currentStage) || 1,
      completedStages: Array.isArray(raw?.completedStages) ? raw.completedStages : [],
      status: raw?.status || 'ACTIVE',
      loading: false,
      error: null,
      workflow: raw?.workflow ?? raw ?? null,
      eligibility: raw?.eligibility ?? null,
      stages: Array.isArray(raw?.stages) ? raw.stages : undefined,
      ...(raw || {}),
    };
  },
};
