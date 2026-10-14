import fs from 'node:fs';
const partial = 'Partially implemented', external = 'Implemented but blocked by external commissioning', disabled = 'Intentionally disabled', decision = 'Requires owner decision', professional = 'Requires regulatory or professional approval';
// Broad product areas are not declared complete merely because a narrow synthetic path passes.
const rows = [
 ['Web application',partial,'src/App.tsx','src/tests/canonicalProductionRouting.test.ts','Role routing, shell/session isolation and controlled unavailable screens exist; complete professional journeys and independently verified accessibility remain.'],
 ['Client portal',partial,'src/server/routes/client-portal.routes.ts','src/tests/clientPortalReadsAndReassignment.test.ts','Scoped engagement/legal reads exist; full intake-to-filing journey is not implemented.'],
 ['Staff administration',external,'src/server/routes/staff-access.routes.ts','src/tests/staffAccessHardening.test.ts','Directory, invitations, membership, recovery and session controls are local; real provider enrollment/recovery acceptance remains.'],
 ['Accounting',partial,'src/server/routes/bookToTax.routes.ts','src/tests/bookToTaxHttp.test.ts','Durable workpaper preparation exists; approved fact/authority integration and specialist completion remain.'],
 ['Bookkeeping',external,'src/server/taxguard/bookkeeping/sqlLedgerStore.ts','src/tests/durableLedgerHttp.test.ts','Exact journals, approval/reversal/period controls are local; no bank or accounting platform commissioned.'],
 ['Billing',partial,'src/server/taxguard/billing/billingStore.ts','src/tests/billingHttp.test.ts','SQL client allowlists, bounded keyset pages and exact sandbox balances exist; commissioned PDFs/email and approved sales-tax policy remain.'],
 ['Documents and vault',external,'src/server/taxguard/documents/documentVaultStore.ts','src/tests/documentVaultHttp.test.ts','Quarantine, private storage and authenticated fake transport are local; real scanning and storage acceptance remain.'],
 ['Client communications',external,'src/server/routes/communications.routes.ts','src/tests/clientMessaging.test.ts','Scoped durable portal messaging exists; email/SMS delivery is not commissioned.'],
 ['Appointments',external,'src/server/routes/appointments-durable.routes.ts','src/tests/appointments.test.ts','Conflict/version/idempotency controls exist locally; external calendar synchronization remains.'],
 ['Consultation intake',decision,'src/server/routes/consultations.routes.ts','src/tests/consultationRequests.test.ts','Consented bounded requests and conversion exist; retention and proxy/rate policy decisions remain.'],
 ['Engagements',external,'src/server/routes/practice.routes.ts','src/tests/practiceManagementHttp.test.ts','Scoped durable practice workflow exists; deployment and independent acceptance remain.'],
 ['Case management',partial,'src/server/routes/cases.routes.ts','src/tests/caseWorkflowHttp.test.ts','Stages 1-8 use evidence gates; later regulated stages and canonical authority adapters remain blocked.'],
 ['Legal coordination',decision,'src/server/routes/legal-durable.routes.ts','src/tests/legalMatters.test.ts','Tracking only; counsel referral authority, engagement letters and retention remain owner decisions.'],
 ['Tax engine',professional,'src/server/taxguard/taxEngine/taxEngineStore.ts','src/tests/taxEngineHttp.test.ts','Exact deterministic infrastructure and source/version/coverage gates exist; no approved real federal/state rule content.'],
 ['Filing readiness',disabled,'src/server/taxguard/stageGateBridge.ts','src/tests/taxAIKnowledgeBoundary.test.ts','Stages 9-18, signatures and filing remain denied; provider, forms, rules and practitioner authority required.'],
 ['AI workforce A00-A60',partial,'src/ai/registry.ts','src/tests/aiArchitectureMapping.test.ts','61 identities remain DRAFT; only bounded A00/A10/A34 infrastructure exists; per-ID handlers/authority cannot be inferred.'],
 ['Authentication and MFA',external,'src/server/auth.ts','src/tests/providerOnlyIdentityFlow.test.ts','Provider-bound sessions, AAL2 and recovery controls are local; dedicated real-provider commissioning absent.'],
 ['Audit and security',partial,'src/server/securityEventRecorder.ts','src/tests/securityEventOutbox.test.ts','Committed outbox handoff now exists; delivery/custody monitoring, owner retention and independent acceptance remain.'],
 ['External integrations',disabled,'src/server/taxguard/providerReadiness.service.ts','src/tests/readinessProbeBoundaries.test.ts','No model, scanner, filing, signature, live-payment, bank, email or SMS integration commissioned.'],
 ['Staging infrastructure',decision,'src/server/config/stagingConfiguration.ts','src/tests/stagingConfiguration.test.ts','Offline configuration/seeding/recovery preparation only; project, API host/domain, managed secrets and runtime integration require owner approval.'],
 ['Production operational readiness',disabled,'src/server/productionApp.ts','src/tests/productionApiHttp.test.ts','NO-GO: no deployment, external migrations, independent acceptance, recovery evidence or commissioning.'],
];
const matrix = { baselineMain:'5f1553c7d73445081d51635310173a53373694bf',initialBaselineMain:'49369c393d6391c9de9e3ecd869bf79736c6990c',preservedCodexPhase10:'f0549efc4ac67d97258402f51af589772bd0a412', phase10Pr:15,mergedPhase10Pr:16,
  classifications:['Fully implemented and locally validated',partial,external,'Missing',disabled,decision,professional],
  limitations:'Source references and local tests identify narrow evidence; no product-wide, staging or production completion inference.',
  areas:rows.map(([area,status,source,test,remaining])=>({area,status,source,test,remaining,stagingValidated:false,productionCommissioned:false})) };
for (const row of matrix.areas) for (const file of [row.source,row.test]) if (!fs.existsSync(file)) throw new Error(`MATRIX_EVIDENCE_MISSING: ${file}`);
const output=JSON.stringify(matrix,null,2)+'\n', target='docs/development/phase11-remaining-work.json';
if (process.argv.includes('--write')) fs.writeFileSync(target,output);
else if (!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==output) throw new Error('REMAINING_WORK_MATRIX_STALE');
console.log(JSON.stringify({areas:matrix.areas.length,stagingValidated:0,productionCommissioned:0}));
