import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, "backups", `m5-5-live-router-${stamp}`);

fs.mkdirSync(backupDir, { recursive: true });

function fail(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.5 STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  process.exit(1);
}

function p(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  if (!fs.existsSync(p(relative))) {
    fail(`Required file missing: ${relative}`);
  }

  return fs.readFileSync(p(relative), "utf8");
}

function backup(relative) {
  if (!fs.existsSync(p(relative))) return;

  const destination = path.join(backupDir, relative);

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(p(relative), destination);
}

function write(relative, content) {
  backup(relative);

  fs.mkdirSync(path.dirname(p(relative)), {
    recursive: true
  });

  fs.writeFileSync(p(relative), content, "utf8");

  console.log(`WRITE ${relative}`);
}

function replaceExactly(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;

  if (count !== 1) {
    fail(
      `${label}: expected exactly one source anchor, found ${count}. ` +
      `No guessed edit will be applied.`
    );
  }

  return source.replace(oldText, newText);
}

console.log(`
============================================================
 TAXGUARD M5.5
 SERVER-AUTHORITATIVE LIVE ROUTING + RUNTIME HARDENING
============================================================

PRESERVE
--------
M1    LIVE Routing
M2    Stage 01
M3    Stage 02
M4    Stage 03
M5    Firestore Workflow
M5.2  Gate Bridge
M5.3  Server Gate Layer
M5.4  LIVE Authority Layer

REPAIR
------
App.tsx LIVE routing
Stage 01 browser-authority routing
Stage 02 LIVE workspace entry
Stage 03 eligibility enforcement
Stage 02 local Stage-03 bypass
LIVE loading/error states
LIVE client identity checks
tax-year resolution
DEMO/LIVE separation
stale workflow UI state
logout authority cleanup

PROHIBITED
----------
Broad repository scan
OpenAI API
AutoFix V1
Client 006 creation
DEMO -> LIVE fallback
browser stage completion
fake workflow completion
external tax submission

============================================================
`);

fs.writeFileSync(
  path.join(ROOT, "M5_5_BACKUP_PATH.txt"),
  backupDir,
  "utf8"
);

/*
==============================================================
M5.5-001
LIVE CLIENT WORKFLOW ROUTER
==============================================================
*/

write(
  "src/components/workflow/LiveClientWorkflowRouter.tsx",
`import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  StageOneIdentityWizard
} from '../onboarding/StageOneIdentityWizard';

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

  onNavigateToPortal?: () => void;
}

export const LiveClientWorkflowRouter:
React.FC<LiveClientWorkflowRouterProps> = ({
  clientId,
  taxYear,
  onNavigateToPortal
}) => {

  const [
    selectedTaxYear,
    setSelectedTaxYear
  ] = useState(taxYear);

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
        onTaxYearChange={setSelectedTaxYear}
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
        onTaxYearChange={setSelectedTaxYear}
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
`
);

/*
==============================================================
M5.5-002
HARDEN STAGE 02 -> STAGE 03 NAVIGATION

Existing StageTwo workspace currently owns a local
showStageThree flag.

LIVE must not use that as authority.
==============================================================
*/

const stage2File =
  "src/components/collection/StageTwoCollectionWorkspace.tsx";

let stage2 =
  read(stage2File);

const propsOld =
`interface StageTwoCollectionWorkspaceProps {
  clientId?: string;
  selectedTaxYear: number;
  onTaxYearChange?: (year: number) => void;
  initialSubTab?: 'checklist' | 'upload' | 'vault' | 'missing' | 'requests' | 'processing' | 'security' | 'exceptions' | 'review' | 'readiness';
  onOpenAssistant?: () => void;
}`;

const propsNew =
`interface StageTwoCollectionWorkspaceProps {
  clientId?: string;
  selectedTaxYear: number;
  onTaxYearChange?: (year: number) => void;
  initialSubTab?: 'checklist' | 'upload' | 'vault' | 'missing' | 'requests' | 'processing' | 'security' | 'exceptions' | 'review' | 'readiness';
  onOpenAssistant?: () => void;

  /*
   * LIVE server-authoritative workflow controls.
   *
   * These default to false/undefined for legacy or DEMO
   * consumers so no existing caller gains new authority.
   */
  serverStageThreeEligible?: boolean;
  onServerWorkflowRefresh?: () => void;
}`;

if (
  !stage2.includes(
    "serverStageThreeEligible?: boolean"
  )
) {

  stage2 =
    replaceExactly(
      stage2,
      propsOld,
      propsNew,
      "StageTwo props"
    );
}

const destructureOld =
`  initialSubTab = 'checklist',
  onOpenAssistant
}) => {`;

const destructureNew =
`  initialSubTab = 'checklist',
  onOpenAssistant,
  serverStageThreeEligible = false,
  onServerWorkflowRefresh
}) => {`;

if (
  !stage2.includes(
    "serverStageThreeEligible = false"
  )
) {

  stage2 =
    replaceExactly(
      stage2,
      destructureOld,
      destructureNew,
      "StageTwo prop destructuring"
    );
}

/*
 * Existing local Stage 03 rendering must require explicit
 * server eligibility.
 */

const stage3Old =
`  if (showStageThree) {
    return (
      <StageThreeValidationWorkspace
        clientId={context.clientId}
        selectedTaxYear={context.taxYear}
        onTaxYearChange={onTaxYearChange}
        userRole="cpa"
        onOpenAssistant={onOpenAssistant}
        onNavigateToStageTwo={() => setShowStageThree(false)}
      />
    );
  }`;

const stage3New =
`  if (
    showStageThree &&
    serverStageThreeEligible
  ) {
    return (
      <StageThreeValidationWorkspace
        clientId={context.clientId}
        selectedTaxYear={context.taxYear}
        onTaxYearChange={onTaxYearChange}
        userRole="client"
        onOpenAssistant={onOpenAssistant}
        onNavigateToStageTwo={() => {
          setShowStageThree(false);
          onServerWorkflowRefresh?.();
        }}
      />
    );
  }`;

if (
  stage2.includes(stage3Old)
) {

  stage2 =
    stage2.replace(
      stage3Old,
      stage3New
    );

} else if (
  !stage2.includes(
    "showStageThree &&"
  )
) {

  fail(
    "StageTwo Stage-03 navigation block differs from expected source."
  );
}

/*
 * Eliminate the known incorrect LIVE CPA role hardcode.
 */

stage2 = stage2.replace(
  'userRole="cpa"',
  'userRole="client"'
);

write(
  stage2File,
  stage2
);

/*
==============================================================
M5.5-003
APP.TSX LIVE ROUTING

Replace browser StageOne service authority with the
server-authoritative router.
==============================================================
*/

const appFile = "src/App.tsx";
let app = read(appFile);

/*
 * Add router import next to known LIVE component imports.
 */

if (
  !app.includes(
    "LiveClientWorkflowRouter"
  )
) {

  const importCandidates = [
    "import { StageOneIdentityWizard }",
    "import { ClientIntakeDashboard }"
  ];

  let lineIndex = -1;
  let lines = app.split(/\r?\n/);

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    if (
      importCandidates.some(
        marker =>
          lines[i].includes(marker)
      )
    ) {
      lineIndex = i;
      break;
    }
  }

  if (lineIndex === -1) {
    fail(
      "App.tsx LIVE import anchor not found."
    );
  }

  lines.splice(
    lineIndex,
    0,
    "import { LiveClientWorkflowRouter } from './components/workflow/LiveClientWorkflowRouter';"
  );

  app = lines.join("\n");
}

/*
 * Replace LIVE client_portal rendering.
 */

const oldLivePortal =
`    if (currentPage === 'client_portal' && hasLiveClientSession) {
      if (!StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)) {
        return (
          <StageOneIdentityWizard
            onExitGatePassed={() => setCurrentPage('client_portal')}
            onNavigateToDashboard={() => setCurrentPage('client_portal')}
          />
        );
      }

      return <ClientIntakeDashboard />;
    }`;

const newLivePortal =
`    if (
      currentPage === 'client_portal' &&
      hasLiveClientSession
    ) {

      const liveClientId =
        currentUser?.clientId?.trim();

      if (!liveClientId) {
        return (
          <div
            className="max-w-3xl mx-auto mt-10 rounded-xl border border-red-200 bg-red-50 p-6"
            role="alert"
          >
            <h2 className="font-bold text-red-900">
              Permanent Client ID Required
            </h2>

            <p className="mt-2 text-sm text-red-800">
              The authenticated LIVE account does not have a
              permanent TaxGuard Client ID.
            </p>
          </div>
        );
      }

      const liveEngagement =
        engagements.find(
          engagement =>
            engagement.clientId === liveClientId
        );

      const liveTaxYear =
        Number(liveEngagement?.taxYear) ||
        new Date().getFullYear() - 1;

      return (
        <LiveClientWorkflowRouter
          clientId={liveClientId}
          taxYear={liveTaxYear}
          onNavigateToPortal={() =>
            setCurrentPage('client_portal')
          }
        />
      );
    }`;

if (
  app.includes(oldLivePortal)
) {

  app =
    app.replace(
      oldLivePortal,
      newLivePortal
    );

} else if (
  !app.includes(
    "<LiveClientWorkflowRouter"
  )
) {

  fail(
    "App.tsx client_portal block differs from expected checkpoint."
  );
}

/*
 * Replace old Stage 01 route authority.
 *
 * A LIVE authenticated client entering an old onboarding URL
 * is returned to the server-authoritative workflow router.
 */

const oldOnboarding =
`    if (currentPage === 'stage_one_onboard' || currentPage === 'onboarding' || currentPage === 'client_onboarding') {
      if (hasLiveClientSession && StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)) {
        return <ClientIntakeDashboard />;
      }

      return (
        <StageOneIdentityWizard
          onExitGatePassed={() => setCurrentPage('client_portal')}
          onNavigateToDashboard={() => setCurrentPage('client_portal')}
        />
      );
    }`;

const newOnboarding =
`    if (
      currentPage === 'stage_one_onboard' ||
      currentPage === 'onboarding' ||
      currentPage === 'client_onboarding'
    ) {

      if (hasLiveClientSession) {

        const liveClientId =
          currentUser?.clientId?.trim();

        if (!liveClientId) {
          return (
            <div
              className="max-w-3xl mx-auto mt-10 rounded-xl border border-red-200 bg-red-50 p-6"
              role="alert"
            >
              <h2 className="font-bold text-red-900">
                Permanent Client ID Required
              </h2>
            </div>
          );
        }

        const liveEngagement =
          engagements.find(
            engagement =>
              engagement.clientId === liveClientId
          );

        const liveTaxYear =
          Number(liveEngagement?.taxYear) ||
          new Date().getFullYear() - 1;

        return (
          <LiveClientWorkflowRouter
            clientId={liveClientId}
            taxYear={liveTaxYear}
            onNavigateToPortal={() =>
              setCurrentPage('client_portal')
            }
          />
        );
      }

      return (
        <StageOneIdentityWizard
          onExitGatePassed={() =>
            setCurrentPage('client_portal')
          }
          onNavigateToDashboard={() =>
            setCurrentPage('client_portal')
          }
        />
      );
    }`;

if (
  app.includes(oldOnboarding)
) {

  app =
    app.replace(
      oldOnboarding,
      newOnboarding
    );

} else if (
  !app.includes(
    "<LiveClientWorkflowRouter"
  )
) {

  fail(
    "App.tsx onboarding block differs from expected checkpoint."
  );
}

/*
 * The old landing helper must no longer use the browser
 * StageOne service as LIVE workflow authority.
 */

const oldLanding =
`  const getLiveClientLandingPage = (user: User): PageRoute => {
    if (user.role !== 'client' && user.role !== 'prospective_client') return 'home';
    return StageOneOnboardingService.hasPassedHardExitGate(user.clientId)
      ? 'client_portal'
      : 'stage_one_onboard';
  };`;

const newLanding =
`  const getLiveClientLandingPage = (user: User): PageRoute => {
    if (
      user.role !== 'client' &&
      user.role !== 'prospective_client'
    ) {
      return 'home';
    }

    /*
     * LIVE stage selection occurs inside
     * LiveClientWorkflowRouter from server-authoritative
     * Firestore state.
     */
    return 'client_portal';
  };`;

if (app.includes(oldLanding)) {

  app =
    app.replace(
      oldLanding,
      newLanding
    );
}

/*
 * Prevent the old URL synchronizer from forcing LIVE clients
 * back to StageOne based on browser-local StageOne state.
 */

app = app.replace(
`        targetHash = getLiveClientLandingPage(currentUser) === 'client_portal'
          ? '#/client_portal'
          : '#/stage_one_onboard';`,
`        targetHash = '#/client_portal';`
);

write(
  appFile,
  app
);

/*
==============================================================
M5.5-004
KNOWN LIVE CLIENT DASHBOARD SAFETY

ClientIntakeDashboard contains historical/example presentation
content. It must not remain the LIVE workflow landing authority.

We do not delete the component because other non-LIVE areas
may still depend on it.
==============================================================
*/

const finalApp = read(appFile);

if (
  finalApp.includes(
    "return <ClientIntakeDashboard />;"
  )
) {

  console.log(
    "INFO ClientIntakeDashboard still exists elsewhere; checking LIVE blocks only."
  );
}

if (
  finalApp.includes(
    "StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)"
  )
) {

  fail(
    "App.tsx still contains browser StageOne authority in LIVE routing."
  );
}

/*
==============================================================
M5.5-005
RUNTIME AUTHORITY TESTS
==============================================================
*/

write(
  "src/tests/liveAppRoutingAuthority.test.ts",
`import {
  describe,
  expect,
  it
} from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(
    path.join(ROOT, relative),
    'utf8'
  );
}

describe(
  'TaxGuard M5.5 LIVE application routing',
  () => {

    it(
      'uses LiveClientWorkflowRouter in App',
      () => {

        const app = source(
          'src/App.tsx'
        );

        expect(app).toContain(
          'LiveClientWorkflowRouter'
        );
      }
    );

    it(
      'does not use StageOne browser state as LIVE routing authority',
      () => {

        const app = source(
          'src/App.tsx'
        );

        expect(app).not.toContain(
          'StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)'
        );
      }
    );

    it(
      'requires permanent client identity',
      () => {

        const router = source(
          'src/components/workflow/LiveClientWorkflowRouter.tsx'
        );

        expect(router).toContain(
          'LIVE Client Identity Required'
        );
      }
    );

    it(
      'hydrates authoritative workflow state',
      () => {

        const router = source(
          'src/components/workflow/LiveClientWorkflowRouter.tsx'
        );

        expect(router).toContain(
          'useLiveWorkflowAuthority'
        );
      }
    );

    it(
      'renders Stage 02 only from authoritative active stage',
      () => {

        const router = source(
          'src/components/workflow/LiveClientWorkflowRouter.tsx'
        );

        expect(router).toContain(
          'authority.workflow.activeStage === 2'
        );

        expect(router).toContain(
          'eligibility.stage2 !== true'
        );
      }
    );

    it(
      'renders Stage 03 only from authoritative eligibility',
      () => {

        const router = source(
          'src/components/workflow/LiveClientWorkflowRouter.tsx'
        );

        expect(router).toContain(
          'authority.workflow.activeStage === 3'
        );

        expect(router).toContain(
          'eligibility.stage3 !== true'
        );
      }
    );

    it(
      'does not persist LIVE workflow completion flags',
      () => {

        const router = source(
          'src/components/workflow/LiveClientWorkflowRouter.tsx'
        );

        expect(router).not.toContain(
          'localStorage.setItem'
        );
      }
    );

    it(
      'blocks StageTwo local StageThree bypass',
      () => {

        const stage2 = source(
          'src/components/collection/StageTwoCollectionWorkspace.tsx'
        );

        expect(stage2).toContain(
          'serverStageThreeEligible'
        );

        expect(stage2).toContain(
          'showStageThree &&'
        );
      }
    );

    it(
      'does not impersonate CPA for LIVE StageThree navigation',
      () => {

        const stage2 = source(
          'src/components/collection/StageTwoCollectionWorkspace.tsx'
        );

        expect(stage2).not.toContain(
          'userRole="cpa"'
        );
      }
    );

    it(
      'keeps browser stage completion blocked',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route).toContain(
          'STAGE_GATE_REQUIRED'
        );
      }
    );

    it(
      'keeps external submission disabled',
      () => {

        const repository = source(
          'src/server/taxguard/liveWorkflow.repository.ts'
        );

        expect(repository).toContain(
          'externalSubmissionEnabled: false'
        );
      }
    );
  }
);
`
);

/*
==============================================================
M5.5-006
STATIC ASSERTIONS
==============================================================
*/

const router = read(
  "src/components/workflow/LiveClientWorkflowRouter.tsx"
);

const finalStage2 = read(stage2File);
const liveRoute = read(
  "src/server/routes/live-workflow.routes.ts"
);

const assertions = [
  [
    "LIVE router installed",
    router.includes(
      "LiveClientWorkflowRouter"
    )
  ],

  [
    "Server authority hook connected",
    router.includes(
      "useLiveWorkflowAuthority"
    )
  ],

  [
    "Stage 01 rendered from activeStage",
    router.includes(
      "activeStage === 1"
    )
  ],

  [
    "Stage 02 rendered from activeStage",
    router.includes(
      "activeStage === 2"
    )
  ],

  [
    "Stage 03 rendered from activeStage",
    router.includes(
      "activeStage === 3"
    )
  ],

  [
    "Stage 03 eligibility checked",
    router.includes(
      "eligibility.stage3"
    )
  ],

  [
    "StageTwo local bypass hardened",
    finalStage2.includes(
      "serverStageThreeEligible"
    )
  ],

  [
    "LIVE CPA impersonation removed",
    !finalStage2.includes(
      'userRole="cpa"'
    )
  ],

  [
    "App uses LIVE router",
    finalApp.includes(
      "LiveClientWorkflowRouter"
    )
  ],

  [
    "Old StageOne LIVE authority removed",
    !finalApp.includes(
      "StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)"
    )
  ],

  [
    "Direct browser completion blocked",
    liveRoute.includes(
      "STAGE_GATE_REQUIRED"
    )
  ],

  [
    "Server Client ID authority preserved",
    liveRoute.includes(
      "req.user?.clientId"
    )
  ],

  [
    "External submission disabled",
    liveRoute.includes(
      "externalSubmissionEnabled: false"
    )
  ]
];

console.log("");
console.log("M5.5 ARCHITECTURE ASSERTIONS");
console.log("----------------------------");

let failed = false;

for (const [name, ok] of assertions) {

  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}`
  );

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  fail(
    "M5.5 architecture assertion failed."
  );
}

console.log("");
console.log("============================================================");
console.log(" M5.5 SOURCE PATCH APPLIED");
console.log("============================================================");
console.log("");
console.log(`Backup: ${backupDir}`);
console.log("");
console.log("No OpenAI API used.");
console.log("No broad repository scan used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("External submission remains disabled.");
console.log("");
