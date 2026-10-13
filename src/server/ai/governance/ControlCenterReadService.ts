import { findCanonicalAgent } from '../../../ai/registry';
import type { SessionAuthority, VerifiedIdentity } from './contracts';
import { GovernanceError } from './contracts';
import type { SqlConnection, TransactionalSql } from './SqlGovernanceStore';
import { governanceDeny as deny, governanceOperator, verifyGovernanceIdentity } from './governanceOperator';

/**
 * AI Control Center read projections (registry, execution history, governance decisions,
 * security events). Read-only, tenant-scoped by the verified identity, governance roles only.
 * Proposed-action payloads, prompts, evidence content and free-form details are never returned.
 */
const RUN_STATUSES = ['QUEUED', 'RUNNING', 'PROPOSED', 'VERIFYING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'FAILED', 'CANCELLED'];
const OUTCOMES = ['ADVISORY_ALLOWED', 'REVIEW_REQUIRED', 'DENIED'];
const EVENT_TYPES = ['AUTHORIZATION_DENIAL', 'PERMISSION_VIOLATION', 'CROSS_CLIENT_ATTEMPT', 'CROSS_TENANT_ATTEMPT', 'TOOL_DENIAL', 'POLICY_VIOLATION', 'PROMPT_INJECTION', 'KILL_SWITCH', 'MODEL_VIOLATION', 'HUMAN_APPROVAL_VIOLATION'];
const SEVERITIES = ['LOW', 'MATERIAL', 'HIGH', 'CRITICAL'];
const DETAIL_KEYS = ['operation', 'scope', 'target', 'switch_id', 'reason_sha256', 'actor_uid_sha256', 'code'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PageQuery { limit: number; cursor: { t: string; id: string } | null; filters: Record<string, string> }
export interface Page<T> { items: T[]; next_cursor: string | null }

function encodeCursor(t: string, id: string) { return Buffer.from(JSON.stringify({ t, id })).toString('base64url'); }

/** Strict query parsing: unknown keys, malformed cursors and unlisted filter values are refused. */
export function parsePageQuery(raw: unknown, allowed: Record<string, (v: string) => boolean>): PageQuery {
  const q = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  for (const key of Object.keys(q)) if (!['limit', 'cursor', ...Object.keys(allowed)].includes(key)) deny('AI_CONTROL_CENTER_INVALID_QUERY', 400);
  for (const value of Object.values(q)) if (typeof value !== 'string') deny('AI_CONTROL_CENTER_INVALID_QUERY', 400);
  const limit = q.limit === undefined ? 25 : Number(q.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) deny('AI_CONTROL_CENTER_INVALID_QUERY', 400);
  let cursor: PageQuery['cursor'] = null;
  if (q.cursor !== undefined) {
    try {
      const parsed = JSON.parse(Buffer.from(q.cursor as string, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed.t !== 'string' || !Number.isFinite(Date.parse(parsed.t)) || typeof parsed.id !== 'string' || !uuid.test(parsed.id) || Object.keys(parsed).length !== 2) throw new Error();
      cursor = { t: new Date(parsed.t).toISOString(), id: parsed.id };
    } catch { deny('AI_CONTROL_CENTER_INVALID_QUERY', 400); }
  }
  const filters: Record<string, string> = {};
  for (const [key, check] of Object.entries(allowed)) {
    if (q[key] === undefined) continue;
    if (!check(q[key] as string)) deny('AI_CONTROL_CENTER_INVALID_QUERY', 400);
    filters[key] = q[key] as string;
  }
  return { limit, cursor, filters };
}

const isAgent = (v: string) => { try { findCanonicalAgent(v); return true; } catch { return false; } };
const oneOf = (list: string[]) => (v: string) => list.includes(v);

function safeDetails(details: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) return out;
  for (const key of DETAIL_KEYS) {
    const v = (details as Record<string, unknown>)[key];
    if ((typeof v === 'string' && v.length <= 128) || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
  }
  return out;
}

export class ControlCenterReadService {
  constructor(private readonly sessions: SessionAuthority, private readonly db: TransactionalSql) {}

  private async read<T>(token: string, work: (sql: SqlConnection, identity: VerifiedIdentity) => Promise<T>): Promise<T> {
    const identity = await verifyGovernanceIdentity(this.sessions, token);
    let result: { value: T } | null;
    try {
      result = await this.db.transaction(async sql => {
        if (!(await governanceOperator(sql, identity)).allowed) return null;
        return { value: await work(sql, identity) };
      });
    } catch (error) {
      if (error instanceof GovernanceError) throw error;
      return deny('AI_CONTROL_CENTER_UNAVAILABLE', 503);
    }
    if (!result) deny('AI_CONTROL_CENTER_ROLE_DENIED');
    return result!.value;
  }

  private page<T extends { created_at: string }>(rows: (T & { _id: string })[], limit: number): Page<T> {
    const more = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items: items.map(({ _id, ...rest }) => ({ ...rest, created_at: new Date(rest.created_at).toISOString() }) as unknown as T),
      next_cursor: more && last ? encodeCursor(new Date(last.created_at).toISOString(), last._id) : null };
  }

  /** Keyset pagination on (created_at DESC, id DESC) within the verified tenant. */
  private async keyset(sql: SqlConnection, table: string, idColumn: string, columns: string, tenant: string, q: PageQuery, filterColumns: Record<string, string>) {
    const where = ['tenant_id=$1']; const params: unknown[] = [tenant];
    for (const [key, value] of Object.entries(q.filters)) { params.push(value); where.push(`${filterColumns[key]}=$${params.length}`); }
    if (q.cursor) { params.push(q.cursor.t, q.cursor.id); where.push(`(created_at,${idColumn})<($${params.length - 1}::timestamptz,$${params.length}::uuid)`); }
    params.push(q.limit + 1);
    return (await sql.query<any>(`SELECT ${columns},${idColumn} AS _id FROM ${table} WHERE ${where.join(' AND ')} ORDER BY created_at DESC,${idColumn} DESC LIMIT $${params.length}`, params)).rows;
  }

  async registry(token: string) {
    return this.read(token, async (sql, identity) => {
      const agents = (await sql.query<any>(
        'SELECT agent_id,agent_name,category,status,risk_class,version,default_model,default_model_version,prompt_id,prompt_version,confidence_threshold,human_review_threshold,token_budget,cost_budget FROM ai_agents ORDER BY agent_id')).rows;
      const stops = (await sql.query<{ scope: string; target: string }>(
        'SELECT scope,target FROM ai_kill_switches WHERE tenant_id=$1 AND enabled ORDER BY scope,target', [identity.tenant_id])).rows;
      const global = stops.some(s => s.scope === 'GLOBAL');
      const stoppedAgents = new Set(stops.filter(s => s.scope === 'AGENT').map(s => s.target));
      const stoppedModels = new Set(stops.filter(s => s.scope === 'MODEL').map(s => s.target));
      return {
        global_stop: global,
        // TOOL and WORKFLOW stops block any request using that tool or stage, whichever agent issues it.
        scoped_stops: stops.filter(s => s.scope === 'MODEL' || s.scope === 'TOOL' || s.scope === 'WORKFLOW'),
        agents: agents.map(a => {
          const modelStopped = a.default_model ? stoppedModels.has(`${a.default_model}@${a.default_model_version}`) : false;
          return { ...a,
            confidence_threshold: Number(a.confidence_threshold), human_review_threshold: Number(a.human_review_threshold), cost_budget: Number(a.cost_budget),
            stopped: global || stoppedAgents.has(a.agent_id) || modelStopped,
            stop_reason: global ? 'GLOBAL' : stoppedAgents.has(a.agent_id) ? 'AGENT' : modelStopped ? 'MODEL' : null };
        }) };
    });
  }

  async runs(token: string, raw: unknown) {
    const q = parsePageQuery(raw, { agent_id: isAgent, status: oneOf(RUN_STATUSES) });
    return this.read(token, async (sql, identity) => this.page(await this.keyset(sql, 'ai_runs', 'run_id',
      'run_id,agent_id,agent_version,model_provider,model_id,model_version,prompt_id,prompt_version,client_id,tax_case_id,tax_year,workflow_version,workflow_stage,input_hash,output_hash,confidence,risk_level,(proposed_action IS NOT NULL) AS has_proposed_action,human_review_required,reviewer,review_decision,token_usage,estimated_cost,execution_time,status,created_at,completed_at',
      identity.tenant_id, q, { agent_id: 'agent_id', status: 'status' }), q.limit));
  }

  async decisions(token: string, raw: unknown) {
    const q = parsePageQuery(raw, { agent_id: isAgent, outcome: oneOf(OUTCOMES) });
    return this.read(token, async (sql, identity) => this.page(await this.keyset(sql, 'ai_governance_decisions', 'decision_id',
      'decision_id,actor_uid,agent_id,outcome,reason_code,action_state,human_review_required,action_executed,client_id,tax_case_id,tax_year,created_at',
      identity.tenant_id, q, { agent_id: 'agent_id', outcome: 'outcome' }), q.limit));
  }

  /**
   * Token / cost and outcome totals aggregated from recorded ai_runs only (Control Center
   * "Token / Cost Monitoring", "Human Approval Queue"). Absent runs yield zero rows, never estimates.
   */
  async usage(token: string, raw: unknown) {
    const q = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
    if (Object.keys(q).some(k => k !== 'window') || (q.window !== undefined && !['24h', '7d', '30d'].includes(q.window as string))) deny('AI_CONTROL_CENTER_INVALID_QUERY', 400);
    const window = (q.window as string | undefined) ?? '24h';
    const interval = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' }[window as '24h' | '7d' | '30d'];
    return this.read(token, async (sql, identity) => {
      const rows = (await sql.query<any>(
        `SELECT agent_id,count(*)::int AS runs,coalesce(sum(token_usage),0)::bigint AS tokens,coalesce(sum(estimated_cost),0)::numeric AS estimated_cost,
          count(*) FILTER (WHERE status='REVIEW_REQUIRED')::int AS awaiting_review,count(*) FILTER (WHERE status='FAILED')::int AS failed,
          count(*) FILTER (WHERE status='REJECTED')::int AS rejected,count(*) FILTER (WHERE status='APPROVED')::int AS approved
         FROM ai_runs WHERE tenant_id=$1 AND created_at>=now()-$2::interval GROUP BY agent_id ORDER BY agent_id`, [identity.tenant_id, interval])).rows
        .map(r => ({ agent_id: r.agent_id, runs: r.runs, tokens: Number(r.tokens), estimated_cost: Number(r.estimated_cost), awaiting_review: r.awaiting_review, failed: r.failed, rejected: r.rejected, approved: r.approved }));
      const totals = rows.reduce((t, r) => ({ runs: t.runs + r.runs, tokens: t.tokens + r.tokens, estimated_cost: Number((t.estimated_cost + r.estimated_cost).toFixed(8)), awaiting_review: t.awaiting_review + r.awaiting_review, failed: t.failed + r.failed }),
        { runs: 0, tokens: 0, estimated_cost: 0, awaiting_review: 0, failed: 0 });
      // estimated_cost is the recorded per-run estimate; provider invoices are not reconciled here.
      return { window, by_agent: rows, totals, cost_basis: 'RECORDED_RUN_ESTIMATES' as const };
    });
  }

  async securityEvents(token: string, raw: unknown) {
    const q = parsePageQuery(raw, { event_type: oneOf(EVENT_TYPES), severity: oneOf(SEVERITIES), agent_id: isAgent });
    return this.read(token, async (sql, identity) => {
      const page = this.page<any>(await this.keyset(sql, 'ai_security_events', 'event_id',
        'event_id,event_type,severity,agent_id,actor_uid,client_id,tax_case_id,tax_year,details,created_at',
        identity.tenant_id, q, { event_type: 'event_type', severity: 'severity', agent_id: 'agent_id' }), q.limit);
      return { ...page, items: page.items.map(item => ({ ...item, details: safeDetails(item.details) })) };
    });
  }
}
