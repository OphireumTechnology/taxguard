import { StageOneIdentityWizard } from '../portal/StageOneIdentityWizard';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';



import {
  StageTwoCollectionWorkspace
} from '../collection/StageTwoCollectionWorkspace';

import {
  StageThreeValidationWorkspace
} from '../validation/StageThreeValidationWorkspace';

import {
  useLiveWorkflowAuthority
} from '../../hooks/useLiveWorkflowAuthority';

import {
  guardLiveWorkflowStage
} from '../../services/liveWorkflowRouteGuard';

interface LiveClientWorkflowRouterProps {
  clientId: string;
  taxYear: number;
  onTaxYearChange?: (year: number) => void;

  onNavigateToPortal?: () => void;
}

export const LiveClientWorkflowRouter:
React.FC<LiveClientWorkflowRouterProps> = ({
  clientId,
  taxYear,
  onTaxYearChange: externalTaxYearChange,
  onNavigateToPortal
}) => {

  const [
    selectedTaxYear,
    setSelectedTaxYear
  ] = useState(taxYear);

  const handleTaxYearChange =
      (year: number) => {
        setSelectedTaxYear(year);
        externalTaxYearChange?.(year);
      };

  const authority =
    useLiveWorkflowAuthority(
      selectedTaxYear
    );

  /*
   * When a trusted stage gate succeeds, refresh the
   * authoritative Firestore state.
   *
   * The browser does NOT mark a stage complete itself.
   */
  const refreshAuthority =
    useCallback(() => {

      authority
        .refresh()
        .catch(() => {
          /*
           * Fail closed.
           * Error state is handled below.
           */
        });

    }, [authority.refresh]);

  useEffect(() => {

    /*
     * Clear any legacy workflow-completion hints that could
     * be mistaken for LIVE authority.
     *
     * Authentication/session storage is intentionally
     * preserved.
     */
    const legacyKeys = [
      'taxguard_stage',
      'taxguard_active_stage',
      'stageOneCompleted',
      'stageTwoCompleted',
      'stageThreeCompleted',
      'stage_one_completed',
      'stage_two_completed',
      'stage_three_completed'
    ];

    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }

  }, []);

  const activeStage =
    authority.activeStage;

  const routeDecision =
    useMemo(() => {

      if (!activeStage) {
        return null;
      }

      return guardLiveWorkflowStage(
        {
          status: authority.status,
          taxYear: authority.taxYear,
          workflow: authority.workflow,
          eligibility: authority.eligibility,
          error: authority.error
        },
        activeStage
      );

    }, [
      activeStage,
      authority.status,
      authority.taxYear,
      authority.workflow,
      authority.eligibility,
      authority.error
    ]);

  if (
    !clientId ||
    !clientId.trim()
  ) {

    return (
      <div
        className="max-w-3xl mx-auto mt-10 rounded-xl border border-red-200 bg-red-50 p-6"
        role="alert"
      >
        <h2 className="font-bold text-red-900">
          LIVE Client Identity Required
        </h2>

        <p className="mt-2 text-sm text-red-800">
          A permanent TaxGuard Client ID is required before
          the LIVE workflow can be opened.
        </p>
      </div>
    );
  }

  if (
    authority.status === 'idle' ||
    authority.status === 'loading'
  ) {

    return (
      <div
        className="max-w-3xl mx-auto mt-10 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        aria-live="polite"
      >
        <h2 className="font-semibold text-slate-900">
          Loading TaxGuard LIVE Workspace
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Verifying your server-authoritative workflow state.
        </p>
      </div>
    );
  }

  if (
    authority.status === 'error' ||
    !authority.workflow ||
    !authority.eligibility
  ) {

    return (
      <div
        className="max-w-3xl mx-auto mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6"
        role="alert"
      >
        <h2 className="font-bold text-amber-900">
          LIVE Workflow Temporarily Unavailable
        </h2>

        <p className="mt-2 text-sm text-amber-800">
          {authority.error ||
            'Authoritative workflow state could not be verified.'}
        </p>

        <button
          type="button"
          onClick={refreshAuthority}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry Secure Sync
        </button>
      </div>
    );
  }

  if (
    routeDecision &&
    routeDecision.allowed === false
  ) {

    return (
      <div
        className="max-w-3xl mx-auto mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6"
        role="alert"
      >
        <h2 className="font-bold text-amber-900">
          Workflow Stage Locked
        </h2>

        <p className="mt-2 text-sm text-amber-800">
          {routeDecision.reason}
        </p>

        <button
          type="button"
          onClick={refreshAuthority}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Refresh Workflow
        </button>
      </div>
    );
  }

  /*
   * Stage 01
   */

  if (
    authority.workflow.activeStage === 1
  ) {

    return (
      <StageOneIdentityWizard
        initialClientId={clientId}
        onExitGatePassed={refreshAuthority}
        onNavigateToDashboard={refreshAuthority}
      />
    );
  }

  /*
   * Stage 02
   */

  if (
    authority.workflow.activeStage === 2
  ) {

    if (
      authority.eligibility
        .eligibility.stage2 !== true
    ) {

      return (
        <div
          className="max-w-3xl mx-auto mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6"
          role="alert"
        >
          <h2 className="font-bold text-amber-900">
            Stage 02 Locked
          </h2>

          <p className="mt-2 text-sm text-amber-800">
            The server has not authorized Stage 02.
          </p>
        </div>
      );
    }

    return (
      <StageTwoCollectionWorkspace
        clientId={clientId}
        selectedTaxYear={selectedTaxYear}
        onTaxYearChange={handleTaxYearChange}
        serverStageThreeEligible={
          authority.eligibility
            .eligibility.stage3 === true
        }
        onServerWorkflowRefresh={
          refreshAuthority
        }
      />
    );
  }

  /*
   * Stage 03
   */

  if (
    authority.workflow.activeStage === 3
  ) {

    if (
      authority.eligibility
        .eligibility.stage3 !== true
    ) {

      return (
        <div
          className="max-w-3xl mx-auto mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6"
          role="alert"
        >
          <h2 className="font-bold text-amber-900">
            Stage 03 Locked
          </h2>

          <p className="mt-2 text-sm text-amber-800">
            Stage 03 has not been authorized by the
            server workflow.
          </p>
        </div>
      );
    }

    return (
      <StageThreeValidationWorkspace
        clientId={clientId}
        selectedTaxYear={selectedTaxYear}
        onTaxYearChange={handleTaxYearChange}
        userRole="client"
        onNavigateToStageTwo={refreshAuthority}
      />
    );
  }

  /*
   * Fail closed for an unknown server stage.
   */

  return (
    <div
      className="max-w-3xl mx-auto mt-10 rounded-xl border border-red-200 bg-red-50 p-6"
      role="alert"
    >
      <h2 className="font-bold text-red-900">
        Unsupported Workflow State
      </h2>

      <p className="mt-2 text-sm text-red-800">
        TaxGuard received an unsupported workflow stage.
        No later stage has been unlocked.
      </p>

      {onNavigateToPortal && (
        <button
          type="button"
          onClick={onNavigateToPortal}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Return to Client Portal
        </button>
      )}
    </div>
  );
};
