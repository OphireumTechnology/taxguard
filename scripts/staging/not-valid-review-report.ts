import fs from 'node:fs';
import { startDatabase } from '../../src/tests-db/harness';
import { reviewDocument, UNVALIDATED_CONSTRAINTS_SQL, violationQuery } from './not-valid-review.mjs';

// npm run staging:not-valid:review [-- --check]
// Composes the canonical migration plan on a disposable loopback PostgreSQL server, lists every
// NOT VALID constraint from the catalog, proves each read-only violation query runs, and writes the
// owner review sheet. It accepts no target and refuses ambient database or provider settings.
const TARGET = 'docs/development/not-valid-constraint-review.md';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('NOT_VALID_REVIEW_ARGUMENTS_REFUSED');
if (Object.keys(process.env).some(name => /^(SUPABASE|VITE_SUPABASE|DATABASE_URL|PG)/i.test(name) || name === 'TAXGUARD_DB_TEST_DIR'))
  throw new Error('NOT_VALID_REVIEW_EXTERNAL_ENVIRONMENT_REFUSED');

async function main() {
  const db = await startDatabase();
  try {
    const address = (await db.pool.query<{ a: string }>('SELECT host(inet_server_addr()) AS a')).rows[0]?.a;
    if (address !== '127.0.0.1') throw new Error('NOT_VALID_REVIEW_LOOPBACK_REQUIRED');
    const constraints = (await db.pool.query(UNVALIDATED_CONSTRAINTS_SQL)).rows;
    for (const c of constraints) {
      const table = c.table.includes('.') ? c.table : `public.${c.table}`;
      const { rows } = await db.pool.query(violationQuery({ ...c, table }));
      if (Number(rows[0].violations) !== 0) throw new Error('NOT_VALID_REVIEW_DISPOSABLE_SCHEMA_NOT_EMPTY');
    }
    const document = reviewDocument(constraints) + '\n';
    if (args.includes('--check')) {
      const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : '';
      if (current !== document) throw new Error('NOT_VALID_REVIEW_STALE');
    } else fs.writeFileSync(TARGET, document);
    console.log(JSON.stringify({ status: 'PASS', constraints: constraints.length, written: !args.includes('--check'), externalDatabaseAccess: false }));
  } finally {
    await db.stop();
  }
}

main().catch(error => {
  const report = JSON.stringify({ status: 'FAIL', message: (error as Error).message, externalDatabaseAccess: false });
  // embedded-postgres installs a beforeExit hook that would exit 0; exit explicitly instead.
  process.stderr.write(report + '\n', () => process.exit(1));
});
