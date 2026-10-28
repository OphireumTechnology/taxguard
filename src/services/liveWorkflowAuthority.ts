export interface LiveWorkflowAuthoritySnapshot {
  taxYear: number | null;
  activeStage: number;
  eligibleStages: number[];
  stages: Record<number, {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    unlocked: boolean;
  }>;
  lastHydratedAt?: string;
  error?: string | null;
}

type Listener = (snapshot: LiveWorkflowAuthoritySnapshot) => void;

class AuthorityService {
  private listeners: Set<Listener> = new Set();
  private snapshot: LiveWorkflowAuthoritySnapshot = {
    taxYear: 2025,
    activeStage: 1,
    eligibleStages: [1, 2, 3],
    stages: {
      1: { status: 'COMPLETED', unlocked: true },
      2: { status: 'IN_PROGRESS', unlocked: true },
      3: { status: 'NOT_STARTED', unlocked: true },
      4: { status: 'BLOCKED', unlocked: false },
      5: { status: 'BLOCKED', unlocked: false },
      6: { status: 'BLOCKED', unlocked: false }
    },
    lastHydratedAt: new Date().toISOString(),
    error: null
  };

  getSnapshot(): LiveWorkflowAuthoritySnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  canEnterStage(stage: 1 | 2 | 3): boolean {
    return this.snapshot.eligibleStages.includes(stage);
  }

  getActiveStage(): number {
    return this.snapshot.activeStage;
  }

  async hydrate(taxYear: number): Promise<LiveWorkflowAuthoritySnapshot> {
    this.snapshot = {
      ...this.snapshot,
      taxYear,
      lastHydratedAt: new Date().toISOString(),
      error: null
    };
    this.notify();
    return this.snapshot;
  }

  seedFromServerBundle(workflowBundle: any, eligibility?: any) {
    this.snapshot = {
      ...this.snapshot,
      activeStage: workflowBundle?.activeStage || this.snapshot.activeStage,
      eligibleStages: eligibility?.allowedStages || [1, 2, 3],
      lastHydratedAt: new Date().toISOString()
    };
    this.notify();
  }
}

export const LiveWorkflowAuthority = new AuthorityService();
