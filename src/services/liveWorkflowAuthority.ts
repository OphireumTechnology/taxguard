export interface LiveWorkflowAuthoritySnapshot {
  taxYear: number | null;
  activeStage: number;
  loading: boolean;
  error: string | null;
  status: string;
  eligibility?: any;
  workflow: {
    activeStage: number;
    stage1?: { status: string };
    [key: string]: any;
  };
  stages: Record<number, { eligible: boolean; completed: boolean }>;
}

export class LiveWorkflowAuthority {
  private static stage: number = 1;
  private static taxYear: number | null = 2025;
  private static loading: boolean = false;
  private static error: string | null = null;
  private static listeners: Set<(s: LiveWorkflowAuthoritySnapshot) => void> = new Set();

  static getSnapshot(): LiveWorkflowAuthoritySnapshot {
    return {
      taxYear: this.taxYear,
      activeStage: this.stage,
      loading: this.loading,
      error: this.error,
      status: 'ready',
      eligibility: {
        canEnterStage1: true,
        canEnterStage2: this.stage >= 2,
        canEnterStage3: this.stage >= 3,
        canEnter: (s: number) => this.stage >= s,
        stages: {
          1: { eligible: true },
          2: { eligible: this.stage >= 2 },
          3: { eligible: this.stage >= 3 }
        }
      },
      workflow: {
        activeStage: this.stage,
        stage1: { status: this.stage > 1 ? 'COMPLETED' : 'IN_PROGRESS' }
      },
      stages: {
        1: { eligible: true, completed: this.stage > 1 },
        2: { eligible: this.stage >= 2, completed: this.stage > 2 },
        3: { eligible: this.stage >= 3, completed: this.stage > 3 }
      }
    };
  }

  static subscribe(listener: (s: LiveWorkflowAuthoritySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach(fn => fn(snap));
  }

  static async hydrate(taxYear: number): Promise<LiveWorkflowAuthoritySnapshot> {
    this.taxYear = taxYear;
    this.notify();
    return this.getSnapshot();
  }

  static canEnterStage(stage: 1 | 2 | 3 | number): boolean {
    return this.stage >= stage;
  }

  static getActiveStage(): number {
    return this.stage;
  }

  static getCurrentStage(_clientId?: string): number {
    return this.stage;
  }

  static async completeStage(_clientId: string, stage: number): Promise<{ success: boolean; nextStage: number }> {
    this.stage = Math.max(this.stage, stage + 1);
    this.notify();
    return { success: true, nextStage: this.stage };
  }

  static async getEligibility(_clientId: string): Promise<{ eligible: boolean; stage: number }> {
    return { eligible: true, stage: this.stage };
  }

  static seedFromServerBundle(workflow?: any, eligibility?: any): void {
    if (workflow?.activeStage && typeof workflow.activeStage === 'number') {
      this.stage = workflow.activeStage;
    } else if (eligibility?.activeStage && typeof eligibility.activeStage === 'number') {
      this.stage = eligibility.activeStage;
    }
    this.notify();
  }

  static clear(): void {
    this.stage = 1;
    this.taxYear = null;
    this.loading = false;
    this.error = null;
    this.notify();
  }
}
