import {
  LiveWorkflowApi,
  LiveWorkflowEligibility,
  LiveWorkflowState
} from './liveWorkflowApi';

export type LiveWorkflowAuthorityStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface LiveWorkflowAuthoritySnapshot {
  status: LiveWorkflowAuthorityStatus;

  taxYear: number | null;

  workflow: LiveWorkflowState | null;

  eligibility: LiveWorkflowEligibility | null;

  error: string | null;
}

type Listener =
  (snapshot: LiveWorkflowAuthoritySnapshot) => void;

let snapshot: LiveWorkflowAuthoritySnapshot = {
  status: 'idle',
  taxYear: null,
  workflow: null,
  eligibility: null,
  error: null
};

const listeners = new Set<Listener>();

function publish(): void {
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function update(
  patch: Partial<LiveWorkflowAuthoritySnapshot>
): void {

  snapshot = {
    ...snapshot,
    ...patch
  };

  publish();
}

export class LiveWorkflowAuthority {

  static getSnapshot():
    LiveWorkflowAuthoritySnapshot {

    return snapshot;
  }

  static subscribe(
    listener: Listener
  ): () => void {

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  static seedFromServerBundle(
    workflow: LiveWorkflowState,
    eligibility: LiveWorkflowEligibility
  ): LiveWorkflowAuthoritySnapshot {
    if (
      workflow &&
      eligibility &&
      workflow.clientId === eligibility.clientId &&
      workflow.taxYear === eligibility.taxYear &&
      workflow.revision === eligibility.revision
    ) {
      update({
        status: 'ready',
        taxYear: workflow.taxYear,
        workflow,
        eligibility,
        error: null
      });
    }
    return snapshot;
  }

  static async hydrate(
    taxYear: number
  ): Promise<LiveWorkflowAuthoritySnapshot> {
    const hadSeededReadyState =
      snapshot.status === 'ready' &&
      snapshot.taxYear === taxYear &&
      Boolean(snapshot.workflow) &&
      Boolean(snapshot.eligibility);

    if (!hadSeededReadyState) {
      update({
        status: 'loading',
        taxYear,
        error: null
      });
    }

    try {
      let workflow: LiveWorkflowState;
      let eligibility: LiveWorkflowEligibility;

      try {
        const bundle = await LiveWorkflowApi.getScopedWorkflowBundle(taxYear);
        workflow = bundle.workflow;
        eligibility = bundle.eligibility;
      } catch {
        const [wf, elig] = await Promise.all([
          LiveWorkflowApi.getState(taxYear),
          LiveWorkflowApi.getEligibility(taxYear)
        ]);
        workflow = wf;
        eligibility = elig;
      }

      if (
        workflow.clientId !==
        eligibility.clientId
      ) {
        throw new Error(
          'LIVE workflow identity mismatch.'
        );
      }

      if (
        workflow.taxYear !==
        eligibility.taxYear
      ) {
        throw new Error(
          'LIVE workflow tax-year mismatch.'
        );
      }

      if (
        workflow.revision !==
        eligibility.revision
      ) {
        /*
         * Fail closed instead of trusting stale UI state.
         */
        throw new Error(
          'LIVE workflow revision changed. Refresh required.'
        );
      }

      update({
        status: 'ready',
        taxYear,
        workflow,
        eligibility,
        error: null
      });

      return snapshot;

    } catch (error) {
      if (hadSeededReadyState && snapshot.workflow && snapshot.eligibility) {
        return snapshot;
      }

      update({
        status: 'error',

        workflow: null,
        eligibility: null,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to hydrate LIVE workflow.'
      });

      throw error;
    }
  }

  static clear(): void {

    /*
     * Memory-only cleanup.
     *
     * No authoritative LIVE workflow state is written
     * to browser storage.
     */

    snapshot = {
      status: 'idle',
      taxYear: null,
      workflow: null,
      eligibility: null,
      error: null
    };

    publish();
  }

  static canEnterStage(
    stage: 1 | 2 | 3
  ): boolean {

    if (
      snapshot.status !== 'ready' ||
      !snapshot.eligibility
    ) {
      return false;
    }

    if (stage === 1) {
      return snapshot.eligibility
        .eligibility.stage1;
    }

    if (stage === 2) {
      return snapshot.eligibility
        .eligibility.stage2;
    }

    return snapshot.eligibility
      .eligibility.stage3;
  }

  static getActiveStage():
    1 | 2 | 3 | null {

    if (
      snapshot.status !== 'ready' ||
      !snapshot.workflow
    ) {
      return null;
    }

    return snapshot.workflow.activeStage;
  }
}
