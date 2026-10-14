// Phase 10 mutation checks: each mutation removes or weakens one security protection added in this
// phase; the named tests must then FAIL ("killed"). Every file is restored afterwards, also on error
// or interruption. Offline (vitest on PGlite only).   node scripts/mutation/phase10-mutations.mjs
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const MUTANTS = [
  ['scanner: HMAC comparison skipped', 'src/server/taxguard/documents/malwareScanning.ts',
    "if (!timingSafeEqual(expected, Buffer.from(sig, 'hex'))) throw new ScanError('SCAN_CALLBACK_UNAUTHENTICATED', 401);", '', 'src/tests/malwareScanning.test.ts'],
  ['scanner: timestamp window removed', 'src/server/taxguard/documents/malwareScanning.ts',
    "if (Math.abs(nowMs / 1000 - Number(ts)) > CALLBACK_MAX_SKEW_SECONDS) throw new ScanError('SCAN_CALLBACK_STALE', 401);", '', 'src/tests/malwareScanning.test.ts'],
  ['050: verdict replay accepted', 'docs/proposed-migrations/20261014500000_taxguard_document_scan_requests.sql',
    "IF r.status IN ('COMPLETED','FAILED') THEN RAISE EXCEPTION 'SCAN_VERDICT_REPLAYED' USING ERRCODE = 'P0001'; END IF;", '', 'src/tests/malwareScanning.test.ts'],
  ['050: expired requests accepted', 'docs/proposed-migrations/20261014500000_taxguard_document_scan_requests.sql',
    "IF r.status = 'EXPIRED' OR r.expires_at <= now() THEN RAISE EXCEPTION 'SCAN_REQUEST_EXPIRED' USING ERRCODE = 'P0001'; END IF;", '', 'src/tests/malwareScanning.test.ts'],
  ['047: clients receive the staff projection', 'docs/proposed-migrations/20261014470000_taxguard_billing_client_projection.sql',
    "SELECT CASE WHEN p_kind IN ('staff','manager') THEN", "SELECT CASE WHEN p_kind IN ('staff','manager','client') THEN", 'src/tests/billingClientProjection.test.ts'],
  ['047: rejected credit reasons visible to clients', 'docs/proposed-migrations/20261014470000_taxguard_billing_client_projection.sql',
    "FROM public.taxguard_invoice_credits c WHERE c.invoice_id = i.id AND c.status = 'APPLIED')) $$;", "FROM public.taxguard_invoice_credits c WHERE c.invoice_id = i.id)) $$;", 'src/tests/billingClientProjection.test.ts'],
  ['048: per-source bound raised', 'docs/proposed-migrations/20261014480000_taxguard_security_events.sql', 'IF tenant_total > 600 OR w.recorded > 20 THEN', 'IF tenant_total > 600 OR w.recorded > 2000 THEN', 'src/tests/securityEvents.test.ts'],
  ['048: free-text detail kept', 'docs/proposed-migrations/20261014480000_taxguard_security_events.sql', "WHERE key IN ('resourceType','route','method','status','reason','requestId','clientId','authorizationResult')", "WHERE key IS NOT NULL", 'src/tests/securityEvents.test.ts'],
  ['sink: legacy message forwarded', 'src/server/taxguard/audit/securityEventSink.ts', "    const detail: Record<string, string> = {};", "    const detail: Record<string, string> = { message: String(event.details) };", 'src/tests/securityEvents.test.ts'],
  ['049: tenant-claim policies kept', 'docs/proposed-migrations/20261014490000_taxguard_data_api_lockdown.sql', 'DROP POLICY IF EXISTS rls_taxguard_je_all ON public.taxguard_journal_entries;', '', 'src/tests/proposalCompositionSecurity.test.ts'],
  ['049: client-role table writes kept', 'docs/proposed-migrations/20261014490000_taxguard_data_api_lockdown.sql', "EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated', r.rel);", "EXECUTE format('REVOKE TRUNCATE ON %s FROM anon', r.rel);", 'src/tests/migrationReadinessAudit.test.ts -t client-facing'],
  ['staging: protected project accepted', 'src/server/config/stagingEnvironmentValidator.ts', "if (value.toLowerCase().includes(PROTECTED_PROJECT_REF)) add('PROJECT', field, 'PROTECTED_PRODUCTION_PROJECT_REFUSED');", '', 'src/tests/stagingEnvironmentValidator.test.ts'],
  ['staging: production overlap accepted', 'src/server/config/stagingEnvironmentValidator.ts', "else if (v('TAXGUARD_PRODUCTION_PROJECT_REF') === ref) add('PROJECT', 'TAXGUARD_PRODUCTION_PROJECT_REF', 'STAGING_PRODUCTION_OVERLAP');", '', 'src/tests/stagingEnvironmentValidator.test.ts'],
  ['staging: live payment keys accepted', 'src/server/config/stagingEnvironmentValidator.ts', "if (v('STRIPE_SECRET_KEY') && !/^sk_test_[A-Za-z0-9]+$/.test(v('STRIPE_SECRET_KEY')!)) add('BILLING', 'STRIPE_SECRET_KEY', 'LIVE_PAYMENT_KEY_DENIED');", '', 'src/tests/stagingEnvironmentValidator.test.ts'],
  ['MFA guard: production overlap accepted', 'src/server/providerValidationTarget.ts', "if (production === ref) return { ok: false, reason: 'REFUSED_PRODUCTION_OVERLAP' };", '', 'src/tests/providerValidationTarget.test.ts'],
  ['diagnostics: any verified active MFA user', 'src/server/operationalDiagnostics.ts', "||!['admin','administrator','super_admin','super_administrator'].includes(req.user.role)", '', 'src/tests/healthEndpoints.test.ts'],
  ['readiness: dependency details published', 'src/server/observability/health.ts', "res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });", "res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', probes: await diagnostics(deps.probes()) });", 'src/tests/healthEndpoints.test.ts'],
  ['legacy routes served again', 'src/server/routes/retiredLegacyRoutes.ts', "res.status(410).json", "res.status(200).json", 'src/tests/legacyRouteRetirement.test.ts'],
  ['backup: non-disposable restore allowed', 'scripts/backup/logical-backup.mjs', "if (disposable !== true) throw new Error('RESTORE_TARGET_NOT_DECLARED_DISPOSABLE');", '', 'src/tests/migrationReadinessAudit.test.ts'],
  ['056: expired bound requests accepted','docs/proposed-migrations/20261015050000_taxguard_document_scan_jobs.sql',"IF r.status='EXPIRED' OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'SCAN_REQUEST_EXPIRED' USING ERRCODE='P0001';END IF;",'', 'src/tests/documentVaultHttp.test.ts'],
  ['056: consumed bound verdicts accepted','docs/proposed-migrations/20261015050000_taxguard_document_scan_jobs.sql',"IF r.status IN('COMPLETED','FAILED') THEN RAISE EXCEPTION 'SCAN_VERDICT_REPLAYED' USING ERRCODE='P0001';END IF;",'', 'src/tests/documentVaultHttp.test.ts'],
];

const results = [];
const originals = new Map();
const baselines=new Set();
const restore = () => { for (const [f, s] of originals) fs.writeFileSync(f, s); };
process.on('SIGINT', () => { restore(); process.exit(130); });
try {
  for (const [name, file, from, to, test] of MUTANTS) {
    const source = originals.get(file) ?? fs.readFileSync(file, 'utf8');
    originals.set(file, source);
    if (source.split(from).length !== 2) { results.push({ name, outcome: 'ANCHOR_NOT_FOUND' }); continue; }
    // The backup library is exercised by the real-PostgreSQL suite; its mutant is checked there.
    const runner = file.startsWith('scripts/backup/') ? ['vitest', 'run', '-c', 'vitest.db.config.ts', 'src/tests-db/backupRestore.db.test.ts'] : ['vitest', 'run', ...test.split(' ')];
    const args=['node_modules/vitest/vitest.mjs',...runner.slice(1)],baselineKey=JSON.stringify(args);
    if(!baselines.has(baselineKey)){
      const baseline=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:600000});
      if(baseline.error||baseline.signal||baseline.status!==0){results.push({name,outcome:'BASELINE_FAILED'});continue;}baselines.add(baselineKey);
    }
    fs.writeFileSync(file, source.split(from).join(to));
    const r = spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:600000});
    fs.writeFileSync(file, source);
    const outcome=r.error||r.signal||r.status===null?'EXECUTION_FAILED':r.status===0?'SURVIVED':/Tests\s+.*\b[1-9]\d* failed/.test((r.stdout||'')+(r.stderr||''))?'KILLED':'EXECUTION_FAILED';
    results.push({name,outcome});console.log(`${outcome}  ${name}`);
  }
} finally { restore(); }
const survived = results.filter(r => r.outcome !== 'KILLED');
console.log(JSON.stringify({ mutants: results.length, killed: results.length - survived.length, survived }, null, 2));
process.exit(survived.length ? 1 : 0);
