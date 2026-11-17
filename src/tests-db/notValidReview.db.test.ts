import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDatabase, type TestDatabase } from './harness';
import { reviewDocument, UNVALIDATED_CONSTRAINTS_SQL, violationQuery } from '../../scripts/staging/not-valid-review.mjs';

// Phase 14 / Block 15: pre-validation queries for NOT VALID constraints, on a real disposable server.
let db: TestDatabase;
beforeAll(async () => { db = await startDatabase(); }, 240_000);
afterAll(async () => { await db?.stop(); });

describe('NOT VALID constraint review', () => {
  it('lists the canonical unvalidated constraints and every violation query runs clean on the composed schema', async () => {
    const constraints = (await db.pool.query(UNVALIDATED_CONSTRAINTS_SQL)).rows;
    expect(constraints.length).toBe(13);
    for (const c of constraints) {
      const { rows } = await db.pool.query(violationQuery({ ...c, table: c.table.includes('.') ? c.table : `public.${c.table}` }));
      expect(Number(rows[0].violations), c.name).toBe(0);
    }
    const doc = reviewDocument(constraints);
    expect(doc).toContain('Nothing here has been run against any hosted database');
    // The committed owner review sheet must match the composed schema (regenerate with npm run staging:not-valid:review).
    const fs = await import('node:fs');
    expect(fs.readFileSync('docs/development/not-valid-constraint-review.md', 'utf8').replace(/\r\n/g, '\n')).toBe(doc + '\n');
    expect(doc.match(/VALIDATE CONSTRAINT/g)).toHaveLength(13 + 1);
  });

  it('counts exactly the historical rows that a later VALIDATE would reject (CHECK and composite FOREIGN KEY)', async () => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE TABLE public.nv_parent (a text NOT NULL, b int NOT NULL, PRIMARY KEY (a, b));
        CREATE TABLE public.nv_child (id int PRIMARY KEY, status text, amount numeric, a text, b int);
        INSERT INTO public.nv_parent VALUES ('x', 1);
        INSERT INTO public.nv_child VALUES (1,'OPEN',5,'x',1),(2,'BOGUS',5,'x',1),(3,NULL,-1,'x',2),(4,'OPEN',5,NULL,9),(5,'OPEN',5,'y',1);
        ALTER TABLE public.nv_child ADD CONSTRAINT nv_status CHECK (status IN ('OPEN','CLOSED')) NOT VALID;
        ALTER TABLE public.nv_child ADD CONSTRAINT nv_amount CHECK (amount > 0) NOT VALID;
        ALTER TABLE public.nv_child ADD CONSTRAINT nv_fk FOREIGN KEY (a, b) REFERENCES public.nv_parent(a, b) NOT VALID;`);
      const rows = (await client.query(UNVALIDATED_CONSTRAINTS_SQL)).rows.filter((r: any) => r.name.startsWith('nv_'));
      const count = async (name: string) => {
        const c = rows.find((r: any) => r.name === name);
        return Number((await client.query(violationQuery({ ...c, table: 'public.nv_child' }))).rows[0].violations);
      };
      expect(await count('nv_status')).toBe(1);   // row 2; NULL status (row 3) passes a CHECK
      expect(await count('nv_amount')).toBe(1);   // row 3
      expect(await count('nv_fk')).toBe(2);       // rows 3 and 5; row 4 has a NULL key (MATCH SIMPLE)
      // The counts agree with PostgreSQL's own verdict.
      for (const name of ['nv_status', 'nv_amount', 'nv_fk']) {
        await client.query('SAVEPOINT v');
        await expect(client.query(`ALTER TABLE public.nv_child VALIDATE CONSTRAINT ${name}`)).rejects.toThrow();
        await client.query('ROLLBACK TO SAVEPOINT v');
      }
      await client.query("DELETE FROM public.nv_child WHERE id IN (2,3,5)");
      for (const name of ['nv_status', 'nv_amount', 'nv_fk']) {
        expect(await count(name)).toBe(0);
        await client.query(`ALTER TABLE public.nv_child VALIDATE CONSTRAINT ${name}`);
      }
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });

  it('refuses identifiers it cannot quote safely and constraint kinds it does not model', () => {
    expect(() => violationQuery({ table: 'public.x"; DROP TABLE y; --', name: 'n', type: 'c', definition: 'CHECK (true)' })).toThrow('NOT_VALID_REVIEW_IDENTIFIER_REFUSED');
    expect(() => violationQuery({ table: 'public.t', name: 'n', type: 'u' as any, definition: 'UNIQUE (a)' })).toThrow('NOT_VALID_REVIEW_UNSUPPORTED_TYPE');
    expect(() => violationQuery({ table: 'public.t', name: 'n', type: 'c', definition: 'EXCLUDE USING gist (a WITH &&)' })).toThrow('NOT_VALID_REVIEW_UNSUPPORTED_CHECK');
  });
});
