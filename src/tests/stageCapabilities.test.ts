import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKED_STAGES, STAGE_CAPABILITIES } from '../taxguard/stageCapabilities';
import { STAGE_NAMES } from '../services/caseService';
import { WORKFLOW_STAGES } from '../components/portal/AuthenticatedClientDashboard';

// The client-facing stage capabilities must match the server's stage policy (proposal 026,
// taxguard_case_stage_policy) and the canonical stage names; stages 09-18 stay blocked.
const sql = readFileSync('docs/proposed-migrations/20261012260000_taxguard_case_workflow.sql', 'utf8');
const policy = sql.slice(sql.indexOf('FUNCTION public.taxguard_case_stage_policy'), sql.indexOf('END $$;', sql.indexOf('FUNCTION public.taxguard_case_stage_policy')));

function serverPolicy(stage: number): { evidence: string; checklist?: string[]; dependency?: string } {
  for (const m of policy.matchAll(/WHEN p_stage (?:IN \(([\d, ]+)\)|= (\d+)) THEN jsonb_build_object\(([^\r\n]+)\)\r?\n/g)) {
    const stages = (m[1] ?? m[2]).split(',').map(x => Number(x.trim()));
    if (!stages.includes(stage)) continue;
    const body = m[3];
    return { evidence: /'evidence', '(\w+)'/.exec(body)![1], checklist: /jsonb_build_array\(([^)]+)\)/.exec(body)?.[1].split(',').map(x => x.trim().replace(/'/g, '')),
      dependency: /'dependency', '(\w+)'/.exec(body)?.[1] };
  }
  const fallback = /ELSE jsonb_build_object\('evidence', '(\w+)', 'dependency', '(\w+)'\)/.exec(policy)!;
  return { evidence: fallback[1], dependency: fallback[2] };
}

describe('canonical stage capabilities', () => {
  it('cover all 18 stages with the canonical names', () => {
    expect(STAGE_CAPABILITIES.map(s => s.stage)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(STAGE_CAPABILITIES.map(s => s.name)).toEqual(STAGE_NAMES);
    expect(WORKFLOW_STAGES.map(s => s.name)).toEqual(STAGE_NAMES);
  });
  it.each(Array.from({ length: 18 }, (_, i) => i + 1))('stage %i matches the server stage policy', stage => {
    const s = STAGE_CAPABILITIES[stage - 1], p = serverPolicy(stage);
    expect(s.evidence).toBe(p.evidence);
    expect(s.dependency).toBe(p.dependency);
    expect(s.checklist).toEqual(p.checklist);
  });
  it('keeps stages 09-18 blocked with a reason, and no blocked stage before 09', () => {
    expect(BLOCKED_STAGES).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    for (const s of STAGE_CAPABILITIES.filter(x => x.evidence === 'BLOCKED')) expect(s.blockedReason?.length ?? 0, String(s.stage)).toBeGreaterThan(30);
  });
  it('never describes an uncommissioned capability as available', () => {
    const text = JSON.stringify(STAGE_CAPABILITIES);
    for (const claim of [/transmits?/i, /accepted by/i, /we file/i, /calculates/i, /optimi[sz]e/i, /sends reminder/i, /\bCPA\b/, /certified/i]) expect(text).not.toMatch(claim);
  });
});
