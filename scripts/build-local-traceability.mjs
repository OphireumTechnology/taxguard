// Offline documentation inventory. Reads only explicit workspace documentation/source roots; no env or network.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const rows = [];
const add = (id, requirement, status, implementation, tests, remaining) => rows.push({ id, requirement, status, implementation, tests, remaining });
const valid = 'IMPLEMENTED AND VALIDATED';
const missing = 'MISSING OR INCOMPLETE';
const infra = 'REQUIRES EXTERNAL INFRASTRUCTURE';
const policy = 'REQUIRES HUMAN POLICY OR REGULATORY APPROVAL';
const synthetic = 'SAFE TO DEVELOP WITH SYNTHETIC DATA';
const insufficient = 'IMPLEMENTED BUT INSUFFICIENTLY TESTED';
const canonical = fs.readFileSync(path.join(root, 'docs/taxguard-ai-canonical-architecture.md'), 'utf8');
const identities = [...canonical.matchAll(/^\| (A\d\d) \| ([^|]+) \| ([^|]+) \| DRAFT \| ([^|]+) \|$/gm)];
if (identities.length !== 61) throw new Error('Canonical identity coverage changed; review traceability');
for (const [, id, name] of identities) {
  add(`AGENT-${id}`, `${id} ${name.trim()}`, ['A00', 'A10', 'A34'].includes(id) ? missing : policy,
    ['src/ai/registry.ts', 'src/ai/architectureMapping.ts', ...(
      id === 'A00' ? ['src/server/ai/orchestration/A00Orchestrator.ts'] : id === 'A10' ? ['src/server/ai/documents/DocumentDuplicateAdvisory.ts'] : id === 'A34' ? ['src/server/ai/review/HumanProposalReviewService.ts'] : [])],
    ['src/tests/aiArchitectureMapping.test.ts', 'src/tests/aiGovernanceControlPlane.test.ts', ...(
      id === 'A00' ? ['src/tests/aiA00Orchestration.test.ts'] : id === 'A10' ? ['src/tests/aiDocumentDuplicateAdvisory.test.ts'] : id === 'A34' ? ['src/tests/aiHumanProposalReview.test.ts'] : [])],
    ['A00', 'A10', 'A34'].includes(id) ? 'Only bounded compatibility is built; specialist completeness and commissioned production execution are absent. All deployments remain DRAFT.' : 'Inert identity/negative denial coverage only. Per-ID responsibility, stages, data/tool/evidence mapping require authoritative policy; no specialist handler or grants.');
}
const numbers = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen'];
const names = ['Onboard','Collect','Validate','Record','Reconcile','Review','Report','Plan','Prepare Taxes','Approve','Sign','File','Government Feedback','Resolve','Monitor','Archive','Renew','Repeat'];
const dependencies = [
  'Durable commissioning and approved consent sufficiency; dossier/provenance projections do not establish identity verification.',
  'Verified private intake/vault and clean malware transport; quarantine must remain closed.',
  'Authorized vault retrieval, verified OCR transport, independent fact review; duplicates are metadata advisory only.',
  'Reviewed-fact adapter, lineage, authorized record operation; AI-16 writes remain denied.',
  'Durable ledger/reconciliation adapter and independent human reconciliation controls.',
  'Durable professional decisions, source/calculation/form lineage and separate human review.',
  'Verified period/journal/return reporting and history adapter.',
  'Reviewed facts, applicable authoritative rules and commissioned advisory policy.',
  'Reviewed fact/rule binding and individually authorized preparation specialists.',
  'Exact material action/target/evidence/idempotency and independent PREPARER -> REVIEWER -> CPA/EA attestation policy.',
  'Signature transport, immutable proof and taxpayer authorization; no wet-sign substitute inferred.',
  'Authorized filing/transmitter credentials, approved package and explicit human transmission authority.',
  'Verified receipt transport and durable tenant/case/year association.',
  'Authoritative notice evidence, independent professional response and provider actions.',
  'Verified status/deadline/SLA providers and recorded monitoring history.',
  'Archive verification, approved retention/legal hold and storage commissioning.',
  'Scoped engagement/consent renewal and authorized human operation.',
  'Annual rollover contract; no prior-year facts or expired consent promoted to current authority.',
];
for (let i = 0; i < 18; i++) {
  const source = `src/server/taxguard/stage${numbers[i]}ServerGate.ts`;
  const tests = i < 3 ? ['src/tests/serverStageGateOrchestrator.test.ts', 'src/tests/caseAuthorityHttp.test.ts'] : i < 9 ? ['src/tests/productionStages04Through09.test.ts'] : ['src/tests/completeTaxGuardLifecycleStages10Through18.test.ts'];
  add(`STAGE-${String(i + 1).padStart(2, '0')}-GATE`, `LEGACY_18_V1 ${i+1} ${names[i]} deterministic gate`, valid, [source, 'src/server/taxguard/authority.repository.ts'], [...tests, 'src/tests/stageGateUnknownEvidence.test.ts'], 'Local gate tests do not prove external operations or deployed controls. Unknown count/review-policy regression hardening passed; Stage 01 absent-flag compatibility is not a new attestation policy.');
  add(`STAGE-${String(i + 1).padStart(2, '0')}-PRODUCT`, `${names[i]} complete product experience/integration`, i === 9 ? policy : [10,11,12,15].includes(i) ? infra : missing, [source, 'src/components/workflow/LiveClientWorkflowRouter.tsx'], ['src/tests/clientStageActionTruthfulness.test.tsx', ...tests], dependencies[i]);
}
const roleRows = [
  ['CLIENT', 'src/components/portal/AuthenticatedClientDashboard.tsx', 'src/tests/clientDashboardMasterplan.test.tsx', 'Scoped provider-backed state advice, account-wide/year contracts, signatures and complete stage surfaces remain incomplete.'],
  ['ACCOUNTANT', 'src/components/workspace/AccountantWorkspace.tsx', 'src/tests/accountantDashboardMasterplan.test.tsx', 'Durable source lineage/preview/version comparison and filing-readiness telemetry; commissioned AI preparation.'],
  ['REVIEWER', 'src/components/workspace/ReviewerWorkspace.tsx', 'src/tests/reviewerDashboardAuthority.test.ts', 'Durable discovery and artifact hydration/cutover; professional decisions/attestations.'],
  ['BOOKKEEPER', 'src/components/workspace/BookkeeperDashboard.tsx', 'src/tests/bookkeeperDashboardAuthority.test.ts', 'Durable accounting/category/reconciliation/period close/reporting provider and human controls.'],
  ['PRACTICE-MANAGER', 'src/components/workspace/PracticeManagerDashboard.tsx', 'src/tests/practiceManagerAuthority.test.ts', 'Capacity/SLA/event contracts, durable history and scoped reassignment authority.'],
  ['CLIENT-SERVICE', 'src/components/workspace/ClientServiceDashboard.tsx', 'src/tests/clientServiceAuthority.test.ts', 'Scoped booking/send/read-receipt/escalation contracts and audited durable actions.'],
  ['ADMIN', 'src/components/admin/PracticeAdminWorkspace.tsx', 'src/tests/adminOperationalTruthfulness.test.tsx', 'Durable staff/job/billing/audit/retention views and approved administrative grants.'],
];
for (const [id, file, test, remaining] of roleRows) {
  add(`ROLE-${id}-READ`, `${id} bounded shell/read states/session isolation`, valid, [file], [test], 'Bounded recorded read functionality only; production commissioning and browser acceptance separate.');
  add(`ROLE-${id}-FULL`, `${id} complete role workflow`, missing, [file], [test], remaining);
}
for (const id of ['BILLING-FINANCE', 'SECURITY-COMPLIANCE', 'EXECUTIVE-OWNER']) add(`ROLE-${id}`, `${id} illustrative role dashboard`, policy,
  ['src/config/canonicalRouting.ts', 'src/components/layout/dashboardAccess.ts'], ['src/tests/dashboardShellAccess.test.ts'],
  'No canonical server role/capability/data visibility contract is established. Prepare designs only; do not invent role grants or financial privileges.');
const controls = [
  ['STAGING-SCENARIOS','All-role and eighteen-stage browser acceptance inventory','qa/staging-acceptance-plan.mjs','src/tests/stagingAcceptanceCoverage.test.ts',valid,'29 planned scenarios verified against canonical identities; actual browser execution remains NOT VERIFIED.'],
  ['TRACEABILITY-HASHES','Read-only requirement source/test hash verification','scripts/verify-local-traceability.mjs','src/tests/traceabilityEvidenceIntegrity.test.ts',valid,'Detects missing coverage, protected paths, stale code/test/doc hashes and invented browser PASS; not independent release signoff.'],
  ['STAFF-CEILING','No illustrative role fallback to Accountant','src/config/canonicalRouting.ts','src/tests/staffRoutingAuthorityCeiling.test.ts',valid,'Billing/Compliance and unmapped roles denied; established canonical role mappings retained.'],
  ['LEGACY-PROFESSIONAL','Fail-closed legacy professional/maker-checker helpers','src/server/auth.ts','src/tests/legacyProfessionalAuthorityBoundary.test.ts',valid,'No practitioner authority from role or claimed credentials; legacy maker-checker is production-disabled and requires server context in synthetic tests.'],
  ['STAGING-CONFIG','Offline staging configuration validation','src/server/config/stagingConfiguration.ts','src/tests/stagingConfiguration.test.ts',valid,'No environment loading, provider connection or release grant; operator provisioning and independent acceptance remain required.'],
  ['ACCEPTANCE-RUNNER','Fixed synthetic acceptance command and evidence runner','scripts/run-synthetic-acceptance.mjs','src/tests/syntheticAcceptancePlan.test.ts',valid,'Command plan and injected outcome tests only. Fixture build remains sandbox-blocked, all real-browser workflows NOT VERIFIED.'],
  ['ENV-CONFIG','Immutable browser environment presentation configuration','src/config/environmentConfig.ts','src/tests/environmentConfigurationIntegrity.test.ts',valid,'No server authority or compliance certification; live filing remains denied.'],
  ['SCHEMA-PROBES','Bounded readiness probes and test override isolation','src/server/taxguard/providerReadiness.service.ts','src/tests/readinessProbeBoundaries.test.ts',valid,'Five-second probe deadline, cancellation and metadata-only queries; no deployed schema/health certification.'],
  ['SHELL-SESSION','Remount shell navigation/dialog state across authority changes','src/components/layout/DashboardApplicationShell.tsx','src/tests/dashboardShellAuthorityRemount.test.tsx',valid,'Key regressions and existing SSR coverage; actual browser focus/session behavior remains NOT VERIFIED.'],
  ['MIGRATION-PREP','Disposable ordered schema and proposal rollback verification','supabase/migrations/20260928000000_taxguard_core_schema.sql','src/tests/migrationPreparationIntegrity.test.ts',valid,'Full sequence tested in PGlite; platform roles/extensions, deployed grants and official proposal migration remain unverified.'],
  ['AUDIT-PROPOSAL','Core audit append-only database guard proposal','docs/sql/taxguard-audit-append-only.proposal.sql','src/tests/auditAppendOnlyProposal.test.ts',insufficient,'Disposable SQL validation only; existing migration chain lacks this guard. Supabase CLI unavailable; official migration review/creation and deployment remain blocked. Owners can disable triggers; independent audit custody still required.'],
  ['GATE-BOOLEAN','Workflow bridge requires explicit boolean success','src/server/taxguard/stageGateBridge.ts','src/tests/stageGateBridgeBoolean.test.ts',valid,'Malformed truthy evidence denied before forwarding; existing downstream authority remains mandatory.'],
  ['IDENTITY','Verified current session and active membership','src/server/auth.ts','src/tests/productionApiHttp.test.ts',valid,'Live IAM/provider verification remains external.'],
  ['ASSIGNMENT','Exact tenant/client/case/engagement/year effective assignment','src/server/assignment-authorization.ts','src/tests/staffAssignmentDateAuthorization.test.ts',valid,'Deployed assignment provisioning is not performed.'],
  ['RLS','SQL RLS/private storage/default deny definitions','supabase/migrations/20261004000000_taxguard_private_storage_client_scope.sql','src/tests/stageTwoStorageAndAssignmentGovernance.test.ts',valid,'Local/disposable evidence; service-role bypass requires server checks; deployed roles/grants not verified.'],
  ['CONSENT','Recorded consent minimization and purpose limitation','src/server/routes/profile-amendment.routes.ts','src/tests/profileRecordedEvidence.test.ts',valid,'No legal sufficiency conclusion or additional disclosure authority.'],
  ['CONSENT-POLICY','Section 7216 purpose/recipient/use/expiry legal policy','src/server/ai/governance/GovernanceControlPlane.ts','src/tests/aiGovernanceControlPlane.test.ts',policy,'Responsible counsel/practitioner must approve exact use/disclosure and transport mapping. Raw taxpayer export remains denied.'],
  ['EVIDENCE','Exact identity/version/hash/scope/release/quarantine evidence','src/server/ai/capabilities/ScopedReadRepository.ts','src/tests/aiGovernedCapabilities.test.ts',valid,'Source metadata cannot certify taxpayer identity or authorize actions.'],
  ['UNTRUSTED','Untrusted document/model output cannot grant tools/actions','src/server/ai/gateway/structuredOutput.ts','src/tests/aiGovernedGateway.test.ts',valid,'Unmapped per-ID tools remain unavailable.'],
  ['KILL','GLOBAL/AGENT/MODEL/TOOL/WORKFLOW kill switches','src/server/ai/governance/GovernanceControlPlane.ts','src/tests/aiGovernanceControlPlane.test.ts',valid,'Production switch commissioning requires authorized operational controls.'],
  ['GATEWAY','Independent model/prompt/schema/budget/pricing/usage validation','src/server/ai/gateway/GovernedAIGateway.ts','src/tests/aiGovernedGateway.test.ts',valid,'No live model approval, pricing authority, sensitive export or fallback activated.'],
  ['CAPABILITY','Fresh independently authorized scoped read capabilities','src/server/ai/capabilities/GovernedCapabilityExecutor.ts','src/tests/aiGovernedCapabilitiesPersistence.test.ts',valid,'Counts/metadata compatibility only, not general execution.'],
  ['LEDGER','Immutable root/child/run/attempt/evidence terminal ledger','src/server/ai/ledger/ExecutionLedgerService.ts','src/tests/aiExecutionLedger.test.ts',valid,'Distributed fencing/failover/receipt reconciliation commissioning still external.'],
  ['HUMAN-RETURN','Human-only A34 RETURN/REJECT and maker-checker','src/server/ai/review/HumanProposalReviewService.ts','src/tests/aiHumanProposalReview.test.ts',valid,'Production cutover/final APPROVED remains unavailable.'],
  ['MATERIAL-DRAFT','AI-16 policy structures and always-denied preparation','src/server/ai/review/MaterialActionPreparation.ts','src/tests/aiMaterialActionPreparation.test.ts',valid,'All action/attestation/target/cutover blockers remain. Structural validation is not authorization.'],
  ['MATERIAL-WRITE','AI-16 authoritative material service','docs/taxguard-ai-agent-gate-ai-16-pre-review.md','src/tests/aiHumanProposalReview.test.ts',policy,'No concrete approved operation or attestation sources; no target writer implemented.'],
  ['SQL-READ','Disabled SQL scoped metadata adapter','src/server/taxguard/SqlCaseReadPreparation.ts','src/tests/sqlCaseReadPreparation.test.ts',valid,'Disposable SQL validation passed; no released route/production factory/artifact hydration.'],
  ['DURABILITY','Replace process-local domain authority with durable adapters','src/server/taxguard/transactionalDatabase.ts','src/tests/durableAuthority.test.ts',missing,'Local Map is not PostgreSQL durability. Schema-to-artifact/version reconciliation and authorized cutover needed.'],
  ['IDEMPOTENCY','Fingerprint-bound simulated replay and ambiguous expiry','src/server/taxguard/operations/durableIdempotency.service.ts','src/tests/legacyIdempotencyIntegrity.test.ts',valid,'Still process-local; distributed durable atomic reservation/receipt recovery required.'],
  ['JOB-QUEUE','Process-local job scheduling/retry simulation','src/server/taxguard/operations/durableJobQueue.service.ts','src/tests/legacyJobClaimIntegrity.test.ts',valid,'Current owner/state settlement checks pass; no real distributed leases/fencing, durable worker recovery or immutable claim audit.'],
  ['MALWARE','Verified clean scanner transport','src/server/taxguard/providerReadiness.service.ts','src/tests/stageTwoProductionVerification.test.ts',infra,'Transport absent; never bypass quarantine or infer clean scan from configuration.'],
  ['OCR','Cloud extraction confidence/timeout/hash preparation','src/server/taxguard/ocrProvider.ts','src/tests/ocrTransportPreparation.test.ts',valid,'Zero/missing confidence, page shapes, source/response bounds, timeout and endpoint/hash tests pass. Production native filesystem export denied; vault/consent/provider commissioning still blocked.'],
  ['CALCULATION','Deterministic federal/state rule/calculation contract','src/taxguard/calculation/TaxCalculationContract.ts','src/tests/taxCalculationCore.test.ts',valid,'Applicable current-year/individual jurisdiction authority and reviewed fact binding required; not universal tax coverage.'],
  ['ACCOUNTING-PROVIDER','QuickBooks/Xero durable integration','src/server/taxguard/bookkeeping/accountingSync.service.ts','src/tests/taxGuardBookkeepingEngine.test.ts',infra,'No commissioned transport/OAuth/read scope/external receipts; writeback remains governed.'],
  ['PAYMENT','Signature-only payment proof and webhook replay boundary','src/server/taxguard/operations/engagementBilling.service.ts','src/tests/paymentsRouteAuthority.test.ts',infra,'External Stripe setup and durable financial action contracts not commissioned.'],
  ['COMMUNICATION','Scoped client-visible/internal message boundaries','src/server/clientServiceProjection.ts','src/tests/clientServiceAuthority.test.ts',valid,'No autonomous client contact. Durable send/receipt/calendar/SLA integration missing.'],
  ['LEGACY','Refuse fixed sample extraction/Gemini/legacy production cutover','src/server/productionApp.ts','src/tests/aiLegacyProductionBoundary.test.ts',valid,'Legacy samples stay unreleased; replace only through verified source pipeline.'],
  ['NAVIGATION','Shared responsive role-aware shell and mobile inert background','src/components/layout/DashboardApplicationShell.tsx','src/tests/dashboardApplicationShell.test.tsx',valid,'Authenticated browser/screen-reader interaction QA remains unperformed.'],
  ['BROWSER','Synthetic browser acceptance harness','qa/synthetic-shell/README.md','src/tests/syntheticShellIsolation.test.ts',valid,'Stored Windows Chromium report verifies 36 synthetic-shell tests; not the 29 full-product journeys, live authentication, provider commissioning or screen-reader acceptance.'],
  ['BUNDLE','Measured role-level frontend loading optimization','src/App.tsx','src/tests/lazyWorkspaceRouting.test.tsx',valid,'Initial main chunk 316.14 kB / 72.94 kB gzip versus 1,355.37 kB baseline; no 850 kB warning. Lazy client chunk 783.65 kB; no measured user latency claim.'],
  ['READINESS','Configuration vs verified health distinction','src/server/taxguard/providerReadiness.service.ts','src/tests/providerConfigurationTruthfulness.test.ts',valid,'Configuration alone is nonoperational; synthetic overrides cannot commission production. Real health/grants/cutover still external.'],
  ['OPS','Monitoring/recovery/rollback/commissioning acceptance','docs/DISASTER_RECOVERY.md','src/tests/finalReleaseGateVerification.test.ts',infra,'Historical runbooks contain unverified operational claims; current readiness plan must supersede them and keep signoff blank.'],
];
for (const [id, requirement, file, test, status, remaining] of controls) add(`CONTROL-${id}`, requirement, status, [file], [test], remaining);
rows.find(row => row.id === 'CONTROL-ACCEPTANCE-RUNNER').implementation.push('scripts/synthetic-acceptance-plan.mjs', 'scripts/record-local-browser-blockers.mjs');
rows.find(row => row.id === 'CONTROL-BROWSER').implementation.push('qa/playwright.synthetic.config.mjs', 'qa/browser/synthetic-shell.spec.mjs');
rows.find(row => row.id === 'CONTROL-BROWSER').implementation.push('package.json', 'scripts/setup-local-browser.mjs', 'scripts/run-local-browser.mjs', 'scripts/local-browser-prerequisites.mjs');
rows.find(row => row.id === 'CONTROL-BROWSER').tests.push('src/tests/localBrowserPrerequisites.test.ts', 'src/tests/localBrowserSetup.test.ts');
rows.find(row => row.id === 'CONTROL-BROWSER').implementation.push('qa/synthetic-shell/FixtureSelect.tsx', 'qa/synthetic-shell/main.tsx', 'qa/synthetic-shell/qa.css');
rows.find(row => row.id === 'CONTROL-BROWSER').tests.push('src/tests/syntheticFixtureLabels.test.tsx');
rows.find(row => row.id === 'CONTROL-IDENTITY').implementation.push('src/services/api.ts');
rows.find(row => row.id === 'CONTROL-IDENTITY').tests.push('src/tests/sessionTokenStorageRecovery.test.ts');
rows.find(row => row.id === 'CONTROL-IDENTITY').implementation.push('src/services/clearLegacyWorkflowHints.ts', 'src/components/workflow/LiveClientWorkflowRouter.tsx');
rows.find(row => row.id === 'CONTROL-IDENTITY').tests.push('src/tests/legacyWorkflowHintCleanup.test.ts');
rows.find(row => row.id === 'CONTROL-IDENTITY').tests.push('src/tests/apiResponseRecovery.test.ts');
rows.find(row => row.id === 'CONTROL-JOB-QUEUE').tests.push('src/tests/legacyJobSnapshotIsolation.test.ts');
rows.find(row => row.id === 'CONTROL-SQL-READ').tests.push('src/tests/sqlReviewerQueuePreparation.test.ts');
rows.find(row => row.id === 'CONTROL-IDENTITY').implementation.push('src/components/auth/AuthPages.tsx');
rows.find(row => row.id === 'CONTROL-IDENTITY').tests.push('src/tests/authFormLabelAssociations.test.tsx');
rows.find(row => row.id === 'CONTROL-BROWSER').implementation.push('qa/product-browser/boundary.mjs', 'qa/product-browser/anonymous-boundaries.spec.mjs', 'qa/playwright.product-anonymous.config.mjs', 'scripts/run-local-product-browser.mjs');
rows.find(row => row.id === 'CONTROL-BROWSER').tests.push('src/tests/productAnonymousBrowserBoundary.test.ts');
for (const gate of [17,18,19,20]) add(`AI-${gate}`, `Dependent AI-${gate} release gate`, policy,
  ['docs/taxguard-ai-agent-gate-ai-16-pre-review.md'], ['src/tests/aiLegacyProductionBoundary.test.ts'], 'Canonical sequential execution depends on unresolved AI-16; independent negative tests do not complete this gate.');
for (const row of rows) for (const file of [...row.implementation, ...row.tests]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing evidence path: ${file}`);
}
const inventory = [];
function list(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) list(file);
    else if (/\.(md|sql)$/.test(entry.name) && !file.includes('taxguard-master-traceability')) {
      const content = fs.readFileSync(path.join(root, file), 'utf8');
      inventory.push({ file, sha256: createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex'), bytes: Buffer.byteLength(content),
        headings: file.endsWith('.md') ? content.split(/\r?\n/).filter(line => /^#{1,3} /.test(line)) : [] });
    }
  }
}
list('docs'); list('supabase/migrations');
const artifact = { scope: 'Available canonical architecture only; absent per-ID page-9 mapping and external evidence are explicit blockers.',
  classifications: [valid, insufficient, missing, synthetic, infra, policy], requirements: rows, source_inventory: inventory,
  evidence_versions: Object.fromEntries([...new Set(rows.flatMap(row => [...row.implementation, ...row.tests]))].sort().map(file => [file,
    createHash('sha256').update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex')])) };
for (const row of rows) {
  row.releaseClassification = row.status === valid ? 'COMPLETE AND VALIDATED'
    : row.status === infra || row.id === 'CONTROL-BROWSER' ? 'EXTERNAL INFRASTRUCTURE REQUIRED'
    : 'HUMAN GOVERNANCE APPROVAL REQUIRED';
  row.functionality = row.status === valid ? 'Named bounded function exists; full product integration is not implied' : 'Incomplete; see remaining boundary';
  row.automatedEvidence = 'Referenced tests included in local full-suite validation; not independent release acceptance';
  row.integrationAcceptance = 'Local synthetic evidence only; external integration NOT VERIFIED';
  row.browserAcceptance = 'NOT VERIFIED';
  row.securityAcceptance = 'Independent deployed security acceptance NOT VERIFIED; referenced local regressions are bounded evidence only';
  row.syntheticBrowserAcceptance = row.id === 'CONTROL-BROWSER'
    ? 'PASS: stored Windows Chromium report browser-84c48932-d463-4549-ba1e-44d9a87bff17, 36/36; not full-product acceptance'
    : 'Not independently certified by the shared-shell suite';
}
fs.writeFileSync(path.join(root, 'docs/taxguard-master-traceability.json'), JSON.stringify(artifact, null, 2) + '\n');
const link = file => `[${file}](${path.posix.relative('docs', file)})`;
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = ['# TaxGuard architecture-to-implementation traceability', '',
  'Generated offline by `node scripts/build-local-traceability.mjs`. Current evidence is bounded local implementation/testing, not commissioning. Every A00-A60 identity, every LEGACY_18_V1 stage, role experience and common canonical control has a row. Supplementary reports remain source evidence; historical claims do not override current boundaries.', '',
  'IMPLEMENTED AND VALIDATED applies to the named bounded function only. SAFE TO DEVELOP WITH SYNTHETIC DATA identifies unfinished preparation, not a grant. MISSING OR INCOMPLETE remains product work; policy and infrastructure blockers are separate. The missing multipage per-agent matrix cannot be reconstructed from names or the illustrative workflow image. No whole-product local completion claim.', '',
  '| ID | Requirement | Classification | Implementation/source | Test evidence | Remaining gap / boundary |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(r => `| ${r.id} | ${escape(r.requirement)} | ${r.status} | ${r.implementation.map(link).join('<br>')} | ${r.tests.map(link).join('<br>')} | ${escape(r.remaining)} |`), '',
  'The companion JSON inventories documentation/migration content hashes and headings. Hashes identify reviewed source versions; they do not prove clinical/legal/security correctness. Protected directories, credentials and production systems are never read. Update classifications after actual validation and regenerate after source documentation changes.', ''];
lines.push('Per-requirement release classification, functionality, integration and browser acceptance fields and code/test evidence hashes are recorded in the JSON. Real-browser acceptance remains NOT VERIFIED for every row; bounded local validation does not satisfy release acceptance.', '');
fs.writeFileSync(path.join(root, 'docs/taxguard-master-traceability.md'), lines.join('\n'));
console.log(JSON.stringify({ requirements: rows.length, agents: identities.length, stages: names.length, inventoriedDocumentsAndMigrations: inventory.length }));
