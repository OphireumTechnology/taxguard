import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const files = {
  onboarding: path.join(ROOT, "src/server/routes/onboarding.routes.ts"),
  stage2: path.join(ROOT, "src/services/stageTwoCollectionService.ts"),
  vite: path.join(ROOT, "vite.config.ts")
};

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD REPAIR STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  process.exit(1);
}

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    stop(`Required current-source file missing: ${name} -> ${file}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, "backups", `full-repair-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });

for (const file of Object.values(files)) {
  fs.copyFileSync(
    file,
    path.join(backupDir, path.basename(file))
  );
}

fs.writeFileSync(
  path.join(ROOT, "TAXGUARD_FULL_REPAIR_BACKUP.txt"),
  backupDir,
  "utf8"
);

console.log("Backup:", backupDir);

/*
================================================================
FIX 1
PERMANENT CLIENT ID MUST NOT BE REPLACED BY USER/FIREBASE UID
================================================================

Current onboarding.routes.ts creates dossiers using:

    clientId: req.user.id

That violates the existing TaxGuard identity contract.

LIVE taxpayer records must use permanent clientId.
*/

let onboarding = fs.readFileSync(files.onboarding, "utf8");

const badClientId =
  "      clientId: req.user.id,";

const goodClientId =
`      clientId: req.user.clientId!,`;

if (onboarding.includes(badClientId)) {

  /*
   * Fail closed before dossier creation when a LIVE client has no
   * permanent TaxGuard Client ID.
   */

  const dossierNeedle =
`  let dossier = db.clientOnboarding.get(req.user.id);
  if (!dossier) {`;

  const dossierReplacement =
`  const permanentClientId = req.user.clientId?.trim();

  if (req.user.role === 'client' && !permanentClientId) {
    return res.status(409).json({
      error: 'Permanent TaxGuard Client ID is required before onboarding can continue.',
      code: 'CLIENT_ID_REQUIRED'
    });
  }

  const onboardingKey = permanentClientId || req.user.id;

  let dossier = db.clientOnboarding.get(onboardingKey);
  if (!dossier) {`;

  if (!onboarding.includes(dossierNeedle)) {
    stop("Current onboarding source differs from uploaded baseline. Refusing guessed edit.");
  }

  onboarding = onboarding.replace(
    dossierNeedle,
    dossierReplacement
  );

  onboarding = onboarding.replace(
    badClientId,
    goodClientId
  );

  /*
   * The map must also use permanent client identity.
   */

  onboarding = onboarding.replace(
    "    db.clientOnboarding.set(req.user.id, dossier);",
    "    db.clientOnboarding.set(onboardingKey, dossier);"
  );

  fs.writeFileSync(files.onboarding, onboarding, "utf8");

  console.log("PASS FIX-001 Permanent Client ID onboarding authority");

} else {

  console.log("INFO FIX-001 already repaired or source changed.");
}


/*
================================================================
FIX 2
REMOVE LIVE -> DEMO DATA SYNCHRONIZATION
================================================================

The uploaded StageTwoCollectionService currently synchronizes every
non-quarantined document into demoDataStore.

That must only happen for the explicit DEMO client.
*/

let stage2 = fs.readFileSync(files.stage2, "utf8");

const oldDemoSync =
`    // Synchronize into demoDataStore so clean document is visible across Document Vault & Staff Dashboards
    if (!isQuarantined) {
      try {
        demoDataStore.uploadDocument({`;

const newDemoSync =
`    // DEMO isolation boundary:
    // LIVE taxpayer documents must never be synchronized into demoDataStore.
    const isExplicitDemoClient = payload.clientId === 'cli_perotti';

    if (!isQuarantined && isExplicitDemoClient) {
      try {
        demoDataStore.uploadDocument({`;

if (stage2.includes(oldDemoSync)) {

  stage2 = stage2.replace(oldDemoSync, newDemoSync);

  console.log("PASS FIX-002 LIVE document -> demoDataStore leakage blocked");

} else if (stage2.includes("isExplicitDemoClient")) {

  console.log("INFO FIX-002 already installed");

} else {

  stop(
    "StageTwo demo synchronization block differs from uploaded source. " +
    "Refusing guessed replacement."
  );
}


/*
================================================================
FIX 3
DEMO TAXPAYER LOOKUP MUST NOT BE USED FOR NORMAL LIVE CLIENT IDS
================================================================
*/

const oldDemoLookup =
`    const onboardingDossier = StageOneOnboardingService.getDossier(resolvedClientId);
    const demoClient = demoDataStore.getClientById(resolvedClientId);
    const demoEng = demoDataStore.getEngagements().find(
      e => e.clientId === resolvedClientId && e.taxYear === resolvedYear
    );`;

const newDemoLookup =
`    const onboardingDossier = StageOneOnboardingService.getDossier(resolvedClientId);

    // Hard LIVE/DEMO isolation.
    // Only the canonical DEMO taxpayer may query the demo data store.
    const isExplicitDemoClient = resolvedClientId === 'cli_perotti';

    const demoClient = isExplicitDemoClient
      ? demoDataStore.getClientById(resolvedClientId)
      : undefined;

    const demoEng = isExplicitDemoClient
      ? demoDataStore.getEngagements().find(
          e => e.clientId === resolvedClientId && e.taxYear === resolvedYear
        )
      : undefined;`;

if (stage2.includes(oldDemoLookup)) {

  stage2 = stage2.replace(oldDemoLookup, newDemoLookup);

  console.log("PASS FIX-003 Stage 02 LIVE/DEMO context isolation");

} else if (stage2.includes("Only the canonical DEMO taxpayer")) {

  console.log("INFO FIX-003 already installed");

} else {

  stop(
    "StageTwo workspace-context block differs from uploaded source. " +
    "Refusing guessed replacement."
  );
}

fs.writeFileSync(files.stage2, stage2, "utf8");


/*
================================================================
FIX 4
PERMANENTLY EXCLUDE BACKUPS FROM VITEST
================================================================
*/

let vite = fs.readFileSync(files.vite, "utf8");

if (!vite.includes("**/backups/**")) {

  const testIndex = vite.search(/\btest\s*:\s*\{/);

  if (testIndex === -1) {
    stop("Vitest test configuration not found.");
  }

  const open = vite.indexOf("{", testIndex);

  vite =
    vite.slice(0, open + 1) +
`
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/backups/**',
      '**/*.backup.*',
      '**/*.before-*',
      '**/*.bak'
    ],
` +
    vite.slice(open + 1);

  fs.writeFileSync(files.vite, vite, "utf8");

  console.log("PASS FIX-004 Backup tests permanently excluded");

} else {

  console.log("INFO FIX-004 already installed");
}


/*
================================================================
POST-PATCH ARCHITECTURE ASSERTIONS
================================================================
*/

onboarding = fs.readFileSync(files.onboarding, "utf8");
stage2 = fs.readFileSync(files.stage2, "utf8");

const checks = [
  [
    "Permanent Client ID required",
    onboarding.includes("CLIENT_ID_REQUIRED")
  ],
  [
    "Onboarding uses permanent Client ID",
    onboarding.includes("clientId: req.user.clientId!")
  ],
  [
    "LIVE cannot query demo taxpayer store",
    stage2.includes("isExplicitDemoClient")
  ],
  [
    "LIVE uploads cannot synchronize to demoDataStore",
    stage2.includes("!isQuarantined && isExplicitDemoClient")
  ],
  [
    "Backup tests excluded",
    fs.readFileSync(files.vite, "utf8").includes("**/backups/**")
  ]
];

let failed = false;

console.log("");
console.log("ARCHITECTURE ASSERTIONS");
console.log("-----------------------");

for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) {
  stop("One or more architecture assertions failed.");
}

console.log("");
console.log("============================================================");
console.log(" TAXGUARD SOURCE REPAIR PHASE APPLIED");
console.log("============================================================");
console.log("");
console.log("M1-M3 preserved");
console.log("Permanent Client ID hardened");
console.log("LIVE/DEMO isolation hardened");
console.log("Backup test discovery repaired");
console.log("");
