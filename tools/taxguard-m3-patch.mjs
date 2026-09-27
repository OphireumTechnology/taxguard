import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "App.tsx");
const BACKUP_DIR = path.join(ROOT, "backups", "m3-live-integration");
const STATE = path.join(
  ROOT,
  "tools",
  "taxguard-autonomous-dev",
  "autonomous-state.json"
);

function stop(message) {
  console.error("\n[M3 STOP] " + message);
  process.exit(1);
}

function replaceExact(source, oldText, newText, label, expectedCount = 1) {
  const parts = source.split(oldText);
  const count = parts.length - 1;

  if (count !== expectedCount) {
    stop(
      `${label}: expected ${expectedCount} exact match(es), found ${count}. ` +
      `No source file has been written.`
    );
  }

  return parts.join(newText);
}

if (!fs.existsSync(APP)) {
  stop("src/App.tsx not found.");
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(BACKUP_DIR, `App.${stamp}.tsx`);

const original = fs.readFileSync(APP, "utf8");
fs.writeFileSync(backup, original, "utf8");

console.log("[M3] Backup created:");
console.log(backup);

let source = original;

/*
 * M3-001
 * Replace the old generic intake-dashboard import with the
 * existing Stage 02 collection workspace.
 */
source = replaceExact(
  source,
  "import { ClientIntakeDashboard } from './components/portal/ClientIntakeDashboard';",
  "import { StageTwoCollectionWorkspace } from './components/collection/StageTwoCollectionWorkspace';",
  "M3-001 StageTwo workspace import"
);

/*
 * M3-002
 * Add LIVE tax-year state.
 *
 * TaxGuard uses the previous calendar year as the initial filing
 * year, while Stage 02 still allows its existing year selector
 * to change it.
 */
const appContentNeedle =
  "  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();";

const appContentReplacement =
`  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();
  const [liveTaxYear, setLiveTaxYear] = React.useState<number>(
    () => new Date().getFullYear() - 1
  );`;

source = replaceExact(
  source,
  appContentNeedle,
  appContentReplacement,
  "M3-002 LIVE tax-year state"
);

/*
 * M3-003
 * Create one fail-closed LIVE Stage 02 renderer.
 *
 * Critical rule:
 * A LIVE workspace MUST have the permanent TaxGuard Client ID.
 * We never allow StageTwoCollectionWorkspace to invent/fallback
 * to a demo/default client.
 */
const renderPageNeedle =
  "  const renderPage = () => {";

const renderPageReplacement =
`  const renderLiveStageTwo = () => {
    const permanentClientId = currentUser?.clientId?.trim();

    if (!hasLiveClientSession) {
      return <ClientLoginPage />;
    }

    if (!permanentClientId) {
      return (
        <div className="max-w-3xl mx-auto mt-8 p-6 bg-white border border-red-200 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold text-red-800">
            LIVE Workspace Locked
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            A permanent TaxGuard Client ID is required before Stage 02 can open.
            TaxGuard will not substitute DEMO data or generate a browser-side Client ID.
          </p>
        </div>
      );
    }

    if (!StageOneOnboardingService.hasPassedHardExitGate(permanentClientId)) {
      return (
        <StageOneIdentityWizard
          initialClientId={permanentClientId}
          onExitGatePassed={() => setCurrentPage('client_portal')}
          onNavigateToDashboard={() => setCurrentPage('client_portal')}
        />
      );
    }

    return (
      <StageTwoCollectionWorkspace
        clientId={permanentClientId}
        selectedTaxYear={liveTaxYear}
        onTaxYearChange={setLiveTaxYear}
        initialSubTab="checklist"
      />
    );
  };

  const renderPage = () => {`;

source = replaceExact(
  source,
  renderPageNeedle,
  renderPageReplacement,
  "M3-003 LIVE Stage 02 renderer"
);

/*
 * M3-004
 * Replace the LIVE client portal's old ClientIntakeDashboard
 * destination with the canonical Stage 02 renderer.
 */
const oldLivePortalBlock =
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

const newLivePortalBlock =
`    if (currentPage === 'client_portal' && hasLiveClientSession) {
      return renderLiveStageTwo();
    }`;

source = replaceExact(
  source,
  oldLivePortalBlock,
  newLivePortalBlock,
  "M3-004 LIVE portal Stage 02 routing"
);

/*
 * M3-005
 * Stage 01 route:
 * if Stage 01 is already complete, proceed to Stage 02.
 * Otherwise remain in Stage 01.
 */
const oldStageOneBlock =
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

const newStageOneBlock =
`    if (currentPage === 'stage_one_onboard' || currentPage === 'onboarding' || currentPage === 'client_onboarding') {
      if (hasLiveClientSession) {
        return renderLiveStageTwo();
      }

      return (
        <StageOneIdentityWizard
          onExitGatePassed={() => setCurrentPage('client_portal')}
          onNavigateToDashboard={() => setCurrentPage('client_portal')}
        />
      );
    }`;

source = replaceExact(
  source,
  oldStageOneBlock,
  newStageOneBlock,
  "M3-005 Stage 01 to Stage 02 transition"
);

/*
 * M3-006
 * Safety assertions before writing.
 */
const requiredMarkers = [
  "StageTwoCollectionWorkspace",
  "const renderLiveStageTwo = () =>",
  "const permanentClientId = currentUser?.clientId?.trim();",
  "StageOneOnboardingService.hasPassedHardExitGate(permanentClientId)",
  "clientId={permanentClientId}",
  "selectedTaxYear={liveTaxYear}",
  "onTaxYearChange={setLiveTaxYear}",
  "initialSubTab=\"checklist\""
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    stop(`Safety assertion failed: ${marker}`);
  }
}

if (source.includes("return <ClientIntakeDashboard />;")) {
  stop(
    "Old ClientIntakeDashboard LIVE routing remains. " +
    "Refusing partial M3 integration."
  );
}

fs.writeFileSync(APP, source, "utf8");

console.log("");
console.log("==============================================");
console.log(" TAXGUARD M3 SOURCE PATCH APPLIED");
console.log("==============================================");
console.log("");
console.log("Stage 01 PASS");
console.log("   ->");
console.log("Authenticated LIVE client");
console.log("   ->");
console.log("Permanent Client ID required");
console.log("   ->");
console.log("Stage 02 COLLECT");
console.log("   ->");
console.log("Existing Stage 02 hard exit gate");
console.log("   ->");
console.log("Stage 03 eligibility");
console.log("");
console.log("DEMO fallback: NOT introduced");
console.log("Client ID generation in browser: NOT introduced");
console.log("Stage 02 fake completion: NOT introduced");
console.log("External filing: unchanged / disabled");
console.log("");
console.log("Backup:");
console.log(backup);
console.log("");

fs.writeFileSync(
  path.join(ROOT, "M3_PATCH_BACKUP_PATH.txt"),
  backup,
  "utf8"
);
