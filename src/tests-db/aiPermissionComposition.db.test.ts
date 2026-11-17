import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDatabase, type TestDatabase } from './harness';

// Agent permission completeness on the composed schema: every applied migration plus every review-only proposal. No
// migration or proposal may grant an agent anything; every agent has an explicit DENY row for every tool and action,
// data classification and workflow stage, so an absent row is never the only thing standing between an agent and a
// capability. Grants are owner decisions made through reviewed changes, never seeded.
let db: TestDatabase;
const one = async (sql: string) => (await db.pool.query(sql)).rows[0];

beforeAll(async () => { db = await startDatabase(); }, 240_000);
afterAll(async () => { await db?.stop(); });

describe('agent permissions on the composed schema', () => {
  it('registers exactly the 61 canonical agents, all DRAFT', async () => {
    expect(await one(`SELECT count(*)::int AS n, count(*) FILTER (WHERE status <> 'DRAFT')::int AS active FROM ai_agents`)).toEqual({ n: 61, active: 0 });
  });

  it('grants nothing: every tool, data and stage permission is DENY', async () => {
    expect(await one(`SELECT
      (SELECT count(*) FROM ai_agent_permissions WHERE permission_state <> 'DENY')::int AS tools,
      (SELECT count(*) FROM ai_agent_data_permissions WHERE permission_state <> 'DENY')::int AS data,
      (SELECT count(*) FROM ai_stage_permissions WHERE permission_state <> 'DENY')::int AS stages`)).toEqual({ tools: 0, data: 0, stages: 0 });
  });

  it('has an explicit row for every agent and tool action, data classification and stage', async () => {
    const missing = await one(`SELECT
      (SELECT count(*) FROM ai_agents a CROSS JOIN ai_tools t CROSS JOIN unnest(ARRAY['READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT']) x(action)
        WHERE NOT EXISTS (SELECT 1 FROM ai_agent_permissions p WHERE p.agent_id = a.agent_id AND p.resource = t.tool_id AND p.action = x.action))::int AS tools,
      (SELECT count(*) FROM ai_agents a CROSS JOIN ai_data_classifications d
        WHERE NOT EXISTS (SELECT 1 FROM ai_agent_data_permissions p WHERE p.agent_id = a.agent_id AND p.data_classification = d.data_classification))::int AS data,
      (SELECT count(*) FROM ai_agents a CROSS JOIN ai_workflow_stages s
        WHERE NOT EXISTS (SELECT 1 FROM ai_stage_permissions p WHERE p.agent_id = a.agent_id AND p.workflow_version = s.workflow_version AND p.stage = s.stage))::int AS stages`);
    expect(missing).toEqual({ tools: 0, data: 0, stages: 0 });
  });

  it('keeps secrets and authentication data deniable only, and an unseeded permission defaults to DENY', async () => {
    await expect(db.pool.query(`UPDATE ai_agent_data_permissions SET permission_state = 'ALLOW' WHERE agent_id = 'A34' AND data_classification = 'SYSTEM_SECRET'`)).rejects.toThrow(/check/i);
    for (const table of ['ai_agent_permissions', 'ai_agent_data_permissions', 'ai_stage_permissions'])
      expect((await one(`SELECT column_default FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'permission_state'`)).column_default, table).toMatch(/^'DENY'::/);
  });
});
