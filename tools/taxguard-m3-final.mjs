import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.tsx");

if (!fs.existsSync(appPath)) {
  console.error("STOP: src/App.tsx not found.");
  process.exit(1);
}

const original = fs.readFileSync(appPath, "utf8");
let source = original;

const backupDir = path.join(root, "backups", "m3-final-routing");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `App.${stamp}.tsx`);

fs.writeFileSync(backupPath, original, "utf8");
fs.writeFileSync(
  path.join(root, "M3_FINAL_BACKUP.txt"),
  backupPath,
  "utf8"
);

function replaceOne(oldText, newText, label) {
  const count = source.split(oldText).length - 1;

  if (count !== 1) {
    console.error(`STOP: ${label}`);
    console.error(`Expected 1 exact match; found ${count}.`);
    console.error("App.tsx was NOT modified.");
    process.exit(1);
  }

  source = source.replace(oldText, newText);
  console.log(`PASS ${label}`);
}

/*
  1. Replace ClientIntakeDashboard import with Stage 02.
*/
replaceOne(
  "import { ClientIntakeDashboard } from './components/portal/ClientIntakeDashboard';",
  "import { StageTwoCollectionWorkspace } from './components/collection/StageTwoCollectionWorkspace';",
  "M3-001 Stage 02 import"
);

/*
  2. Add tax-year state.
*/
replaceOne(
  "  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();",
  `  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();
  const [liveTaxYear, setLiveTaxYear] = React.useState<number>(
    () => new Date().getFullYear() - 1
  );`,
  "M3-002 LIVE tax year"
);

/*
  3. Replace LIVE client portal destination.
*/
replaceOne(
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
    }`,
`    if (currentPage === 'client_portal' && hasLiveClientSession) {
      const permanentClientId = currentUser?.clientId?.trim();

      if (!permanentClientId) {
        return (
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-red-800">
              LIVE Workspace Locked
            </h2>

            <p className="mt-2 text-sm text-slate-700">
              A permanent TaxGuard Client ID is required before Stage 02 can open.
              TaxGuard will not substitute DEMO data or create a browser-side Client ID.
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
    }`,
  "M3-003 LIVE Client -> Stage 02"
);

/*
  4. Replace Stage-One-complete fallback.
*/
replaceOne(
`      if (hasLiveClientSession && StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)) {
        return <ClientIntakeDashboard />;
      }`,
`      if (hasLiveClientSession && StageOneOnboardingService.hasPassedHardExitGate(currentUser?.clientId)) {
        const permanentClientId = currentUser?.clientId?.trim();

        if (!permanentClientId) {
          return <ClientLoginPage />;
        }

        return (
          <StageTwoCollectionWorkspace
            clientId={permanentClientId}
            selectedTaxYear={liveTaxYear}
            onTaxYearChange={setLiveTaxYear}
            initialSubTab="checklist"
          />
        );
      }`,
  "M3-004 Stage 01 PASS -> Stage 02"
);

/*
  Safety checks before writing.
*/
const required = [
  "StageTwoCollectionWorkspace",
  "clientId={permanentClientId}",
  "selectedTaxYear={liveTaxYear}",
  "onTaxYearChange={setLiveTaxYear}",
  "StageOneOnboardingService.hasPassedHardExitGate(permanentClientId)"
];

for (const marker of required) {
  if (!source.includes(marker)) {
    console.error(`STOP: Missing required marker: ${marker}`);
    process.exit(1);
  }
}

if (source.includes("return <ClientIntakeDashboard />;")) {
  console.error("STOP: Old LIVE ClientIntakeDashboard routing remains.");
  process.exit(1);
}

fs.writeFileSync(appPath, source, "utf8");

console.log("");
console.log("============================================");
console.log(" M3 ROUTING PATCH APPLIED");
console.log("============================================");
console.log("Backup:");
console.log(backupPath);
console.log("");
console.log("LIVE Client");
console.log("  -> Permanent Client ID");
console.log("  -> Stage 01 hard gate");
console.log("  -> Stage 02 COLLECT");
console.log("  -> Stage 02 hard gate");
console.log("  -> Stage 03 eligibility");
